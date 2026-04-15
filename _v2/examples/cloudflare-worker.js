/**
 * Example Cloudflare Worker using the CORGI VIN Decoder with a D1 database
 * 
 * To use this example:
 * 1. Create a D1 database using the sqlite-to-d1.js script
 * 2. Configure your wrangler.toml to use the D1 database
 * 3. Deploy the worker with `npx wrangler deploy`
 */

import { initD1Adapter, createDecoder } from '@cardog/corgi';

export default {
  async fetch(request, env, ctx) {
    // Get the VIN from the URL
    const url = new URL(request.url);
    const vin = url.pathname.replace(/^\//, '') || url.searchParams.get('vin');

    // If no VIN provided, return the API documentation
    if (!vin) {
      return new Response(JSON.stringify({
        name: "CORGI VIN Decoder API",
        version: "1.0.0",
        usage: "GET /:vin or GET /?vin=:vin",
        example: `${url.origin}/1HGCM82633A004352`
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Initialize D1 adapter
      initD1Adapter(env.DB);

      // Create decoder
      const decoder = await createDecoder({
        databasePath: 'D1', // Path is ignored for D1
        runtime: 'cloudflare'
      });

      // Decode VIN
      const result = await decoder.decode(vin, {
        // Enable pattern details for API responses
        includePatternDetails: true
      });

      // Close the decoder
      await decoder.close();

      // Return the result
      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=3600' // Cache for 1 hour
        }
      });
    } catch (error) {
      // Handle errors
      return new Response(JSON.stringify({
        error: true,
        message: error.message,
        vin: vin
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

/**
 * Example wrangler.toml configuration:
 * 
 * name = "vin-decoder-api"
 * main = "src/index.js"
 * compatibility_date = "2023-05-18"
 * 
 * [[d1_databases]]
 * binding = "DB"
 * database_name = "corgi-vpic"
 * database_id = "<your-database-id>"
 */