import { BaseCollector, CollectorResult } from './base.js';

/**
 * OECD Tax Database — Comprehensive tax statistics via SDMX API
 * Corporate tax rates, income tax, social security contributions
 * 
 * Docs: https://data-explorer.oecd.org/
 * Rate limit: 60 requests/hour
 */
export class OECDTaxCollector extends BaseCollector {
    readonly sourceName = 'oecd_tax';
    readonly description = 'OECD Tax Database — corporate rates, income tax, social security';

    private readonly BASE_URL = 'https://sdmx.oecd.org/public/rest/data';

    // Extended country map for tax data
    private readonly COUNTRY_MAP: Record<string, string> = {
        US: 'USA', CA: 'CAN', GB: 'GBR', AU: 'AUS', DE: 'DEU',
        FR: 'FRA', NL: 'NLD', SE: 'SWE', ES: 'ESP', IT: 'ITA',
        AT: 'AUT', NZ: 'NZL', JP: 'JPN', PT: 'PRT',
    };

    // Tax datasets to fetch
    private readonly DATASETS: {
        id: string;
        agency: string;
        description: string;
        buildUrl: (oecdCode: string) => string;
        parseMetric: (measure: string) => { metric: string; unit: string; category: string };
    }[] = [
            {
                id: 'corporate_tax',
                agency: 'OECD.CTP.TPS',
                description: 'Corporate income tax rates',
                buildUrl: (oecdCode) =>
                    `${this.BASE_URL}/OECD.CTP.TPS,DSD_CTS@DF_CTS_CIT,/.${oecdCode}.COMB_CIT_RATE+CENT_CIT_RATE..?startPeriod=2022&format=jsondata`,
                parseMetric: (measure) => ({
                    metric: measure === 'COMB_CIT_RATE'
                        ? 'Combined corporate tax rate (OECD)'
                        : measure === 'CENT_CIT_RATE'
                            ? 'Central government corporate tax rate (OECD)'
                            : `Corporate tax: ${measure}`,
                    unit: 'percent',
                    category: 'tax',
                }),
            },
            {
                id: 'tax_revenue',
                agency: 'OECD.CTP.TPS',
                description: 'Total tax revenue as % of GDP',
                buildUrl: (oecdCode) =>
                    `${this.BASE_URL}/OECD.CTP.TPS,DSD_REV@DF_REV,/.${oecdCode}.TOTALTAX.TAXGDP?startPeriod=2021&format=jsondata`,
                parseMetric: () => ({
                    metric: 'Total tax revenue (% of GDP)',
                    unit: 'percent',
                    category: 'tax',
                }),
            },
            {
                id: 'social_security',
                agency: 'OECD.CTP.TPS',
                description: 'Social security contributions',
                buildUrl: (oecdCode) =>
                    `${this.BASE_URL}/OECD.CTP.TPS,DSD_REV@DF_REV,/.${oecdCode}.TOT_EMPLOYEE_SSC+TOT_EMPLOYER_SSC.TAXGDP?startPeriod=2021&format=jsondata`,
                parseMetric: (measure) => ({
                    metric: measure === 'TOT_EMPLOYEE_SSC'
                        ? 'Employee social security contributions (% of GDP)'
                        : 'Employer social security contributions (% of GDP)',
                    unit: 'percent',
                    category: 'tax',
                }),
            },
        ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const dataset of this.DATASETS) {
            console.log(`  💰 Fetching: ${dataset.description}`);

            for (const [ourCode, oecdCode] of Object.entries(this.COUNTRY_MAP)) {
                try {
                    const country = await this.prisma.country.findUnique({ where: { code: ourCode } });
                    if (!country) { skipped++; continue; }

                    const url = dataset.buildUrl(oecdCode);
                    await this.sleep(1500); // OECD rate limit: 60 req/hr
                    const data = await this.fetchJson(url);

                    if (!data?.dataSets?.[0]?.observations) {
                        skipped++;
                        continue;
                    }

                    const observations = data.dataSets[0].observations;
                    const timePeriods = data.structure?.dimensions?.observation
                        ?.find((d: any) => d.id === 'TIME_PERIOD')?.values || [];
                    const measures = data.structure?.dimensions?.observation
                        ?.find((d: any) => d.id === 'MEASURE' || d.id === 'TAX')?.values || [];

                    for (const [key, values] of Object.entries(observations) as [string, any][]) {
                        const dims = key.split(':');
                        const timePeriod = timePeriods[parseInt(dims[dims.length - 1])]?.id;
                        if (!timePeriod || !values?.[0]) continue;

                        const value = Math.round((values[0] as number) * 100) / 100;
                        const measureCode = measures.length > 0 ? measures[parseInt(dims[0])]?.id || '' : '';
                        const { metric, unit, category } = dataset.parseMetric(measureCode);

                        const existing = await this.prisma.statistic.findFirst({
                            where: { countryCode: ourCode, category, metric, period: timePeriod },
                        });

                        if (existing) {
                            if (existing.value !== value) {
                                await this.prisma.statistic.update({
                                    where: { id: existing.id },
                                    data: { value, comparison: existing.value, sourceUrl: 'https://data-explorer.oecd.org/' },
                                });
                                updated++;
                            } else { skipped++; }
                        } else {
                            await this.prisma.statistic.create({
                                data: {
                                    countryCode: ourCode, category, metric, value, unit,
                                    period: timePeriod, sourceUrl: 'https://data-explorer.oecd.org/',
                                },
                            });
                            added++;
                        }
                    }

                    console.log(`    📊 ${ourCode}: ${dataset.id} OK`);
                } catch (err: any) {
                    console.log(`    ℹ️ ${ourCode} ${dataset.id}: ${err.message}`);
                    skipped++;
                }
            }
        }

