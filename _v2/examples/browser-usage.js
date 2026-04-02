// Example browser usage of the CORGI VIN Decoder

// Load SQL.js WebAssembly file first
// This would typically be part of your page's main script or module
async function loadSqlJs() {
  const sqlPromise = initSqlJs({
    locateFile: file => `/assets/${file}`
  });

  // Assign to window for the CORGI library to use
  window.SQL = await sqlPromise;
}

// Initialize the VIN decoder
async function initDecoder() {
  try {
    // Make sure SQL.js is loaded
    await loadSqlJs();

    // Import the CORGI library
    const { createDecoder } = await import('@cardog/corgi');

    // Create a decoder with the database path
    // This should point to where your database file is hosted
    const decoder = await createDecoder({
      databasePath: '/assets/vpic.lite.db',
      runtime: 'browser',
      defaultOptions: {
        // Default options to apply to all decode operations
        includePatternDetails: false,
        confidenceThreshold: 0.6
      }
    });

    return decoder;
  } catch (error) {
    console.error('Failed to initialize VIN decoder:', error);
    throw error;
  }
}

// VIN decoding function
async function decodeVin(vin) {
  // Get the input element
  const vinInput = document.getElementById('vin-input');
  const resultContainer = document.getElementById('result-container');

  // Clear previous results
  resultContainer.innerHTML = '<div class="loading">Decoding VIN...</div>';

  try {
    // Initialize decoder if not already done
    if (!window.vinDecoder) {
      window.vinDecoder = await initDecoder();
    }

    // Decode the VIN
    const result = await window.vinDecoder.decode(vin);

    // Display the result
    displayResult(result);
  } catch (error) {
    resultContainer.innerHTML = `
      <div class="error">
        <h3>Error</h3>
        <p>${error.message}</p>
      </div>
    `;
  }
}

// Display the decoded VIN information
function displayResult(result) {
  const resultContainer = document.getElementById('result-container');

  // Create HTML for the result
  let html = `
    <div class="result ${result.valid ? 'valid' : 'invalid'}">
      <h3>VIN: ${result.vin}</h3>
      <p class="status">Status: ${result.valid ? 'Valid' : 'Invalid'}</p>
  `;

  // Vehicle information
  if (result.components.vehicle) {
    const vehicle = result.components.vehicle;

    html += `
      <div class="section">
        <h4>Vehicle Information</h4>
        <table>
          <tr><td>Make:</td><td>${vehicle.make || 'Unknown'}</td></tr>
          <tr><td>Model:</td><td>${vehicle.model || 'Unknown'}</td></tr>
          <tr><td>Year:</td><td>${vehicle.year || 'Unknown'}</td></tr>
    `;

    if (vehicle.series) {
      html += `<tr><td>Series:</td><td>${vehicle.series}</td></tr>`;
    }

    if (vehicle.trim) {
      html += `<tr><td>Trim:</td><td>${vehicle.trim}</td></tr>`;
    }

    if (vehicle.bodyStyle) {
      html += `<tr><td>Body Style:</td><td>${vehicle.bodyStyle}</td></tr>`;
    }

    if (vehicle.driveType) {
      html += `<tr><td>Drive Type:</td><td>${vehicle.driveType}</td></tr>`;
    }

    if (vehicle.fuelType) {
      html += `<tr><td>Fuel Type:</td><td>${vehicle.fuelType}</td></tr>`;
    }

    html += `
        </table>
      </div>
    `;
  }

  // Engine information
  if (result.components.engine) {
    const engine = result.components.engine;

    html += `
      <div class="section">
        <h4>Engine Information</h4>
        <table>
    `;

    if (engine.model) {
      html += `<tr><td>Model:</td><td>${engine.model}</td></tr>`;
    }

    if (engine.cylinders) {
      html += `<tr><td>Cylinders:</td><td>${engine.cylinders}</td></tr>`;
    }

    if (engine.displacement) {
      html += `<tr><td>Displacement:</td><td>${engine.displacement} L</td></tr>`;
    }

    if (engine.fuel) {
      html += `<tr><td>Fuel:</td><td>${engine.fuel}</td></tr>`;
    }

    if (engine.power) {
      html += `<tr><td>Power:</td><td>${engine.power}</td></tr>`;
    }

    html += `
        </table>
      </div>
    `;
  }

  // Manufacturing information
  if (result.components.plant) {
    const plant = result.components.plant;

    html += `
      <div class="section">
        <h4>Manufacturing Information</h4>
        <table>
          <tr><td>Country:</td><td>${plant.country}</td></tr>
    `;

    if (plant.city) {
      html += `<tr><td>City:</td><td>${plant.city}</td></tr>`;
    }

    if (plant.manufacturer) {
      html += `<tr><td>Plant:</td><td>${plant.manufacturer}</td></tr>`;
    }

    html += `
        </table>
      </div>
    `;
  }

  // Errors
  if (result.errors.length > 0) {
    html += `
      <div class="section errors">
        <h4>Errors</h4>
        <ul>
    `;

    result.errors.forEach(error => {
      html += `<li class="${error.severity}">
        ${error.message}
        ${error.details ? `<span class="details">${error.details}</span>` : ''}
      </li>`;
    });

    html += `
        </ul>
      </div>
    `;
  }

  // Close the result container
  html += `</div>`;

  // Set the HTML
  resultContainer.innerHTML = html;
}

// Handle form submission
document.getElementById('vin-form').addEventListener('submit', function (event) {
  event.preventDefault();
  const vin = document.getElementById('vin-input').value.trim();

  if (vin) {
    decodeVin(vin);
  }
});