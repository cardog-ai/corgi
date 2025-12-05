/**
 * CORGI - Comprehensive Open Registry for Global Identification
 * A TypeScript library for decoding and validating Vehicle Identification Numbers (VINs)
 *
 * @packageDocumentation
 */

// Core decoder
import { VINDecoder, decodeVIN as decodeVINCore } from './decode';

// Database adapters
import type { DatabaseAdapter, QueryResult, DatabaseAdapterFactory } from './db/adapter';

import { BrowserDatabaseAdapter, BrowserDatabaseAdapterFactory } from './db/browser-adapter';

import { NodeDatabaseAdapter, NodeDatabaseAdapterFactory } from './db/node-adapter';

import { CloudflareD1Adapter, createD1Adapter } from './db/d1-adapter';

// Database utilities for compressed database handling
import { getDatabasePath } from './db/utils';

// Type imports
import type {
  DecodeResult,
  DecodeOptions,
  VINComponents,
  VehicleInfo,
  PlantInfo,
  EngineInfo,
  WMIResult,
  ModelYearResult,
  CheckDigitResult,
  PatternMatch,
  DecodeError,
  ValidationError,
  StructureError,
  LookupError,
  PatternError,
  DatabaseError,
  Position,
  DiagnosticInfo,
} from './types';

import { BodyStyle, ErrorCode, ErrorCategory, ErrorSeverity } from './enums';

// Logger
import { createLogger } from './logger';

const logger = createLogger('index');

/**
 * Configuration options for creating a VIN decoder
 */
export interface DecoderConfig {
  /**
   * Path to the VPIC database (optional - will use bundled database if not provided)
   */
  databasePath?: string;

  /**
   * Force fresh database setup (ignore cache)
   */
  forceFresh?: boolean;

  /**
   * Optional default decode options
   */
  defaultOptions?: DecodeOptions;

  /**
   * Runtime environment (automatic detection if not specified)
   */
  runtime?: 'node' | 'browser' | 'cloudflare';
}

/**
 * Create a VIN decoder with the appropriate adapter for the current environment
 *
 * @param config - Decoder configuration (optional)
 * @returns VIN decoder instance
 *
 * @example
 * ```typescript
 * import { createDecoder } from '@crdg/corgi';
 *
 * // Uses bundled database automatically
 * const decoder = await createDecoder();
 *
 * // Or with explicit options
 * const customDecoder = await createDecoder({
 *   databasePath: '/path/to/vpic.db',
 *   defaultOptions: {
 *     includePatternDetails: true
 *   }
 * });
 *
 * const result = await decoder.decode('1HGCM82633A123456');
 * ```
 */
export async function createDecoder(config: DecoderConfig = {}): Promise<VINDecoderWrapper> {
  const {
    databasePath,
    forceFresh = false,
    defaultOptions = {},
    runtime = detectRuntime(),
  } = config;

  // Get the appropriate database path (handles decompression if needed)
  const resolvedDbPath = await getDatabasePath({
    databasePath,
    forceFresh,
  });

  logger.debug({ runtime, databasePath: resolvedDbPath }, 'Creating VIN decoder');

  let adapter: DatabaseAdapter;

  // Create the appropriate adapter for the current environment
  if (runtime === 'browser') {
    const factory = new BrowserDatabaseAdapterFactory();
    adapter = await factory.createAdapter(resolvedDbPath);
  } else if (runtime === 'cloudflare') {
    // For Cloudflare, we need to have already initialized the D1 adapter
    if (!globalThis.__D1_FACTORY) {
      throw new Error('D1 adapter not initialized. Call initD1Adapter before creating a decoder.');
    }
    adapter = await globalThis.__D1_FACTORY(resolvedDbPath);
  } else {
    // Node.js adapter
    const factory = new NodeDatabaseAdapterFactory();
    adapter = await factory.createAdapter(resolvedDbPath);
  }

  return new VINDecoderWrapper(adapter, defaultOptions);
}

/**
 * Wrapper for VIN decoder with simplified API
 */
export class VINDecoderWrapper {
  private decoder: VINDecoder;
  private defaultOptions: DecodeOptions;

  /**
   * Create a new VIN decoder wrapper
   *
   * @param adapter - Database adapter
   * @param defaultOptions - Default decode options
   */
  constructor(adapter: DatabaseAdapter, defaultOptions: DecodeOptions = {}) {
    this.decoder = new VINDecoder(adapter);
    this.defaultOptions = defaultOptions;
  }

