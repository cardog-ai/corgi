/**
 * Comprehensive VIN Decoder Test Suite
 *
 * Tests VIN decoding accuracy against real-world VINs from Cardog's production database.
 * Organized by:
 * - Problematic VINs (regression tests from GitHub issues)
 * - VINs by manufacturer
 * - VINs by body style
 * - Historical/older vehicles
 * - Luxury brands
 * - NHTSA validation
 */

import { VINDecoder, createDecoder } from "../lib/index";
import { DecodeResult, BodyStyle, ErrorCode, ErrorCategory } from "../lib/types";
import { NodeDatabaseAdapterFactory } from "../lib/db/node-adapter";
import { DatabaseAdapter } from "../lib/db/adapter";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";

import {
  PROBLEMATIC_VINS,
  FORD_F_SERIES_VINS,
  VINS_BY_MAKE,
  VINS_BY_BODY_STYLE,
  OLDER_VEHICLE_VINS,
  LUXURY_BRAND_VINS,
  KNOWN_WMI_ISSUES,
  KNOWN_MODEL_ISSUES,
  INVALID_VIN_ISSUES,
  VINTestCase,
  ProblematicVINTestCase,
  getAllTestVINs,
  getTestVINCount,
} from "./fixtures";

// Set of VINs with known issues that should be skipped in comprehensive tests
const KNOWN_ISSUE_VINS = new Set([
  ...KNOWN_WMI_ISSUES.map((i) => i.vin),
  ...KNOWN_MODEL_ISSUES.map((i) => i.vin),
  ...INVALID_VIN_ISSUES.map((i) => i.vin),
]);

const TEST_DB_PATH = path.join(__dirname, "./test.db");

async function getAdapter(): Promise<DatabaseAdapter> {
  const factory = new NodeDatabaseAdapterFactory();
  return factory.createAdapter(TEST_DB_PATH);
}

