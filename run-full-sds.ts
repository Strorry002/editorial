import { runStatisticalDataService } from './src/services/stats-data-service.js';

console.log('🚀 Full SDS batch starting on ALL cities...');
const result = await runStatisticalDataService();
console.log('🏁 DONE:', JSON.stringify(result, null, 2));
process.exit(0);
