import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as msgpack from '@msgpack/msgpack';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buf = fs.readFileSync(path.join(__dirname, '../dist/patterns.idx'));
const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

// Parse header
const keyCount = view.getUint32(8, true);
const offsetTableOffset = view.getUint32(12, true);
const offsetTableSize = view.getUint32(16, true);
const keysOffset = view.getUint32(20, true);
const keysLength = view.getUint32(24, true);
const valuesOffset = view.getUint32(28, true);

console.log('Index Structure:');
console.log(`  Schemas:       ${keyCount.toLocaleString()}`);
console.log(`  Offset table:  ${(offsetTableSize / 1024).toFixed(1)} KB`);
console.log(`  Keys section:  ${(keysLength / 1024).toFixed(1)} KB`);
console.log(`  Values size:   ${((buf.length - valuesOffset) / 1024 / 1024).toFixed(2)} MB`);

// Analyze patterns per schema
let totalLookups = 0;
let minLookups = Infinity;
let maxLookups = 0;
const elementCounts: Record<string, number> = {};
const uniqueResolved = new Set<string>();

for (let i = 0; i < keyCount; i++) {
  const valueOffset = view.getUint32(offsetTableOffset + i * 16 + 8, true);
  const valueLength = view.getUint32(offsetTableOffset + i * 16 + 12, true);
  const lookups = msgpack.decode(buf.slice(valuesOffset + valueOffset, valuesOffset + valueOffset + valueLength)) as any[];
  
  totalLookups += lookups.length;
  minLookups = Math.min(minLookups, lookups.length);
  maxLookups = Math.max(maxLookups, lookups.length);
  
  for (const l of lookups) {
    elementCounts[l.elementCode] = (elementCounts[l.elementCode] || 0) + 1;
    if (l.resolved) uniqueResolved.add(l.resolved);
  }
}

console.log(`\nPattern Statistics:`);
console.log(`  Total lookups: ${totalLookups.toLocaleString()}`);
console.log(`  Avg per schema: ${(totalLookups / keyCount).toFixed(1)}`);
console.log(`  Min/Max: ${minLookups} / ${maxLookups}`);
console.log(`  Unique values: ${uniqueResolved.size.toLocaleString()}`);

console.log(`\nTop Elements:`);
const sorted = Object.entries(elementCounts).sort((a, b) => b[1] - a[1]);
for (const [el, count] of sorted.slice(0, 15)) {
  const pct = (count * 100 / totalLookups).toFixed(1);
  console.log(`  ${el.padEnd(30)} ${count.toLocaleString().padStart(8)} (${pct}%)`);
}

// Estimate savings
const essentialElements = ['Model', 'Body Class', 'Fuel Type - Primary', 'Drive Type', 'Transmission Style', 'Engine Number of Cylinders', 'Displacement (L)', 'Doors'];
let essentialCount = 0;
for (const el of essentialElements) {
  essentialCount += elementCounts[el] || 0;
}
console.log(`\nSize Estimate:`);
console.log(`  Current patterns:   ${totalLookups.toLocaleString()}`);
console.log(`  Essential only:     ${essentialCount.toLocaleString()} (${(essentialCount * 100 / totalLookups).toFixed(0)}%)`);
console.log(`  Est. index size:    ${(buf.length * essentialCount / totalLookups / 1024 / 1024).toFixed(1)} MB`);
