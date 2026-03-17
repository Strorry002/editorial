import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Check NomadScore table
    const scores = await prisma.nomadScore.findMany({ take: 10, orderBy: { overall: 'desc' } });
    console.log('Top NomadScores:', scores.map(s => `${s.cityId.slice(0, 8)}: ${s.overall}`));
    console.log('Total NomadScore records:', await prisma.nomadScore.count());

    // Check city.nomadScore field
    const cities = await prisma.city.findMany({
        take: 10,
        orderBy: { nomadScore: 'desc' },
        select: { name: true, nomadScore: true, slug: true }
    });
    console.log('\nTop cities by nomadScore:');
    cities.forEach(c => console.log(`  ${c.name}: ${c.nomadScore}`));

    // Check cities with null nomadScore
    const nullCount = await prisma.city.count({ where: { nomadScore: null } });
    const zeroCount = await prisma.city.count({ where: { nomadScore: 0 } });
    const positiveCount = await prisma.city.count({ where: { nomadScore: { gt: 0 } } });
    console.log(`\nnull: ${nullCount}, zero: ${zeroCount}, positive: ${positiveCount}`);

    await prisma.$disconnect();
}

main().catch(console.error);
