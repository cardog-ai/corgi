/**
 * Community VIN Pattern Generator
 *
 * Transforms contributor YAML files into VPIC-compatible SQL statements.
 * The generated SQL can be applied to vpic.lite.db to add community patterns.
 *
 * Usage:
 *   npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml
 *   npx tsx community/build/generate.ts --all
 */

import { parse } from "yaml";
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import Database from "better-sqlite3";

// ============================================================================
// Types
// ============================================================================

interface YearRange {
  from: number;
  to: number | null;
}

interface Pattern {
  pattern: string; // 6-char pattern for positions 4-9 (* = wildcard)
  element: string; // Element name (e.g., "Model", "Body Class")
  value: string; // The decoded value
}

interface TestVin {
  vin: string;
  expected: Record<string, string | number>;
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
  test_vins?: TestVin[];
}

interface ExistingWmiInfo {
  wmiId: number;
  manufacturerId: number;
  makeId: number;
  countryId: number;
  vehicleTypeId: number;
  make: string;
  country: string;
}

interface ResolvedIds {
  manufacturerId: number;
  makeId: number;
  countryId: number;
  vehicleTypeId: number;
  elements: Map<string, { id: number; lookupTable: string | null }>;
}

// ============================================================================
// ID Resolution
// ============================================================================

/**
 * Looks up existing WMI information from the database.
 * Used for supplemental mode.
 */
function getExistingWmi(db: Database.Database, wmi: string): ExistingWmiInfo | null {
  const row = db
    .prepare(`
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
    `)
    .get(wmi) as ExistingWmiInfo | undefined;

  return row || null;
}

/**
 * Resolves entity names to their VPIC database IDs.
 * Throws if a required entity doesn't exist.
 */
function resolveIds(db: Database.Database, schema: WmiSchema): ResolvedIds {
  // Resolve Manufacturer
  const manufacturer = db
    .prepare("SELECT Id FROM Manufacturer WHERE Name = ? COLLATE NOCASE")
    .get(schema.manufacturer) as { Id: number } | undefined;

  if (!manufacturer) {
    throw new Error(
      `Manufacturer "${schema.manufacturer}" not found in VPIC database. ` +
        `Use exact name from NHTSA.`
    );
  }

  // Resolve Make
  const make = db
    .prepare("SELECT Id FROM Make WHERE Name = ? COLLATE NOCASE")
    .get(schema.make) as { Id: number } | undefined;

  if (!make) {
    throw new Error(
      `Make "${schema.make}" not found in VPIC database. ` +
        `Use exact name from NHTSA.`
    );
  }

  // Resolve Country
  const country = db
    .prepare("SELECT Id FROM Country WHERE Name = ? COLLATE NOCASE")
    .get(schema.country) as { Id: number } | undefined;

  if (!country) {
    throw new Error(
      `Country "${schema.country}" not found in VPIC database.`
    );
  }

  // Resolve Vehicle Type
  const vehicleType = db
    .prepare("SELECT Id FROM VehicleType WHERE Name = ? COLLATE NOCASE")
    .get(schema.vehicle_type) as { Id: number } | undefined;

  if (!vehicleType) {
    throw new Error(
      `Vehicle type "${schema.vehicle_type}" not found in VPIC database.`
    );
  }

  // Resolve all Element names used in patterns
  const elementNames = [...new Set(schema.patterns.map((p) => p.element))];
  const elements = new Map<string, { id: number; lookupTable: string | null }>();

  for (const name of elementNames) {
    const element = db
      .prepare("SELECT Id, LookupTable FROM Element WHERE Name = ? COLLATE NOCASE")
      .get(name) as { Id: number; LookupTable: string | null } | undefined;

    if (!element) {
      throw new Error(
        `Element "${name}" not found in VPIC database. ` +
          `Check spelling or use a supported element.`
      );
    }

    elements.set(name, { id: element.Id, lookupTable: element.LookupTable });
  }

  return {
    manufacturerId: manufacturer.Id,
    makeId: make.Id,
    countryId: country.Id,
    vehicleTypeId: vehicleType.Id,
    elements,
  };
}

/**
 * Resolves a pattern value to its AttributeId.
 * For lookup tables, finds or suggests creating the entry.
 * For literal values, returns the value as-is.
 *
 * @param makeId - The Make ID for context (used to resolve Model correctly)
 */
