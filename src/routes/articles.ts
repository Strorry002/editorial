import { FastifyInstance } from 'fastify';
import { generateArticleDraft, generateCoverPrompt, generateCoverImage } from '../services/ai.js';
import { runAutopilot, generateOutline, reviewArticle } from '../services/autopilot.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80)
        .replace(/^-|-$/g, '');
}

export async function articlesRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // ── Kanban ──────────────────────────────────────────────────
    app.get('/kanban', async () => {
        const statuses = ['idea', 'outline', 'draft', 'review', 'approved', 'published', 'archived'];
        const result: Record<string, any[]> = {};

        for (const status of statuses) {
            result[status] = await prisma.article.findMany({
                where: { status },
                orderBy: { updatedAt: 'desc' },
                take: 50,
                include: {
                    _count: { select: { sources: true, distributions: true } },
                    distributions: { select: { channel: true, status: true } },
                },
            });
        }

        return result;
    });

    // ── List ────────────────────────────────────────────────────
    app.get('/', async (request) => {
        const { status, tag, language, limit } = request.query as {
            status?: string; tag?: string; language?: string; limit?: string;
        };

        const where: any = {};
        if (status) where.status = status;
        if (language) where.language = language;
        if (tag) where.tags = { has: tag };

        const data = await prisma.article.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: parseInt(limit || '50'),
            include: {
                _count: { select: { sources: true } },
                distributions: { select: { channel: true, status: true } },
            },
        });

        return { data, total: data.length };
    });

    // ── Create ──────────────────────────────────────────────────
    app.post('/', async (request) => {
        const body = request.body as {
            title: string;
            slug?: string;
            tags?: string[];
            sourceIds?: string[];
            language?: string;
            region?: string;
        };

        const slug = body.slug || slugify(body.title) + '-' + Date.now().toString(36);

        const article = await prisma.article.create({
            data: {
                title: body.title,
                slug,
                tags: body.tags || [],
                language: body.language || 'ru',
                region: body.region || null,
                sources: body.sourceIds?.length ? {
                    create: body.sourceIds.map((id: string) => ({
                        updateId: id,
                        role: 'source',
                    })),
                } : undefined,
            },
            include: {
                sources: { include: { update: { select: { id: true, title: true, countryCode: true, category: true } } } },
            },
        });

        return article;
    });

    // ── Get Single ──────────────────────────────────────────────
    app.get('/:id', async (request) => {
        const { id } = request.params as { id: string };

        const article = await prisma.article.findUnique({
            where: { id },
            include: {
                sources: {
                    include: {
                        update: {
                            select: {
                                id: true, title: true, summary: true, countryCode: true,
                                category: true, impactLevel: true, sourceUrl: true,
                                effectiveDate: true, createdAt: true,
                                country: { select: { name: true, flag: true } },
                            },
                        },
                    },
                },
                distributions: true,
            },
        });

        if (!article) {
            const e = new Error('Article not found');
            (e as any).statusCode = 404;
            throw e;
        }

        return article;
    });

    // ── Update ──────────────────────────────────────────────────
    app.patch('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const body = request.body as {
            title?: string;
            slug?: string;
            excerpt?: string;
            body?: string;
            bodyHtml?: string;
            coverImage?: string;
            tags?: string[];
            region?: string;
            language?: string;
            status?: string;
            author?: string;
            reviewer?: string;
            reviewNote?: string;
            metaTitle?: string;
            metaDescription?: string;
            scheduledAt?: string;
        };

        const data: any = {};
        const fields = ['title', 'slug', 'excerpt', 'body', 'bodyHtml', 'coverImage',
            'tags', 'region', 'language', 'status', 'author', 'reviewer', 'reviewNote',
            'metaTitle', 'metaDescription'] as const;

        for (const f of fields) {
            if (body[f] !== undefined) data[f] = body[f];
        }

        if (body.scheduledAt) data.scheduledAt = new Date(body.scheduledAt);
        if (body.status === 'published' && !data.publishedAt) {
            data.publishedAt = new Date();
        }

        const updated = await prisma.article.update({
            where: { id },
            data,
            include: {
                _count: { select: { sources: true } },
                distributions: { select: { channel: true, status: true } },
            },
        });

        return updated;
    });

    // ── Delete ──────────────────────────────────────────────────
    app.delete('/:id', async (request) => {
        const { id } = request.params as { id: string };
        await prisma.article.delete({ where: { id } });
        return { success: true };
    });

    // ── Sources ─────────────────────────────────────────────────

    // Add source to article
    app.post('/:id/sources', async (request) => {
        const { id } = request.params as { id: string };
        const { updateId, role, note } = request.body as { updateId: string; role?: string; note?: string };

        const source = await prisma.articleSource.create({
            data: {
                articleId: id,
                updateId,
                role: role || 'source',
                note: note || null,
            },
            include: {
                update: { select: { id: true, title: true, countryCode: true, category: true } },
            },
        });

        return source;
    });

    // Remove source
    app.delete('/:id/sources/:srcId', async (request) => {
        const { srcId } = request.params as { id: string; srcId: string };
        await prisma.articleSource.delete({ where: { id: srcId } });
        return { success: true };
    });

    // ── Status transition ───────────────────────────────────────
    app.patch('/:id/status', async (request) => {
        const { id } = request.params as { id: string };
        const { status, reviewer, reviewNote } = request.body as {
            status: string; reviewer?: string; reviewNote?: string;
        };

        const validStatuses = ['idea', 'outline', 'draft', 'review', 'approved', 'published', 'archived'];
        if (!validStatuses.includes(status)) {
            const e = new Error(`Invalid status: ${status}`);
            (e as any).statusCode = 400;
            throw e;
        }

        const data: any = { status };
        if (reviewer !== undefined) data.reviewer = reviewer;
        if (reviewNote !== undefined) data.reviewNote = reviewNote;
        if (status === 'published') data.publishedAt = new Date();

        const updated = await prisma.article.update({ where: { id }, data });
        return updated;
    });

    // ── Distribution ────────────────────────────────────────────

    app.get('/:id/distributions', async (request) => {
        const { id } = request.params as { id: string };
        const data = await prisma.articleDistribution.findMany({
            where: { articleId: id },
        });
        return { data };
    });

    app.post('/:id/distribute', async (request) => {
        const { id } = request.params as { id: string };
        const { channels, format } = request.body as { channels: string[]; format?: string };

        const results = [];
        for (const channel of channels) {
            const existing = await prisma.articleDistribution.findUnique({
                where: { articleId_channel: { articleId: id, channel } },
            });

            if (existing) {
                results.push(existing);
                continue;
            }

            const dist = await prisma.articleDistribution.create({
                data: {
                    articleId: id,
                    channel,
                    format: format || 'full',
                    status: 'pending',
                },
            });
            results.push(dist);
        }

        return { data: results };
    });

    // ── Search updates (for adding sources) ─────────────────────
    app.get('/search-updates', async (request) => {
        const { q } = request.query as { q?: string };
        if (!q || q.length < 2) return { data: [] };

        const data = await prisma.legalUpdate.findMany({
            where: { title: { contains: q, mode: 'insensitive' } },
            take: 10,
            select: {
                id: true, title: true, summary: true,
                countryCode: true, category: true, impactLevel: true,
                effectiveDate: true,
                country: { select: { flag: true, name: true } },
            },
        });

        return { data };
    });

    // ── AI: Generate Draft ──────────────────────────────────────
    app.post('/:id/generate-draft', async (request) => {
        const { id } = request.params as { id: string };

        // Fetch article with sources
        const article = await prisma.article.findUnique({
            where: { id },
            include: {
                sources: {
                    include: {
                        update: {
                            select: {
                                title: true, summary: true, details: true,
                                countryCode: true, category: true, impactLevel: true,
                                effectiveDate: true, sourceUrl: true,
                                country: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });

        if (!article) {
            const e = new Error('Article not found');
            (e as any).statusCode = 404;
            throw e;
        }

        if (!article.sources.length) {
            const e = new Error('No sources linked. Add at least one LegalUpdate source first.');
            (e as any).statusCode = 400;
            throw e;
        }

        const sourceMaterials = article.sources.map(s => ({
            title: s.update.title,
            summary: s.update.summary,
            details: s.update.details,
            countryCode: s.update.countryCode,
            countryName: s.update.country?.name,
            category: s.update.category,
            impactLevel: s.update.impactLevel,
            effectiveDate: s.update.effectiveDate?.toISOString() || null,
            sourceUrl: s.update.sourceUrl,
        }));

        const result = await generateArticleDraft(article.title, sourceMaterials, article.language);

        // Update article with generated content
        const updated = await prisma.article.update({
            where: { id },
            data: {
                title: result.title,
                excerpt: result.excerpt,
                body: result.body,
                tags: result.tags.length ? result.tags : article.tags,
                metaDescription: result.metaDescription,
                status: article.status === 'idea' ? 'draft' : article.status,
            },
        });

        return {
            ...updated,
            _generated: true,
            _model: 'gpt-4o-mini',
        };
    });

    // ── AI: Generate Cover ──────────────────────────────────────
    app.post('/:id/generate-cover', async (request) => {
        const { id } = request.params as { id: string };

        const article = await prisma.article.findUnique({
            where: { id },
            include: {
                sources: {
                    include: {
                        update: { select: { country: { select: { flag: true } } } },
                    },
                },
            },
        });

        if (!article) {
            const e = new Error('Article not found');
            (e as any).statusCode = 404;
            throw e;
        }

        const flags = [...new Set(article.sources.map(s => s.update.country?.flag).filter(Boolean))] as string[];
        const prompt = generateCoverPrompt(article.title, article.tags, flags);

        const imageUrl = await generateCoverImage(prompt);

        // Update article with cover URL
        const updated = await prisma.article.update({
            where: { id },
            data: { coverImage: imageUrl },
        });

        return {
            coverImage: imageUrl,
            prompt,
            article: updated,
        };
    });

    // ── Autopilot: AI groups raw updates → creates articles → drafts ──
    app.post('/autopilot', async (request) => {
        const body = (request.body || {}) as { autoDraft?: boolean; hoursBack?: number };
        const result = await runAutopilot({
            autoDraft: body.autoDraft !== false,
            hoursBack: body.hoursBack || 48,
        });
        return result;
    });

    // ── AI: Generate Outline ────────────────────────────────────
    app.post('/:id/generate-outline', async (request) => {
        const { id } = request.params as { id: string };
        const outline = await generateOutline(id);

        if (outline) {
            await prisma.article.update({
                where: { id },
                data: {
                    body: outline,
                    status: 'outline',
                },
            });
        }

        return { outline, success: !!outline };
    });

    // ── AI: Review Article ──────────────────────────────────────
    app.post('/:id/ai-review', async (request) => {
        const { id } = request.params as { id: string };
        const reviewNote = await reviewArticle(id);

        await prisma.article.update({
            where: { id },
            data: { reviewNote, status: 'review' },
        });

        return { reviewNote };
    });

    // ── Upload Cover Image ──────────────────────────────────────
    app.post('/:id/upload-cover', async (request) => {
        const { id } = request.params as { id: string };
        const data = await (request as any).file();

        if (!data) {
            const e = new Error('No file uploaded');
            (e as any).statusCode = 400;
            throw e;
        }

        const article = await prisma.article.findUnique({ where: { id } });
        if (!article) {
            const e = new Error('Article not found');
            (e as any).statusCode = 404;
            throw e;
        }

        // Save to public/covers/
        const coversDir = join(process.cwd(), 'public', 'covers');
        await mkdir(coversDir, { recursive: true });

        const ext = data.filename.split('.').pop() || 'webp';
        const filename = `${article.slug}.${ext}`;
        const filepath = join(coversDir, filename);

        const buf = await data.toBuffer();
        await writeFile(filepath, buf);

        const coverUrl = `/covers/${filename}`;
        await prisma.article.update({
            where: { id },
            data: { coverImage: coverUrl },
        });

        return { coverImage: coverUrl, filename };
    });
}
