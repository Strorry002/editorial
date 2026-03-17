import { runAlertsEngine } from './src/services/stats-data-service.js';
import { PrismaClient } from '@prisma/client';

async function main() {
    const prisma = new PrismaClient();
    // Pick 5 interesting cities
    const cities = await prisma.city.findMany({
        where: { slug: { in: ['bangkok', 'istanbul', 'mexico-city', 'kyiv', 'manila'] } },
        select: { id: true, name: true },
    });
    console.log('Testing alerts for:', cities.map(c => c.name).join(', '));
    await prisma.$disconnect();

    const result = await runAlertsEngine(cities.map(c => c.id));
    console.log('Result:', JSON.stringify(result));
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
