/**
 * backfill.ts — Generate backdated articles for May 2025 → Feb 2026
 * 2 articles per month, different topics/authors, with covers
 * NO social media publishing — site only
 */
import { PrismaClient } from '@prisma/client';
import { generateArticleDraft, getXAIClient, AI_MODEL, AI_IMAGE_MODEL } from './src/services/ai.js';
import { generateArticleCover } from './src/services/covers.js';
import { assignAgent } from './src/services/editorial-team.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

// ═══════════════════════════════════════════════════════════════
// TOPIC PLAN — 2 per month, different regions/categories
// ═══════════════════════════════════════════════════════════════
const MONTHLY_TOPICS: { month: string; date1: string; date2: string; topics: [string, string] }[] = [
    {
        month: '2025-05', date1: '2025-05-07', date2: '2025-05-21',
        topics: [
            'New EU Pact on Migration and Asylum: What Changes for Refugees in 2025',
            'Canada Launches Express Entry Reforms: How Skilled Workers Can Benefit',
        ],
    },
    {
        month: '2025-06', date1: '2025-06-04', date2: '2025-06-18',
        topics: [
            'Digital Nomad Visas in Southeast Asia: Thailand and Indonesia Lead the Way',
            'US H-1B Lottery Reform: Major Changes for Tech Workers and Employers',
        ],
    },
    {
        month: '2025-07', date1: '2025-07-09', date2: '2025-07-23',
        topics: [
            'UK Points-Based Immigration System: One Year On — Winners and Losers',
            'Australia Tightens Student Visa Rules: Impact on International Education',
        ],
    },
    {
        month: '2025-08', date1: '2025-08-06', date2: '2025-08-20',
        topics: [
            'Germany Blue Card Expansion: Opening Doors for Non-EU Professionals',
            'US Border Encounters Drop: What the Latest CBP Data Reveals',
        ],
    },
    {
        month: '2025-09', date1: '2025-09-10', date2: '2025-09-24',
        topics: [
            'Spain Golden Visa Ends: What Alternatives Remain for Property Investors',
            'UNHCR Report: Record 120 Million Displaced People Worldwide',
        ],
    },
    {
        month: '2025-10', date1: '2025-10-08', date2: '2025-10-22',
        topics: [
            'Japan Opens New Skilled Worker Visa Categories for 2026',
            'EU Schengen Area Expansion: Romania and Bulgaria Full Entry Impact',
        ],
    },
    {
        month: '2025-11', date1: '2025-11-05', date2: '2025-11-19',
        topics: [
            'UAE Long-Term Visa Reforms: Golden and Green Visa Updates',
            'US Immigration Court Backlog Hits 3.7 Million Cases',
        ],
    },
    {
        month: '2025-12', date1: '2025-12-03', date2: '2025-12-17',
        topics: [
            'Year in Review: The Biggest Immigration Policy Shifts of 2025',
            'Portugal NHR Tax Regime Replacement: What Expats Need to Know',
        ],
    },
    {
        month: '2026-01', date1: '2026-01-08', date2: '2026-01-22',
        topics: [
            'New Year, New Rules: Immigration Changes Taking Effect January 2026',
            'Sweden Tightens Asylum Interview Procedures Under New Coalition',
        ],
    },
    {
        month: '2026-02', date1: '2026-02-04', date2: '2026-02-18',
        topics: [
            'UK Skilled Worker Salary Threshold Increases: The £38,700 Barrier',
            'Latin America Migration Corridors: How Climate Change Reshapes Flows',
        ],
    },
];

function slugify(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 60)
        + '-bf' + Math.random().toString(36).substring(2, 6);
}

