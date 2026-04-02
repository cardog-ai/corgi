#!/usr/bin/env node

/**
 * Simple example of using the CORGI library to decode a VIN
 * 
 * Usage: node simple-decode.js <VIN>
 * Example: node simple-decode.js KM8K2CAB4PU001140
 */

import { quickDecode } from '@cardog/corgi';

async function main() {
  // Get the VIN from command line arguments
  const vin = process.argv[2];

  if (!vin) {
    console.error('Please provide a VIN as an argument');
    console.error('Example: node simple-decode.js KM8K2CAB4PU001140');
    process.exit(1);
  }

  try {
    console.log(`Decoding VIN: ${vin}`);

    // Use the shared decoder instance to decode the VIN
    const startTime = Date.now();
    const result = await quickDecode(vin, {
      forceFresh: true,
    });
    const elapsed = Date.now() - startTime;

    console.log('\nResults:');

    if (result.valid) {
      console.log('✅ Valid VIN');
    } else {
      console.log('❌ Invalid VIN');
      console.log('Errors:');
      result.errors.forEach(err => {
        console.log(`- ${err.message}`);
      });
    }

    if (result.components.vehicle) {
      const vehicle = result.components.vehicle;
      console.log('\nVehicle Information:');
      console.log(`Make: ${vehicle.make}`);
      console.log(`Model: ${vehicle.model}`);
      console.log(`Year: ${vehicle.year}`);

      if (vehicle.bodyStyle) console.log(`Body Style: ${vehicle.bodyStyle}`);
      if (vehicle.driveType) console.log(`Drive Type: ${vehicle.driveType}`);
      if (vehicle.engineType) console.log(`Engine: ${vehicle.engineType}`);
      if (vehicle.fuelType) console.log(`Fuel: ${vehicle.fuelType}`);
      if (vehicle.transmission) console.log(`Transmission: ${vehicle.transmission}`);
    }

    if (result.components.wmi) {
      console.log('\nManufacturer Information:');
      console.log(`Manufacturer: ${result.components.wmi.manufacturer}`);
      console.log(`Country: ${result.components.wmi.country}`);
    }

    console.log(`\nDecoding completed in ${elapsed}ms`);

  } catch (error) {
    console.error('Error decoding VIN:', error);
    process.exit(1);
  }
}

main();