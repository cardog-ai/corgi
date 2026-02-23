/**
 * Test script to verify community patterns work with the decoder
 *
 * Usage:
 *   npx tsx community/build/test-decode.ts <VIN> [--db <path>]
 */

import { NodeDatabaseAdapterFactory } from "../../lib/db/node-adapter";
import { VINDecoder } from "../../lib/decode";
import { join } from "path";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("Usage: npx tsx community/build/test-decode.ts <VIN> [--db <path>]");
    console.log("Example: npx tsx community/build/test-decode.ts LRW3E7FA6NC544804 --db db/vpic.community-test.db");
    process.exit(1);
  }

  const vin = args[0];
  const dbPath = args.includes("--db")
    ? args[args.indexOf("--db") + 1]
    : join(import.meta.dirname || __dirname, "../../db/vpic.lite.db");

  console.log(`Decoding VIN: ${vin}`);
  console.log(`Using database: ${dbPath}`);
  console.log("");

  const factory = new NodeDatabaseAdapterFactory();
  const adapter = await factory.createAdapter(dbPath);
  const decoder = new VINDecoder(adapter);

  const result = await decoder.decode(vin);

  if (!result.valid) {
    console.log("INVALID VIN");
    console.log("Errors:", result.errors);
    return;
  }

  console.log("=== Decoded VIN ===");
  console.log("");

  // Key fields
  const keyFields = [
    "Make",
    "Model",
    "ModelYear",
    "BodyClass",
    "Doors",
    "DriveType",
    "FuelTypePrimary",
    "ElectrificationLevel",
    "PlantCity",
    "PlantCountry",
    "Manufacturer",
  ];

  for (const field of keyFields) {
    const value = result[field as keyof typeof result];
    if (value !== undefined && value !== null && value !== "") {
      console.log(`${field}: ${value}`);
    }
  }

  console.log("");
  console.log("=== Full Result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
