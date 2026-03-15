import { BaseCollector, CollectorResult } from './base.js';

interface TeleportScore {
    color: string;
    name: string;
    score_out_of_10: number;
}

interface TeleportScoresResponse {
    _links: { self: { href: string } };
    categories: TeleportScore[];
    summary: string;
    teleport_city_score: number;
}

interface TeleportSalary {
    job: { id: string; title: string };
    salary_percentiles: {
        percentile_25: number;
        percentile_50: number;
        percentile_75: number;
    };
}

interface TeleportDetailItem {
    id: string;
    label: string;
    type: string;
    currency_dollar_value?: number;
    float_value?: number;
    int_value?: number;
    percent_value?: number;
    string_value?: string;
}

interface TeleportDetailGroup {
    id: string;
    label: string;
    type: string;
    data: TeleportDetailItem[];
}

/**
 * Teleport.org API — Quality of Life for cities worldwide
 * https://api.teleport.org/api/
 * 
 * Free API, no auth required.
 * 266 urban areas with scores, cost of living details, salaries.
 */
export class TeleportCollector extends BaseCollector {
    readonly sourceName = 'teleport';
    readonly description = 'Teleport.org Quality of Life — cost of living, safety, healthcare, education scores';

    private readonly BASE = 'https://api.teleport.org/api';

    // Map cities to our country codes
    private readonly CITIES: { slug: string; city: string; countryCode: string }[] = [
        // Tier 1
        { slug: 'new-york', city: 'New York', countryCode: 'US' },
        { slug: 'san-francisco-bay-area', city: 'San Francisco', countryCode: 'US' },
        { slug: 'los-angeles', city: 'Los Angeles', countryCode: 'US' },
        { slug: 'toronto', city: 'Toronto', countryCode: 'CA' },
        { slug: 'vancouver', city: 'Vancouver', countryCode: 'CA' },
        { slug: 'london', city: 'London', countryCode: 'GB' },
        { slug: 'sydney', city: 'Sydney', countryCode: 'AU' },
        { slug: 'melbourne', city: 'Melbourne', countryCode: 'AU' },
        { slug: 'berlin', city: 'Berlin', countryCode: 'DE' },
        { slug: 'munich', city: 'Munich', countryCode: 'DE' },
        // Tier 2
        { slug: 'paris', city: 'Paris', countryCode: 'FR' },
        { slug: 'amsterdam', city: 'Amsterdam', countryCode: 'NL' },
        { slug: 'stockholm', city: 'Stockholm', countryCode: 'SE' },
        { slug: 'barcelona', city: 'Barcelona', countryCode: 'ES' },
        { slug: 'madrid', city: 'Madrid', countryCode: 'ES' },
        { slug: 'milan', city: 'Milan', countryCode: 'IT' },
        { slug: 'vienna', city: 'Vienna', countryCode: 'AT' },
        // Tier 3
        { slug: 'singapore', city: 'Singapore', countryCode: 'SG' },
        { slug: 'dubai', city: 'Dubai', countryCode: 'AE' },
        { slug: 'auckland', city: 'Auckland', countryCode: 'NZ' },
        { slug: 'tokyo', city: 'Tokyo', countryCode: 'JP' },
        { slug: 'lisbon', city: 'Lisbon', countryCode: 'PT' },
        // Digital nomad hubs
        { slug: 'bangkok', city: 'Bangkok', countryCode: 'TH' },
        { slug: 'kuala-lumpur', city: 'Kuala Lumpur', countryCode: 'MY' },
        { slug: 'mexico-city', city: 'Mexico City', countryCode: 'MX' },
        { slug: 'buenos-aires', city: 'Buenos Aires', countryCode: 'AR' },
    ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;
        const period = `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

        for (const cityInfo of this.CITIES) {
            try {
                // Check country exists
                const country = await this.prisma.country.findUnique({ where: { code: cityInfo.countryCode } });
                if (!country) {
                    console.log(`  ⏭️ Country ${cityInfo.countryCode} not in DB`);
                    skipped++;
                    continue;
                }

                // Fetch city scores
                const scores = await this.fetchJson<TeleportScoresResponse>(
                    `${this.BASE}/urban_areas/slug:${cityInfo.slug}/scores/`
                );

                if (!scores.categories || scores.categories.length === 0) {
                    skipped++;
                    continue;
                }

                // Map Teleport categories → CostOfLiving fields
                const scoreMap = new Map<string, number>();
                for (const cat of scores.categories) {
                    scoreMap.set(cat.name, Math.round(cat.score_out_of_10 * 100) / 100);
                }

                // Build metadata with all scores
                const metadata: Record<string, number> = {};
                for (const [name, score] of scoreMap) {
                    metadata[name.toLowerCase().replace(/\s+/g, '_')] = score;
                }
                metadata['teleport_overall_score'] = Math.round(scores.teleport_city_score * 100) / 100;

                // Upsert into CostOfLiving
                const existing = await this.prisma.costOfLiving.findUnique({
                    where: {
                        countryCode_city_period: {
                            countryCode: cityInfo.countryCode,
                            city: cityInfo.city,
                            period,
                        },
                    },
                });

                const costData = {
                    healthcareIndex: scoreMap.get('Healthcare') || null,
                    overallIndex: scores.teleport_city_score || null,
                    currency: 'USD',
                    sourceUrl: `https://teleport.org/cities/${cityInfo.slug}/`,
                    metadata,
                };

