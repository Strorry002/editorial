import { BaseCollector, CollectorResult } from './base.js';

interface GovFeedConfig {
    name: string;
    url: string;
    countryCode: string;
    sourceType: 'rss' | 'atom' | 'json_api';
    defaultCategory: string;
    defaultImpactLevel: string;
}

/**
 * Government Legislative Sources — Official Gazettes & Immigration Law Feeds
 * 
 * Per-country official government RSS/Atom/API feeds:
 * - US: Federal Register (DHS immigration rules)
 * - UK: legislation.gov.uk (immigration acts)
 * - CA: Canada Gazette (immigration regulations)
 * - AU: Parliament of Australia (migration bills)
 * - NZ: New Zealand Legislation (immigration act amendments)
 * - DE: BAMF news
 * - EU: EUR-Lex Official Journal
 * 
 * All sources are official government/legislative bodies.
 * Keyword filter ensures only immigration-relevant entries are stored.
 */
export class GovLegislationCollector extends BaseCollector {
    readonly sourceName = 'gov_legislation';
    readonly description = 'Official government legislation feeds — immigration laws & regulations per country';

    private readonly FEEDS: GovFeedConfig[] = [
        // ═══ TIER 1: Verified working JSON API ═══
        // 🇺🇸 US — Federal Register: DHS immigration rules (JSON API — best source)
        {
            name: 'US Federal Register — DHS Immigration',
            url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions[agencies][]=homeland-security-department&conditions[term]=immigration+visa+asylum',
            countryCode: 'US',
            sourceType: 'json_api',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇺🇸 US — Federal Register: DOJ EOIR immigration courts
        {
            name: 'US Federal Register — DOJ Immigration',
            url: 'https://www.federalregister.gov/api/v1/documents.json?per_page=10&order=newest&conditions[agencies][]=executive-office-for-immigration-review&conditions[term]=immigration+asylum',
            countryCode: 'US',
            sourceType: 'json_api',
            defaultCategory: 'asylum',
            defaultImpactLevel: 'high',
        },

        // ═══ TIER 2: RSS/Atom Feeds ═══
        // 🇬🇧 UK — legislation.gov.uk: New Statutory Instruments
        {
            name: 'UK New Statutory Instruments',
            url: 'https://www.legislation.gov.uk/new/uksi/data.feed',
            countryCode: 'GB',
            sourceType: 'atom',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇬🇧 UK — legislation.gov.uk: New UK Acts
        {
            name: 'UK New Acts of Parliament',
            url: 'https://www.legislation.gov.uk/new/ukpga/data.feed',
            countryCode: 'GB',
            sourceType: 'atom',
            defaultCategory: 'visa',
            defaultImpactLevel: 'critical',
        },
        // 🇨🇦 Canada — IRCC Official Notices
        {
            name: 'Canada IRCC Notices',
            url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.atom',
            countryCode: 'CA',
            sourceType: 'atom',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇺🇸 US — USCIS Alerts (immigration services agency)
        {
            name: 'USCIS Alerts',
            url: 'https://www.uscis.gov/news/alerts/rss.xml',
            countryCode: 'US',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇸🇪 Sweden — Migrationsverket (Migration Agency — EN news)
        {
            name: 'Sweden Migrationsverket — News (EN)',
            url: 'https://www.migrationsverket.se/rss_en',
            countryCode: 'SE',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇸🇪 Sweden — Migrationsverket Regulations (MIGRFS)
        {
            name: 'Sweden Migrationsverket — Regulations',
            url: 'https://www.migrationsverket.se/rss_migrfs',
            countryCode: 'SE',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'critical',
        },
        // 🇪🇸 Spain — Boletín Oficial del Estado (official gazette)
        {
            name: 'Spain BOE — Official Gazette',
            url: 'https://boe.es/rss/boe.php?s=4',
            countryCode: 'ES',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇦🇺 Australia — Dept of Home Affairs (immigration)
        {
            name: 'Australia Home Affairs — Immigration News',
            url: 'https://immi.homeaffairs.gov.au/news/feed',
            countryCode: 'AU',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇮🇹 Italy — Min. Interior (Immigration & Asylum)
        {
            name: 'Italy Min. Interior — Immigration',
            url: 'https://www.interno.gov.it/it/stampa-e-comunicazione/news/feed',
            countryCode: 'IT',
            sourceType: 'rss',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        // 🇺🇸 US — State Dept Refugees & Migration
        {
            name: 'US State Dept — Refugees & Migration',
            url: 'https://www.state.gov/rss-feed/population-refugees-and-migration/',
            countryCode: 'US',
            sourceType: 'rss',
            defaultCategory: 'asylum',
            defaultImpactLevel: 'high',
        },
    ];

    // EU countries in our DB for EU-wide legislation
    private readonly EU_COUNTRIES = ['DE', 'FR', 'NL', 'SE', 'ES', 'IT', 'AT', 'PT'];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const feed of this.FEEDS) {
            try {
                console.log(`  🏛️ Fetching: ${feed.name}`);
                const result = feed.sourceType === 'json_api'
                    ? await this.processFederalRegister(feed)
                    : await this.processXMLFeed(feed);
                added += result.added;
                updated += result.updated;
                skipped += result.skipped;
                console.log(`    ✅ ${feed.name}: +${result.added} added, ${result.skipped} filtered`);
            } catch (err: any) {
                console.error(`    ⚠️ ${feed.name}: ${err.message}`);
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

    /**
     * US Federal Register JSON API
     * Returns structured JSON with immigration rules/proposed rules
     */
    private async processFederalRegister(feed: GovFeedConfig): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        const country = await this.prisma.country.findUnique({ where: { code: 'US' } });
        if (!country) return { added: 0, updated: 0, skipped: 1 };

        const data = await this.fetchJson<any>(feed.url);
        if (!data?.results) return { added: 0, updated: 0, skipped: 1 };

        for (const doc of data.results.slice(0, 20)) {
            const title = doc.title || '';
            const abstract = doc.abstract || '';
            const sourceUrl = doc.html_url || doc.document_number || '';

            // Immigration relevance filter
            if (!this.isImmigrationRelevant(title, abstract)) {
                skipped++;
                continue;
            }

            // Dedup
            const existing = await this.prisma.legalUpdate.findFirst({ where: { sourceUrl } });
            if (existing) { skipped++; continue; }

            // Parse dates
            let effectiveDate: Date | null = null;
            let publishedAt = new Date();
            if (doc.publication_date) {
                const parsed = new Date(doc.publication_date);
                if (!isNaN(parsed.getTime())) publishedAt = parsed;
            }
            if (doc.effective_on) {
                const effDate = new Date(doc.effective_on);
                if (!isNaN(effDate.getTime())) effectiveDate = effDate;
            }

            // Detect type & impact
            const docType = doc.type || 'Rule';
            const impactLevel = docType === 'Rule' ? 'critical'
                : docType === 'Proposed Rule' ? 'high'
                    : docType === 'Notice' ? 'medium'
                        : 'low';

            const category = this.detectCategoryFromText(`${title} ${abstract}`);

            await this.prisma.legalUpdate.create({
                data: {
                    countryCode: 'US',
                    category,
                    title: `[${docType}] ${title}`.substring(0, 500),
                    summary: abstract.substring(0, 2000) || 'Federal Register document',
                    details: `Federal Register Doc #${doc.document_number} | Agency: ${(doc.agencies || []).map((a: any) => a.name).join(', ')} | Type: ${docType} | Pages: ${doc.start_page}-${doc.end_page}`,
                    impactLevel,
                    sourceUrl,
                    effectiveDate,
                    publishedAt,
                },
            });
            added++;
        }

        return { added, updated, skipped };
    }

    /**
     * Standard RSS/Atom XML feeds from government legislative sites
     */
    private async processXMLFeed(feed: GovFeedConfig): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        // Add timeout to prevent hangs on slow government servers
        const response = await fetch(feed.url, {
            headers: { 'User-Agent': 'ImmigrantsDataBot/1.0', 'Accept': 'application/xml, application/rss+xml, application/atom+xml, text/xml, */*' },
            signal: AbortSignal.timeout(10000), // 10s hard timeout
        });
        if (!response.ok) {
            console.log(`    ⚠️ ${feed.name}: HTTP ${response.status}: ${response.statusText}`);
            return { added: 0, updated: 0, skipped: 1 };
        }
        const xml = await response.text();
        const items = this.parseXMLItems(xml);
        const recentItems = items.slice(0, 20);

        // Determine target countries (EU-wide vs single country)
        const isEU = feed.name.includes('EUR-Lex');
        const targetCountries = isEU ? this.EU_COUNTRIES : [feed.countryCode];

        for (const item of recentItems) {
            if (!item.title || !item.link) { skipped++; continue; }

            // Immigration relevance filter
            if (!this.isImmigrationRelevant(item.title, item.description || '')) {
                skipped++;
                continue;
            }

            // Date parsing
            let effectiveDate: Date | null = null;
            let publishedAt = new Date();
            if (item.pubDate) {
                const parsed = new Date(item.pubDate);
                if (!isNaN(parsed.getTime())) {
                    effectiveDate = parsed;
                    publishedAt = parsed;
                }
            }

            const category = this.detectCategoryFromText(`${item.title} ${item.description || ''}`);
            // Skip fetchArticleContent for gov feeds — titles are descriptive, avoids timeouts

            for (const countryCode of targetCountries) {
                const country = await this.prisma.country.findUnique({ where: { code: countryCode } });
                if (!country) continue;

                // Dedup per country
                const existing = await this.prisma.legalUpdate.findFirst({
                    where: { sourceUrl: item.link, countryCode },
                });
                if (existing) { skipped++; continue; }

                const prefix = isEU ? '[EU]' : `[${countryCode}]`;
                await this.prisma.legalUpdate.create({
                    data: {
                        countryCode,
                        category,
                        title: `${prefix} ${this.stripHtml(item.title)}`.substring(0, 500),
                        summary: this.stripHtml(item.description || 'Legislative update').substring(0, 2000),
                        details: this.stripHtml(item.description || '').substring(0, 2000) || `Source: ${feed.name}`,
                        impactLevel: feed.defaultImpactLevel,
                        sourceUrl: item.link,
                        effectiveDate,
                        publishedAt,
                    },
                });
                added++;
            }
        }

        return { added, updated, skipped };
    }

    private parseXMLItems(xml: string): { title: string; link: string; description?: string; pubDate?: string }[] {
        const items: { title: string; link: string; description?: string; pubDate?: string }[] = [];

        // RSS 2.0
        const rssRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = rssRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            items.push({
                title: this.extractTag(itemXml, 'title'),
                link: this.extractTag(itemXml, 'link') || this.extractTag(itemXml, 'guid'),
                description: this.extractTag(itemXml, 'description'),
                pubDate: this.extractTag(itemXml, 'pubDate') || this.extractTag(itemXml, 'dc:date'),
            });
        }

        // Atom
        if (items.length === 0) {
            const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi;
            while ((match = atomRegex.exec(xml)) !== null) {
                const entryXml = match[1];
                const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
                items.push({
                    title: this.extractTag(entryXml, 'title'),
                    link: linkMatch ? linkMatch[1] : '',
                    description: this.extractTag(entryXml, 'summary') || this.extractTag(entryXml, 'content'),
                    pubDate: this.extractTag(entryXml, 'updated') || this.extractTag(entryXml, 'published'),
                });
            }
        }

        return items;
    }

    private extractTag(xml: string, tag: string): string {
        const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
        const cdataMatch = xml.match(cdataRegex);
        if (cdataMatch) return cdataMatch[1].trim();

        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? this.stripHtml(match[1].trim()) : '';
    }

    private detectCategoryFromText(text: string): string {
        const lower = text.toLowerCase();
        if (['asylum', 'refugee', 'protection', 'deportation', 'removal'].some(k => lower.includes(k))) return 'asylum';
        if (['work permit', 'employment', 'labor', 'worker', 'skilled'].some(k => lower.includes(k))) return 'labor';
        if (['tax', 'fee', 'premium'].some(k => lower.includes(k))) return 'tax';
        if (['student', 'education', 'university', 'study'].some(k => lower.includes(k))) return 'education';
        if (['health', 'medical', 'vaccination'].some(k => lower.includes(k))) return 'healthcare';
        if (['digital nomad', 'remote work', 'freelance'].some(k => lower.includes(k))) return 'digital_nomad';
        return 'visa'; // default for immigration legislation
    }
}