function resolveAttributeId(
  db: Database.Database,
  elementName: string,
  lookupTable: string | null,
  value: string,
  makeId?: number
): string | { needsInsert: true; table: string; value: string } {
  // No lookup table = literal value
  if (!lookupTable) {
    return value;
  }

  // Special handling for certain elements
  if (elementName === "Plant Country") {
    // Look up country ID
    const country = db
      .prepare("SELECT Id FROM Country WHERE Name = ? COLLATE NOCASE")
      .get(value) as { Id: number } | undefined;

    if (country) {
      return String(country.Id);
    }
    return { needsInsert: true, table: "Country", value };
  }

  // Special handling for Model - must use Make_Model to get correct ID
  if (lookupTable === "Model" && makeId) {
    const model = db
      .prepare(`
        SELECT m.Id
        FROM Model m
        JOIN Make_Model mm ON mm.ModelId = m.Id
        WHERE m.Name = ? COLLATE NOCASE AND mm.MakeId = ?
      `)
      .get(value, makeId) as { Id: number } | undefined;

    if (model) {
      return String(model.Id);
    }
    // Model doesn't exist for this Make - fall through to generic lookup
  }

  // Look up in the specified table
  const row = db
    .prepare(`SELECT Id FROM "${lookupTable}" WHERE Name = ? COLLATE NOCASE`)
    .get(value) as { Id: number } | undefined;

  if (row) {
    return String(row.Id);
  }

  // Value doesn't exist in lookup table
  return { needsInsert: true, table: lookupTable, value };
}

// ============================================================================
// SQL Generation
// ============================================================================

interface GeneratedSql {
  mode: "new" | "supplement";
  lookupInserts: string[]; // New lookup table entries
  wmiInsert: string; // Wmi row (empty for supplement)
  wmiMakeInsert: string; // Wmi_Make row (empty for supplement)
  vinSchemaInsert: string; // VinSchema row
  wmiVinSchemaInsert: string; // Wmi_VinSchema row
  patternInserts: string[]; // Pattern rows
}

interface GenerateSqlOptions {
  db: Database.Database;
  schema: WmiSchema;
  ids: ResolvedIds;
  existingWmi?: ExistingWmiInfo;
}

