import { BaseCollector, CollectorResult } from './base.js';

interface UNIndicator {
    id: number;
    shortName: string;
}

interface UNDataResponse {
    total: number;
    data: Array<{
        locationId: number;
        locationName: string;
        iso2: string;
        indicatorId: number;
        indicatorName: string;
        sex: string;
        timeLabel: string;
        value: number;
    }>;
}

/**
 * UN DESA Population Division — migration stock data.
 * API: https://population.un.org/dataportalapi/api/v1
 * 
 * Key indicators:
 * - International migrant stock (total, by origin, by destination)
 * - Net migration rate
 * - Refugee population
 */
export class UNDESACollector extends BaseCollector {
    readonly sourceName = 'un_desa';
    readonly description = 'UN population and migration stock data';

    private readonly BASE_URL = 'https://population.un.org/dataportalapi/api/v1';
    private readonly COUNTRY_IDS: Record<string, number> = {
        US: 840, CA: 124, GB: 826, AU: 36, DE: 276
    };

    // Key migration indicators
    private readonly INDICATORS = [
        { id: 45, name: 'net_migration_rate', unit: 'per_1000', metric: 'Net migration rate' },
        { id: 46, name: 'net_migration', unit: 'thousands', metric: 'Net number of migrants' },
    ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const [countryCode, locationId] of Object.entries(this.COUNTRY_IDS)) {
            for (const indicator of this.INDICATORS) {
                try {
                    const url = `${this.BASE_URL}/data/indicators/${indicator.id}/locations/${locationId}?startYear=2020&endYear=2025&pageSize=10&sort=timeLabel&order=desc`;
                    const response = await this.fetchJson<UNDataResponse>(url);

                    if (!response.data || response.data.length === 0) {
                        skipped++;
                        continue;
                    }

                    for (const row of response.data) {
                        // Only take "Both sexes" aggregates
                        if (row.sex && row.sex !== 'Both sexes') continue;

                        const period = row.timeLabel; // e.g. "2020-2025"
                        const value = indicator.unit === 'thousands' ? row.value * 1000 : row.value;

                        // Upsert statistic
                        const existing = await this.prisma.statistic.findFirst({
                            where: {
                                countryCode,
                                category: 'migration_flow',
                                metric: indicator.metric,
                                period,
                            }
                        });

                        if (existing) {
                            if (existing.value !== value) {
                                await this.prisma.statistic.update({
                                    where: { id: existing.id },
                                    data: { value, sourceUrl: `${this.BASE_URL}/data/indicators/${indicator.id}`, comparison: existing.value },
                                });
                                updated++;
                            } else {
                                skipped++;
                            }
                        } else {
                            await this.prisma.statistic.create({
                                data: {
                                    countryCode,
                                    category: 'migration_flow',
                                    metric: indicator.metric,
                                    value,
                                    unit: indicator.unit === 'thousands' ? 'people' : indicator.unit,
                                    period,
                                    sourceUrl: `${this.BASE_URL}/data/indicators/${indicator.id}`,
                                }
                            });
                            added++;
                        }
                    }
                } catch (err: any) {
                    console.error(`  ⚠️ [UN DESA] ${countryCode}/${indicator.name}: ${err.message}`);
                    skipped++;
                }
            }
        }

        return {
            source: this.sourceName,
            status: added + updated > 0 ? 'success' : skipped > 0 ? 'partial' : 'error',
            recordsAdded: added,
            recordsUpdated: updated,
            recordsSkipped: skipped,
            durationMs: 0,
        };
    }
}
