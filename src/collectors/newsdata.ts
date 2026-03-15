import { BaseCollector, CollectorResult } from './base.js';

interface NewsDataArticle {
    article_id: string;
    title: string;
    link: string;
    description: string | null;
    content: string | null;
    pubDate: string;
    pubDateTZ: string;
    source_id: string;
    source_name: string;
    source_url: string;
    source_icon: string | null;
    language: string;
    country: string[];
    category: string[];
    sentiment: string;         // "positive" | "negative" | "neutral"
    sentiment_stats: {
        positive: number;
        negative: number;
        neutral: number;
    };
    ai_tag: string[];
    ai_region: string;
    ai_org: string;
    duplicate: boolean;
    keywords: string[] | null;
}

interface NewsDataResponse {
    status: string;
    totalResults: number;
    results: NewsDataArticle[];
    nextPage?: string;
}

/**
 * NewsData.io — Global News API for immigration topics
 * https://newsdata.io/
 * 
 * Free plan: 200 requests/day, 10 results per request
 * 79,000+ sources, 206 countries, 89 languages
 */
export class NewsDataCollector extends BaseCollector {
    readonly sourceName = 'newsdata';
    readonly description = 'NewsData.io — global immigration, visa, healthcare news';

    private readonly BASE = 'https://newsdata.io/api/1/latest';
    private readonly API_KEY = process.env.NEWSDATA_API_KEY || '';

    // Search configurations — different queries for different topics
    private readonly SEARCHES: {
        query: string;
        countries?: string;
        category?: string;
        defaultDbCategory: string;
        description: string;
    }[] = [
            {
                query: 'immigration visa policy reform',
                countries: 'us,ca,gb,au,de',
                category: 'politics',
                defaultDbCategory: 'visa',
                description: 'Immigration policy news (Tier 1)',
            },
            {
                query: 'digital nomad visa remote work',
                category: 'politics,business',
                defaultDbCategory: 'digital_nomad',
                description: 'Digital nomad visa updates',
            },
            {
                query: 'asylum refugee policy',
                countries: 'us,ca,gb,de,fr',
                category: 'politics',
                defaultDbCategory: 'asylum',
                description: 'Asylum & refugee policy',
            },
            {
                query: 'work permit labor immigration',
                countries: 'us,ca,gb,au,de,sg',
                category: 'politics,business',
                defaultDbCategory: 'labor',
                description: 'Work permits & labor immigration',
            },
            {
                query: 'healthcare system expat immigrant',
                category: 'health',
                defaultDbCategory: 'healthcare',
                description: 'Healthcare for immigrants',
            },
        ];

    // Country name → ISO2 code mapping for articles
    private readonly COUNTRY_MAP: Record<string, string> = {
        'united states': 'US', 'united states of america': 'US', 'usa': 'US',
        'canada': 'CA', 'united kingdom': 'GB', 'uk': 'GB', 'great britain': 'GB',
        'australia': 'AU', 'germany': 'DE', 'france': 'FR',
        'netherlands': 'NL', 'sweden': 'SE', 'spain': 'ES', 'italy': 'IT',
        'austria': 'AT', 'singapore': 'SG', 'united arab emirates': 'AE',
        'new zealand': 'NZ', 'japan': 'JP', 'portugal': 'PT',
        'thailand': 'TH', 'malaysia': 'MY', 'mexico': 'MX', 'brazil': 'BR',
    };

    // Category detection
    private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
        'visa': ['visa', 'immigration', 'green card', 'residence permit', 'entry requirement'],
        'labor': ['work permit', 'employment', 'labor', 'wages', 'worker rights'],
        'asylum': ['asylum', 'refugee', 'deportation', 'shelter', 'TPS'],
        'healthcare': ['health', 'medical', 'hospital', 'insurance', 'vaccination'],
        'tax': ['tax', 'taxation', 'fiscal', 'tariff'],
        'education': ['student', 'university', 'education', 'scholarship', 'study abroad'],
        'digital_nomad': ['digital nomad', 'remote work', 'freelance', 'coworking'],
        'housing': ['housing', 'rent', 'real estate', 'accommodation'],
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        if (!this.API_KEY) {
            console.log('  ⚠️ NEWSDATA_API_KEY not set. Get one at https://newsdata.io/register');
            return {
                source: this.sourceName,
                status: 'error',
                recordsAdded: 0, recordsUpdated: 0, recordsSkipped: 0,
                errorMessage: 'NEWSDATA_API_KEY not configured',
                durationMs: 0,
            };
        }

