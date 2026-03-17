/**
 * Statistical Data Service — AI-Powered Data Engines
 * 
 * 8 engines that collect city-level data using:
 * 1. Free APIs (Open-Meteo, OpenAQ)
 * 2. AI enrichment via xAI Grok (fills gaps, validates, generates descriptions)
 * 
 * Each engine processes cities in batches to respect rate limits.
 */

import { PrismaClient } from '@prisma/client';
import { getXAIClient, AI_MODEL } from './ai.js';

const prisma = new PrismaClient();
const xai = getXAIClient();

// Current quarter string
function currentPeriod(): string {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${q}`;
}

// ============================================================================
// AI Helper: Ask Grok for structured JSON data
// ============================================================================

async function askAIForData<T>(prompt: string, systemPrompt: string): Promise<T | null> {
    try {
        const response = await xai.chat.completions.create({
            model: AI_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 4000,
        });

        const text = (response.choices[0]?.message?.content || '').trim();

        // Handle empty array responses (AI says "no data" or returns [])
        if (text === '[]' || text.toLowerCase().includes('no alerts') || text.toLowerCase().includes('no current') || text.toLowerCase().includes('nothing notable')) {
            return [] as unknown as T;
        }

        // Extract JSON from response (handle markdown code blocks, objects AND arrays)
        const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
            || text.match(/(\[[\s\S]*\])/)     // JSON array
            || text.match(/(\{[\s\S]*\})/);     // JSON object
        if (!jsonMatch) {
            console.warn('[sds] No JSON found in AI response');
            return null;
        }
        return JSON.parse(jsonMatch[1]) as T;
    } catch (error: any) {
        console.error('[sds] AI request failed:', error.message);
        return null;
    }
}

// ============================================================================
// ENGINE 1: Cost of Living (CityPrice)
// ============================================================================

const PRICE_ITEMS = [
    // Restaurants
    { category: 'restaurants', item: 'meal_inexpensive', label: 'Inexpensive restaurant meal' },
    { category: 'restaurants', item: 'meal_mid_two', label: 'Mid-range restaurant meal for 2' },
    { category: 'restaurants', item: 'mcdonalds_meal', label: 'McMeal at McDonalds' },
    { category: 'restaurants', item: 'cappuccino', label: 'Cappuccino in a cafe' },
    { category: 'restaurants', item: 'beer_domestic_restaurant', label: 'Domestic beer (0.5L) in restaurant' },
    { category: 'restaurants', item: 'water_restaurant', label: 'Water (0.33L) in restaurant' },
    // Markets
    { category: 'markets', item: 'milk_1l', label: '1 liter of milk' },
    { category: 'markets', item: 'bread_500g', label: 'Loaf of bread (500g)' },
    { category: 'markets', item: 'rice_1kg', label: 'Rice (1kg)' },
    { category: 'markets', item: 'eggs_12', label: 'Eggs (12)' },
    { category: 'markets', item: 'chicken_1kg', label: 'Chicken breast (1kg)' },
    { category: 'markets', item: 'banana_1kg', label: 'Bananas (1kg)' },
    { category: 'markets', item: 'tomato_1kg', label: 'Tomatoes (1kg)' },
    { category: 'markets', item: 'potato_1kg', label: 'Potatoes (1kg)' },
    { category: 'markets', item: 'water_1_5l', label: 'Water (1.5L bottle)' },
    { category: 'markets', item: 'beer_domestic_store', label: 'Domestic beer (0.5L) in store' },
    { category: 'markets', item: 'wine_bottle', label: 'Bottle of wine (mid-range)' },
    // Transport
    { category: 'transport', item: 'metro_ticket', label: 'One-way metro/bus ticket' },
    { category: 'transport', item: 'monthly_pass', label: 'Monthly public transport pass' },
    { category: 'transport', item: 'taxi_start', label: 'Taxi start fare' },
    { category: 'transport', item: 'taxi_1km', label: 'Taxi 1km' },
    { category: 'transport', item: 'gasoline_1l', label: 'Gasoline (1 liter)' },
    // Utilities
    { category: 'utilities', item: 'utilities_basic', label: 'Basic utilities (electricity, heating, water) for 85m² apartment' },
    { category: 'utilities', item: 'mobile_plan', label: 'Mobile phone plan (10GB+ data)' },
    { category: 'utilities', item: 'internet_60mbps', label: 'Internet (60 Mbps+, unlimited)' },
    // Leisure
    { category: 'leisure', item: 'gym_monthly', label: 'Gym/fitness club monthly' },
    { category: 'leisure', item: 'cinema_ticket', label: 'Cinema ticket (1 seat)' },
    // Clothing
    { category: 'clothing', item: 'jeans_levis', label: 'Pair of jeans (Levis or similar)' },
    { category: 'clothing', item: 'sneakers_nike', label: 'Pair of sneakers (Nike, Adidas)' },
    // Nomad-specific
    { category: 'nomad', item: 'coworking_day', label: 'Coworking space (day pass)' },
    { category: 'nomad', item: 'coworking_month', label: 'Coworking space (monthly)' },
    { category: 'nomad', item: 'laundry_5kg', label: 'Laundry service (5kg)' },
    { category: 'nomad', item: 'haircut_mens', label: 'Men\'s haircut' },
    { category: 'nomad', item: 'sim_card_10gb', label: 'Tourist SIM card with 10GB data' },
    { category: 'nomad', item: 'bigmac_single', label: 'Single Big Mac (Big Mac Index)' },
];

export async function runCostOfLivingEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:cost] Processing ${cities.length} cities for period ${period}`);
    let processed = 0, errors = 0;

    // Process in batches of 5 to respect rate limits
    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                // Check if data already exists for this period
                const existing = await prisma.cityPrice.count({
                    where: { cityId: city.id, period },
                });
                if (existing >= 20) {
                    console.log(`  ✓ ${city.name} — already has ${existing} prices for ${period}`);
                    processed++;
                    return;
                }

                const itemsList = PRICE_ITEMS.map(p => `- ${p.item}: ${p.label}`).join('\n');
                const data = await askAIForData<Record<string, number>>(
                    `City: ${city.name}, ${city.country.name} (currency: ${city.country.currency})\n\nProvide current approximate prices in USD for:\n${itemsList}\n\nReturn JSON object with item codes as keys and USD prices as values. Use realistic 2025-2026 data. If you're not sure about a price, give your best estimate.`,
                    'You are a cost-of-living data analyst. Return ONLY a JSON object with item codes as keys and numeric USD values. No explanations, no markdown, just JSON. Example: {"meal_inexpensive": 5.50, "cappuccino": 2.00}'
                );

                if (!data) { errors++; return; }

                // Upsert prices
                for (const pi of PRICE_ITEMS) {
                    const value = data[pi.item];
                    if (value && typeof value === 'number' && value > 0) {
                        await prisma.cityPrice.upsert({
                            where: { cityId_item_period: { cityId: city.id, item: pi.item, period } },
                            create: { cityId: city.id, category: pi.category, item: pi.item, value, period, source: 'ai_enrichment', confidence: 6 },
                            update: { value, source: 'ai_enrichment', confidence: 6 },
                        });
                    }
                }

                console.log(`  ✅ ${city.name} — ${Object.keys(data).length} prices saved`);
                processed++;
            } catch (err: any) {
                console.error(`  ❌ ${city.name}: ${err.message}`);
                errors++;
            }
        }));

        // Rate limit pause
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:cost] Done: ${processed} processed, ${errors} errors`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 2: Housing (CityHousing)
// ============================================================================

const HOUSING_TYPES = [
    'rent_studio_center', 'rent_1br_center', 'rent_1br_outside',
    'rent_2br_center', 'rent_3br_center',
    'airbnb_month', 'airbnb_day',
    'hostel_night',
    'buy_sqm_center', 'buy_sqm_outside',
];

export async function runHousingEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:housing] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityHousing.count({ where: { cityId: city.id, period } });
                if (existing >= 6) { processed++; return; }

                const data = await askAIForData<Record<string, any>>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide housing prices in USD:\n${HOUSING_TYPES.map(t => `- ${t}`).join('\n')}\n\nAlso include:\n- deposit_months: typical deposit in months (e.g. 2)\n- foreign_can_buy: can foreigners buy property (true/false)\n- furnished: is rental typically furnished (true/false)\n\nReturn JSON with housing type keys and USD values, plus extra fields.`,
                    'You are a real estate data analyst specializing in expat/nomad housing. Return ONLY JSON. Example: {"rent_1br_center": 450, "airbnb_month": 800, "deposit_months": 2, "foreign_can_buy": true, "furnished": true}'
                );

                if (!data) { errors++; return; }

                for (const type of HOUSING_TYPES) {
                    const value = data[type];
                    if (value && typeof value === 'number' && value > 0) {
                        await prisma.cityHousing.upsert({
                            where: { cityId_type_period: { cityId: city.id, type, period } },
                            create: {
                                cityId: city.id, type, value, period,
                                depositMonths: data.deposit_months || null,
                                foreignCanBuy: data.foreign_can_buy ?? null,
                                furnished: data.furnished ?? true,
                                source: 'ai_enrichment', confidence: 6,
                            },
                            update: { value, source: 'ai_enrichment', confidence: 6 },
                        });
                    }
                }

                console.log(`  ✅ ${city.name} — housing saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:housing] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 3: Climate (CityClimate) — AI-powered with realistic monthly data
// ============================================================================

export async function runClimateEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = new Date().getFullYear().toString();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:climate] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 3) {
        const batch = cities.slice(i, i + 3);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityClimate.count({ where: { cityId: city.id, period } });
                if (existing >= 12) { processed++; return; }

                const aiData = await askAIForData<{ months: any[] }>(
                    `City: ${city.name}, ${city.country.name} (lat ${city.lat}, lng ${city.lng})\n\nProvide typical monthly climate data for all 12 months.\nFor each month (1-12) provide:\n- month: number (1-12)\n- avgTempC: average temperature in °C\n- minTempC: minimum temperature in °C\n- maxTempC: maximum temperature in °C\n- avgHumidity: average humidity percentage (0-100)\n- avgRainMm: average rainfall in mm for the month\n- rainyDays: number of rainy days in the month\n- sunshineHours: average sunshine hours for the month\n- uvIndex: average UV index\n\nReturn JSON: { "months": [{"month": 1, "avgTempC": 28, "minTempC": 24, "maxTempC": 32, "avgHumidity": 75, "avgRainMm": 50, "rainyDays": 8, "sunshineHours": 180, "uvIndex": 7}, ...] }`,
                    'You are a climate data scientist. Return ONLY JSON. Provide realistic average monthly climate data based on geographical location and known weather patterns.'
                );

                if (!aiData?.months || aiData.months.length < 12) { errors++; return; }

                for (const m of aiData.months) {
                    await prisma.cityClimate.upsert({
                        where: { cityId_month_period: { cityId: city.id, month: m.month, period } },
                        create: {
                            cityId: city.id, month: m.month, period,
                            avgTempC: m.avgTempC, minTempC: m.minTempC, maxTempC: m.maxTempC,
                            avgHumidity: m.avgHumidity, avgRainMm: m.avgRainMm,
                            rainyDays: m.rainyDays, sunshineHours: m.sunshineHours,
                            uvIndex: m.uvIndex, source: 'ai_enrichment',
                        },
                        update: {
                            avgTempC: m.avgTempC, minTempC: m.minTempC, maxTempC: m.maxTempC,
                            avgHumidity: m.avgHumidity, avgRainMm: m.avgRainMm,
                            rainyDays: m.rainyDays, sunshineHours: m.sunshineHours,
                            uvIndex: m.uvIndex,
                        },
                    });
                }

                console.log(`  ✅ ${city.name} — 12 months climate saved`);
                processed++;
            } catch (err: any) {
                console.error(`  ❌ ${city.name}: ${err.message}`);
                errors++;
            }
        }));
        if (i + 3 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:climate] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 4: Infrastructure (CityInfrastructure)
// ============================================================================

export async function runInfrastructureEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:infra] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityInfrastructure.findUnique({
                    where: { cityId_period: { cityId: city.id, period } },
                });
                if (existing) { processed++; return; }

                const data = await askAIForData<any>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide digital infrastructure data:\n- internetSpeedMbps: average fixed broadband speed\n- mobileSpeedMbps: average 4G/5G speed\n- coworkingCount: approximate number of coworking spaces\n- avgCoworkingDay: USD per day pass\n- avgCoworkingMonth: USD per month\n- hasUber: true/false\n- hasGrab: true/false\n- hasBolt: true/false\n- hasMetro: true/false (subway/MRT/BTS)\n- simCard10gb: cost of tourist SIM with 10GB in USD\n- digitalReadiness: 1-10 score (banking ease, Wise/Revolut works, food delivery, e-gov)\n\nReturn JSON object.`,
                    'You are a digital infrastructure analyst. Return ONLY JSON with realistic data. Be accurate about which ride-hailing services operate in each city.'
                );

                if (!data) { errors++; return; }

                await prisma.cityInfrastructure.create({
                    data: {
                        cityId: city.id, period,
                        internetSpeedMbps: data.internetSpeedMbps || null,
                        mobileSpeedMbps: data.mobileSpeedMbps || null,
                        coworkingCount: data.coworkingCount || null,
                        avgCoworkingDay: data.avgCoworkingDay || null,
                        avgCoworkingMonth: data.avgCoworkingMonth || null,
                        hasUber: data.hasUber ?? false,
                        hasGrab: data.hasGrab ?? false,
                        hasBolt: data.hasBolt ?? false,
                        hasMetro: data.hasMetro ?? false,
                        simCard10gb: data.simCard10gb || null,
                        digitalReadiness: data.digitalReadiness || null,
                        source: 'ai_enrichment', confidence: 6,
                    },
                });

                console.log(`  ✅ ${city.name} — infra saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:infra] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 5: Safety (CitySafety)
// ============================================================================

export async function runSafetyEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:safety] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.citySafety.findUnique({
                    where: { cityId_period: { cityId: city.id, period } },
                });
                if (existing) { processed++; return; }

                const data = await askAIForData<any>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide safety data:\n- crimeIndex: 0-100 (higher = more crime, Numbeo-style)\n- safetyIndex: 0-100 (higher = safer)\n- walkingDaySafety: 1-10\n- walkingNightSafety: 1-10\n- womenSafety: 1-10\n- lgbtqFriendly: 1-10\n- scamRisk: 1-10 (higher = more scams targeting tourists)\n- corruptionIndex: 0-100\n\nReturn JSON.`,
                    'You are a safety analyst. Return ONLY JSON. Be realistic — not every city is dangerous, not every city is safe. Base scores on actual Numbeo, Gallup, and UNODC data where available.'
                );

                if (!data) { errors++; return; }

                await prisma.citySafety.create({
                    data: {
                        cityId: city.id, period,
                        crimeIndex: data.crimeIndex || null,
                        safetyIndex: data.safetyIndex || null,
                        walkingDaySafety: data.walkingDaySafety || null,
                        walkingNightSafety: data.walkingNightSafety || null,
                        womenSafety: data.womenSafety || null,
                        lgbtqFriendly: data.lgbtqFriendly || null,
                        scamRisk: data.scamRisk || null,
                        corruptionIndex: data.corruptionIndex || null,
                        source: 'ai_enrichment', confidence: 6,
                    },
                });

                console.log(`  ✅ ${city.name} — safety saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:safety] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 6: Environment (CityEnvironment) 
// ============================================================================

export async function runEnvironmentEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:env] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityEnvironment.findUnique({
                    where: { cityId_period: { cityId: city.id, period } },
                });
                if (existing) { processed++; return; }

                // Try OpenAQ first
                let aqiData: any = null;
                if (city.lat && city.lng) {
                    try {
                        const aqRes = await fetch(`https://api.openaq.org/v2/latest?coordinates=${city.lat},${city.lng}&radius=25000&limit=1`, {
                            headers: { 'Accept': 'application/json' },
                        });
                        if (aqRes.ok) {
                            const aqJson = await aqRes.json();
                            const result = aqJson.results?.[0];
                            if (result) {
                                const pm25 = result.measurements?.find((m: any) => m.parameter === 'pm25');
                                aqiData = { pm25: pm25?.value || null };
                            }
                        }
                    } catch { /* OpenAQ is best-effort */ }
                }

                // AI for remaining data
                const data = await askAIForData<any>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide environmental quality data:\n- aqiIndex: Air Quality Index (0-500, lower is better)\n- pm25: PM2.5 level (μg/m³, annual average)\n- waterQuality: 1-10 (tap water safety)\n- noiseLevel: 1-10 (1=quiet, 10=very noisy)\n- greenSpaceScore: 1-10 (parks, trees, nature access)\n- pollutionIndex: 0-100 (overall pollution)\n\nReturn JSON.`,
                    'You are an environmental data analyst. Return ONLY JSON. Use realistic AQI values based on known air quality data for each city.'
                );

                if (!data) { errors++; return; }

                await prisma.cityEnvironment.create({
                    data: {
                        cityId: city.id, period,
                        aqiIndex: data.aqiIndex || null,
                        pm25: aqiData?.pm25 || data.pm25 || null,
                        waterQuality: data.waterQuality || null,
                        noiseLevel: data.noiseLevel || null,
                        greenSpaceScore: data.greenSpaceScore || null,
                        pollutionIndex: data.pollutionIndex || null,
                        source: aqiData ? 'openaq+ai' : 'ai_enrichment',
                    },
                });

                console.log(`  ✅ ${city.name} — environment saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:env] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 7: Healthcare (CityHealthcare)