                if (existing) {
                    await this.prisma.costOfLiving.update({
                        where: { id: existing.id },
                        data: costData,
                    });
                    updated++;
                } else {
                    await this.prisma.costOfLiving.create({
                        data: {
                            countryCode: cityInfo.countryCode,
                            city: cityInfo.city,
                            period,
                            ...costData,
                        },
                    });
                    added++;
                }

                // Also store key scores as Statistic rows for easy querying
                const keyMetrics = [
                    { name: 'Cost of Living', cat: 'population', metric: 'Teleport Cost of Living score' },
                    { name: 'Safety', cat: 'population', metric: 'Teleport Safety score' },
                    { name: 'Healthcare', cat: 'health', metric: 'Teleport Healthcare score' },
                    { name: 'Education', cat: 'population', metric: 'Teleport Education score' },
                    { name: 'Economy', cat: 'population', metric: 'Teleport Economy score' },
                    { name: 'Taxation', cat: 'population', metric: 'Teleport Taxation score' },
                    { name: 'Internet Access', cat: 'population', metric: 'Teleport Internet Access score' },
                    { name: 'Tolerance', cat: 'population', metric: 'Teleport Tolerance score' },
                ];

                for (const km of keyMetrics) {
                    const score = scoreMap.get(km.name);
                    if (score === undefined) continue;

                    const statKey = `${km.metric} (${cityInfo.city})`;
                    const existingStat = await this.prisma.statistic.findFirst({
                        where: { countryCode: cityInfo.countryCode, metric: statKey, period },
                    });

                    if (existingStat) {
                        await this.prisma.statistic.update({
                            where: { id: existingStat.id },
                            data: { value: score, sourceUrl: `https://teleport.org/cities/${cityInfo.slug}/` },
                        });
                    } else {
                        await this.prisma.statistic.create({
                            data: {
                                countryCode: cityInfo.countryCode,
                                category: km.cat,
                                metric: statKey,
                                value: score,
                                unit: 'score/10',
                                period,
                                sourceUrl: `https://teleport.org/cities/${cityInfo.slug}/`,
                            },
                        });
                    }
                }

                console.log(`  🏙️ ${cityInfo.city}: overall=${scores.teleport_city_score?.toFixed(1)}`);
            } catch (err: any) {
                console.error(`  ⚠️ ${cityInfo.city}: ${err.message}`);
                skipped++;
            }
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
}
