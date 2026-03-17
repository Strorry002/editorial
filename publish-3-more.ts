/**
 * publish-3-more.ts — Create 3 more articles from remaining updates and publish
 */
import { PrismaClient } from '@prisma/client';
import { runAutopilot } from './src/services/autopilot.js';
import { publishToTelegram } from './src/services/telegram.js';
import { publishToFacebook } from './src/services/facebook.js';
import { generateArticleCover } from './src/services/covers.js';

const prisma = new PrismaClient();
const MAX = 3;
const DELAY_MS = 5 * 60 * 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('🤖 Creating 3 more articles from remaining updates...');
    const ap = await runAutopilot({ autoDraft: true, hoursBack: 168 });
    console.log(`   Created: ${ap.created}, Drafted: ${ap.drafted}\n`);

    // Get latest articles (draft or idea)
    let articles = await prisma.article.findMany({
        where: { status: { in: ['draft', 'review', 'idea'] } },
        orderBy: { createdAt: 'desc' },
        take: MAX,
    });

    if (articles.length === 0) {
        console.log('❌ No new articles created. All updates may already be used.');
        process.exit(0);
    }

    // Auto-approve
    for (const a of articles) {
        await prisma.article.update({ where: { id: a.id }, data: { status: 'approved' } });
    }
    console.log(`📄 ${articles.length} articles ready\n`);

    let published = 0;
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`\n━━━ [${i + 1}/${articles.length}] ${article.title.substring(0, 70)}... ━━━`);

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
            console.log(`   ✅ Cover saved`);
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

        // Telegram (Russian via adapter)
        console.log('📱 Publishing to Telegram...');
        const tg = await publishToTelegram(data);
        console.log(`   TG: ${tg.success ? '✅' : '❌ ' + tg.error}`);

        // Facebook (English via adapter)
        console.log('📘 Publishing to Facebook...');
        const fb = await publishToFacebook(data);
        console.log(`   FB: ${fb.success ? '✅ ' + fb.postId : '❌ ' + fb.error}`);

        if (tg.success || fb.success) {
            await prisma.article.update({
                where: { id: article.id },
                data: { status: 'published', publishedAt: new Date() },
            });
            published++;
        }

        if (i < articles.length - 1) {
            console.log(`\n⏳ Wait 5 min...`);
            await sleep(DELAY_MS);
        }
    }

    console.log(`\n✅ Published ${published}/${articles.length}`);
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
