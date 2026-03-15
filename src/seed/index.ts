import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function seed() {
    console.log('🌱 Seeding immigration data...');

    // =========================================================================
    // COUNTRIES
    // =========================================================================
    const countries = [
        { code: 'US', name: 'United States', region: 'north-america', languages: ['en'], currency: 'USD', capitalCity: 'Washington, D.C.', flag: '🇺🇸', timezone: 'America/New_York' },
        { code: 'CA', name: 'Canada', region: 'north-america', languages: ['en', 'fr'], currency: 'CAD', capitalCity: 'Ottawa', flag: '🇨🇦', timezone: 'America/Toronto' },
        { code: 'GB', name: 'United Kingdom', region: 'europe', languages: ['en'], currency: 'GBP', capitalCity: 'London', flag: '🇬🇧', timezone: 'Europe/London' },
        { code: 'AU', name: 'Australia', region: 'oceania', languages: ['en'], currency: 'AUD', capitalCity: 'Canberra', flag: '🇦🇺', timezone: 'Australia/Sydney' },
        { code: 'DE', name: 'Germany', region: 'europe', languages: ['de'], currency: 'EUR', capitalCity: 'Berlin', flag: '🇩🇪', timezone: 'Europe/Berlin' },
    ];

    for (const c of countries) {
        await prisma.country.upsert({ where: { code: c.code }, update: c, create: c });
    }
    console.log(`  ✅ ${countries.length} countries`);

    // =========================================================================
    // VISA PROGRAMS
    // =========================================================================
    const visaPrograms = [
        // --- United States ---
        { countryCode: 'US', type: 'work', name: 'H-1B Specialty Occupation', description: 'For workers in specialty occupations requiring at least a bachelor\'s degree', processingTime: '3-8 months', duration: '3 years', renewability: 'Renewable up to 6 years', quotaInfo: '85,000/year (65k regular + 20k advanced degree)', approvalRate: 0.72, officialUrl: 'https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations', requirements: { fees: { filing: 460, acwia: 1500, fraud: 500 }, documents: ['Job offer', 'Bachelor\'s degree or higher', 'Labor Condition Application'], conditions: ['Employer sponsorship required', 'Lottery selection', 'Prevailing wage requirement'] } },
        { countryCode: 'US', type: 'work', name: 'L-1 Intracompany Transfer', description: 'For employees transferred within the same company to a US office', processingTime: '2-6 months', duration: '5-7 years', renewability: 'L-1A: 7 years max, L-1B: 5 years max', requirements: { documents: ['Employment with company for 1+ year', 'Manager/executive or specialized knowledge'], conditions: ['Must have worked abroad for 1 year in past 3 years'] } },
        { countryCode: 'US', type: 'work', name: 'O-1 Extraordinary Ability', description: 'For individuals with extraordinary ability in sciences, arts, education, business, or athletics', processingTime: '1-3 months', duration: '3 years', renewability: 'Renewable in 1-year increments', requirements: { documents: ['Evidence of extraordinary ability', 'Advisory opinion from peer group'], conditions: ['Must demonstrate sustained national/international acclaim'] } },
        { countryCode: 'US', type: 'student', name: 'F-1 Student Visa', description: 'For academic students enrolled in accredited institutions', processingTime: '2-4 months', duration: 'Duration of study', renewability: 'Valid throughout program', requirements: { fees: { sevis: 350, application: 185 }, documents: ['I-20 from school', 'Proof of finances', 'Valid passport'], conditions: ['Full-time enrollment', 'Sufficient funds'] } },
        { countryCode: 'US', type: 'investment', name: 'EB-5 Investor', description: 'Immigrant visa for foreign investors creating jobs in the US', processingTime: '24-52 months', duration: 'Permanent (conditional 2 years)', requirements: { fees: { investment_min: 800000, investment_standard: 1050000 }, documents: ['Source of funds documentation', 'Business plan creating 10+ jobs'], conditions: ['$800K in TEA or $1.05M standard investment'] } },
        { countryCode: 'US', type: 'family', name: 'CR/IR Family-Based', description: 'For immediate relatives of US citizens', processingTime: '12-24 months', duration: 'Permanent', requirements: { documents: ['Proof of relationship', 'Affidavit of support', 'Medical exam'], conditions: ['US citizen petitioner required'] } },

        // --- Canada ---
        { countryCode: 'CA', type: 'work', name: 'Express Entry (Federal Skilled Worker)', description: 'Points-based system for skilled workers. CRS score determines invitation', processingTime: '6 months', duration: 'Permanent residence', approvalRate: 0.85, officialUrl: 'https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry.html', requirements: { fees: { processing: 850, right_of_pr: 515 }, documents: ['Language test (IELTS/TEF)', 'Education credential assessment', 'Proof of work experience'], conditions: ['CRS score above cutoff (~500+)', 'NOC TEER 0/1/2/3 occupation', '1+ year skilled work experience'] } },
        { countryCode: 'CA', type: 'work', name: 'Provincial Nominee Program (PNP)', description: 'Provincial/territorial programs for workers nominated by a province', processingTime: '6-18 months', duration: 'Permanent residence', requirements: { conditions: ['Nomination from province', 'Meet provincial criteria', 'Intent to live in province'] } },
        { countryCode: 'CA', type: 'work', name: 'Temporary Foreign Worker Program', description: 'Employer-specific work permits with LMIA', processingTime: '2-6 months', duration: '1-2 years', renewability: 'Renewable', requirements: { documents: ['LMIA from employer', 'Job offer'], conditions: ['Employer must prove no Canadian available'] } },
        { countryCode: 'CA', type: 'student', name: 'Study Permit', description: 'For international students at designated learning institutions', processingTime: '4-16 weeks', duration: 'Duration of study + 90 days', requirements: { fees: { application: 150 }, documents: ['Letter of acceptance from DLI', 'Proof of funds', 'Provincial attestation letter'], conditions: ['Accepted at DLI', 'Sufficient funds'] } },
        { countryCode: 'CA', type: 'digital_nomad', name: 'Digital Nomad Strategy', description: 'Canada doesn\'t have a specific DN visa, but allows remote work on visitor visa up to 6 months', duration: '6 months', requirements: { conditions: ['Employer outside Canada', 'No Canadian income'] } },

        // --- United Kingdom ---
        { countryCode: 'GB', type: 'work', name: 'Skilled Worker Visa', description: 'Points-based visa for workers with job offer from approved sponsor', processingTime: '3-8 weeks', duration: 'Up to 5 years', renewability: 'Renewable, path to ILR after 5 years', officialUrl: 'https://www.gov.uk/skilled-worker-visa', requirements: { fees: { application: 719, healthcare_surcharge_yearly: 1035 }, documents: ['Certificate of sponsorship', 'English proficiency B1+', 'Salary evidence'], conditions: ['Job from approved sponsor', 'Minimum salary £38,700', 'English B1 level'] } },
        { countryCode: 'GB', type: 'work', name: 'Global Talent Visa', description: 'For leaders and potential leaders in academia, research, arts, and digital technology', processingTime: '2-8 weeks', duration: 'Up to 5 years', requirements: { fees: { endorsement: 524, application: 192 }, documents: ['Endorsement from approved body', 'Evidence of talent/promise'], conditions: ['Endorsement from Tech Nation/Royal Society/Arts Council/UKRI'] } },
        { countryCode: 'GB', type: 'student', name: 'Student Visa', description: 'For students with confirmed place at licensed institution', processingTime: '3-6 weeks', duration: 'Duration of course', requirements: { fees: { application: 490, healthcare_surcharge_yearly: 776 }, documents: ['CAS from institution', 'Proof of funds', 'ATAS certificate if required'], conditions: ['Confirmed place', 'English B2+', 'Sufficient funds'] } },

        // --- Australia ---
        { countryCode: 'AU', type: 'work', name: 'Skilled Independent Visa (Subclass 189)', description: 'Points-based permanent visa for skilled workers not sponsored by employer/state', processingTime: '6-12 months', duration: 'Permanent', officialUrl: 'https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/skilled-independent-189', requirements: { fees: { application: 4640 }, documents: ['Skills assessment', 'English proficiency', 'EOI via SkillSelect'], conditions: ['Occupation on skilled list', 'Points test 65+', 'Under 45 years', 'Competent English'] } },
        { countryCode: 'AU', type: 'work', name: 'Temporary Skill Shortage (Subclass 482)', description: 'Employer-sponsored temporary work visa', processingTime: '1-4 months', duration: '2-4 years', renewability: 'Renewable', requirements: { fees: { application: 1455 }, documents: ['Nomination from employer', 'Skills assessment', 'English proficiency'], conditions: ['Employer sponsorship', '2 years relevant experience', 'Occupation on skills list'] } },
        { countryCode: 'AU', type: 'digital_nomad', name: 'Digital Nomad Visa (proposed)', description: 'Australia has been discussing a DN visa program. Currently no specific visa exists.', duration: 'TBD', requirements: { conditions: ['Not yet available — use Working Holiday or Business Visitor'] } },
        { countryCode: 'AU', type: 'student', name: 'Student Visa (Subclass 500)', description: 'For international students enrolled in registered courses', processingTime: '1-3 months', duration: 'Duration of course', requirements: { fees: { application: 1600 }, documents: ['CoE from provider', 'OSHC insurance', 'English proficiency', 'Financial capacity'], conditions: ['Genuine temporary entrant (GTE)', 'Health and character requirements'] } },

        // --- Germany ---
        { countryCode: 'DE', type: 'work', name: 'EU Blue Card', description: 'For highly qualified non-EU workers with university degree and job offer', processingTime: '1-3 months', duration: 'Up to 4 years', renewability: 'Path to permanent residence after 21-33 months', officialUrl: 'https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card', requirements: { fees: { application: 100 }, documents: ['Job offer/contract', 'Recognized degree', 'Health insurance'], conditions: ['Minimum salary €43,800 (bottleneck) or €56,400 (standard)', 'University degree', 'Job relevant to degree'] } },
        { countryCode: 'DE', type: 'work', name: 'Job Seeker Visa', description: 'Allows qualified professionals to come to Germany to look for work', processingTime: '1-3 months', duration: '6 months', requirements: { fees: { application: 75 }, documents: ['Recognized degree', 'Proof of funds €11,208', 'Health insurance', 'CV and motivation letter'], conditions: ['University degree', 'No work allowed on this visa'] } },
        { countryCode: 'DE', type: 'digital_nomad', name: 'Freelance Visa', description: 'For self-employed individuals and freelancers', processingTime: '1-4 months', duration: '1-3 years', renewability: 'Renewable', requirements: { documents: ['Business plan', 'Client contracts', 'Proof of income/savings', 'Health insurance'], conditions: ['Viable business plan', 'Interest for German economy'] } },
        { countryCode: 'DE', type: 'student', name: 'Student Visa', description: 'For studying at German universities', processingTime: '4-12 weeks', duration: 'Duration of study', requirements: { fees: { application: 75, blocked_account: 11208 }, documents: ['University admission letter', 'Blocked account', 'Health insurance'], conditions: ['Admission to recognized institution', 'Proof of finances'] } },
    ];

    for (const v of visaPrograms) {
        await prisma.visaProgram.create({ data: v as any });
    }
    console.log(`  ✅ ${visaPrograms.length} visa programs`);

    // =========================================================================
    // LABOR REGULATIONS
    // =========================================================================
    const laborRegs = [
        { countryCode: 'US', category: 'minimum_wage', title: 'Federal Minimum Wage', content: { hourlyRate: 7.25, currency: 'USD', notes: 'Many states have higher minimums (CA: $16, NY: $15, WA: $16.28)', lastUpdated: '2009-07-24' } },
        { countryCode: 'US', category: 'income_tax', title: 'Federal Income Tax Brackets 2025', content: { brackets: [{ rate: 10, upTo: 11925 }, { rate: 12, upTo: 48475 }, { rate: 22, upTo: 103350 }, { rate: 24, upTo: 191950 }, { rate: 32, upTo: 243725 }, { rate: 35, upTo: 609350 }, { rate: 37, above: 609350 }], notes: 'State taxes additional (0-13.3%)' } },
        { countryCode: 'US', category: 'worker_rights', title: 'Foreign Worker Rights', content: { workWeek: 40, overtime: '1.5x after 40 hours', paidLeave: 'No federal requirement', healthInsurance: 'Employer-provided common, ACA marketplace available', socialSecurity: 'Required contributions (6.2% + 1.45% Medicare)' } },

        { countryCode: 'CA', category: 'minimum_wage', title: 'Federal & Provincial Minimum Wages', content: { federal: 17.30, currency: 'CAD', byProvince: { ON: 16.55, BC: 17.40, AB: 15.00, QC: 15.75 }, notes: 'Federal minimum applies to federally regulated sectors' } },
        { countryCode: 'CA', category: 'income_tax', title: 'Federal Income Tax 2025', content: { brackets: [{ rate: 15, upTo: 57375 }, { rate: 20.5, upTo: 114750 }, { rate: 26, upTo: 158468 }, { rate: 29, upTo: 220000 }, { rate: 33, above: 220000 }], notes: 'Provincial taxes additional (5-25%)' } },

        { countryCode: 'GB', category: 'minimum_wage', title: 'National Living Wage', content: { hourlyRate: 12.21, currency: 'GBP', ageRates: { age21plus: 12.21, age18to20: 10.00, under18: 7.55 }, effectiveFrom: '2025-04-01' } },
        { countryCode: 'GB', category: 'income_tax', title: 'Income Tax Bands 2025-26', content: { personalAllowance: 12570, brackets: [{ rate: 20, from: 12571, to: 50270 }, { rate: 40, from: 50271, to: 125140 }, { rate: 45, above: 125140 }], notes: 'National Insurance additional (8-2%)' } },

        { countryCode: 'AU', category: 'minimum_wage', title: 'National Minimum Wage', content: { hourlyRate: 24.10, weeklyRate: 915.90, currency: 'AUD', effectiveFrom: '2024-07-01', notes: 'One of the highest minimum wages globally' } },
        { countryCode: 'AU', category: 'worker_rights', title: 'Employment Conditions', content: { workWeek: 38, annualLeave: '4 weeks paid', sickLeave: '10 days paid/year', superannuation: '11.5% employer contribution', fairWorkAct: 'Strong worker protections via Fair Work Commission' } },

        { countryCode: 'DE', category: 'minimum_wage', title: 'Mindestlohn (Minimum Wage)', content: { hourlyRate: 12.82, currency: 'EUR', effectiveFrom: '2025-01-01', notes: 'Steady increases, was €12.41 in 2024' } },
        { countryCode: 'DE', category: 'worker_rights', title: 'Employment Protections', content: { workWeek: 40, maxHours: 48, annualLeave: '20 days minimum (24 common)', sickPay: '6 weeks full pay by employer, then Krankengeld', socialInsurance: 'Mandatory (health, pension, unemployment, nursing care ~40% total split employer/employee)' } },
        { countryCode: 'DE', category: 'diploma_recognition', title: 'Foreign Credential Recognition', content: { portal: 'anabin.kmk.org', process: 'Credential evaluation through ZAB or professional chambers', regulatedProfessions: ['Doctors', 'Lawyers', 'Engineers', 'Teachers', 'Nurses'], timeframe: '3-6 months', notes: 'Recognition Act (Anerkennungsgesetz) since 2012' } },
    ];

    for (const r of laborRegs) {
        await prisma.laborRegulation.create({ data: r as any });
    }
    console.log(`  ✅ ${laborRegs.length} labor regulations`);

    // =========================================================================
    // COST OF LIVING (country averages, 2025-Q1)
    // =========================================================================
    const costs = [
        { countryCode: 'US', period: '2025-Q1', overallIndex: 71.0, rentIndex: 43.0, groceriesIndex: 75.0, transportIndex: 60.0, healthcareIndex: 80.0, averageRent1br: 1800, averageRent3br: 2800, mealCost: 18, internetCost: 65 },
        { countryCode: 'US', city: 'New York', period: '2025-Q1', overallIndex: 100.0, rentIndex: 100.0, groceriesIndex: 90.0, transportIndex: 72.0, averageRent1br: 3500, averageRent3br: 6500, mealCost: 25, internetCost: 60 },
        { countryCode: 'US', city: 'San Francisco', period: '2025-Q1', overallIndex: 95.0, rentIndex: 95.0, averageRent1br: 3200, averageRent3br: 5500, mealCost: 22, internetCost: 55 },
        { countryCode: 'CA', period: '2025-Q1', overallIndex: 62.0, rentIndex: 32.0, groceriesIndex: 65.0, transportIndex: 55.0, averageRent1br: 1500, averageRent3br: 2300, mealCost: 18, internetCost: 60 },
        { countryCode: 'CA', city: 'Toronto', period: '2025-Q1', overallIndex: 72.0, rentIndex: 52.0, averageRent1br: 2200, averageRent3br: 3200, mealCost: 20, internetCost: 55 },
        { countryCode: 'GB', period: '2025-Q1', overallIndex: 68.0, rentIndex: 30.0, groceriesIndex: 55.0, transportIndex: 65.0, averageRent1br: 1100, averageRent3br: 1800, mealCost: 16, internetCost: 35, currency: 'GBP' },
        { countryCode: 'GB', city: 'London', period: '2025-Q1', overallIndex: 85.0, rentIndex: 80.0, averageRent1br: 2200, averageRent3br: 3800, mealCost: 18, internetCost: 30, currency: 'GBP' },
        { countryCode: 'AU', period: '2025-Q1', overallIndex: 73.0, rentIndex: 40.0, groceriesIndex: 72.0, transportIndex: 60.0, averageRent1br: 1600, averageRent3br: 2500, mealCost: 20, internetCost: 55, currency: 'AUD' },
        { countryCode: 'AU', city: 'Sydney', period: '2025-Q1', overallIndex: 82.0, rentIndex: 60.0, averageRent1br: 2400, averageRent3br: 3600, mealCost: 22, internetCost: 50, currency: 'AUD' },
        { countryCode: 'DE', period: '2025-Q1', overallIndex: 58.0, rentIndex: 22.0, groceriesIndex: 50.0, transportIndex: 50.0, averageRent1br: 850, averageRent3br: 1500, mealCost: 12, internetCost: 30, currency: 'EUR' },
        { countryCode: 'DE', city: 'Berlin', period: '2025-Q1', overallIndex: 65.0, rentIndex: 30.0, averageRent1br: 1100, averageRent3br: 1900, mealCost: 12, internetCost: 28, currency: 'EUR' },
        { countryCode: 'DE', city: 'Munich', period: '2025-Q1', overallIndex: 72.0, rentIndex: 42.0, averageRent1br: 1500, averageRent3br: 2400, mealCost: 14, internetCost: 30, currency: 'EUR' },
    ];

    for (const c of costs) {
        await prisma.costOfLiving.create({ data: c as any });
    }
    console.log(`  ✅ ${costs.length} cost of living records`);

    // =========================================================================
    // STATISTICS
    // =========================================================================
    const stats = [
        { countryCode: 'US', category: 'migration_flow', metric: 'Total immigrants (permanent)', value: 1100000, unit: 'people', period: '2024' },
        { countryCode: 'US', category: 'migration_flow', metric: 'H-1B visas approved', value: 386000, unit: 'visas', period: '2024' },
        { countryCode: 'US', category: 'processing_time', metric: 'H-1B average processing', value: 8.5, unit: 'months', period: '2025-Q1' },
        { countryCode: 'US', category: 'approval_rate', metric: 'H-1B approval rate', value: 72, unit: 'percent', period: '2024' },
        { countryCode: 'US', category: 'population', metric: 'Foreign-born population', value: 47000000, unit: 'people', period: '2024' },

        { countryCode: 'CA', category: 'migration_flow', metric: 'Permanent residents admitted', value: 471550, unit: 'people', period: '2024' },
        { countryCode: 'CA', category: 'processing_time', metric: 'Express Entry processing', value: 6, unit: 'months', period: '2025-Q1' },
        { countryCode: 'CA', category: 'approval_rate', metric: 'Express Entry ITA acceptance', value: 85, unit: 'percent', period: '2024' },
        { countryCode: 'CA', category: 'migration_flow', metric: 'Express Entry CRS cutoff', value: 504, unit: 'points', period: '2025-Q1' },

        { countryCode: 'GB', category: 'migration_flow', metric: 'Net migration', value: 685000, unit: 'people', period: '2024' },
        { countryCode: 'GB', category: 'migration_flow', metric: 'Work visas granted', value: 285000, unit: 'visas', period: '2024' },
        { countryCode: 'GB', category: 'processing_time', metric: 'Skilled Worker visa processing', value: 5, unit: 'weeks', period: '2025-Q1' },

        { countryCode: 'AU', category: 'migration_flow', metric: 'Permanent migration program', value: 185000, unit: 'places', period: '2024-25' },
        { countryCode: 'AU', category: 'processing_time', metric: 'Subclass 189 processing', value: 9, unit: 'months', period: '2025-Q1' },
        { countryCode: 'AU', category: 'migration_flow', metric: 'Net overseas migration', value: 510000, unit: 'people', period: '2024' },

        { countryCode: 'DE', category: 'migration_flow', metric: 'Net immigration', value: 663000, unit: 'people', period: '2024' },
        { countryCode: 'DE', category: 'migration_flow', metric: 'EU Blue Cards issued', value: 72000, unit: 'cards', period: '2024' },
        { countryCode: 'DE', category: 'processing_time', metric: 'Blue Card processing', value: 2, unit: 'months', period: '2025-Q1' },
    ];

    for (const s of stats) {
        await prisma.statistic.create({ data: s as any });
    }
    console.log(`  ✅ ${stats.length} statistics`);

    // =========================================================================
    // DATA SOURCES
    // =========================================================================
    const sources = [
        { name: 'oecd', type: 'api', baseUrl: 'https://sdmx.oecd.org/public/rest', description: 'OECD migration statistics (SDMX API)', frequency: 'quarterly', countries: ['*'], dataCategories: ['statistics', 'labor'] },
        { name: 'eurostat', type: 'api', baseUrl: 'https://ec.europa.eu/eurostat/api', description: 'EU migration and asylum statistics', frequency: 'quarterly', countries: ['DE', 'FR', 'ES', 'IT', 'NL'], dataCategories: ['statistics', 'migration_flow'] },
        { name: 'un_desa', type: 'api', baseUrl: 'https://population.un.org/dataportalapi/api/v1', description: 'UN population and migration stock data', frequency: 'yearly', countries: ['*'], dataCategories: ['statistics', 'population'] },
        { name: 'unhcr', type: 'api', baseUrl: 'https://api.unhcr.org', description: 'UNHCR refugee and asylum data', frequency: 'monthly', countries: ['*'], dataCategories: ['statistics', 'asylum'] },
        { name: 'ircc_canada', type: 'api', baseUrl: 'https://open.canada.ca/data/en', description: 'IRCC Express Entry and immigration data', frequency: 'monthly', countries: ['CA'], dataCategories: ['statistics', 'processing_time'] },
        { name: 'travel_buddy', type: 'api', baseUrl: 'https://travel-buddy-ai.p.rapidapi.com', description: 'Visa requirements for 200+ countries (RapidAPI)', frequency: 'daily', countries: ['*'], dataCategories: ['visa_requirements'] },
        { name: 'numbeo', type: 'scraper', baseUrl: 'https://www.numbeo.com', description: 'Cost of living data (community-sourced)', frequency: 'monthly', countries: ['*'], dataCategories: ['cost_of_living'] },
    ];

    for (const s of sources) {
        await prisma.dataSource.upsert({ where: { name: s.name }, update: s, create: s as any });
    }
    console.log(`  ✅ ${sources.length} data sources`);

    // =========================================================================
    // SAMPLE LEGAL UPDATES
    // =========================================================================
    const updates = [
        { countryCode: 'US', category: 'visa', title: 'H-1B Registration for FY2026 Opens March 2025', summary: 'USCIS announced H-1B electronic registration period for FY2026. Beneficiary-centric selection continues.', impactLevel: 'high', sourceUrl: 'https://www.uscis.gov' },
        { countryCode: 'CA', category: 'visa', title: 'Express Entry CRS Score Drops to 504', summary: 'Latest Express Entry draw invited 5,500 candidates with minimum CRS of 504 points.', impactLevel: 'medium', sourceUrl: 'https://www.canada.ca' },
        { countryCode: 'GB', category: 'labor', title: 'Skilled Worker Minimum Salary Raised to £38,700', summary: 'UK government increased minimum salary threshold for Skilled Worker visa from £26,200 to £38,700.', impactLevel: 'critical', sourceUrl: 'https://www.gov.uk' },
        { countryCode: 'DE', category: 'visa', title: 'Opportunity Card (Chancenkarte) Launched', summary: 'Germany introduced the Opportunity Card for job seekers without a job offer, using a points system based on qualifications.', impactLevel: 'high', sourceUrl: 'https://www.make-it-in-germany.com' },
        { countryCode: 'AU', category: 'visa', title: 'Skills in Demand Visa Replaces Subclass 482', summary: 'Australia is transitioning to a new Skills in Demand visa with simplified pathways and expanded occupation lists.', impactLevel: 'high', sourceUrl: 'https://immi.homeaffairs.gov.au' },
    ];

    for (const u of updates) {
        await prisma.legalUpdate.create({ data: u as any });
    }
    console.log(`  ✅ ${updates.length} legal updates`);

    console.log('\n🎉 Seed complete!');
}

seed()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
