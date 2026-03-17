/**
 * seed-tools-data.ts — Populate VisaProgram + CostOfLiving tables
 * + Add new RSS sources to collector
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════
// VISA PROGRAMS — major programs for each country
// ══════════════════════════════════════════════════════════════
const VISA_PROGRAMS: {
    countryCode: string; type: string; name: string; description: string;
    requirements: object; processingTime: string; duration: string;
    renewability?: string; quotaInfo?: string; approvalRate?: number;
}[] = [
        // 🇺🇸 USA
        { countryCode: 'US', type: 'work', name: 'H-1B Specialty Occupation', description: 'For workers in specialty occupations requiring a bachelor\'s degree or higher.', requirements: { documents: ['Degree certificate', 'Labor Condition Application', 'Job offer letter', 'Employer petition (I-129)'], conditions: ['Bachelor\'s degree minimum', 'Specialty occupation', 'Employer sponsorship required'], fees: { filing_fee: 460, fraud_prevention: 500, premium_processing: 2805 } }, processingTime: '3-6 months', duration: '3 years', renewability: 'Extendable to 6 years', quotaInfo: '85,000/year', approvalRate: 0.72 },
        { countryCode: 'US', type: 'student', name: 'F-1 Student Visa', description: 'For full-time students at SEVP-certified schools.', requirements: { documents: ['I-20 from institution', 'Financial proof', 'SEVIS fee receipt', 'Academic transcripts'], conditions: ['Full-time enrollment', 'Proof of ties to home country', 'English proficiency'], fees: { visa_fee: 185, sevis_fee: 350 } }, processingTime: '2-4 months', duration: 'Duration of program', renewability: 'As long as enrolled', approvalRate: 0.80 },
        { countryCode: 'US', type: 'investment', name: 'EB-5 Immigrant Investor', description: 'Green card through investment in a US commercial enterprise.', requirements: { documents: ['Business plan', 'Source of funds proof', 'I-526 petition'], conditions: ['$800,000 in TEA or $1,050,000 standard', '10 full-time jobs created'], fees: { filing_fee: 3675, visa_fee: 325 } }, processingTime: '24-36 months', duration: 'Permanent (conditional 2yr)', quotaInfo: '10,000/year', approvalRate: 0.65 },
        { countryCode: 'US', type: 'family', name: 'IR-1/CR-1 Spouse Visa', description: 'For spouses of US citizens.', requirements: { documents: ['Marriage certificate', 'Sponsor I-864 affidavit', 'Medical exam'], conditions: ['Legally married', 'Sponsor meets income threshold'], fees: { filing_fee: 535, visa_fee: 325 } }, processingTime: '12-18 months', duration: 'Permanent', approvalRate: 0.88 },

        // 🇬🇧 UK
        { countryCode: 'GB', type: 'work', name: 'Skilled Worker Visa', description: 'For workers with a job offer from a licensed UK sponsor at RQF Level 6.', requirements: { documents: ['Certificate of Sponsorship', 'English B2 proof', 'Financial proof (£1,270)'], conditions: ['Salary ≥£38,700', 'Degree-level role', 'Licensed sponsor'], fees: { visa_fee: 719, healthcare_surcharge: 1035 } }, processingTime: '3 weeks', duration: 'Up to 5 years', renewability: 'Renewable, leads to ILR after 5yr', approvalRate: 0.92 },
        { countryCode: 'GB', type: 'student', name: 'Student Visa', description: 'For study at UK higher education institutions with a Student sponsor.', requirements: { documents: ['CAS from institution', 'Financial proof', 'ATAS certificate (if required)'], conditions: ['Accepted on a course', 'English proficiency B2', 'Maintenance funds'], fees: { visa_fee: 490, healthcare_surcharge: 776 } }, processingTime: '3 weeks', duration: 'Course length + wrap-up', renewability: 'Can switch to Graduate visa', approvalRate: 0.90 },
        { countryCode: 'GB', type: 'work', name: 'Global Talent Visa', description: 'For leaders or potential leaders in academia, arts, digital technology.', requirements: { documents: ['Endorsement letter', 'Evidence of exceptional talent'], conditions: ['Endorsement from recognised body', 'Demonstrated talent/promise'], fees: { visa_fee: 623, endorsement: 456 } }, processingTime: '3-8 weeks', duration: 'Up to 5 years', renewability: 'Renewable, fast ILR track' },

        // 🇨🇦 Canada
        { countryCode: 'CA', type: 'work', name: 'Express Entry (FSW)', description: 'Points-based system for skilled workers. Covers Federal Skilled Worker, CEC, FST.', requirements: { documents: ['ECA degree assessment', 'Language test (IELTS/TEF)', 'Police certificates', 'Medical exam'], conditions: ['CRS score competitive (470+)', 'Education + work experience + language', 'Proof of funds (CAD 13,757+)'], fees: { processing_fee: 850, right_of_pr: 515 } }, processingTime: '6-8 months', duration: 'Permanent', quotaInfo: '~110,000/year from Express Entry', approvalRate: 0.82 },
        { countryCode: 'CA', type: 'student', name: 'Study Permit', description: 'For studying at designated learning institutions in Canada.', requirements: { documents: ['Letter of Acceptance', 'Financial proof (CAD 20,635/yr)', 'Language test'], conditions: ['Accepted at DLI', 'No criminal record', 'Proof of return intent'], fees: { processing_fee: 150 } }, processingTime: '4-16 weeks', duration: 'Course + 90 days', renewability: 'Can apply for PGWP after' },
        { countryCode: 'CA', type: 'work', name: 'Provincial Nominee Program', description: 'Nomination by a Canadian province based on local labor needs.', requirements: { documents: ['Province-specific application', 'Job offer (usually)', 'Settlement funds'], conditions: ['Meet province criteria', 'Intent to live in province'], fees: { provincial_fee: 300, federal_fee: 850 } }, processingTime: '6-18 months', duration: 'Permanent', quotaInfo: '~44,000/year', approvalRate: 0.78 },

        // 🇩🇪 Germany
        { countryCode: 'DE', type: 'work', name: 'EU Blue Card', description: 'Fast-track work permit for highly qualified professionals. Expanded in 2024.', requirements: { documents: ['Degree certificate', 'Employment contract', 'Health insurance'], conditions: ['Annual salary ≥€43,800 (bottleneck: €39,682)', 'University degree', 'Job matching qualification'], fees: { visa_fee: 75, residence_permit: 100 } }, processingTime: '4-8 weeks', duration: '4 years', renewability: 'Leads to settlement permit in 21 months', approvalRate: 0.91 },
        { countryCode: 'DE', type: 'work', name: 'Job Seeker Visa', description: 'Allows qualified professionals to search for employment in Germany.', requirements: { documents: ['Degree certificate', 'CV', 'Financial proof (€11,208/year)'], conditions: ['Recognized degree', 'Sufficient funds for 6 months'], fees: { visa_fee: 75 } }, processingTime: '4-12 weeks', duration: '6 months', renewability: 'Convert to Blue Card if job found' },
        { countryCode: 'DE', type: 'digital_nomad', name: 'Freelancer Visa (§21)', description: 'For self-employed professionals and freelancers.', requirements: { documents: ['Business plan', 'Client contracts', 'Health insurance', 'Financial proof'], conditions: ['Economic interest in Germany', 'Adequate income'], fees: { visa_fee: 75/*, residence: 100*/ } }, processingTime: '4-12 weeks', duration: '1-3 years', renewability: 'Renewable' },

        // 🇫🇷 France
        { countryCode: 'FR', type: 'work', name: 'Talent Passport — Skilled Employee', description: 'Multi-year work permit for highly skilled workers with salary above threshold.', requirements: { documents: ['Work contract', 'Degree certificate', 'Passport'], conditions: ['Salary ≥1.8× minimum wage', 'Master\'s degree or equivalent'], fees: { visa_fee: 99, tax: 225 } }, processingTime: '4-8 weeks', duration: 'Up to 4 years', renewability: 'Renewable', approvalRate: 0.88 },
        { countryCode: 'FR', type: 'student', name: 'Long-Stay Student Visa (VLS-TS)', description: 'For students enrolled at French higher education institutions.', requirements: { documents: ['Campus France registration', 'Enrollment proof', 'Financial proof (€615/mo)'], conditions: ['Accepted at institution', 'Sufficient funds'], fees: { visa_fee: 99, campus_france: 99 } }, processingTime: '2-6 weeks', duration: '1 year', renewability: 'Renewable annually' },

        // 🇳🇱 Netherlands
        { countryCode: 'NL', type: 'work', name: 'Highly Skilled Migrant (Kennismigrant)', description: 'Fast-track permit for skilled workers with Dutch employer sponsorship.', requirements: { documents: ['Employment contract', 'Passport', 'Employer recognition'], conditions: ['Salary ≥€5,331/mo (under 30: €3,909)', 'Recognised sponsor'], fees: { visa_fee: 345 } }, processingTime: '2-4 weeks', duration: 'Contract length (max 5yr)', renewability: 'Renewable', approvalRate: 0.95 },

        // 🇸🇪 Sweden
        { countryCode: 'SE', type: 'work', name: 'Work Permit', description: 'Employer-sponsored work permit with labor market test.', requirements: { documents: ['Job offer', 'Union opinion', 'Passport'], conditions: ['Salary ≥SEK 27,360/mo', 'Terms matching Swedish standards', 'Employer advertisement'], fees: { application_fee: 2000 } }, processingTime: '1-6 months', duration: '2 years', renewability: 'Renewable, PR after 4 years' },

        // 🇪🇸 Spain
        { countryCode: 'ES', type: 'digital_nomad', name: 'Digital Nomad Visa', description: 'For remote workers employed by or contracting with non-Spanish companies.', requirements: { documents: ['Employment contract or client contracts', 'Income proof', 'Health insurance', 'Clean criminal record'], conditions: ['Income ≥200% IPREM (~€2,520/mo)', 'Work for non-Spanish company', 'Professional qualification or 3yr experience'], fees: { visa_fee: 80 } }, processingTime: '20 working days', duration: '1 year', renewability: 'Renewable for 2 years' },
        { countryCode: 'ES', type: 'work', name: 'Non-Lucrative Visa', description: 'For those who can support themselves without working in Spain.', requirements: { documents: ['Financial proof', 'Health insurance', 'Criminal record'], conditions: ['Passive income ≥€2,400/mo', 'No employment in Spain'], fees: { visa_fee: 80 } }, processingTime: '1-3 months', duration: '1 year', renewability: 'Renewable for 2 years' },

        // 🇮🇹 Italy
        { countryCode: 'IT', type: 'digital_nomad', name: 'Digital Nomad Visa', description: 'New visa for remote workers from non-EU countries, launched 2024.', requirements: { documents: ['Employment contract', 'Income proof', 'Accommodation', 'Health insurance'], conditions: ['Income ≥€28,000/year', 'Remote work for non-Italian employer', 'Qualified professional'], fees: { visa_fee: 116 } }, processingTime: '30 days', duration: '1 year', renewability: 'Renewable for 1 year' },

        // 🇦🇹 Austria
        { countryCode: 'AT', type: 'work', name: 'Red-White-Red Card', description: 'Points-based work permit for skilled workers, graduates, and key workers.', requirements: { documents: ['Degree certificate', 'Job offer', 'Language proof'], conditions: ['Minimum points threshold', 'Job offer from Austrian employer'], fees: { application_fee: 160 } }, processingTime: '8-12 weeks', duration: '2 years', renewability: 'Renewable, PR after 5 years' },

        // 🇦🇺 Australia
        { countryCode: 'AU', type: 'work', name: 'Skilled Independent (189)', description: 'Points-tested visa for skilled workers not sponsored by employer or state.', requirements: { documents: ['Skills assessment', 'English test (IELTS 6+)', 'Police clearance'], conditions: ['On skilled occupation list', 'Under 45 years', 'Points ≥65'], fees: { visa_fee: 4640 } }, processingTime: '6-12 months', duration: 'Permanent', quotaInfo: '~16,000/year', approvalRate: 0.70 },
        { countryCode: 'AU', type: 'student', name: 'Student Visa (500)', description: 'For study at registered Australian institutions.', requirements: { documents: ['CoE from institution', 'Financial capacity proof', 'GTE statement', 'English test'], conditions: ['Genuine Temporary Entrant', 'OSHC health insurance'], fees: { visa_fee: 710 } }, processingTime: '4-12 weeks', duration: 'Course length', renewability: 'Can apply for post-study work visa', approvalRate: 0.85 },

        // 🇸🇬 Singapore
        { countryCode: 'SG', type: 'work', name: 'Employment Pass', description: 'For foreign professionals, managers, and executives.', requirements: { documents: ['Employer application', 'Degree certificate', 'Salary details'], conditions: ['Fixed monthly salary ≥SGD 5,600', 'Recognized qualification', 'COMPASS framework points'], fees: { multiple_journey: 225 } }, processingTime: '3 weeks', duration: '2 years', renewability: 'Renewable for 3 years', approvalRate: 0.78 },

        // 🇦🇪 UAE
        { countryCode: 'AE', type: 'investment', name: 'Golden Visa', description: '10-year residency for investors, entrepreneurs, scientists, and outstanding students.', requirements: { documents: ['Investment proof or achievement evidence', 'Passport', 'Medical test'], conditions: ['AED 2M+ investment or exceptional talent'], fees: { visa_fee: 3800 } }, processingTime: '2-4 weeks', duration: '10 years', renewability: 'Renewable' },
        { countryCode: 'AE', type: 'digital_nomad', name: 'Virtual Working Program', description: 'Remote work visa for professionals working for employers outside UAE.', requirements: { documents: ['Employment contract', 'Income proof', 'Health insurance', 'Passport'], conditions: ['Monthly income ≥USD 3,500', 'Employment with non-UAE company'], fees: { visa_fee: 611 } }, processingTime: '5 working days', duration: '1 year', renewability: 'Renewable' },

        // 🇳🇿 New Zealand
        { countryCode: 'NZ', type: 'work', name: 'Skilled Migrant Category', description: 'Points-based residence visa for skilled workers.', requirements: { documents: ['Skills assessment', 'Job offer (bonus)', 'English proof', 'Health and character'], conditions: ['Points ≥160', 'Under 55', 'Skilled employment'], fees: { eoi: 680, visa: 4890 } }, processingTime: '6-12 months', duration: 'Permanent', approvalRate: 0.65 },

        // 🇯🇵 Japan
        { countryCode: 'JP', type: 'work', name: 'Highly Skilled Professional Visa', description: 'Points-based visa with accelerated permanent residency path.', requirements: { documents: ['Academic credentials', 'Employment contract', 'Points calculation sheet'], conditions: ['Points ≥70 (fast PR: ≥80)', 'Sponsoring company in Japan'], fees: { visa_fee: 3000 } }, processingTime: '1-3 months', duration: '5 years', renewability: 'PR after 1-3 years based on points' },
        { countryCode: 'JP', type: 'work', name: 'Specified Skilled Worker (i-Type)', description: 'New visa for workers in 16 designated industries facing labor shortages.', requirements: { documents: ['Skills test pass', 'Japanese language test (N4+)', 'Employer contract'], conditions: ['Pass industry skills exam', 'Japanese N4 level'], fees: { visa_fee: 3000 } }, processingTime: '1-3 months', duration: '5 years', renewability: 'Non-renewable (type i)', quotaInfo: '345,150 total across sectors' },

        // 🇵🇹 Portugal
        { countryCode: 'PT', type: 'digital_nomad', name: 'Digital Nomad Visa (D8)', description: 'For remote workers earning from non-Portuguese sources.', requirements: { documents: ['Employment/freelance proof', 'Income proof', 'Health insurance', 'Accommodation proof'], conditions: ['Income ≥€3,510/mo (4× minimum wage)', 'Work remotely for foreign company'], fees: { visa_fee: 90 } }, processingTime: '1-2 months', duration: '1 year', renewability: 'Renewable for 2 years' },
        { countryCode: 'PT', type: 'work', name: 'Tech Visa', description: 'Streamlined process for tech startups and companies certified by IAPMEI.', requirements: { documents: ['Employment contract', 'Company certification'], conditions: ['Company certified by IAPMEI', 'Tech sector role'], fees: { visa_fee: 90 } }, processingTime: '20 days', duration: '1 year', renewability: 'Renewable' },

        // 🇲🇽 Mexico (if in DB)
        // 🇦🇷 Argentina (if in DB)
    ];

