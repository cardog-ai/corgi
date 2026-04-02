#!/usr/bin/env tsx
/**
 * Corgi v3 - Transform Pipeline
 * Converts NHTSA vPIC SQLite database to binary index format
 *
 * Implements the Vehicle Identity Standard (VIS) transform pipeline
 * @see https://github.com/cardog-ai/vis-a-vin
 * @see spec/03-ENCODING.md - VIN pattern encoding format
 * @see spec/04-ARCHITECTURE.md - Binary index format, transform pipeline
 *
 * Output files:
 *   - wmi-schema.idx   WMI → SchemaIds index
 *   - wmi-make.idx     WMI → Make info index
 *   - patterns.idx     SchemaId → Lookups index
 *
 * Binary format (per index file):
 *   Header (32 bytes):
 *     - Magic: 0x434F5247 ('CORG') [4 bytes]
 *     - Version: 1 [4 bytes]
 *     - Key count [4 bytes]
 *     - Offset table position [4 bytes]
 *     - Offset table length [4 bytes]
 *     - Keys section position [4 bytes]
 *     - Keys section length [4 bytes]
 *     - Values section position [4 bytes]
 *   Offset table (16 bytes per key):
 *     - Key offset [4 bytes]
 *     - Key length [4 bytes]
 *     - Value offset [4 bytes]
 *     - Value length [4 bytes]
 *   Keys section: null-terminated strings, sorted for binary search
 *   Values section: msgpack-encoded data
 */

import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import * as msgpack from '@msgpack/msgpack';

// ============================================================================
// Types
// ============================================================================

interface Lookup {
  pattern: string;
  elementCode: string;
  resolved: string;
  weight: number;
}

interface WmiSchema {
  schemaId: number;
  yearFrom: number;
  yearTo: number | null;
}

interface WmiMake {
  make: string;
  manufacturer: string | null;
  country: string | null;
  vehicleType: string | null;
}

interface IndexBuilder {
  keys: string[];
  values: Uint8Array[];
}

// ============================================================================
// Index File Format
// ============================================================================

const MAGIC = 0x434F5247; // 'CORG'
const VERSION = 1;

function writeIndex(outputPath: string, builder: IndexBuilder): void {
  // Sort keys for binary search
  const indices = builder.keys.map((_, i) => i);
  indices.sort((a, b) => builder.keys[a].localeCompare(builder.keys[b]));

  const sortedKeys = indices.map(i => builder.keys[i]);
  const sortedValues = indices.map(i => builder.values[i]);

  // Encode keys as null-terminated strings
  const encoder = new TextEncoder();
  const keyBuffers = sortedKeys.map(k => encoder.encode(k + '\0'));
  const keysLength = keyBuffers.reduce((sum, b) => sum + b.length, 0);
  const keysBuffer = new Uint8Array(keysLength);
  let keyOffset = 0;
  const keyOffsets: number[] = [];
  for (const buf of keyBuffers) {
    keyOffsets.push(keyOffset);
    keysBuffer.set(buf, keyOffset);
    keyOffset += buf.length;
  }

  // Concatenate values
  const valuesLength = sortedValues.reduce((sum, b) => sum + b.length, 0);
  const valuesBuffer = new Uint8Array(valuesLength);
  let valueOffset = 0;
  const valueOffsets: number[] = [];
  const valueLengths: number[] = [];
  for (const buf of sortedValues) {
    valueOffsets.push(valueOffset);
    valueLengths.push(buf.length);
    valuesBuffer.set(buf, valueOffset);
    valueOffset += buf.length;
  }

  // Build offset table (4 x uint32 per entry)
  const offsetTableSize = sortedKeys.length * 16;
  const offsetTable = new ArrayBuffer(offsetTableSize);
  const offsetView = new DataView(offsetTable);
  for (let i = 0; i < sortedKeys.length; i++) {
    const base = i * 16;
    offsetView.setUint32(base, keyOffsets[i], true);
    offsetView.setUint32(base + 4, keyBuffers[i].length - 1, true); // exclude null
    offsetView.setUint32(base + 8, valueOffsets[i], true);
    offsetView.setUint32(base + 12, valueLengths[i], true);
  }

  // Header (32 bytes)
  const headerSize = 32;
  const header = new ArrayBuffer(headerSize);
  const headerView = new DataView(header);
  headerView.setUint32(0, MAGIC, true);
  headerView.setUint32(4, VERSION, true);
  headerView.setUint32(8, sortedKeys.length, true);
  headerView.setUint32(12, headerSize, true); // offset table starts after header
  headerView.setUint32(16, offsetTableSize, true);
  headerView.setUint32(20, headerSize + offsetTableSize, true); // keys offset
  headerView.setUint32(24, keysLength, true);
  headerView.setUint32(28, headerSize + offsetTableSize + keysLength, true); // values offset

  // Write file
  const output = Buffer.concat([
    Buffer.from(header),
    Buffer.from(offsetTable),
    Buffer.from(keysBuffer),
    Buffer.from(valuesBuffer),
  ]);
  fs.writeFileSync(outputPath, output);

  console.log(`  Written: ${outputPath}`);
  console.log(`    Keys: ${sortedKeys.length}`);
  console.log(`    Size: ${(output.length / 1024 / 1024).toFixed(2)} MB`);
}

