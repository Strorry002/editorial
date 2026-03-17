/**
 * publish-now.ts — Full Pipeline: Autopilot → Articles → Covers → Publish 5 articles staggered
 * Usage: docker exec editorial-app npx tsx publish-now.ts
 */
import { runAutopilot, runChiefEditor } from './src/services/autopilot.js';
import { publishToTelegram } from './src/services/telegram.js';
import { publishToFacebook } from './src/services/facebook.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const MAX_ARTICLES = 5;
const DELAY_MS = 5 * 60 * 1000; // 5 minutes between posts

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  📰 PUBLISH NOW — Full Pipeline');
    console.log('═══════════════════════════════════════\n');

    // Step 1: Run Autopilot — create articles from raw updates
    console.log('🤖 Step 1: Running Autopilot (create articles from updates)...');
    const autopilotResult = await runAutopilot({ autoDraft: true, hoursBack: 168 }); // 7 days back
    console.log(`   Created: ${autopilotResult.created}, Drafted: ${autopilotResult.drafted}\n`);

    // Step 2: Run Chief Editor — progress articles to approved
    console.log('📋 Step 2: Running Chief Editor (progress to approved)...');
    const editorResult = await runChiefEditor();
    console.log(`   Progressed: ${editorResult.progressed}\n`);

    // Step 3: Get approved articles ready to publish
    const articles = await prisma.article.findMany({
        where: { status: 'approved' },
        include: { agent: true },
        orderBy: { createdAt: 'desc' },
        take: MAX_ARTICLES,
    });

    if (articles.length === 0) {
        // Try getting drafted articles and force-approve them
        console.log('⚠️ No approved articles — checking drafts...');
        const drafts = await prisma.article.findMany({
            where: { status: { in: ['draft', 'review'] } },
            include: { agent: true },
            orderBy: { createdAt: 'desc' },
            take: MAX_ARTICLES,
        });

        if (drafts.length === 0) {
            console.log('❌ No articles available to publish. Run collectors first.');
            process.exit(1);
        }

        // Auto-approve drafts
        for (const draft of drafts) {
            await prisma.article.update({
                where: { id: draft.id },
                data: { status: 'approved', stageUpdatedAt: new Date() },
            });
            articles.push({ ...draft, status: 'approved' });
        }
        console.log(`   Auto-approved ${drafts.length} draft(s)\n`);
    }

    console.log(`📄 ${articles.length} articles ready to publish:\n`);

    // Step 4: Generate covers & publish with stagger
    let published = 0;
    for (let i = 0; i < Math.min(articles.length, MAX_ARTICLES); i++) {
        const article = articles[i];
        console.log(`\n━━━ [${i + 1}/${Math.min(articles.length, MAX_ARTICLES)}] ${article.title.substring(0, 60)}... ━━━`);

        // Generate cover if missing
        if (!article.coverImage) {
            try {
                console.log('🎨 Generating cover image...');
                const { generateArticleCover } = await import('./src/services/covers.js');
                const coverFileName = `cover-${article.slug.substring(0, 30)}-${Date.now()}.webp`;
                await generateArticleCover(article.title, article.excerpt || '', coverFileName);
                await prisma.article.update({
                    where: { id: article.id },
                    data: { coverImage: `/covers/${coverFileName}` },
                });
                article.coverImage = `/covers/${coverFileName}`;
                console.log(`   ✅ Cover: ${coverFileName}`);
            } catch (e: any) {
                console.warn(`   ⚠️ Cover failed: ${e.message}`);
            }
        }

        // Publish to Telegram
        console.log('📱 Publishing to Telegram...');
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
        console.log(`   TG: ${tgResult.success ? '✅' : '❌ ' + tgResult.error}`);

        // Publish to Facebook
        console.log('📘 Publishing to Facebook...');
        const fbResult = await publishToFacebook(articleData);
        console.log(`   FB: ${fbResult.success ? '✅ ID: ' + fbResult.postId : '❌ ' + fbResult.error}`);

        // Update status
        if (tgResult.success || fbResult.success) {
            await prisma.article.update({
                where: { id: article.id },
                data: {
                    status: 'published',
                    publishedAt: new Date(),
                    stageUpdatedAt: new Date(),
                },
            });
            published++;
        }

        // Wait 5 minutes before next post
        if (i < Math.min(articles.length, MAX_ARTICLES) - 1) {
            const next = Math.min(articles.length, MAX_ARTICLES) - i - 1;
            console.log(`\n⏳ Waiting 5 minutes before next post (${next} remaining)...`);
            await sleep(DELAY_MS);
        }
    }

    console.log('\n═══════════════════════════════════════');
    console.log(`  ✅ Published ${published}/${Math.min(articles.length, MAX_ARTICLES)} articles`);
    console.log('═══════════════════════════════════════\n');

    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => {
    console.error('FATAL:', e);
    process.exit(1);
});
