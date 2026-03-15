import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface CollectorResult {
    source: string;
    status: 'success' | 'error' | 'partial';
    recordsAdded: number;
    recordsUpdated: number;
    recordsSkipped: number;
    errorMessage?: string;
    durationMs: number;
}

/**
 * Base class for all data collectors.
 * Each collector fetches data from a specific source,
 * normalizes it, and upserts into the database.
 */
/** Immigration relevance keywords — at least one must match */
const IMMIGRATION_KEYWORDS = [
    'immigration', 'immigrant', 'visa', 'asylum', 'refugee',
    'deportation', 'citizenship', 'naturalization', 'residency',
    'work permit', 'green card', 'border', 'migrant', 'migration',
    'skilled worker', 'points system', 'express entry', 'h-1b',
    'settlement', 'leave to remain', 'right to work',
    'family reunion', 'sponsor', 'biometric', 'travel ban',
    'foreign worker', 'labour market', 'occupation list',
    'digital nomad', 'blue card', 'golden visa', 'nomad visa',
    'expat', 'expatriate', 'relocation', 'work abroad',
    'schengen', 'free movement', 'right to stay', 'overstay',
    'undocumented', 'illegal entry', 'removal', 'detention',
    'uscis', 'ircc', 'home office', 'dhs', 'cbp', 'ice',
];

export abstract class BaseCollector {
    abstract readonly sourceName: string;
    abstract readonly description: string;

    protected prisma = prisma;

    /** Main collection logic — implement in subclass */
    abstract collect(): Promise<CollectorResult>;

    /** Check if text is immigration-relevant */
    protected isImmigrationRelevant(title: string, summary: string = ''): boolean {
        const text = `${title} ${summary}`.toLowerCase();
        return IMMIGRATION_KEYWORDS.some(kw => text.includes(kw));
    }

    /** Fetch JSON from a URL with error handling */
    protected async fetchJson<T = any>(url: string, options?: RequestInit): Promise<T> {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'ImmigrantsDataBot/1.0',
                ...options?.headers,
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText} — ${url}`);
        }

        return response.json() as Promise<T>;
    }

    /** Fetch text with UTF-8 encoding guaranteed */
    protected async fetchText(url: string): Promise<string> {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'ImmigrantsDataBot/1.0',
                'Accept': 'application/xml, application/atom+xml, application/rss+xml, text/xml, text/html',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        return new TextDecoder('utf-8').decode(buffer);
    }

    /** Fetch article content from URL, extract main body text */
    protected async fetchArticleContent(url: string): Promise<string | null> {
        try {
            const res = await fetch(url, {
                headers: { 'User-Agent': 'ImmigrantsDataBot/1.0' },
                signal: AbortSignal.timeout(10000),
            });
            if (!res.ok) return null;
            const buffer = await res.arrayBuffer();
            const html = new TextDecoder('utf-8').decode(buffer);

            // Try to extract main content body
            const bodyMatch = html.match(
                /<(?:div|article|section)[^>]*class="[^"]*(?:govspeak|article-body|content-body|field-body|entry-content|post-content|ecl-paragraph)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|section)>/i
            );

            if (bodyMatch) {
                return this.stripHtml(bodyMatch[1]).trim().substring(0, 2000);
            }

            // Fallback: meta description
            const metaMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/) ||
                html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/);
            if (metaMatch) return this.stripHtml(metaMatch[1]);

            // Fallback: first <p> tags
            const paragraphs: string[] = [];
            const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
            let pMatch;
            while ((pMatch = pRegex.exec(html)) !== null && paragraphs.length < 5) {
                const text = this.stripHtml(pMatch[1]).trim();
                if (text.length > 40) paragraphs.push(text);
            }
            if (paragraphs.length > 0) return paragraphs.join('\n\n').substring(0, 2000);

            return null;
        } catch {
            return null;
        }
    }

    /** Strip HTML tags and decode entities */
    protected stripHtml(text: string): string {
        return text
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /** Sleep for ms (for rate limiting) */
    protected sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /** Run collector and log results */
    async run(): Promise<CollectorResult> {
        const start = Date.now();
        console.log(`\n📡 [${this.sourceName}] Starting collection...`);

        let result: CollectorResult;
        try {
            result = await this.collect();
        } catch (error: any) {
            result = {
                source: this.sourceName,
                status: 'error',
                recordsAdded: 0,
                recordsUpdated: 0,
                recordsSkipped: 0,
                errorMessage: error.message,
                durationMs: Date.now() - start,
            };
        }

        result.durationMs = Date.now() - start;

        // Log to collection_logs table
        await this.prisma.collectionLog.create({
            data: {
                sourceName: result.source,
                status: result.status,
                recordsAdded: result.recordsAdded,
                recordsUpdated: result.recordsUpdated,
                recordsSkipped: result.recordsSkipped,
                errorMessage: result.errorMessage,
                durationMs: result.durationMs,
            }
        });

        // Update data source status
        await this.prisma.dataSource.updateMany({
            where: { name: this.sourceName },
            data: {
                lastFetchedAt: new Date(),
                lastStatus: result.status,
            }
        });

        const icon = result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
        console.log(`${icon} [${this.sourceName}] ${result.status} — +${result.recordsAdded} added, ~${result.recordsUpdated} updated, ${result.recordsSkipped} skipped (${result.durationMs}ms)`);

        if (result.errorMessage) {
            console.error(`   Error: ${result.errorMessage}`);
        }

        return result;
    }
}

export { prisma };
