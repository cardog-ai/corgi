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

// Sample VINs with expected trim/drive from position 8 motor code
// Position 8: D=Single/RWD, E=Dual/AWD, F=Dual Performance/AWD
const TESLA_SHANGHAI_MODEL_Y = [
  { vin: "LRWYGDEE1PC010116", trim: "Long Range", drive: "AWD" }, // E = Dual Motor Standard
  { vin: "LRWYGDEF4PC266095", trim: "Performance", drive: "AWD" }, // F = Dual Motor Performance
  { vin: "LRWYGDFD5RC639046", trim: "Standard Range", drive: "RWD" }, // D = Single Motor Standard
];

const TESLA_BERLIN_MODEL_Y = [
  { vin: "XP7YGDEE6TB729697", trim: "Long Range", drive: "AWD" }, // E = Dual Motor Standard
];

const TESLA_AUSTIN_MODEL_Y = [
  "7SAYGAEE8RF002511", // VPIC baseline
  "7SAYGDEE2NF433437",
  "7SAYGDEF0NF562429",
];

const TESLA_AUSTIN_MODEL_X = [
  "7SAXCAE50NF344293",
  "7SAXCBE51NF351212",
  "7SAXCDE50NF343873",
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
    it("should decode Model Y with correct trim and drive type", async () => {
      for (const { vin, trim, drive } of TESLA_SHANGHAI_MODEL_Y) {
        const result = await decoder.decode(vin, { includePatternDetails: true });

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("LRW");
        expect(result.components?.wmi?.make).toBe("Tesla");
        expect(result.components?.wmi?.country).toBe("CHINA");

        // Check model
        const model = result.patterns?.find((p) => p.element === "Model");
        expect(model?.value).toBe("Model Y");

        // Check trim (from position 8 motor code)
        const trimPattern = result.patterns?.find((p) => p.element === "Trim");
        expect(trimPattern?.value).toBe(trim);

        // Check drive type
        const drivePattern = result.patterns?.find((p) => p.element === "Drive Type");
        expect(drivePattern?.value).toContain(drive);
      }
    });

    it("should extract vehicle info including trim", async () => {
      const result = await decoder.decode("LRWYGDFD5RC639046", {
        includePatternDetails: true,
      });

      expect(result.valid).toBe(true);
      expect(result.components?.vehicle?.model).toBe("Model Y");
      expect(result.components?.vehicle?.make).toBe("Tesla");
      expect(result.components?.vehicle?.trim).toBe("Standard Range");
      expect(result.components?.vehicle?.driveType).toBe("RWD/Rear-Wheel Drive");
    });
  });

  describe("XP7 (Tesla Berlin)", () => {
    it("should decode Model Y with correct trim and drive type", async () => {
      for (const { vin, trim, drive } of TESLA_BERLIN_MODEL_Y) {
        const result = await decoder.decode(vin, { includePatternDetails: true });

        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.code).toBe("XP7");
        expect(result.components?.wmi?.make).toBe("Tesla");
        expect(result.components?.wmi?.country).toBe("GERMANY");

        // Check model
        const model = result.patterns?.find((p) => p.element === "Model");
        expect(model?.value).toBe("Model Y");

        // Check trim
        const trimPattern = result.patterns?.find((p) => p.element === "Trim");
        expect(trimPattern?.value).toBe(trim);

        // Check drive type
        const drivePattern = result.patterns?.find((p) => p.element === "Drive Type");
        expect(drivePattern?.value).toContain(drive);

        // Check plant
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
