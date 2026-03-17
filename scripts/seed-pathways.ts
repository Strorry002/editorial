import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Major visa programs by pathway (type) for popular immigration countries
const PROGRAMS = [
    // ── STUDY ──
    { countryCode: 'US', type: 'student', name: 'F-1 Student Visa', duration: '4+ years', processingTime: '2-4 months', description: 'For full-time students at accredited US universities. OPT work authorization for 12 months post-graduation (36 months for STEM).' },
    { countryCode: 'CA', type: 'student', name: 'Study Permit', duration: 'Length of program', processingTime: '4-16 weeks', description: 'Canadian study permit with PGWP (Post-Graduation Work Permit) pathway to permanent residency.' },
    { countryCode: 'GB', type: 'student', name: 'Student Visa (Tier 4)', duration: '5+ years', processingTime: '3-6 weeks', description: 'UK student visa. Graduate Route allows 2-year work after graduation (3 years for PhD).' },
    { countryCode: 'DE', type: 'student', name: 'Student Visa (§16b)', duration: '2-5 years', processingTime: '4-12 weeks', description: 'Germany has tuition-free public universities. 18-month job-seeker visa after graduation.' },
    { countryCode: 'AU', type: 'student', name: 'Student Visa (Subclass 500)', duration: '5 years', processingTime: '4-6 weeks', description: 'Australian study visa with 48-hour/fortnight work rights. Post-study work visa available.' },
    { countryCode: 'NL', type: 'student', name: 'Student Residence Permit (MVV)', duration: 'Length of program', processingTime: '4-8 weeks', description: 'Orientation year (zoekjaar) visa after graduation allows 12 months to find work.' },
    { countryCode: 'SE', type: 'student', name: 'Student Residence Permit', duration: '1-5 years', processingTime: '4-8 weeks', description: 'Swedish study permit. Free tuition for EU/EEA. 6-month post-study extension.' },
    { countryCode: 'CZ', type: 'student', name: 'Student Long-term Visa', duration: '1-2 years', processingTime: '60-90 days', description: 'Czech Republic student visa. Very affordable tuition in Czech language programs. English programs ~$5-10K/year.' },
    { countryCode: 'MY', type: 'student', name: 'Student Pass', duration: 'Length of program', processingTime: '4-8 weeks', description: 'Malaysia student pass. Affordable tuition ($3-8K/year). Can work part-time 20 hours/week.' },
    { countryCode: 'JP', type: 'student', name: 'Student Visa (ryugaku)', duration: '2-4 years', processingTime: '2-4 weeks', description: 'Japan student visa. Many scholarships available (MEXT). Can work 28 hours/week.' },

    // ── WORK ──
    { countryCode: 'US', type: 'work', name: 'H-1B Specialty Occupation', duration: '3 years (renewable)', processingTime: '3-6 months', description: 'US work visa for specialty occupations. Annual lottery cap of 85,000. Bachelor\'s degree minimum. Employer sponsorship required.' },
    { countryCode: 'US', type: 'work', name: 'EB-2/EB-3 Green Card', duration: 'Permanent', processingTime: '1-3 years', description: 'Employment-based green card through PERM labor certification. EB-2 for advanced degrees, EB-3 for skilled workers.' },
    { countryCode: 'CA', type: 'work', name: 'Express Entry (Federal Skilled Worker)', duration: 'Permanent', processingTime: '6 months', description: 'Canada\'s points-based PR system. CRS score determines invitation. No employer sponsorship needed.' },
    { countryCode: 'DE', type: 'work', name: 'EU Blue Card', duration: '4 years', processingTime: '2-4 weeks', description: 'EU-wide work permit for skilled workers. €45,300/year salary minimum (€41,000 for shortage occupations). Path to PR after 21 months.' },
    { countryCode: 'GB', type: 'work', name: 'Skilled Worker Visa', duration: '5 years', processingTime: '3-8 weeks', description: 'UK points-based work visa. Needs employer sponsorship + £38,700/year salary (or going rate). Path to ILR after 5 years.' },
    { countryCode: 'AU', type: 'work', name: 'Skilled Nominated (Subclass 190)', duration: 'Permanent', processingTime: '6-12 months', description: 'State-nominated skilled migration to Australia. Requires occupation on skilled list + state nomination.' },
    { countryCode: 'NL', type: 'work', name: 'Highly Skilled Migrant (Kennismigrant)', duration: '5 years', processingTime: '2-4 weeks', description: 'Dutch work permit for skilled workers. €5,331/month salary minimum (2025). 30% ruling tax benefit.' },
    { countryCode: 'SG', type: 'work', name: 'Employment Pass (EP)', duration: '2 years', processingTime: '3-8 weeks', description: 'Singapore work pass for professionals. COMPASS points system. S$5,000/month minimum salary.' },
    { countryCode: 'AE', type: 'work', name: 'Golden Visa (Skilled)', duration: '10 years', processingTime: '30 days', description: 'UAE Golden Visa for skilled professionals. Requires relevant degree + AED 30,000/month salary or specialized talent.' },
    { countryCode: 'KR', type: 'work', name: 'E-7 Professional Visa', duration: '1-3 years', processingTime: '4-8 weeks', description: 'South Korea work permit for foreign professionals. Employer sponsorship + relevant degree required.' },

    // ── BUSINESS / INVESTMENT ──
    { countryCode: 'US', type: 'investment', name: 'EB-5 Investor Visa', duration: 'Permanent', processingTime: '1-3 years', description: 'US investor green card. $800,000 investment in TEA or $1,050,000 standard. Must create 10+ jobs.' },
    { countryCode: 'GB', type: 'investment', name: 'Innovator Founder Visa', duration: '3 years', processingTime: '3-8 weeks', description: 'UK visa for innovative business founders. Requires endorsement from approved body. Path to ILR.' },
    { countryCode: 'PT', type: 'investment', name: 'Golden Visa (Investment)', duration: '5 years', processingTime: '6-12 months', description: 'Portugal Golden Visa. Fund investment from €500,000. Minimum 7 days/year residency. Path to citizenship after 5 years.' },
    { countryCode: 'ES', type: 'investment', name: 'Golden Visa', duration: '2 years (renewable)', processingTime: '20 business days', description: 'Spain investor visa. €500,000 real estate or €1M financial assets. Schengen access included.' },
    { countryCode: 'GR', type: 'investment', name: 'Golden Visa', duration: '5 years', processingTime: '2-3 months', description: 'Greece Golden Visa. €250,000 real estate investment (€500K in Athens/islands). Cheapest EU golden visa.' },
    { countryCode: 'NL', type: 'investment', name: 'Startup Visa', duration: '1 year', processingTime: '4-8 weeks', description: 'Netherlands startup visa with facilitator. Innovative business idea required. Can convert to self-employment after.' },
    { countryCode: 'CA', type: 'investment', name: 'Startup Visa Program', duration: 'Permanent', processingTime: '12-16 months', description: 'Canada startup visa — permanent residency for entrepreneurs. Needs letter of support from designated organization.' },
    { countryCode: 'EE', type: 'investment', name: 'Startup Visa', duration: '18 months', processingTime: '30-60 days', description: 'Estonia startup visa. Digital-first environment with e-Residency. Must have scalable business idea.' },
    { countryCode: 'AE', type: 'investment', name: 'Investor Visa', duration: '10 years', processingTime: '30 days', description: 'UAE investor visa for AED 2M+ investment. Golden Visa program. 0% personal income tax.' },

    // ── FAMILY ──
    { countryCode: 'US', type: 'family', name: 'IR-1/CR-1 Spousal Visa', duration: 'Permanent', processingTime: '12-24 months', description: 'US spouse visa for married couples. Green card through marriage. Sponsor must meet income requirements (125% poverty line).' },
    { countryCode: 'CA', type: 'family', name: 'Spousal Sponsorship', duration: 'Permanent', processingTime: '12-18 months', description: 'Canada spousal sponsorship for PR. Sponsor must be PR or citizen. No minimum income requirement.' },
    { countryCode: 'DE', type: 'family', name: 'Family Reunification Visa', duration: '1-3 years', processingTime: '4-12 weeks', description: 'Germany family reunion. Spouse needs basic German (A1). Path to permanent settlement permit.' },
    { countryCode: 'AU', type: 'family', name: 'Partner Visa (Subclass 820/801)', duration: 'Permanent (2 stages)', processingTime: '12-24 months', description: 'Australia partner visa. Two-stage: temporary then permanent. De facto or married couples.' },
    { countryCode: 'GB', type: 'family', name: 'Spouse Visa', duration: '2.5 years (x2)', processingTime: '12-24 weeks', description: 'UK spouse visa. UK sponsor needs £29,000/year income (2025). Path to ILR after 5 years.' },

    // ── RETIREMENT ──
    { countryCode: 'PT', type: 'tourist', name: 'D7 Passive Income Visa', duration: '2 years (renewable)', processingTime: '2-4 months', description: 'Portugal D7 visa for retirees/passive income. €760/month minimum income. Path to citizenship. Popular with retirees.' },
    { countryCode: 'TH', type: 'tourist', name: 'Retirement Visa (O-A)', duration: '1 year (renewable)', processingTime: '2-4 weeks', description: 'Thailand retirement visa. Age 50+. 800,000 THB (~$22,000) in bank or 65,000 THB/month income.' },
    { countryCode: 'MY', type: 'tourist', name: 'MM2H (Malaysia My 2nd Home)', duration: '5 years (renewable)', processingTime: '3-6 months', description: 'Malaysia long-stay program. Age 35+. RM500K liquid assets + RM40K/month income. Deposit required.' },
    { countryCode: 'PA', type: 'tourist', name: 'Pensionado Visa', duration: 'Permanent', processingTime: '3-6 months', description: 'Panama retirement visa. $1,000/month pension income. Massive retiree discounts (up to 50%). Very popular.' },
    { countryCode: 'ES', type: 'tourist', name: 'Non-Lucrative Visa', duration: '1 year (renewable)', processingTime: '30-60 days', description: 'Spain non-work visa for retirees. €28,800/year passive income. Cannot work. Path to PR after 5 years.' },
    { countryCode: 'MX', type: 'tourist', name: 'Temporary Resident Visa (Retirement)', duration: '4 years', processingTime: '2-4 weeks', description: 'Mexico temporary residency. $2,500/month income or $42,000 savings. Affordable cost of living.' },
    { countryCode: 'ID', type: 'tourist', name: 'Retirement KITAS (Index 319)', duration: '1 year (renewable)', processingTime: '4-6 weeks', description: 'Indonesia retirement visa. Age 55+. $1,500/month pension + health insurance. Popular for Bali living.' },

    // ── FREELANCE / SELF-EMPLOYED ──
    { countryCode: 'DE', type: 'work', name: 'Freelance Visa (§21 AufenthG)', duration: '3 years', processingTime: '4-12 weeks', description: 'Germany self-employment/freelance visa. Must demonstrate economic interest or regional need. Very popular with creatives.' },
    { countryCode: 'NL', type: 'work', name: 'DAFT Visa (US Citizens)', duration: '2 years', processingTime: '4-8 weeks', description: 'Dutch-American Friendship Treaty visa. €4,500 investment minimum for US citizens. Self-employment in Netherlands.' },
    { countryCode: 'FR', type: 'work', name: 'Talent Passport (Self-Employed)', duration: '4 years', processingTime: '4-8 weeks', description: 'France talent passport for entrepreneurs and freelancers. Must show viable business plan and sufficient funds.' },
];

