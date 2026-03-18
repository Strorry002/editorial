import { PrismaClient } from '@prisma/client';
import { generateArticleDraft, getXAIClient, AI_MODEL } from './ai.js';
import { assignAgent } from './editorial-team.js';
import { resolveCategory, resolveDualCategory } from './category-resolver.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

// ── Immigration Relevance Helpers ────────────────────────────────
const IMMIGRATION_KEYWORDS = [
    'immigra', 'visa', 'work permit', 'residence permit', 'green card',
    'citizen', 'naturaliz', 'passport', 'asylum', 'refugee', 'deport',
    'border', 'migrant', 'migrat', 'expat', 'digital nomad', 'nomad',
    'foreign worker', 'talent', 'labor mobil', 'relocation', 'resettle',
    'trafficking', 'smuggl', 'undocumented', 'overstay',
    'h-1b', 'h1b', 'eb-5', 'o-1', 'schengen', 'golden visa',
    'student visa', 'education visa', 'work abroad', 'live abroad',
];

/**
 * Fast keyword-based check: does title+excerpt mention immigration topics?
 * Used as final gate before publishing.
 */
function isImmigrationRelated(title: string, excerpt: string): boolean {
    const text = `${title} ${excerpt}`.toLowerCase();
    return IMMIGRATION_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * AI-powered relevance check: asks Grok if the article is about immigration.
 * Used by chief editor before auto-approving.
 */
async function checkImmigrationRelevance(title: string, body: string): Promise<boolean> {
    try {
        const snippet = body.substring(0, 500); // first 500 chars is enough
        const response = await xai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                {
                    role: 'system',
                    content: `You are a topic classifier. Determine if the article is about immigration, visas, work permits, refugees, expats, digital nomads, global mobility, citizenship, or related topics.
Reply with JSON: { "relevant": true/false, "reason": "brief explanation" }`,
                },
                { role: 'user', content: `Title: ${title}\n\n${snippet}` },
            ],
            temperature: 0.1,
            max_tokens: 100,
            response_format: { type: 'json_object' },
        });
        const result = JSON.parse(response.choices[0]?.message?.content || '{"relevant": true}');
        if (!result.relevant) {
            console.log(`[chief-editor] Off-topic detected: "${title.substring(0, 50)}" — ${result.reason}`);
        }
        return result.relevant !== false;
    } catch (err: any) {
        console.warn(`[chief-editor] Relevance check failed, defaulting to relevant: ${err.message}`);
        return true; // fail-open: if AI check fails, allow through
    }
}

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
                content: `You are an editorial assistant for an IMMIGRATION news platform. Group these news items into article topics.

CRITICAL RELEVANCE RULE:
ONLY include items that are DIRECTLY related to at least one of these topics:
- Immigration policy, visa rules, work permits, residence permits
- Refugees, asylum seekers, deportation, border control
- Citizenship, naturalization, green cards, passports
- Expat life, digital nomads, global mobility, relocation
- Labor migration, foreign workers, talent acquisition
- International students, education visas
- Human trafficking, migrant rights

REJECT items about: generic politics, environment/ecology, technology, sports, entertainment, domestic economic policy unrelated to migration, military/defense (unless about refugee impact).

For each group, set "relevant": true/false. Mark false if the topic is NOT about immigration/migration/visas/expats.

Rules:
- Each group should have 1-5 related items
- Items can be related by country, category, or theme
- Single items that are important enough can be their own article
- Return JSON: { "groups": [ { "title": "Article title in English", "tags": ["tag1"], "indices": [0, 2, 5], "relevant": true } ] }
- Title should be catchy and informative, in English
- Maximum 5 groups
- If NO items are immigration-relevant, return { "groups": [] }`,
            },
            { role: 'user', content: `Group these updates:\n${summaryList}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
    });

    const groupsData = JSON.parse(groupingResponse.choices[0]?.message?.content || '{"groups":[]}');
    // Filter out non-immigration-relevant groups
    const allGroups = groupsData.groups || [];
    const groups = allGroups.filter((g: any) => g.relevant !== false);
    const rejected = allGroups.length - groups.length;
    if (rejected > 0) {
        console.log(`[autopilot] Filtered out ${rejected} non-immigration groups`);
    }

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
            // Resolve dual category (region + topic type)
            const countryCodes = [...new Set(sourceUpdates.map((u: any) => u.countryCode).filter(Boolean))] as string[];
            const { region, topicType } = resolveDualCategory(countryCodes, group.tags || [], group.title || '');

            const article = await prisma.article.create({
                data: {
                    title: group.title || 'Untitled',
                    slug,
                    tags: group.tags || [],
                    language: 'en',
                    category: region,
                    topicType: topicType,
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
                    // Quick AI relevance check before auto-approving
                    const isRelevant = await checkImmigrationRelevance(article.title, article.body || '');
                    if (!isRelevant) {
                        await prisma.article.update({
                            where: { id: article.id },
                            data: { status: 'archived', stageUpdatedAt: new Date(), reviewNote: 'Auto-archived: not immigration-relevant' },
                        });
                        details.push(`ARCHIVED (off-topic): ${article.title}`);
                        continue;
                    }
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
            // Final relevance gate — keyword check before publishing
            if (!isImmigrationRelated(article.title, article.excerpt || '')) {
                console.log(`[newsroom] SKIPPED (off-topic): ${article.title.substring(0, 60)}`);
                await prisma.article.update({
                    where: { id: article.id },
                    data: { status: 'archived', stageUpdatedAt: new Date(), reviewNote: 'Auto-archived at publish: not immigration-relevant' },
                });
                reportLines.push(`🚫 Archived (off-topic): "${article.title.substring(0, 50)}"`);
                continue;
            }
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
                    console.warn(`[newsroom] Cover generation failed for "${article.title.substring(0, 40)}": ${coverErr.message}`);
                    // Continue without cover — don't block publishing
                }
            }

            // Build article data for distribution channels
            const articleData = {
                title: article.title,
                excerpt: article.excerpt || '',
                body: article.body || '',
                slug: article.slug,
                coverImage: article.coverImage,
                tags: article.tags as string[],
                author: article.agent?.displayName || article.agent?.name || article.author,
            };

            let tgOk = false;
            let fbOk = false;

            // ── Telegram ──
            try {
                console.log(`[newsroom] Publishing to Telegram: ${article.title.substring(0, 50)}`);
                const tgResult = await publishToTelegram(articleData);
                tgOk = tgResult.success;

                // Track distribution in DB
                await prisma.articleDistribution.upsert({
                    where: { articleId_channel: { articleId: article.id, channel: 'telegram' } },
                    create: {
                        articleId: article.id,
                        channel: 'telegram',
                        status: tgResult.success ? 'sent' : 'failed',
                        format: 'full',
                        externalId: tgResult.messageId?.toString() || null,
                        sentAt: tgResult.success ? new Date() : null,
                        errorMessage: tgResult.error || null,
                    },
                    update: {
                        status: tgResult.success ? 'sent' : 'failed',
                        externalId: tgResult.messageId?.toString() || null,
                        sentAt: tgResult.success ? new Date() : null,
                        errorMessage: tgResult.error || null,
                    },
                });

                if (!tgResult.success) {
                    errors.push(`TG "${article.title.substring(0, 30)}": ${tgResult.error}`);
                }
            } catch (tgErr: any) {
                console.error(`[newsroom] Telegram error for "${article.title.substring(0, 30)}":`, tgErr.message);
                errors.push(`TG "${article.title.substring(0, 30)}": ${tgErr.message}`);
            }

            // ── Facebook ──
            try {
                console.log(`[newsroom] Publishing to Facebook: ${article.title.substring(0, 50)}`);
                const { publishToFacebook } = await import('./facebook.js');
                const fbResult = await publishToFacebook(articleData);
                fbOk = fbResult.success;

                // Track distribution in DB
                await prisma.articleDistribution.upsert({
                    where: { articleId_channel: { articleId: article.id, channel: 'facebook' } },
                    create: {
                        articleId: article.id,
                        channel: 'facebook',
                        status: fbResult.success ? 'sent' : 'failed',
                        format: 'full',
                        externalId: fbResult.postId || null,
                        sentAt: fbResult.success ? new Date() : null,
                        errorMessage: fbResult.error || null,
                    },
                    update: {
                        status: fbResult.success ? 'sent' : 'failed',
                        externalId: fbResult.postId || null,
                        sentAt: fbResult.success ? new Date() : null,
                        errorMessage: fbResult.error || null,
                    },
                });

                if (!fbResult.success) {
                    errors.push(`FB "${article.title.substring(0, 30)}": ${fbResult.error}`);
                }
            } catch (fbErr: any) {
                console.error(`[newsroom] Facebook error for "${article.title.substring(0, 30)}":`, fbErr.message);
                errors.push(`FB "${article.title.substring(0, 30)}": ${fbErr.message}`);
            }

            // Mark article as published if at least one channel succeeded
            if (tgOk || fbOk) {
                await prisma.article.update({
                    where: { id: article.id },
                    data: { status: 'published', publishedAt: new Date(), stageUpdatedAt: new Date() },
                });
                published++;
                const channels = [tgOk ? 'TG' : null, fbOk ? 'FB' : null].filter(Boolean).join('+');
                publishedArticles.push(`📤 "${article.title.substring(0, 50)}" [${channels}]`);
            } else {
                errors.push(`Publish "${article.title.substring(0, 30)}": both TG and FB failed`);
            }
        } catch (err: any) {
            console.error(`[newsroom] Fatal error for "${article.title?.substring(0, 30)}":`, err.message);
            errors.push(`Publish "${article.title?.substring(0, 30)}": ${err.message}`);
        }
    }

    if (published > 0) {
        reportLines.push('');
        reportLines.push(`✅ <b>Published ${published} article(s):</b>`);
        publishedArticles.forEach(a => reportLines.push(a));
    }

    // ── Step 3b: Create social media distribution cards ──
    console.log('[newsroom] Step 3b: Creating social distribution cards...');
    try {
        const { adaptContentForAllChannels } = await import('./social-adapter.js');
        const recentlyPublished = await prisma.article.findMany({
            where: { status: 'published', publishedAt: { gte: new Date(Date.now() - 6 * 60 * 60 * 1000) } },
            take: 5,
        });

        let socialCards = 0;
        for (const art of recentlyPublished) {
            // Check if social cards already exist
            const existingCards = await prisma.articleDistribution.count({
                where: { articleId: art.id, channel: { notIn: ['telegram', 'facebook'] } },
            });
            if (existingCards > 0) continue; // already has social cards

            const adapted = await adaptContentForAllChannels({
                title: art.title,
                excerpt: art.excerpt || '',
                body: art.body || '',
                slug: art.slug,
                tags: (art.tags as string[]) || [],
                coverImage: art.coverImage,
                author: art.author,
            }, ['instagram', 'x_twitter', 'linkedin'] as any[]);

            for (const item of adapted) {
                await prisma.articleDistribution.upsert({
                    where: { articleId_channel: { articleId: art.id, channel: item.channel } },
                    create: {
                        articleId: art.id,
                        channel: item.channel,
                        status: 'pending',
                        format: 'adapted',
                        metadata: { adaptedText: item.text, hashtags: item.hashtags, mediaNote: item.mediaNote || null },
                    },
                    update: {
                        metadata: { adaptedText: item.text, hashtags: item.hashtags, mediaNote: item.mediaNote || null },
                    },
                });
                socialCards++;
            }
        }
        if (socialCards > 0) {
            reportLines.push(`📱 Created ${socialCards} social media cards`);
        }
    } catch (socialErr: any) {
        console.error('[newsroom] Social distribution error:', socialErr.message);
        errors.push(`Social: ${socialErr.message}`);
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

// ═══════════════════════════════════════════════════════════════
// Feature Autopilot — human-interest content (lifehacks, guides, stories)
// ═══════════════════════════════════════════════════════════════

const FEATURE_TOPICS = [
    {
        category: 'travel-lifehacks',
        title_prompt: 'travel lifehack or practical tip for immigrants and expats',
        examples: [
            'Moving Abroad with Pets: A Complete Survival Guide',
            'The Art of Packing for a One-Way Trip',
            'How to Save 40% on International Moving Costs',
            'Embassy Appointments: Tricks That Actually Work',
            'Airport Hacks Every Immigrant Should Know',
            'How to Ship Your Entire Life Across the Ocean',
        ],
    },
    {
        category: 'expat-life',
        title_prompt: 'real expat experience, culture shock, or daily life challenge abroad',
        examples: [
            'Culture Shock Is Real: What Nobody Tells You About Your First Year Abroad',
            'Making Friends in a Country Where You Don\'t Speak the Language',
            'The Emotional Rollercoaster of Leaving Your Home Country',
            'Remote Work Timezone Hell: How Expats Actually Manage It',
            'Things I Wish I Knew Before Moving to Southeast Asia',
        ],
    },
    {
        category: 'cost-comparison',
        title_prompt: 'cost of living comparison between two countries or cities for expats',
        examples: [
            'Lisbon vs Bangkok: Where Your Dollar Goes Further',
            '$3000/Month Showdown: Mexico City vs Tbilisi vs Bali',
            'The Hidden Costs of Living in "Cheap" Countries',
            'Healthcare Abroad: What $100 Gets You in 10 Countries',
        ],
    },
    {
        category: 'how-to-guide',
        title_prompt: 'step-by-step practical guide for an expat or immigrant task',
        examples: [
            'How to Open a Bank Account as a Foreigner: Country-by-Country Guide',
            'Renting Your First Apartment Abroad Without Getting Scammed',
            'International Health Insurance: The No-BS Breakdown',
            'How to Get a Local SIM Card and Phone Number in Any Country',
            'Tax Residency 101: Where Should You Actually Pay Taxes?',
        ],
    },
    {
        category: 'destination-guide',
        title_prompt: 'in-depth relocation guide to a specific country or city',
        examples: [
            'The Complete Guide to Moving to Portugal in 2026',
            'Bali for Digital Nomads: Beyond the Instagram Fantasy',
            'Why Everyone\'s Moving to Georgia (The Country, Not The State)',
            'Dubai vs Abu Dhabi: An Honest Comparison for Expats',
        ],
    },
];

export async function runFeatureAutopilot(): Promise<{ created: boolean; title: string }> {
    console.log('[feature] Starting feature autopilot...');

    // Pick a random topic category
    const topic = FEATURE_TOPICS[Math.floor(Math.random() * FEATURE_TOPICS.length)];
    const examplesList = topic.examples.map((e, i) => `${i + 1}. "${e}"`).join('\n');

    // Ask AI to generate a fresh, unique article topic
    const topicResponse = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: `You are an editorial planner for TheImmigrants.news — an online publication for immigrants, expats, and digital nomads.

Generate ONE unique, compelling article idea in the category: "${topic.category}" (${topic.title_prompt}).

Here are examples of the style we're going for (DO NOT repeat these exactly):
${examplesList}

Requirements:
- Title must be catchy, specific, and SEO-friendly
- Must be genuinely useful to someone moving or living abroad
- Include real-world practical details, not generic advice
- The article should feel like it was written by someone who actually lived this experience
- Return JSON: { "title": "...", "outline": "3-5 bullet points of what the article should cover", "tags": ["tag1", "tag2"], "targetAgent": "name of the best agent for this (sarah_mitchell, james_harrison, elena_vasquez, david_chen, anna_kowalski, alex_rivera, marie_leblanc, hans_weber, michael_torres)" }`,
            },
            { role: 'user', content: `Generate a fresh ${topic.category} article idea that hasn't been done before. Make it specific and actionable.` },
        ],
        temperature: 0.9,
        response_format: { type: 'json_object' },
    });

    const idea = JSON.parse(topicResponse.choices[0]?.message?.content || '{}');
    if (!idea.title) {
        console.error('[feature] Failed to generate topic');
        return { created: false, title: '' };
    }

    console.log(`[feature] Topic: ${idea.title}`);

    // Find best agent
    let agentId: string | null = null;
    if (idea.targetAgent) {
        const agent = await prisma.agent.findFirst({ where: { name: idea.targetAgent } });
        if (agent) agentId = agent.id;
    }
    if (!agentId) {
        // Fallback: assign by tags
        agentId = await assignAgent(idea.title, idea.tags || [], null);
    }

    const agentData = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null;

    // Create the article
    const slug = slugify(idea.title) + '-' + Date.now().toString(36);
    const article = await prisma.article.create({
        data: {
            title: idea.title,
            slug,
            tags: idea.tags || [topic.category],
            language: 'en',
            category: topic.category,
            status: 'idea',
            author: agentData?.displayName || 'Editorial Team',
            agentId: agentId || undefined,
            body: idea.outline || '',
        },
    });

    console.log(`[feature] Article created: ${article.id}`);

    // Generate full draft immediately
    try {
        const draftPrompt = `Write a comprehensive, engaging article on the following topic:

Title: ${idea.title}
Outline: ${idea.outline}
Category: ${topic.category}

This is a FEATURE article, NOT a news piece. Write it like a well-researched magazine article:
- Use real examples, specific numbers, and practical tips
- Include personal anecdotes and "insider" knowledge
- Make it feel like advice from a friend who's been there
- 1500-2500 words
- Include practical sections with actionable takeaways
- NO dry policy language — this should be warm, personal, and useful`;

        const fullPrompt = agentData?.basePrompt
            ? `${agentData.basePrompt}\n\n${draftPrompt}`
            : draftPrompt;

        const draftResponse = await xai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: fullPrompt },
                { role: 'user', content: `Write the full article. Return JSON: { "title": "...", "body": "full article in HTML", "excerpt": "2-3 sentence teaser", "metaDescription": "SEO meta description under 160 chars" }` },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
        });

        const draft = JSON.parse(draftResponse.choices[0]?.message?.content || '{}');
        if (draft.body) {
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    title: draft.title || idea.title,
                    body: draft.body,
                    excerpt: draft.excerpt || '',
                    metaDescription: draft.metaDescription || '',
                    status: 'draft',
                    stageUpdatedAt: new Date(),
                },
            });
            console.log(`[feature] Draft generated for: ${draft.title || idea.title}`);
        }
    } catch (draftErr: any) {
        console.error(`[feature] Draft generation failed: ${draftErr.message}`);
    }

    // Send notification to owner
    try {
        const { sendOwnerReport } = await import('./telegram.js');
        await sendOwnerReport(`🧳 <b>Feature Article Created</b>\n\n📝 ${idea.title}\n📂 ${topic.category}\n✍️ ${agentData?.displayName || 'Editorial Team'}\n🏷 ${(idea.tags || []).join(', ')}`);
    } catch { }

    return { created: true, title: idea.title };
}

