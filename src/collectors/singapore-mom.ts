import { BaseCollector, CollectorResult } from './base.js';

interface DataGovSGResult {
    success: boolean;
    result: {
        resource_id: string;
        fields: { type: string; id: string }[];
        records: Record<string, any>[];
        total: number;
    };
}

/**
 * Singapore data.gov.sg — Ministry of Manpower (MOM) datasets
 * 
 * Free API, no auth required.
 * Foreign Workforce Numbers by pass type (Employment Pass, S Pass, Work Permit).
 */
export class SingaporeMOMCollector extends BaseCollector {
    readonly sourceName = 'singapore_mom';
    readonly description = 'Singapore MOM — Foreign Workforce by Pass Type (EP, S Pass, WP)';

    // data.gov.sg resource IDs for MOM datasets
    private readonly DATASETS: { resourceId: string; description: string }[] = [
        {
            resourceId: 'd_26aa1ccbfe40dbd3e20e3b48d12ceab3',
            description: 'Foreign Workforce Numbers (Annual)',
        },
    ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        // Check SG exists in DB
        const country = await this.prisma.country.findUnique({ where: { code: 'SG' } });
        if (!country) {
            console.log('  ⏭️ Country SG not in DB, skipping');
            return {
                source: this.sourceName,
                status: 'error',
                recordsAdded: 0, recordsUpdated: 0, recordsSkipped: 1,
                errorMessage: 'Country SG not in database',
                durationMs: 0,
            };
        }

        for (const dataset of this.DATASETS) {
            try {
                console.log(`  🇸🇬 Fetching: ${dataset.description}`);

                const url = `https://data.gov.sg/api/action/datastore_search?resource_id=${dataset.resourceId}&limit=100&sort=year desc`;
                const response = await this.fetchJson<DataGovSGResult>(url);

                if (!response.success || !response.result?.records) {
                    console.error(`  ❌ API returned success=false`);
                    skipped++;
                    continue;
                }

                const records = response.result.records;
                console.log(`    📦 Got ${records.length} records`);

                for (const record of records) {
                    // Dataset fields vary, but typically: year, pass_type, workforce_number
                    const year = record.year || record.Year;
                    if (!year) continue;

                    // Try different field name patterns
                    const passType = record.pass_type || record.level_1 || record.work_pass_type || '';
                    const value = parseFloat(record.no_of_pass_holders || record.foreign_workforce || record.stock || record.value || '0');

                    if (!value || value === 0) continue;

                    const metric = passType
                        ? `Foreign workforce - ${passType}`
                        : `Total foreign workforce`;

                    const existing = await this.prisma.statistic.findFirst({
                        where: {
                            countryCode: 'SG',
                            category: 'migration_flow',
                            metric,
                            period: String(year),
                        },
                    });

                    if (existing) {
                        await this.prisma.statistic.update({
                            where: { id: existing.id },
                            data: {
                                value,
                                unit: 'people',
                                comparison: existing.value,
                                sourceUrl: 'https://data.gov.sg/',
                            },
                        });
                        updated++;
                    } else {
                        await this.prisma.statistic.create({
                            data: {
                                countryCode: 'SG',
                                category: 'migration_flow',
                                metric,
                                value,
                                unit: 'people',
                                period: String(year),
                                sourceUrl: 'https://data.gov.sg/',
                            },
                        });
                        added++;
                    }
                }
            } catch (err: any) {
                console.error(`  ⚠️ ${dataset.description}: ${err.message}`);
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
