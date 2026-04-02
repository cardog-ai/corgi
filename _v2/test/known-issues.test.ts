/**
 * Known Issues Test Suite
 *
 * This file documents known decoder issues that need to be fixed.
 * Each test is marked with .fails() to indicate it's expected to fail.
 * As issues are fixed, tests will start failing (in the sense of .fails() - they pass)
 * and should be moved to the comprehensive test suite.
 *
 * Reference: https://github.com/cardog-ai/corgi/issues/22
 */

import { VINDecoder } from "../lib/index";
import { NodeDatabaseAdapterFactory } from "../lib/db/node-adapter";
import { DatabaseAdapter } from "../lib/db/adapter";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";

import { KNOWN_WMI_ISSUES, KNOWN_MODEL_ISSUES, INVALID_VIN_ISSUES } from "./fixtures";

const TEST_DB_PATH = path.join(__dirname, "./test.db");

async function getAdapter(): Promise<DatabaseAdapter> {
  const factory = new NodeDatabaseAdapterFactory();
  return factory.createAdapter(TEST_DB_PATH);
}

describe("Known Issues - Tracking", () => {
  let decoder: VINDecoder;
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = await getAdapter();
    decoder = new VINDecoder(adapter);
  });

  afterAll(async () => {
    await adapter.close();
  });

  describe("GitHub Issue #22: F-150 vs F-550 Misidentification - FIXED", () => {
    /**
     * ISSUE: VIN 1FTFW5L86RFB45612 incorrectly decoded as Ford F-550 instead of F-150.
     *
     * ROOT CAUSE: The matching algorithm prioritized element weight equally between
     * F-150 and F-550 (both have weight 99), then relied solely on model-specific
     * confidence scoring while ignoring overall VIN pattern coherence.
     *
     * FIX: Added three-tier sorting in PatternMatcher.getPatternMatches():
     * 1. Primary: elementWeight (higher first)
     * 2. Secondary: schema pattern count (higher first) - VIN coherence
     * 3. Tertiary: model-specific confidence (higher first)
     *
     * The F-150 schema has more patterns matching across the VIN than F-550,
     * so it now wins the tiebreaker.
     */
    it("should decode 1FTFW5L86RFB45612 as F-150 (FIXED)", async () => {
      const result = await decoder.decode("1FTFW5L86RFB45612", {
        includePatternDetails: true,
      });

      const modelPattern = result.patterns?.find((p) => p.element === "Model");

      // This should now pass with the fix
      expect(modelPattern?.value).toBe("F-150");
    });
  });

  describe("WMI Issues: Shared Manufacturer Codes", () => {
    /**
     * Many manufacturer groups share WMI codes, causing the decoder to
     * return an incorrect make. These issues stem from the WMI database
     * not having proper brand differentiation.
     */

    describe("Stellantis Group (Jeep/Dodge/Chrysler/RAM)", () => {
      const stellantisIssues = KNOWN_WMI_ISSUES.filter((issue) =>
        ["Jeep", "Chrysler", "RAM"].includes(issue.expectedMake)
      );

      stellantisIssues.forEach(({ vin, expectedMake, actualMake, reason }) => {
        it.fails(`should decode ${vin} as ${expectedMake} (currently returns ${actualMake})`, async () => {
          const result = await decoder.decode(vin);

          // This assertion currently fails because decoder returns wrong make
          expect(result.components.wmi?.make).toBe(expectedMake);
        });
      });
    });

    describe("Hyundai-Kia Group", () => {
      const hkIssues = KNOWN_WMI_ISSUES.filter(
        (issue) => issue.expectedMake === "Kia"
      );

      hkIssues.forEach(({ vin, expectedMake, actualMake, reason }) => {
        it.fails(`should decode ${vin} as ${expectedMake} (currently returns ${actualMake})`, async () => {
          const result = await decoder.decode(vin);

          // This assertion currently fails because decoder returns Hyundai
          expect(result.components.wmi?.make).toBe(expectedMake);
        });
      });
    });

    describe("Subaru VINs Returning Toyota", () => {
      const subaruIssues = KNOWN_WMI_ISSUES.filter(
        (issue) => issue.expectedMake === "Subaru" && issue.actualMake === "Toyota"
      );

      subaruIssues.forEach(({ vin, expectedMake, actualMake, reason }) => {
        it.fails(`should decode ${vin} as ${expectedMake} (currently returns ${actualMake})`, async () => {
          const result = await decoder.decode(vin);

          // This assertion currently fails
          expect(result.components.wmi?.make).toBe(expectedMake);
        });
      });
    });
  });

  describe("Model Identification Issues", () => {
    if (KNOWN_MODEL_ISSUES.length === 0) {
      it.skip("No known model issues - Issue #22 was fixed", () => {});
    } else {
      KNOWN_MODEL_ISSUES.forEach(({ vin, expectedModel, actualModel, reason }) => {
        it.fails(`should decode ${vin} as ${expectedModel} (currently returns ${actualModel})`, async () => {
          const result = await decoder.decode(vin, { includePatternDetails: true });
          const modelPattern = result.patterns?.find((p) => p.element === "Model");

          expect(modelPattern?.value).toBe(expectedModel);
        });
      });
    }
  });
});

