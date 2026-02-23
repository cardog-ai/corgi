/**
 * Community Patterns Test Suite
 *
 * Tests VIN decoding for community-contributed patterns that extend
 * the VPIC database with support for non-US vehicles.
 *
 * Currently covers:
 * - LRW: Tesla Shanghai (Gigafactory 3) - China
 * - 7SA: Tesla Austin (Gigafactory Texas) - USA (supplemental)
 * - XP7: Tesla Berlin (Gigafactory 4) - Germany
 */

import { describe, it, expect, beforeAll } from "vitest";
import { NodeDatabaseAdapterFactory } from "../lib/db/node-adapter";
import { VINDecoder } from "../lib/decode";
import { join } from "path";

// Sample VINs from production database
const TESLA_SHANGHAI_MODEL_3 = [
  "LRW3E1EB0PC932736",
  "LRW3E1EB4PC872671",
  "LRW3E1EB4PC923599",
  "LRW3E1EB9PC922027",
  "LRW3E1FA6PC944248",
  "LRW3E1FA7PC872623",
  "LRW3E1FA8PC872369",
  "LRW3E1FA8PC872565",
  "LRW3E1FA8PC921165",
  "LRW3E1FAXPC872003",
  "LRW3E7EB6RC101571",
  "LRW3E7FA5RC099480",
  "LRW3E7FA5RC101924",
  "LRW3E7FA5RC276271",
  "LRW3E7FA5RC276691",
];

const TESLA_SHANGHAI_MODEL_Y = [
  "LRWYGDEE1PC010116",
  "LRWYGDEE1PC107817",
  "LRWYGDEE4PC107701",
  "LRWYGDEE4RC662165",
  "LRWYGDEE5PC066608",
  "LRWYGDEE7PC105117",
  "LRWYGDEE7PC265532",
  "LRWYGDEF4PC266095",
  "LRWYGDFD2PC162086",
  "LRWYGDFD3PC939729",
  "LRWYGDFD4PC163501",
  "LRWYGDFD5PC225830",
  "LRWYGDFD5PC939473",
  "LRWYGDFDXPC939307",
  "LRWYGDFDXPC939503",
];

const TESLA_AUSTIN_MODEL_Y = [
  "7SAYGAEE8RF002511",
  "7SAYGAEEXNF431787",
  "7SAYGDEE2NF433437",
  "7SAYGDEE3NF319429",
  "7SAYGDEE3NF380554",
  "7SAYGDEE4PF777953",
  "7SAYGDEE6NF361674",
  "7SAYGDEE7PF642918",
  "7SAYGDEE9PF648249",
  "7SAYGDEE9SF235580",
  "7SAYGDEE9SF293382",
  "7SAYGDEF0NF562429",
  "7SAYGDEF3NF513256",
  "7SAYGDEF4NF564488",
  "7SAYGDEF9NF541370",
];

const TESLA_AUSTIN_MODEL_X = [
  "7SAXCAE50NF344293",
  "7SAXCAE50RF444884",
  "7SAXCAE58PF412245",
  "7SAXCBE51NF351212",
  "7SAXCBE52PF374551",
  "7SAXCBE56NF346068",
  "7SAXCBE61NF053924",
  "7SAXCBE61NF353809",
  "7SAXCDE50NF343873",
  "7SAXCDE52NF343342",
  "7SAXCDE56PF374824",
  "7SAXCDE57NF341697",
  "7SAXCDE57PF372578",
  "7SAXCDE58NF341577",
  "7SAXCDE5XNF343136",
];

const TESLA_BERLIN_MODEL_Y = ["XP7YGDEE6TB729697"];

