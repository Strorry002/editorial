/**
 * seed-and-republish.ts — Seed agents, clean old articles, republish with proper authors
 */
import { PrismaClient } from '@prisma/client';
import { seedAgents, assignAgent } from './src/services/editorial-team.js';
import { runAutopilot } from './src/services/autopilot.js';
import { publishToTelegram } from './src/services/telegram.js';
import { publishToFacebook } from './src/services/facebook.js';
import { generateArticleCover } from './src/services/covers.js';

const prisma = new PrismaClient();
const MAX = 3;
const DELAY_MS = 5 * 60 * 1000;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('👥 Step 0: Seeding editorial team...');
    await seedAgents();

    console.log('\n🧹 Step 1: Cleaning old articles...');
    await prisma.articleSource.deleteMany({});
    const deleted = await prisma.article.deleteMany({});
    console.log(`   Deleted ${deleted.count} old articles`);
    await prisma.legalUpdate.updateMany({
        where: { workflowStatus: { not: 'raw' } },
        data: { workflowStatus: 'raw' },
    });

    console.log('\n🤖 Step 2: Autopilot (now with agent assignment)...');
    const ap = await runAutopilot({ autoDraft: true, hoursBack: 168 });
    console.log(`   Created: ${ap.created}, Drafted: ${ap.drafted}`);

    // Get articles
    let articles = await prisma.article.findMany({
        where: { status: { in: ['draft', 'review'] } },
        orderBy: { createdAt: 'desc' },
        take: MAX,
        include: { agent: { select: { displayName: true, avatar: true } } },
    });

    for (const a of articles) {
        await prisma.article.update({ where: { id: a.id }, data: { status: 'approved' } });
    }
    console.log(`\n📄 ${articles.length} articles ready:\n`);
    articles.forEach((a, i) => console.log(`  ${i + 1}. [${a.agent?.displayName || 'NO AGENT'}] ${a.title.substring(0, 60)}`));

    let published = 0;
    for (let i = 0; i < Math.min(articles.length, MAX); i++) {
        const article = articles[i];
        console.log(`\n━━━ [${i + 1}/${MAX}] ${article.title.substring(0, 60)}... ━━━`);
        console.log(`   Author: ${article.agent?.displayName || article.author}`);

        // Cover
        try {
            const fn = `cover-${article.slug.substring(0, 30)}-${Date.now()}.webp`;
            await generateArticleCover(article.title, article.excerpt || '', fn);
            await prisma.article.update({ where: { id: article.id }, data: { coverImage: `/covers/${fn}` } });
            article.coverImage = `/covers/${fn}`;
            console.log('   ✅ Cover');
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
            author: article.agent?.displayName || article.author || 'Editorial Team',
        };

        // TG
        const tg = await publishToTelegram(data);
        console.log(`   TG: ${tg.success ? '✅' : '❌ ' + tg.error}`);

        // FB
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
            console.log(`\n⏳ Wait 5 min...`);
            await sleep(DELAY_MS);
        }
    }

    console.log(`\n✅ Published ${published}/${MAX} with named authors`);
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
