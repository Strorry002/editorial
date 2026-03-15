import { BaseCollector, CollectorResult } from './base.js';

interface UNHCRPopulationRecord {
    year: number;
    country_of_asylum: string;
    country_of_asylum_en: string;
    country_of_origin: string;
    country_of_origin_en: string;
    refugees: number | null;
    asylum_seekers: number | null;
    returned_refugees: number | null;
    idps: number | null;
    returned_idps: number | null;
    stateless: number | null;
    ooc: number | null;  // others of concern
    oip: number | null;  // other people in need of international protection
}

interface UNHCRAsylumRecord {
    year: number;
    country_of_asylum: string;
    country_of_asylum_en: string;
    country_of_origin: string;
    country_of_origin_en: string;
    procedure_type: string;
    app_type: string;
    dec_level: string;
    applied: number | null;
    decisions_recognized: number | null;
    decisions_other: number | null;
    rejected: number | null;
    otherwise_closed: number | null;
    total_decided: number | null;
}

/**
 * UNHCR Refugee Population Statistics API
 * https://api.unhcr.org/population/v1/
 * 
 * Free REST API, no auth required.
 * Coverage: ~200 countries, data from 1951.
 * Frequency: Annual (mid-year estimates), quarterly (asylum)
 */
export class UNHCRCollector extends BaseCollector {
    readonly sourceName = 'unhcr';
    readonly description = 'UNHCR Refugee & Asylum Statistics (population, asylum applications/decisions)';

    private readonly BASE = 'https://api.unhcr.org/population/v1';

    // Our priority countries
    private readonly COUNTRIES = ['USA', 'CAN', 'GBR', 'AUS', 'DEU', 'FRA', 'NLD', 'SWE', 'ESP', 'ITA', 'AUT', 'SGP', 'ARE', 'NZL', 'JPN', 'PRT'];

    // ISO3 → ISO2 mapping for our DB
    private readonly ISO3_TO_ISO2: Record<string, string> = {
        'USA': 'US', 'CAN': 'CA', 'GBR': 'GB', 'AUS': 'AU', 'DEU': 'DE',
        'FRA': 'FR', 'NLD': 'NL', 'SWE': 'SE', 'ESP': 'ES', 'ITA': 'IT',
        'AUT': 'AT', 'SGP': 'SG', 'ARE': 'AE', 'NZL': 'NZ', 'JPN': 'JP',
        'PRT': 'PT',
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        // 1. Fetch population data (refugees, asylum seekers, stateless)
        try {
            const popResult = await this.collectPopulation();
            added += popResult.added;
            updated += popResult.updated;
            skipped += popResult.skipped;
        } catch (err: any) {
            console.error(`  ⚠️ Population fetch failed: ${err.message}`);
        }

        // 2. Fetch asylum applications & decisions
        try {
            const asylumResult = await this.collectAsylum();
            added += asylumResult.added;
            updated += asylumResult.updated;
            skipped += asylumResult.skipped;
        } catch (err: any) {
            console.error(`  ⚠️ Asylum fetch failed: ${err.message}`);
        }

        return {
            source: this.sourceName,
            status: added + updated > 0 ? 'success' : 'error',
            recordsAdded: added,
            recordsUpdated: updated,
            recordsSkipped: skipped,
            durationMs: 0,
        };
    }

