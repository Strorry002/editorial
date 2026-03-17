import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Real digital nomad visa programs (2024-2026 data)
const DN_VISAS = [
    { countryCode: 'ID', name: 'B211A Digital Nomad Visa (Bali)', type: 'digital_nomad', duration: '6 months (renewable)', processingTime: '3-5 days', description: 'Indonesia B211A visa for remote workers. Can be extended for 6 more months. No income tax on foreign-sourced income.' },
    { countryCode: 'TH', name: 'Long-Term Resident Visa (LTR)', type: 'digital_nomad', duration: '5 years', processingTime: '20 business days', description: 'Thailand LTR visa for remote workers. Requires $80K/year income or $250K in assets. 17% flat tax rate.' },
    { countryCode: 'MY', name: 'DE Rantau Nomad Pass', type: 'digital_nomad', duration: '12 months (renewable)', processingTime: '10-15 days', description: 'Malaysia DE Rantau pass for digital professionals. Requires $24K/year income. Access to co-working spaces.' },
    { countryCode: 'KR', name: 'Workcation Visa (Digital Nomad)', type: 'digital_nomad', duration: '1 year (renewable)', processingTime: '15-20 days', description: 'South Korea workcation visa launched 2024. Requires $65K/year income. Full access to Korean healthcare.' },
    { countryCode: 'GR', name: 'Digital Nomad Visa', type: 'digital_nomad', duration: '12 months (renewable)', processingTime: '2-4 weeks', description: 'Greece DN visa. Requires €3,500/month income. 7% flat tax rate for 7 years.' },
    { countryCode: 'CO', name: 'Digital Nomad Visa (V-type)', type: 'digital_nomad', duration: '2 years', processingTime: '5-10 days', description: 'Colombia V-type visa for remote workers. Requires 3x minimum wage (~$2,400/month). No local income tax.' },
    { countryCode: 'GE', name: 'Remotely from Georgia', type: 'digital_nomad', duration: '1 year', processingTime: '1-3 days', description: 'Georgia remotely program. Requires $2,000/month income. No visa fees. Tax-free for first year.' },
    { countryCode: 'EE', name: 'Digital Nomad Visa', type: 'digital_nomad', duration: '1 year', processingTime: '15-30 days', description: 'Estonia DN visa. Requires €3,504/month gross income. Access to e-Residency digital services.' },
    { countryCode: 'RO', name: 'Digital Nomad Visa', type: 'digital_nomad', duration: '12 months (renewable)', processingTime: '30 days', description: 'Romania digital nomad visa launched 2023. Requires €3,700/month income. Access to EU Schengen zone travel.' },
    { countryCode: 'CZ', name: 'Zivno Visa (Freelance)', type: 'digital_nomad', duration: '1 year (renewable)', processingTime: '60-90 days', description: 'Czech Republic freelance/trade visa. Common path for digital nomads. Allows self-employment.' },
    { countryCode: 'HU', name: 'White Card (Digital Nomad)', type: 'digital_nomad', duration: '1 year (renewable)', processingTime: '30 days', description: 'Hungary White Card for remote workers launched 2022. Requires proof of €2,000/month income.' },
    { countryCode: 'RS', name: 'Digital Nomad Permit', type: 'digital_nomad', duration: '1 year', processingTime: '10-15 days', description: 'Serbia digital nomad permit. Tax-free on foreign income. Requires proof of remote employment.' },
    { countryCode: 'ZA', name: 'Remote Working Visa', type: 'digital_nomad', duration: '1 year', processingTime: '30-60 days', description: 'South Africa remote working visa. Requires proof of minimum ZAR 1M/year income (~$55K).' },
    { countryCode: 'LK', name: 'Digital Nomad Visa', type: 'digital_nomad', duration: '1 year', processingTime: '7-14 days', description: 'Sri Lanka DN visa. Requires $2,000/month income. Must have travel insurance. No local income tax.' },
    { countryCode: 'PA', name: 'Remote Worker Visa', type: 'digital_nomad', duration: '9 months (renewable)', processingTime: '30 days', description: 'Panama remote worker visa. Requires $3,000/month income. Territorial tax system — no tax on foreign income.' },
    { countryCode: 'AR', name: 'Digital Nomad Visa (Rentista)', type: 'digital_nomad', duration: '6 months (renewable)', processingTime: '15-30 days', description: 'Argentina digital nomad visa. Requires $1,500/month income. Access to affordable cost of living.' },
    { countryCode: 'TR', name: 'Digital Nomad Residence Permit', type: 'digital_nomad', duration: '1 year', processingTime: '30-45 days', description: 'Turkey residence permit for remote workers. Requires proof of regular income. Low cost of living.' },
];

async function main() {
    console.log(`🛂 Seeding ${DN_VISAS.length} digital nomad visas...`);
    let added = 0;

    for (const v of DN_VISAS) {
        // Check country exists
        const country = await prisma.country.findUnique({ where: { code: v.countryCode } });
        if (!country) {
            console.log(`  ⚠ Country ${v.countryCode} not found`);
            continue;
        }

        // Check if already exists
        const existing = await prisma.visaProgram.findFirst({
            where: { countryCode: v.countryCode, type: 'digital_nomad' }
        });
        if (existing) {
            console.log(`  ⏭ ${v.countryCode} already has DN visa`);
            continue;
        }

        await prisma.visaProgram.create({
            data: {
                countryCode: v.countryCode,
                name: v.name,
                type: v.type,
                duration: v.duration,
                processingTime: v.processingTime,
                description: v.description,
                isActive: true,
            },
        });
        added++;
    }

    const total = await prisma.visaProgram.count({ where: { type: 'digital_nomad' } });
    console.log(`✅ Added: ${added}, Total DN visas in DB: ${total}`);
    await prisma.$disconnect();
}

main();
