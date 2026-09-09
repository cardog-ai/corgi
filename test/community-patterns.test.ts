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
import { ErrorCode } from "../lib/types";
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

describe("EU VIN Support (#30)", () => {
  let decoder: VINDecoder;

  beforeAll(async () => {
    const dbPath = join(__dirname, "..", "db", "vpic.lite.db");
    const factory = new NodeDatabaseAdapterFactory();
    const adapter = await factory.createAdapter(dbPath);
    decoder = new VINDecoder(adapter);
  });

  // ISO 3779 does not mandate a check digit at position 9; EU manufacturers
  // use it freely (e.g. 'Z' in WVGZZZ5NZEW069297). Structure validation must
  // not block these VINs - the check-digit validator reports a warning instead.
  it("should accept a non-check-digit character at position 9 (structure)", async () => {
    const result = await decoder.decode("WVGZZZ5NZEW069297");

    expect(
      result.errors.some((e) => e.code === ErrorCode.INVALID_CHARACTERS)
    ).toBe(false);
  });

  it("should decode Skoda Fabia and Octavia via community patterns (TMB)", async () => {
    const fabia = await decoder.decode("TMBNJ46Y964564271");
    expect(fabia.valid).toBe(true);
    expect(fabia.components?.vehicle?.make).toBe("Skoda");
    expect(fabia.components?.vehicle?.model).toBe("Fabia");
    expect(fabia.components?.modelYear?.year).toBe(2006);

    const octavia = await decoder.decode("TMBBS21Z588029342");
    expect(octavia.valid).toBe(true);
    expect(octavia.components?.vehicle?.make).toBe("Skoda");
    expect(octavia.components?.vehicle?.model).toBe("Octavia");
    expect(octavia.components?.modelYear?.year).toBe(2008);
  });

  it("should decode EU-market Renault and Peugeot VINs previously blocked", async () => {
    // Real VINs from issue #30; both were structurally rejected before
    const megane = await decoder.decode("VF1RFB00068721753");
    expect(megane.valid).toBe(true);
    expect(megane.components?.modelYear?.year).toBe(2006);

    const peugeot = await decoder.decode("VF38DRHC8CL054898");
    expect(peugeot.valid).toBe(true);
    expect(
      peugeot.errors.some((e) => e.code === ErrorCode.INVALID_CHECK_DIGIT)
    ).toBe(true);
  });

  // VW Tiguan: EU-market 5N type code with digit position 7 -> primary year
  // (1980 block) yields no patterns; the alternate-block retry resolves 2014.
  it("should decode EU-market VW Tiguan via type code and year retry (WVG)", async () => {
    const tiguan = await decoder.decode("WVGZZZ5NZEW069297");

    expect(tiguan.valid).toBe(true);
    expect(tiguan.components?.vehicle?.make).toBe("Volkswagen");
    expect(tiguan.components?.vehicle?.model).toBe("Tiguan");
    expect(tiguan.components?.modelYear?.year).toBe(2014);
    // Position 9 'Z' is EU payload, not a check digit - flagged as a
    // warning-severity check-digit notice while the decode stays valid
    expect(
      tiguan.errors.some((e) => e.code === ErrorCode.INVALID_CHECK_DIGIT)
    ).toBe(true);
  });

  // Ford Focus (EU): Ford-Europe GC model code, letter position 7 -> year
  // resolves directly to 2019 in the 2010 block.
  it("should decode EU-market Ford Focus via model code (WF0)", async () => {
    const focus = await decoder.decode("WF0KXXGCBKBJ13223");

    expect(focus.valid).toBe(true);
    expect(focus.components?.vehicle?.make).toBe("Ford");
    expect(focus.components?.vehicle?.model).toBe("Focus");
    expect(focus.components?.modelYear?.year).toBe(2019);
  });

  // Dacia Duster under Renault's VF1 WMI: Make pattern re-attributes the
  // legacy US-market Eagle make; Model links to Dacia. Renault-group VINs
  // do not follow the US 30-year cycle, so the CFR-table year (2006) is
  // reported while the real vehicle is a 2016 Duster (documented in the
  // YAML); the test asserts only brand and model.
  it("should decode Dacia Duster with brand re-attribution (VF1)", async () => {
    const duster = await decoder.decode("VF1HJD40367321336");

    expect(duster.valid).toBe(true);
    expect(duster.components?.vehicle?.make).toBe("Dacia");
    expect(duster.components?.vehicle?.model).toBe("Duster");
  });
});
