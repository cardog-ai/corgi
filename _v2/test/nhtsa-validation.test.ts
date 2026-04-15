/**
 * NHTSA Validation Tests
 *
 * These tests validate the corgi decoder results against the official
 * NHTSA vPIC (Vehicle Product Information Catalog) API.
 *
 * The NHTSA API is the authoritative source for VIN decoding in the US,
 * so any discrepancies should be flagged and investigated.
 *
 * Note: These tests make real HTTP requests to the NHTSA API,
 * so they should be run sparingly (not on every commit).
 */

import { VINDecoder } from "../lib/index";
import { NodeDatabaseAdapterFactory } from "../lib/db/node-adapter";
import { DatabaseAdapter } from "../lib/db/adapter";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import path from "path";

import {
  PROBLEMATIC_VINS,
  FORD_F_SERIES_VINS,
  VINS_BY_MAKE,
  KNOWN_MODEL_ISSUES,
  VINTestCase,
} from "./fixtures";

// Known model issues that should be tracked separately
const KNOWN_ISSUE_VINS = new Set(KNOWN_MODEL_ISSUES.map((i) => i.vin));

const TEST_DB_PATH = path.join(__dirname, "./test.db");
const NHTSA_API_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues";

interface NHTSAResult {
  Make: string;
  Model: string;
  ModelYear: string;
  BodyClass: string;
  VehicleType: string;
  ErrorCode: string;
  ErrorText: string;
}

interface NHTSAResponse {
  Results: NHTSAResult[];
}

/**
 * Fetch VIN data from NHTSA vPIC API
 */
async function fetchNHTSAData(vin: string): Promise<NHTSAResult | null> {
  try {
    const response = await fetch(`${NHTSA_API_URL}/${vin}?format=json`);
    if (!response.ok) {
      console.warn(`NHTSA API returned ${response.status} for VIN ${vin}`);
      return null;
    }

    const data: NHTSAResponse = await response.json();
    if (data.Results && data.Results.length > 0) {
      return data.Results[0];
    }
    return null;
  } catch (error) {
    console.warn(`Failed to fetch NHTSA data for VIN ${vin}:`, error);
    return null;
  }
}

/**
 * Normalize make names for comparison
 */
function normalizeMake(make: string | undefined): string {
  if (!make) return "";
  return make
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/MERCEDESBENZ/g, "MERCEDES")
    .replace(/VOLKSWAGEN/g, "VW");
}

/**
 * Normalize model names for comparison
 */
function normalizeModel(model: string | undefined): string {
  if (!model) return "";
  return model
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/SUPERDUTY/g, "")
    .replace(/PLUG.?IN.?HYBRID/g, "")
    .replace(/HYBRID/g, "");
}

async function getAdapter(): Promise<DatabaseAdapter> {
  const factory = new NodeDatabaseAdapterFactory();
  return factory.createAdapter(TEST_DB_PATH);
}

