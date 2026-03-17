import { FastifyInstance } from 'fastify';
import { generateAgentAvatar } from '../services/ai.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function agentsRoutes(app: FastifyInstance) {
    const { prisma } = app;

    // List all agents
    app.get('/', async () => {
        return prisma.agent.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
            include: { _count: { select: { articles: true } } },
        });
    });

    // Get single agent
    app.get('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const agent = await prisma.agent.findUnique({
            where: { id },
            include: { _count: { select: { articles: true } } },
        });
        if (!agent) {
            const e = new Error('Agent not found');
            (e as any).statusCode = 404;
            throw e;
        }
        return agent;
    });

    // Create agent
    app.post('/', async (request) => {
        const body = request.body as any;
        return prisma.agent.create({
            data: {
                name: body.name,
                displayName: body.displayName || body.name,
                avatar: body.avatar || '📝',
                role: body.role || 'journalist',
                basePrompt: body.basePrompt || 'You are a professional journalist.',
                stylePrompt: body.stylePrompt || '',
                formatting: body.formatting || {},
            },
        });
    });

    // Update agent
    app.patch('/:id', async (request) => {
        const { id } = request.params as { id: string };
        const body = request.body as any;
        const data: any = {};
        for (const key of ['name', 'displayName', 'avatar', 'role', 'basePrompt', 'stylePrompt', 'formatting', 'isActive']) {
            if (body[key] !== undefined) data[key] = body[key];
        }
        return prisma.agent.update({ where: { id }, data });
    });

    // Delete agent (soft)
    app.delete('/:id', async (request) => {
        const { id } = request.params as { id: string };
        return prisma.agent.update({ where: { id }, data: { isActive: false } });
    });

    // Generate avatar for agent using xAI grok-2-image
    app.post('/:id/generate-avatar', async (request) => {
        const { id } = request.params as { id: string };
        const body = (request.body || {}) as { description?: string };

        const agent = await prisma.agent.findUnique({ where: { id } });
        if (!agent) throw Object.assign(new Error('Agent not found'), { statusCode: 404 });

        const description = body.description || `a ${agent.role} named ${agent.displayName}`;
        const imageUrl = await generateAgentAvatar(description);

        // Download and save locally
        const avatarsDir = join(process.cwd(), 'public', 'avatars');
        await mkdir(avatarsDir, { recursive: true });

        const filename = `agent-${agent.name}.webp`;
        const filepath = join(avatarsDir, filename);

        try {
            const imgRes = await fetch(imageUrl);
            const buf = Buffer.from(await imgRes.arrayBuffer());
            await writeFile(filepath, buf);
        } catch {
            // Fallback: save URL directly
            await prisma.agent.update({ where: { id }, data: { avatar: imageUrl } });
            return { avatar: imageUrl, warning: 'Could not save locally' };
        }

        const avatarPath = `/avatars/${filename}`;
        await prisma.agent.update({ where: { id }, data: { avatar: avatarPath } });
        return { avatar: avatarPath };
    });

    // Upload avatar manually
    app.post('/:id/upload-avatar', async (request) => {
        const { id } = request.params as { id: string };
        const data = await (request as any).file();
        if (!data) throw Object.assign(new Error('No file'), { statusCode: 400 });

        const agent = await prisma.agent.findUnique({ where: { id } });
        if (!agent) throw Object.assign(new Error('Agent not found'), { statusCode: 404 });

        const avatarsDir = join(process.cwd(), 'public', 'avatars');
        await mkdir(avatarsDir, { recursive: true });

        const ext = data.filename.split('.').pop() || 'webp';
        const filename = `agent-${agent.name}.${ext}`;
        const filepath = join(avatarsDir, filename);

        const buf = await data.toBuffer();
        await writeFile(filepath, buf);

        const avatarPath = `/avatars/${filename}`;
        await prisma.agent.update({ where: { id }, data: { avatar: avatarPath } });
        return { avatar: avatarPath };
    });

    // Seed editorial team agents (10 agents with AI-generated avatars)
    // SINGLE SOURCE OF TRUTH: editorial-team.ts AGENTS array
    app.post('/seed', async () => {
        const { seedAgents, AGENTS } = await import('../services/editorial-team.js');
        await seedAgents();
        const agents = await prisma.agent.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'asc' },
        });
        return { created: agents.length, agents };
    });

    // Generate avatars for all agents (batch)
    // Uses descriptions from editorial-team.ts AGENTS array
    app.post('/generate-all-avatars', async () => {
        const { AGENTS } = await import('../services/editorial-team.js');
        const agents = await prisma.agent.findMany({ where: { isActive: true } });

        // Build lookup from canonical AGENTS definitions
        const avatarDescriptions: Record<string, string> = {};
        for (const def of AGENTS) {
            avatarDescriptions[def.name] = def.avatarDesc;
        }

        const results = [];
        for (const agent of agents) {
            const desc = avatarDescriptions[agent.name] || `a professional ${agent.role} named ${agent.displayName}`;
            try {
                const imageUrl = await generateAgentAvatar(desc);
                const avatarsDir = join(process.cwd(), 'public', 'avatars');
                await mkdir(avatarsDir, { recursive: true });

                const filename = `agent-${agent.name}.webp`;
                const filepath = join(avatarsDir, filename);

                const imgRes = await fetch(imageUrl);
                const buf = Buffer.from(await imgRes.arrayBuffer());
                await writeFile(filepath, buf);

                const avatarPath = `/avatars/${filename}`;
                await prisma.agent.update({ where: { id: agent.id }, data: { avatar: avatarPath } });
                results.push({ name: agent.name, avatar: avatarPath, status: 'ok' });
            } catch (err: any) {
                results.push({ name: agent.name, status: 'error', error: err.message });
            }
        }
        return { generated: results.filter(r => r.status === 'ok').length, results };
    });
}
