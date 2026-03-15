/**
 * Community VIN Pattern Validator
 *
 * Validates YAML files against the schema before processing.
 *
 * Usage:
 *   npx tsx community/build/validate.ts community/wmi/tesla/LRW.yaml
 *   npx tsx community/build/validate.ts --all
 */

import { parse } from "yaml";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { validateWmiFile, ValidationResult } from "./schema";

// ANSI colors
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

function formatError(error: { path: string; message: string }): string {
  return `  ${RED}✗${RESET} ${error.path ? `[${error.path}] ` : ""}${error.message}`;
}

function formatWarning(warning: { path: string; message: string }): string {
  return `  ${YELLOW}⚠${RESET} ${warning.path ? `[${warning.path}] ` : ""}${warning.message}`;
}

function validateFile(filePath: string): ValidationResult & { file: string } {
  try {
    const content = readFileSync(filePath, "utf-8");
    const data = parse(content);
    const result = validateWmiFile(data);
    return { ...result, file: filePath };
  } catch (err) {
    return {
      valid: false,
      errors: [
        {
          path: "",
          message: `Failed to parse YAML: ${(err as Error).message}`,
        },
      ],
      warnings: [],
      file: filePath,
    };
  }
}

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

function printResult(result: ValidationResult & { file: string }, basePath: string) {
  const relativePath = relative(basePath, result.file);

  if (result.valid) {
    console.log(`${GREEN}✓${RESET} ${relativePath}`);
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(formatWarning(warning));
      }
    }
  } else {
    console.log(`${RED}✗${RESET} ${relativePath}`);
    for (const error of result.errors) {
      console.log(formatError(error));
    }
    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        console.log(formatWarning(warning));
      }
    }
  }
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: npx tsx community/build/validate.ts <yaml-file>");
  console.log("       npx tsx community/build/validate.ts --all");
  process.exit(1);
}

const basePath = process.cwd();

if (args[0] === "--all") {
  const wmiDir = join(basePath, "community", "wmi");
  const files = findYamlFiles(wmiDir);

  if (files.length === 0) {
    console.log("No YAML files found in community/wmi/");
    process.exit(0);
  }

  console.log(`${BOLD}Validating ${files.length} file(s)...${RESET}\n`);

  let passed = 0;
  let failed = 0;
  let totalWarnings = 0;

  for (const file of files) {
    const result = validateFile(file);
    printResult(result, basePath);

    if (result.valid) {
      passed++;
    } else {
      failed++;
    }
    totalWarnings += result.warnings.length;
  }

  console.log("");
  console.log(`${BOLD}Results:${RESET}`);
  console.log(`  ${GREEN}Passed:${RESET} ${passed}`);
  if (failed > 0) {
    console.log(`  ${RED}Failed:${RESET} ${failed}`);
  }
  if (totalWarnings > 0) {
    console.log(`  ${YELLOW}Warnings:${RESET} ${totalWarnings}`);
  }

  process.exit(failed > 0 ? 1 : 0);
} else {
  const filePath = args[0];
  const result = validateFile(filePath);
  printResult(result, basePath);

  if (result.valid) {
    console.log(`\n${GREEN}Validation passed${RESET}`);
    if (result.warnings.length > 0) {
      console.log(`${YELLOW}${result.warnings.length} warning(s)${RESET}`);
    }
    process.exit(0);
  } else {
    console.log(`\n${RED}Validation failed${RESET}`);
    process.exit(1);
  }
}
