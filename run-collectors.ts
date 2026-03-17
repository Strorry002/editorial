import { runAllCollectors } from './src/collectors/scheduler.js';
runAllCollectors().then(results => {
    console.log('\n=== RESULTS ===');
    for (const r of results) {
        console.log(`  ${r.source}: +${r.recordsAdded} added, ~${r.recordsUpdated} updated [${r.status}]`);
    }
}).catch(e => { console.error('ERROR:', e); process.exit(1); });