// ============================================================================

export async function runHealthcareEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:health] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityHealthcare.findUnique({
                    where: { cityId_period: { cityId: city.id, period } },
                });
                if (existing) { processed++; return; }

                const data = await askAIForData<any>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide healthcare data:\n- qualityIndex: 1-10 overall quality\n- hospitalBedsPer1k: hospital beds per 1000 people\n- doctorVisitCost: USD, general practitioner visit\n- dentistVisitCost: USD, basic dental checkup\n- emergencyVisitCost: USD, ER visit\n- monthlyInsurance: USD, private health insurance for expat\n- pharmacyAccess: 1-10\n- englishDoctors: 1-10 (availability of English-speaking doctors)\n\nReturn JSON.`,
                    'You are a healthcare analyst for expats and digital nomads. Return ONLY JSON. Consider both public and private healthcare. Costs should be for private/out-of-pocket visits.'
                );

                if (!data) { errors++; return; }

                await prisma.cityHealthcare.create({
                    data: {
                        cityId: city.id, period,
                        qualityIndex: data.qualityIndex || null,
                        hospitalBedsPer1k: data.hospitalBedsPer1k || null,
                        doctorVisitCost: data.doctorVisitCost || null,
                        dentistVisitCost: data.dentistVisitCost || null,
                        emergencyVisitCost: data.emergencyVisitCost || null,
                        monthlyInsurance: data.monthlyInsurance || null,
                        pharmacyAccess: data.pharmacyAccess || null,
                        englishDoctors: data.englishDoctors || null,
                        source: 'ai_enrichment', confidence: 6,
                    },
                });

                console.log(`  ✅ ${city.name} — healthcare saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:health] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// ENGINE 8: Lifestyle (CityLifestyle) — cafes, pets, expat, family
