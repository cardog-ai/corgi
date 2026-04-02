/**
 * Corgi v3 - VIN Decoder
 *
 * Features:
 *   - Offline decoding via binary indexes (no SQLite)
 *   - O(log n) pattern lookup via binary search
 *   - Batch decoding support
 *   - Browser/Node/Edge runtime compatible
 *
 * Quick start:
 *   const decoder = await createDecoder('./dist');
 *   const result = decoder.decode('5YJ3E1EA1PF123456');
 */

export { VINDecoder, type DecoderOptions } from './decoder.js';
export { IndexReader, createIndexReader } from './index-reader.js';
export {
  matchPatterns,
  matchesPattern,
  calculateConfidence,
  deduplicateMatches,
} from './pattern-matcher.js';
export type {
  Lookup,
  WmiSchema,
  WmiMake,
  VehicleInfo,
  EngineInfo,
  PlantInfo,
  DecodeResult,
  PatternMatch,
  Warning,
  Error,
  IndexHeader,
  OffsetEntry,
} from './types.js';

import * as fs from 'fs';
import * as path from 'path';
import { VINDecoder, DecoderOptions } from './decoder.js';

/**
 * Create a decoder from index files on disk (Node.js)
 */
export async function createDecoder(
  indexDir: string,
  options?: DecoderOptions
): Promise<VINDecoder> {
  const [wmiSchema, wmiMake, patterns] = await Promise.all([
    fs.promises.readFile(path.join(indexDir, 'wmi-schema.idx')),
    fs.promises.readFile(path.join(indexDir, 'wmi-make.idx')),
    fs.promises.readFile(path.join(indexDir, 'patterns.idx')),
  ]);

  return new VINDecoder(
    new Uint8Array(wmiSchema),
    new Uint8Array(wmiMake),
    new Uint8Array(patterns),
    options
  );
}

/**
 * Create a decoder from pre-loaded buffers (Browser/Workers)
 */
export function createDecoderFromBuffers(
  wmiSchemaData: Uint8Array,
  wmiMakeData: Uint8Array,
  patternsData: Uint8Array,
  options?: DecoderOptions
): VINDecoder {
  return new VINDecoder(wmiSchemaData, wmiMakeData, patternsData, options);
}
