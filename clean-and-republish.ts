/**
 * clean-and-republish.ts — Delete old articles, reset sources, republish in English with covers
 */
import { PrismaClient } from '@prisma/client';
import { runAutopilot, runChiefEditor } from './src/services/autopilot.js';
import { publishToTelegram } from './src/services/telegram.js';
import { publishToFacebook } from './src/services/facebook.js';
import { generateArticleCover } from './src/services/covers.js';

const prisma = new PrismaClient();
const MAX = 5;
const DELAY_MS = 5 * 60 * 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('🧹 Step 0: Cleaning old articles...');
    // Delete article-source links, then articles
    await prisma.articleSource.deleteMany({});
    const deleted = await prisma.article.deleteMany({});
    console.log(`   Deleted ${deleted.count} old articles`);

    // Reset LegalUpdate workflow status so they can be reused
    await prisma.legalUpdate.updateMany({
        where: { workflowStatus: { not: 'raw' } },
        data: { workflowStatus: 'raw' },
    });
    console.log('   Reset LegalUpdate statuses to raw\n');

    console.log('🤖 Step 1: Autopilot (English articles)...');
    const ap = await runAutopilot({ autoDraft: true, hoursBack: 168 });
    console.log(`   Created: ${ap.created}, Drafted: ${ap.drafted}\n`);

    console.log('📋 Step 2: Chief Editor...');
    await runChiefEditor();

    // Get articles
    let articles = await prisma.article.findMany({
        where: { status: 'approved' },
        orderBy: { createdAt: 'desc' },
        take: MAX,
    });

    if (articles.length === 0) {
        const drafts = await prisma.article.findMany({
            where: { status: { in: ['draft', 'review'] } },
            orderBy: { createdAt: 'desc' },
            take: MAX,
        });
        for (const d of drafts) {
            await prisma.article.update({ where: { id: d.id }, data: { status: 'approved' } });
        }
        articles = drafts;
        console.log(`   Auto-approved ${drafts.length} drafts\n`);
    }

    console.log(`📄 ${articles.length} articles ready\n`);

    let published = 0;
    for (let i = 0; i < Math.min(articles.length, MAX); i++) {
        const article = articles[i];
        console.log(`\n━━━ [${i + 1}/${MAX}] ${article.title.substring(0, 60)}... ━━━`);

        // Generate cover
        try {
            console.log('🎨 Generating cover...');
            const fn = `cover-${article.slug.substring(0, 30)}-${Date.now()}.webp`;
            await generateArticleCover(article.title, article.excerpt || '', fn);
            await prisma.article.update({
                where: { id: article.id },
                data: { coverImage: `/covers/${fn}` },
            });
            article.coverImage = `/covers/${fn}`;
        } catch (e: any) {
            console.warn(`   ⚠️ Cover: ${e.message}`);
        }

        const data = {
            title: article.title,
            excerpt: article.excerpt || '',
            body: article.body || '',
            slug: article.slug,
            coverImage: article.coverImage,
            tags: article.tags as string[],
            author: article.author || 'Editorial Team',
        };

        console.log('📱 TG...');
        const tg = await publishToTelegram(data);
        console.log(`   TG: ${tg.success ? '✅' : '❌ ' + tg.error}`);

        console.log('📘 FB...');
        const fb = await publishToFacebook(data);
        console.log(`   FB: ${fb.success ? '✅ ' + fb.postId : '❌ ' + fb.error}`);

        if (tg.success || fb.success) {
            await prisma.article.update({
                where: { id: article.id },
                data: { status: 'published', publishedAt: new Date() },
            });
            published++;
        }

        if (i < MAX - 1) {
            console.log(`\n⏳ Wait 5min (${MAX - i - 1} left)...`);
            await sleep(DELAY_MS);
        }
    }

    console.log(`\n✅ Published ${published}/${MAX}`);
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
