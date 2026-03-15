/**
 * Community VIN Pattern Applier
 *
 * Applies all community YAML patterns to the VPIC database.
 * This is run as part of the release process to merge community
 * contributions into the published database.
 *
 * Usage:
 *   npx tsx community/build/apply.ts
 *   npx tsx community/build/apply.ts --dry-run
 *   npx tsx community/build/apply.ts --db path/to/db.db
 */

import { parse } from "yaml";
import { readFileSync, readdirSync, statSync, existsSync, copyFileSync } from "fs";
import { join, relative, basename, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { validateWmiFile } from "./schema";

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI colors
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// ============================================================================
// Types
// ============================================================================

interface YearRange {
  from: number;
  to: number | null;
}

interface Pattern {
  pattern: string;
  element: string;
  value: string;
}

interface WmiSchema {
  wmi: string;
  mode?: "new" | "supplement";
  manufacturer?: string;
  make?: string;
  country?: string;
  vehicle_type?: string;
  years?: YearRange;
  schema_name?: string;
  patterns: Pattern[];
}

interface ApplyResult {
  file: string;
  wmi: string;
  mode: "new" | "supplement";
  patternsAdded: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// Database Operations
// ============================================================================

function getExistingWmi(db: Database.Database, wmi: string) {
  return db
    .prepare(
      `
      SELECT
        w.Id as wmiId,
        w.ManufacturerId as manufacturerId,
        COALESCE(w.MakeId, wm.MakeId) as makeId,
        w.CountryId as countryId,
        w.VehicleTypeId as vehicleTypeId,
        m.Name as make,
        c.Name as country
      FROM Wmi w
      LEFT JOIN Wmi_Make wm ON wm.WmiId = w.Id
      LEFT JOIN Make m ON m.Id = COALESCE(w.MakeId, wm.MakeId)
      LEFT JOIN Country c ON c.Id = w.CountryId
      WHERE w.Wmi = ?
    `
    )
    .get(wmi) as {
    wmiId: number;
    manufacturerId: number;
    makeId: number;
    countryId: number;
    vehicleTypeId: number;
    make: string;
    country: string;
  } | undefined;
}

function resolveEntityId(
  db: Database.Database,
  table: string,
  name: string
): number | null {
  const row = db
    .prepare(`SELECT Id FROM "${table}" WHERE Name = ? COLLATE NOCASE`)
    .get(name) as { Id: number } | undefined;
  return row?.Id ?? null;
}

function resolveModelId(
  db: Database.Database,
  modelName: string,
  makeId: number
): number | null {
  const row = db
    .prepare(
      `
      SELECT m.Id
      FROM Model m
      JOIN Make_Model mm ON mm.ModelId = m.Id
      WHERE m.Name = ? COLLATE NOCASE AND mm.MakeId = ?
    `
    )
    .get(modelName, makeId) as { Id: number } | undefined;
  return row?.Id ?? null;
}

function getNextId(db: Database.Database, table: string): number {
  const row = db.prepare(`SELECT MAX(Id) as max FROM "${table}"`).get() as {
    max: number | null;
  };
  return (row.max ?? 0) + 1;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

// ============================================================================
// Apply Logic
// ============================================================================

function applyYamlFile(
  db: Database.Database,
  yamlPath: string,
  dryRun: boolean
): ApplyResult {
  const content = readFileSync(yamlPath, "utf-8");
  const schema = parse(content) as WmiSchema;

  const result: ApplyResult = {
    file: yamlPath,
    wmi: schema.wmi,
    mode: schema.mode || "new",
    patternsAdded: 0,
    success: false,
  };

  try {
    // Validate first
    const validation = validateWmiFile(schema);
    if (!validation.valid) {
      result.error = validation.errors.map((e) => e.message).join("; ");
      return result;
    }

    const isSupplemental = schema.mode === "supplement";
    const existingWmi = getExistingWmi(db, schema.wmi);

    // Check mode compatibility
    if (isSupplemental && !existingWmi) {
      result.error = `WMI "${schema.wmi}" not found for supplement mode`;
      return result;
    }
    if (!isSupplemental && existingWmi) {
      result.error = `WMI "${schema.wmi}" already exists, use mode: supplement`;
      return result;
    }

    if (dryRun) {
      result.patternsAdded = schema.patterns.length;
      result.success = true;
      return result;
    }

    // Get IDs
    const now = new Date().toISOString();
    let wmiId: number;
    let makeId: number;

    if (isSupplemental && existingWmi) {
      wmiId = existingWmi.wmiId;
      makeId = existingWmi.makeId;
    } else {
      // Resolve new WMI entities
      const manufacturerId = resolveEntityId(db, "Manufacturer", schema.manufacturer!);
      makeId = resolveEntityId(db, "Make", schema.make!)!;
      const countryId = resolveEntityId(db, "Country", schema.country!);
      const vehicleTypeId = resolveEntityId(db, "VehicleType", schema.vehicle_type!);

      if (!manufacturerId || !makeId || !countryId || !vehicleTypeId) {
        result.error = "Failed to resolve entity IDs";
        return result;
      }

      // Insert WMI
      wmiId = getNextId(db, "Wmi");
      db.prepare(
        `
        INSERT INTO Wmi (Id, Wmi, ManufacturerId, MakeId, VehicleTypeId, CountryId, CreatedOn, UpdatedOn)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(wmiId, schema.wmi, manufacturerId, makeId, vehicleTypeId, countryId, now, now);

      // Insert Wmi_Make
      db.prepare(`INSERT INTO Wmi_Make (WmiId, MakeId) VALUES (?, ?)`).run(
        wmiId,
        makeId
      );
    }

    // Create VinSchema
    const makeName = existingWmi?.make || schema.make || "Unknown";
    const countryName = existingWmi?.country || schema.country || "Unknown";
    const yearFrom = schema.years?.from || new Date().getFullYear();
    const yearTo = schema.years?.to;

    const schemaName =
      schema.schema_name ||
      `${makeName} Schema for ${schema.wmi} (Community) - ${yearFrom}${yearTo ? `-${yearTo}` : "+"}`;

    const vinSchemaId = getNextId(db, "VinSchema");
    db.prepare(
      `
      INSERT INTO VinSchema (Id, Name, sourcewmi, CreatedOn, UpdatedOn, Notes)
      VALUES (?, ?, ?, ?, ?, 'Community contribution')
    `
    ).run(vinSchemaId, schemaName, schema.wmi, now, now);

    // Create Wmi_VinSchema
    const wmiVinSchemaId = getNextId(db, "Wmi_VinSchema");
    db.prepare(
      `
      INSERT INTO Wmi_VinSchema (Id, WmiId, VinSchemaId, YearFrom, YearTo)
      VALUES (?, ?, ?, ?, ?)
    `
    ).run(wmiVinSchemaId, wmiId, vinSchemaId, yearFrom, yearTo);

    // Insert patterns
    let nextPatternId = getNextId(db, "Pattern");

    for (const pattern of schema.patterns) {
      // Resolve element
      const element = db
        .prepare("SELECT Id, LookupTable FROM Element WHERE Name = ? COLLATE NOCASE")
        .get(pattern.element) as { Id: number; LookupTable: string | null } | undefined;

      if (!element) {
        throw new Error(`Element "${pattern.element}" not found`);
      }

      // Resolve attribute value
      let attributeId: string;

      if (!element.LookupTable) {
        // Literal value
        attributeId = pattern.value;
      } else if (element.LookupTable === "Model") {
        // Special handling for Model
        const modelId = resolveModelId(db, pattern.value, makeId);
        if (!modelId) {
          throw new Error(`Model "${pattern.value}" not found for make ID ${makeId}`);
        }
        attributeId = String(modelId);
      } else if (pattern.element === "Plant Country") {
        const countryId = resolveEntityId(db, "Country", pattern.value);
        if (!countryId) {
          throw new Error(`Country "${pattern.value}" not found`);
        }
        attributeId = String(countryId);
      } else {
        // Generic lookup
        const lookupId = resolveEntityId(db, element.LookupTable, pattern.value);
        if (!lookupId) {
          throw new Error(
            `Value "${pattern.value}" not found in ${element.LookupTable}`
          );
        }
        attributeId = String(lookupId);
      }

      db.prepare(
        `
        INSERT INTO Pattern (Id, VinSchemaId, Keys, ElementId, AttributeId, CreatedOn, UpdatedOn)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(nextPatternId, vinSchemaId, pattern.pattern, element.Id, attributeId, now, now);

      nextPatternId++;
      result.patternsAdded++;
    }

    result.success = true;
  } catch (err) {
    result.error = (err as Error).message;
  }

  return result;
}

// ============================================================================
// File Discovery
// ============================================================================

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  function walk(currentDir: string) {
    const entries = readdirSync(currentDir);
    for (const entry of entries) {
      const fullPath = join(currentDir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// ============================================================================
// Main
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dbArgIndex = args.indexOf("--db");

  const baseDir = join(__dirname, "../..");
  const defaultDbPath = join(baseDir, "db/vpic.lite.db");
  const dbPath = dbArgIndex !== -1 ? args[dbArgIndex + 1] : defaultDbPath;
  const wmiDir = join(baseDir, "community/wmi");

  console.log(`${BOLD}Community VIN Pattern Applier${RESET}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Mode: ${dryRun ? `${YELLOW}DRY RUN${RESET}` : `${GREEN}APPLY${RESET}`}`);
  console.log();

  // Check database exists
  if (!existsSync(dbPath)) {
    console.error(`${RED}Database not found: ${dbPath}${RESET}`);
    process.exit(1);
  }

  // Find YAML files
  if (!existsSync(wmiDir)) {
    console.log(`${YELLOW}No community/wmi directory found${RESET}`);
    process.exit(0);
  }

  const yamlFiles = findYamlFiles(wmiDir);
  if (yamlFiles.length === 0) {
    console.log(`${YELLOW}No YAML files found in ${wmiDir}${RESET}`);
    process.exit(0);
  }

  console.log(`Found ${yamlFiles.length} YAML file(s)`);
  console.log();

  // Open database
  const db = new Database(dbPath);

  // Ensure Notes column exists (for tracking community contributions)
  const columns = db.prepare("PRAGMA table_info(VinSchema)").all() as { name: string }[];
  const hasNotesColumn = columns.some((c) => c.name === "Notes");
  if (!hasNotesColumn) {
    db.prepare("ALTER TABLE VinSchema ADD COLUMN Notes TEXT").run();
  }

  // Track what's already applied (by checking VinSchema notes)
  const existingCommunitySchemas = db
    .prepare("SELECT sourcewmi FROM VinSchema WHERE Notes = 'Community contribution'")
    .all() as { sourcewmi: string }[];
  const alreadyApplied = new Set(existingCommunitySchemas.map((r) => r.sourcewmi));

  const results: ApplyResult[] = [];
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  // Process each file in a transaction
  const applyAll = db.transaction(() => {
    for (const yamlPath of yamlFiles) {
      const relativePath = relative(baseDir, yamlPath);
      const content = readFileSync(yamlPath, "utf-8");
      const schema = parse(content) as WmiSchema;

      // Check if already applied
      if (alreadyApplied.has(schema.wmi)) {
        console.log(`${BLUE}SKIP${RESET} ${relativePath} (already applied)`);
        skipped++;
        continue;
      }

      const result = applyYamlFile(db, yamlPath, dryRun);
      results.push(result);

      if (result.success) {
        const modeLabel = result.mode === "supplement" ? "SUPPLEMENT" : "NEW";
        console.log(
          `${GREEN}OK${RESET} ${relativePath} [${modeLabel}] +${result.patternsAdded} patterns`
        );
        applied++;
      } else {
        console.log(`${RED}FAIL${RESET} ${relativePath}: ${result.error}`);
        failed++;
      }
    }
  });

  try {
    if (!dryRun) {
      applyAll();
    } else {
      // For dry run, still process but don't commit
      for (const yamlPath of yamlFiles) {
        const relativePath = relative(baseDir, yamlPath);
        const content = readFileSync(yamlPath, "utf-8");
        const schema = parse(content) as WmiSchema;

        if (alreadyApplied.has(schema.wmi)) {
          console.log(`${BLUE}SKIP${RESET} ${relativePath} (already applied)`);
          skipped++;
          continue;
        }

        const result = applyYamlFile(db, yamlPath, true);
        results.push(result);

        if (result.success) {
          const modeLabel = result.mode === "supplement" ? "SUPPLEMENT" : "NEW";
          console.log(
            `${GREEN}OK${RESET} ${relativePath} [${modeLabel}] +${result.patternsAdded} patterns`
          );
          applied++;
        } else {
          console.log(`${RED}FAIL${RESET} ${relativePath}: ${result.error}`);
          failed++;
        }
      }
    }
  } finally {
    db.close();
  }

  // Summary
  console.log();
  console.log(`${BOLD}Summary:${RESET}`);
  console.log(`  ${GREEN}Applied:${RESET} ${applied}`);
  if (skipped > 0) {
    console.log(`  ${BLUE}Skipped:${RESET} ${skipped}`);
  }
  if (failed > 0) {
    console.log(`  ${RED}Failed:${RESET} ${failed}`);
  }

  const totalPatterns = results
    .filter((r) => r.success)
    .reduce((sum, r) => sum + r.patternsAdded, 0);
  console.log(`  Total patterns: ${totalPatterns}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
