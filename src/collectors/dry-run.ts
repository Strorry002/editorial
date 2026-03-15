/**
 * Dry-run v2 — fetch from WORKING APIs
 * Usage: npx tsx src/collectors/dry-run.ts
 */

async function fetchJson(url: string): Promise<any> {
    const response = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'ImmigrantsDataBot/1.0' }
    });
    if (!response.ok) throw new Error(`${response.status}: ${url}`);
    return response.json();
}

const COUNTRIES = ['US', 'CA', 'GB', 'AU', 'DE'];

async function main() {
    console.log('🔬 DRY RUN v2 — Live API fetch\n');

    // ═══════════════════════════════════════
    // 1. RestCountries (returns OBJECT not array)
    // ═══════════════════════════════════════
    console.log('═══════════════════════════════════════');
    console.log('📍 RestCountries.com — Country Metadata');
    console.log('═══════════════════════════════════════');
    for (const code of COUNTRIES) {
        try {
            const c = await fetchJson(`https://restcountries.com/v3.1/alpha/${code}?fields=cca2,name,capital,region,subregion,languages,currencies,flag`);
            const currency = c.currencies ? Object.keys(c.currencies)[0] : '?';
            const langs = c.languages ? Object.values(c.languages).join(', ') : '?';
            console.log(`  ${c.flag} ${c.name.common} (${c.cca2}) — ${c.capital?.[0]} | ${currency} | ${langs}`);
        } catch (e: any) {
            console.log(`  ❌ ${code}: ${e.message}`);
        }
    }

    // ═══════════════════════════════════════
    // 2. World Bank — Migration & Population (free, no auth)
    // ═══════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('🏦 World Bank — Migration & Economy');
    console.log('═══════════════════════════════════════');

    const wbIndicators = [
        { code: 'SM.POP.NETM', name: 'Net migration' },
        { code: 'SM.POP.TOTL', name: 'International migrant stock' },
        { code: 'SM.POP.TOTL.ZS', name: 'Migrant stock (% of population)' },
        { code: 'NY.GDP.PCAP.PP.CD', name: 'GDP per capita (PPP, $)' },
        { code: 'SL.UEM.TOTL.ZS', name: 'Unemployment rate (%)' },
        { code: 'SP.POP.TOTL', name: 'Total population' },
    ];

    for (const country of COUNTRIES) {
        console.log(`\n  🏳️ ${country}:`);
        for (const ind of wbIndicators) {
            try {
                const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind.code}?format=json&per_page=3&mrv=3`;
                const data = await fetchJson(url);
                if (data[1] && data[1].length > 0) {
                    const latest = data[1].find((d: any) => d.value !== null);
                    if (latest) {
                        const val = latest.value >= 1000000
                            ? `${(latest.value / 1000000).toFixed(1)}M`
                            : latest.value >= 1000
                                ? `${(latest.value / 1000).toFixed(1)}K`
                                : typeof latest.value === 'number'
                                    ? latest.value.toFixed(1)
                                    : latest.value;
                        console.log(`    📊 ${ind.name}: ${val} (${latest.date})`);
                    } else {
                        console.log(`    ℹ️ ${ind.name}: no data`);
                    }
                }
            } catch (e: any) {
                console.log(`    ❌ ${ind.name}: ${e.message?.slice(0, 60)}`);
            }
        }
    }

    // ═══════════════════════════════════════
    // 3. Canada Open Data — Express Entry
    // ═══════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('🇨🇦 Canada IRCC — Express Entry');
    console.log('═══════════════════════════════════════');
    try {
        const url = 'https://www.canada.ca/content/dam/ircc/documents/json/ee_rounds_123_en.json';
        const data = await fetchJson(url);
        if (data.rounds) {
            const recent = data.rounds.slice(0, 5);
            for (const round of recent) {
                console.log(`  📋 Round #${round.drawNumber} (${round.drawDate}): CRS ${round.drawCRS}, ${round.drawSize} invitations — ${round.drawName}`);
            }
        }
    } catch (e: any) {
        console.log(`  ℹ️ Express Entry: ${e.message?.slice(0, 80)}`);
    }

    // ═══════════════════════════════════════
    // 4. Numbeo-style Data (via Cost of Living API alternatives)
    // ═══════════════════════════════════════
    console.log('\n═══════════════════════════════════════');
    console.log('💰 World Bank — Cost Indicators');
    console.log('═══════════════════════════════════════');

    const costIndicators = [
        { code: 'FP.CPI.TOTL', name: 'Consumer Price Index' },
        { code: 'PA.NUS.PPPC.RF', name: 'PPP conversion factor' },
    ];

    for (const country of COUNTRIES) {
        console.log(`\n  🏳️ ${country}:`);
        for (const ind of costIndicators) {
            try {
                const url = `https://api.worldbank.org/v2/country/${country}/indicator/${ind.code}?format=json&per_page=1&mrv=1`;
                const data = await fetchJson(url);
                if (data[1]?.[0]?.value !== null) {
                    console.log(`    📊 ${ind.name}: ${data[1][0].value?.toFixed(2)} (${data[1][0].date})`);
                }
            } catch (e: any) {
                console.log(`    ❌ ${ind.name}: ${e.message?.slice(0, 60)}`);
            }
        }
    }

    console.log('\n✅ Dry run complete!');
}

main().catch(console.error);
