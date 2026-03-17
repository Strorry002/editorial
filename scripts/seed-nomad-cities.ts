// Seed missing nomad cities into CostOfLiving table
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Key nomad cities missing from current data
const CITIES = [
    // Southeast Asia
    { city: 'Kuala Lumpur', countryCode: 'MY', overallIndex: 33, averageRent1br: 450, mealCost: 3, internetCost: 18 },
    { city: 'Ho Chi Minh City', countryCode: 'VN', overallIndex: 28, averageRent1br: 380, mealCost: 2, internetCost: 10 },
    { city: 'Hanoi', countryCode: 'VN', overallIndex: 26, averageRent1br: 350, mealCost: 2, internetCost: 10 },
    { city: 'Da Nang', countryCode: 'VN', overallIndex: 24, averageRent1br: 300, mealCost: 2, internetCost: 9 },
    { city: 'Bali', countryCode: 'ID', overallIndex: 30, averageRent1br: 400, mealCost: 3, internetCost: 15 },
    { city: 'Jakarta', countryCode: 'ID', overallIndex: 32, averageRent1br: 420, mealCost: 3, internetCost: 14 },
    { city: 'Manila', countryCode: 'PH', overallIndex: 31, averageRent1br: 350, mealCost: 3, internetCost: 20 },
    { city: 'Phnom Penh', countryCode: 'KH', overallIndex: 27, averageRent1br: 350, mealCost: 3, internetCost: 18 },
    { city: 'Singapore', countryCode: 'SG', overallIndex: 81, averageRent1br: 2200, mealCost: 8, internetCost: 28 },
    // East Asia
    { city: 'Tokyo', countryCode: 'JP', overallIndex: 76, averageRent1br: 1100, mealCost: 8, internetCost: 35 },
    { city: 'Seoul', countryCode: 'KR', overallIndex: 68, averageRent1br: 800, mealCost: 7, internetCost: 22 },
    { city: 'Taipei', countryCode: 'TW', overallIndex: 52, averageRent1br: 650, mealCost: 4, internetCost: 18 },
    // Middle East
    { city: 'Dubai', countryCode: 'AE', overallIndex: 65, averageRent1br: 1500, mealCost: 10, internetCost: 40 },
    { city: 'Istanbul', countryCode: 'TR', overallIndex: 29, averageRent1br: 350, mealCost: 4, internetCost: 12 },
    // South America
    { city: 'Buenos Aires', countryCode: 'AR', overallIndex: 28, averageRent1br: 350, mealCost: 4, internetCost: 16 },
    { city: 'Bogotá', countryCode: 'CO', overallIndex: 27, averageRent1br: 350, mealCost: 3, internetCost: 15 },
    { city: 'Medellín', countryCode: 'CO', overallIndex: 25, averageRent1br: 380, mealCost: 3, internetCost: 14 },
    { city: 'Lima', countryCode: 'PE', overallIndex: 32, averageRent1br: 400, mealCost: 3, internetCost: 18 },
    { city: 'Santiago', countryCode: 'CL', overallIndex: 40, averageRent1br: 500, mealCost: 5, internetCost: 25 },
    // Central America
    { city: 'Playa del Carmen', countryCode: 'MX', overallIndex: 35, averageRent1br: 600, mealCost: 5, internetCost: 22 },
    { city: 'Panama City', countryCode: 'PA', overallIndex: 45, averageRent1br: 700, mealCost: 6, internetCost: 25 },
    // Eastern Europe
    { city: 'Belgrade', countryCode: 'RS', overallIndex: 31, averageRent1br: 400, mealCost: 5, internetCost: 15 },
    { city: 'Bucharest', countryCode: 'RO', overallIndex: 33, averageRent1br: 450, mealCost: 5, internetCost: 10 },
    { city: 'Sofia', countryCode: 'BG', overallIndex: 32, averageRent1br: 400, mealCost: 4, internetCost: 10 },
    { city: 'Budapest', countryCode: 'HU', overallIndex: 40, averageRent1br: 550, mealCost: 6, internetCost: 12 },
    { city: 'Prague', countryCode: 'CZ', overallIndex: 45, averageRent1br: 650, mealCost: 7, internetCost: 14 },
    { city: 'Tallinn', countryCode: 'EE', overallIndex: 48, averageRent1br: 600, mealCost: 8, internetCost: 18 },
    { city: 'Tbilisi', countryCode: 'GE', overallIndex: 27, averageRent1br: 350, mealCost: 4, internetCost: 10 },
    // Africa
    { city: 'Cape Town', countryCode: 'ZA', overallIndex: 35, averageRent1br: 500, mealCost: 5, internetCost: 25 },
    { city: 'Nairobi', countryCode: 'KE', overallIndex: 30, averageRent1br: 400, mealCost: 4, internetCost: 22 },
    // Other
    { city: 'Cairo', countryCode: 'EG', overallIndex: 22, averageRent1br: 250, mealCost: 2, internetCost: 12 },
    { city: 'Athens', countryCode: 'GR', overallIndex: 42, averageRent1br: 500, mealCost: 7, internetCost: 20 },
    { city: 'Colombo', countryCode: 'LK', overallIndex: 25, averageRent1br: 300, mealCost: 2, internetCost: 10 },
    // Oceania
    { city: 'Auckland', countryCode: 'NZ', overallIndex: 72, averageRent1br: 1200, mealCost: 12, internetCost: 40 },
];

async function main() {
    console.log(`🌍 Seeding ${CITIES.length} nomad cities...`);

    // Check existing
    const existing = await prisma.costOfLiving.findMany({ select: { city: true } });
    const existingCities = new Set(existing.map((c: { city: string }) => c.city));

    let added = 0;
    let skipped = 0;

    for (const c of CITIES) {
        if (existingCities.has(c.city)) {
            skipped++;
            continue;
        }

        // Make sure country exists
        const country = await prisma.country.findUnique({ where: { code: c.countryCode } });
        if (!country) {
            console.log(`  ⚠ Country ${c.countryCode} not found, skipping ${c.city}`);
            skipped++;
            continue;
        }

        await prisma.costOfLiving.create({
            data: {
                countryCode: c.countryCode,
                city: c.city,
                period: '2026-Q1',
                overallIndex: c.overallIndex,
                averageRent1br: c.averageRent1br,
                mealCost: c.mealCost,
                internetCost: c.internetCost,
                metadata: {},
            },
        });
        added++;
    }

    const total = await prisma.costOfLiving.count();
    console.log(`✅ Added: ${added}, Skipped: ${skipped}, Total in DB: ${total}`);

    await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
