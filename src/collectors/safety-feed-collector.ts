/**
 * Safety Feed Collector — Daily scraper for real-time safety/news data
 * 
 * Sources:
 * 1. GDELT — Global conflicts, protests, disasters (free API, no key needed)
 * 2. ReliefWeb — UN humanitarian crises (free API, no key needed)
 * 3. US Travel Advisories — Official danger levels per country
 * 
 * Architecture: Runs daily via cron → stores raw events in SafetyFeed table →
 * Alerts engine reads this table when generating city alerts (no AI tokens for scraping)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Country codes for our 155 cities (unique countries)
async function getOurCountryCodes(): Promise<{ code: string; name: string }[]> {
    const countries = await (prisma as any).city.findMany({
        select: { country: { select: { code: true, name: true } } },
        distinct: ['countryId'],
    });
    const unique = new Map<string, string>();
    for (const c of countries) {
        if (c.country?.code) unique.set(c.country.code, c.country.name);
    }
    return Array.from(unique.entries()).map(([code, name]) => ({ code, name }));
}

// ==========================================
// SOURCE 1: GDELT — Real-time events
// https://api.gdeltproject.org/api/v2/doc/doc
// ==========================================

type GdeltArticle = {
    title: string;
    url: string;
    seendate: string;
    domain: string;
    socialimage?: string;
};

async function fetchGDELT(countryName: string, countryCode: string): Promise<GdeltArticle[]> {
    try {
        // GDELT API — search for safety-related news about this country
        const queries = [
            `"${countryName}" (attack OR conflict OR bombing OR protest OR war OR violence OR terrorism)`,
            `"${countryName}" (earthquake OR flood OR hurricane OR typhoon OR tsunami OR disaster)`,
            `"${countryName}" (outbreak OR epidemic OR disease OR health emergency)`,
        ];

        const results: GdeltArticle[] = [];

        for (const query of queries) {
            const params = new URLSearchParams({
                query: query,
                mode: 'ArtList',
                maxrecords: '5',
                timespan: '3d',           // last 3 days
                format: 'json',
                sort: 'DateDesc',
            });

            const url = `https://api.gdeltproject.org/api/v2/doc/doc?${params}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

            if (!res.ok) continue;
            const text = await res.text();
            if (!text.trim()) continue;

            try {
                const json = JSON.parse(text);
                if (json.articles) {
                    results.push(...json.articles);
                }
            } catch { /* GDELT sometimes returns empty */ }

            // Rate limit: 250ms between calls
            await new Promise(r => setTimeout(r, 250));
        }

        return results;
    } catch (err: any) {
        console.warn(`  [gdelt] ${countryName}: ${err.message}`);
        return [];
    }
}

function categorizeGdeltTitle(title: string): { category: string; severity: string } {
    const t = title.toLowerCase();
    if (t.match(/bomb|attack|airstrike|missile|war|combat|military|killed|casualties|strike/)) return { category: 'conflict', severity: 'critical' };
    if (t.match(/terror|isis|al-qaeda|explosion/)) return { category: 'conflict', severity: 'critical' };
    if (t.match(/protest|riot|unrest|demonstration|clashes/)) return { category: 'political', severity: 'warning' };
    if (t.match(/coup|martial law|revolution|overthrow/)) return { category: 'political', severity: 'critical' };
    if (t.match(/earthquake|tsunami|typhoon|hurricane|cyclone|flood|volcanic/)) return { category: 'natural', severity: 'warning' };
    if (t.match(/tornado|wildfire|landslide/)) return { category: 'natural', severity: 'warning' };
    if (t.match(/outbreak|epidemic|pandemic|disease|cholera|dengue|ebola|mpox/)) return { category: 'health', severity: 'warning' };
    if (t.match(/kidnap|murder|cartel|gang|robbery|crime wave/)) return { category: 'crime', severity: 'warning' };
    if (t.match(/persecution|crackdown|detention|arrest.*journalist|human rights/)) return { category: 'persecution', severity: 'advisory' };
    if (t.match(/currency crash|devaluation|hyperinflation|capital controls/)) return { category: 'currency', severity: 'warning' };
    return { category: 'conflict', severity: 'advisory' };
}

// ==========================================
// SOURCE 2: ReliefWeb — UN humanitarian data
// https://api.reliefweb.int/v1/
// ==========================================