// ══════════════════════════════════════════════════════════════
// COST OF LIVING — Major cities with approximate 2025 data
// ══════════════════════════════════════════════════════════════
const COST_DATA: {
    countryCode: string; city: string;
    overallIndex: number; averageRent1br: number; mealCost: number; internetCost: number;
    rentIndex?: number; groceriesIndex?: number;
}[] = [
        { countryCode: 'US', city: 'New York', overallIndex: 100, averageRent1br: 3200, mealCost: 25, internetCost: 65, rentIndex: 100, groceriesIndex: 100 },
        { countryCode: 'US', city: 'San Francisco', overallIndex: 95, averageRent1br: 2800, mealCost: 22, internetCost: 60 },
        { countryCode: 'US', city: 'Austin', overallIndex: 72, averageRent1br: 1500, mealCost: 18, internetCost: 55 },
        { countryCode: 'GB', city: 'London', overallIndex: 85, averageRent1br: 2200, mealCost: 18, internetCost: 35 },
        { countryCode: 'GB', city: 'Manchester', overallIndex: 62, averageRent1br: 1000, mealCost: 14, internetCost: 30 },
        { countryCode: 'CA', city: 'Toronto', overallIndex: 75, averageRent1br: 1900, mealCost: 18, internetCost: 55 },
        { countryCode: 'CA', city: 'Vancouver', overallIndex: 78, averageRent1br: 2100, mealCost: 19, internetCost: 55 },
        { countryCode: 'CA', city: 'Montreal', overallIndex: 62, averageRent1br: 1300, mealCost: 16, internetCost: 50 },
        { countryCode: 'DE', city: 'Berlin', overallIndex: 58, averageRent1br: 1000, mealCost: 12, internetCost: 30 },
        { countryCode: 'DE', city: 'Munich', overallIndex: 72, averageRent1br: 1500, mealCost: 15, internetCost: 32 },
        { countryCode: 'FR', city: 'Paris', overallIndex: 78, averageRent1br: 1400, mealCost: 16, internetCost: 30 },
        { countryCode: 'NL', city: 'Amsterdam', overallIndex: 76, averageRent1br: 1700, mealCost: 16, internetCost: 40 },
        { countryCode: 'ES', city: 'Madrid', overallIndex: 52, averageRent1br: 1000, mealCost: 12, internetCost: 35 },
        { countryCode: 'ES', city: 'Barcelona', overallIndex: 55, averageRent1br: 1100, mealCost: 13, internetCost: 33 },
        { countryCode: 'ES', city: 'Valencia', overallIndex: 42, averageRent1br: 750, mealCost: 10, internetCost: 30 },
        { countryCode: 'IT', city: 'Milan', overallIndex: 68, averageRent1br: 1200, mealCost: 14, internetCost: 28 },
        { countryCode: 'IT', city: 'Rome', overallIndex: 58, averageRent1br: 900, mealCost: 12, internetCost: 27 },
        { countryCode: 'PT', city: 'Lisbon', overallIndex: 48, averageRent1br: 900, mealCost: 10, internetCost: 32 },
        { countryCode: 'PT', city: 'Porto', overallIndex: 40, averageRent1br: 700, mealCost: 9, internetCost: 30 },
        { countryCode: 'SE', city: 'Stockholm', overallIndex: 70, averageRent1br: 1200, mealCost: 14, internetCost: 30 },
        { countryCode: 'AT', city: 'Vienna', overallIndex: 60, averageRent1br: 950, mealCost: 12, internetCost: 28 },
        { countryCode: 'AU', city: 'Sydney', overallIndex: 80, averageRent1br: 2200, mealCost: 20, internetCost: 60 },
        { countryCode: 'AU', city: 'Melbourne', overallIndex: 72, averageRent1br: 1700, mealCost: 18, internetCost: 55 },
        { countryCode: 'SG', city: 'Singapore', overallIndex: 88, averageRent1br: 2500, mealCost: 10, internetCost: 35 },
        { countryCode: 'AE', city: 'Dubai', overallIndex: 65, averageRent1br: 1600, mealCost: 12, internetCost: 90 },
        { countryCode: 'NZ', city: 'Auckland', overallIndex: 68, averageRent1br: 1400, mealCost: 16, internetCost: 55 },
        { countryCode: 'JP', city: 'Tokyo', overallIndex: 62, averageRent1br: 1100, mealCost: 10, internetCost: 40 },
        { countryCode: 'JP', city: 'Osaka', overallIndex: 52, averageRent1br: 700, mealCost: 8, internetCost: 38 },
        // Emerging nomad destinations
        { countryCode: 'ES', city: 'Malaga', overallIndex: 40, averageRent1br: 700, mealCost: 10, internetCost: 30 },
        { countryCode: 'PT', city: 'Faro (Algarve)', overallIndex: 38, averageRent1br: 650, mealCost: 8, internetCost: 30 },
        { countryCode: 'DE', city: 'Leipzig', overallIndex: 45, averageRent1br: 600, mealCost: 10, internetCost: 28 },
        { countryCode: 'IT', city: 'Bologna', overallIndex: 55, averageRent1br: 800, mealCost: 11, internetCost: 27 },
    ];

