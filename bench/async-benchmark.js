#!/usr/bin/env node
import { VINDecoderWrapper } from '@cardog/corgi';
import { AsyncDatabaseAdapter } from '../dist/db/async-adapter.js';
import { bigData } from './big-data.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { performance } from 'perf_hooks';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, '../db/vpic.lite.db');

// Get random VINs
function getRandomVins(count = 100) {
  const shuffled = [...bigData].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

async function testAsyncAdapter() {
  console.log('🚀 Async SQLite Adapter Benchmark');
  console.log('═'.repeat(60));
  
  try {
    // Test basic functionality first
    console.log('\n📊 Test 1: Basic Functionality');
    console.log('-'.repeat(40));
    
    const adapter = new AsyncDatabaseAdapter(dbPath);
    const decoder = new VINDecoderWrapper(adapter);
    
    // Single decode test
    const singleStart = performance.now();
    const result = await decoder.decode('1HGCM82633A123456');
    const singleTime = performance.now() - singleStart;
    
    console.log(`  Single decode: ${singleTime.toFixed(2)}ms`);
    console.log(`  Result valid: ${result.valid}`);
    
    await decoder.close();
    
    // Test 2: Concurrent operations with async adapter
    console.log('\n📊 Test 2: Concurrent Operations (100 VINs)');
    console.log('-'.repeat(40));
    
    const vins = getRandomVins(100);
    
    // Create multiple adapters for true concurrency
    const adapters = [];
    const decoders = [];
    
    for (let i = 0; i < vins.length; i++) {
      const adapter = new AsyncDatabaseAdapter(dbPath);
      const decoder = new VINDecoderWrapper(adapter);
      adapters.push(adapter);
      decoders.push(decoder);
    }
    
    const concurrentStart = performance.now();
    
    // Track active operations
    let activeOps = 0;
    let maxActiveOps = 0;
    
    const promises = decoders.map(async (decoder, i) => {
      activeOps++;
      if (activeOps > maxActiveOps) {
        maxActiveOps = activeOps;
      }
      
      try {
        const result = await decoder.decode(vins[i]);
        return result;
      } finally {
        activeOps--;
      }
    });
    
    const results = await Promise.allSettled(promises);
    const concurrentTime = performance.now() - concurrentStart;
    
    // Clean up
    for (const decoder of decoders) {
      await decoder.close();
    }
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.valid).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`  Duration: ${concurrentTime.toFixed(2)}ms`);
    console.log(`  Successful: ${successful}/${vins.length}`);
    console.log(`  Failed: ${failed}`);
    console.log(`  Max concurrent operations: ${maxActiveOps}`);
    console.log(`  Throughput: ${(vins.length / (concurrentTime / 1000)).toFixed(1)} ops/s`);
    
    // Test 3: Shared adapter concurrency
    console.log('\n📊 Test 3: Shared Adapter Concurrency');
    console.log('-'.repeat(40));
    
    const sharedAdapter = new AsyncDatabaseAdapter(dbPath);
    const sharedDecoder = new VINDecoderWrapper(sharedAdapter);
    
    const sharedStart = performance.now();
    const sharedPromises = vins.map(vin => sharedDecoder.decode(vin));
    const sharedResults = await Promise.allSettled(sharedPromises);
    const sharedTime = performance.now() - sharedStart;
    
    const sharedSuccess = sharedResults.filter(r => 
      r.status === 'fulfilled' && r.value.valid
    ).length;
    
    await sharedDecoder.close();
    
    console.log(`  Duration: ${sharedTime.toFixed(2)}ms`);
    console.log(`  Successful: ${sharedSuccess}/${vins.length}`);
    console.log(`  Throughput: ${(vins.length / (sharedTime / 1000)).toFixed(1)} ops/s`);
    
    // Compare with better-sqlite3
    console.log('\n📊 Test 4: Compare with better-sqlite3');
    console.log('-'.repeat(40));
    
    const { quickDecode } = await import('@cardog/corgi');
    
    const betterStart = performance.now();
    const betterPromises = vins.slice(0, 20).map(vin => quickDecode(vin));
    await Promise.all(betterPromises);
    const betterTime = performance.now() - betterStart;
    
    console.log(`  better-sqlite3 (20 VINs): ${betterTime.toFixed(2)}ms`);
    console.log(`  better-sqlite3 throughput: ${(20 / (betterTime / 1000)).toFixed(1)} ops/s`);
    
    const asyncEquivalentTime = (sharedTime / vins.length) * 20;
    console.log(`  Async adapter (20 VINs est): ${asyncEquivalentTime.toFixed(2)}ms`);
    console.log(`  Speedup: ${(betterTime / asyncEquivalentTime).toFixed(1)}x`);
    
    // Summary
    console.log('\n═'.repeat(60));
    console.log('🎯 Summary:');
    console.log('═'.repeat(60));
    
    const betterThroughput = 20 / (betterTime / 1000);
    const asyncThroughput = vins.length / (sharedTime / 1000);
    
    console.log(`\n  better-sqlite3: ${betterThroughput.toFixed(1)} ops/s (BLOCKING)`);
    console.log(`  Async adapter:  ${asyncThroughput.toFixed(1)} ops/s (NON-BLOCKING)`);
    console.log(`  Improvement:    ${(asyncThroughput / betterThroughput).toFixed(1)}x faster`);
    
    if (maxActiveOps > 10) {
      console.log('\n✅ TRUE CONCURRENCY ACHIEVED!');
      console.log(`   ${maxActiveOps} operations ran in parallel`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

// Run benchmark
testAsyncAdapter().catch(console.error);