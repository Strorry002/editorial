// Seed tools data: visa programs, cost of living, statistics
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // Get existing countries
    const countries = await prisma.country.findMany();
    console.log(`Found ${countries.length} countries`);

    const countryMap = Object.fromEntries(countries.map(c => [c.code, c]));

    // ── VISA PROGRAMS ──
    const visaPrograms = [
        // USA
        { countryCode: 'US', type: 'work', name: 'H-1B Specialty Occupation', description: 'For workers in specialty occupations requiring at least a bachelor\'s degree', processingTime: '3-8 months', duration: '3 years', renewability: 'Renewable up to 6 years', quotaInfo: '85,000/year', approvalRate: 0.72, requirements: { documents: ['Passport', 'Job Offer', 'LCA', 'Degree Credentials'], conditions: ['Employer sponsor required', 'Specialty occupation', 'Bachelor\'s degree minimum'], fees: { filing: 460, fraud_prevention: 500, ACWIA: 750 } } },
        { countryCode: 'US', type: 'student', name: 'F-1 Student Visa', description: 'For full-time students at accredited US institutions', processingTime: '2-4 months', duration: 'Duration of study', renewability: 'Valid while enrolled', requirements: { documents: ['I-20', 'SEVIS receipt', 'Financial evidence', 'Passport'], fees: { SEVIS: 350, visa_application: 185 } } },
        { countryCode: 'US', type: 'digital_nomad', name: 'No DN Visa (B-1/B-2)', description: 'US has no specific digital nomad visa. Tourists on B-1/B-2 cannot work for US companies.', processingTime: '1-3 months', duration: '6 months', requirements: {} },
        // Canada
        { countryCode: 'CA', type: 'work', name: 'Express Entry', description: 'Points-based system for skilled workers (FSW, CEC, FST programs)', processingTime: '6-8 months', duration: 'Permanent Residence', approvalRate: 0.85, requirements: { documents: ['Language test (IELTS/TEF)', 'Education Credential Assessment', 'Work experience proof'], conditions: ['CRS score above cutoff (~490+)', 'Clean criminal record'] } },
        { countryCode: 'CA', type: 'student', name: 'Study Permit', description: 'For international students at designated learning institutions', processingTime: '4-16 weeks', duration: 'Length of study + 90 days', requirements: { documents: ['Letter of acceptance', 'Proof of funds', 'Language proof'], fees: { application: 150 } } },
        // UK
        { countryCode: 'GB', type: 'work', name: 'Skilled Worker Visa', description: 'For workers with job offer from approved employer at required skill level', processingTime: '3-8 weeks', duration: 'Up to 5 years', renewability: 'Renewable, ILR after 5 years', requirements: { documents: ['Certificate of Sponsorship', 'English language proof', 'Funds proof'], conditions: ['Minimum salary £26,200', 'Job at RQF Level 3+'], fees: { application_3yr: 719, healthcare_surcharge_yearly: 1035 } } },
        { countryCode: 'GB', type: 'digital_nomad', name: 'No DN Visa (Innovator)', description: 'UK has no specific DN visa. Innovator Founder visa for entrepreneurs, High Potential Individual visa for top graduates.', processingTime: '3-8 weeks', duration: '2-3 years', requirements: {} },
        // Germany
        { countryCode: 'DE', type: 'work', name: 'EU Blue Card', description: 'For highly qualified workers with university degree and job offer', processingTime: '4-12 weeks', duration: '4 years', renewability: 'PR after 21-33 months', approvalRate: 0.91, requirements: { documents: ['University degree recognition', 'Employment contract', 'Health insurance'], conditions: ['Minimum salary €45,300 (€41,042 shortage occupations)'], fees: { application: 100 } } },
        { countryCode: 'DE', type: 'digital_nomad', name: 'Freelance Visa', description: 'Self-employment residence permit for freelancers with German clients', processingTime: '4-12 weeks', duration: '1-3 years', renewability: 'Renewable', requirements: { documents: ['Business plan', 'Client letters', 'Financial proof', 'Health insurance'] } },
        // Spain
        { countryCode: 'ES', type: 'digital_nomad', name: 'Digital Nomad Visa', description: 'For remote workers employed by non-Spanish companies', processingTime: '20-45 days', duration: '1 year', renewability: 'Renewable up to 5 years', requirements: { documents: ['Work contract', 'Income proof (€2,646/month)', 'Health insurance', 'Clean criminal record'], fees: { application: 80 } } },
        { countryCode: 'ES', type: 'work', name: 'Non-Lucrative Visa', description: 'For those with sufficient passive income, no work allowed in Spain', processingTime: '1-3 months', duration: '1 year', renewability: 'Renewable', requirements: { conditions: ['Proof of €2,400/month income', 'No intention to work in Spain'] } },
        // Portugal
        { countryCode: 'PT', type: 'digital_nomad', name: 'D8 Digital Nomad Visa', description: 'For remote workers earning at least 4x Portuguese minimum wage', processingTime: '2-3 months', duration: '1 year', renewability: 'Renewable up to 5 years', requirements: { documents: ['Income proof (€3,460/month)', 'Employment contract', 'Health insurance', 'NIF tax number'] } },
        { countryCode: 'PT', type: 'investment', name: 'Golden Visa (reformed)', description: 'Investment-based residence permit, real estate purchases no longer qualifying', processingTime: '6-12 months', duration: '5 years', requirements: { conditions: ['€500K scientific research', '€500K cultural heritage', '€500K investment fund'] } },
        // Australia
        { countryCode: 'AU', type: 'work', name: 'Skilled Independent (189)', description: 'Points-tested visa for skilled workers not sponsored by employer', processingTime: '6-18 months', duration: 'Permanent', approvalRate: 0.78, requirements: { documents: ['Skills assessment', 'English test (IELTS 6+)', 'Points test (65+)'], conditions: ['Occupation on Skilled List'] } },
        // Sweden
        { countryCode: 'SE', type: 'work', name: 'Work Permit', description: 'Employer-sponsored work permit with labor market test', processingTime: '1-4 months', duration: '2 years', renewability: 'Renewable, PR after 4 years', requirements: { documents: ['Job offer meeting conditions', 'Insurance proof'], conditions: ['Salary ≥ SEK 27,360/month', 'Swedish collective agreement terms'] } },
        // Netherlands
        { countryCode: 'NL', type: 'work', name: 'Highly Skilled Migrant', description: 'For knowledge workers with recognized sponsor employer', processingTime: '2-4 weeks', duration: '5 years max', renewability: 'Renewable', approvalRate: 0.93, requirements: { conditions: ['Minimum salary €5,008/month (30+)', '€3,672/month (under 30)', 'Recognized sponsor'] } },
    ];

    let vpCreated = 0;
    for (const vp of visaPrograms) {
        if (!countryMap[vp.countryCode]) continue;
        await prisma.visaProgram.upsert({
            where: { id: `vp-${vp.countryCode}-${vp.type}-${vp.name.substring(0, 20).replace(/\s/g, '')}` },
            update: {},
            create: {
                id: `vp-${vp.countryCode}-${vp.type}-${vp.name.substring(0, 20).replace(/\s/g, '')}`,
                countryCode: vp.countryCode,
                type: vp.type,
                name: vp.name,
                description: vp.description,
                processingTime: vp.processingTime,
                duration: vp.duration,
                renewability: vp.renewability || null,
                quotaInfo: vp.quotaInfo || null,
                approvalRate: vp.approvalRate || null,
                requirements: vp.requirements || {},
                isActive: true,
            },
        });
        vpCreated++;
    }
    console.log(`Visa programs: ${vpCreated} created`);

    // ── COST OF LIVING ──
    const costData = [
        { countryCode: 'US', city: 'New York', rentIndex: 100, groceriesIndex: 100, overallIndex: 100, averageRent1br: 3200, averageRent3br: 5800, mealCost: 25, internetCost: 65 },
        { countryCode: 'US', city: 'Austin', rentIndex: 55, groceriesIndex: 85, overallIndex: 62, averageRent1br: 1450, averageRent3br: 2400, mealCost: 18, internetCost: 60 },
        { countryCode: 'CA', city: 'Toronto', rentIndex: 62, groceriesIndex: 78, overallIndex: 65, averageRent1br: 2100, averageRent3br: 3400, mealCost: 20, internetCost: 55 },
        { countryCode: 'CA', city: 'Vancouver', rentIndex: 68, groceriesIndex: 80, overallIndex: 70, averageRent1br: 2350, averageRent3br: 3800, mealCost: 22, internetCost: 55 },
        { countryCode: 'GB', city: 'London', rentIndex: 85, groceriesIndex: 72, overallIndex: 82, averageRent1br: 2200, averageRent3br: 4200, mealCost: 18, internetCost: 35 },
        { countryCode: 'DE', city: 'Berlin', rentIndex: 42, groceriesIndex: 58, overallIndex: 48, averageRent1br: 1100, averageRent3br: 2000, mealCost: 12, internetCost: 30 },
        { countryCode: 'DE', city: 'Munich', rentIndex: 58, groceriesIndex: 62, overallIndex: 58, averageRent1br: 1500, averageRent3br: 2800, mealCost: 15, internetCost: 32 },
        { countryCode: 'ES', city: 'Barcelona', rentIndex: 38, groceriesIndex: 48, overallIndex: 42, averageRent1br: 1050, averageRent3br: 1900, mealCost: 13, internetCost: 32 },
        { countryCode: 'ES', city: 'Madrid', rentIndex: 35, groceriesIndex: 45, overallIndex: 38, averageRent1br: 950, averageRent3br: 1700, mealCost: 12, internetCost: 30 },
        { countryCode: 'PT', city: 'Lisbon', rentIndex: 32, groceriesIndex: 42, overallIndex: 35, averageRent1br: 900, averageRent3br: 1600, mealCost: 10, internetCost: 28 },
        { countryCode: 'PT', city: 'Porto', rentIndex: 25, groceriesIndex: 38, overallIndex: 28, averageRent1br: 700, averageRent3br: 1200, mealCost: 9, internetCost: 28 },
        { countryCode: 'NL', city: 'Amsterdam', rentIndex: 65, groceriesIndex: 60, overallIndex: 62, averageRent1br: 1800, averageRent3br: 3200, mealCost: 17, internetCost: 40 },
        { countryCode: 'SE', city: 'Stockholm', rentIndex: 55, groceriesIndex: 65, overallIndex: 58, averageRent1br: 1400, averageRent3br: 2500, mealCost: 16, internetCost: 30 },
        { countryCode: 'AU', city: 'Sydney', rentIndex: 72, groceriesIndex: 82, overallIndex: 75, averageRent1br: 2400, averageRent3br: 4000, mealCost: 22, internetCost: 55 },
        { countryCode: 'AU', city: 'Melbourne', rentIndex: 55, groceriesIndex: 75, overallIndex: 60, averageRent1br: 1600, averageRent3br: 2800, mealCost: 18, internetCost: 50 },
        { countryCode: 'TH', city: 'Bangkok', rentIndex: 12, groceriesIndex: 25, overallIndex: 15, averageRent1br: 350, averageRent3br: 650, mealCost: 3, internetCost: 15 },
        { countryCode: 'TH', city: 'Chiang Mai', rentIndex: 8, groceriesIndex: 20, overallIndex: 10, averageRent1br: 250, averageRent3br: 450, mealCost: 2, internetCost: 12 },
        { countryCode: 'MX', city: 'Mexico City', rentIndex: 15, groceriesIndex: 28, overallIndex: 18, averageRent1br: 450, averageRent3br: 850, mealCost: 5, internetCost: 20 },
        { countryCode: 'ID', city: 'Bali', rentIndex: 10, groceriesIndex: 18, overallIndex: 12, averageRent1br: 300, averageRent3br: 550, mealCost: 3, internetCost: 18 },
        { countryCode: 'CO', city: 'Medellín', rentIndex: 10, groceriesIndex: 22, overallIndex: 12, averageRent1br: 350, averageRent3br: 600, mealCost: 4, internetCost: 18 },
    ];

    let colCreated = 0;
    for (const c of costData) {
        if (!countryMap[c.countryCode]) continue;
        const id = `col-${c.countryCode}-${c.city?.replace(/\s/g, '').toLowerCase()}`;
        await prisma.costOfLiving.upsert({
            where: { countryCode_city_period: { countryCode: c.countryCode, city: c.city || '', period: '2026-Q1' } },
            update: { ...c, period: '2026-Q1' },
            create: { ...c, period: '2026-Q1', currency: 'USD' },
        });
        colCreated++;
    }
    console.log(`Cost of living: ${colCreated} cities seeded`);

    // ── STATISTICS ──
    const stats = [
        { countryCode: 'US', category: 'immigration_flow', metric: 'Total Immigrants (2025)', value: 1200000, unit: 'people', period: '2025' },
        { countryCode: 'US', category: 'visa_approval', metric: 'H-1B Approval Rate', value: 72, unit: '%', period: '2025' },
        { countryCode: 'US', category: 'visa_approval', metric: 'Total Visa Applications', value: 8500000, unit: 'applications', period: '2025' },
        { countryCode: 'CA', category: 'immigration_flow', metric: 'Permanent Residents Admitted', value: 500000, unit: 'people', period: '2025' },
        { countryCode: 'CA', category: 'visa_approval', metric: 'Express Entry Invitations', value: 145000, unit: 'invitations', period: '2025' },
        { countryCode: 'GB', category: 'immigration_flow', metric: 'Net Migration', value: 685000, unit: 'people', period: '2025' },
        { countryCode: 'GB', category: 'visa_approval', metric: 'Skilled Worker Visas Granted', value: 189000, unit: 'visas', period: '2025' },
        { countryCode: 'DE', category: 'immigration_flow', metric: 'Immigration Inflow', value: 1460000, unit: 'people', period: '2025' },
        { countryCode: 'DE', category: 'visa_approval', metric: 'Blue Cards Issued', value: 72000, unit: 'cards', period: '2025' },
        { countryCode: 'AU', category: 'immigration_flow', metric: 'Net Overseas Migration', value: 518000, unit: 'people', period: '2025' },
        { countryCode: 'ES', category: 'visa_approval', metric: 'Digital Nomad Visas Issued', value: 8500, unit: 'visas', period: '2025' },
        { countryCode: 'PT', category: 'visa_approval', metric: 'Golden Visas Issued', value: 1200, unit: 'visas', period: '2025' },
        { countryCode: 'NL', category: 'visa_approval', metric: 'Highly Skilled Migrant Permits', value: 18500, unit: 'permits', period: '2025' },
        { countryCode: 'SE', category: 'immigration_flow', metric: 'Asylum Applications', value: 12500, unit: 'applications', period: '2025' },
    ];

    let statsCreated = 0;
    for (const s of stats) {
        if (!countryMap[s.countryCode]) continue;
        await prisma.statistic.upsert({
            where: { id: `stat-${s.countryCode}-${s.metric.replace(/\s/g, '').substring(0, 30)}` },
            update: {},
            create: {
                id: `stat-${s.countryCode}-${s.metric.replace(/\s/g, '').substring(0, 30)}`,
                countryCode: s.countryCode,
                category: s.category,
                metric: s.metric,
                value: s.value,
                unit: s.unit,
                period: s.period,
                sourceUrl: '',
            },
        });
        statsCreated++;
    }
    console.log(`Statistics: ${statsCreated} records seeded`);

    console.log('✅ All tools data seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