describe("NHTSA API Validation", () => {
  let decoder: VINDecoder;
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = await getAdapter();
    decoder = new VINDecoder(adapter);
  });

  afterAll(async () => {
    await adapter.close();
  });

  describe("Problematic VINs - NHTSA Comparison", () => {
    /**
     * Critical regression tests comparing decoder output against NHTSA.
     * These are VINs that have been reported as incorrectly decoded.
     *
     * Issue #22 (F-150 -> F-550) has been FIXED.
     */

    it("should match NHTSA for F-150 VIN 1FTFW5L86RFB45612 (GitHub Issue #22 - FIXED)", async () => {
      const vin = "1FTFW5L86RFB45612";

      // Get corgi result
      const corgiResult = await decoder.decode(vin, {
        includePatternDetails: true,
      });

      // Get NHTSA result
      const nhtsaResult = await fetchNHTSAData(vin);

      if (!nhtsaResult) {
        console.warn("Skipping NHTSA comparison - API unavailable");
        return;
      }

      // Log both results for debugging
      console.log(`\nVIN: ${vin}`);
      console.log("NHTSA:", {
        Make: nhtsaResult.Make,
        Model: nhtsaResult.Model,
        Year: nhtsaResult.ModelYear,
      });

      const corgiModel = corgiResult.patterns?.find(
        (p) => p.element === "Model"
      )?.value;
      console.log("Corgi:", {
        Make: corgiResult.components.wmi?.make,
        Model: corgiModel,
        Year: corgiResult.components.modelYear?.year,
      });

      // Validate make
      expect(normalizeMake(corgiResult.components.wmi?.make)).toBe(
        normalizeMake(nhtsaResult.Make)
      );

      // Validate year
      expect(corgiResult.components.modelYear?.year?.toString()).toBe(
        nhtsaResult.ModelYear
      );

      // Validate model - this should now pass with the fix!
      const nhtsaModel = normalizeModel(nhtsaResult.Model);
      const corgiModelNorm = normalizeModel(corgiModel);
      expect(corgiModelNorm).toContain(nhtsaModel.substring(0, 4)); // F150
    });
  });

  describe("Ford F-Series NHTSA Validation", () => {
    /**
     * Validate Ford F-Series VINs against NHTSA to ensure correct model identification.
     * This is critical for Issue #22 where F-150 was misidentified as F-550.
     */

    // Test a sample of F-Series VINs
    const sampleVins = FORD_F_SERIES_VINS.slice(0, 5);

    sampleVins.forEach(({ vin, expected }) => {
      it(`should match NHTSA for ${vin} (expected: ${expected.model})`, async () => {
        const corgiResult = await decoder.decode(vin, {
          includePatternDetails: true,
        });

        const nhtsaResult = await fetchNHTSAData(vin);

        if (!nhtsaResult) {
          console.warn(`Skipping NHTSA comparison for ${vin} - API unavailable`);
          return;
        }

        // Log comparison
        const corgiModel = corgiResult.patterns?.find(
          (p) => p.element === "Model"
        )?.value;

        console.log(`\n${vin}:`);
        console.log(`  NHTSA: ${nhtsaResult.Make} ${nhtsaResult.Model} ${nhtsaResult.ModelYear}`);
        console.log(`  Corgi: ${corgiResult.components.wmi?.make} ${corgiModel} ${corgiResult.components.modelYear?.year}`);
        console.log(`  Expected: ${expected.make} ${expected.model} ${expected.year}`);

        // Verify make matches
        expect(normalizeMake(corgiResult.components.wmi?.make)).toBe(
          normalizeMake(nhtsaResult.Make)
        );

        // Verify year matches
        expect(corgiResult.components.modelYear?.year?.toString()).toBe(
          nhtsaResult.ModelYear
        );

        // Model comparison - extract base model (F-150, F-250, etc.)
        const nhtsaBaseModel = nhtsaResult.Model.match(/F-?\d{3}/i)?.[0] || nhtsaResult.Model;
        const corgiBaseModel = corgiModel?.match(/F-?\d{3}/i)?.[0] || corgiModel;

        if (nhtsaBaseModel && corgiBaseModel) {
          expect(corgiBaseModel.replace("-", "")).toBe(
            nhtsaBaseModel.replace("-", "")
          );
        }
      });
    });
  });

  describe("Cross-Make NHTSA Validation", () => {
    /**
     * Sample VINs from different manufacturers to validate
     * decoder accuracy across the board.
     */

    const testVins: VINTestCase[] = [
      // One VIN per major make
      VINS_BY_MAKE["Honda"]?.[0],
      VINS_BY_MAKE["Toyota"]?.[0],
      VINS_BY_MAKE["Chevrolet"]?.[0],
      VINS_BY_MAKE["BMW"]?.[0],
      VINS_BY_MAKE["Hyundai"]?.[0],
    ].filter(Boolean) as VINTestCase[];

    testVins.forEach(({ vin, expected }) => {
      it(`should match NHTSA for ${expected.make} ${expected.model}`, async () => {
        const corgiResult = await decoder.decode(vin, {
          includePatternDetails: true,
        });

        const nhtsaResult = await fetchNHTSAData(vin);

        if (!nhtsaResult) {
          console.warn(`Skipping NHTSA comparison for ${vin} - API unavailable`);
          return;
        }

        // Verify make
        expect(normalizeMake(corgiResult.components.wmi?.make)).toBe(
          normalizeMake(nhtsaResult.Make)
        );

        // Verify year
        if (nhtsaResult.ModelYear && nhtsaResult.ModelYear !== "0") {
          expect(corgiResult.components.modelYear?.year?.toString()).toBe(
            nhtsaResult.ModelYear
          );
        }

        // Log any model discrepancies for review
        const corgiModel = corgiResult.patterns?.find(
          (p) => p.element === "Model"
        )?.value;

        if (normalizeModel(corgiModel) !== normalizeModel(nhtsaResult.Model)) {
          console.log(
            `\nModel mismatch for ${vin}:`,
            `\n  NHTSA: "${nhtsaResult.Model}"`,
            `\n  Corgi: "${corgiModel}"`
          );
        }
      });
    });
  });

  describe("NHTSA Error Handling", () => {
    it("should handle invalid VINs gracefully", async () => {
      const invalidVin = "INVALID12345678";

      const corgiResult = await decoder.decode(invalidVin);
      const nhtsaResult = await fetchNHTSAData(invalidVin);

      // Both should indicate an error
      expect(corgiResult.valid).toBe(false);

      if (nhtsaResult) {
        // NHTSA returns error codes for invalid VINs
        expect(nhtsaResult.ErrorCode).not.toBe("0");
      }
    });
  });
});

