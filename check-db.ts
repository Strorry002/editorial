import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';

async function main() {
    const p = new PrismaClient();

    // Countries
    const countries = await p.country.findMany({ orderBy: { code: 'asc' } });
    console.log(`\n🌍 СТРАНЫ (${countries.length}):`);
    for (const c of countries) console.log(`  🏳️ ${c.code} — ${c.name} (${c.region})`);

    // Statistics
    const stats = await p.statistic.findMany({ orderBy: [{ category: 'asc' }, { countryCode: 'asc' }] });
    console.log(`\n📊 СТАТИСТИКА (${stats.length} записей):`);
    const statCategories = new Map<string, typeof stats>();
    for (const s of stats) {
        const cat = statCategories.get(s.category) || [];
        cat.push(s);
        statCategories.set(s.category, cat);
    }
    for (const [cat, items] of statCategories) {
        console.log(`\n  [${cat}] — ${items.length} записей:`);
        const shown = items.slice(0, 5);
        for (const s of shown) console.log(`    ${s.countryCode} | ${s.metric} = ${s.value} ${s.unit} (${s.period})`);
        if (items.length > 5) console.log(`    ... и ещё ${items.length - 5}`);
    }

    // Legal Updates
    const legal = await p.legalUpdate.findMany({ orderBy: [{ category: 'asc' }, { publishedAt: 'desc' }] });
    console.log(`\n📜 LEGAL UPDATES (${legal.length} записей):`);
    const legalCats = new Map<string, typeof legal>();
    for (const l of legal) {
        const cat = legalCats.get(l.category) || [];
        cat.push(l);
        legalCats.set(l.category, cat);
    }
    for (const [cat, items] of legalCats) {
        console.log(`\n  [${cat}] — ${items.length} записей:`);
        const shown = items.slice(0, 3);
        for (const l of shown) console.log(`    ${l.countryCode} | [${l.impactLevel}] ${l.title?.substring(0, 80)}`);
        if (items.length > 3) console.log(`    ... и ещё ${items.length - 3}`);
    }

    // Cost of living
    const costs = await p.costOfLiving.findMany({ orderBy: { city: 'asc' } });
    console.log(`\n🏠 COST OF LIVING (${costs.length} записей):`);
    for (const c of costs) console.log(`  ${c.countryCode} ${c.city} | overall=${c.overallIndex} health=${c.healthcareIndex} (${c.period})`);

    // Collection logs (last 10)
    const logs = await p.collectionLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    console.log(`\n📋 ПОСЛЕДНИЕ СБОРКИ:`);
    for (const l of logs) {
        const icon = l.status === 'success' ? '✅' : l.status === 'partial' ? '⚠️' : '❌';
        console.log(`  ${icon} ${l.sourceName}: +${l.recordsAdded} ~${l.recordsUpdated} (${l.durationMs}ms) `);
    }

    // Labor regulations
    const labor = await p.laborRegulation.findMany();
    console.log(`\n⚖️ LABOR REGULATIONS (${labor.length} записей):`);

    console.log(`\n═══════════════════════════════════════`);
    console.log(`📊 ИТОГО: ${countries.length} стран | ${stats.length} статистик | ${legal.length} legal updates | ${costs.length} cost of living | ${labor.length} labor regulations`);
    console.log(`═══════════════════════════════════════\n`);

    await p.$disconnect();
}
main();