        // Also store LaborRegulation records for income tax data
        try {
            const taxResult = await this.collectIncomeTaxBrackets();
            added += taxResult.added;
            updated += taxResult.updated;
        } catch (err: any) {
            console.error(`  ⚠️ Income tax brackets: ${err.message}`);
        }

        return {
            source: this.sourceName,
            status: added + updated > 0 ? 'success' : 'partial',
            recordsAdded: added,
            recordsUpdated: updated,
            recordsSkipped: skipped,
            durationMs: 0,
        };
    }

    /**
     * Fetch personal income tax rates and store as LaborRegulation
     */
    private async collectIncomeTaxBrackets(): Promise<{ added: number; updated: number }> {
        let added = 0, updated = 0;

        for (const [ourCode, oecdCode] of Object.entries(this.COUNTRY_MAP)) {
            try {
                const country = await this.prisma.country.findUnique({ where: { code: ourCode } });
                if (!country) continue;

                // Top statutory personal income tax rate
                const url = `${this.BASE_URL}/OECD.CTP.TPS,DSD_TABLE_I1@DF_TABLE_I1,/.${oecdCode}..TOP_STAT_RATE?startPeriod=2023&format=jsondata`;
                await this.sleep(1500); // OECD rate limit
                const data = await this.fetchJson(url);

                if (!data?.dataSets?.[0]?.observations) continue;

                const observations = data.dataSets[0].observations;
                const timePeriods = data.structure?.dimensions?.observation
                    ?.find((d: any) => d.id === 'TIME_PERIOD')?.values || [];

                for (const [key, values] of Object.entries(observations) as [string, any][]) {
                    const dims = key.split(':');
                    const timePeriod = timePeriods[parseInt(dims[dims.length - 1])]?.id;
                    if (!timePeriod || !values?.[0]) continue;

                    const topRate = values[0] as number;

                    // Upsert LaborRegulation
                    const existing = await this.prisma.laborRegulation.findFirst({
                        where: {
                            countryCode: ourCode,
                            category: 'income_tax',
                            title: 'Top statutory personal income tax rate',
                        },
                    });

                    const content = {
                        top_rate: Math.round(topRate * 100) / 100,
                        year: timePeriod,
                        source: 'OECD Tax Database',
                    };

                    if (existing) {
                        await this.prisma.laborRegulation.update({
                            where: { id: existing.id },
                            data: {
                                content,
                                sourceUrl: 'https://data-explorer.oecd.org/',
                                lastVerified: new Date(),
                            },
                        });
                        updated++;
                    } else {
                        await this.prisma.laborRegulation.create({
                            data: {
                                countryCode: ourCode,
                                category: 'income_tax',
                                title: 'Top statutory personal income tax rate',
                                content,
                                sourceUrl: 'https://data-explorer.oecd.org/',
                                lastVerified: new Date(),
                            },
                        });
                        added++;
                    }
                }

                console.log(`    🧾 ${ourCode}: income tax rate OK`);
            } catch (err: any) {
                console.log(`    ℹ️ ${ourCode} income tax: ${err.message}`);
            }
        }

        return { added, updated };
    }
}
