/**
 * EU VIN Decoding Tests
 *
 * Tests for European VINs that follow ISO 3779 rather than US 49 CFR 565.
 * Key differences:
 * - Position 9: US requires check digit (0-9, X); EU can use any alphanumeric
 * - Position 10: US requires model year code; EU may use '0' or other values
 *
 * Customer VINs from CERTCAR (Romania) - GitHub Issue #26
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { VINDecoder } from '../lib/index';
import { NodeDatabaseAdapter } from '../lib/db/node-adapter';
import { ErrorSeverity, ErrorCategory } from '../lib/types';
import path from 'path';

const TEST_DB_PATH = path.join(__dirname, './test.db');

describe('EU VIN Decoding (ISO 3779)', () => {
  let decoder: VINDecoder;

  beforeAll(async () => {
    const adapter = new NodeDatabaseAdapter(TEST_DB_PATH);
    decoder = new VINDecoder(adapter);
  });

  // Customer VINs from CERTCAR Romania
  const euVins = [
    // Position 9 has non-standard character (Z, B, etc.)
    { vin: 'WVGZZZ5NZEW069297', make: 'Volkswagen', model: 'Tiguan', note: 'pos9=Z' },
    { vin: 'WF0KXXGCBKBJ13223', make: 'Ford', model: 'Focus', note: 'pos9=B' },
    { vin: 'TMBNJ46Y964564271', make: 'Skoda', model: 'Fabia', note: 'WMI=TMB' },
    { vin: 'TMBBS21Z588029342', make: 'Skoda', model: 'Octavia', note: 'pos9=8' },
    { vin: 'WAUZZZ8K1DA006278', make: 'Audi', model: 'A4', note: 'pos9=1' },
    { vin: 'WAUZZZ8U2FR048870', make: 'Audi', model: 'Q3', note: 'pos9=2' },
    { vin: 'WVWZZZ3CZFE824021', make: 'Volkswagen', model: 'Passat CC', note: 'pos9=Z' },
    { vin: 'WDD2040081A167295', make: 'Mercedes', model: 'C-Class', note: 'pos9=0' },
    { vin: 'SALCA2BN4HH647022', make: 'Land Rover', model: 'Discovery', note: 'pos9=4' },
    { vin: 'WDB4633461X203172', make: 'Mercedes', model: 'G350', note: 'pos9=1' },
    { vin: 'VF38DRHC8CL054898', make: 'Peugeot', model: '508', note: 'pos9=8' },
    { vin: 'JM4BP6HGA01310285', make: 'Mazda', model: '3', note: 'pos9=A' },
    { vin: 'TMBJR7NU1L2011449', make: 'Skoda', model: 'Karoq', note: 'pos9=1' },
    { vin: 'WP1ZZZ9YZJDA80675', make: 'Porsche', model: 'Cayenne Turbo', note: 'pos9=Z' },
    { vin: 'VF3MRHNSUKS393145', make: 'Peugeot', model: '3008', note: 'pos9=U' },
    { vin: 'VF1HJD40367321336', make: 'Dacia', model: 'Duster', note: 'pos9=3' },
    { vin: 'WF02XXERK2MU85396', make: 'Ford', model: 'Puma', note: 'pos9=K' },
    { vin: 'W0VZRHNS4L6041423', make: 'Opel', model: 'Grandland X', note: 'pos9=4' },
    { vin: 'VF1HJD40069051969', make: 'Dacia', model: 'Duster', note: 'pos9=0' },
    { vin: 'JTNB23HK203029472', make: 'Toyota', model: 'Camry', note: 'pos9=2' },
    { vin: 'WDC1671211A103972', make: 'Mercedes', model: 'GLE', note: 'pos9=1' },
    { vin: 'WDD2573591A030874', make: 'Mercedes', model: 'CLS 450', note: 'pos9=1' },
    { vin: 'W1K2383831F134704', make: 'Mercedes', model: 'E300', note: 'pos9=3' },
    { vin: 'VF1RFD00958596276', make: 'Renault', model: 'Talisman', note: 'pos9=9' },
    { vin: 'WAUZZZF84LN004877', make: 'Audi', model: 'A8L', note: 'pos9=4' },
    { vin: 'VF1RFB00068721753', make: 'Renault', model: 'Megane', note: 'pos9=0' },
    { vin: 'VF1RFA00764642517', make: 'Renault', model: 'Grand Scenic', note: 'pos9=7' },
    { vin: 'VF1RFE00561329202', make: 'Renault', model: 'Kadjar', note: 'pos9=5' },
    { vin: 'WVGZZZ7PZFD021774', make: 'Volkswagen', model: 'Touareg', note: 'pos9=Z' },
    { vin: 'WBAJR31050CE20846', make: 'BMW', model: '5 Series', note: 'pos9=0' },
  ];

  // VINs that should work (Tesla Berlin has community patterns)
  const workingEuVins = [
    { vin: 'XP7YGCEL1PB065727', make: 'Tesla', model: 'Model Y', note: 'Berlin' },
  ];

  // US VINs for comparison
  const usVins = [
    { vin: '5YJ3E7EB5LF757595', make: 'Tesla', model: 'Model 3' },
  ];

  describe('Structure Validation', () => {
    it('should NOT block EU VINs with non-standard position 9 characters', async () => {
      // VINs with Z, B, K, U etc at position 9 should pass structure validation
      const nonStandardPos9 = euVins.filter(v =>
        !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'].includes(v.vin[8])
      );

      for (const { vin, note } of nonStandardPos9) {
        const result = await decoder.decode(vin);

        // Should NOT have structure errors blocking decoding
        const structureErrors = result.errors.filter(
          e => e.category === ErrorCategory.STRUCTURE && e.severity === ErrorSeverity.ERROR
        );

        expect(structureErrors, `${vin} (${note}) should not have blocking structure errors`).toHaveLength(0);
      }
    });

    it('should add WARNING for non-standard check digit character', async () => {
      const vinsWithNonStandardPos9 = [
        'WVGZZZ5NZEW069297', // Z at position 9
        'WF0KXXGCBKBJ13223', // B at position 9
        'WP1ZZZ9YZJDA80675', // Z at position 9
      ];

      for (const vin of vinsWithNonStandardPos9) {
        const result = await decoder.decode(vin);

        // Should have a WARNING about non-standard check digit
        const checkDigitWarning = result.errors.find(
          e => e.severity === ErrorSeverity.WARNING &&
               e.message.toLowerCase().includes('check digit')
        );

        expect(checkDigitWarning, `${vin} should have check digit warning`).toBeDefined();
      }
    });

    it('should still validate standard check digit characters (0-9, X)', async () => {
      // These VINs have standard characters at position 9
      const standardPos9 = euVins.filter(v =>
        ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'X'].includes(v.vin[8])
      );

      for (const { vin } of standardPos9) {
        const result = await decoder.decode(vin);

        // Should NOT have "invalid character at position 9" error
        const pos9CharError = result.errors.find(
          e => e.message.includes('position 9') && e.message.includes('Invalid characters')
        );

        expect(pos9CharError, `${vin} should not have position 9 character error`).toBeUndefined();
      }
    });
  });

  describe('Tesla Berlin (XP7) - Community Patterns', () => {
    it('should fully decode Tesla Berlin VINs', async () => {
      const result = await decoder.decode('XP7YGCEL1PB065727');

      expect(result.valid).toBe(true);
      expect(result.components.vehicle?.make).toBe('Tesla');
      expect(result.components.vehicle?.model).toBe('Model Y');
    });
  });

  describe('WMI Recognition', () => {
    it('should recognize EU WMIs even without full patterns', async () => {
      // These WMIs should at least be recognized, even if patterns don't match
      const wmiTests = [
        { vin: 'WAUZZZ8K1DA006278', expectedCountry: 'GERMANY' }, // Audi
        { vin: 'WDD2040081A167295', expectedMake: 'Mercedes' },    // Mercedes
        { vin: 'WBAJR31050CE20846', expectedMake: 'BMW' },         // BMW
      ];

      for (const { vin, expectedCountry, expectedMake } of wmiTests) {
        const result = await decoder.decode(vin);

        if (expectedCountry) {
          expect(result.components.wmi?.country).toBe(expectedCountry);
        }
        if (expectedMake) {
          expect(result.components.wmi?.make?.toLowerCase()).toContain(expectedMake.toLowerCase());
        }
      }
    });
  });

  describe('US VINs (49 CFR 565) - Baseline', () => {
    it('should fully decode US VINs', async () => {
      for (const { vin, make, model } of usVins) {
        const result = await decoder.decode(vin);

        expect(result.valid, `${vin} should be valid`).toBe(true);
        expect(result.components.vehicle?.make).toBe(make);
        expect(result.components.vehicle?.model).toBe(model);
      }
    });
  });
});
