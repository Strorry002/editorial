import { calculateNomadScores } from './src/services/stats-data-service.js';

async function main() {
    console.log('📊 Running NomadScore calculator NOW...');
    const result = await calculateNomadScores();
    console.log('✅ Done:', JSON.stringify(result));
    process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
