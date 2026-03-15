import { BaseCollector, CollectorResult } from './base.js';

/**
 * OECD Statistics — migration, labor market, tax data via SDMX REST API.
 * Docs: https://data-explorer.oecd.org/
 * 
 * Key datasets:
 * - MIG: International migration database
 * - LFS_SEXAGE: Labor force statistics
 * - TABLE_I: Tax rates on labour income
 */
export class OECDCollector extends BaseCollector {
    readonly sourceName = 'oecd';
    readonly description = 'OECD migration and labor statistics (SDMX API)';

    private readonly BASE_URL = 'https://sdmx.oecd.org/public/rest/data';
    private readonly COUNTRY_MAP: Record<string, string> = {
        US: 'USA', CA: 'CAN', GB: 'GBR', AU: 'AUS', DE: 'DEU'
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        // 1. Migration inflows
        for (const [ourCode, oecdCode] of Object.entries(this.COUNTRY_MAP)) {
            try {
                const result = await this.fetchMigrationData(ourCode, oecdCode);
                added += result.added;
                updated += result.updated;
                skipped += result.skipped;
            } catch (err: any) {
                console.error(`  ⚠️ [OECD] Migration ${ourCode}: ${err.message}`);
                skipped++;
            }

            // 2. Tax wedge data
            try {
                const result = await this.fetchTaxData(ourCode, oecdCode);
                added += result.added;
                updated += result.updated;
                skipped += result.skipped;
            } catch (err: any) {
                console.error(`  ⚠️ [OECD] Tax ${ourCode}: ${err.message}`);
                skipped++;
            }
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

    private async fetchMigrationData(
        countryCode: string, oecdCode: string
    ): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        // OECD SDMX: International Migration Database
        // Format: dataflow/agencyID/dataflowID/version
        const url = `${this.BASE_URL}/OECD.ELS.MIG,DSD_MIG@DF_MIG,/.${oecdCode}..._T._T.?startPeriod=2020&dimensionAtObservation=AllDimensions&format=jsondata`;

        try {
            const data = await this.fetchJson(url);

            // SDMX JSON format parsing
            if (data?.dataSets?.[0]?.observations) {
                const observations = data.dataSets[0].observations;
                const timePeriods = data.structure?.dimensions?.observation
                    ?.find((d: any) => d.id === 'TIME_PERIOD')?.values || [];
                const measures = data.structure?.dimensions?.observation
                    ?.find((d: any) => d.id === 'MEASURE')?.values || [];

                for (const [key, values] of Object.entries(observations) as [string, any][]) {
                    const dims = key.split(':');
                    const timePeriod = timePeriods[parseInt(dims[dims.length - 1])]?.id;
                    const measureIdx = parseInt(dims[0]);
                    const measure = measures[measureIdx]?.id;

                    if (!timePeriod || !values?.[0]) continue;

                    const value = values[0] as number;
                    const metric = measure === 'INFLOW' ? 'Immigration inflows (OECD)' :
                        measure === 'OUTFLOW' ? 'Emigration outflows (OECD)' :
                            measure === 'STOCK' ? 'Foreign-born stock (OECD)' :
                                `${measure} (OECD)`;

                    const existing = await this.prisma.statistic.findFirst({
                        where: { countryCode, category: 'migration_flow', metric, period: timePeriod }
                    });

                    if (existing) {
                        if (existing.value !== value) {
                            await this.prisma.statistic.update({
                                where: { id: existing.id },
                                data: { value, comparison: existing.value, sourceUrl: 'https://data-explorer.oecd.org/' }
                            });
                            updated++;
                        } else { skipped++; }
                    } else {
                        await this.prisma.statistic.create({
                            data: {
                                countryCode,
                                category: 'migration_flow',
                                metric,
                                value,
                                unit: 'people',
                                period: timePeriod,
                                sourceUrl: 'https://data-explorer.oecd.org/',
                            }
                        });
                        added++;
                    }
                }
            }
        } catch (err: any) {
            // OECD API can be flaky, log but don't fail
            console.log(`  ℹ️ OECD migration data for ${oecdCode}: ${err.message}`);
            skipped++;
        }

        return { added, updated, skipped };
    }

    private async fetchTaxData(
        countryCode: string, oecdCode: string
    ): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        // Tax wedge on labour income
        const url = `${this.BASE_URL}/OECD.CTP.TPS,DSD_TAX_WEDGE@DF_TAXWEDGE,/.${oecdCode}.SINGLE_NO_CH.AW100..?startPeriod=2022&format=jsondata`;

        try {
            const data = await this.fetchJson(url);

            if (data?.dataSets?.[0]?.observations) {
                const observations = data.dataSets[0].observations;
                const timePeriods = data.structure?.dimensions?.observation
                    ?.find((d: any) => d.id === 'TIME_PERIOD')?.values || [];

                for (const [key, values] of Object.entries(observations) as [string, any][]) {
                    const dims = key.split(':');
                    const timePeriod = timePeriods[parseInt(dims[dims.length - 1])]?.id;
                    if (!timePeriod || !values?.[0]) continue;

                    const value = values[0] as number;
                    const metric = 'Tax wedge on labour income (OECD)';

                    const existing = await this.prisma.statistic.findFirst({
                        where: { countryCode, category: 'migration_flow', metric, period: timePeriod }
                    });

                    if (!existing) {
                        await this.prisma.statistic.create({
                            data: {
                                countryCode,
                                category: 'labor',
                                metric,
                                value,
                                unit: 'percent',
                                period: timePeriod,
                                sourceUrl: 'https://data-explorer.oecd.org/',
                            }
                        });
                        added++;
                    } else { skipped++; }
                }
            }
        } catch (err: any) {
            console.log(`  ℹ️ OECD tax data for ${oecdCode}: ${err.message}`);
            skipped++;
        }

        return { added, updated, skipped };
    }
}
