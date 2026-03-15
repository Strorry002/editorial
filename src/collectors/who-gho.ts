import { BaseCollector, CollectorResult } from './base.js';

interface GHOValue {
    Id: number;
    IndicatorCode: string;
    SpatialDimType: string;
    SpatialDim: string;   // ISO3 country code
    TimeDimType: string;
    TimeDim: string;       // year
    Dim1Type?: string;
    Dim1?: string;
    Dim2Type?: string;
    Dim2?: string;
    Dim3Type?: string;
    Dim3?: string;
    DataSourceDimType?: string;
    DataSourceDim?: string;
    Value: string;
    NumericValue: number | null;
    Low?: string;
    High?: string;
    Comments?: string;
}

interface GHOResponse {
    value: GHOValue[];
}

/**
 * WHO Global Health Observatory (GHO) OData API
 * https://ghoapi.azureedge.net/api/
 * 
 * Free OData API, no auth required.
 * 1000+ health indicators for 194 member states.
 */
export class WHOGHOCollector extends BaseCollector {
    readonly sourceName = 'who_gho';
    readonly description = 'WHO Global Health Observatory — life expectancy, health spending, UHC index';

    private readonly BASE = 'https://ghoapi.azureedge.net/api';

    // Indicators relevant for immigration analytics
    private readonly INDICATORS: { code: string; metric: string; unit: string; category: string }[] = [
        { code: 'WHOSIS_000001', metric: 'Life expectancy at birth (both sexes)', unit: 'years', category: 'health' },
        { code: 'WHOSIS_000015', metric: 'Life expectancy at birth (male)', unit: 'years', category: 'health' },
        { code: 'WHOSIS_000016', metric: 'Life expectancy at birth (female)', unit: 'years', category: 'health' },
        { code: 'UHC_INDEX_REPORTED', metric: 'UHC service coverage index', unit: 'index', category: 'health' },
        { code: 'GHED_CHE_pc_USD_SHA2011', metric: 'Current health expenditure per capita (USD)', unit: 'USD', category: 'health' },
        { code: 'GHED_GGHE-D_pc_USD_SHA2011', metric: 'Government health expenditure per capita (USD)', unit: 'USD', category: 'health' },
        { code: 'GHED_CHE_pc_PPP_SHA2011', metric: 'Health expenditure per capita (PPP)', unit: 'int$', category: 'health' },
        { code: 'MDG_0000000026', metric: 'Physicians density (per 10,000 population)', unit: 'per 10k', category: 'health' },
        { code: 'HWF_0006', metric: 'Nursing and midwifery density (per 10,000)', unit: 'per 10k', category: 'health' },
    ];

    // ISO3 → ISO2 mapping
    private readonly ISO3_TO_ISO2: Record<string, string> = {
        'USA': 'US', 'CAN': 'CA', 'GBR': 'GB', 'AUS': 'AU', 'DEU': 'DE',
        'FRA': 'FR', 'NLD': 'NL', 'SWE': 'SE', 'ESP': 'ES', 'ITA': 'IT',
        'AUT': 'AT', 'SGP': 'SG', 'ARE': 'AE', 'NZL': 'NZ', 'JPN': 'JP',
        'PRT': 'PT', 'MYS': 'MY', 'THA': 'TH', 'BRA': 'BR', 'MEX': 'MX',
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const indicator of this.INDICATORS) {
            console.log(`  🏥 Fetching indicator: ${indicator.metric}`);

            for (const [iso3, iso2] of Object.entries(this.ISO3_TO_ISO2)) {
                try {
                    const country = await this.prisma.country.findUnique({ where: { code: iso2 } });
                    if (!country) continue;

                    // Fetch per-country to avoid OData 400 from long OR chains
                    const url = `${this.BASE}/${indicator.code}?$filter=SpatialDim eq '${iso3}'&$top=2&$orderby=TimeDim desc`;
                    await this.sleep(500); // avoid throttling
                    const response = await this.fetchJson<GHOResponse>(url);

                    if (!response.value || response.value.length === 0) continue;

                    // Take latest 2 years with numeric values
                    const valid = response.value.filter(v => v.NumericValue !== null && v.NumericValue !== undefined);
                    const sorted = valid.sort((a, b) => Number(b.TimeDim) - Number(a.TimeDim)).slice(0, 2);

                    for (const record of sorted) {
                        if (record.NumericValue === null) continue;

                        const value = Math.round(record.NumericValue * 100) / 100;
                        const period = record.TimeDim;
                        const comparison = sorted.length > 1 && sorted[0] !== record
                            ? sorted[0].NumericValue
                            : undefined;

                        const existing = await this.prisma.statistic.findFirst({
                            where: {
                                countryCode: iso2,
                                category: indicator.category,
                                metric: indicator.metric,
                                period,
                            },
                        });

                        if (existing) {
                            await this.prisma.statistic.update({
                                where: { id: existing.id },
                                data: {
                                    value,
                                    unit: indicator.unit,
                                    comparison: comparison !== undefined && comparison !== null ? Math.round(comparison * 100) / 100 : existing.comparison,
                                    sourceUrl: 'https://www.who.int/data/gho',
                                },
                            });
                            updated++;
                        } else {
                            await this.prisma.statistic.create({
                                data: {
                                    countryCode: iso2,
                                    category: indicator.category,
                                    metric: indicator.metric,
                                    value,
                                    unit: indicator.unit,
                                    period,
                                    comparison: comparison !== undefined && comparison !== null ? Math.round(comparison * 100) / 100 : null,
                                    sourceUrl: 'https://www.who.int/data/gho',
                                },
                            });
                            added++;
                        }
                    }
                } catch (err: any) {
                    // Individual country errors don't stop the whole indicator
                    skipped++;
                }
            }
            console.log(`    ✅ ${indicator.code}: processed`);
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