function generateSql(options: GenerateSqlOptions): GeneratedSql {
  const { db, schema, ids, existingWmi } = options;
  const isSupplemental = schema.mode === "supplement";

  const result: GeneratedSql = {
    mode: isSupplemental ? "supplement" : "new",
    lookupInserts: [],
    wmiInsert: "",
    wmiMakeInsert: "",
    vinSchemaInsert: "",
    wmiVinSchemaInsert: "",
    patternInserts: [],
  };

  // Get next available IDs
  const maxVinSchemaId =
    (db.prepare("SELECT MAX(Id) as max FROM VinSchema").get() as { max: number }).max || 0;
  const maxWmiVinSchemaId =
    (db.prepare("SELECT MAX(Id) as max FROM Wmi_VinSchema").get() as { max: number }).max || 0;
  const maxPatternId =
    (db.prepare("SELECT MAX(Id) as max FROM Pattern").get() as { max: number }).max || 0;

  const newVinSchemaId = maxVinSchemaId + 1;
  const newWmiVinSchemaId = maxWmiVinSchemaId + 1;
  let nextPatternId = maxPatternId + 1;

  // For new mode, also get WMI ID
  let wmiId: number;
  if (isSupplemental && existingWmi) {
    wmiId = existingWmi.wmiId;
  } else {
    const maxWmiId =
      (db.prepare("SELECT MAX(Id) as max FROM Wmi").get() as { max: number }).max || 0;
    wmiId = maxWmiId + 1;
  }

  // Use existing or provided makeId for Model resolution
  const makeIdForLookup = existingWmi?.makeId || ids.makeId;

  // Track new lookup entries we need to create
  const lookupEntriesToCreate: Map<string, Set<string>> = new Map();

  // Pre-process patterns to identify needed lookup entries
  for (const pattern of schema.patterns) {
    const elementInfo = ids.elements.get(pattern.element)!;
    const attrResult = resolveAttributeId(
      db,
      pattern.element,
      elementInfo.lookupTable,
      pattern.value,
      makeIdForLookup
    );

    if (typeof attrResult === "object" && attrResult.needsInsert) {
      if (!lookupEntriesToCreate.has(attrResult.table)) {
        lookupEntriesToCreate.set(attrResult.table, new Set());
      }
      lookupEntriesToCreate.get(attrResult.table)!.add(attrResult.value);
    }
  }

  // Generate lookup table inserts if needed
  for (const [table, values] of lookupEntriesToCreate) {
    const maxId =
      (db.prepare(`SELECT MAX(Id) as max FROM "${table}"`).get() as { max: number })
        .max || 0;
    let nextId = maxId + 1;

    for (const value of values) {
      result.lookupInserts.push(
        `-- New ${table} entry for: ${value}`,
        `INSERT INTO "${table}" (Id, Name) VALUES (${nextId}, '${escapeSql(value)}');`
      );
      nextId++;
    }
  }

  // Determine schema name and make/country for display
  const makeName = existingWmi?.make || schema.make || "Unknown";
  const countryName = existingWmi?.country || schema.country || "Unknown";
  const yearFrom = schema.years?.from || new Date().getFullYear();
  const yearTo = schema.years?.to;

  const schemaName =
    schema.schema_name ||
    `${makeName} Schema for ${schema.wmi} (Community) - ${yearFrom}${yearTo ? `-${yearTo}` : "+"}`;

  const now = new Date().toISOString();

  // Only generate WMI inserts for new mode
  if (!isSupplemental) {
    result.wmiInsert = `
-- WMI: ${schema.wmi} (${makeName} - ${countryName})
INSERT INTO Wmi (Id, Wmi, ManufacturerId, MakeId, VehicleTypeId, CountryId, CreatedOn, UpdatedOn)
VALUES (${wmiId}, '${schema.wmi}', ${ids.manufacturerId}, ${ids.makeId}, ${ids.vehicleTypeId}, ${ids.countryId}, '${now}', '${now}');
`.trim();

    result.wmiMakeInsert = `
INSERT INTO Wmi_Make (WmiId, MakeId) VALUES (${wmiId}, ${ids.makeId});
`.trim();
  }

  // VinSchema insert
  result.vinSchemaInsert = `
-- VinSchema: ${schemaName}
INSERT INTO VinSchema (Id, Name, sourcewmi, CreatedOn, UpdatedOn, Notes)
VALUES (${newVinSchemaId}, '${escapeSql(schemaName)}', '${schema.wmi}', '${now}', '${now}', 'Community contribution');
`.trim();

  // Wmi_VinSchema insert
  result.wmiVinSchemaInsert = `
INSERT INTO Wmi_VinSchema (Id, WmiId, VinSchemaId, YearFrom, YearTo)
VALUES (${newWmiVinSchemaId}, ${wmiId}, ${newVinSchemaId}, ${yearFrom}, ${yearTo ?? "NULL"});
`.trim();

  // Pattern inserts
  for (const pattern of schema.patterns) {
    const elementInfo = ids.elements.get(pattern.element)!;
    let attributeId: string;

    const attrResult = resolveAttributeId(
      db,
      pattern.element,
      elementInfo.lookupTable,
      pattern.value,
      makeIdForLookup
    );

    if (typeof attrResult === "string") {
      attributeId = attrResult;
    } else {
      // Need to compute the ID we'll assign to this new entry
      // This is a simplification - in reality we'd track these
      attributeId = `__NEW_${attrResult.table}_${attrResult.value}__`;
    }

    result.patternInserts.push(
      `INSERT INTO Pattern (Id, VinSchemaId, Keys, ElementId, AttributeId, CreatedOn, UpdatedOn)` +
        ` VALUES (${nextPatternId}, ${newVinSchemaId}, '${pattern.pattern}', ${elementInfo.id}, '${escapeSql(attributeId)}', '${now}', '${now}');` +
        ` -- ${pattern.element}: ${pattern.value}`
    );
    nextPatternId++;
  }

  return result;
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

// ============================================================================
// Main
// ============================================================================

function processYamlFile(yamlPath: string, dbPath: string): string {
  const yaml = readFileSync(yamlPath, "utf-8");
  const schema = parse(yaml) as WmiSchema;

  const isSupplemental = schema.mode === "supplement";

  // Validate required fields based on mode
  if (isSupplemental) {
    const required = ["wmi", "patterns"];
    for (const field of required) {
      if (!(field in schema)) {
        throw new Error(`Missing required field for supplement mode: ${field}`);
      }
    }
  } else {
    const required = ["wmi", "manufacturer", "make", "country", "vehicle_type", "years", "patterns"];
    for (const field of required) {
      if (!(field in schema)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  if (schema.wmi.length !== 3) {
    throw new Error(`WMI must be exactly 3 characters, got: ${schema.wmi}`);
  }

  // Open database read-only for ID resolution
  const db = new Database(dbPath, { readonly: true });

  try {
    // Check if WMI exists
    const existingWmiInfo = getExistingWmi(db, schema.wmi);

    if (isSupplemental) {
      // Supplement mode: WMI must exist
      if (!existingWmiInfo) {
        throw new Error(
          `WMI "${schema.wmi}" not found in database. ` +
            `Use mode: new to create a new WMI.`
        );
      }
    } else {
      // New mode: WMI must not exist
      if (existingWmiInfo) {
        throw new Error(
          `WMI "${schema.wmi}" already exists in database. ` +
            `Use mode: supplement to add patterns to existing WMIs.`
        );
      }
    }

    // Resolve IDs - for supplemental, we only need elements
    let ids: ResolvedIds;
    if (isSupplemental && existingWmiInfo) {
      // Use existing WMI info for supplemental mode
      ids = {
        manufacturerId: existingWmiInfo.manufacturerId,
        makeId: existingWmiInfo.makeId,
        countryId: existingWmiInfo.countryId,
        vehicleTypeId: existingWmiInfo.vehicleTypeId,
        elements: new Map(),
      };
      // Still need to resolve elements
      const elementNames = [...new Set(schema.patterns.map((p) => p.element))];
      for (const name of elementNames) {
        const element = db
          .prepare("SELECT Id, LookupTable FROM Element WHERE Name = ? COLLATE NOCASE")
          .get(name) as { Id: number; LookupTable: string | null } | undefined;
        if (!element) {
          throw new Error(`Element "${name}" not found in VPIC database.`);
        }
        ids.elements.set(name, { id: element.Id, lookupTable: element.LookupTable });
      }
    } else {
      ids = resolveIds(db, schema);
    }

    // Generate SQL
    const sql = generateSql({
      db,
      schema,
      ids,
      existingWmi: existingWmiInfo || undefined,
    });

    // Determine display names
    const makeName = existingWmiInfo?.make || schema.make || "Unknown";
    const countryName = existingWmiInfo?.country || schema.country || "Unknown";

    // Build output
    const lines: string[] = [
      `-- ============================================================================`,
      `-- Community VIN Pattern: ${schema.wmi} (${makeName} - ${countryName})`,
      `-- Mode: ${isSupplemental ? "SUPPLEMENT (adding to existing WMI)" : "NEW"}`,
      `-- Generated from: ${basename(yamlPath)}`,
      `-- Generated on: ${new Date().toISOString()}`,
      `-- ============================================================================`,
      ``,
      `BEGIN TRANSACTION;`,
      ``,
    ];

    if (sql.lookupInserts.length > 0) {
      lines.push(`-- New lookup table entries`);
      lines.push(...sql.lookupInserts);
      lines.push(``);
    }

    // Only add WMI inserts for new mode
    if (!isSupplemental && sql.wmiInsert) {
      lines.push(sql.wmiInsert);
      lines.push(``);
      lines.push(sql.wmiMakeInsert);
      lines.push(``);
    }

    lines.push(sql.vinSchemaInsert);
    lines.push(``);
    lines.push(sql.wmiVinSchemaInsert);
    lines.push(``);
    lines.push(`-- Patterns (${sql.patternInserts.length} total)`);
    lines.push(...sql.patternInserts);
    lines.push(``);
    lines.push(`COMMIT;`);
    lines.push(``);
    lines.push(`-- Verify insertion:`);
    lines.push(`-- SELECT * FROM Wmi WHERE Wmi = '${schema.wmi}';`);
    lines.push(`-- SELECT * FROM Pattern WHERE VinSchemaId = (SELECT MAX(Id) FROM VinSchema WHERE sourcewmi = '${schema.wmi}');`);

    return lines.join("\n");
  } finally {
    db.close();
  }
}

// CLI
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("Usage: npx tsx community/build/generate.ts <yaml-file> [--db <path>]");
  console.log("       npx tsx community/build/generate.ts --all [--db <path>]");
  process.exit(1);
}

const dbPath = args.includes("--db")
  ? args[args.indexOf("--db") + 1]
  : join(import.meta.dirname || __dirname, "../../db/vpic.lite.db");

if (args[0] === "--all") {
  // Process all YAML files in community/wmi/
  const wmiDir = join(import.meta.dirname || __dirname, "../wmi");
  console.log(`Processing all YAML files in ${wmiDir}...`);
  // TODO: Implement recursive processing
} else {
  const yamlPath = args[0];
  try {
    const sql = processYamlFile(yamlPath, dbPath);
    console.log(sql);
  } catch (err) {
    console.error(`Error: ${(err as Error).message}`);
    process.exit(1);
  }
}