  /**
   * Decode a VIN
   *
   * @param vin - The VIN to decode
   * @param options - Optional decode options
   * @returns Decoded VIN information
   */
  decode(vin: string, options?: DecodeOptions): Promise<DecodeResult> {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    return this.decoder.decode(vin, mergedOptions);
  }

  /**
   * Close the decoder and release resources
   */
  async close(): Promise<void> {
    await this.decoder.close();
  }
}

// Singleton decoder instance
let sharedDecoderInstance: VINDecoderWrapper | null = null;

/**
 * Get or create the shared decoder instance with default configuration
 *
 * @param config - Optional configuration overrides
 * @returns Shared decoder instance
 *
 * @example
 * ```typescript
 * import { getDecoder } from '@crdg/corgi';
 *
 * // Uses default shared instance
 * const decoder = await getDecoder();
 * const result = await decoder.decode('1HGCM82633A123456');
 * ```
 */
export async function getDecoder(config: DecoderConfig = {}): Promise<VINDecoderWrapper> {
  if (sharedDecoderInstance === null) {
    sharedDecoderInstance = await createDecoder(config);
    logger.debug('Shared decoder instance created');
  }
  return sharedDecoderInstance;
}

/**
 * Convenient way to decode a VIN using the shared decoder instance
 *
 * @param vin - The VIN to decode
 * @param options - Optional decoding options
 * @returns The decode result
 *
 * @example
 * ```typescript
 * import { quickDecode } from '@crdg/corgi';
 *
 * // Simple one-line decoding
 * const result = await quickDecode('1HGCM82633A123456');
 * console.log(result.components.vehicle);
 * ```
 */
export async function quickDecode(vin: string, options: DecodeOptions = {}): Promise<DecodeResult> {
  const decoder = await getDecoder();
  return decoder.decode(vin, options);
}

/**
 * Decode a VIN using a provided database adapter
 * This is a lower-level function for advanced uses
 *
 * @param vin The VIN to decode
 * @param adapter The database adapter to use
 * @param options Optional decoding options
 * @returns The decode result
 *
 * @example
 * ```typescript
 * import { decodeVIN, NodeDatabaseAdapterFactory } from '@crdg/corgi';
 *
 * // Initialize the adapter
 * const factory = new NodeDatabaseAdapterFactory();
 * const adapter = await factory.createAdapter('/path/to/vpic.db');
 *
 * // Decode a VIN
 * const result = await decodeVIN('1HGCM82633A123456', adapter, {
 *   includePatternDetails: true
 * });
 * ```
 */
export async function decodeVIN(
  vin: string,
  adapter: DatabaseAdapter,
  options: DecodeOptions = {},
): Promise<DecodeResult> {
  return decodeVINCore(vin, adapter, options);
}

/**
 * Detect the current runtime environment
 *
 * @returns Runtime environment
 */
function detectRuntime(): 'node' | 'browser' | 'cloudflare' {
  // Check for Cloudflare Workers environment
  if (typeof globalThis.__D1_FACTORY !== 'undefined') {
    return 'cloudflare';
  }

  // Check for browser environment
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') {
    return 'browser';
  }

  // Default to Node.js
  return 'node';
}

// Initialize D1 adapter for Cloudflare environment
export function initD1Adapter(d1: any): void {
  globalThis.__D1_FACTORY = async () => createD1Adapter(d1);
}

// Declare global D1 factory
declare global {
  // eslint-disable-next-line no-var
  var __D1_FACTORY: ((db: string) => Promise<DatabaseAdapter>) | undefined;
}

// Export types
export type {
  DatabaseAdapter,
  QueryResult,
  DatabaseAdapterFactory,
  DecodeResult,
  DecodeOptions,
  VINComponents,
  VehicleInfo,
  PlantInfo,
  EngineInfo,
  WMIResult,
  ModelYearResult,
  CheckDigitResult,
  PatternMatch,
  DecodeError,
  ValidationError,
  StructureError,
  LookupError,
  PatternError,
  DatabaseError,
  Position,
  DiagnosticInfo,
};

// Export classes, enums and functions
export {
  ErrorCode,
  ErrorCategory,
  ErrorSeverity,
  BodyStyle,
  VINDecoder,
  BrowserDatabaseAdapter,
  BrowserDatabaseAdapterFactory,
  NodeDatabaseAdapter,
  NodeDatabaseAdapterFactory,
  CloudflareD1Adapter,
  createD1Adapter,
  createLogger,
  getDatabasePath,
};
