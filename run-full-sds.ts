import { runStatisticalDataService } from './src/services/stats-data-service.js';

async function main() {
    console.log('🚀 Full SDS batch starting on ALL cities...');
    const result = await runStatisticalDataService();
    console.log('🏁 DONE:', JSON.stringify(result, null, 2));
    process.exit(0);
}

main().catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
