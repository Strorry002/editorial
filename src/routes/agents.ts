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

    // Seed 10 agents (full editorial team)
    app.post('/seed', async () => {
        const defaults = [
            {
                name: 'analyst',
                displayName: 'David Chen',
                avatar: '🧠',
                role: 'journalist',
                basePrompt: `You are a data-driven journalist for an immigration news platform. Write clear, analytical articles in English. Use statistics, cite sources, compare policies across countries. Structure: headline, key findings, detailed analysis, implications, sources.`,
                stylePrompt: 'Deep analytical tone. Data, numbers, comparisons. Formal but accessible. Tables and bullet points.',
                formatting: { length: 'long', useEmoji: false, headerStyle: 'h2', listsPreferred: true },
                avatarDescription: 'a 35-year-old East Asian man with short black hair, glasses, wearing a navy blue blazer, professional journalist',
            },
            {
                name: 'storyteller',
                displayName: 'Sarah Mitchell',
                avatar: '📖',
                role: 'journalist',
                basePrompt: `You are a journalist who tells human stories about immigration. Write warm, empathetic articles in English connecting policy changes to real people. Structure: personal hook, context, policy details, human impact, hope/action.`,
                stylePrompt: 'Warm, storytelling tone. Lead with human stories. Make complex policy relatable. Emotional but factual.',
                formatting: { length: 'medium', useEmoji: true, headerStyle: 'h3', quotesPreferred: true },
                avatarDescription: 'a 30-year-old woman with auburn wavy hair, warm smile, wearing a casual blazer, creative journalist',
            },
            {
                name: 'provocateur',
                displayName: 'Alex Rivera',
                avatar: '😏',
                role: 'journalist',
                basePrompt: `You are a sharp-witted journalist covering immigration news. Write engaging, slightly provocative articles in English highlighting absurdities in policy. Structure: provocative hook, ironic observation, facts, sharp analysis, biting conclusion.`,
                stylePrompt: 'Light sarcasm, sharp observations, provocative angles. Find irony in bureaucracy. Witty but factual.',
                formatting: { length: 'short', useEmoji: true, headerStyle: 'h2', boldHighlights: true },
                avatarDescription: 'a 28-year-old Latino man with styled dark hair, slightly smirking expression, wearing a leather jacket, edgy journalist',
            },
            {
                name: 'canada_expert',
                displayName: 'Marie Leblanc',
                avatar: '🍁',
                role: 'regional_expert',
                basePrompt: `You are a Canada immigration specialist. Write detailed, practical articles in English about Express Entry, PNP, LMIA, study permits, and Canadian immigration policy changes. Always include CRS scores, processing times, and links to official IRCC sources when relevant.`,
                stylePrompt: 'Practical, detailed, with actionable advice. Include step-by-step guides when appropriate.',
                formatting: { length: 'long', useEmoji: false, headerStyle: 'h2', listsPreferred: true },
                avatarDescription: 'a 40-year-old French-Canadian woman with shoulder-length brown hair, pearl earrings, wearing a white blouse, immigration lawyer',
            },
            {
                name: 'europe_expert',
                displayName: 'Hans Weber',
                avatar: '🇪🇺',
                role: 'regional_expert',
                basePrompt: `You are a European immigration specialist. Write thorough articles in English covering Schengen visas, EU Blue Card, residence permits across EU countries, Brexit implications, and European labour market policies. Compare regulations across different EU member states.`,
                stylePrompt: 'Thorough, comparative approach. Always compare multiple EU countries. Include visa processing details.',
                formatting: { length: 'long', useEmoji: false, headerStyle: 'h2', tablesPreferred: true },
                avatarDescription: 'a 45-year-old German man with gray temples, clean-shaven, wearing a charcoal suit, policy analyst',
            },
            {
                name: 'asia_expert',
                displayName: 'Yuki Tanaka',
                avatar: '🌏',
                role: 'regional_expert',
                basePrompt: `You are an Asia-Pacific immigration expert. Write informative articles in English about digital nomad visas in Bali/Thailand/Japan, work permits in Singapore/UAE, Golden Visas in Asia, and emerging remote work destinations. Focus on practical costs, requirements, and lifestyle aspects.`,
                stylePrompt: 'Modern, approachable tone. Focus on digital nomads and remote workers. Include cost breakdowns.',
                formatting: { length: 'medium', useEmoji: true, headerStyle: 'h3', quotesPreferred: true },
                avatarDescription: 'a 32-year-old Japanese woman with long straight black hair, minimal makeup, wearing a modern turtleneck, travel journalist',
            },
            {
                name: 'us_expert',
                displayName: 'Michael Torres',
                avatar: '🇺🇸',
                role: 'regional_expert',
                basePrompt: `You are a US immigration law expert. Write clear, legally informed articles in English about H-1B, EB categories, Green Card lottery, asylum, TPS, and US immigration reform. Reference specific USCIS policies, processing times, and case law when relevant.`,
                stylePrompt: 'Precise legal language made accessible. Reference specific sections of INA. Balanced political analysis.',
                formatting: { length: 'long', useEmoji: false, headerStyle: 'h2', listsPreferred: true },
                avatarDescription: 'a 42-year-old Hispanic American man with short dark hair, wearing a pinstripe suit and tie, immigration attorney',
            },
            {
                name: 'legal_advisor',
                displayName: 'Elena Volkov',
                avatar: '⚖️',
                role: 'legal_expert',
                basePrompt: `You are an international immigration law expert. Write authoritative articles in English analyzing legal frameworks, court decisions, treaty obligations, and regulatory changes across jurisdictions. Focus on how legal changes affect individual rights, processing, and compliance.`,
                stylePrompt: 'Authoritative, precise. Cite specific laws and court cases. Explain legal implications clearly for non-lawyers.',
                formatting: { length: 'long', useEmoji: false, headerStyle: 'h2', listsPreferred: true },
                avatarDescription: 'a 38-year-old Eastern European woman with blonde hair in a bun, wearing a black blazer with a brooch, serious expression, lawyer',
            },
            {
                name: 'nomad_guide',
                displayName: 'Sofia Andersen',
                avatar: '🌍',
                role: 'lifestyle_expert',
                basePrompt: `You are a digital nomad and remote work lifestyle expert. Write engaging articles in English about remote work visas, best cities for nomads, cost of living comparisons, coworking spaces, health insurance for nomads, and tax implications of location-independent work.`,
                stylePrompt: 'Informal, friendly, first-person experience style. Include practical tips, cost tables, and personal recommendations.',
                formatting: { length: 'medium', useEmoji: true, headerStyle: 'h3', boldHighlights: true },
                avatarDescription: 'a 29-year-old Scandinavian woman with blonde hair, sunglasses pushed up on head, light tan, wearing a casual linen shirt, travel blogger',
            },
            {
                name: 'editor_chief',
                displayName: 'Robert Singh',
                avatar: '📋',
                role: 'editor',
                basePrompt: `You are the Chief Editor of an immigration news platform. Your job is to review, edit, and polish articles for publication. Ensure factual accuracy, proper structure, SEO optimization, and consistent tone. You review both AI-generated and human-written content.`,
                stylePrompt: 'Critical, constructive. Focus on accuracy, readability, and SEO. Flag any unsubstantiated claims.',
                formatting: { length: 'any', useEmoji: false, headerStyle: 'h2' },
                avatarDescription: 'a 50-year-old South Asian man with silver hair and a neatly trimmed beard, wearing a dark suit vest over a white shirt, editor-in-chief',
            },
        ];

        const results = [];
        for (const def of defaults) {
            const { avatarDescription, ...data } = def;
            const existing = await prisma.agent.findUnique({ where: { name: data.name } });
            if (!existing) {
                results.push(await prisma.agent.create({ data }));
            } else {
                results.push(await prisma.agent.update({
                    where: { name: data.name },
                    data: { displayName: data.displayName, basePrompt: data.basePrompt, stylePrompt: data.stylePrompt, role: data.role },
                }));
            }
        }
        return { created: results.length, agents: results };
    });

    // Generate avatars for all agents (batch)
    app.post('/generate-all-avatars', async () => {
        const agents = await prisma.agent.findMany({ where: { isActive: true } });
        const avatarDescriptions: Record<string, string> = {
            analyst: 'a 35-year-old East Asian man with short black hair, glasses, wearing a navy blue blazer, professional journalist',
            storyteller: 'a 30-year-old woman with auburn wavy hair, warm smile, wearing a casual blazer, creative journalist',
            provocateur: 'a 28-year-old Latino man with styled dark hair, slightly smirking expression, wearing a leather jacket, edgy journalist',
            canada_expert: 'a 40-year-old French-Canadian woman with shoulder-length brown hair, pearl earrings, wearing a white blouse, immigration lawyer',
            europe_expert: 'a 45-year-old German man with gray temples, clean-shaven, wearing a charcoal suit, policy analyst',
            asia_expert: 'a 32-year-old Japanese woman with long straight black hair, minimal makeup, wearing a modern turtleneck, travel journalist',
            us_expert: 'a 42-year-old Hispanic American man with short dark hair, wearing a pinstripe suit and tie, immigration attorney',
            legal_advisor: 'a 38-year-old Eastern European woman with blonde hair in a bun, wearing a black blazer with a brooch, serious expression, lawyer',
            nomad_guide: 'a 29-year-old Scandinavian woman with blonde hair, sunglasses pushed up on head, light tan, wearing a casual linen shirt, travel blogger',
            editor_chief: 'a 50-year-old South Asian man with silver hair and a neatly trimmed beard, wearing a dark suit vest over a white shirt, editor-in-chief',
        };

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
