/**
 * CLI runner for data collectors.
 * Usage: npx tsx src/collectors/run.ts [source]
 *
 * Examples:
 *   npx tsx src/collectors/run.ts          # run all collectors
 *   npx tsx src/collectors/run.ts un_desa  # run specific collector
 *   npx tsx src/collectors/run.ts oecd     # run OECD only
 */

import dotenv from 'dotenv';
dotenv.config();

import { runAllCollectors } from './scheduler.js';
import { UNDESACollector } from './un-desa.js';
import { RestCountriesCollector } from './rest-countries.js';
import { OECDCollector } from './oecd.js';
import { UNHCRCollector } from './unhcr.js';
import { WHOGHOCollector } from './who-gho.js';
import { WorldBankCollector } from './world-bank.js';
import { CongressCollector } from './congress.js';
import { RSSFeedsCollector } from './rss-feeds.js';
import { NewsDataCollector } from './newsdata.js';
import { OECDTaxCollector } from './oecd-tax.js';
import { EULegislationCollector } from './eu-legislation.js';
import { GovLegislationCollector } from './gov-legislation.js';
import { prisma } from './base.js';

const collectorMap: Record<string, () => Promise<void>> = {
    restcountries: async () => { await new RestCountriesCollector().run(); },
    un_desa: async () => { await new UNDESACollector().run(); },
    oecd: async () => { await new OECDCollector().run(); },
    unhcr: async () => { await new UNHCRCollector().run(); },
    who_gho: async () => { await new WHOGHOCollector().run(); },
    world_bank: async () => { await new WorldBankCollector().run(); },
    congress_gov: async () => { await new CongressCollector().run(); },
    rss_feeds: async () => { await new RSSFeedsCollector().run(); },
    newsdata: async () => { await new NewsDataCollector().run(); },
    oecd_tax: async () => { await new OECDTaxCollector().run(); },
    eu_legislation: async () => { await new EULegislationCollector().run(); },
    gov_legislation: async () => { await new GovLegislationCollector().run(); },
};

async function main() {
    const source = process.argv[2];

    if (source) {
        const runner = collectorMap[source];
        if (!runner) {
            console.error(`Unknown source: ${source}`);
            console.log(`Available: ${Object.keys(collectorMap).join(', ')}`);
            process.exit(1);
        }
        await runner();
    } else {
        await runAllCollectors();
    }

    await prisma.$disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
