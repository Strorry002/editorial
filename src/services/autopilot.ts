import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { generateArticleDraft } from './ai.js';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Group raw updates by topic/region using AI, then create articles.
 * Called by cron at 11:00 or manually via API.
 */
export async function runAutopilot(options: {
    autoDraft?: boolean;
    hoursBack?: number;
} = {}): Promise<{ created: number; drafted: number; skipped: number }> {
    const { autoDraft = true, hoursBack = 24 } = options;

    // 1. Get recent raw updates not yet linked to any article
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const rawUpdates = await prisma.legalUpdate.findMany({
        where: {
            workflowStatus: 'raw',
            createdAt: { gte: since },
            articleSources: { none: {} }, // not yet used in any article
        },
        include: {
            country: { select: { name: true, flag: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
    });

    if (rawUpdates.length === 0) {
        return { created: 0, drafted: 0, skipped: 0 };
    }

    // 2. Ask AI to group updates by theme
    const summaryList = rawUpdates.map((u, i) => `[${i}] ${u.country?.flag || ''} ${u.countryCode} | ${u.category} | ${u.title}`).join('\n');

    const groupingResponse = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `You are an editorial assistant. Group these news items into article topics.
Rules:
- Each group should have 1-5 related items
- Items can be related by country, category, or theme
- Single items that are important enough can be their own article
- Return JSON: { "groups": [ { "title": "Article title in Russian", "tags": ["tag1"], "indices": [0, 2, 5] } ] }
- Title should be catchy and informative, in Russian
- Maximum 5 groups`,
            },
            { role: 'user', content: `Group these updates:\n${summaryList}` },
        ],
        temperature: 0.5,
        response_format: { type: 'json_object' },
    });

    const groupsData = JSON.parse(groupingResponse.choices[0]?.message?.content || '{"groups":[]}');
    const groups = groupsData.groups || [];

    let created = 0;
    let drafted = 0;
    let skipped = 0;

    // 3. Create articles for each group
    for (const group of groups) {
        const sourceUpdates = (group.indices || [])
            .map((i: number) => rawUpdates[i])
            .filter(Boolean);

        if (sourceUpdates.length === 0) {
            skipped++;
            continue;
        }

        const slug = slugify(group.title || 'article') + '-' + Date.now().toString(36);

        try {
            const article = await prisma.article.create({
                data: {
                    title: group.title || 'Untitled',
                    slug,
                    tags: group.tags || [],
                    language: 'ru',
                    status: 'idea',
                    author: 'autopilot',
                    sources: {
                        create: sourceUpdates.map((u: any) => ({
                            updateId: u.id,
                            role: 'source',
                        })),
                    },
                },
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

            created++;

            // 4. Optionally generate draft
            if (autoDraft && article.sources.length > 0) {
                try {
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

                    const result = await generateArticleDraft(article.title, sourceMaterials, 'ru');

                    await prisma.article.update({
                        where: { id: article.id },
                        data: {
                            title: result.title,
                            excerpt: result.excerpt,
                            body: result.body,
                            tags: result.tags.length ? result.tags : article.tags,
                            metaDescription: result.metaDescription,
                            status: 'draft',
                        },
                    });

                    drafted++;
                } catch (err) {
                    console.error(`[autopilot] Draft generation failed for ${article.id}:`, err);
                    // Article stays as idea — can be drafted manually
                }
            }
        } catch (err) {
            console.error('[autopilot] Failed to create article:', err);
            skipped++;
        }
    }

    console.log(`[autopilot] Done: ${created} created, ${drafted} drafted, ${skipped} skipped`);
    return { created, drafted, skipped };
}

/**
 * AI: generate outline for an article from its sources
 */
export async function generateOutline(articleId: string): Promise<string> {
    const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: {
            sources: {
                include: {
                    update: {
                        select: { title: true, summary: true, countryCode: true, category: true },
                    },
                },
            },
        },
    });

    if (!article || !article.sources.length) return '';

    const sourcesText = article.sources.map(s =>
        `• ${s.update.countryCode} | ${s.update.category} | ${s.update.title}: ${s.update.summary}`
    ).join('\n');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            { role: 'system', content: 'Напиши план статьи (outline) на русском. Используй Markdown с ## заголовками. Для каждого раздела кратко опиши что туда войдёт. 5-7 разделов.' },
            { role: 'user', content: `Заголовок: ${article.title}\n\nИсточники:\n${sourcesText}` },
        ],
        temperature: 0.6,
        max_tokens: 1000,
    });

    return response.choices[0]?.message?.content || '';
}

/**
 * AI: review article quality
 */
export async function reviewArticle(articleId: string): Promise<string> {
    const article = await prisma.article.findUnique({
        where: { id: articleId },
    });

    if (!article || !article.body) return 'Нет контента для ревью.';

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
            {
                role: 'system',
                content: `Ты — редактор иммиграционного издания. Проверь статью и дай отзыв на русском:
- Фактическая точность (не выдуманные ли данные?)
- Структура и читаемость
- Длина (оптимально 800-1500 слов)
- SEO: есть ли заголовки, ключевые слова
- Оценка: ✅ Готова к публикации / ⚠️ Нужны правки / ❌ Переписать
Формат: краткий bullet-list.`,
            },
            { role: 'user', content: `Заголовок: ${article.title}\n\n${article.body}` },
        ],
        temperature: 0.4,
        max_tokens: 800,
    });

    return response.choices[0]?.message?.content || '';
}

function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 80)
        .replace(/^-|-$/g, '') || 'article';
}
