// Import static articles from articles-data.json into DB via API
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type StaticArticle = {
    id: number;
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    publishedAt: string;
    category: { slug: string; name: string; abbr: string; color: string };
    author: { name: string; slug: string };
    coverImage?: string;
};

// Map category slug to tags for the DB Article model
function categoryToTags(cat: { slug: string; name: string }): string[] {
    const tags: string[] = [];
    if (cat.slug) tags.push(cat.slug);
    if (cat.name) tags.push(cat.name.toLowerCase());
    return tags;
}

async function main() {
    const json = readFileSync('d:/theimmigrants/lib/articles-data.json', 'utf-8');
    const articles: StaticArticle[] = JSON.parse(json);

    console.log(`📦 Found ${articles.length} static articles to import`);

    // Check existing articles to avoid duplicates
    const existing = await prisma.article.findMany({ select: { slug: true } });
    const existingSlugs = new Set(existing.map((a: { slug: string }) => a.slug));
    console.log(`📊 Already in DB: ${existingSlugs.size} articles`);

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const a of articles) {
        if (!a.slug || !a.title) {
            skipped++;
            continue;
        }

        if (existingSlugs.has(a.slug)) {
            skipped++;
            continue;
        }

        try {
            await prisma.article.create({
                data: {
                    title: a.title,
                    slug: a.slug,
                    excerpt: a.excerpt || '',
                    body: a.content || '',
                    bodyHtml: a.content || '',
                    tags: categoryToTags(a.category),
                    language: /[а-яёА-ЯЁ]/.test(a.title) ? 'ru' : 'en',
                    region: a.category?.slug || null,
                    status: 'published',
                    author: a.author?.name || 'Editorial Team',
                    coverImage: a.coverImage || null,
                    publishedAt: a.publishedAt ? new Date(a.publishedAt) : new Date(),
                },
            });
            imported++;
            if (imported % 50 === 0) console.log(`  ✅ ${imported} imported...`);
        } catch (err) {
            errors++;
            if (errors <= 3) console.error(`  ❌ Error on "${a.slug}":`, (err as Error).message?.substring(0, 100));
        }
    }

    console.log(`\n🎉 Done!`);
    console.log(`  ✅ Imported: ${imported}`);
    console.log(`  ⏭ Skipped (existing/invalid): ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);

    // Final count
    const total = await prisma.article.count();
    console.log(`  📊 Total articles in DB: ${total}`);

    await prisma.$disconnect();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
