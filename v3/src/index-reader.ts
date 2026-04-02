/**
 * Corgi v3 - Binary Index Reader
 * O(log n) lookup via binary search on sorted keys
 *
 * @see https://github.com/cardog-ai/vis-a-vin
 * @see spec/04-ARCHITECTURE.md - Binary index format specification
 *
 * Index format:
 *   Header (32 bytes): magic, version, counts, offsets
 *   Offset table: 16 bytes per key (key offset/length, value offset/length)
 *   Keys: null-terminated strings, sorted for binary search
 *   Values: msgpack-encoded data
 */

import * as msgpack from '@msgpack/msgpack';

const MAGIC = 0x434F5247; // 'CORG'

export interface IndexHeader {
  magic: number;
  version: number;
  keyCount: number;
  offsetTableOffset: number;
  offsetTableSize: number;
  keysOffset: number;
  keysLength: number;
  valuesOffset: number;
}

/**
 * Read-only index for fast key-value lookups
 * Uses binary search on sorted keys
 */
export class IndexReader<T> {
  private data: Uint8Array;
  private view: DataView;
  private header: IndexHeader;
  private decoder = new TextDecoder();

  constructor(data: Uint8Array) {
    this.data = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.header = this.readHeader();

    if (this.header.magic !== MAGIC) {
      throw new Error(`Invalid index magic: ${this.header.magic.toString(16)}`);
    }
  }

  private readHeader(): IndexHeader {
    return {
      magic: this.view.getUint32(0, true),
      version: this.view.getUint32(4, true),
      keyCount: this.view.getUint32(8, true),
      offsetTableOffset: this.view.getUint32(12, true),
      offsetTableSize: this.view.getUint32(16, true),
      keysOffset: this.view.getUint32(20, true),
      keysLength: this.view.getUint32(24, true),
      valuesOffset: this.view.getUint32(28, true),
    };
  }

  /** Get number of keys in the index */
  get size(): number {
    return this.header.keyCount;
  }

  /** Read offset table entry at index */
  private getOffsetEntry(index: number): {
    keyOffset: number;
    keyLength: number;
    valueOffset: number;
    valueLength: number;
  } {
    const base = this.header.offsetTableOffset + index * 16;
    return {
      keyOffset: this.view.getUint32(base, true),
      keyLength: this.view.getUint32(base + 4, true),
      valueOffset: this.view.getUint32(base + 8, true),
      valueLength: this.view.getUint32(base + 12, true),
    };
  }

  /** Read key at index */
  private getKey(index: number): string {
    const entry = this.getOffsetEntry(index);
    const start = this.header.keysOffset + entry.keyOffset;
    const keyBytes = this.data.subarray(start, start + entry.keyLength);
    return this.decoder.decode(keyBytes);
  }

  /** Read value at index */
  private getValue(index: number): T {
    const entry = this.getOffsetEntry(index);
    const start = this.header.valuesOffset + entry.valueOffset;
    const valueBytes = this.data.subarray(start, start + entry.valueLength);
    return msgpack.decode(valueBytes) as T;
  }

  /** Binary search for key, returns index or -1 */
  private binarySearch(key: string): number {
    let low = 0;
    let high = this.header.keyCount - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midKey = this.getKey(mid);
      const cmp = midKey.localeCompare(key);

      if (cmp < 0) {
        low = mid + 1;
      } else if (cmp > 0) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return -1;
  }

  /** Lookup value by key */
  get(key: string): T | undefined {
    const index = this.binarySearch(key);
    if (index < 0) return undefined;
    return this.getValue(index);
  }

  /** Check if key exists */
  has(key: string): boolean {
    return this.binarySearch(key) >= 0;
  }

  /** Get all keys (for debugging) */
  keys(): string[] {
    const keys: string[] = [];
    for (let i = 0; i < this.header.keyCount; i++) {
      keys.push(this.getKey(i));
    }
    return keys;
  }

  /** Find all keys with a given prefix */
  prefixSearch(prefix: string): Array<{ key: string; value: T }> {
    const results: Array<{ key: string; value: T }> = [];

    // Binary search for first key >= prefix
    let low = 0;
    let high = this.header.keyCount - 1;
    let start = this.header.keyCount;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midKey = this.getKey(mid);

      if (midKey >= prefix) {
        start = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Collect all matching keys
    for (let i = start; i < this.header.keyCount; i++) {
      const key = this.getKey(i);
      if (!key.startsWith(prefix)) break;
      results.push({ key, value: this.getValue(i) });
    }

    return results;
  }
}

/**
 * Create index reader from Buffer/Uint8Array
 */
export function createIndexReader<T>(data: Uint8Array | Buffer): IndexReader<T> {
  const uint8 = data instanceof Uint8Array ? data : new Uint8Array(data);
  return new IndexReader<T>(uint8);
}
