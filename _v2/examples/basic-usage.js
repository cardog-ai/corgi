import { createDecoder } from '@cardog/corgi';

// Create a decoder
const decoder = await createDecoder({
  forceFresh: true,
});

try {
  // Decode a VIN
  const result = await decoder.decode('KM8K2CAB4PU001140');

  // Print the result
  console.log('VIN:', result.vin);
  console.log('Valid:', result.valid);

  // Print vehicle information
  if (result.components.vehicle) {
    console.log('\nVehicle Information:');
    console.log('Make:', result.components.vehicle.make);
    console.log('Model:', result.components.vehicle.model);
    console.log('Year:', result.components.vehicle.year);

    if (result.components.vehicle.bodyStyle) {
      console.log('Body Style:', result.components.vehicle.bodyStyle);
    }

    if (result.components.vehicle.driveType) {
      console.log('Drive Type:', result.components.vehicle.driveType);
    }

    if (result.components.vehicle.fuelType) {
      console.log('Fuel Type:', result.components.vehicle.fuelType);
    }
  }

  // Print engine information
  if (result.components.engine) {
    console.log('\nEngine Information:');

    if (result.components.engine.cylinders) {
      console.log('Cylinders:', result.components.engine.cylinders);
    }

    if (result.components.engine.displacement) {
      console.log('Displacement:', result.components.engine.displacement, 'L');
    }

    if (result.components.engine.fuel) {
      console.log('Fuel:', result.components.engine.fuel);
    }
  }

  // Print manufacturing information
  if (result.components.plant) {
    console.log('\nManufacturing Information:');
    console.log('Country:', result.components.plant.country);

    if (result.components.plant.city) {
      console.log('City:', result.components.plant.city);
    }
  }

  // Print any errors
  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(error => {
      console.log(`- [${error.severity.toUpperCase()}] ${error.message}`);
    });
  }
} catch (error) {
  console.error('Error decoding VIN:', error);
} finally {
  // Always close the decoder when done
  await decoder.close();
}