import { FastifyInstance } from 'fastify';

export async function adminRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // GET /api/v1/admin/overview — dashboard overview
    app.get('/overview', async () => {
        const [countries, visas, labor, costs, stats, updates, sources, logs] = await Promise.all([
            prisma.country.count(),
            prisma.visaProgram.count(),
            prisma.laborRegulation.count(),
            prisma.costOfLiving.count(),
            prisma.statistic.count(),
            prisma.legalUpdate.count(),
            prisma.dataSource.count(),
            prisma.collectionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 1 }),
        ]);

        return {
            counts: { countries, visas, labor, costs, stats, updates, sources },
            lastSync: logs[0]?.createdAt || null,
        };
    });

    // GET /api/v1/admin/sources — data source status
    app.get('/sources', async () => {
        const sources = await prisma.dataSource.findMany({ orderBy: { name: 'asc' } });
        return { data: sources };
    });

    // GET /api/v1/admin/logs — collection logs
    app.get('/logs', async (request) => {
        const { source, status, limit } = request.query as {
            source?: string;
            status?: string;
            limit?: string;
        };

        const where: any = {};
        if (source) where.sourceName = source;
        if (status) where.status = status;

        const logs = await prisma.collectionLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit || '50'),
        });

        return { data: logs, total: logs.length };
    });
}