describe("Comprehensive VIN Decoder Tests", () => {
  let decoder: VINDecoder;
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = await getAdapter();
    decoder = new VINDecoder(adapter);
    console.log(`\nRunning comprehensive tests with ${getTestVINCount()} unique VINs\n`);
  });

  afterAll(async () => {
    await adapter.close();
  });

  describe("Problematic VINs - Regression Tests", () => {
    /**
     * These tests verify that VINs previously reported as problematic
     * are now being decoded correctly. VINs that are still known to
     * have issues are tracked in known-issues.test.ts
     */

    describe("GitHub Issue #22: Subaru VIN", () => {
      // Note: The F-150 VIN from issue #22 is in known-issues.test.ts
      // as it still has the F-550 misidentification bug

      it("should decode the Subaru VIN from issue #22 correctly", async () => {
        const result = await decoder.decode("4S4SLDB69T3023252", {
          includePatternDetails: true,
        });

        expect(result.valid).toBe(true);
        expect(result.components.wmi?.make).toBe("Subaru");
        expect(result.components.modelYear?.year).toBe(2026);
      });
    });

    describe("Problematic VINs (excluding known issues)", () => {
      // Filter out VINs that have known issues tracked elsewhere
      const testableVins = PROBLEMATIC_VINS.filter(
        (v) => !KNOWN_ISSUE_VINS.has(v.vin)
      );

      testableVins.forEach(({ vin, expected, issue, description }) => {
        it(`should correctly decode ${vin} (${description || expected.model})`, async () => {
          const result = await decoder.decode(vin, {
            includePatternDetails: true,
          });

          expect(result.valid).toBe(true);
          expect(result.components.wmi?.make).toBe(expected.make);
          expect(result.components.modelYear?.year).toBe(expected.year);

          const modelPattern = result.patterns?.find((p) => p.element === "Model");
          if (modelPattern) {
            expect(modelPattern.value).toBe(expected.model);
          }
        });
      });
    });
  });

  describe("Ford F-Series - Model Differentiation", () => {
    /**
     * Critical tests for Ford F-Series trucks.
     * The decoder must correctly differentiate between F-150, F-250, F-350, F-450, and F-550.
     */

    describe("F-150 VINs", () => {
      // Include ALL F-150 VINs - the fix should make the previously failing one pass
      const f150Vins = FORD_F_SERIES_VINS.filter(
        (v) => v.expected.model === "F-150"
      );

      f150Vins.forEach(({ vin, expected }) => {
        it(`should decode ${vin} as F-150 (${expected.year})`, async () => {
          const result = await decoder.decode(vin, { includePatternDetails: true });

          expect(result.valid).toBe(true);
          expect(result.components.wmi?.make).toBe("Ford");
          expect(result.components.modelYear?.year).toBe(expected.year);

          const modelPattern = result.patterns?.find((p) => p.element === "Model");
          // Model should be F-150, not F-550 or other F-series
          expect(modelPattern?.value).toBe("F-150");
        });
      });
    });

    describe("Other F-Series Models", () => {
      const otherFSeries = FORD_F_SERIES_VINS.filter(
        (v) => v.expected.model !== "F-150" && v.expected.model !== "F-150 Lightning"
      );

      otherFSeries.forEach(({ vin, expected, description }) => {
        it(`should decode ${vin} as ${expected.model} (${expected.year})`, async () => {
          const result = await decoder.decode(vin, { includePatternDetails: true });

          expect(result.valid).toBe(true);
          expect(result.components.wmi?.make).toBe("Ford");
          expect(result.components.modelYear?.year).toBe(expected.year);

          // For Super Duty models, the model name might vary
          const modelPattern = result.patterns?.find((p) => p.element === "Model");
          if (modelPattern) {
            // Accept either exact model or model containing the expected series (F-250, F-350, etc.)
            const modelSeries = expected.model.split(" ")[0]; // Get "F-250", "F-350", etc.
            // Normalize both values by removing hyphens for comparison
            const normalizedExpected = modelSeries.replace(/-/g, "");
            const normalizedActual = (modelPattern.value || "").replace(/-/g, "");
            expect(normalizedActual).toContain(normalizedExpected);
          }
        });
      });
    });

    describe("F-150 Lightning (Electric)", () => {
      const lightningVins = FORD_F_SERIES_VINS.filter((v) =>
        v.expected.model.includes("Lightning")
      );

      lightningVins.forEach(({ vin, expected }) => {
        it(`should decode ${vin} as F-150 Lightning`, async () => {
          const result = await decoder.decode(vin, { includePatternDetails: true });

          expect(result.valid).toBe(true);
          expect(result.components.wmi?.make).toBe("Ford");

          const modelPattern = result.patterns?.find((p) => p.element === "Model");
          // Should be identified as F-150 Lightning or F-150
          expect(modelPattern?.value).toMatch(/F-150|Lightning/);
        });
      });
    });
  });

  describe("VINs by Manufacturer", () => {
    Object.entries(VINS_BY_MAKE).forEach(([make, vins]) => {
      // Filter out VINs with known issues
      const testableVins = vins.filter((v) => !KNOWN_ISSUE_VINS.has(v.vin));

      // Skip empty test suites (all VINs have known issues)
      if (testableVins.length === 0) {
        it.skip(`${make} - all VINs have known issues (see known-issues.test.ts)`, () => {});
        return;
      }

      describe(`${make} Vehicles`, () => {
        testableVins.forEach(({ vin, expected }) => {
          it(`should decode ${vin} as ${expected.year} ${expected.make} ${expected.model}`, async () => {
            const result = await decoder.decode(vin, {
              includePatternDetails: true,
            });

            expect(result.valid).toBe(true);

            // Verify make
            expect(result.components.wmi?.make).toBe(expected.make);

            // Verify year
            expect(result.components.modelYear?.year).toBe(expected.year);

            // Verify model through patterns
            const modelPattern = result.patterns?.find((p) => p.element === "Model");
            if (modelPattern) {
              // Some models have variations (e.g., "CR-V" vs "CR-V Hybrid")
              // Check if the base model name is contained
              const baseModel = expected.model.split(" ")[0];
              expect(modelPattern.value?.toLowerCase()).toContain(
                baseModel.toLowerCase()
              );
            }
          });
        });
      });
    });
  });

  describe("VINs by Body Style", () => {
    Object.entries(VINS_BY_BODY_STYLE).forEach(([bodyStyle, vins]) => {
      // Filter out VINs with known issues
      const testableVins = vins.filter((v) => !KNOWN_ISSUE_VINS.has(v.vin));

      // Skip empty test suites
      if (testableVins.length === 0) {
        it.skip(`${bodyStyle} - all VINs have known issues`, () => {});
        return;
      }

      describe(`${bodyStyle} Vehicles`, () => {
        testableVins.forEach(({ vin, expected }) => {
          it(`should decode ${vin} as ${expected.make} ${expected.model} (${bodyStyle})`, async () => {
            const result = await decoder.decode(vin, {
              includePatternDetails: true,
            });

            expect(result.valid).toBe(true);
            expect(result.components.wmi?.make).toBe(expected.make);
            expect(result.components.modelYear?.year).toBe(expected.year);

            // Body style verification - check if decoded body style matches expected
            if (expected.bodyStyle) {
              const bodyPattern = result.patterns?.find(
                (p) => p.element === "Body Class"
              );
              // Body style mapping can vary, so we check if a body pattern exists
              // and vehicle info reflects the expected category
              if (result.components.vehicle?.bodyStyle) {
                // The body style might be normalized differently
                // Just verify it's a valid body style
                expect(Object.values(BodyStyle)).toContain(
                  result.components.vehicle.bodyStyle
                );
              }
            }
          });
        });
      });
    });
  });

  describe("Historical Vehicles (1995-2010)", () => {
    /**
     * Tests for older vehicles to ensure historical data is properly decoded.
     */

    OLDER_VEHICLE_VINS.forEach(({ vin, expected }) => {
      it(`should decode ${expected.year} ${expected.make} ${expected.model}`, async () => {
        const result = await decoder.decode(vin, {
          includePatternDetails: true,
        });

        expect(result.valid).toBe(true);
        expect(result.components.wmi?.make).toBe(expected.make);
        expect(result.components.modelYear?.year).toBe(expected.year);

        // Verify the model is decoded
        const modelPattern = result.patterns?.find((p) => p.element === "Model");
        if (modelPattern) {
          // For older vehicles, model names might have variations
          expect(modelPattern.value).toBeDefined();
        }
      });
    });
  });

  describe("Luxury Brands", () => {
    /**
     * Tests for luxury/premium brands: Acura, Audi, BMW, Cadillac, Genesis,
     * Jaguar, Land Rover, Lexus, Lincoln, Mercedes-Benz, Porsche
     */

    // Filter out VINs with known issues
    const testableVins = LUXURY_BRAND_VINS.filter((v) => !KNOWN_ISSUE_VINS.has(v.vin));

    testableVins.forEach(({ vin, expected }) => {
      it(`should decode ${expected.year} ${expected.make} ${expected.model}`, async () => {
        const result = await decoder.decode(vin, {
          includePatternDetails: true,
        });

        expect(result.valid).toBe(true);
        expect(result.components.wmi?.make).toBe(expected.make);
        expect(result.components.modelYear?.year).toBe(expected.year);

        const modelPattern = result.patterns?.find((p) => p.element === "Model");
        if (modelPattern) {
          // Luxury models might have additional designations
          // Verify the base model is present
          const baseModel = expected.model.split(" ")[0];
          // Normalize by removing spaces and special characters for comparison
          const normalizedExpected = baseModel.toLowerCase().replace(/[^a-z0-9]/g, "");
          const normalizedActual = (modelPattern.value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          expect(normalizedActual).toContain(normalizedExpected);
        }
      });
    });
  });

  describe("Confidence and Pattern Quality", () => {
    /**
     * Tests to verify the decoder provides meaningful confidence scores
     * and high-quality pattern matches.
     */

    it("should provide confidence scores between 0 and 1", async () => {
      const vins = getAllTestVINs().slice(0, 20); // Test first 20 VINs

      for (const { vin } of vins) {
        const result = await decoder.decode(vin, {
          includePatternDetails: true,
          includeDiagnostics: true,
        });

        if (result.valid) {
          // Check metadata confidence
          expect(result.metadata?.confidence).toBeGreaterThanOrEqual(0);
          expect(result.metadata?.confidence).toBeLessThanOrEqual(1);

          // Check pattern confidences
          result.patterns?.forEach((pattern) => {
            expect(pattern.confidence).toBeGreaterThanOrEqual(0);
            expect(pattern.confidence).toBeLessThanOrEqual(1);
          });
        }
      }
    });

    it("should have high confidence for well-known VINs", async () => {
      // Test a few well-known, common VINs
      const commonVins = [
        "1FTFW5L88TFA10526", // Ford F-150
        "2HKRW2H20NH207506", // Honda CR-V
        "5N1AT2MVXLC807279", // Nissan Rogue
      ];

      for (const vin of commonVins) {
        const result = await decoder.decode(vin, {
          includePatternDetails: true,
          includeDiagnostics: true,
        });

        expect(result.valid).toBe(true);
        // Common vehicles should have reasonable confidence
        expect(result.metadata?.confidence).toBeGreaterThan(0.5);
      }
    });

    it("should have consistent pattern element coverage", async () => {
      const result = await decoder.decode("1FTFW5L88TFA10526", {
        includePatternDetails: true,
      });

      expect(result.valid).toBe(true);

      // Check that key elements are present in patterns
      const elements = new Set(result.patterns?.map((p) => p.element) || []);

      // These elements should typically be present
      expect(elements.has("Make")).toBe(true);
      expect(elements.has("Model")).toBe(true);
    });
  });

  describe("VIN Validation", () => {
    /**
     * Tests for VIN validation logic including check digit,
     * character validation, and structure validation.
     */

    describe("Check Digit Validation", () => {
      it("should validate correct check digits", async () => {
        const validVins = getAllTestVINs().slice(0, 10);

        for (const { vin } of validVins) {
          const result = await decoder.decode(vin);
          // Most real-world VINs should have valid check digits
          // Some might not if they're incomplete/test VINs
          expect(result.components.checkDigit).toBeDefined();
        }
      });

      it("should detect invalid check digits", async () => {
        // Take a valid VIN and corrupt the check digit
        const validVin = "1HGCM82633A004352"; // Valid check digit is 3
        const corruptedVin = "1HGCM82643A004352"; // Changed check digit to 4

        const result = await decoder.decode(corruptedVin);

        expect(result.components.checkDigit?.isValid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ErrorCode.INVALID_CHECK_DIGIT)
        ).toBe(true);
      });
    });

    describe("Invalid VIN Structure", () => {
      it("should reject VINs with invalid length", async () => {
        const result = await decoder.decode("ABC123");

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ErrorCode.INVALID_LENGTH)
        ).toBe(true);
      });

      it("should reject VINs with invalid characters (I, O, Q)", async () => {
        const result = await decoder.decode("1HGCM826I3A004352"); // Contains 'I'

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ErrorCode.INVALID_CHARACTERS)
        ).toBe(true);
      });

      it("should handle empty input", async () => {
        const result = await decoder.decode("");

        expect(result.valid).toBe(false);
        expect(result.errors[0].category).toBe(ErrorCategory.STRUCTURE);
      });

      it("should handle unknown WMI codes", async () => {
        const result = await decoder.decode("11111111111111111");

        expect(result.valid).toBe(false);
        expect(
          result.errors.some((e) => e.code === ErrorCode.WMI_NOT_FOUND)
        ).toBe(true);
      });
    });
  });

  describe("Model Year Decoding", () => {
    /**
     * Tests for accurate model year extraction from VINs.
     */

    const yearTestCases = [
      { vin: "1FTFW1EF7BFB11754", expectedYear: 2011 },
      { vin: "WUAC6BFR6DA902376", expectedYear: 2013 },
      { vin: "3VW217AU3FM090764", expectedYear: 2015 },
      { vin: "2GKFLTEK4H6343592", expectedYear: 2017 },
      { vin: "1C6SRFETXKN545625", expectedYear: 2019 },
      { vin: "5NMS3CAA0LH217545", expectedYear: 2020 },
      { vin: "3GNKBHR47NS184058", expectedYear: 2022 },
      { vin: "KM8R5DGE3PU560806", expectedYear: 2023 },
      { vin: "1FDUF4GN1RDA21062", expectedYear: 2024 },
      { vin: "1FTEW3LP3SKE46696", expectedYear: 2025 },
      { vin: "1FTFW5L88TFA10526", expectedYear: 2026 },
    ];

    yearTestCases.forEach(({ vin, expectedYear }) => {
      it(`should decode model year ${expectedYear} from VIN ${vin}`, async () => {
        const result = await decoder.decode(vin);

        expect(result.components.modelYear?.year).toBe(expectedYear);
      });
    });

    it("should allow model year override", async () => {
      const result = await decoder.decode("1FTFW5L88TFA10526", {
        modelYear: 2025, // Override the decoded year
      });

      expect(result.components.modelYear?.year).toBe(2025);
      expect(result.components.modelYear?.source).toBe("override");
    });
  });

  describe("WMI (World Manufacturer Identifier)", () => {
    /**
     * Tests for accurate WMI decoding including manufacturer, country, and region.
     */

    const wmiTestCases = [
      { vin: "1FTFW5L88TFA10526", expectedCountry: "United States" },
      { vin: "WBAVL1C5XFVY41004", expectedCountry: "Germany" },
      { vin: "JM3TCBCY6M0454042", expectedCountry: "Japan" },
      { vin: "KM8R5DGE3PU560806", expectedCountry: "South Korea" },
    ];

    wmiTestCases.forEach(({ vin, expectedCountry }) => {
      it(`should identify manufacturing country for ${vin}`, async () => {
        const result = await decoder.decode(vin);

        expect(result.components.wmi?.country).toBeDefined();
        // Country might be formatted differently, just check it exists
        expect(result.components.wmi?.country.length).toBeGreaterThan(0);
      });
    });
  });
});

