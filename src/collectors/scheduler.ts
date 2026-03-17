import cron from 'node-cron';
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
import { CollectorResult } from './base.js';
import { runAutonomousNewsroom, runFeatureAutopilot, runWeeklyDigest } from '../services/autopilot.js';

const collectors = [
    new RestCountriesCollector(),
    new UNDESACollector(),
    new OECDCollector(),
    new UNHCRCollector(),
    new WHOGHOCollector(),
    new WorldBankCollector(),
    new CongressCollector(),
    new RSSFeedsCollector(),
    new NewsDataCollector(),
    new OECDTaxCollector(),
    new EULegislationCollector(),
    new GovLegislationCollector(),
];

/** Run all collectors sequentially */
export async function runAllCollectors(): Promise<CollectorResult[]> {
    console.log('\n🔄 ═══════════════════════════════════════');
    console.log('   Running all data collectors...');
    console.log('═══════════════════════════════════════════\n');

    const results: CollectorResult[] = [];

    for (const collector of collectors) {
        try {
            const result = await collector.run();
            results.push(result);
        } catch (error: any) {
            console.error(`Fatal error in ${collector.sourceName}: ${error.message}`);
        }
    }

    const total = results.reduce((acc, r) => ({
        added: acc.added + r.recordsAdded,
        updated: acc.updated + r.recordsUpdated,
        errors: acc.errors + (r.status === 'error' ? 1 : 0),
    }), { added: 0, updated: 0, errors: 0 });

    console.log(`\n📊 Collection complete: +${total.added} added, ~${total.updated} updated, ${total.errors} errors\n`);
    return results;
}

/** Schedule collectors with cron */
export function startScheduler() {
    // Daily at 6:00 UTC — full data collection
    cron.schedule('0 6 * * *', async () => {
        console.log('⏰ Scheduled daily collection triggered');
        await runAllCollectors();
    });

    // Every Monday at 3:00 UTC — heavy collectors (OECD, etc.)
    cron.schedule('0 3 * * 1', async () => {
        console.log('⏰ Scheduled weekly collection triggered');
        const oecd = new OECDCollector();
        await oecd.run();
    });

    // Every 3 hours — Autonomous Newsroom: full pipeline
    // Includes: autopilot (group raw→articles) + chief editor (progress stuck) + publish 1 article + owner report
    cron.schedule('0 */3 * * *', async () => {
        console.log('📰 Autonomous Newsroom: running full pipeline...');
        try {
            await runAutonomousNewsroom({ hoursBack: 12, maxPublish: 1 });
        } catch (err: any) {
            console.error('📰 Newsroom error:', err.message);
        }
    });

    // Tuesday + Friday at 14:00 UTC (22:00 KL) — Feature content (lifehacks, guides, human stories)
    cron.schedule('0 14 * * 2,5', async () => {
        console.log('🧳 Feature Autopilot: generating human-interest content...');
        try {
            await runFeatureAutopilot();
        } catch (err: any) {
            console.error('🧳 Feature error:', err.message);
        }
    });

    // Sunday at 10:00 UTC (18:00 KL) — Weekly digest
    cron.schedule('0 10 * * 0', async () => {
        console.log('📊 Weekly Digest: compiling week in review...');
        try {
            await runWeeklyDigest();
        } catch (err: any) {
            console.error('📊 Digest error:', err.message);
        }
    });

    // Wednesday at 02:00 UTC (10:00 KL) — Statistical Data Service: collect city data
    cron.schedule('0 2 * * 3', async () => {
        console.log('📈 SDS: running all data engines (25 cities batch)...');
        try {
            const { runStatisticalDataService } = await import('../services/stats-data-service.js');
            await runStatisticalDataService({ maxCities: 25 });
        } catch (err: any) {
            console.error('📈 SDS error:', err.message);
        }
    });

    console.log('📅 Scheduler started: daily collection @06:00 UTC, weekly OECD @Mon 03:00 UTC');
    console.log('📰 Autonomous Newsroom: every 3 hours (autopilot + chief editor + publish 1)');
    console.log('🧳 Feature content: Tue+Fri @14:00 UTC | 📊 Weekly digest: Sun @10:00 UTC');
    console.log('📈 SDS: Wed @02:00 UTC (25 cities batch)');
}