async function main() {
    console.log('═══════════════════════════════════════');
    console.log('  🔧 Seeding Frontend Data');
    console.log('═══════════════════════════════════════\n');

    // Check countries
    const countries = await prisma.country.findMany({ select: { code: true } });
    const countryCodes = new Set(countries.map(c => c.code));
    console.log(`📍 ${countryCodes.size} countries in DB: ${[...countryCodes].join(', ')}\n`);

    // Seed Visa Programs
    console.log('🛂 Seeding Visa Programs...');
    let vpAdded = 0;
    for (const vp of VISA_PROGRAMS) {
        if (!countryCodes.has(vp.countryCode)) {
            console.log(`  ⏭️ Skip ${vp.name} — country ${vp.countryCode} not in DB`);
            continue;
        }
        const existing = await prisma.visaProgram.findFirst({
            where: { countryCode: vp.countryCode, name: vp.name },
        });
        if (existing) {
            await prisma.visaProgram.update({ where: { id: existing.id }, data: { ...vp, lastVerified: new Date() } });
        } else {
            await prisma.visaProgram.create({ data: { ...vp, lastVerified: new Date() } });
            vpAdded++;
        }
    }
    const vpTotal = await prisma.visaProgram.count();
    console.log(`  ✅ ${vpAdded} new, ${vpTotal} total visa programs\n`);

    // Seed Cost of Living
    console.log('💰 Seeding Cost of Living...');
    let colAdded = 0;
    for (const col of COST_DATA) {
        if (!countryCodes.has(col.countryCode)) continue;
        const period = '2026-Q1';
        const existing = await prisma.costOfLiving.findFirst({
            where: { countryCode: col.countryCode, city: col.city, period },
        });
        if (existing) {
            await prisma.costOfLiving.update({ where: { id: existing.id }, data: { ...col, period } });
        } else {
            await prisma.costOfLiving.create({ data: { ...col, period, currency: 'USD' } });
            colAdded++;
        }
    }
    const colTotal = await prisma.costOfLiving.count();
    console.log(`  ✅ ${colAdded} new, ${colTotal} total cost entries\n`);

    // Verify via API
    console.log('📊 Final counts:');
    console.log(`  VisaProgram:  ${vpTotal}`);
    console.log(`  CostOfLiving: ${colTotal}`);
    console.log(`  Statistic:    ${await prisma.statistic.count()}`);
    console.log(`  LegalUpdate:  ${await prisma.legalUpdate.count()}`);
    console.log(`  Article:      ${await prisma.article.count()}`);

    await prisma.$disconnect();
    console.log('\n✅ Done!');
    process.exit(0);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
