import { BaseCollector, CollectorResult } from './base.js';

interface CongressBill {
    number: number;
    title: string;
    type: string;
    originChamber: string;
    latestAction: {
        actionDate: string;
        text: string;
    };
    updateDate: string;
    url: string;
    congress: number;
    policyArea?: {
        name: string;
    };
}

interface CongressResponse {
    bills: CongressBill[];
    pagination: {
        count: number;
        next?: string;
    };
}

/**
 * Congress.gov API — US Legislative Tracker for Immigration Bills
 * https://api.congress.gov/v3/
 * 
 * Requires free API key from api.data.gov
 * Tracks immigration-related bills and their status.
 */
export class CongressCollector extends BaseCollector {
    readonly sourceName = 'congress_gov';
    readonly description = 'US Congress bills on immigration, visas, refugees';

    private readonly BASE = 'https://api.congress.gov/v3';
    private readonly API_KEY = process.env.CONGRESS_API_KEY || '';

    // Subject terms related to immigration
    private readonly SEARCH_TERMS = [
        'Immigration',
        'Visas and Passports',
        'Refugees',
        'Citizenship and Naturalization',
    ];

    // Keywords for category detection
    private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
        'visa': ['visa', 'H-1B', 'green card', 'immigrant visa', 'nonimmigrant', 'petition', 'EB-', 'F-1'],
        'labor': ['employment', 'work permit', 'EAD', 'labor certification', 'PERM', 'worker', 'wages'],
        'asylum': ['asylum', 'refugee', 'TPS', 'humanitarian', 'parole', 'protection'],
        'tax': ['tax', 'fee', 'premium processing', 'USCIS fee'],
        'education': ['student', 'STEM', 'OPT', 'CPT', 'university'],
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        if (!this.API_KEY) {
            console.log('  ⚠️ CONGRESS_API_KEY not set. Get one at https://api.data.gov/signup/');
            return {
                source: this.sourceName,
                status: 'error',
                recordsAdded: 0, recordsUpdated: 0, recordsSkipped: 0,
                errorMessage: 'CONGRESS_API_KEY not configured',
                durationMs: 0,
            };
        }

        // Check US exists in DB
        const country = await this.prisma.country.findUnique({ where: { code: 'US' } });
        if (!country) {
            return {
                source: this.sourceName,
                status: 'error',
                recordsAdded: 0, recordsUpdated: 0, recordsSkipped: 0,
                errorMessage: 'Country US not in database',
                durationMs: 0,
            };
        }

        // Fetch recent immigration-related bills
        const currentCongress = this.getCurrentCongress();

        for (const subject of this.SEARCH_TERMS) {
            try {
                console.log(`  🏛️ Searching: ${subject}`);

                const url = `${this.BASE}/bill/${currentCongress}?policyArea=${encodeURIComponent(subject)}&limit=20&sort=updateDate+desc&api_key=${this.API_KEY}`;
                const response = await this.fetchJson<CongressResponse>(url);

                if (!response.bills || response.bills.length === 0) {
                    console.log(`    ⏭️ No bills found for "${subject}"`);
                    continue;
                }

                for (const bill of response.bills) {
                    const title = `${bill.type}${bill.number}: ${bill.title}`.substring(0, 500);

                    // Check for duplicates by source URL
                    const sourceUrl = bill.url || `https://www.congress.gov/bill/${currentCongress}th-congress/${bill.originChamber.toLowerCase()}-bill/${bill.number}`;

                    const existing = await this.prisma.legalUpdate.findFirst({
                        where: {
                            countryCode: 'US',
                            sourceUrl,
                        },
                    });

                    if (existing) {
                        // Update if action changed
                        if (existing.summary !== bill.latestAction?.text) {
                            await this.prisma.legalUpdate.update({
                                where: { id: existing.id },
                                data: {
                                    summary: bill.latestAction?.text || existing.summary,
                                    details: `Latest action (${bill.latestAction?.actionDate}): ${bill.latestAction?.text}`,
                                },
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                        continue;
                    }

                    // Determine category
                    const category = this.detectCategory(title + ' ' + (bill.latestAction?.text || ''));

                    // Determine impact level
                    const impactLevel = this.detectImpactLevel(title + ' ' + (bill.latestAction?.text || ''));

                    // Parse date for effectiveDate
                    const actionDate = bill.latestAction?.actionDate
                        ? new Date(bill.latestAction.actionDate)
                        : new Date(bill.updateDate);

                    await this.prisma.legalUpdate.create({
                        data: {
                            countryCode: 'US',
                            category,
                            title: title.substring(0, 500),
                            summary: bill.latestAction?.text || 'No action text',
                            details: `Congress: ${bill.congress} | Chamber: ${bill.originChamber} | Policy Area: ${bill.policyArea?.name || 'N/A'} | Latest action (${bill.latestAction?.actionDate}): ${bill.latestAction?.text || 'N/A'}`,
                            impactLevel,
                            sourceUrl,
                            effectiveDate: actionDate,
                            publishedAt: actionDate,
                        },
                    });
                    added++;
                }

                console.log(`    ✅ ${subject}: ${response.bills.length} bills processed`);
            } catch (err: any) {
                console.error(`  ⚠️ ${subject}: ${err.message}`);
                skipped++;
            }
        }

        return {
            source: this.sourceName,
            status: added + updated > 0 ? 'success' : (skipped > 0 ? 'partial' : 'error'),
            recordsAdded: added,
            recordsUpdated: updated,
            recordsSkipped: skipped,
            durationMs: 0,
        };
    }

    private getCurrentCongress(): number {
        // Congress number = (year - 1789) / 2 + 1, rounded down
        const year = new Date().getFullYear();
        return Math.floor((year - 1789) / 2) + 1;
    }

    private detectCategory(text: string): string {
        const lower = text.toLowerCase();
        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
                return category;
            }
        }
        return 'visa'; // default for immigration bills
    }

    private detectImpactLevel(text: string): string {
        const lower = text.toLowerCase();
        const criticalWords = ['suspend', 'terminate', 'ban', 'prohibit', 'revoke', 'emergency'];
        const highWords = ['reform', 'overhaul', 'comprehensive', 'signed into law', 'enacted', 'passed'];
        const mediumWords = ['amend', 'modify', 'extend', 'introduce', 'propose'];

        if (criticalWords.some(w => lower.includes(w))) return 'critical';
        if (highWords.some(w => lower.includes(w))) return 'high';
        if (mediumWords.some(w => lower.includes(w))) return 'medium';
        return 'low';
    }
}