// ============================================================================

export async function runLifestyleEngine(cityIds?: string[]): Promise<{ processed: number; errors: number }> {
    const period = currentPeriod();
    const cities = cityIds
        ? await prisma.city.findMany({ where: { id: { in: cityIds } }, include: { country: true } })
        : await prisma.city.findMany({ include: { country: true } });

    console.log(`[sds:lifestyle] Processing ${cities.length} cities`);
    let processed = 0, errors = 0;

    for (let i = 0; i < cities.length; i += 5) {
        const batch = cities.slice(i, i + 5);
        await Promise.all(batch.map(async (city) => {
            try {
                const existing = await prisma.cityLifestyle.findUnique({
                    where: { cityId_period: { cityId: city.id, period } },
                });
                if (existing) { processed++; return; }

                const data = await askAIForData<any>(
                    `City: ${city.name}, ${city.country.name}\n\nProvide lifestyle data for digital nomads:\n- cafeScene: 1-10 (coworking-friendly cafes with WiFi)\n- nightlife: 1-10\n- gymMonthly: USD per month\n- fitnessAccess: 1-10\n- expatCommunity: 1-10 (size & activity of expat/nomad community)\n- meetupScene: 1-10 (tech meetups, networking events)\n- culturalEvents: 1-10 (museums, festivals, art)\n- foodScene: 1-10 (restaurants, street food, variety)\n- familyFriendly: 1-10 (playgrounds, schools, pediatricians)\n- petFriendly: 1-10 (easy to have pets, dog parks, pet-friendly cafes)\n- petQuarantine: true/false (does country require quarantine for imported pets)\n- avgVetVisit: USD (basic vet consultation)\n\nReturn JSON.`,
                    'You are a lifestyle and travel analyst specializing in digital nomad communities. Return ONLY JSON. Be realistic and nuanced — Chiang Mai has a very active nomad community, while Beijing does not.'
                );

                if (!data) { errors++; return; }

                await prisma.cityLifestyle.create({
                    data: {
                        cityId: city.id, period,
                        cafeScene: data.cafeScene || null,
                        nightlife: data.nightlife || null,
                        gymMonthly: data.gymMonthly || null,
                        fitnessAccess: data.fitnessAccess || null,
                        expatCommunity: data.expatCommunity || null,
                        meetupScene: data.meetupScene || null,
                        culturalEvents: data.culturalEvents || null,
                        foodScene: data.foodScene || null,
                        familyFriendly: data.familyFriendly || null,
                        petFriendly: data.petFriendly || null,
                        petQuarantine: data.petQuarantine ?? null,
                        avgVetVisit: data.avgVetVisit || null,
                        source: 'ai_enrichment',
                    },
                });

                console.log(`  ✅ ${city.name} — lifestyle saved`);
                processed++;
            } catch (err: any) { console.error(`  ❌ ${city.name}: ${err.message}`); errors++; }
        }));
        if (i + 5 < cities.length) await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`[sds:lifestyle] Done: ${processed}/${cities.length}`);
    return { processed, errors };
}