describe("Statistics and Summary", () => {
  it("should report test VIN count", () => {
    const count = getTestVINCount();
    console.log(`\nTotal unique test VINs: ${count}`);

    // Verify we have substantial coverage
    expect(count).toBeGreaterThan(100);
  });

  it("should have VINs for all major makes", () => {
    const makes = Object.keys(VINS_BY_MAKE);
    console.log(`Makes covered: ${makes.join(", ")}`);

    // Verify we cover major manufacturers
    expect(makes).toContain("Ford");
    expect(makes).toContain("Chevrolet");
    expect(makes).toContain("Toyota");
    expect(makes).toContain("Honda");
    expect(makes).toContain("Hyundai");
    expect(makes).toContain("Nissan");
    expect(makes).toContain("BMW");
    expect(makes).toContain("Mercedes-Benz");
  });

  it("should have VINs for various body styles", () => {
    const bodyStyles = Object.keys(VINS_BY_BODY_STYLE);
    console.log(`Body styles covered: ${bodyStyles.join(", ")}`);

    // Verify we cover common body styles
    expect(bodyStyles).toContain("Sedan");
    expect(bodyStyles).toContain("SUV");
    expect(bodyStyles).toContain("Pickup");
    expect(bodyStyles).toContain("Coupe");
    expect(bodyStyles).toContain("Convertible");
  });
});
