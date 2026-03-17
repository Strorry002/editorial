import { PrismaClient } from '@prisma/client';
import { generateArticleDraft, getXAIClient, AI_MODEL } from './ai.js';
import { assignAgent } from './editorial-team.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

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
            articleSources: { none: {} },
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

    const groupingResponse = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: `You are an editorial assistant. Group these news items into article topics.
Rules:
- Each group should have 1-5 related items
- Items can be related by country, category, or theme
- Single items that are important enough can be their own article
- Return JSON: { "groups": [ { "title": "Article title in English", "tags": ["tag1"], "indices": [0, 2, 5] } ] }
- Title should be catchy and informative, in English
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
                    language: 'en',
                    status: 'idea',
                    author: 'Editorial Team',
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

            // 3b. Chief Editor assigns best agent
            const agentId = await assignAgent(group.title || '', group.tags || [], sourceUpdates[0]?.countryCode);
            if (agentId) {
                const agent = await prisma.agent.findUnique({ where: { id: agentId } });
                if (agent) {
                    await prisma.article.update({
                        where: { id: article.id },
                        data: { agentId, author: agent.displayName },
                    });
                }
            }

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

                    // Get agent style for personalized writing
                    const agentData = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null;
                    const result = await generateArticleDraft(article.title, sourceMaterials, 'en', agentData?.basePrompt);

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

    const response = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: 'Write an article outline in English. Use Markdown with ## headings. For each section briefly describe what it will cover. 5-7 sections.' },
            { role: 'user', content: `Title: ${article.title}\n\nSources:\n${sourcesText}` },
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

    const response = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: `You are the editor of an immigration publication. Review the article and give feedback in English:
- Factual accuracy (are there any invented data?)
- Structure and readability
- Length (optimal 800-1500 words)
- SEO: are there headings, keywords?
- Rating: ✅ Ready to publish / ⚠️ Needs edits / ❌ Rewrite
Format: concise bullet-list.`,
            },
            { role: 'user', content: `Title: ${article.title}\n\n${article.body}` },
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

/**
 * Generate draft using a specific agent's style
 */
export async function generateDraftWithAgent(articleId: string, agentId?: string): Promise<{ title: string; body: string; excerpt: string }> {
    const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: {
            sources: {
                include: {
                    update: {
                        select: { title: true, summary: true, details: true, countryCode: true, category: true, impactLevel: true, sourceUrl: true, country: { select: { name: true } } },
                    },
                },
            },
        },
    });
    if (!article) throw new Error('Article not found');

    let systemPrompt = `You are a professional journalist for an immigration news platform. Write clear, well-structured articles in English.`;
    let styleInstruction = '';
    if (agentId) {
        const agent = await prisma.agent.findUnique({ where: { id: agentId } });
        if (agent) {
            systemPrompt = agent.basePrompt;
            styleInstruction = agent.stylePrompt ? `\n\nSTYLE GUIDE: ${agent.stylePrompt}` : '';
        }
    }

    const sourcesText = article.sources.map(s =>
        `- ${s.update.country?.name || s.update.countryCode} | ${s.update.category} | ${s.update.title}\n  ${s.update.summary || ''}\n  ${s.update.details || ''}`
    ).join('\n\n');

    const response = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            { role: 'system', content: systemPrompt + styleInstruction },
            {
                role: 'user', content: `Write an article in English based on these sources.
Title: ${article.title}

Sources:
${sourcesText}

