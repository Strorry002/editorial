import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testClimate() {
    // Get 3 cities to test
    const cities = await prisma.city.findMany({ take: 3, select: { id: true, name: true, lat: true, lng: true } });
    console.log('Testing cities:', cities.map(c => c.name).join(', '));

    // Import and run climate engine
    const { runClimateEngine } = await import('./src/services/stats-data-service.js');
    const result = await runClimateEngine(cities.map(c => c.id));
    console.log('Result:', JSON.stringify(result));

    // Verify data
    const climateData = await prisma.cityClimate.findMany({ take: 5 });
    console.log('Climate records:', climateData.length);
    if (climateData.length > 0) {
        console.log('Sample:', JSON.stringify(climateData[0], null, 2));
    }

    await prisma.$disconnect();
}

testClimate().catch(console.error);
