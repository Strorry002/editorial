import { BaseCollector, CollectorResult } from './base.js';

/**
 * World Bank Open Data API — Economic & Development Indicators
 * https://data.worldbank.org/
 * 
 * Free REST API, no auth required.
 * Covers 200+ countries, 1600+ indicators.
 * Replaces Teleport (quality of life) and supplements economic data.
 */
export class WorldBankCollector extends BaseCollector {
    readonly sourceName = 'world_bank';
    readonly description = 'World Bank — GDP, GNI, population, unemployment, health expenditure';

    private readonly BASE = 'https://api.worldbank.org/v2';

    // ISO2 codes in our DB — World Bank uses ISO2
    private readonly COUNTRIES = [
        'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'ES', 'IT',
        'AT', 'SG', 'AE', 'NZ', 'JP', 'PT', 'TH', 'MY', 'MX', 'BR', 'AR',
    ];

    // Key economic indicators for immigration analytics
    private readonly INDICATORS: {
        code: string;
        metric: string;
        unit: string;
        category: string;
        divider?: number; // divide raw value for readability
    }[] = [
            { code: 'NY.GDP.PCAP.CD', metric: 'GDP per capita (USD)', unit: 'USD', category: 'economy' },
            { code: 'NY.GNP.PCAP.CD', metric: 'GNI per capita (USD)', unit: 'USD', category: 'economy' },
            { code: 'SL.UEM.TOTL.ZS', metric: 'Unemployment rate', unit: 'percent', category: 'labor' },
            { code: 'SP.POP.TOTL', metric: 'Total population', unit: 'people', category: 'population', divider: 1000000 },
            { code: 'SM.POP.NETM', metric: 'Net migration (5-year)', unit: 'people', category: 'migration_flow' },
            { code: 'SH.XPD.CHEX.PC.CD', metric: 'Health expenditure per capita (USD)', unit: 'USD', category: 'health' },
            { code: 'SH.XPD.CHEX.GD.ZS', metric: 'Health expenditure (% of GDP)', unit: 'percent', category: 'health' },
            { code: 'SE.XPD.TOTL.GD.ZS', metric: 'Education expenditure (% of GDP)', unit: 'percent', category: 'education' },
            { code: 'FP.CPI.TOTL.ZG', metric: 'Inflation rate (CPI)', unit: 'percent', category: 'economy' },
            { code: 'SI.POV.GINI', metric: 'GINI index (income inequality)', unit: 'index', category: 'economy' },
        ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        const countryCodes = this.COUNTRIES.join(';');

        for (const indicator of this.INDICATORS) {
            try {
                console.log(`  🏦 Fetching: ${indicator.metric}`);
                await this.sleep(500); // be nice to World Bank

                // Fetch latest 3 years for all countries at once
                const url = `${this.BASE}/country/${countryCodes}/indicator/${indicator.code}?format=json&per_page=100&mrv=3`;
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'ImmigrantsDataBot/1.0' },
                });

                if (!response.ok) {
                    console.log(`    ⚠️ ${indicator.code}: HTTP ${response.status}`);
                    skipped++;
                    continue;
                }

                const data = await response.json() as any[];
                // World Bank returns [pagination, data[]]
                if (!data || data.length < 2 || !data[1]) {
                    skipped++;
                    continue;
                }

                const records = data[1] as any[];
                let indicatorAdded = 0;

                for (const record of records) {
                    if (record.value === null || record.value === undefined) continue;

                    const countryCode = record.countryiso2code || record.country?.id;
                    if (!countryCode || !this.COUNTRIES.includes(countryCode)) continue;

                    // Check country in DB
                    const country = await this.prisma.country.findUnique({ where: { code: countryCode } });
                    if (!country) continue;

                    let value = Number(record.value);
                    if (isNaN(value)) continue;

                    // Apply divider for readability (e.g., population in millions)
                    if (indicator.divider) {
                        value = Math.round(value / indicator.divider * 100) / 100;
                    } else {
                        value = Math.round(value * 100) / 100;
                    }

                    const period = String(record.date);

                    const existing = await this.prisma.statistic.findFirst({
                        where: { countryCode, category: indicator.category, metric: indicator.metric, period },
                    });

                    if (existing) {
                        if (existing.value !== value) {
                            await this.prisma.statistic.update({
                                where: { id: existing.id },
                                data: { value, comparison: existing.value, sourceUrl: 'https://data.worldbank.org/' },
                            });
                            updated++;
                        } else {
                            skipped++;
                        }
                    } else {
                        await this.prisma.statistic.create({
                            data: {
                                countryCode, category: indicator.category, metric: indicator.metric,
                                value, unit: indicator.unit, period,
                                sourceUrl: 'https://data.worldbank.org/',
                            },
                        });
                        added++;
                        indicatorAdded++;
                    }
                }

                console.log(`    ✅ ${indicator.code}: +${indicatorAdded} records`);
            } catch (err: any) {
                console.error(`    ⚠️ ${indicator.code}: ${err.message}`);
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
}