    private async collectPopulation(): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 1, currentYear - 2]; // latest 2 years

        for (const iso3 of this.COUNTRIES) {
            const iso2 = this.ISO3_TO_ISO2[iso3];
            if (!iso2) continue;

            // Check country exists
            const country = await this.prisma.country.findUnique({ where: { code: iso2 } });
            if (!country) {
                console.log(`  ⏭️ Country ${iso2} not in DB, skipping`);
                skipped++;
                continue;
            }

            try {
                const url = `${this.BASE}/population/?limit=100&year=${years.join(',')}&country_of_asylum=${iso3}&coo_all=true&page=1`;
                const response = await this.fetchJson<{ items: UNHCRPopulationRecord[] }>(url);

                if (!response.items || response.items.length === 0) {
                    skipped++;
                    continue;
                }

                // Aggregate by year
                for (const year of years) {
                    const yearData = response.items.filter(r => r.year === year);
                    if (yearData.length === 0) continue;

                    const totalRefugees = yearData.reduce((s, r) => s + Number(r.refugees || 0), 0);
                    const totalAsylumSeekers = yearData.reduce((s, r) => s + Number(r.asylum_seekers || 0), 0);
                    const totalStateless = yearData.reduce((s, r) => s + Number(r.stateless || 0), 0);

                    // Refugees
                    if (totalRefugees > 0) {
                        const res = await this.upsertStatistic(iso2, 'asylum', `Refugees hosted`, totalRefugees, 'people', String(year),
                            `https://www.unhcr.org/refugee-statistics/`);
                        res === 'added' ? added++ : updated++;
                    }

                    // Asylum seekers
                    if (totalAsylumSeekers > 0) {
                        const res = await this.upsertStatistic(iso2, 'asylum', `Pending asylum seekers`, totalAsylumSeekers, 'people', String(year),
                            `https://www.unhcr.org/refugee-statistics/`);
                        res === 'added' ? added++ : updated++;
                    }

                    // Stateless
                    if (totalStateless > 0) {
                        const res = await this.upsertStatistic(iso2, 'diaspora', `Stateless persons`, totalStateless, 'people', String(year),
                            `https://www.unhcr.org/refugee-statistics/`);
                        res === 'added' ? added++ : updated++;
                    }
                }

                console.log(`  📊 ${iso2}: processed population data`);
            } catch (err: any) {
                console.error(`  ⚠️ ${iso2} population: ${err.message}`);
                skipped++;
            }
        }

        return { added, updated, skipped };
    }

    private async collectAsylum(): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;
        const currentYear = new Date().getFullYear();
        const years = [currentYear - 1, currentYear - 2];

        for (const iso3 of this.COUNTRIES) {
            const iso2 = this.ISO3_TO_ISO2[iso3];
            if (!iso2) continue;

            const country = await this.prisma.country.findUnique({ where: { code: iso2 } });
            if (!country) { skipped++; continue; }

            try {
                const url = `${this.BASE}/asylum-applications/?limit=100&year=${years.join(',')}&country_of_asylum=${iso3}&coo_all=true&page=1`;
                const response = await this.fetchJson<{ items: UNHCRAsylumRecord[] }>(url);

                if (!response.items || response.items.length === 0) {
                    skipped++;
                    continue;
                }

                for (const year of years) {
                    const yearData = response.items.filter(r => r.year === year);
                    if (yearData.length === 0) continue;

                    const totalApplied = yearData.reduce((s, r) => s + Number(r.applied || 0), 0);
                    const totalRecognized = yearData.reduce((s, r) => s + Number(r.decisions_recognized || 0), 0);
                    const totalRejected = yearData.reduce((s, r) => s + Number(r.rejected || 0), 0);
                    const totalDecided = yearData.reduce((s, r) => s + Number(r.total_decided || 0), 0);

                    if (totalApplied > 0) {
                        const res = await this.upsertStatistic(iso2, 'asylum', `UNHCR asylum applications`, totalApplied, 'people', String(year),
                            `https://www.unhcr.org/refugee-statistics/`);
                        res === 'added' ? added++ : updated++;
                    }

                    if (totalDecided > 0) {
                        const res = await this.upsertStatistic(iso2, 'approval_rate', `UNHCR asylum recognition rate`,
                            totalDecided > 0 ? Math.round((totalRecognized / totalDecided) * 10000) / 100 : 0,
                            'percent', String(year), `https://www.unhcr.org/refugee-statistics/`);
                        res === 'added' ? added++ : updated++;
                    }
                }

                console.log(`  📋 ${iso2}: processed asylum data`);
            } catch (err: any) {
                console.error(`  ⚠️ ${iso2} asylum: ${err.message}`);
                skipped++;
            }
        }

        return { added, updated, skipped };
    }

    /** Upsert a statistic record, returns 'added' or 'updated' */
    private async upsertStatistic(
        countryCode: string, category: string, metric: string,
        value: number, unit: string, period: string, sourceUrl: string
    ): Promise<'added' | 'updated'> {
        const existing = await this.prisma.statistic.findFirst({
            where: { countryCode, category, metric, period },
        });

        if (existing) {
            await this.prisma.statistic.update({
                where: { id: existing.id },
                data: { value, unit, sourceUrl, comparison: existing.value },
            });
            return 'updated';
        } else {
            await this.prisma.statistic.create({
                data: { countryCode, category, metric, value, unit, period, sourceUrl },
            });
            return 'added';
        }
    }
}