Requirements:
- Write in English
- 800-1500 words
- Clear headline, lead paragraph, body sections with ## headers, conclusion
- Cite source countries and dates
- Return JSON: { "title": "...", "body": "markdown text", "excerpt": "1-2 sentence summary" }`
            },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    await prisma.article.update({
        where: { id: articleId },
        data: {
            title: result.title || article.title,
            body: result.body || '',
            excerpt: result.excerpt || '',
            status: 'draft',
            stageUpdatedAt: new Date(),
        },
    });

    return result;
}

/**
 * Chief Editor: auto-progress articles stuck at each stage
 */
export async function runChiefEditor(): Promise<{ progressed: number; details: string[] }> {
    const details: string[] = [];
    let progressed = 0;

    const stages = [
        { from: 'idea', to: 'outline', hours: 4, action: 'generate outline' },
        { from: 'outline', to: 'draft', hours: 2, action: 'generate draft' },
        { from: 'draft', to: 'review', hours: 1, action: 'move to review' },
        { from: 'review', to: 'approved', hours: 1, action: 'auto-approve' },
    ];

    for (const stage of stages) {
        const cutoff = new Date(Date.now() - stage.hours * 60 * 60 * 1000);
        const stuck = await prisma.article.findMany({
            where: {
                status: stage.from,
                stageUpdatedAt: { lt: cutoff },
            },
            take: 10,
        });

        for (const article of stuck) {
            try {
                if (stage.from === 'idea') {
                    const outline = await generateOutline(article.id);
                    await prisma.article.update({
                        where: { id: article.id },
                        data: { body: outline, status: 'outline', stageUpdatedAt: new Date() },
                    });
                } else if (stage.from === 'outline') {
                    await generateDraftWithAgent(article.id, article.agentId || undefined);
                } else if (stage.from === 'draft') {
                    const review = await reviewArticle(article.id);
                    await prisma.article.update({
                        where: { id: article.id },
                        data: { reviewNote: review, status: 'review', reviewer: 'AI Chief Editor', stageUpdatedAt: new Date() },
                    });
                } else if (stage.from === 'review') {
                    await prisma.article.update({
                        where: { id: article.id },
                        data: { status: 'approved', stageUpdatedAt: new Date() },
                    });
                }

                progressed++;
                details.push(`${article.title}: ${stage.action}`);
            } catch (err: any) {
                details.push(`ERROR ${article.title}: ${err.message}`);
            }
        }
    }

    return { progressed, details };
}

/**
 * Run full pipeline: idea -> outline -> draft -> review -> approved
 */
export async function runFullPipeline(articleId: string, agentId?: string): Promise<{ status: string; steps: string[] }> {
    const steps: string[] = [];

    const article = await prisma.article.findUnique({
        where: { id: articleId },
        include: { sources: { include: { update: true } } },
    });
    if (!article) throw new Error('Article not found');

    if (agentId) {
        await prisma.article.update({ where: { id: articleId }, data: { agentId } });
    }

    try {
        if (['idea'].includes(article.status)) {
            const outline = await generateOutline(articleId);
            await prisma.article.update({
                where: { id: articleId },
                data: { body: outline, status: 'outline', stageUpdatedAt: new Date() },
            });
            steps.push('outline generated');
        }

        if (['idea', 'outline'].includes(article.status) || steps.length > 0) {
            await generateDraftWithAgent(articleId, agentId || article.agentId || undefined);
            steps.push('draft generated');
        }

        const reviewNote = await reviewArticle(articleId);
        await prisma.article.update({
            where: { id: articleId },
            data: { reviewNote, status: 'review', reviewer: 'AI Pipeline', stageUpdatedAt: new Date() },
        });
        steps.push('review completed');

        await prisma.article.update({
            where: { id: articleId },
            data: { status: 'approved', stageUpdatedAt: new Date() },
        });
        steps.push('approved');

        return { status: 'approved', steps };
    } catch (err: any) {
        steps.push(`ERROR: ${err.message}`);
        return { status: 'error', steps };
    }
}

/**
 * Autonomous Newsroom: full pipeline from raw updates to published articles with owner reporting
 * 1. runAutopilot — group raw updates → create articles → draft
 * 2. runChiefEditor — auto-progress stuck articles
 * 3. Publish approved articles with covers to Telegram
 * 4. Send detailed report to owner DM
 */
export async function runAutonomousNewsroom(options: {
    hoursBack?: number;
    maxPublish?: number;
} = {}): Promise<{ report: string }> {
    const { hoursBack = 48, maxPublish = 3 } = options;
    const { publishToTelegram, sendOwnerReport } = await import('./telegram.js');
    const { generateCoverImage, generateCoverPrompt } = await import('./ai.js');
    const { writeFile, mkdir } = await import('fs/promises');
    const { join } = await import('path');

    const startTime = Date.now();
    const reportLines: string[] = [];
    const errors: string[] = [];

    reportLines.push('🤖 <b>Autonomous Newsroom Report</b>');
    reportLines.push(`⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' })}`);
    reportLines.push('');

    // ── Step 1: Autopilot ──────────────────────────────
    let autopilotResult = { created: 0, drafted: 0, skipped: 0 };
    try {
        console.log('[newsroom] Step 1: Running autopilot...');
        autopilotResult = await runAutopilot({ autoDraft: true, hoursBack });
        reportLines.push(`📰 <b>Autopilot:</b> ${autopilotResult.created} articles created, ${autopilotResult.drafted} drafted`);
    } catch (err: any) {
        errors.push(`Autopilot: ${err.message}`);
        reportLines.push(`❌ Autopilot error: ${err.message}`);
    }

    // ── Step 2: Chief Editor ──────────────────────────
    let editorResult = { progressed: 0, details: [] as string[] };
    try {
        console.log('[newsroom] Step 2: Running chief editor...');
        editorResult = await runChiefEditor();
        if (editorResult.progressed > 0) {
            reportLines.push(`📋 <b>Chief Editor:</b> progressed ${editorResult.progressed} articles`);
            editorResult.details.forEach(d => reportLines.push(`  → ${d}`));
        }
    } catch (err: any) {
        errors.push(`Chief Editor: ${err.message}`);
        reportLines.push(`❌ Chief Editor error: ${err.message}`);
    }

    // ── Step 3: Publish approved articles ──────────────
    console.log('[newsroom] Step 3: Publishing approved articles...');
    const approved = await prisma.article.findMany({
        where: { status: 'approved' },
        orderBy: { updatedAt: 'desc' },
        take: maxPublish,
        include: {
            agent: { select: { displayName: true, name: true } },
        },
    });

    let published = 0;
    const publishedArticles: string[] = [];

    for (const article of approved) {
        try {
            // Generate cover if missing
            if (!article.coverImage) {
                console.log(`[newsroom] Generating cover for: ${article.title}`);
                try {
                    const prompt = generateCoverPrompt(article.title, article.tags as string[] || [], []);
                    const imageUrl = await generateCoverImage(prompt);
                    const coverFileName = `${article.slug}.webp`;
                    const coverDir = join(process.cwd(), 'public', 'covers');
                    await mkdir(coverDir, { recursive: true });

                    const imgRes = await fetch(imageUrl);
                    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
                    await writeFile(join(coverDir, coverFileName), imgBuffer);

                    await prisma.article.update({
                        where: { id: article.id },
                        data: { coverImage: `/covers/${coverFileName}` },
                    });
                    article.coverImage = `/covers/${coverFileName}`;
                } catch (coverErr: any) {
                    console.warn(`[newsroom] Cover failed for ${article.id}: ${coverErr.message}`);
                }
            }

            // Publish to Telegram
            console.log(`[newsroom] Publishing to Telegram: ${article.title}`);
            const articleData = {
                title: article.title,
                excerpt: article.excerpt || '',
                body: article.body || '',
                slug: article.slug,
                coverImage: article.coverImage,
                tags: article.tags as string[],
                author: article.agent?.displayName || article.agent?.name || article.author,
            };

            const tgResult = await publishToTelegram(articleData);

            // Publish to Facebook
            console.log(`[newsroom] Publishing to Facebook: ${article.title}`);
            let fbOk = false;
            try {
                const { publishToFacebook } = await import('./facebook.js');
                const fbResult = await publishToFacebook(articleData);
                fbOk = fbResult.success;
                if (!fbResult.success) {
                    errors.push(`FB "${article.title.substring(0, 30)}": ${fbResult.error}`);
                }
            } catch (fbErr: any) {
                errors.push(`FB "${article.title.substring(0, 30)}": ${fbErr.message}`);
            }

            if (tgResult.success || fbOk) {
                await prisma.article.update({
                    where: { id: article.id },
                    data: { status: 'published', publishedAt: new Date(), stageUpdatedAt: new Date() },
                });
                published++;
                const channels = [tgResult.success ? 'TG' : null, fbOk ? 'FB' : null].filter(Boolean).join('+');
                publishedArticles.push(`📤 "${article.title.substring(0, 50)}" [${channels}]`);
            } else {
                errors.push(`Publish "${article.title.substring(0, 30)}": both TG and FB failed`);
            }
        } catch (err: any) {
            errors.push(`Publish "${article.title.substring(0, 30)}": ${err.message}`);
        }
    }

    if (published > 0) {
        reportLines.push('');
        reportLines.push(`✅ <b>Published ${published} article(s):</b>`);
        publishedArticles.forEach(a => reportLines.push(a));
    }

    // ── Step 4: Summary ──────────────────────────────
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);

    if (autopilotResult.created === 0 && editorResult.progressed === 0 && published === 0) {
        reportLines.push('');
        reportLines.push('💤 <b>No newsworthy updates found.</b>');
        reportLines.push('All articles are up to date.');
    }

    if (errors.length > 0) {
        reportLines.push('');
        reportLines.push(`⚠️ <b>Errors (${errors.length}):</b>`);
        errors.forEach(e => reportLines.push(`  ❌ ${e}`));
    }

    reportLines.push('');
    reportLines.push(`⏱ Completed in ${elapsed}s`);

    const report = reportLines.join('\n');
    console.log('[newsroom] Sending report to owner...');
    await sendOwnerReport(report);
    console.log('[newsroom] Done.');

    return { report };
}
