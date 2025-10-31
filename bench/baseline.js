import { quickDecode, createDecoder } from '@cardog/corgi';
import { bigData } from './big-data.js';

// Simple stats calculation for sequential patterns
function getStats(times) {
  if (times.length === 0) {
    return { avg: '0.00', min: '0.00', max: '0.00' };
  }

  const sorted = [...times].sort((a, b) => a - b);
  const sum = times.reduce((a, b) => a + b, 0);
  const avg = sum / times.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  return { avg: avg.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) };
}

// Run a sequential benchmark pattern
async function runSequentialPattern(name, testFn) {
  console.log(`Running: ${name}...`);
  const start = performance.now();
  const times = await testFn();
  const total = performance.now() - start;
  const stats = getStats(times);

  return { name, total: total.toFixed(0), type: 'sequential', ...stats };
}

// Run a concurrent benchmark pattern  
async function runConcurrentPattern(name, testFn) {
  console.log(`Running: ${name}...`);
  const start = performance.now();
  const successCount = await testFn();
  const total = performance.now() - start;
  const throughput = (successCount / (total / 1000)).toFixed(1);

  return {
    name,
    total: total.toFixed(0),
    type: 'concurrent',
    throughput,
    successCount
  };
}

// Get random sample of VINs
function getRandomVins(count = 100) {
  const shuffled = [...bigData].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function runBenchmarks() {
  console.log('🚀 VIN Decode Benchmark Suite');
  console.log(`Testing 100 random VINs per pattern\n`);

  const results = [];

  // 1. Sequential with quickDecode
  results.push(await runSequentialPattern('Sequential quickDecode', async () => {
    const vins = getRandomVins();
    const times = [];
    let successCount = 0;
    for (const vin of vins) {
      const result = await quickDecode(vin);
      if (result.valid && result.metadata?.processingTime) {
        times.push(result.metadata.processingTime);
        successCount++;
      }
    }
    console.log(`  ✅ ${successCount}/${vins.length} successful decodes`);
    return times;
  }));

  // 2. Concurrent with quickDecode  
  results.push(await runConcurrentPattern('Concurrent quickDecode', async () => {
    const vins = getRandomVins();
    const promises = vins.map(vin => quickDecode(vin));
    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.valid).length;
    console.log(`  ✅ ${successCount}/${vins.length} successful decodes`);
    return successCount;
  }));

  // 3. Sequential with shared decoder
  results.push(await runSequentialPattern('Sequential decoder', async () => {
    const vins = getRandomVins();
    const decoder = await createDecoder();
    const times = [];
    let successCount = 0;
    for (const vin of vins) {
      const result = await decoder.decode(vin);
      if (result.valid && result.metadata?.processingTime) {
        times.push(result.metadata.processingTime);
        successCount++;
      }
    }
    await decoder.close();
    console.log(`  ✅ ${successCount}/${vins.length} successful decodes`);
    return times;
  }));

  // 4. Concurrent with shared decoder
  results.push(await runConcurrentPattern('Concurrent decoder', async () => {
    const vins = getRandomVins();
    const decoder = await createDecoder();
    const promises = vins.map(vin => decoder.decode(vin));
    const results = await Promise.all(promises);
    await decoder.close();
    const successCount = results.filter(r => r.valid).length;
    console.log(`  ✅ ${successCount}/${vins.length} successful decodes`);
    return successCount;
  }));

  // Display results
  console.log('\n📊 Results:');
  console.log('─'.repeat(90));
  console.log('Pattern                  Total    Type        Avg/Throughput   Min     Max');
  console.log('─'.repeat(90));

  results.forEach(r => {
    if (r.type === 'sequential') {
      const line = `${r.name.padEnd(20)} ${r.total.padStart(6)}ms Sequential  ${r.avg.padStart(8)}ms     ${r.min.padStart(6)}ms ${r.max.padStart(6)}ms`;
      console.log(line);
    } else {
      const line = `${r.name.padEnd(20)} ${r.total.padStart(6)}ms Concurrent  ${r.throughput.padStart(8)} ops/s   -      -`;
      console.log(line);
    }
  });

  console.log('─'.repeat(90));

  // Insights
  const fastest = results.reduce((min, r) => +r.total < +min.total ? r : min);
  const slowest = results.reduce((max, r) => +r.total > +max.total ? r : max);
  const concurrentResults = results.filter(r => r.type === 'concurrent');
  const bestThroughput = concurrentResults.reduce((max, r) => +r.throughput > +max.throughput ? r : max);

  console.log(`\n🏆 Fastest overall: ${fastest.name} (${fastest.total}ms)`);
  console.log(`🚀 Best throughput: ${bestThroughput.name} (${bestThroughput.throughput} ops/sec)`);
  console.log(`📈 Speed difference: ${((slowest.total / fastest.total) * 100 - 100).toFixed(1)}%`);

  console.log('\n✅ Done!');
}

runBenchmarks().catch(console.error);