// ============================================================================
// NOMAD SCORE CALCULATOR — Composite score from all data
// ============================================================================

export async function calculateNomadScores(): Promise<{ calculated: number }> {
    const period = currentPeriod();
    const cities = await prisma.city.findMany();
    let calculated = 0;

    for (const city of cities) {
        try {
            // Gather all data for this city
            const [prices, housing, climate, infra, safety, env, health, lifestyle] = await Promise.all([
                prisma.cityPrice.findMany({ where: { cityId: city.id, period } }),
                prisma.cityHousing.findMany({ where: { cityId: city.id, period } }),
                prisma.cityClimate.findMany({ where: { cityId: city.id } }),
                prisma.cityInfrastructure.findUnique({ where: { cityId_period: { cityId: city.id, period } } }),
                prisma.citySafety.findUnique({ where: { cityId_period: { cityId: city.id, period } } }),
                prisma.cityEnvironment.findUnique({ where: { cityId_period: { cityId: city.id, period } } }),
                prisma.cityHealthcare.findUnique({ where: { cityId_period: { cityId: city.id, period } } }),
                prisma.cityLifestyle.findUnique({ where: { cityId_period: { cityId: city.id, period } } }),
            ]);

            if (prices.length === 0 && !infra && !safety) continue; // Skip cities with no data

            // Cost score: cheaper = higher score (invert, normalize)
            const meal = prices.find(p => p.item === 'meal_inexpensive')?.value;
            const rent = housing.find(h => h.type === 'rent_1br_center')?.value;
            const costScore = meal && rent
                ? Math.max(0, Math.min(100, 100 - ((meal * 30 + rent) / 30))) // rough normalization
                : null;

            // Housing score
            const housingScore = rent
                ? Math.max(0, Math.min(100, 100 - (rent / 25))) // $2500 = 0, $0 = 100
                : null;

            // Internet score
            const internetScore = infra?.internetSpeedMbps
                ? Math.min(100, (infra.internetSpeedMbps / 200) * 100)
                : null;

            // Safety score
            const safetyScore = safety?.safetyIndex || null;

            // Climate score — prefer 20-28°C average
            const avgTemps = climate.map(c => c.avgTempC).filter((t): t is number => t !== null);
            const avgTemp = avgTemps.length ? avgTemps.reduce((a, b) => a + b, 0) / avgTemps.length : null;
            const climateScore = avgTemp !== null
                ? Math.max(0, 100 - Math.abs(avgTemp - 24) * 5) // 24°C ideal, -5 per degree deviation
                : null;

            // Healthcare score
            const healthcareScore = health?.qualityIndex
                ? health.qualityIndex * 10
                : null;

            // Environment score
            const environmentScore = env?.aqiIndex
                ? Math.max(0, 100 - env.aqiIndex) // lower AQI = better
                : null;

            // Lifestyle score
            const lifestyleScore = lifestyle
                ? Math.round(((lifestyle.cafeScene || 5) + (lifestyle.foodScene || 5) + (lifestyle.expatCommunity || 5) + (lifestyle.nightlife || 5)) / 4 * 10)
                : null;

            // Education score (placeholder)
            const educationScore: number | null = null;

            // Infrastructure score
            const infraScore = infra?.digitalReadiness
                ? infra.digitalReadiness * 10
                : null;

            // Overall composite
            const scores = [costScore, housingScore, internetScore, safetyScore, climateScore, healthcareScore, environmentScore, lifestyleScore, infraScore]
                .filter((s): s is number => s !== null);
            const overall = scores.length >= 3
                ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
                : null;

            if (overall === null) continue;

            await prisma.nomadScore.upsert({
                where: { cityId_period: { cityId: city.id, period } },
                create: {
                    cityId: city.id, period, overall,
                    costScore, housingScore, internetScore, safetyScore,
                    climateScore, healthcareScore, environmentScore,
                    lifestyleScore, educationScore, infraScore,
                },
                update: {
                    overall, costScore, housingScore, internetScore, safetyScore,
                    climateScore, healthcareScore, environmentScore,
                    lifestyleScore, educationScore, infraScore,
                },
            });

            // Update city.nomadScore
            await prisma.city.update({
                where: { id: city.id },
                data: { nomadScore: overall },
            });

            calculated++;
        } catch (err: any) {
            console.error(`  ❌ ${city.name}: ${err.message}`);
        }
    }

    console.log(`[sds:score] Calculated scores for ${calculated} cities`);
    return { calculated };
}