        for (const search of this.SEARCHES) {
            try {
                console.log(`  📰 Searching: ${search.description}`);

                let url = `${this.BASE}?apikey=${this.API_KEY}&q=${encodeURIComponent(search.query)}&language=en`;
                if (search.countries) url += `&country=${search.countries}`;
                if (search.category) url += `&category=${search.category}`;

                const response = await this.fetchJson<NewsDataResponse>(url);

                if (response.status !== 'success' || !response.results) {
                    console.log(`    ⏭️ No results for "${search.query}"`);
                    skipped++;
                    continue;
                }

                for (const article of response.results) {
                    // Skip duplicates flagged by NewsData
                    if (article.duplicate) {
                        skipped++;
                        continue;
                    }

                    // Check if already in DB
                    const existing = await this.prisma.legalUpdate.findFirst({
                        where: { sourceUrl: article.link },
                    });

                    if (existing) {
                        skipped++;
                        continue;
                    }

                    // Determine country code
                    const countryCode = this.resolveCountryCode(article);
                    if (!countryCode) {
                        skipped++;
                        continue;
                    }

                    // Check country exists in DB
                    const country = await this.prisma.country.findUnique({ where: { code: countryCode } });
                    if (!country) {
                        skipped++;
                        continue;
                    }

                    // ★ IMMIGRATION RELEVANCE FILTER
                    if (!this.isImmigrationRelevant(article.title, article.description || '')) {
                        skipped++;
                        continue;
                    }

                    // Determine category
                    const textForAnalysis = `${article.title} ${article.description || ''}`.toLowerCase();
                    const category = this.detectCategory(textForAnalysis) || search.defaultDbCategory;

                    // Determine impact level from sentiment + keywords
                    const impactLevel = this.detectImpactLevel(textForAnalysis, article.sentiment);

                    // Parse date → effectiveDate + publishedAt
                    let effectiveDate: Date | null = null;
                    let publishedAt = new Date();
                    if (article.pubDate) {
                        const parsed = new Date(article.pubDate);
                        if (!isNaN(parsed.getTime())) {
                            effectiveDate = parsed;
                            publishedAt = parsed;
                        }
                    }

                    // Use article content as details (richer than metadata)
                    const details = article.content
                        ? article.content.substring(0, 2000)
                        : `Source: ${article.source_name || article.source_id} | Sentiment: ${article.sentiment} | Keywords: ${(article.keywords || []).join(', ')}`;

                    await this.prisma.legalUpdate.create({
                        data: {
                            countryCode,
                            category,
                            title: article.title.substring(0, 500),
                            summary: (article.description || 'No summary').substring(0, 2000),
                            details,
                            impactLevel,
                            sourceUrl: article.link,
                            effectiveDate,
                            publishedAt,
                        },
                    });
                    added++;
                }

                console.log(`    ✅ ${search.description}: ${response.results.length} articles processed`);
            } catch (err: any) {
                console.error(`  ⚠️ ${search.description}: ${err.message}`);
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

    private resolveCountryCode(article: NewsDataArticle): string | null {
        // 1. From country field
        if (article.country && article.country.length > 0) {
            const mapped = article.country[0].toUpperCase();
            // NewsData uses ISO2 in country field
            if (mapped.length === 2) return mapped;
        }

        // 2. From title/description text
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        for (const [name, code] of Object.entries(this.COUNTRY_MAP)) {
            if (text.includes(name)) return code;
        }

        // 3. Default to US (most immigration news)
        return 'US';
    }

    private detectCategory(text: string): string | null {
        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => text.includes(kw.toLowerCase()))) {
                return category;
            }
        }
        return null;
    }

    private detectImpactLevel(text: string, sentiment: string): string {
        const critical = ['ban', 'suspend', 'terminate', 'prohibit', 'revoke', 'emergency', 'crisis'];
        const high = ['reform', 'new law', 'new policy', 'overhaul', 'signed into law', 'enacted', 'landmark'];
        const medium = ['announce', 'propose', 'update', 'change', 'amend', 'extend', 'modify'];

        if (critical.some(w => text.includes(w))) return 'critical';
        if (high.some(w => text.includes(w))) return 'high';
        if (medium.some(w => text.includes(w))) return 'medium';

        // Use sentiment as tiebreaker
        if (sentiment === 'negative') return 'medium';
        return 'low';
    }
}
