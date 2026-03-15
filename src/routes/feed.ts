import { FastifyInstance } from 'fastify';

export async function feedRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // GET /api/v1/feed/updates — change feed (for Telegram, RSS, etc.)
    app.get('/feed/updates', async (request) => {
        const { since, category, country, limit } = request.query as {
            since?: string;
            category?: string;
            country?: string;
            limit?: string;
        };

        const where: any = {};
        if (since) where.publishedAt = { gte: new Date(since) };
        if (category) where.category = category;
        if (country) where.countryCode = country.toUpperCase();

        const updates = await prisma.legalUpdate.findMany({
            where,
            orderBy: { publishedAt: 'desc' },
            take: parseInt(limit || '50'),
            include: {
                country: {
                    select: { name: true, flag: true }
                }
            }
        });

        return {
            data: updates,
            total: updates.length,
            since: since || null,
        };
    });
}
