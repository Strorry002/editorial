import { BaseCollector, CollectorResult } from './base.js';

interface RestCountry {
    cca2: string;
    name: { common: string; official: string };
    capital?: string[];
    region: string;
    subregion?: string;
    languages?: Record<string, string>;
    currencies?: Record<string, { name: string; symbol: string }>;
    timezones?: string[];
    flag?: string;
}

/**
 * RestCountries.com — free API for country metadata.
 * Enriches our country table with capitals, currencies, languages, flags.
 */
export class RestCountriesCollector extends BaseCollector {
    readonly sourceName = 'restcountries';
    readonly description = 'Country metadata (capitals, currencies, languages, timezones)';

    private readonly API_URL = 'https://restcountries.com/v3.1/alpha';
    private readonly COUNTRIES = [
        'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'ES', 'IT',
        'AT', 'SG', 'AE', 'NZ', 'JP', 'PT', 'TH', 'MY', 'MX', 'BR', 'AR',
    ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const code of this.COUNTRIES) {
            try {
                const raw = await this.fetchJson<RestCountry[] | RestCountry>(`${this.API_URL}/${code}?fields=cca2,name,capital,region,subregion,languages,currencies,timezones,flag`);
                const country = Array.isArray(raw) ? raw[0] : raw;
                if (!country || !country.cca2) { skipped++; continue; }

                const regionMap: Record<string, string> = {
                    'Americas': country.subregion?.includes('North') ? 'north-america' : 'south-america',
                    'Europe': 'europe',
                    'Oceania': 'oceania',
                    'Asia': 'asia',
                    'Africa': 'africa',
                };

                const result = await this.prisma.country.upsert({
                    where: { code: country.cca2 },
                    update: {
                        name: country.name.common,
                        capitalCity: country.capital?.[0] || null,
                        region: regionMap[country.region] || country.region.toLowerCase(),
                        languages: country.languages ? Object.keys(country.languages) : [],
                        currency: country.currencies ? Object.keys(country.currencies)[0] : 'USD',
                        flag: country.flag || null,
                        timezone: country.timezones?.[0] || null,
                    },
                    create: {
                        code: country.cca2,
                        name: country.name.common,
                        capitalCity: country.capital?.[0] || null,
                        region: regionMap[country.region] || country.region.toLowerCase(),
                        languages: country.languages ? Object.keys(country.languages) : [],
                        currency: country.currencies ? Object.keys(country.currencies)[0] : 'USD',
                        flag: country.flag || null,
                        timezone: country.timezones?.[0] || null,
                    }
                });

                updated++;
            } catch (err: any) {
                console.error(`  ⚠️ Failed to fetch ${code}: ${err.message}`);
                skipped++;
            }
        }

        return {
            source: this.sourceName,
            status: skipped === this.COUNTRIES.length ? 'error' : skipped > 0 ? 'partial' : 'success',
            recordsAdded: added,
            recordsUpdated: updated,
            recordsSkipped: skipped,
            durationMs: 0,
        };
    }
}
