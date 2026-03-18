/**
 * Backfill topicType for all existing articles.
 * Uses keyword matching (same logic as category-resolver).
 * Run with: npx tsx backfill-topic-type.ts
 */
import { PrismaClient } from '@prisma/client';
import { resolveTopicType } from './src/services/category-resolver.js';

const prisma = new PrismaClient();

async function main() {
    const articles = await prisma.article.findMany({
        where: { topicType: null },
        select: { id: true, title: true, tags: true, category: true },
    });

    console.log(`Found ${articles.length} articles without topicType`);

    let updated = 0;
    for (const article of articles) {
        const topicType = resolveTopicType(
            (article.tags as string[]) || [],
            article.title,
        );

        await prisma.article.update({
            where: { id: article.id },
            data: { topicType },
        });

        updated++;
        if (updated % 10 === 0) {
            console.log(`  Progress: ${updated}/${articles.length}`);
        }
    }

    console.log(`\nDone: updated ${updated} articles`);

    // Summary
    const summary = await prisma.article.groupBy({
        by: ['topicType'],
        _count: true,
        orderBy: { _count: { topicType: 'desc' } },
    });
    console.log('\nTopic type distribution:');
    for (const row of summary) {
        console.log(`  ${row._count} × ${row.topicType || 'null'}`);
    }

    await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
