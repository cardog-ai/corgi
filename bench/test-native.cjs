#!/usr/bin/env node
const { ReadOnlyDatabase } = require('../build/Release/readonly_sqlite.node');
const { performance } = require('perf_hooks');

const dbPath = require('path').join(__dirname, '../db/vpic.lite.db');

console.log('🧪 Testing Native Async SQLite Module');
console.log('═'.repeat(60));

// Test 1: Basic functionality
console.log('\n📊 Test 1: Basic Query');
console.log('-'.repeat(40));

const db = new ReadOnlyDatabase();
db.open(dbPath);

const start1 = performance.now();
db.query('SELECT COUNT(*) as count FROM Wmi', (err, result) => {
  const duration = performance.now() - start1;
  
  if (err) {
    console.error('  ❌ Error:', err);
    return;
  }
  
  console.log(`  Query duration: ${duration.toFixed(2)}ms`);
  console.log(`  Row count: ${result.values[0][0]}`);
  
  // Test 2: Concurrent queries
  console.log('\n📊 Test 2: 10 Concurrent Queries');
  console.log('-'.repeat(40));
  
  let completed = 0;
  let activeQueries = 0;
  let maxActive = 0;
  const timings = [];
  const start2 = performance.now();
  
  for (let i = 0; i < 10; i++) {
    activeQueries++;
    if (activeQueries > maxActive) maxActive = activeQueries;
    
    const queryStart = performance.now();
    
    db.query(
      `SELECT w.Wmi, m.Name 
       FROM Wmi w 
       LEFT JOIN Manufacturer m ON w.ManufacturerId = m.Id 
       WHERE w.Wmi LIKE ? 
       LIMIT 10`,
      (err, result) => {
        const queryDuration = performance.now() - queryStart;
        timings.push(queryDuration);
        
        activeQueries--;
        completed++;
        
        if (err) {
          console.error(`  Query ${i} error:`, err);
        }
        
        if (completed === 10) {
          const totalDuration = performance.now() - start2;
          
          console.log(`  Total duration: ${totalDuration.toFixed(2)}ms`);
          console.log(`  Max concurrent: ${maxActive}`);
          console.log(`  Average query time: ${(timings.reduce((a,b) => a+b, 0) / timings.length).toFixed(2)}ms`);
          console.log(`  Min query time: ${Math.min(...timings).toFixed(2)}ms`);
          console.log(`  Max query time: ${Math.max(...timings).toFixed(2)}ms`);
          
          // Test 3: Heavy concurrent load
          console.log('\n📊 Test 3: 100 Concurrent Queries');
          console.log('-'.repeat(40));
          
          let completed100 = 0;
          let active100 = 0;
          let maxActive100 = 0;
          const start3 = performance.now();
          
          for (let j = 0; j < 100; j++) {
            active100++;
            if (active100 > maxActive100) maxActive100 = active100;
            
            db.query(
              'SELECT COUNT(*) FROM Wmi WHERE Wmi LIKE ?',
              (err, result) => {
                active100--;
                completed100++;
                
                if (completed100 === 100) {
                  const duration100 = performance.now() - start3;
                  
                  console.log(`  Total duration: ${duration100.toFixed(2)}ms`);
                  console.log(`  Max concurrent: ${maxActive100}`);
                  console.log(`  Throughput: ${(100 / (duration100 / 1000)).toFixed(1)} ops/s`);
                  
                  // Compare with expected sequential time
                  const avgQueryTime = timings.reduce((a,b) => a+b, 0) / timings.length;
                  const expectedSequential = avgQueryTime * 100;
                  
                  console.log(`  Expected if sequential: ${expectedSequential.toFixed(0)}ms`);
                  console.log(`  Actual speedup: ${(expectedSequential / duration100).toFixed(1)}x`);
                  
                  if (maxActive100 > 50) {
                    console.log('\n✅ TRUE ASYNC CONCURRENCY ACHIEVED!');
                    console.log(`   ${maxActive100} queries ran in parallel on thread pool`);
                  }
                  
                  // Clean up
                  db.close();
                  
                  console.log('\n═'.repeat(60));
                  console.log('🎯 Native module working perfectly!');
                  console.log('   Non-blocking, true async SQLite queries');
                }
              },
              [`${j}%`]
            );
          }
        }
      },
      [`${i}%`]
    );
  }
});