describe("Issue Verification - Current Decoder Behavior", () => {
  /**
   * These tests document the CURRENT (incorrect) behavior of the decoder.
   * They pass because they assert what the decoder currently does,
   * not what it should do. When issues are fixed, these tests will fail
   * and should be removed.
   */

  let decoder: VINDecoder;
  let adapter: DatabaseAdapter;

  beforeAll(async () => {
    adapter = await getAdapter();
    decoder = new VINDecoder(adapter);
  });

  afterAll(async () => {
    await adapter.close();
  });

  // Note: F-150 issue #22 has been FIXED - removed from this section

  describe("Jeep VINs Currently Return Dodge", () => {
    it("currently returns Dodge for Jeep Grand Cherokee VIN", async () => {
      const result = await decoder.decode("1C4RJKBG0S8730795");

      // This documents current behavior
      expect(result.components.wmi?.make).toBe("Dodge");
    });
  });

  describe("Kia VINs Currently Return Hyundai", () => {
    it("currently returns Hyundai for Kia Seltos VIN", async () => {
      const result = await decoder.decode("KNDERCAA9M7182895");

      // This documents current behavior
      expect(result.components.wmi?.make).toBe("Hyundai");
    });
  });

  describe("RAM VINs Currently Return Dodge", () => {
    it("currently returns Dodge for RAM 1500 VIN", async () => {
      const result = await decoder.decode("1C6SRFETXKN545625");

      // This documents current behavior
      expect(result.components.wmi?.make).toBe("Dodge");
    });
  });
});

describe("Issue Summary Report", () => {
  it("should report all known issues", () => {
    console.log("\n=== Known Issues Summary ===\n");

    console.log(`WMI/Make Issues (${KNOWN_WMI_ISSUES.length}):`);
    KNOWN_WMI_ISSUES.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.vin}: Expected ${issue.expectedMake}, Returns ${issue.actualMake}`);
    });

    console.log(`\nModel Issues (${KNOWN_MODEL_ISSUES.length}):`);
    KNOWN_MODEL_ISSUES.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.vin}: Expected ${issue.expectedModel}, Returns ${issue.actualModel}`);
    });

    console.log(`\nInvalid VIN Issues (${INVALID_VIN_ISSUES.length}):`);
    INVALID_VIN_ISSUES.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue.vin}: ${issue.expectedMake} ${issue.expectedModel} - ${issue.reason}`);
    });

    const totalIssues = KNOWN_WMI_ISSUES.length + KNOWN_MODEL_ISSUES.length + INVALID_VIN_ISSUES.length;
    console.log(`\nTotal Known Issues: ${totalIssues}`);

    // Always pass - this is just for reporting
    expect(true).toBe(true);
  });
});