// ============================================================================
// ORCHESTRATOR — Runs all engines in sequence
// ============================================================================

export async function runStatisticalDataService(options?: {
    engines?: string[];
    cityIds?: string[];
    maxCities?: number;
}): Promise<Record<string, any>> {
    const startTime = Date.now();
    const results: Record<string, any> = {};
    const engines = options?.engines || ['cost', 'housing', 'climate', 'infra', 'safety', 'env', 'health', 'lifestyle', 'score'];

    // If maxCities is set, pick a random subset
    let cityIds = options?.cityIds;
    if (!cityIds && options?.maxCities) {
        const allCities = await prisma.city.findMany({ select: { id: true } });
        const shuffled = allCities.sort(() => Math.random() - 0.5);
        cityIds = shuffled.slice(0, options.maxCities).map(c => c.id);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`[SDS] Statistical Data Service starting`);
    console.log(`Engines: ${engines.join(', ')}`);
    console.log(`Cities: ${cityIds ? cityIds.length + ' selected' : 'all'}`);
    console.log(`${'='.repeat(60)}\n`);

    for (const engine of engines) {
        try {
            switch (engine) {
                case 'cost': results.cost = await runCostOfLivingEngine(cityIds); break;
                case 'housing': results.housing = await runHousingEngine(cityIds); break;
                case 'climate': results.climate = await runClimateEngine(cityIds); break;
                case 'infra': results.infra = await runInfrastructureEngine(cityIds); break;
                case 'safety': results.safety = await runSafetyEngine(cityIds); break;
                case 'env': results.env = await runEnvironmentEngine(cityIds); break;
                case 'health': results.health = await runHealthcareEngine(cityIds); break;
                case 'lifestyle': results.lifestyle = await runLifestyleEngine(cityIds); break;
                case 'score': results.score = await calculateNomadScores(); break;
            }
        } catch (err: any) {
            console.error(`[SDS] Engine ${engine} failed:`, err.message);
            results[engine] = { error: err.message };
        }
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[SDS] Complete in ${elapsed}s`);
    console.log(JSON.stringify(results, null, 2));
    console.log(`${'='.repeat(60)}\n`);

    return results;
}

// ============================================================================
// ENGINE 9: CITY ALERTS — Daily safety/events monitoring
// ============================================================================

type AlertData = {
    category: string;
    severity: string;
    title: string;
    summary: string;
    source: string;
    sourceUrl: string;
};

const ALERT_CATEGORIES = ['conflict', 'crime', 'persecution', 'currency', 'health', 'natural', 'political'];
const ALERT_SEVERITIES = ['critical', 'warning', 'advisory', 'info'];

export async function runAlertsEngine(cityIds?: string[]): Promise<{ scanned: number; alertsCreated: number; alertsExpired: number }> {
    const cities = await prisma.city.findMany({
        where: cityIds ? { id: { in: cityIds } } : undefined,
        include: { country: { select: { name: true, code: true } } },
    });

    let alertsCreated = 0;
    let alertsExpired = 0;

    // Auto-expire old alerts (>30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const expired = await (prisma as any).cityAlert.updateMany({
        where: { isActive: true, createdAt: { lt: thirtyDaysAgo } },
        data: { isActive: false },
    });
    alertsExpired = expired.count;
    if (alertsExpired > 0) console.log(`[sds:alerts] Expired ${alertsExpired} old alerts`);

    // Process cities in batches of 5
    const batchSize = 5;
    for (let i = 0; i < cities.length; i += batchSize) {
        const batch = cities.slice(i, i + batchSize);
        const promises = batch.map(async (city) => {
            try {
                const today = new Date().toISOString().split('T')[0];

                // Fetch REAL news from SafetyFeed table for this country
                const recentFeeds = await (prisma as any).safetyFeed.findMany({
                    where: {
                        countryCode: city.country.code,
                        fetchedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    },
                    orderBy: { eventDate: 'desc' },
                    take: 15,
                });

                const newsContext = recentFeeds.length > 0
                    ? `\n\nREAL NEWS HEADLINES FROM OUR INTELLIGENCE FEEDS (last 7 days):\n${recentFeeds.map((f: any) => `- [${f.source.toUpperCase()}] [${f.category}] ${f.title}${f.url ? ` (${f.url})` : ''}`).join('\n')}\n\nUSE THESE HEADLINES to generate alerts. These are REAL, VERIFIED events.`
                    : '\n\nNo recent intelligence feeds found for this country. Use your knowledge of CURRENT events only.';

                const data = await askAIForData<AlertData[]>(
                    `City: ${city.name}, ${city.country.name} (${city.country.code})
Date: ${today}
${newsContext}

Based on the REAL NEWS ABOVE and any other CURRENT events you know about, list safety alerts for this city for travelers/expats.

Categories: conflict (war, protests, coups, bombings, airstrikes), crime (tourist robberies, scams, kidnappings), persecution (LGBTQ crackdowns, religious/ethnic targeting), currency (crash, capital controls, ATM issues), health (outbreaks, dengue, mpox), natural (earthquake, typhoon, flooding, wildfire), political (visa rule changes, border closures, curfews).

Return a JSON array of alerts. Each alert: { "category": "...", "severity": "critical|warning|advisory|info", "title": "short title", "summary": "2-3 sentences with specific details", "source": "news source name", "sourceUrl": "url or empty" }

Rules:
- PRIORITIZE the real news headlines provided above
- Only include current events (${today} ±7 days)
- If no current alerts, return empty array []
- Maximum 5 alerts per city
- Be specific with dates and details
- severity: critical = immediate danger/active conflict, warning = exercise caution, advisory = be aware, info = minor`,
                    'You are a real-time safety intelligence analyst. You are given VERIFIED news headlines from our feeds. Analyze them and generate travel safety alerts based on REAL data. Return ONLY a valid JSON array. No markdown, no explanation. If nothing notable, return [].'
                );

                if (!data || !Array.isArray(data) || data.length === 0) {
                    console.log(`  ✓ ${city.name} — no alerts`);
                    return 0;
                }

                let created = 0;
                for (const alert of data.slice(0, 5)) {
                    // Validate category and severity
                    if (!ALERT_CATEGORIES.includes(alert.category)) continue;
                    if (!ALERT_SEVERITIES.includes(alert.severity)) continue;
                    if (!alert.title || !alert.summary) continue;

                    // Dedup: check if similar alert already exists (same city + similar title)
                    const existing = await (prisma as any).cityAlert.findFirst({
                        where: {
                            cityId: city.id,
                            isActive: true,
                            title: { contains: alert.title.split(' ').slice(0, 3).join(' '), mode: 'insensitive' },
                        },
                    });
                    if (existing) continue;

                    await (prisma as any).cityAlert.create({
                        data: {
                            cityId: city.id,
                            category: alert.category,
                            severity: alert.severity,
                            title: alert.title.slice(0, 200),
                            summary: alert.summary.slice(0, 500),
                            source: alert.source?.slice(0, 100) || null,
                            sourceUrl: alert.sourceUrl?.slice(0, 500) || null,
                            isActive: true,
                            expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days default
                        },
                    });
                    created++;
                }

                if (created > 0) {
                    console.log(`  ⚠️ ${city.name} — ${created} new alert(s)`);
                }
                return created;
            } catch (err: any) {
                console.error(`  ❌ ${city.name} — ${err.message}`);
                return 0;
            }
        });

        const results = await Promise.all(promises);
        alertsCreated += results.reduce((a, b) => a + b, 0);

        if (i + batchSize < cities.length) {
            await new Promise(r => setTimeout(r, 2000)); // Rate limit
        }
    }

    console.log(`[sds:alerts] Scanned ${cities.length} cities, created ${alertsCreated} alerts, expired ${alertsExpired}`);
    return { scanned: cities.length, alertsCreated, alertsExpired };
}
