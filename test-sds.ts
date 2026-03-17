import { runStatisticalDataService } from './src/services/stats-data-service.js';

async function main() {
    console.log('🧪 Testing SDS: full orchestrator on 3 cities...\n');
    const result = await runStatisticalDataService({ maxCities: 3 });
    console.log('\n📊 Final result:', JSON.stringify(result, null, 2));
    process.exit(0);
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
