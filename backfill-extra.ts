/**
 * backfill-extra.ts — Add 3 more articles per month (May 2025 → Mar 2026)
 * Based on REAL immigration news events from web research
 * NO social media — site only
 */
import { PrismaClient } from '@prisma/client';
import { getXAIClient, AI_MODEL } from './src/services/ai.js';
import { generateArticleCover } from './src/services/covers.js';
import { assignAgent } from './src/services/editorial-team.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

// ═══════════════════════════════════════════════════════════════
// REAL NEWS TOPICS — based on actual 2025-2026 events
// ═══════════════════════════════════════════════════════════════
const EXTRA_TOPICS: { date: string; title: string }[] = [
    // May 2025 (+3)
    { date: '2025-05-12', title: "UK's Restoring Control White Paper: The Biggest Migration Overhaul in a Decade" },
    { date: '2025-05-18', title: "Birthright Citizenship Under Fire: Legal Challenges to the Executive Order" },
    { date: '2025-05-27', title: "Canada's 2025 Immigration Target: 395,000 New Permanent Residents" },

    // June 2025 (+3)
    { date: '2025-06-08', title: "EU Pact on Migration and Asylum: One Year of Implementation Progress" },
    { date: '2025-06-14', title: "US Mandatory Visa Interviews Return: What It Means for Travelers Worldwide" },
    { date: '2025-06-25', title: "Irregular Border Crossings in Europe Drop 21%: Analyzing the Decline" },

    // July 2025 (+3)
    { date: '2025-07-04', title: "UK Stops Social Care Visa Applications for Overseas Workers" },
    { date: '2025-07-16', title: "US Work Permit Validity Slashed: From Five Years to 18 Months" },
    { date: '2025-07-28', title: "UK Raises Skill Threshold for Sponsored Workers to Degree Level" },

    // August 2025 (+3)
    { date: '2025-08-03', title: "US Suspends Nearly All Refugee Admissions: Humanitarian Impact" },
    { date: '2025-08-14', title: "EU Asylum Applications Fall 23% in First Half of 2025" },
    { date: '2025-08-26', title: "Germany Launches Fast-Track Blue Card Processing for IT Workers" },

    // September 2025 (+3)
    { date: '2025-09-05', title: "US Mandatory Visa Interviews: September Rollout Creates Global Backlogs" },
    { date: '2025-09-16', title: "UK Immigration Skills Charge Set for 32% Increase" },
    { date: '2025-09-28', title: "Canada Announces 50% Cut to International Student Admissions" },

    // October 2025 (+3)
    { date: '2025-10-03', title: "EU Entry/Exit System Goes Live: The End of Passport Stamps in Schengen" },
    { date: '2025-10-14', title: "US Expands Social Media Vetting for H-1B and H-4 Visa Applicants" },
    { date: '2025-10-27', title: "Canada November Immigration Levels Plan: 380,000 Target for 2026" },

    // November 2025 (+3)
    { date: '2025-11-09', title: "Canada Plans to Transition 33,000 Temporary Workers to Permanent Residency" },
    { date: '2025-11-14', title: "UK Border Security, Asylum and Immigration Act 2025 Receives Royal Assent" },
    { date: '2025-11-26', title: "US Dream Act of 2025: Bipartisan Bill Offers Hope for Dreamers" },

    // December 2025 (+3)
    { date: '2025-12-06', title: "US Increases Premium Processing and Visa Integrity Fees" },
    { date: '2025-12-12', title: "UK Immigration Skills Charge Increases 32% from December 16" },
    { date: '2025-12-22', title: "US Expands Social Media Screening for H-1B Applicants: December Update" },

    // January 2026 (+3)
    { date: '2026-01-05', title: "UK Raises English Language Requirement to B2 Level for Skilled Workers" },
    { date: '2026-01-14', title: "US Family Reunification Parole Programs Set for Termination" },
    { date: '2026-01-26', title: "US Immigrant Visa Pause Hits 75 Countries: Who Is Affected" },

    // February 2026 (+3)
    { date: '2026-02-07', title: "EU Entry/Exit System Full Rollout Planned for April 2026" },
    { date: '2026-02-14', title: "US Proposes Restricting Employment Authorization for Asylum Seekers" },
    { date: '2026-02-25', title: "UK Announces Electronic Travel Authorisation Enforcement from Feb 25" },

    // March 2026 (+2 to fill to 5)
    { date: '2026-03-04', title: "UK Visa Brake: Suspended Student Visas for Afghanistan, Cameroon, Myanmar" },
    { date: '2026-03-11', title: "UK Reduces Refugee Protection Duration from 5 Years to 30 Months" },
];