function inferTags(title: string): string[] {
    const t = title.toLowerCase();
    const tags: string[] = [];
    if (t.includes('visa')) tags.push('visa');
    if (t.includes('us ') || t.includes('us-') || t.includes('h-1b') || t.includes('cbp')) tags.push('us', 'usa');
    if (t.includes('eu ') || t.includes('schengen') || t.includes('pact')) tags.push('eu', 'europe');
    if (t.includes('uk ') || t.includes('uk ') || t.includes('british')) tags.push('uk', 'europe');
    if (t.includes('canada')) tags.push('canada');
    if (t.includes('australia')) tags.push('australia');
    if (t.includes('germany')) tags.push('germany', 'eu');
    if (t.includes('japan')) tags.push('japan', 'asia');
    if (t.includes('spain')) tags.push('spain', 'eu');
    if (t.includes('sweden')) tags.push('sweden', 'eu');
    if (t.includes('portugal')) tags.push('portugal', 'eu');
    if (t.includes('uae')) tags.push('uae', 'middle-east');
    if (t.includes('nomad') || t.includes('digital')) tags.push('digital-nomad', 'visa');
    if (t.includes('refugee') || t.includes('asylum') || t.includes('displaced') || t.includes('unhcr')) tags.push('refugee', 'humanitarian');
    if (t.includes('border') || t.includes('enforcement')) tags.push('enforcement');
    if (t.includes('climate')) tags.push('climate', 'humanitarian');
    if (t.includes('latin') || t.includes('south america')) tags.push('latin-america');
    if (t.includes('thailand') || t.includes('indonesia') || t.includes('southeast')) tags.push('southeast-asia');
    if (tags.length === 0) tags.push('immigration-policy');
    return [...new Set(tags)];
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════
async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  📅 BACKFILL: May 2025 → Feb 2026');
    console.log('  📝 2 articles/month = 20 total');
    console.log('  🚫 NO Telegram, NO Facebook');
    console.log('═══════════════════════════════════════\n');

    let total = 0;
    let errors = 0;

    for (const monthly of MONTHLY_TOPICS) {
        console.log(`\n📆 ${monthly.month}`);
        console.log('─'.repeat(40));

        for (let i = 0; i < 2; i++) {
            const title = monthly.topics[i];
            const pubDate = i === 0 ? monthly.date1 : monthly.date2;
            const tags = inferTags(title);

            console.log(`\n  [${pubDate}] ${title.substring(0, 55)}...`);

            try {
                // 1. Assign agent
                const agentId = await assignAgent(title, tags);
                const agent = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null;
                console.log(`    👤 ${agent?.displayName || 'Unassigned'}`);

                // 2. Generate article via AI
                const systemPrompt = agent?.basePrompt
                    ? `${agent.basePrompt}\n\nYou are a professional immigration law analyst and journalist.\n\nRules:\n- Write in English\n- Style: informative, analytical, no fluff\n- Structure: intro → key changes → impact analysis → takeaways\n- Use ## Markdown subheadings\n- Length: 800-1500 words\n- Write as if this article was published on ${pubDate}. Reference realistic policy details for this date.\n- Do NOT mention that you are AI — write as a real journalist.`
                    : `You are a professional immigration law analyst and journalist.\n\nRules:\n- Write in English\n- Style: informative, analytical, no fluff\n- Structure: intro → key changes → impact analysis → takeaways\n- Use ## Markdown subheadings\n- Length: 800-1500 words\n- Write as if this article was published on ${pubDate}. Reference realistic policy details.`;

                const completion = await xai.chat.completions.create({
                    model: AI_MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        {
                            role: 'user',
                            content: `Write a full article about: "${title}"\n\nReturn JSON:\n{\n  "title": "final headline",\n  "excerpt": "2-3 sentence summary",\n  "body": "full article in Markdown",\n  "tags": ["tag1", "tag2"],\n  "metaDescription": "SEO meta (max 160 chars)"\n}`,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 3000,
                    response_format: { type: 'json_object' },
                });

                const raw = completion.choices[0]?.message?.content;
                if (!raw) throw new Error('Empty AI response');
                const result = JSON.parse(raw);

                // 3. Generate cover
                let coverPath = '';
                try {
                    const slug = slugify(result.title || title);
                    const fn = `cover-${slug.substring(0, 35)}-${Date.now()}.webp`;
                    await generateArticleCover(result.title || title, result.excerpt || '', fn);
                    coverPath = `/covers/${fn}`;
                    console.log(`    🎨 Cover ✅`);
                } catch (e: any) {
                    console.warn(`    ⚠️ Cover: ${e.message.substring(0, 50)}`);
                }

                // 4. Create article in DB with backdated publishedAt
                const slug = slugify(result.title || title);
                const publishedAt = new Date(`${pubDate}T10:00:00Z`);

                await prisma.article.create({
                    data: {
                        title: result.title || title,
                        slug,
                        excerpt: result.excerpt || '',
                        body: result.body || '',
                        tags: result.tags?.length ? result.tags : tags,
                        metaDescription: result.metaDescription || '',
                        language: 'en',
                        status: 'published',
                        author: agent?.displayName || 'Editorial Team',
                        agentId: agentId || undefined,
                        coverImage: coverPath || undefined,
                        publishedAt,
                        createdAt: publishedAt,
                    },
                });

                total++;
                console.log(`    ✅ Published (backdated ${pubDate})`);
            } catch (e: any) {
                console.error(`    ❌ FAILED: ${e.message.substring(0, 80)}`);
                errors++;
            }
        }
    }

    console.log(`\n═══════════════════════════════════════`);
    console.log(`  ✅ Backfill complete: ${total} articles`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`═══════════════════════════════════════\n`);

    // Verification
    console.log('📊 Verification:');
    const articles = await prisma.article.findMany({
        where: { status: 'published' },
        orderBy: { publishedAt: 'asc' },
        select: { title: true, author: true, publishedAt: true, coverImage: true },
    });
    for (const a of articles) {
        const date = a.publishedAt?.toISOString().substring(0, 10) || '???';
        const cover = a.coverImage ? '🎨' : '  ';
        console.log(`  ${date} ${cover} [${a.author}] ${a.title.substring(0, 50)}`);
    }

    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
