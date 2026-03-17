/**
 * One-time migration script: backfill category for all existing articles.
 * Run with: npx tsx prisma/backfill-categories.ts
 */
import { PrismaClient } from '@prisma/client';
import { resolveCategory } from '../src/services/category-resolver.js';

const prisma = new PrismaClient();

async function backfill() {
    console.log('[backfill] Starting category backfill...');

    // Get all articles without a category
    const articles = await prisma.article.findMany({
        where: { category: null },
        include: {
            sources: {
                include: {
                    update: { select: { countryCode: true, category: true } },
                },
            },
        },
    });

    console.log(`[backfill] Found ${articles.length} articles without category`);

    let updated = 0;
    for (const article of articles) {
        // Get country codes from linked sources
        const countryCodes = [...new Set(
            article.sources
                .map(s => s.update.countryCode)
                .filter(Boolean)
        )];

        // Use title, tags, and country codes to determine category
        const category = resolveCategory(
            countryCodes,
            article.tags as string[],
            article.title,
        );

        await prisma.article.update({
            where: { id: article.id },
            data: { category },
        });

        updated++;
        if (updated % 50 === 0) {
            console.log(`[backfill] Updated ${updated}/${articles.length}`);
        }
    }

    console.log(`[backfill] Done. Updated ${updated} articles.`);
}

backfill()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
