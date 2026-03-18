const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const vietnam = await p.country.findFirst({ where: { code: 'VN' } });
    console.log('Vietnam ID:', vietnam.id);

    const newCities = [
        { name: 'Nha Trang', slug: 'nha-trang', lat: 12.2388, lng: 109.1967 },
        { name: 'Phu Quoc', slug: 'phu-quoc', lat: 10.2270, lng: 103.9669 },
    ];

    for (const city of newCities) {
        const exists = await p.city.findFirst({ where: { slug: city.slug } });
        if (exists) {
            console.log('  Already exists:', city.name);
            continue;
        }
        const created = await p.city.create({
            data: {
                name: city.name,
                slug: city.slug,
                lat: city.lat,
                lng: city.lng,
                nomadScore: 0,
                country: { connect: { id: vietnam.id } },
            },
        });
        console.log('  Created:', city.name, created.id);
    }

    // Verify
    const all = await p.city.findMany({ where: { country: { code: 'VN' } }, select: { name: true, slug: true } });
    console.log('All VN cities:', JSON.stringify(all));
    await p.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