describe("Community Patterns", () => {
  // =========================================================================
  // Test against ORIGINAL database (should fail for non-US WMIs)
  // =========================================================================
  describe("Original VPIC Database (baseline)", () => {
    let decoder: VINDecoder;

    beforeAll(async () => {
      const dbPath = join(__dirname, "..", "db", "vpic.lite.db");
      const factory = new NodeDatabaseAdapterFactory();
      const adapter = await factory.createAdapter(dbPath);
      decoder = new VINDecoder(adapter);
    });

    describe("LRW (Tesla Shanghai) - NOT IN VPIC", () => {
      it("should fail to decode LRW VINs (WMI not in database)", async () => {
        const result = await decoder.decode(TESLA_SHANGHAI_MODEL_3[0]);

        // LRW is not in the original VPIC database
        expect(result.errors).toBeDefined();
        expect(result.errors?.some((e) => e.code === "300")).toBe(true); // WMI not found
      });
    });

    describe("7SA (Tesla Austin) - PARTIALLY IN VPIC", () => {
      it("should decode 7SA VINs (WMI exists but no Make)", async () => {
        const result = await decoder.decode(TESLA_AUSTIN_MODEL_Y[0]);

        // 7SA exists in VPIC but has no Make associated
        expect(result.valid).toBe(true);
        expect(result.components?.wmi?.manufacturer).toBe("TESLA, INC.");
        // Make might be undefined due to incomplete VPIC data
      });
    });

    describe("XP7 (Tesla Berlin) - NOT IN VPIC", () => {
      it("should fail to decode XP7 VINs (WMI not in database)", async () => {
        const result = await decoder.decode(TESLA_BERLIN_MODEL_Y[0]);

        expect(result.errors).toBeDefined();
        expect(result.errors?.some((e) => e.code === "300")).toBe(true); // WMI not found
      });
    });
  });

  // =========================================================================
  // Test against COMMUNITY database (should work for all)
  // =========================================================================
  describe("Community VPIC Database (with patterns)", () => {
    let decoder: VINDecoder;
    let dbExists = false;

    beforeAll(async () => {
      const dbPath = join(__dirname, "..", "db", "vpic.community-test.db");

      // Check if community database exists
      const fs = await import("fs");
      dbExists = fs.existsSync(dbPath);

      if (dbExists) {
        const factory = new NodeDatabaseAdapterFactory();
        const adapter = await factory.createAdapter(dbPath);
        decoder = new VINDecoder(adapter);
      }
    });

    describe("LRW (Tesla Shanghai) Model 3", () => {
      it.skipIf(!dbExists)(
        "should decode Model 3 VINs correctly",
        async () => {
          for (const vin of TESLA_SHANGHAI_MODEL_3.slice(0, 5)) {
            const result = await decoder.decode(vin);

            expect(result.valid).toBe(true);
            expect(result.components?.wmi?.code).toBe("LRW");
            expect(result.components?.wmi?.make).toBe("Tesla");
            expect(result.components?.wmi?.country).toBe("CHINA");

            // Check patterns resolved
            const model = result.patterns?.find((p) => p.element === "Model");
            expect(model?.value).toBe("Model 3");

            const bodyClass = result.patterns?.find(
              (p) => p.element === "Body Class"
            );
            expect(bodyClass?.value).toContain("Sedan");
          }
        }
      );
    });

    describe("LRW (Tesla Shanghai) Model Y", () => {
      it.skipIf(!dbExists)(
        "should decode Model Y VINs correctly",
        async () => {
          for (const vin of TESLA_SHANGHAI_MODEL_Y.slice(0, 5)) {
            const result = await decoder.decode(vin);

            expect(result.valid).toBe(true);
            expect(result.components?.wmi?.code).toBe("LRW");
            expect(result.components?.wmi?.make).toBe("Tesla");
            expect(result.components?.wmi?.country).toBe("CHINA");

            // Check patterns resolved
            const model = result.patterns?.find((p) => p.element === "Model");
            expect(model?.value).toBe("Model Y");

            const bodyClass = result.patterns?.find(
              (p) => p.element === "Body Class"
            );
            expect(bodyClass?.value).toContain("Hatchback");
          }
        }
      );

      it.skipIf(!dbExists)("should decode drive type correctly", async () => {
        // LRWYGDEE* = Single motor (RWD)
        // LRWYGDEF* = Dual motor (AWD)
        // LRWYGDFD* = Dual motor (AWD)

        const rwd = await decoder.decode("LRWYGDEE1PC010116");
        const driveType = rwd.patterns?.find((p) => p.element === "Drive Type");
        expect(driveType?.value).toContain("RWD");

        const awd = await decoder.decode("LRWYGDEF4PC266095");
        const awdDriveType = awd.patterns?.find(
          (p) => p.element === "Drive Type"
        );
        expect(awdDriveType?.value).toContain("AWD");
      });
    });

    describe("All LRW VINs should decode", () => {
      const allLRW = [...TESLA_SHANGHAI_MODEL_3, ...TESLA_SHANGHAI_MODEL_Y];

      it.skipIf(!dbExists)(
        `should decode all ${allLRW.length} LRW VINs`,
        async () => {
          const failures: string[] = [];

          for (const vin of allLRW) {
            const result = await decoder.decode(vin);

            if (!result.valid) {
              failures.push(vin);
            }
          }

          expect(failures).toEqual([]);
        }
      );
    });
  });
});

// =========================================================================
// Pattern Generation Tests
// =========================================================================
describe("Community Pattern Generator", () => {
  it("should generate valid SQL from YAML", async () => {
    const { execSync } = await import("child_process");
    const result = execSync(
      "npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml 2>&1",
      { encoding: "utf-8" }
    );

    // Should contain required inserts
    expect(result).toContain("INSERT INTO Wmi");
    expect(result).toContain("INSERT INTO Wmi_Make");
    expect(result).toContain("INSERT INTO VinSchema");
    expect(result).toContain("INSERT INTO Wmi_VinSchema");
    expect(result).toContain("INSERT INTO Pattern");

    // Should have correct values
    expect(result).toContain("'LRW'");
    expect(result).toContain("Tesla");
    expect(result).toContain("CHINA");

    // Should be wrapped in transaction
    expect(result).toContain("BEGIN TRANSACTION");
    expect(result).toContain("COMMIT");
  });

  it("should resolve all lookup IDs (no __NEW__ placeholders)", async () => {
    const { execSync } = await import("child_process");
    const result = execSync(
      "npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml 2>&1",
      { encoding: "utf-8" }
    );

    // Should not have any unresolved placeholders
    expect(result).not.toContain("__NEW_");
  });
});
