import { BaseCollector, CollectorResult } from './base.js';

/**
 * EU Legislative Observatory — Scrapes migration-related EU legislation
 * from the European Parliament's Legislative Observatory RSS and
 * GOV.UK-style Atom feeds for EU-level policy changes.
 * 
 * Sources:
 * - European Parliament Legislative Observatory RSS
 * - EUR-Lex (Official Journal of the EU)
 * - EU Council press releases on migration
 */
export class EULegislationCollector extends BaseCollector {
    readonly sourceName = 'eu_legislation';
    readonly description = 'EU migration legislation — Parliament Observatory, EUR-Lex, Council';

    // RSS/Atom feeds for EU migration legislation
    private readonly FEEDS: {
        name: string;
        url: string;
        defaultCategory: string;
        impactLevel: string;
    }[] = [
            {
                name: 'EUR-Lex Migration & Asylum',
                url: 'https://eur-lex.europa.eu/EN/display-news.rss?rssId=47',
                defaultCategory: 'visa',
                impactLevel: 'high',
            },
            {
                name: 'EU Council Press — Justice & Home Affairs',
                url: 'https://www.consilium.europa.eu/en/rss/?r=press&c=justice-and-home-affairs&lang=en',
                defaultCategory: 'asylum',
                impactLevel: 'high',
            },
            {
                name: 'European Commission Migration',
                url: 'https://ec.europa.eu/commission/presscorner/api/rss?key=migration',
                defaultCategory: 'visa',
                impactLevel: 'high',
            },
        ];

    // EU member states in our DB (for country-level mapping)
    private readonly EU_COUNTRIES = ['DE', 'FR', 'NL', 'SE', 'ES', 'IT', 'AT', 'PT'];

    // Keywords for country detection in titles
    private readonly COUNTRY_KEYWORDS: Record<string, string[]> = {
        'DE': ['germany', 'german', 'deutschland'],
        'FR': ['france', 'french'],
        'NL': ['netherlands', 'dutch', 'holland'],
        'SE': ['sweden', 'swedish'],
        'ES': ['spain', 'spanish'],
        'IT': ['italy', 'italian'],
        'AT': ['austria', 'austrian'],
        'PT': ['portugal', 'portuguese'],
    };

    private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
        'visa': ['visa', 'entry', 'border', 'schengen', 'residence permit', 'travel', 'mobility'],
        'asylum': ['asylum', 'refugee', 'protection', 'return', 'deportation', 'relocation', 'dublin'],
        'labor': ['worker', 'employment', 'labour', 'blue card', 'posting', 'seasonal'],
        'healthcare': ['health', 'medical', 'pandemic', 'vaccination'],
        'education': ['education', 'student', 'erasmus', 'recognition', 'qualification'],
        'digital_nomad': ['digital', 'remote', 'telework', 'nomad'],
        'immigration_reform': ['pact', 'reform', 'regulation', 'directive', 'migration management'],
    };

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const feed of this.FEEDS) {
            try {
                console.log(`  🇪🇺 Fetching: ${feed.name}`);
                const result = await this.processFeed(feed);
                added += result.added;
                updated += result.updated;
                skipped += result.skipped;
                console.log(`    ✅ ${feed.name}: +${result.added} added`);
            } catch (err: any) {
                console.error(`  ⚠️ ${feed.name}: ${err.message}`);
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

    private async processFeed(feed: { name: string; url: string; defaultCategory: string; impactLevel: string }):
        Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        // UTF-8 safe fetch
        const xml = await this.fetchText(feed.url);
        const items = this.parseXMLItems(xml);
        const recentItems = items.slice(0, 15);

        for (const item of recentItems) {
            if (!item.title || !item.link) {
                skipped++;
                continue;
            }

            // ★ IMMIGRATION RELEVANCE FILTER
            if (!this.isImmigrationRelevant(item.title, item.description || '')) {
                skipped++;
                continue;
            }

            // Check for duplicates
            const existing = await this.prisma.legalUpdate.findFirst({
                where: { sourceUrl: item.link },
            });
            if (existing) { skipped++; continue; }

            // Detect category & country
            const textForAnalysis = `${item.title} ${item.description || ''}`.toLowerCase();
            const category = this.detectCategory(textForAnalysis) || feed.defaultCategory;
            const targetCountry = this.detectCountry(textForAnalysis);

            // Parse date → effectiveDate + publishedAt
            let effectiveDate: Date | null = null;
            let publishedAt = new Date();
            if (item.pubDate) {
                const parsed = new Date(item.pubDate);
                if (!isNaN(parsed.getTime())) {
                    effectiveDate = parsed;
                    publishedAt = parsed;
                }
            }

            // ★ FETCH ARTICLE CONTENT for details
            const articleContent = await this.fetchArticleContent(item.link);

            const countries = targetCountry ? [targetCountry] : this.EU_COUNTRIES;

            for (const countryCode of countries) {
                const country = await this.prisma.country.findUnique({ where: { code: countryCode } });
                if (!country) continue;

                const countryExisting = await this.prisma.legalUpdate.findFirst({
                    where: { sourceUrl: item.link, countryCode },
                });
                if (countryExisting) { skipped++; continue; }

                await this.prisma.legalUpdate.create({
                    data: {
                        countryCode,
                        category,
                        title: `[EU] ${this.stripHtml(item.title)}`.substring(0, 500),
                        summary: this.stripHtml(item.description || 'EU legislation update').substring(0, 2000),
                        details: articleContent || `Source: ${feed.name} | Scope: ${targetCountry ? 'Country-specific' : 'EU-wide'}`,
                        impactLevel: feed.impactLevel,
                        sourceUrl: item.link,
                        effectiveDate,
                        publishedAt,
                    },
                });
                added++;
            }
        }

        return { added, updated, skipped };
    }

    private parseXMLItems(xml: string): { title: string; link: string; description?: string; pubDate?: string }[] {
        const items: { title: string; link: string; description?: string; pubDate?: string }[] = [];

        // RSS 2.0
        const rssRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = rssRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            items.push({
                title: this.extractTag(itemXml, 'title'),
                link: this.extractTag(itemXml, 'link') || this.extractTag(itemXml, 'guid'),
                description: this.extractTag(itemXml, 'description'),
                pubDate: this.extractTag(itemXml, 'pubDate') || this.extractTag(itemXml, 'dc:date'),
            });
        }

        // Atom
        if (items.length === 0) {
            const atomRegex = /<entry>([\s\S]*?)<\/entry>/gi;
            while ((match = atomRegex.exec(xml)) !== null) {
                const entryXml = match[1];
                const linkMatch = entryXml.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
                items.push({
                    title: this.extractTag(entryXml, 'title'),
                    link: linkMatch ? linkMatch[1] : '',
                    description: this.extractTag(entryXml, 'summary') || this.extractTag(entryXml, 'content'),
                    pubDate: this.extractTag(entryXml, 'updated') || this.extractTag(entryXml, 'published'),
                });
            }
        }

        return items;
    }

    private extractTag(xml: string, tag: string): string {
        const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, 'i');
        const cdataMatch = xml.match(cdataRegex);
        if (cdataMatch) return cdataMatch[1].trim();

        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const match = xml.match(regex);
        if (match) return match[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        return '';
    }

    private detectCategory(text: string): string | null {
        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => text.includes(kw))) return category;
        }
        return null;
    }

    private detectCountry(text: string): string | null {
        for (const [code, keywords] of Object.entries(this.COUNTRY_KEYWORDS)) {
            if (keywords.some(kw => text.includes(kw))) return code;
        }
        return null;
    }
}
