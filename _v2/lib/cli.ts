#!/usr/bin/env node

import { Command } from 'commander';
import { createDecoder, DecodeOptions, DecodeResult, PatternMatch } from './index';
import { createLogger } from './logger';
import { version } from 'process';

const logger = createLogger('cli');

// Create CLI program
const program = new Command();

// Configure CLI
program
  .name('corgi')
  .description('CORGI - Comprehensive Open Registry for Global Identification')
  .version(version);

// Decode command
program
  .command('decode <vin>')
  .description('Decode a Vehicle Identification Number (VIN)')
  .option('-d, --database <path>', 'Path to the VPIC database file')
  .option('-p, --patterns', 'Include pattern matching details')
  .option('-r, --raw', 'Include raw database records')
  .option('-f, --format <format>', 'Output format (json, pretty)', 'pretty')
  .option('-y, --year <year>', 'Override model year detection', parseYear)
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (vin, options) => {
    // Set log level based on verbose flag
    process.env.LOG_LEVEL = options.verbose ? 'debug' : 'info';

    try {
      // Clean and validate VIN
      vin = vin.trim().toUpperCase();
      if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
        console.error(
          'Error: VIN must be 17 characters (letters A-Z except I,O,Q and numbers 0-9)',
        );
        process.exit(1);
      }

      // Configure decode options
      const decodeOptions: DecodeOptions = {
        includePatternDetails: options.patterns,
        includeRawData: options.raw,
        includeDiagnostics: options.verbose,
      };

      // Override model year if provided
      if (options.year) {
        decodeOptions.modelYear = options.year;
      }

      // Create decoder
      const decoder = await createDecoder({
        databasePath: options.database,
        // forceFresh: true,
        defaultOptions: decodeOptions,
      });

      // Decode VIN
      const result = await decoder.decode(vin);

      // Close the decoder
      await decoder.close();

      // Output result in requested format
      if (options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
      } else {
        outputPretty(result);
      }

      // Exit with success code if valid, error code if invalid
      process.exit(result.valid ? 0 : 1);
    } catch (error: unknown) {
      logger.error({ error }, 'Failed to decode VIN');

      if (options.verbose) {
        console.error(error);
      } else {
        console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      process.exit(1);
    }
  });

// Default command (decode)
program.action(() => {
  program.help();
});

// Format output in a human-readable way
function outputPretty(result: DecodeResult): void {
  const { vin, valid, components, errors } = result;

  console.log(`VIN: ${vin}`);
  console.log(`Valid: ${valid ? 'Yes' : 'No'}`);
  console.log();

  if (components.vehicle) {
    console.log('Vehicle Information:');
    console.log(`  Make: ${components.vehicle.make || 'Unknown'}`);
    console.log(`  Model: ${components.vehicle.model || 'Unknown'}`);
    console.log(`  Year: ${components.vehicle.year || 'Unknown'}`);

    if (components.vehicle.trim) {
      console.log(`  Trim: ${components.vehicle.trim}`);
    }

    if (components.vehicle.series) {
      console.log(`  Series: ${components.vehicle.series}`);
    }

    if (components.vehicle.bodyStyle) {
      console.log(`  Body Style: ${components.vehicle.bodyStyle}`);
    }

    if (components.vehicle.driveType) {
      console.log(`  Drive Type: ${components.vehicle.driveType}`);
    }

    if (components.vehicle.transmission) {
      console.log(`  Transmission: ${components.vehicle.transmission}`);
    }

    if (components.vehicle.fuelType) {
      console.log(`  Fuel Type: ${components.vehicle.fuelType}`);
    }

    console.log();
  }

  if (components.engine) {
    console.log('Engine Information:');

    if (components.engine.model) {
      console.log(`  Model: ${components.engine.model}`);
    }

    if (components.engine.displacement) {
      console.log(`  Displacement: ${components.engine.displacement}L`);
    }

    if (components.engine.cylinders) {
      console.log(`  Cylinders: ${components.engine.cylinders}`);
    }

    if (components.engine.fuel) {
      console.log(`  Fuel: ${components.engine.fuel}`);
    }

    if (components.engine.power) {
      console.log(`  Power: ${components.engine.power}`);
    }

    console.log();
  }

  if (components.plant) {
    console.log('Manufacturing Information:');
    console.log(`  Country: ${components.plant.country}`);

    if (components.plant.city) {
      console.log(`  City: ${components.plant.city}`);
    }

    if (components.plant.manufacturer) {
      console.log(`  Plant: ${components.plant.manufacturer}`);
    }

    console.log();
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(error => {
      console.log(`  [${error.severity.toUpperCase()}] ${error.message}`);
    });
    console.log();
  }

  if (result.metadata) {
    console.log('Metadata:');
    console.log(`  Confidence: ${(result.metadata.confidence * 100).toFixed(1)}%`);
    console.log(`  Processing Time: ${result.metadata.processingTime}ms`);

    if (result.metadata.matchedSchema) {
      console.log(`  Schema: ${result.metadata.matchedSchema}`);
    }

    console.log();
  }

  if (result.patterns && result.patterns.length > 0) {
    console.log('Pattern Details:');
    console.log('===============');

    result.patterns
      .sort((a: PatternMatch, b: PatternMatch) => b.confidence - a.confidence)
      .forEach((pattern: PatternMatch) => {
        console.log(
          `${pattern.element}: ${pattern.value} (${(pattern.confidence * 100).toFixed(1)}%)`,
        );
      });

    console.log();
  }
}

// Parse year from string
function parseYear(value: string): number {
  const year = parseInt(value, 10);

  if (isNaN(year) || year < 1900 || year > 2100) {
    throw new Error('Year must be a number between 1900 and 2100');
  }

  return year;
}

// Parse arguments
program.parse();

// Default to help if no command specified
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
