import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { extractUser } from './auth.js';

const prisma = new PrismaClient();

function requireAdmin(request: any, reply: any) {
    const user = extractUser(request);
    if (!user || user.role !== 'admin') {
        reply.status(403);
        return null;
    }
    return user;
}

export async function adminRoutes(app: FastifyInstance) {
    // ── All Users ──
    app.get('/users', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                isActive: true,
                avatarUrl: true,
                telegramHandle: true,
                createdAt: true,
                lastLoginAt: true,
                _count: { select: { comments: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return { data: users, total: users.length };
    });

    // ── Update User (role, active, telegram) ──
    app.patch('/users/:id', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const { id } = request.params as { id: string };
        const { role, isActive, telegramHandle } = request.body as {
            role?: string;
            isActive?: boolean;
            telegramHandle?: string;
        };

        const data: any = {};
        if (role) data.role = role;
        if (typeof isActive === 'boolean') data.isActive = isActive;
        if (telegramHandle !== undefined) data.telegramHandle = telegramHandle;

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, email: true, displayName: true, role: true, isActive: true, telegramHandle: true },
        });

        return { data: user };
    });

    // ── All Subscribers ──
    app.get('/subscribers', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const subs = await prisma.subscriber.findMany({
            orderBy: { subscribedAt: 'desc' },
        });

        return { data: subs, total: subs.length };
    });

    // ── Update Subscriber (topics, active) ──
    app.patch('/subscribers/:id', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const { id } = request.params as { id: string };
        const { topics, active, lang } = request.body as {
            topics?: string[];
            active?: boolean;
            lang?: string;
        };

        const data: any = {};
        if (topics) data.topics = topics;
        if (typeof active === 'boolean') data.active = active;
        if (lang) data.lang = lang;

        const sub = await prisma.subscriber.update({
            where: { id },
            data,
        });

        return { data: sub };
    });

    // ── Dashboard Stats ──
    app.get('/stats', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const [userCount, subscriberCount, articleCount, commentCount, visaCount] = await Promise.all([
            prisma.user.count(),
            prisma.subscriber.count(),
            prisma.article.count(),
            prisma.comment.count(),
            prisma.visaProgram.count({ where: { isActive: true } }),
        ]);

        const recentUsers = await prisma.user.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            select: { id: true, displayName: true, email: true, createdAt: true },
        });

        return {
            data: {
                users: userCount,
                subscribers: subscriberCount,
                articles: articleCount,
                comments: commentCount,
                visaPrograms: visaCount,
                recentUsers,
            },
        };
    });

    // ── Article Pipeline Stats ──
    app.get('/article-stats', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const statuses = ['idea', 'outline', 'draft', 'review', 'approved', 'published', 'archived'];
        const counts: Record<string, number> = {};
        for (const s of statuses) {
            counts[s] = await prisma.article.count({ where: { status: s } });
        }
        const recent = await prisma.article.findMany({
            take: 10,
            orderBy: { updatedAt: 'desc' },
            select: { id: true, title: true, status: true, author: true, agentId: true, updatedAt: true },
        });
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        return { data: { pipeline: counts, total, recent } };
    });

    // ── Autopilot: Manual Trigger ──
    app.post('/autopilot/run', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const { runAutopilot } = await import('../services/autopilot.js');
        const body = (request.body || {}) as { hoursBack?: number; autoDraft?: boolean };
        const result = await runAutopilot({ hoursBack: body.hoursBack || 48, autoDraft: body.autoDraft !== false });
        return { data: result };
    });

    // ── Chief Editor: Manual Trigger ──
    app.post('/chief-editor/run', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const { runChiefEditor } = await import('../services/autopilot.js');
        const result = await runChiefEditor();
        return { data: result };
    });

    // ── Data Sources Status ──
    app.get('/data-sources', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const sources = await prisma.dataSource.findMany({
            orderBy: { name: 'asc' },
        });
        const totalUpdates = await prisma.legalUpdate.count();
        return { data: { sources, totalUpdates } };
    });

    // ── Channel Prompts Management ──────────────────────────────
    app.get('/channel-prompts', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { getAllChannelPrompts } = await import('../services/social-adapter.js');
        return { data: getAllChannelPrompts() };
    });

    app.patch('/channel-prompts/:channel', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { channel } = request.params as { channel: string };
        const { prompt } = request.body as { prompt: string };
        const { setChannelPrompt } = await import('../services/social-adapter.js');
        await setChannelPrompt(channel as any, prompt);
        return { success: true, channel };
    });

    app.delete('/channel-prompts/:channel', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { channel } = request.params as { channel: string };
        const { resetChannelPrompt } = await import('../services/social-adapter.js');
        await resetChannelPrompt(channel as any);
        return { success: true, channel, reset: true };
    });

    // ── Pipeline Stats ──────────────────────────────────────────
    app.get('/pipeline-stats', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const articleStatuses = ['idea', 'outline', 'draft', 'review', 'approved', 'published', 'archived'];
        const articleCounts: Record<string, number> = {};
        for (const s of articleStatuses) {
            articleCounts[s] = await prisma.article.count({ where: { status: s } });
        }

        const updateStatuses = ['raw', 'draft', 'review', 'approved', 'published', 'archived'];
        const updateCounts: Record<string, number> = {};
        for (const s of updateStatuses) {
            updateCounts[s] = await prisma.legalUpdate.count({ where: { workflowStatus: s } });
        }

        const totalUpdates = await prisma.legalUpdate.count();
        const totalArticles = await prisma.article.count();
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const newUpdates24h = await prisma.legalUpdate.count({ where: { createdAt: { gte: last24h } } });
        const newArticles24h = await prisma.article.count({ where: { createdAt: { gte: last24h } } });

        return {
            data: {
                articles: articleCounts,
                updates: updateCounts,
                totals: { totalUpdates, totalArticles, newUpdates24h, newArticles24h },
            },
        };
    });

    // ── Collection Logs ─────────────────────────────────────────
    app.get('/collection-logs', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { limit = '50' } = request.query as { limit?: string };

        const logs = await prisma.collectionLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: Math.min(parseInt(limit), 200),
        });
        return { data: logs };
    });

    // ── Run Collectors Manually ─────────────────────────────────
    app.post('/run-collectors', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const { runAllCollectors } = await import('../collectors/scheduler.js');
        // Run in background, don't block
        runAllCollectors().catch((err: any) => console.error('Manual collection error:', err.message));
        return { data: { message: 'Collection started in background' } };
    });

    // ── Tools Stats ─────────────────────────────────────────────
    app.get('/tools-stats', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const [visaPrograms, countries, costOfLiving, statistics, subscribers, dataSources] = await Promise.all([
            prisma.visaProgram.count({ where: { isActive: true } }),
            prisma.country.count(),
            prisma.costOfLiving.count(),
            prisma.statistic.count(),
            prisma.subscriber.count({ where: { active: true } }),
            prisma.dataSource.count({ where: { isActive: true } }),
        ]);

        const visaByType = await prisma.visaProgram.groupBy({
            by: ['type'],
            where: { isActive: true },
            _count: true,
        });

        return {
            data: {
                visaPrograms, countries, costOfLiving, statistics, subscribers, dataSources,
                visaByType: visaByType.map(v => ({ type: v.type, count: v._count })),
            },
        };
    });
}
