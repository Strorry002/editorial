import { FastifyInstance } from 'fastify';

export async function publicationsRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // ── Kanban View ────────────────────────────────────────────
    // GET /api/v1/publications/kanban — grouped by workflowStatus
    app.get('/kanban', async () => {
        const statuses = ['raw', 'draft', 'review', 'approved', 'published', 'archived'];
        const result: Record<string, any[]> = {};

        for (const status of statuses) {
            result[status] = await prisma.legalUpdate.findMany({
                where: { workflowStatus: status },
                orderBy: { createdAt: 'desc' },
                take: status === 'raw' ? 30 : 50,
                include: {
                    country: { select: { name: true, flag: true } },
                    distributions: { select: { channel: true, status: true } },
                    _count: {
                        select: {
                            relationsFrom: true,
                            relationsTo: true,
                        },
                    },
                },
            });
        }

        return result;
    });

    // ── List with filters ──────────────────────────────────────
    // GET /api/v1/publications?status=draft&country=US&limit=50
    app.get('/', async (request) => {
        const { status, country, category, assignedTo, limit } = request.query as {
            status?: string;
            country?: string;
            category?: string;
            assignedTo?: string;
            limit?: string;
        };

        const where: any = {};
        if (status) where.workflowStatus = status;
        if (country) where.countryCode = country.toUpperCase();
        if (category) where.category = category;
        if (assignedTo) where.assignedTo = assignedTo;

        const data = await prisma.legalUpdate.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit || '100'),
            include: {
                country: { select: { name: true, flag: true } },
                distributions: { select: { id: true, channel: true, status: true, sentAt: true, externalUrl: true, clicks: true } },
                _count: { select: { relationsFrom: true, relationsTo: true } },
            },
        });

        return { data, total: data.length };
    });

    // ── Update workflow status ─────────────────────────────────
    // PATCH /api/v1/publications/:id/status
    app.patch('/:id/status', async (request) => {
        const { id } = request.params as { id: string };
        const { status, assignedTo, reviewNote } = request.body as {
            status?: string;
            assignedTo?: string;
            reviewNote?: string;
        };

        const validStatuses = ['raw', 'draft', 'review', 'approved', 'published', 'archived'];
        if (status && !validStatuses.includes(status)) {
            const e = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
            (e as any).statusCode = 400;
            throw e;
        }

        const data: any = {};
        if (status) data.workflowStatus = status;
        if (assignedTo !== undefined) data.assignedTo = assignedTo || null;
        if (reviewNote !== undefined) data.reviewNote = reviewNote || null;

        const updated = await prisma.legalUpdate.update({
            where: { id },
            data,
            include: {
                country: { select: { name: true, flag: true } },
                distributions: true,
            },
        });

        return updated;
    });

    // ── Update published content ───────────────────────────────
    // PATCH /api/v1/publications/:id/content
    app.patch('/:id/content', async (request) => {
        const { id } = request.params as { id: string };
        const { publishedContent } = request.body as { publishedContent: string };

        const updated = await prisma.legalUpdate.update({
            where: { id },
            data: { publishedContent },
        });

        return updated;
    });

    // ── Relations ──────────────────────────────────────────────

    // GET /api/v1/publications/:id/relations
    app.get('/:id/relations', async (request) => {
        const { id } = request.params as { id: string };

        const [from, to] = await Promise.all([
            prisma.updateRelation.findMany({
                where: { fromId: id },
                include: {
                    toUpdate: {
                        select: { id: true, title: true, countryCode: true, category: true, impactLevel: true, workflowStatus: true },
                    },
                },
            }),
            prisma.updateRelation.findMany({
                where: { toId: id },
                include: {
                    fromUpdate: {
                        select: { id: true, title: true, countryCode: true, category: true, impactLevel: true, workflowStatus: true },
                    },
                },
            }),
        ]);

        return {
            outgoing: from.map((r: any) => ({
                relationId: r.id,
                relationType: r.relationType,
                confidence: r.confidence,
                note: r.note,
                update: r.toUpdate,
            })),
            incoming: to.map((r: any) => ({
                relationId: r.id,
                relationType: r.relationType === 'causes' ? 'caused_by' : r.relationType,
                confidence: r.confidence,
                note: r.note,
                update: r.fromUpdate,
            })),
        };
    });

    // POST /api/v1/publications/:id/relations
    app.post('/:id/relations', async (request) => {
        const { id } = request.params as { id: string };
        const { toId, relationType, note } = request.body as {
            toId: string;
            relationType: string;
            note?: string;
        };

        const validTypes = ['related', 'causes', 'caused_by', 'supersedes', 'part_of_series'];
        if (!validTypes.includes(relationType)) {
            const e = new Error(`Invalid relation type. Must be one of: ${validTypes.join(', ')}`);
            (e as any).statusCode = 400;
            throw e;
        }

        // For "caused_by", swap direction and store as "causes"
        const fromId = relationType === 'caused_by' ? toId : id;
        const actualToId = relationType === 'caused_by' ? id : toId;
        const storedType = relationType === 'caused_by' ? 'causes' : relationType;

        const relation = await prisma.updateRelation.create({
            data: {
                fromId,
                toId: actualToId,
                relationType: storedType,
                note: note || null,
            },
        });

        return relation;
    });

    // DELETE /api/v1/publications/:id/relations/:relId
    app.delete('/:id/relations/:relId', async (request) => {
        const { relId } = request.params as { id: string; relId: string };

        await prisma.updateRelation.delete({ where: { id: relId } });
        return { success: true };
    });

    // ── Search (for linking) ───────────────────────────────────
    // GET /api/v1/publications/search?q=visa&exclude=<id>
    app.get('/search', async (request) => {
        const { q, exclude } = request.query as { q?: string; exclude?: string };

        if (!q || q.length < 2) return { data: [] };

        const data = await prisma.legalUpdate.findMany({
            where: {
                title: { contains: q, mode: 'insensitive' },
                ...(exclude ? { id: { not: exclude } } : {}),
            },
            take: 10,
            select: {
                id: true,
                title: true,
                countryCode: true,
                category: true,
                impactLevel: true,
                workflowStatus: true,
                country: { select: { flag: true } },
            },
        });

        return { data };
    });

    // ── Distributions ──────────────────────────────────────────

    // GET /api/v1/publications/:id/distributions
    app.get('/:id/distributions', async (request) => {
        const { id } = request.params as { id: string };

        const distributions = await prisma.distribution.findMany({
            where: { updateId: id },
            orderBy: { createdAt: 'desc' },
        });

        return { data: distributions };
    });

    // POST /api/v1/publications/:id/distribute
    app.post('/:id/distribute', async (request) => {
        const { id } = request.params as { id: string };
        const { channels } = request.body as { channels: string[] };

        const validChannels = ['telegram', 'twitter', 'instagram', 'linkedin', 'website'];
        const results = [];

        for (const channel of channels) {
            if (!validChannels.includes(channel)) continue;

            // Upsert — don't create duplicate
            const existing = await prisma.distribution.findUnique({
                where: { updateId_channel: { updateId: id, channel } },
            });

            if (existing) {
                results.push(existing);
                continue;
            }

            const dist = await prisma.distribution.create({
                data: {
                    updateId: id,
                    channel,
                    status: 'pending',
                },
            });
            results.push(dist);
        }

        return { data: results };
    });

    // PATCH /api/v1/publications/distributions/:distId
    app.patch('/distributions/:distId', async (request) => {
        const { distId } = request.params as { distId: string };
        const body = request.body as {
            status?: string;
            externalId?: string;
            externalUrl?: string;
            errorMessage?: string;
        };

        const data: any = {};
        if (body.status) {
            data.status = body.status;
            if (body.status === 'sent') data.sentAt = new Date();
        }
        if (body.externalId) data.externalId = body.externalId;
        if (body.externalUrl) data.externalUrl = body.externalUrl;
        if (body.errorMessage !== undefined) data.errorMessage = body.errorMessage || null;

        const updated = await prisma.distribution.update({
            where: { id: distId },
            data,
        });

        return updated;
    });
}
