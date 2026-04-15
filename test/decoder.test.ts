/**
 * Corgi v3 - Decoder Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { createDecoder, VINDecoder } from '../src';

const INDEX_DIR = path.join(__dirname, '../dist');
const DB_PATH = path.join(__dirname, '../../db/vpic.lite.db');

describe('Corgi v3 Decoder', () => {
  let decoder: VINDecoder;

  beforeAll(async () => {
    // Generate indexes if they don't exist
    if (!fs.existsSync(path.join(INDEX_DIR, 'patterns.idx'))) {
      console.log('Generating indexes...');
      execSync(`npx tsx ${path.join(__dirname, '../build/transform.ts')} ${DB_PATH} ${INDEX_DIR}`, {
        stdio: 'inherit',
      });
    }

    decoder = await createDecoder(INDEX_DIR);
  });

  describe('VIN Validation', () => {
    it('should reject VINs with invalid length', () => {
      const result = decoder.decode('ABC123');
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_LENGTH');
    });

    it('should reject VINs with invalid characters', () => {
      const result = decoder.decode('WVGZZZ5NZEW06929I'); // I is invalid
      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_CHARACTERS');
    });

    it('should accept valid US VINs', () => {
      const result = decoder.decode('1HGBH41JXMN109186');
      expect(result.errors).toHaveLength(0);
      expect(result.components.wmi).toBe('1HG');
      expect(result.components.vds).toBe('BH41JX');
      expect(result.components.vis).toBe('MN109186');
    });
  });

  describe('US VIN Decoding', () => {
    const testCases = [
      {
        vin: 'KM8K2CAB4PU001140',
        expected: { make: 'Hyundai', model: 'Kona', year: 2023 },
      },
      {
        vin: '5N1AT2MT9LC784186',
        expected: { make: 'Nissan', model: 'Rogue', year: 2020 },
      },
      {
        vin: '2T3P1RFV6MW232610',
        expected: { make: 'Toyota', model: 'RAV4', year: 2021 },
      },
      {
        vin: '1G1YY22G965106088',
        expected: { make: 'Chevrolet', model: 'Corvette', year: 2006 },
      },
    ];

    it.each(testCases)('should decode $vin', ({ vin, expected }) => {
      const result = decoder.decode(vin);

      expect(result.valid).toBe(true);
      expect(result.vehicle?.make).toBe(expected.make);
      expect(result.vehicle?.model).toContain(expected.model);
      expect(result.vehicle?.year).toBe(expected.year);
    });
  });

  describe('EU VIN Handling', () => {
    it('should warn but not error on non-standard check digit', () => {
      const result = decoder.decode('WVGZZZ5NZEW069297'); // VW Tiguan EU

      // Should have warning, not error
      expect(result.errors).toHaveLength(0);
      const checkDigitWarning = result.warnings.find(
        w => w.code === 'NON_STANDARD_CHECK_DIGIT'
      );
      expect(checkDigitWarning).toBeDefined();
    });
  });

  describe('Batch Decoding', () => {
    it('should decode multiple VINs', () => {
      const vins = [
        'KM8K2CAB4PU001140',
        '5N1AT2MT9LC784186',
        '2T3P1RFV6MW232610',
      ];

      const results = decoder.decodeBatch(vins);

      expect(results).toHaveLength(3);
      expect(results[0].vehicle?.make).toBe('Hyundai');
      expect(results[1].vehicle?.make).toBe('Nissan');
      expect(results[2].vehicle?.make).toBe('Toyota');
    });

    it('should handle mixed valid/invalid VINs in batch', () => {
      const vins = [
        'KM8K2CAB4PU001140', // valid
        'INVALID',           // invalid
        '5N1AT2MT9LC784186', // valid
      ];

      const results = decoder.decodeBatch(vins);

      expect(results[0].valid).toBe(true);
      expect(results[1].valid).toBe(false);
      expect(results[2].valid).toBe(true);
    });
  });

  describe('Component Extraction', () => {
    it('should extract engine info', () => {
      const result = decoder.decode('2T3P1RFV6MW232610');

      expect(result.engine).toBeDefined();
      expect(result.engine?.cylinders).toBeDefined();
    });

    // Note: Plant info for some VINs comes from VehicleSpecSchema tables,
    // not Pattern table. This is a known gap in POC (Pattern table only).
    // See: https://github.com/cardog-ai/corgi/issues/27
    it.skip('should extract plant info', () => {
      const result = decoder.decode('2T3P1RFV6MW232610');

      expect(result.plant).toBeDefined();
      expect(result.plant?.code).toBe('M');
    });
  });

  describe('Model Year Decoding', () => {
    const yearCases = [
      { char: 'A', year: 2010 },
      { char: 'K', year: 2019 },
      { char: 'L', year: 2020 },
      { char: 'N', year: 2022 },
      { char: 'P', year: 2023 },
      { char: 'R', year: 2024 },
      { char: 'S', year: 2025 },
      { char: 'T', year: 2026 },
    ];

    it.each(yearCases)('should decode year code $char as $year', ({ char, year }) => {
      // Create a test VIN with the year code
      const testVin = `1HGBH41JX${char}N109186`;
      const result = decoder.decode(testVin);

      expect(result.components.modelYear).toBe(year);
    });
  });
});