// ═══════════════════════════════════════════════════════════════
// Weekly Digest — "Week in Immigration" roundup
// ═══════════════════════════════════════════════════════════════

export async function runWeeklyDigest(): Promise<{ created: boolean; title: string }> {
    console.log('[digest] Starting weekly digest...');

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all published articles from the past week
    const weekArticles = await prisma.article.findMany({
        where: {
            status: 'published',
            publishedAt: { gte: weekAgo },
        },
        orderBy: { publishedAt: 'desc' },
        include: {
            agent: { select: { displayName: true, name: true } },
        },
    });

    if (weekArticles.length < 3) {
        console.log(`[digest] Only ${weekArticles.length} articles this week — generating feature instead`);
        // Not enough content for digest, generate a feature instead
        return runFeatureAutopilot();
    }

    // Build summary of the week's articles
    const articleSummaries = weekArticles.map((a, i) =>
        `[${i + 1}] ${a.title} (by ${a.agent?.displayName || a.author || 'Editorial Team'}) — ${a.excerpt?.substring(0, 100) || 'No excerpt'}`
    ).join('\n');

    // Ask AI to create digest
    const digestResponse = await xai.chat.completions.create({
        model: AI_MODEL,
        messages: [
            {
                role: 'system',
                content: `You are the Chief Editor of TheImmigrants.news. Write a compelling "Week in Immigration" digest article.

You have ${weekArticles.length} articles from this week. Create a digest that:
1. Opens with the biggest story of the week
2. Groups related stories by region (Americas, Europe, Asia-Pacific, Global)
3. Highlights 2-3 key takeaways or trends
4. Ends with a "what to watch next week" forward-look
5. References the original articles naturally (use their titles)

This should read like an editorial overview — opinionated, insightful, personal.
Length: 1000-1800 words in HTML format.

Return JSON: { "title": "Week in Immigration: [catchy subtitle]", "body": "full HTML article", "excerpt": "2-3 sentence teaser", "tags": ["weekly-digest", ...], "metaDescription": "SEO meta under 160 chars" }`,
            },
            { role: 'user', content: `This week's articles:\n${articleSummaries}` },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    });

    const digest = JSON.parse(digestResponse.choices[0]?.message?.content || '{}');
    if (!digest.body) {
        console.error('[digest] Failed to generate digest');
        return { created: false, title: '' };
    }

    // Find the editor agent (Robert Singh)
    const editor = await prisma.agent.findFirst({ where: { role: 'editor' } });
    const slug = slugify(digest.title || 'week-in-immigration') + '-' + Date.now().toString(36);

    const article = await prisma.article.create({
        data: {
            title: digest.title || 'Week in Immigration',
            slug,
            body: digest.body,
            excerpt: digest.excerpt || '',
            metaDescription: digest.metaDescription || '',
            tags: digest.tags || ['weekly-digest'],
            language: 'en',
            category: 'weekly-digest',
            status: 'draft',
            author: editor?.displayName || 'Robert Singh',
            agentId: editor?.id || undefined,
            stageUpdatedAt: new Date(),
        },
    });

    console.log(`[digest] Digest created: ${article.id} — ${digest.title}`);

    // Notify owner
    try {
        const { sendOwnerReport } = await import('./telegram.js');
        await sendOwnerReport(`📊 <b>Weekly Digest Created</b>\n\n📝 ${digest.title}\n📰 Based on ${weekArticles.length} articles this week\n✍️ ${editor?.displayName || 'Chief Editor'}`);
    } catch { }

    return { created: true, title: digest.title || 'Week in Immigration' };
}

