#!/usr/bin/env tsx
/**
 * Corgi v3 - Benchmark Suite
 *
 * Benchmarks VIN decoding performance against 1100 real-world VINs
 * from the Cardog vehicle database.
 *
 * @see spec/04-ARCHITECTURE.md - Performance requirements
 *
 * Usage:
 *   pnpm benchmark
 *   pnpm benchmark 5        # 5 iterations
 *   pnpm benchmark 3 --v2   # Compare with v2
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createDecoder, VINDecoder, DecodeResult } from '../src';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// Load VINs from file
// ============================================================================

const BENCHMARK_VINS = fs
  .readFileSync(path.join(__dirname, 'benchmark-vins.txt'), 'utf-8')
  .split('\n')
  .map(v => v.trim())
  .filter(v => v.length === 17);

console.log(`Loaded ${BENCHMARK_VINS.length} VINs from benchmark-vins.txt`);

// ============================================================================
// Benchmark Types & Utils
// ============================================================================

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  opsPerSec: number;
  successRate: number;
  successCount: number;
  totalCount: number;
}

interface MakeBreakdown {
  make: string;
  count: number;
  successCount: number;
  successRate: number;
}

interface RegionBreakdown {
  region: string;
  count: number;
  successCount: number;
  successRate: number;
}

function formatResult(result: BenchmarkResult): string {
  return [
    `${result.name}:`,
    `  Iterations:  ${result.iterations.toLocaleString()}`,
    `  Total:       ${result.totalMs.toFixed(2)}ms`,
    `  Average:     ${result.avgMs.toFixed(3)}ms`,
    `  Min:         ${result.minMs.toFixed(3)}ms`,
    `  Max:         ${result.maxMs.toFixed(3)}ms`,
    `  Ops/sec:     ${result.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    `  Success:     ${result.successCount}/${result.totalCount} (${(result.successRate * 100).toFixed(1)}%)`,
  ].join('\n');
}

function getWmiRegion(vin: string): string {
  const firstChar = vin[0];
  if ('12345'.includes(firstChar)) return 'North America';
  if ('STUVWXYZ'.includes(firstChar)) return 'Europe';
  if ('JKL'.includes(firstChar)) return 'Asia (Japan/Korea)';
  if ('LMN'.includes(firstChar)) return 'Asia (China)';
  if ('6789'.includes(firstChar)) return 'Oceania/South America';
  return 'Unknown';
}

// ============================================================================
// Benchmark Functions
// ============================================================================

async function benchmarkSingleDecode(
  decoder: VINDecoder,
  vins: string[],
  iterations: number
): Promise<{ result: BenchmarkResult; decodeResults: DecodeResult[] }> {
  const times: number[] = [];
  let successes = 0;
  const decodeResults: DecodeResult[] = [];

  // Warmup
  for (let i = 0; i < Math.min(100, vins.length); i++) {
    decoder.decode(vins[i]);
  }

  for (let i = 0; i < iterations; i++) {
    for (const vin of vins) {
      const start = performance.now();
      const result = decoder.decode(vin);
      const elapsed = performance.now() - start;
      times.push(elapsed);
      if (result.valid && result.vehicle?.make) successes++;
      if (i === 0) decodeResults.push(result); // Store first iteration results
    }
  }

  const totalOps = vins.length * iterations;
  const totalMs = times.reduce((a, b) => a + b, 0);

  return {
    result: {
      name: 'Single Decode (v3)',
      iterations: totalOps,
      totalMs,
      avgMs: totalMs / totalOps,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      opsPerSec: (totalOps / totalMs) * 1000,
      successRate: successes / totalOps,
      successCount: successes / iterations,
      totalCount: vins.length,
    },
    decodeResults,
  };
}

async function benchmarkBatchDecode(
  decoder: VINDecoder,
  vins: string[],
  iterations: number
): Promise<BenchmarkResult> {
  const times: number[] = [];
  let successes = 0;

  // Warmup
  decoder.decodeBatch(vins.slice(0, 100));

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const results = decoder.decodeBatch(vins);
    const elapsed = performance.now() - start;
    times.push(elapsed);
    successes += results.filter(r => r.valid && r.vehicle?.make).length;
  }

  const totalOps = vins.length * iterations;
  const totalMs = times.reduce((a, b) => a + b, 0);

  return {
    name: 'Batch Decode (v3)',
    iterations: totalOps,
    totalMs,
    avgMs: totalMs / totalOps,
    minMs: Math.min(...times) / vins.length,
    maxMs: Math.max(...times) / vins.length,
    opsPerSec: (totalOps / totalMs) * 1000,
    successRate: successes / totalOps,
    successCount: successes / iterations,
    totalCount: vins.length,
  };
}

async function benchmarkColdStart(indexDir: string): Promise<BenchmarkResult> {
  const times: number[] = [];
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const decoder = await createDecoder(indexDir);
    decoder.decode(BENCHMARK_VINS[0]);
    const elapsed = performance.now() - start;
    times.push(elapsed);
  }

  const totalMs = times.reduce((a, b) => a + b, 0);

  return {
    name: 'Cold Start (v3)',
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    opsPerSec: (iterations / totalMs) * 1000,
    successRate: 1.0,
    successCount: iterations,
    totalCount: iterations,
  };
}

// ============================================================================
// v2 SQLite Comparison
// ============================================================================

async function benchmarkV2(vins: string[], iterations: number): Promise<BenchmarkResult | null> {
  try {
    // Dynamic import to handle case where v2 deps aren't available
    const v2Path = path.join(__dirname, '../../lib/index.ts');
    if (!fs.existsSync(v2Path)) {
      console.log('v2 decoder not found, skipping comparison');
      return null;
    }

    const { quickDecode } = await import('../../lib/index');
    const times: number[] = [];
    let successes = 0;

    // Warmup
    console.log('  Warming up v2...');
    for (let i = 0; i < Math.min(5, vins.length); i++) {
      await quickDecode(vins[i]);
    }

    console.log(`  Running v2 on ${vins.length} VINs...`);
    for (let i = 0; i < iterations; i++) {
      for (const vin of vins) {
        const start = performance.now();
        const result = await quickDecode(vin);
        const elapsed = performance.now() - start;
        times.push(elapsed);
        if (result.Make) successes++;
      }
    }

    const totalOps = vins.length * iterations;
    const totalMs = times.reduce((a, b) => a + b, 0);

    return {
      name: 'Single Decode (v2 SQLite)',
      iterations: totalOps,
      totalMs,
      avgMs: totalMs / totalOps,
      minMs: Math.min(...times),
      maxMs: Math.max(...times),
      opsPerSec: (totalOps / totalMs) * 1000,
      successRate: successes / totalOps,
      successCount: successes / iterations,
      totalCount: vins.length,
    };
  } catch (e) {
    console.log('v2 benchmark failed:', (e as Error).message);
    return null;
  }
}

// ============================================================================
// Breakdown Analysis
// ============================================================================

function analyzeByMake(results: DecodeResult[]): MakeBreakdown[] {
  const makeMap = new Map<string, { count: number; success: number }>();

  for (const result of results) {
    const make = result.vehicle?.make || 'Unknown';
    const entry = makeMap.get(make) || { count: 0, success: 0 };
    entry.count++;
    if (result.valid && result.vehicle?.make) entry.success++;
    makeMap.set(make, entry);
  }

  return Array.from(makeMap.entries())
    .map(([make, { count, success }]) => ({
      make,
      count,
      successCount: success,
      successRate: success / count,
    }))
    .sort((a, b) => b.count - a.count);
}

function analyzeByRegion(vins: string[], results: DecodeResult[]): RegionBreakdown[] {
  const regionMap = new Map<string, { count: number; success: number }>();

  for (let i = 0; i < vins.length; i++) {
    const region = getWmiRegion(vins[i]);
    const entry = regionMap.get(region) || { count: 0, success: 0 };
    entry.count++;
    if (results[i].valid && results[i].vehicle?.make) entry.success++;
    regionMap.set(region, entry);
  }

  return Array.from(regionMap.entries())
    .map(([region, { count, success }]) => ({
      region,
      count,
      successCount: success,
      successRate: success / count,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const indexDir = path.join(__dirname, '../dist');
  const iterations = parseInt(process.argv[2] || '3', 10);
  const compareV2 = process.argv.includes('--v2');

  console.log('\n========================================');
  console.log('Corgi v3 Benchmark Suite');
  console.log('========================================');
  console.log(`Index dir:   ${indexDir}`);
  console.log(`VINs:        ${BENCHMARK_VINS.length}`);
  console.log(`Iterations:  ${iterations}`);
  console.log(`Compare v2:  ${compareV2}`);
  console.log('');

  // Check index files exist
  const indexFiles = ['wmi-schema.idx', 'wmi-make.idx', 'patterns.idx'];
  let totalIndexSize = 0;
  for (const file of indexFiles) {
    const filePath = path.join(indexDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`Index file not found: ${filePath}`);
      console.error('Run: pnpm transform');
      process.exit(1);
    }
    const stats = fs.statSync(filePath);
    totalIndexSize += stats.size;
    console.log(`${file.padEnd(20)} ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  }
  console.log(`${'Total'.padEnd(20)} ${(totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
  console.log('');

  // Create decoder
  console.log('Loading decoder...');
  const loadStart = performance.now();
  const decoder = await createDecoder(indexDir);
  const loadTime = performance.now() - loadStart;
  console.log(`Loaded in ${loadTime.toFixed(1)}ms\n`);

  // Run benchmarks
  console.log('Running benchmarks...\n');

  const coldStart = await benchmarkColdStart(indexDir);
  console.log(formatResult(coldStart));
  console.log('');

  const { result: single, decodeResults } = await benchmarkSingleDecode(decoder, BENCHMARK_VINS, iterations);
  console.log(formatResult(single));
  console.log('');

  const batch = await benchmarkBatchDecode(decoder, BENCHMARK_VINS, iterations);
  console.log(formatResult(batch));
  console.log('');

  // v2 comparison
  let v2Result: BenchmarkResult | null = null;
  if (compareV2) {
    console.log('Running v2 comparison (this may take a while)...\n');
    v2Result = await benchmarkV2(BENCHMARK_VINS.slice(0, 100), 1); // Only 100 VINs for v2
    if (v2Result) {
      console.log(formatResult(v2Result));
      console.log('');
    }
  }

  // Success breakdown by make
  console.log('========================================');
  console.log('Success Rate by Make (top 15):');
  console.log('========================================');
  const makeBreakdown = analyzeByMake(decodeResults);
  for (const { make, count, successCount, successRate } of makeBreakdown.slice(0, 15)) {
    const bar = '█'.repeat(Math.round(successRate * 20));
    console.log(`${make.padEnd(20)} ${String(successCount).padStart(4)}/${String(count).padStart(4)} ${bar} ${(successRate * 100).toFixed(0)}%`);
  }
  console.log('');

  // Success breakdown by region
  console.log('========================================');
  console.log('Success Rate by Region:');
  console.log('========================================');
  const regionBreakdown = analyzeByRegion(BENCHMARK_VINS, decodeResults);
  for (const { region, count, successCount, successRate } of regionBreakdown) {
    const bar = '█'.repeat(Math.round(successRate * 20));
    console.log(`${region.padEnd(22)} ${String(successCount).padStart(4)}/${String(count).padStart(4)} ${bar} ${(successRate * 100).toFixed(0)}%`);
  }
  console.log('');

  // Summary
  console.log('========================================');
  console.log('Summary:');
  console.log('========================================');
  console.log(`  Index size:     ${(totalIndexSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Cold start:     ${coldStart.avgMs.toFixed(1)}ms`);
  console.log(`  Single decode:  ${single.avgMs.toFixed(3)}ms avg (${single.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec)`);
  console.log(`  Batch decode:   ${batch.avgMs.toFixed(3)}ms avg (${batch.opsPerSec.toLocaleString(undefined, { maximumFractionDigits: 0 })} ops/sec)`);
  console.log(`  Success rate:   ${single.successCount}/${single.totalCount} (${(single.successRate * 100).toFixed(1)}%)`);

  if (v2Result) {
    console.log('');
    console.log('  v2 comparison (100 VINs):');
    console.log(`    v2 SQLite:    ${v2Result.avgMs.toFixed(3)}ms avg`);
    console.log(`    v3 Binary:    ${single.avgMs.toFixed(3)}ms avg`);
    console.log(`    Speedup:      ${(v2Result.avgMs / single.avgMs).toFixed(1)}x`);
  }

  // Targets check
  console.log('');
  console.log('========================================');
  console.log('Targets:');
  console.log('========================================');
  const coldStartOk = coldStart.avgMs < 100;
  const decodeOk = single.avgMs < 10;
  const indexSizeOk = totalIndexSize < 2 * 1024 * 1024;
  console.log(`  Cold start < 100ms:  ${coldStartOk ? '✓' : '✗'} (${coldStart.avgMs.toFixed(1)}ms)`);
  console.log(`  Decode < 10ms:       ${decodeOk ? '✓' : '✗'} (${single.avgMs.toFixed(3)}ms)`);
  console.log(`  Index < 2MB:         ${indexSizeOk ? '✓' : '✗'} (${(totalIndexSize / 1024 / 1024).toFixed(2)} MB)`);
}

main().catch(console.error);