type ReliefWebReport = {
    id: number;
    fields: {
        title: string;
        url_alias?: string;
        date?: { created: string };
        country?: { name: string; iso3: string }[];
        disaster_type?: { name: string }[];
        primary_country?: { name: string; iso3: string };
        body?: string;
    };
};

async function fetchReliefWeb(countryName: string): Promise<ReliefWebReport[]> {
    try {
        const params = {
            appname: 'theimmigrants.news',
            filter: {
                operator: 'AND',
                conditions: [
                    { field: 'primary_country.name', value: countryName },
                    { field: 'date.created', value: { from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() } },
                ],
            },
            fields: { include: ['title', 'url_alias', 'date.created', 'country.name', 'disaster_type.name', 'primary_country.name'] },
            limit: 5,
            sort: ['date.created:desc'],
        };

        const res = await fetch('https://api.reliefweb.int/v1/reports?appname=theimmigrants.news', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return [];
        const json = await res.json();
        return json.data || [];
    } catch (err: any) {
        console.warn(`  [reliefweb] ${countryName}: ${err.message}`);
        return [];
    }
}

function categorizeReliefWeb(report: ReliefWebReport): { category: string; severity: string } {
    const disasterTypes = report.fields.disaster_type?.map(d => d.name.toLowerCase()) || [];
    const title = report.fields.title.toLowerCase();

    if (disasterTypes.some(d => d.includes('flood') || d.includes('storm') || d.includes('earthquake') || d.includes('tsunami') || d.includes('volcanic') || d.includes('cyclone')))
        return { category: 'natural', severity: 'warning' };
    if (disasterTypes.some(d => d.includes('epidemic') || d.includes('health')))
        return { category: 'health', severity: 'warning' };
    if (disasterTypes.some(d => d.includes('conflict') || d.includes('complex')))
        return { category: 'conflict', severity: 'critical' };
    if (title.match(/conflict|attack|war|fighting|bombing|military/))
        return { category: 'conflict', severity: 'critical' };
    return { category: 'humanitarian', severity: 'advisory' };
}

// ==========================================
// SOURCE 3: US Travel Advisories
// https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html
// ==========================================

type TravelAdvisory = {
    iso_code: string;
    name: string;
    advisory: string;
    level: number;  // 1-4
    date: string;
};

// ISO2 → ISO3 partial map (we'll match by country name as fallback)
async function fetchUSTravelAdvisories(): Promise<TravelAdvisory[]> {
    try {
        const res = await fetch(
            'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html/.json',
            { signal: AbortSignal.timeout(10000) }
        );

        if (!res.ok) {
            // Fallback: try the CAT feed
            const catRes = await fetch(
                'https://cadatalog.state.gov/datasets/CAT/data.json',
                { signal: AbortSignal.timeout(10000) }
            );
            if (!catRes.ok) return [];
            const catJson = await catRes.json();
            // Parse CAT format
            return (catJson || []).map((entry: any) => ({
                iso_code: entry.iso_code || '',
                name: entry.name || '',
                advisory: entry.advisory || '',
                level: entry.level || 1,
                date: entry.date_updated || new Date().toISOString(),
            }));
        }

        return [];
    } catch (err: any) {
        console.warn(`  [us_travel] ${err.message}`);
        return [];
    }
}

function travelLevelToSeverity(level: number): string {
    if (level >= 4) return 'critical';    // Do Not Travel
    if (level >= 3) return 'warning';     // Reconsider Travel
    if (level >= 2) return 'advisory';    // Exercise Increased Caution
    return 'info';                         // Exercise Normal Precautions
}

// ==========================================
// MAIN: Collect and store all feeds
// ==========================================

export async function collectSafetyFeeds(): Promise<{ gdelt: number; reliefweb: number; travel: number; total: number; cleaned: number }> {
    console.log('[safety-feed] Starting daily safety feed collection...');

    // Clean up expired feeds (>7 days old)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const cleaned = await (prisma as any).safetyFeed.deleteMany({
        where: { fetchedAt: { lt: sevenDaysAgo } },
    });
    console.log(`[safety-feed] Cleaned ${cleaned.count} old feeds`);

    const countries = await getOurCountryCodes();
    console.log(`[safety-feed] Scanning ${countries.length} countries...`);

    let gdeltCount = 0, reliefwebCount = 0, travelCount = 0;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // 1. GDELT — process all countries
    console.log('[safety-feed] Fetching GDELT events...');
    for (const country of countries) {
        const articles = await fetchGDELT(country.name, country.code);
        for (const article of articles) {
            const { category, severity } = categorizeGdeltTitle(article.title);

            // Dedup by title similarity
            const exists = await (prisma as any).safetyFeed.findFirst({
                where: {
                    source: 'gdelt',
                    countryCode: country.code,
                    title: { contains: article.title.split(' ').slice(0, 5).join(' '), mode: 'insensitive' },
                    fetchedAt: { gt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
                },
            });
            if (exists) continue;

            await (prisma as any).safetyFeed.create({
                data: {
                    source: 'gdelt',
                    countryCode: country.code,
                    countryName: country.name,
                    category,
                    severity,
                    title: article.title.slice(0, 500),
                    summary: null,
                    url: article.url?.slice(0, 500) || null,
                    eventDate: article.seendate ? new Date(article.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3T$4:$5:$6Z')) : new Date(),
                    expiresAt,
                    raw: JSON.stringify({ domain: article.domain }).slice(0, 1000),
                },
            });
            gdeltCount++;
        }

        if (articles.length > 0) {
            console.log(`  📰 ${country.name}: ${articles.length} GDELT articles`);
        }

        // Rate limit between countries
        await new Promise(r => setTimeout(r, 300));
    }

    // 2. ReliefWeb — process all countries
    console.log('[safety-feed] Fetching ReliefWeb reports...');
    for (const country of countries) {
        const reports = await fetchReliefWeb(country.name);
        for (const report of reports) {
            const { category, severity } = categorizeReliefWeb(report);

            const exists = await (prisma as any).safetyFeed.findFirst({
                where: {
                    source: 'reliefweb',
                    countryCode: country.code,
                    title: { contains: report.fields.title.split(' ').slice(0, 5).join(' '), mode: 'insensitive' },
                },
            });
            if (exists) continue;

            await (prisma as any).safetyFeed.create({
                data: {
                    source: 'reliefweb',
                    countryCode: country.code,
                    countryName: country.name,
                    category,
                    severity,
                    title: report.fields.title.slice(0, 500),
                    summary: null,
                    url: report.fields.url_alias ? `https://reliefweb.int${report.fields.url_alias}` : null,
                    eventDate: report.fields.date?.created ? new Date(report.fields.date.created) : new Date(),
                    expiresAt,
                    raw: JSON.stringify(report.fields.disaster_type || []).slice(0, 500),
                },
            });
            reliefwebCount++;
        }

        if (reports.length > 0) {
            console.log(`  🏥 ${country.name}: ${reports.length} ReliefWeb reports`);
        }

        await new Promise(r => setTimeout(r, 200));
    }

    // 3. US Travel Advisories — batch fetch all
    console.log('[safety-feed] Fetching US Travel Advisories...');
    const advisories = await fetchUSTravelAdvisories();
    const ourCodes = new Set(countries.map(c => c.code));

    for (const adv of advisories) {
        if (adv.level < 2) continue; // Skip level 1 (normal)

        // Try to match to our countries
        const matchedCountry = countries.find(c =>
            c.code === adv.iso_code?.slice(0, 2) ||
            c.name.toLowerCase() === adv.name?.toLowerCase()
        );
        if (!matchedCountry) continue;

        const exists = await (prisma as any).safetyFeed.findFirst({
            where: { source: 'us_travel', countryCode: matchedCountry.code },
        });
        if (exists) continue;

        await (prisma as any).safetyFeed.create({
            data: {
                source: 'us_travel',
                countryCode: matchedCountry.code,
                countryName: matchedCountry.name,
                category: 'political',
                severity: travelLevelToSeverity(adv.level),
                title: `US Travel Advisory Level ${adv.level}: ${adv.name}`,
                summary: adv.advisory?.slice(0, 500) || null,
                url: 'https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html',
                eventDate: adv.date ? new Date(adv.date) : new Date(),
                expiresAt,
            },
        });
        travelCount++;
    }
    if (travelCount > 0) console.log(`  🛂 ${travelCount} US Travel Advisories (level 2+)`);

    const total = gdeltCount + reliefwebCount + travelCount;
    console.log(`[safety-feed] Done! GDELT: ${gdeltCount}, ReliefWeb: ${reliefwebCount}, US Travel: ${travelCount}, Total: ${total}`);

    await prisma.$disconnect();
    return { gdelt: gdeltCount, reliefweb: reliefwebCount, travel: travelCount, total, cleaned: cleaned.count };
}
