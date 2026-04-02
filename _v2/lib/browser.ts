import { decodeVIN, VINDecoder as CoreVINDecoder } from './decode';
import { BrowserDatabaseAdapterFactory, BrowserDatabaseAdapter } from './db/browser-adapter';
import { CloudflareD1Adapter, createD1Adapter } from './db/d1-adapter';
import { DecodeOptions, DecodeResult } from './types';
import { createLogger } from './logger';

const logger = createLogger('browser');

/**
 * Options for VIN decoder initialization
 */
export interface VINDecoderOptions {
  /**
   * Path or URL to the database file
   */
  databasePath: string;

  /**
   * Default options for VIN decoding
   */
  defaultOptions?: DecodeOptions;
}

/**
 * Browser-specific VIN decoder class
 */
export class VINDecoder {
  private adapterFactory: BrowserDatabaseAdapterFactory;
  private databasePath: string;
  private defaultOptions: DecodeOptions;

  /**
   * Create a new VIN decoder
   *
   * @param options - Configuration options
   */
  constructor(options: VINDecoderOptions) {
    this.adapterFactory = new BrowserDatabaseAdapterFactory();
    this.databasePath = options.databasePath;
    this.defaultOptions = options.defaultOptions || {};

    logger.debug({ options }, 'Browser VIN decoder initialized');
  }

  /**
   * Decode a VIN
   *
   * @param vin - VIN to decode
   * @param options - Decode options that override defaults
   * @returns Decoded VIN information
   */
  async decode(vin: string, options?: DecodeOptions): Promise<DecodeResult> {
    logger.debug({ vin }, 'Decoding VIN');

    try {
      // Create adapter for this decode operation
      const adapter = await this.adapterFactory.createAdapter(this.databasePath);

      // Merge default options with provided options
      const mergedOptions = {
        ...this.defaultOptions,
        ...options,
      };

      // Decode VIN
      const result = await decodeVIN(vin, adapter, mergedOptions);

      // Close the adapter
      await adapter.close();

      return result;
    } catch (error) {
      logger.error({ vin, error }, 'VIN decoding failed');
      throw error;
    }
  }
}

// Export core functionality
export { CoreVINDecoder, decodeVIN };
export { BrowserDatabaseAdapter };
export { CloudflareD1Adapter, createD1Adapter };
export * from './types';

// Explicitly export the default adapter for browser environments
export { BrowserDatabaseAdapter as DatabaseAdapter } from './db/browser-adapter';

// Default export for easy importing
export default VINDecoder;