async function main() {
    console.log(`🛂 Seeding ${PROGRAMS.length} visa programs across all pathways...`);
    let added = 0, skipped = 0;

    for (const p of PROGRAMS) {
        // Check country exists
        const country = await prisma.country.findUnique({ where: { code: p.countryCode } });
        if (!country) {
            console.log(`  ⚠ Country ${p.countryCode} not found, skipping ${p.name}`);
            skipped++;
            continue;
        }

        // Check if already exists by name
        const existing = await prisma.visaProgram.findFirst({
            where: { countryCode: p.countryCode, name: p.name }
        });
        if (existing) {
            skipped++;
            continue;
        }

        await prisma.visaProgram.create({
            data: {
                countryCode: p.countryCode,
                type: p.type,
                name: p.name,
                duration: p.duration,
                processingTime: p.processingTime,
                description: p.description,
                isActive: true,
            },
        });
        added++;
    }

    const total = await prisma.visaProgram.count();
    const byType = await prisma.visaProgram.groupBy({ by: ['type'], _count: true });
    console.log(`\n✅ Added: ${added}, Skipped: ${skipped}, Total programs: ${total}`);
    console.log('By type:', byType.map(t => `${t.type}: ${t._count}`).join(', '));
    await prisma.$disconnect();
}

main();
