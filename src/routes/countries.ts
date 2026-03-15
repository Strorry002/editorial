import { FastifyInstance } from 'fastify';

export async function countriesRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // GET /api/v1/countries — list all countries
    app.get('/countries', async (request, reply) => {
        const { region } = request.query as { region?: string };
        const where = region ? { region } : {};
        const countries = await prisma.country.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                code: true,
                name: true,
                region: true,
                flag: true,
                currency: true,
                capitalCity: true,
                _count: {
                    select: {
                        visaPrograms: true,
                        laborRegulations: true,
                        legalUpdates: true,
                    }
                }
            }
        });
        return { data: countries, total: countries.length };
    });

    // GET /api/v1/countries/:code — full country profile
    app.get('/countries/:code', async (request, reply) => {
        const { code } = request.params as { code: string };
        const country = await prisma.country.findUnique({
            where: { code: code.toUpperCase() },
            include: {
                visaPrograms: { where: { isActive: true }, orderBy: { type: 'asc' } },
                laborRegulations: { orderBy: { category: 'asc' } },
                costOfLiving: { orderBy: { period: 'desc' }, take: 5 },
                statistics: { orderBy: { period: 'desc' }, take: 20 },
                legalUpdates: { orderBy: { publishedAt: 'desc' }, take: 10 },
            }
        });
        if (!country) return reply.status(404).send({ error: 'Country not found' });
        return { data: country };
    });

    // GET /api/v1/countries/:code/visas — visa programs
    app.get('/countries/:code/visas', async (request, reply) => {
        const { code } = request.params as { code: string };
        const { type } = request.query as { type?: string };
        const where: any = { countryCode: code.toUpperCase(), isActive: true };
        if (type) where.type = type;
        const visas = await prisma.visaProgram.findMany({ where, orderBy: { type: 'asc' } });
        return { data: visas, total: visas.length };
    });

    // GET /api/v1/countries/:code/labor — labor regulations
    app.get('/countries/:code/labor', async (request, reply) => {
        const { code } = request.params as { code: string };
        const { category } = request.query as { category?: string };
        const where: any = { countryCode: code.toUpperCase() };
        if (category) where.category = category;
        const regs = await prisma.laborRegulation.findMany({ where, orderBy: { category: 'asc' } });
        return { data: regs, total: regs.length };
    });

    // GET /api/v1/countries/:code/cost — cost of living
    app.get('/countries/:code/cost', async (request, reply) => {
        const { code } = request.params as { code: string };
        const { city } = request.query as { city?: string };
        const where: any = { countryCode: code.toUpperCase() };
        if (city) where.city = city;
        const costs = await prisma.costOfLiving.findMany({
            where, orderBy: { period: 'desc' }, take: 10
        });
        return { data: costs, total: costs.length };
    });

    // GET /api/v1/countries/:code/stats — statistics
    app.get('/countries/:code/stats', async (request, reply) => {
        const { code } = request.params as { code: string };
        const { category } = request.query as { category?: string };
        const where: any = { countryCode: code.toUpperCase() };
        if (category) where.category = category;
        const stats = await prisma.statistic.findMany({
            where, orderBy: [{ category: 'asc' }, { period: 'desc' }]
        });
        return { data: stats, total: stats.length };
    });

    // GET /api/v1/countries/:code/updates — legal updates
    app.get('/countries/:code/updates', async (request, reply) => {
        const { code } = request.params as { code: string };
        const { category, limit } = request.query as { category?: string; limit?: string };
        const where: any = { countryCode: code.toUpperCase() };
        if (category) where.category = category;
        const updates = await prisma.legalUpdate.findMany({
            where,
            orderBy: { publishedAt: 'desc' },
            take: parseInt(limit || '20')
        });
        return { data: updates, total: updates.length };
    });

    // GET /api/v1/compare?countries=US,CA — side-by-side comparison
    app.get('/compare', async (request, reply) => {
        const { countries: countriesParam } = request.query as { countries?: string };
        if (!countriesParam) return reply.status(400).send({ error: 'countries param required (e.g. US,CA)' });

        const codes = countriesParam.split(',').map(c => c.trim().toUpperCase());
        if (codes.length < 2) return reply.status(400).send({ error: 'At least 2 countries required' });

        const result = await Promise.all(codes.map(async (code) => {
            const country = await prisma.country.findUnique({
                where: { code },
                include: {
                    visaPrograms: { where: { isActive: true } },
                    laborRegulations: true,
                    costOfLiving: { orderBy: { period: 'desc' }, take: 1 },
                    statistics: { orderBy: { period: 'desc' }, take: 10 },
                }
            });
            return country;
        }));

        return { data: result.filter(Boolean) };
    });
}
