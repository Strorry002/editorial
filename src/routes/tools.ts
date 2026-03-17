import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

export async function toolsRoutes(app: FastifyInstance) {
    // ── Visa Programs ──
    app.get('/visa-programs', async (request) => {
        const { type, country } = request.query as { type?: string; country?: string };
        const where: Record<string, unknown> = { isActive: true };
        if (type) where.type = type;
        if (country) where.countryCode = country;

        const programs = await prisma.visaProgram.findMany({
            where,
            include: { country: { select: { name: true, code: true, flag: true, region: true } } },
            orderBy: [{ countryCode: 'asc' }, { type: 'asc' }],
        });
        return { data: programs, total: programs.length };
    });

    // ── Cost of Living ──
    app.get('/cost-of-living', async (request) => {
        const { country, sort } = request.query as { country?: string; sort?: string };
        const where: Record<string, unknown> = {};
        if (country) where.countryCode = country;

        const entries = await prisma.costOfLiving.findMany({
            where,
            include: { country: { select: { name: true, code: true, flag: true } } },
            orderBy: sort === 'cheapest' ? { overallIndex: 'asc' } : { overallIndex: 'desc' },
        });
        return { data: entries, total: entries.length };
    });

    // ── Statistics ──
    app.get('/statistics', async (request) => {
        const { country, category } = request.query as { country?: string; category?: string };
        const where: Record<string, unknown> = {};
        if (country) where.countryCode = country;
        if (category) where.category = category;

        const stats = await prisma.statistic.findMany({
            where,
            include: { country: { select: { name: true, code: true, flag: true } } },
            orderBy: [{ countryCode: 'asc' }, { category: 'asc' }],
        });
        return { data: stats, total: stats.length };
    });

    // ── Countries with related tool counts ──
    app.get('/countries-overview', async () => {
        const countries = await prisma.country.findMany({
            include: {
                _count: {
                    select: {
                        visaPrograms: true,
                        costOfLiving: true,
                        statistics: true,
                        legalUpdates: true,
                    },
                },
            },
            orderBy: { name: 'asc' },
        });
        return { data: countries, total: countries.length };
    });

    // ── Pathways Summary ──
    app.get('/pathways', async () => {
        const PATHWAY_MAP: Record<string, { slug: string; emoji: string; title: string; subtitle: string; types: string[] }> = {
            study: { slug: 'study', emoji: '🎓', title: 'Study', subtitle: 'Universities, student visas, scholarships', types: ['student'] },
            work: { slug: 'work', emoji: '💼', title: 'Work', subtitle: 'Work permits, Blue Card, skilled migration', types: ['work'] },
            nomad: { slug: 'nomad', emoji: '🌐', title: 'Digital Nomad', subtitle: 'Remote work visas, DN programs', types: ['digital_nomad'] },
            business: { slug: 'business', emoji: '💰', title: 'Business & Investment', subtitle: 'Golden visas, startup visas, investor programs', types: ['investment'] },
            family: { slug: 'family', emoji: '👨‍👩‍👧', title: 'Family', subtitle: 'Spouse visas, family reunification', types: ['family'] },
            retirement: { slug: 'retirement', emoji: '🏖', title: 'Retirement', subtitle: 'Pension visas, passive income visas', types: ['tourist'] },
            freelance: { slug: 'freelance', emoji: '🎨', title: 'Freelance', subtitle: 'Self-employment visas, freelancer permits', types: ['work'] },
            asylum: { slug: 'asylum', emoji: '🛡', title: 'Asylum & Refugee', subtitle: 'Protection, humanitarian migration', types: ['asylum', 'refugee'] },
        };

        const counts = await prisma.visaProgram.groupBy({
            by: ['type'],
            where: { isActive: true },
            _count: true,
        });

        const countMap: Record<string, number> = {};
        for (const c of counts) countMap[c.type] = c._count;

        const pathways = Object.entries(PATHWAY_MAP).map(([key, p]) => ({
            ...p,
            programCount: p.types.reduce((sum, t) => sum + (countMap[t] || 0), 0),
            countryCount: 0, // filled below
        }));

        // Get unique country counts per type
        for (const pw of pathways) {
            const countries = await prisma.visaProgram.findMany({
                where: { type: { in: PATHWAY_MAP[pw.slug].types }, isActive: true },
                select: { countryCode: true },
                distinct: ['countryCode'],
            });
            pw.countryCount = countries.length;
        }

        return { data: pathways };
    });

    // ── Pathway Detail ──
    app.get('/pathways/:slug', async (request) => {
        const { slug } = request.params as { slug: string };

        const TYPE_MAP: Record<string, string[]> = {
            study: ['student'], work: ['work'], nomad: ['digital_nomad'],
            business: ['investment'], family: ['family'],
            retirement: ['tourist'], freelance: ['work'],
            asylum: ['asylum', 'refugee'],
        };

        const types = TYPE_MAP[slug];
        if (!types) return { error: 'Unknown pathway', data: null };

        const programs = await prisma.visaProgram.findMany({
            where: { type: { in: types }, isActive: true },
            include: {
                country: { select: { name: true, code: true, flag: true, region: true } },
            },
            orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
        });

        return { data: programs, total: programs.length };
    });

    // ── AI Nomad Brief ──
    app.post('/nomad-brief', async (request, reply) => {
        const { city, country, costIndex, rent, meal, internet, hasNomadVisa, visaName, visaDuration, score } =
            request.body as {
                city: string; country: string; costIndex: number;
                rent: number; meal: number; internet: number;
                hasNomadVisa: boolean; visaName: string | null;
                visaDuration: string | null; score: number;
            };

        if (!city || !country) {
            reply.status(400);
            return { error: 'City and country required' };
        }

        const xaiKey = process.env.XAI_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const apiKey = xaiKey || openaiKey;
        if (!apiKey) {
            reply.status(500);
            return { error: 'AI not configured (set XAI_API_KEY or OPENAI_API_KEY)' };
        }

        const openai = new OpenAI({
            apiKey,
            baseURL: xaiKey ? 'https://api.x.ai/v1' : undefined,
        });
        const model = xaiKey ? 'grok-3-mini-fast' : 'gpt-4o-mini';

        const visaInfo = hasNomadVisa
            ? `This country has a digital nomad visa: "${visaName}" with duration ${visaDuration}.`
            : `This country does NOT have a dedicated digital nomad visa.`;

        const prompt = `You are a digital nomad expert advisor. Write a brief, practical guide about ${city}, ${country} for a remote worker considering relocating.

Data:
- Cost of living index: ${costIndex} (NYC = 100)
- Average 1BR rent: $${rent}/month
- Average meal cost: $${meal}
- Internet cost: $${internet}/month
- Nomad Score: ${score}/135
- ${visaInfo}

Cover these topics concisely (2-3 sentences each):
1. 💰 Cost of Living — is it affordable? What can you expect?
2. 🌐 Internet & Coworking — quality, speed, coworking spaces
3. 🛂 Visa Situation — practical advice on staying legally
4. 🏠 Neighborhoods — best areas for nomads
5. ⚡ Pros & Cons — top 3 pros and cons
6. 💡 Insider Tip — one specific, non-obvious tip

Keep it practical, current, and under 300 words total. Use emoji headers. Write naturally, not like a template.`;

        try {
            const response = await openai.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 600,
                temperature: 0.7,
            });

            const text = response.choices[0]?.message?.content || 'Unable to generate brief.';
            return { data: text };
        } catch (err) {
            reply.status(500);
            return { error: 'AI generation failed', details: (err as Error).message };
        }
    });

    // ── AI Immigration Advisor Chat ──
    app.post('/advisor-chat', async (request, reply) => {
        const { message, history = [] } = request.body as {
            message: string;
            history: { role: string; content: string }[];
        };

        if (!message) { reply.status(400); return { error: 'Message required' }; }

        try {
            const { default: OpenAI } = await import('openai');
            const xaiKey = process.env.XAI_API_KEY;
            const openaiKey = process.env.OPENAI_API_KEY;
            const aiKey = xaiKey || openaiKey;
            if (!aiKey) { reply.status(500); return { error: 'AI not configured' }; }
            const openai = new OpenAI({
                apiKey: aiKey,
                baseURL: xaiKey ? 'https://api.x.ai/v1' : undefined,
            });
            const model = xaiKey ? 'grok-3-mini-fast' : 'gpt-4o-mini';

            const response = await openai.chat.completions.create({
                model,
                max_tokens: 1200,
                temperature: 0.7,
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI Immigration Advisor for TheImmigrants.news. You provide practical, accurate guidance on:
- Visa programs worldwide (student, work, investment, family, retirement, digital nomad, freelance, asylum)
- Relocation planning (costs, timeline, documents)
- Country comparisons for immigration
- Immigration strategy and pathways

RULES:
1. Be concise but thorough. Use bullet points and sections.
2. Include specific numbers (costs, timelines, income requirements) when known.
3. Always mention that immigration laws change and recommend consulting a lawyer for specific cases.
4. Use markdown formatting: **bold** for key terms, bullet points for lists.
5. If comparing countries, use a structured format.
6. Focus on 2025-2026 data and current programs.
7. Be encouraging but realistic about challenges.
8. If you don't know something specific, say so rather than guessing.
9. Respond in the same language the user writes in.`
                    },
                    ...history.map(h => ({
                        role: h.role as 'user' | 'assistant',
                        content: h.content,
                    })),
                    { role: 'user' as const, content: message },
                ],
            });

            const text = response.choices[0]?.message?.content || 'Unable to generate response.';
            return { data: text };
        } catch (err) {
            reply.status(500);
            return { error: 'AI advisor failed', details: (err as Error).message };
        }
    });
}