// ============================================================================
// Extract Data from SQLite
// ============================================================================

function extractWmiSchemas(db: Database.Database): IndexBuilder {
  console.log('\nExtracting WMI → Schema mappings...');

  const stmt = db.prepare(`
    SELECT
      w.Wmi,
      wvs.VinSchemaId as schemaId,
      wvs.YearFrom as yearFrom,
      wvs.YearTo as yearTo
    FROM Wmi w
    JOIN Wmi_VinSchema wvs ON w.Id = wvs.WmiId
    ORDER BY w.Wmi, wvs.YearFrom
  `);

  const rows = stmt.all() as Array<{
    Wmi: string;
    schemaId: number;
    yearFrom: number;
    yearTo: number | null;
  }>;

  // Group by WMI
  const wmiMap = new Map<string, WmiSchema[]>();
  for (const row of rows) {
    const schemas = wmiMap.get(row.Wmi) || [];
    schemas.push({
      schemaId: row.schemaId,
      yearFrom: row.yearFrom,
      yearTo: row.yearTo,
    });
    wmiMap.set(row.Wmi, schemas);
  }

  console.log(`  Found ${wmiMap.size} unique WMIs`);

  const keys: string[] = [];
  const values: Uint8Array[] = [];
  for (const [wmi, schemas] of wmiMap) {
    keys.push(wmi);
    values.push(msgpack.encode(schemas));
  }

  return { keys, values };
}

function extractWmiMakes(db: Database.Database): IndexBuilder {
  console.log('\nExtracting WMI → Make mappings...');

  const stmt = db.prepare(`
    SELECT DISTINCT
      w.Wmi,
      ma.Name as make,
      m.Name as manufacturer,
      c.Name as country,
      vt.Name as vehicleType
    FROM Wmi w
    LEFT JOIN Wmi_Make wm ON w.Id = wm.WmiId
    LEFT JOIN Make ma ON wm.MakeId = ma.Id
    LEFT JOIN Manufacturer m ON w.ManufacturerId = m.Id
    LEFT JOIN Country c ON w.CountryId = c.Id
    LEFT JOIN VehicleType vt ON w.VehicleTypeId = vt.Id
    WHERE w.Wmi IS NOT NULL
    ORDER BY w.Wmi
  `);

  const rows = stmt.all() as Array<{
    Wmi: string;
    make: string | null;
    manufacturer: string | null;
    country: string | null;
    vehicleType: string | null;
  }>;

  // Group by WMI (may have multiple makes)
  const wmiMap = new Map<string, WmiMake[]>();
  for (const row of rows) {
    const makes = wmiMap.get(row.Wmi) || [];
    if (row.make || row.manufacturer) {
      makes.push({
        make: row.make || row.manufacturer || 'Unknown',
        manufacturer: row.manufacturer,
        country: row.country,
        vehicleType: row.vehicleType,
      });
    }
    wmiMap.set(row.Wmi, makes);
  }

  console.log(`  Found ${wmiMap.size} WMI → Make mappings`);

  const keys: string[] = [];
  const values: Uint8Array[] = [];
  for (const [wmi, makes] of wmiMap) {
    if (makes.length > 0) {
      keys.push(wmi);
      values.push(msgpack.encode(makes));
    }
  }

  return { keys, values };
}

