const { PrismaClient } = require('@prisma/client');

async function main() {
    const p = new PrismaClient();
    const newCities = await p.city.findMany({
        where: { slug: { in: ['nha-trang', 'phu-quoc'] } },
        select: { id: true, name: true },
    });
    console.log('Cities to scan:', newCities.map(c => c.name));
    const cityIds = newCities.map(c => c.id);
    await p.$disconnect();

    // Run all SDS engines on just these 2 cities
    const sds = await import('./src/services/stats-data-service.js');
    console.log('Running Cost of Living...');
    await sds.runCostOfLivingEngine(cityIds);
    console.log('Running Housing...');
    await sds.runHousingEngine(cityIds);
    console.log('Running Safety...');
    await sds.runSafetyEngine(cityIds);
    console.log('Running Infrastructure...');
    await sds.runInfrastructureEngine(cityIds);
    console.log('Running Lifestyle...');
    await sds.runLifestyleEngine(cityIds);
    console.log('Running Score Calculation...');
    await sds.calculateNomadScores(cityIds);
    console.log('Done!');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
