import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const COUNTRIES = [
    { code: 'VN', name: 'Vietnam', region: 'southeast-asia', languages: ['vi'], currency: 'VND', flag: '🇻🇳' },
    { code: 'ID', name: 'Indonesia', region: 'southeast-asia', languages: ['id'], currency: 'IDR', flag: '🇮🇩' },
    { code: 'PH', name: 'Philippines', region: 'southeast-asia', languages: ['en', 'fil'], currency: 'PHP', flag: '🇵🇭' },
    { code: 'KH', name: 'Cambodia', region: 'southeast-asia', languages: ['km'], currency: 'KHR', flag: '🇰🇭' },
    { code: 'KR', name: 'South Korea', region: 'east-asia', languages: ['ko'], currency: 'KRW', flag: '🇰🇷' },
    { code: 'TW', name: 'Taiwan', region: 'east-asia', languages: ['zh'], currency: 'TWD', flag: '🇹🇼' },
    { code: 'TR', name: 'Turkey', region: 'europe', languages: ['tr'], currency: 'TRY', flag: '🇹🇷' },
    { code: 'CO', name: 'Colombia', region: 'south-america', languages: ['es'], currency: 'COP', flag: '🇨🇴' },
    { code: 'PE', name: 'Peru', region: 'south-america', languages: ['es'], currency: 'PEN', flag: '🇵🇪' },
    { code: 'CL', name: 'Chile', region: 'south-america', languages: ['es'], currency: 'CLP', flag: '🇨🇱' },
    { code: 'PA', name: 'Panama', region: 'central-america', languages: ['es'], currency: 'PAB', flag: '🇵🇦' },
    { code: 'RS', name: 'Serbia', region: 'europe', languages: ['sr'], currency: 'RSD', flag: '🇷🇸' },
    { code: 'RO', name: 'Romania', region: 'europe', languages: ['ro'], currency: 'RON', flag: '🇷🇴' },
    { code: 'BG', name: 'Bulgaria', region: 'europe', languages: ['bg'], currency: 'BGN', flag: '🇧🇬' },
    { code: 'HU', name: 'Hungary', region: 'europe', languages: ['hu'], currency: 'HUF', flag: '🇭🇺' },
    { code: 'CZ', name: 'Czech Republic', region: 'europe', languages: ['cs'], currency: 'CZK', flag: '🇨🇿' },
    { code: 'EE', name: 'Estonia', region: 'europe', languages: ['et'], currency: 'EUR', flag: '🇪🇪' },
    { code: 'GE', name: 'Georgia', region: 'europe', languages: ['ka'], currency: 'GEL', flag: '🇬🇪' },
    { code: 'ZA', name: 'South Africa', region: 'africa', languages: ['en', 'af'], currency: 'ZAR', flag: '🇿🇦' },
    { code: 'KE', name: 'Kenya', region: 'africa', languages: ['en', 'sw'], currency: 'KES', flag: '🇰🇪' },
    { code: 'EG', name: 'Egypt', region: 'africa', languages: ['ar'], currency: 'EGP', flag: '🇪🇬' },
    { code: 'GR', name: 'Greece', region: 'europe', languages: ['el'], currency: 'EUR', flag: '🇬🇷' },
    { code: 'LK', name: 'Sri Lanka', region: 'south-asia', languages: ['si', 'ta'], currency: 'LKR', flag: '🇱🇰' },
    { code: 'AR', name: 'Argentina', region: 'south-america', languages: ['es'], currency: 'ARS', flag: '🇦🇷' },
];

async function main() {
    console.log(`🌍 Adding ${COUNTRIES.length} countries...`);
    let added = 0;
    for (const c of COUNTRIES) {
        const exists = await prisma.country.findUnique({ where: { code: c.code } });
        if (exists) continue;
        await prisma.country.create({ data: c });
        added++;
    }
    console.log(`✅ Added ${added} countries. Now re-run seed-nomad-cities.ts`);
    await prisma.$disconnect();
}
main();