function extractPatterns(db: Database.Database): IndexBuilder {
  console.log('\nExtracting Schema → Pattern lookups...');

  // Get all patterns with resolved values
  const stmt = db.prepare(`
    SELECT
      p.VinSchemaId as schemaId,
      p.Keys as pattern,
      e.Name as elementName,
      e.LookupTable as lookupTable,
      p.AttributeId as attributeId,
      e.weight as elementWeight
    FROM Pattern p
    JOIN Element e ON p.ElementId = e.Id
    ORDER BY p.VinSchemaId, e.weight DESC
  `);

  const rows = stmt.all() as Array<{
    schemaId: number;
    pattern: string;
    elementName: string;
    lookupTable: string | null;
    attributeId: string;
    elementWeight: number | null;
  }>;

  console.log(`  Found ${rows.length} raw patterns`);

  // Build lookup table caches
  const lookupCaches = new Map<string, Map<string, string>>();
  const lookupTables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    AND name IN ('Make', 'Model', 'BodyStyle', 'FuelType', 'DriveType',
                 'Transmission', 'EngineConfiguration', 'Country',
                 'GrossVehicleWeightRating', 'BatteryType', 'ChargerLevel',
                 'Turbo', 'BrakeSystem', 'ElectrificationLevel', 'EVDriveUnit')
  `).all() as Array<{ name: string }>;

  for (const { name } of lookupTables) {
    try {
      const cache = new Map<string, string>();
      const lookupRows = db.prepare(`SELECT CAST(Id AS TEXT) as id, Name as name FROM ${name}`).all() as Array<{ id: string; name: string }>;
      for (const row of lookupRows) {
        cache.set(row.id, row.name);
      }
      lookupCaches.set(name, cache);
    } catch (e) {
      // Table doesn't exist or has different schema
    }
  }

  // Group by schema and resolve values
  const schemaMap = new Map<number, Lookup[]>();
  let resolvedCount = 0;

  for (const row of rows) {
    const lookups = schemaMap.get(row.schemaId) || [];

    // Resolve attribute ID to name
    let resolved = row.attributeId;
    if (row.lookupTable && lookupCaches.has(row.lookupTable)) {
      const cache = lookupCaches.get(row.lookupTable)!;
      resolved = cache.get(row.attributeId) || row.attributeId;
      if (resolved !== row.attributeId) resolvedCount++;
    }

    lookups.push({
      pattern: row.pattern,
      elementCode: row.elementName,
      resolved,
      weight: row.elementWeight || 0,
    });
    schemaMap.set(row.schemaId, lookups);
  }

  console.log(`  Resolved ${resolvedCount} attribute IDs via lookup tables`);
  console.log(`  Grouped into ${schemaMap.size} schemas`);

  const keys: string[] = [];
  const values: Uint8Array[] = [];
  for (const [schemaId, lookups] of schemaMap) {
    keys.push(String(schemaId));
    values.push(msgpack.encode(lookups));
  }

  return { keys, values };
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const dbPath = process.argv[2] || path.join(__dirname, '../../db/vpic.lite.db');
  const outputDir = process.argv[3] || path.join(__dirname, '../dist');

  console.log('Corgi v3 - Transform Pipeline');
  console.log('==============================');
  console.log(`Input:  ${dbPath}`);
  console.log(`Output: ${outputDir}`);

  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found: ${dbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const db = new Database(dbPath, { readonly: true });

  try {
    // Extract and write WMI → Schema index
    const wmiSchemas = extractWmiSchemas(db);
    writeIndex(path.join(outputDir, 'wmi-schema.idx'), wmiSchemas);

    // Extract and write WMI → Make index
    const wmiMakes = extractWmiMakes(db);
    writeIndex(path.join(outputDir, 'wmi-make.idx'), wmiMakes);

    // Extract and write Schema → Patterns index
    const patterns = extractPatterns(db);
    writeIndex(path.join(outputDir, 'patterns.idx'), patterns);

    // Summary
    const totalSize = fs.readdirSync(outputDir)
      .filter(f => f.endsWith('.idx'))
      .reduce((sum, f) => sum + fs.statSync(path.join(outputDir, f)).size, 0);

    console.log('\n==============================');
    console.log(`Total index size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('Transform complete!');

  } finally {
    db.close();
  }
}

main().catch(console.error);
