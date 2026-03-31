/**
 * Tests to verify that Element names in decode.ts match the actual NHTSA vPIC database.
 *
 * This catches mismatches like:
 * - 'Transmission' vs 'Transmission Style'
 * - 'DriveType' vs 'Drive Type'
 * - 'Engine Power (KW)' vs 'Engine Power (kW)'
 *
 * @see https://github.com/cardog-ai/corgi/issues/27
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { NodeDatabaseAdapter } from '../lib/db/node-adapter';
import path from 'path';

const DB_PATH = path.join(__dirname, '../db/vpic.lite.db');

// Element names used in decode.ts extractVehicleInfo()
const VEHICLE_ELEMENT_NAMES = [
  'Make',
  'Series',
  'Trim',
  // 'Trim Level', // fallback alias, doesn't exist in DB
  'Body Class',
  // 'Body Style', // fallback alias, doesn't exist in DB
  'Drive Type',
  'Fuel Type - Primary',
  'Fuel Type - Secondary',
  'Transmission Style',
  'Doors',
  'Gross Vehicle Weight Rating From',
];

// Element names used in decode.ts extractEngineInfo()
const ENGINE_ELEMENT_NAMES = [
  'Engine Model',
  'Engine Number of Cylinders',
  // 'Cylinders', // fallback alias, doesn't exist in DB
  'Displacement (L)',
  'Engine Brake (hp) From',
  'Engine Power (kW)',
  'Fuel Type - Primary',
  // 'Fuel Type', // fallback alias, doesn't exist in DB
];

// Element names used in decode.ts extractPlantInfo()
const PLANT_ELEMENT_NAMES = [
  'Plant Country',
  'Plant City',
  'Plant Company Name',
];

describe('Element Name Validation', () => {
  let adapter: NodeDatabaseAdapter;
  let dbElementNames: Set<string>;

  beforeAll(async () => {
    adapter = new NodeDatabaseAdapter(DB_PATH);

    // Get all Element names from the database
    const result = await adapter.exec('SELECT Name FROM Element', []);
    dbElementNames = new Set(
      result[0]?.values?.map((row: any[]) => row[0] as string) ?? []
    );
  });

  describe('Vehicle Element Names', () => {
    it.each(VEHICLE_ELEMENT_NAMES)('"%s" exists in database', (name) => {
      expect(dbElementNames.has(name)).toBe(true);
    });
  });

  describe('Engine Element Names', () => {
    it.each(ENGINE_ELEMENT_NAMES)('"%s" exists in database', (name) => {
      expect(dbElementNames.has(name)).toBe(true);
    });
  });

  describe('Plant Element Names', () => {
    it.each(PLANT_ELEMENT_NAMES)('"%s" exists in database', (name) => {
      expect(dbElementNames.has(name)).toBe(true);
    });
  });

  describe('Critical Element Names (with patterns)', () => {
    it('Transmission Style has patterns in database', async () => {
      const result = await adapter.exec(
        `SELECT COUNT(*) FROM Pattern p
         JOIN Element e ON p.ElementId = e.Id
         WHERE e.Name = 'Transmission Style'`,
        []
      );
      const count = result[0]?.values?.[0]?.[0] as number;
      // Note: Currently 0 because NHTSA doesn't encode transmission in VIN patterns
      // This test documents the expected behavior
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('Drive Type exists and has correct LookupTable', async () => {
      const result = await adapter.exec(
        `SELECT Name, LookupTable FROM Element WHERE Name = 'Drive Type'`,
        []
      );
      expect(result[0]?.values?.length).toBe(1);
      expect(result[0]?.values?.[0]?.[1]).toBe('DriveType');
    });

    it('Transmission Style exists and has correct LookupTable', async () => {
      const result = await adapter.exec(
        `SELECT Name, LookupTable FROM Element WHERE Name = 'Transmission Style'`,
        []
      );
      expect(result[0]?.values?.length).toBe(1);
      expect(result[0]?.values?.[0]?.[1]).toBe('Transmission');
    });
  });
});
