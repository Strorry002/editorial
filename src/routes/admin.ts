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

    // ── Social Distribution Cards ─────────────────────────────────
    app.get('/social-cards', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };

        const cards = await prisma.articleDistribution.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                article: {
                    select: { id: true, title: true, slug: true, coverImage: true, author: true, status: true },
                },
            },
        });

        return { data: cards };
    });

    app.patch('/social-cards/:id', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { id } = request.params as { id: string };
        const { status, metadata } = request.body as { status?: string; metadata?: any };

        const data: any = {};
        if (status) data.status = status;
        if (metadata) data.metadata = metadata;
        if (status === 'sent') data.sentAt = new Date();

        const card = await prisma.articleDistribution.update({
            where: { id },
            data,
        });
        return { data: card };
    });

    // ── Feature Autopilot: Manual Trigger ────────────────────────
    app.post('/feature-autopilot/run', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { runFeatureAutopilot } = await import('../services/autopilot.js');
        const result = await runFeatureAutopilot();
        return { data: result };
    });

    // ── Weekly Digest: Manual Trigger ────────────────────────────
    app.post('/weekly-digest/run', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { runWeeklyDigest } = await import('../services/autopilot.js');
        const result = await runWeeklyDigest();
        return { data: result };
    });

    // ── Statistical Data Service ─────────────────────────────────
    app.post('/sds/run', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { engines, maxCities } = (request.body as any) || {};
        const { runStatisticalDataService } = await import('../services/stats-data-service.js');
        const result = await runStatisticalDataService({ engines, maxCities: maxCities || 10 });
        return { data: result };
    });

    app.post('/sds/engine/:name', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { name } = request.params as { name: string };
        const { maxCities } = (request.body as any) || {};
        const sds = await import('../services/stats-data-service.js');

        const engineMap: Record<string, Function> = {
            cost: sds.runCostOfLivingEngine,
            housing: sds.runHousingEngine,
            climate: sds.runClimateEngine,
            infra: sds.runInfrastructureEngine,
            safety: sds.runSafetyEngine,
            env: sds.runEnvironmentEngine,
            health: sds.runHealthcareEngine,
            lifestyle: sds.runLifestyleEngine,
            score: sds.calculateNomadScores,
        };

        const fn = engineMap[name];
        if (!fn) return reply.status(400).send({ error: `Unknown engine: ${name}` });

        // Limit cities for engine runs
        let cityIds: string[] | undefined;
        if (maxCities && name !== 'score') {
            const allCities = await prisma.city.findMany({ select: { id: true } });
            cityIds = allCities.sort(() => Math.random() - 0.5).slice(0, maxCities).map(c => c.id);
        }

        const result = await fn(cityIds);
        return { data: result };
    });

    // ── City data API (internal) ─────────────────────────────────
    app.get('/cities', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const cities = await prisma.city.findMany({
            orderBy: { nomadScore: 'desc' },
            include: { country: { select: { name: true, flag: true, currency: true } } },
        });
        return { data: cities };
    });

    app.get('/cities/:slug', async (request, reply) => {
        if (!requireAdmin(request, reply)) return { error: 'Forbidden' };
        const { slug } = request.params as { slug: string };
        const period = (() => { const now = new Date(); const q = Math.ceil((now.getMonth() + 1) / 3); return `${now.getFullYear()}-Q${q}`; })();
        const city = await prisma.city.findUnique({
            where: { slug },
            include: {
                country: true,
                prices: { where: { period } },
                housing: { where: { period } },
                climate: true,
                infrastructure: { where: { period } },
                safety: { where: { period } },
                environment: { where: { period } },
                healthcare: { where: { period } },
                lifestyle: { where: { period } },
                scores: { where: { period } },
            },
        });
        if (!city) return reply.status(404).send({ error: 'City not found' });
        return { data: city };
    });
}