describe("NHTSA Batch Validation Report", () => {
  let decoder: VINDecoder;
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = await getAdapter();
    decoder = new VINDecoder(adapter);
  });

  afterAll(async () => {
    await adapter.close();
  });

  it("should generate validation report for problematic VINs", async () => {
    const results: {
      vin: string;
      corgiMake: string | undefined;
      corgiModel: string | undefined;
      corgiYear: number | undefined;
      nhtsaMake: string;
      nhtsaModel: string;
      nhtsaYear: string;
      makeMatch: boolean;
      modelMatch: boolean;
      yearMatch: boolean;
    }[] = [];

    for (const { vin, expected } of PROBLEMATIC_VINS) {
      const corgiResult = await decoder.decode(vin, {
        includePatternDetails: true,
      });

      const nhtsaResult = await fetchNHTSAData(vin);

      if (!nhtsaResult) {
        console.warn(`Could not fetch NHTSA data for ${vin}`);
        continue;
      }

      const corgiModel = corgiResult.patterns?.find(
        (p) => p.element === "Model"
      )?.value;

      results.push({
        vin,
        corgiMake: corgiResult.components.wmi?.make,
        corgiModel,
        corgiYear: corgiResult.components.modelYear?.year,
        nhtsaMake: nhtsaResult.Make,
        nhtsaModel: nhtsaResult.Model,
        nhtsaYear: nhtsaResult.ModelYear,
        makeMatch:
          normalizeMake(corgiResult.components.wmi?.make) ===
          normalizeMake(nhtsaResult.Make),
        modelMatch:
          normalizeModel(corgiModel) === normalizeModel(nhtsaResult.Model),
        yearMatch:
          corgiResult.components.modelYear?.year?.toString() ===
          nhtsaResult.ModelYear,
      });
    }

    // Output report
    console.log("\n=== NHTSA Validation Report ===\n");
    console.table(results);

    // Calculate accuracy
    const makeAccuracy =
      results.filter((r) => r.makeMatch).length / results.length;
    const modelAccuracy =
      results.filter((r) => r.modelMatch).length / results.length;
    const yearAccuracy =
      results.filter((r) => r.yearMatch).length / results.length;

    console.log(`\nAccuracy:`);
    console.log(`  Make:  ${(makeAccuracy * 100).toFixed(1)}%`);
    console.log(`  Model: ${(modelAccuracy * 100).toFixed(1)}%`);
    console.log(`  Year:  ${(yearAccuracy * 100).toFixed(1)}%`);

    // We expect high accuracy
    expect(makeAccuracy).toBeGreaterThanOrEqual(0.8);
    expect(yearAccuracy).toBeGreaterThanOrEqual(0.8);
  });
});
