import { BaseCollector, CollectorResult } from './base.js';

interface RSSFeedConfig {
    name: string;
    url: string;
    countryCode: string;
    defaultCategory: string;
    defaultImpactLevel: string;
}

/**
 * Universal RSS/Atom feed collector for immigration news.
 * 
 * Features:
 * - Immigration keyword filtering (rejects irrelevant articles)
 * - Fetches full article content for `details`
 * - Sets effectiveDate from pubDate
 * - UTF-8 safe
 */
export class RSSFeedsCollector extends BaseCollector {
    readonly sourceName = 'rss_feeds';
    readonly description = 'RSS/Atom feeds — IRCC, MPI, GOV.UK immigration news';

    private readonly FEEDS: RSSFeedConfig[] = [
        {
            name: 'Canada Immigration News',
            url: 'https://www.canada.ca/en/immigration-refugees-citizenship/news/notices.atom',
            countryCode: 'CA',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        {
            name: 'US Federal Register - Immigration',
            url: 'https://www.federalregister.gov/documents/search.rss?conditions%5Bagencies%5D%5B%5D=homeland-security-department&conditions%5Bterm%5D=immigration',
            countryCode: 'US',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        {
            name: 'GOV.UK Immigration',
            url: 'https://www.gov.uk/search/news-and-communications.atom?topics[]=immigration',
            countryCode: 'GB',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
        {
            name: 'US State Dept - Refugees & Migration',
            url: 'https://www.state.gov/rss-feed/population-refugees-and-migration/',
            countryCode: 'US',
            defaultCategory: 'asylum',
            defaultImpactLevel: 'high',
        },
        {
            name: 'Australian Immigration News',
            url: 'https://www.homeaffairs.gov.au/news-subsite/Pages/rss.aspx',
            countryCode: 'AU',
            defaultCategory: 'visa',
            defaultImpactLevel: 'high',
        },
    ];

    async collect(): Promise<CollectorResult> {
        let added = 0, updated = 0, skipped = 0;

        for (const feed of this.FEEDS) {
            try {
                console.log(`  📰 Fetching: ${feed.name}`);
                const result = await this.processFeed(feed);
                added += result.added;
                updated += result.updated;
                skipped += result.skipped;
                console.log(`    ✅ ${feed.name}: +${result.added} added, ${result.skipped} filtered`);
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

    private async processFeed(feed: RSSFeedConfig): Promise<{ added: number; updated: number; skipped: number }> {
        let added = 0, updated = 0, skipped = 0;

        const country = await this.prisma.country.findUnique({ where: { code: feed.countryCode } });
        if (!country) {
            console.log(`    ⏭️ Country ${feed.countryCode} not in DB`);
            return { added: 0, updated: 0, skipped: 1 };
        }

        // Fetch XML with UTF-8
        const xml = await this.fetchText(feed.url);
        const items = this.parseXMLItems(xml);
        const recentItems = items.slice(0, 20);

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
            if (existing) {
                skipped++;
                continue;
            }

            // Parse date from feed
            let effectiveDate: Date | null = null;
            let publishedAt = new Date();
            if (item.pubDate) {
                const parsed = new Date(item.pubDate);
                if (!isNaN(parsed.getTime())) {
                    effectiveDate = parsed;
                    publishedAt = parsed;
                }
            }

            // Detect category
            const textForAnalysis = `${item.title} ${item.description || ''}`.toLowerCase();
            const category = this.detectCategory(textForAnalysis) || feed.defaultCategory;
            const impactLevel = this.detectImpactLevel(textForAnalysis) || feed.defaultImpactLevel;

            // ★ FETCH FULL ARTICLE CONTENT for details
            const articleContent = await this.fetchArticleContent(item.link);

            await this.prisma.legalUpdate.create({
                data: {
                    countryCode: feed.countryCode,
                    category,
                    title: this.stripHtml(item.title).substring(0, 500),
                    summary: this.stripHtml(item.description || 'No summary available').substring(0, 2000),
                    details: articleContent || `Source: ${feed.name}`,
                    impactLevel,
                    sourceUrl: item.link,
                    effectiveDate,
                    publishedAt,
                },
            });
            added++;
        }

        return { added, updated, skipped };
    }

    private parseXMLItems(xml: string): { title: string; link: string; description?: string; pubDate?: string }[] {
        const items: { title: string; link: string; description?: string; pubDate?: string }[] = [];

        // RSS 2.0
        const rssItemRegex = /<item>([\s\S]*?)<\/item>/gi;
        let match;
        while ((match = rssItemRegex.exec(xml)) !== null) {
            const itemXml = match[1];
            items.push({
                title: this.extractTag(itemXml, 'title'),
                link: this.extractTag(itemXml, 'link') || this.extractTag(itemXml, 'guid'),
                description: this.extractTag(itemXml, 'description') || this.extractTag(itemXml, 'content:encoded'),
                pubDate: this.extractTag(itemXml, 'pubDate') || this.extractTag(itemXml, 'dc:date'),
            });
        }

        // Atom
        if (items.length === 0) {
            const atomEntryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
            while ((match = atomEntryRegex.exec(xml)) !== null) {
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
        if (match) return this.stripHtml(match[1].trim());
        return '';
    }

    private readonly CATEGORY_KEYWORDS: Record<string, string[]> = {
        'visa': ['visa', 'permit', 'immigration', 'entry', 'travel', 'passport', 'h-1b', 'green card', 'express entry', 'skilled worker', 'points-based'],
        'labor': ['employment', 'work permit', 'ead', 'labor', 'lmia', 'worker', 'wages', 'job market'],
        'asylum': ['asylum', 'refugee', 'tps', 'humanitarian', 'parole', 'protection', 'displaced', 'safe third'],
        'tax': ['tax', 'fee', 'filing fee', 'premium processing', 'cost'],
        'healthcare': ['health', 'medical', 'vaccination', 'insurance'],
        'education': ['student', 'study permit', 'university', 'stem', 'opt', 'scholarship'],
        'housing': ['housing', 'rent', 'accommodation', 'settlement'],
        'digital_nomad': ['digital nomad', 'remote work', 'freelancer', 'telework'],
    };

    private detectCategory(text: string): string | null {
        for (const [category, keywords] of Object.entries(this.CATEGORY_KEYWORDS)) {
            if (keywords.some(kw => text.includes(kw.toLowerCase()))) return category;
        }
        return null;
    }

    private detectImpactLevel(text: string): string | null {
        const critical = ['suspend', 'terminate', 'ban', 'prohibit', 'revoke', 'emergency', 'immediately'];
        const high = ['reform', 'new policy', 'new regulation', 'overhaul', 'comprehensive', 'signed', 'enacted', 'passed', 'law change'];
        const medium = ['amend', 'update', 'modify', 'extend', 'announce', 'propose', 'guidance'];

        if (critical.some(w => text.includes(w))) return 'critical';
        if (high.some(w => text.includes(w))) return 'high';
        if (medium.some(w => text.includes(w))) return 'medium';
        return null;
    }
}