function slugify(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 55)
        + '-bf' + Math.random().toString(36).substring(2, 6);
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log(`  📅 EXTENDED BACKFILL: ${EXTRA_TOPICS.length} articles`);
    console.log('  🔍 Based on real immigration events');
    console.log('  🚫 NO Telegram, NO Facebook');
    console.log('═══════════════════════════════════════\n');

    let total = 0, errors = 0;

    for (const topic of EXTRA_TOPICS) {
        console.log(`\n  [${topic.date}] ${topic.title.substring(0, 60)}...`);

        try {
            // Assign agent
            const tags = topic.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            const agentId = await assignAgent(topic.title, tags);
            const agent = agentId ? await prisma.agent.findUnique({ where: { id: agentId } }) : null;
            console.log(`    👤 ${agent?.displayName || 'Unassigned'}`);

            // Generate article
            const systemPrompt = `${agent?.basePrompt || 'You are a professional immigration law journalist.'}\n\nRules:\n- Write in English\n- Style: informative, analytical, well-researched\n- Structure: intro → key changes → impact analysis → takeaways\n- Use ## Markdown subheadings\n- Length: 800-1200 words\n- Write as if published on ${topic.date}\n- Reference specific policy names, dates, bill numbers where relevant\n- Do NOT mention you are AI`;

            const completion = await xai.chat.completions.create({
                model: AI_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Write a full article: "${topic.title}"\n\nReturn JSON:\n{"title":"headline","excerpt":"2-3 sentences","body":"Markdown article","tags":["tag1","tag2"],"metaDescription":"SEO meta max 160 chars"}` },
                ],
                temperature: 0.7,
                max_tokens: 3000,
                response_format: { type: 'json_object' },
            });

            const raw = completion.choices[0]?.message?.content;
            if (!raw) throw new Error('Empty AI response');
            const result = JSON.parse(raw);

            // Cover
            let coverPath = '';
            try {
                const fn = `cover-${slugify(result.title || topic.title).substring(0, 35)}-${Date.now()}.webp`;
                await generateArticleCover(result.title || topic.title, result.excerpt || '', fn);
                coverPath = `/covers/${fn}`;
                console.log(`    🎨 Cover ✅`);
            } catch (e: any) {
                console.warn(`    ⚠️ Cover: ${e.message.substring(0, 40)}`);
            }

            // Save to DB
            const slug = slugify(result.title || topic.title);
            const publishedAt = new Date(`${topic.date}T${8 + Math.floor(Math.random() * 10)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00Z`);

            await prisma.article.create({
                data: {
                    title: result.title || topic.title,
                    slug,
                    excerpt: result.excerpt || '',
                    body: result.body || '',
                    tags: result.tags?.length ? result.tags : [],
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
            console.log(`    ✅ Done (${topic.date})`);
        } catch (e: any) {
            console.error(`    ❌ ${e.message.substring(0, 60)}`);
            errors++;
        }
    }

    // Verification
    console.log(`\n═══════════════════════════════════════`);
    console.log(`  ✅ Done: ${total} articles, ❌ ${errors} errors`);
    console.log('═══════════════════════════════════════\n');

    console.log('📊 Final distribution:');
    const articles = await prisma.article.findMany({
        where: { status: 'published' },
        orderBy: { publishedAt: 'asc' },
        select: { publishedAt: true, author: true, title: true, coverImage: true },
    });

    const byMonth: Record<string, number> = {};
    for (const a of articles) {
        const m = a.publishedAt?.toISOString().substring(0, 7) || '???';
        byMonth[m] = (byMonth[m] || 0) + 1;
    }
    for (const [m, cnt] of Object.entries(byMonth).sort()) {
        console.log(`  ${m}: ${cnt} articles ${'█'.repeat(cnt)}`);
    }

    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
