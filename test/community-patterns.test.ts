/**
 * Community Patterns Test Suite
 *
 * Tests VIN decoding for community-contributed patterns that extend
 * the VPIC database with support for non-US vehicles.
 *
 * Currently covers:
 * - LRW: Tesla Shanghai (Gigafactory 3) - China
 * - XP7: Tesla Berlin (Gigafactory 4) - Germany
 * - 7SA: Tesla Austin (Gigafactory Texas) - USA (in VPIC)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { NodeDatabaseAdapterFactory } from "../lib/db/node-adapter";
import { VINDecoder } from "../lib/decode";
import { join } from "path";

// Sample VINs - unique by WMI+VDS (positions 1-9)
const TESLA_SHANGHAI_MODEL_3 = [
  "LRW3E1EB0PC932736", // 3E1EB - Standard Range Plus RWD
  "LRW3E1FA6PC944248", // 3E1FA - Long Range RWD
  "LRW3E7EB6RC101571", // 3E7EB - Standard Range Plus RWD (2024+)
  "LRW3E7FA5RC099480", // 3E7FA - Long Range RWD (2024+)
];

const TESLA_SHANGHAI_MODEL_Y = [
  "LRWYGDEE1PC010116", // YGDEE - Standard Range RWD
  "LRWYGDEF4PC266095", // YGDEF - Long Range AWD
  "LRWYGDFD2PC162086", // YGDFD - Performance AWD
];

const TESLA_AUSTIN_MODEL_Y = [
  "7SAYGAEE8RF002511", // YGAEE - Standard Range RWD
  "7SAYGDEE2NF433437", // YGDEE - Long Range RWD
  "7SAYGDEF0NF562429", // YGDEF - Long Range AWD
];

const TESLA_AUSTIN_MODEL_X = [
  "7SAXCAE50NF344293", // XCAE5 - Model X
  "7SAXCBE51NF351212", // XCBE5 - Model X
  "7SAXCDE50NF343873", // XCDE5 - Model X Plaid
];

const TESLA_BERLIN_MODEL_Y = [
  "XP7YGDEE6TB729697", // YGDEE - Standard Range RWD
];

describe("Community Patterns - Tesla International", () => {
  let decoder: VINDecoder;

  beforeAll(async () => {
    const dbPath = join(__dirname, "..", "db", "vpic.lite.db");
    const factory = new NodeDatabaseAdapterFactory();
    const adapter = await factory.createAdapter(dbPath);
    decoder = new VINDecoder(adapter);
  });

  describe("LRW (Tesla Shanghai)", () => {
    it("should decode Model 3 VINs", async () => {
      for (const vin of TESLA_SHANGHAI_MODEL_3) {
        const result = await decoder.decode(vin, { includePatternDetails: true });

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("LRW");
        expect(result.components?.wmi?.make).toBe("Tesla");
        expect(result.components?.wmi?.country).toBe("CHINA");

        const model = result.patterns?.find((p) => p.element === "Model");
        expect(model?.value).toBe("Model 3");
      }
    });

    it("should decode Model Y VINs", async () => {
      for (const vin of TESLA_SHANGHAI_MODEL_Y) {
        const result = await decoder.decode(vin, { includePatternDetails: true });

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("LRW");
        expect(result.components?.wmi?.make).toBe("Tesla");

        const model = result.patterns?.find((p) => p.element === "Model");
        expect(model?.value).toBe("Model Y");
      }
    });

    it("should extract vehicle info from patterns", async () => {
      // Test that vehicle info is properly extracted
      const result = await decoder.decode("LRWYGDEE1PC010116", { includePatternDetails: true });

      expect(result.valid).toBe(true);
      expect(result.components?.vehicle?.model).toBe("Model Y");
      expect(result.components?.vehicle?.make).toBe("Tesla");
      // Verify patterns are returned
      expect(result.patterns).toBeDefined();
      expect(result.patterns!.length).toBeGreaterThan(0);
    });
  });

  describe("XP7 (Tesla Berlin)", () => {
    it("should decode Model Y VINs", async () => {
      for (const vin of TESLA_BERLIN_MODEL_Y) {
        const result = await decoder.decode(vin, { includePatternDetails: true });

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("XP7");
        expect(result.components?.wmi?.make).toBe("Tesla");
        expect(result.components?.wmi?.country).toBe("GERMANY");

        const model = result.patterns?.find((p) => p.element === "Model");
        expect(model?.value).toBe("Model Y");

        const plantCity = result.patterns?.find((p) => p.element === "Plant City");
        expect(plantCity?.value).toBe("GRUENHEIDE");
      }
    });
  });

  describe("7SA (Tesla Austin) - VPIC baseline", () => {
    it("should decode Model Y VINs", async () => {
      for (const vin of TESLA_AUSTIN_MODEL_Y) {
        const result = await decoder.decode(vin);

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("7SA");
        expect(result.components?.wmi?.manufacturer).toBe("TESLA, INC.");
      }
    });

    it("should decode Model X VINs", async () => {
      for (const vin of TESLA_AUSTIN_MODEL_X) {
        const result = await decoder.decode(vin);

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("7SA");
      }
    });
  });
});

describe("Community Pattern Validation", () => {
  it("should validate all YAML files", async () => {
    const { execSync } = await import("child_process");
    const result = execSync("pnpm community:validate 2>&1", {
      encoding: "utf-8",
    });

    expect(result).toContain("Passed:");
    expect(result).not.toContain("Failed:");
  });

  it("should apply patterns idempotently", async () => {
    const { execSync } = await import("child_process");
    // Running apply twice should skip already-applied patterns
    const result = execSync("pnpm community:apply 2>&1", {
      encoding: "utf-8",
    });

    expect(result).toContain("SKIP");
    expect(result).not.toContain("FAIL");
  });
});
