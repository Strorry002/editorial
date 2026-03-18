const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // List last 20 published articles
    const articles = await p.article.findMany({
        where: { status: 'published' },
        select: { id: true, title: true, publishedAt: true, excerpt: true },
        orderBy: { publishedAt: 'desc' },
        take: 20,
    });

    console.log(`\n=== Last ${articles.length} Published Articles ===\n`);

    const IMMIGRATION_KEYWORDS = [
        'immigra', 'visa', 'work permit', 'residence permit', 'green card',
        'citizen', 'naturaliz', 'passport', 'asylum', 'refugee', 'deport',
        'border', 'migrant', 'migrat', 'expat', 'digital nomad', 'nomad',
        'foreign worker', 'talent', 'labor mobil', 'relocation', 'resettle',
        'trafficking', 'smuggl', 'undocumented', 'overstay',
        'h-1b', 'h1b', 'eb-5', 'o-1', 'schengen', 'golden visa',
        'student visa', 'education visa', 'work abroad', 'live abroad',
    ];

    let offTopic = [];
    for (const a of articles) {
        const text = `${a.title} ${a.excerpt || ''}`.toLowerCase();
        const isRelevant = IMMIGRATION_KEYWORDS.some(kw => text.includes(kw));
        const flag = isRelevant ? '✅' : '❌';
        console.log(`${flag} ${a.publishedAt?.toISOString().slice(0, 10)} | ${a.title.substring(0, 70)}`);
        if (!isRelevant) offTopic.push(a.id);
    }

    console.log(`\nOff-topic: ${offTopic.length} / ${articles.length}`);

    // Also check articles in approved/review/draft pipeline
    const pipeline = await p.article.count({ where: { status: { in: ['idea', 'outline', 'draft', 'review', 'approved'] } } });
    console.log(`In pipeline: ${pipeline} articles`);

    await p.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
