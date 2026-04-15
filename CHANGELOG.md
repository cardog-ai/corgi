# @cardog/corgi

## 3.0.0-alpha.1

### Major Changes

- **Complete architecture rewrite** - Binary indexes replace SQLite (#21)
  - O(log n) lookup via sorted keys + binary search
  - MessagePack-encoded values for compact storage
  - No more SQLite dependency
  
- **Performance**
  - 3,300+ decodes/sec (single thread)
  - 23ms cold start
  - 93.6% success rate on 1,100 VIN benchmark
  
- **Size**
  - 63MB raw indexes
  - 6.5MB npm package (compressed)
  - 3.1MB with brotli (CDN delivery)

### Credits

Inspired by [corgi-rs](https://github.com/wonderooo/corgi-rs) by [@wonderooo](https://github.com/wonderooo).

### Breaking Changes

- Removed SQLite dependency - no more `better-sqlite3` or `sql.js`
- New `createDecoder()` API replaces direct import
- Types restructured (v2 types in `_v2/` for reference)

## 2.0.3

### Patch Changes

- Update vPIC database to March 2026 snapshot
- Note: Transmission data for Toyota RAV4 2021+ requires VehicleSpecSchema tables (not yet supported)

## 2.0.2

### Patch Changes

- Fix Element name mismatches causing missing transmission and engine power data (#27)
  - `'Transmission'` → `'Transmission Style'`
  - `'Engine Power (KW)'` → `'Engine Power (kW)'`
- Add element-names.test.ts to validate Element names against NHTSA vPIC database
- Update vpic-pipeline Element allowlist to match actual NHTSA Element.Name values

## 2.0.0

### Major Changes

- Community VIN Patterns - A new way to extend corgi's VIN decoding capabilities
  - Add community pattern system for WMIs not in VPIC database
  - Include Tesla international patterns (LRW - China, XP7 - Berlin)
  - Build pipeline: validate, apply, and generate community patterns
  - Full contribution guide and schema documentation
  - Patterns are applied at build time, merged into the published database

## 1.4.1

### Patch Changes

- - Fix F-150/F-550 misidentification (issue #22) - improved VIN coherence scoring with three-tier pattern matching that prioritizes schemas with more matching patterns
  - Update VPIC database to February 2026 snapshot

## 1.3.0

### Minor Changes

- - Update VPIC database to December 2025 (latest). Database now includes all vehicle data through December 2025, ensuring accurate VIN decoding for 2025+ model year vehicles and the latest manufacturer information.
  - Fix browser export path in package.json - properly expose `@cardog/corgi/browser` entry point for client-side VIN decoding
  - Merge community PR contributions
- Enhanced README with pixel art corgi logo and improved documentation structure. Added comprehensive metadata, badges, and professional community-focused sections emphasizing performance and open-source nature.
- Fixed GVWR Table join issue
- Fixed bug with DB path resolution in flat /dist directory. Added CI script for testing core decoding.

## 1.2.2

### Minor Changes

- Enhanced README with pixel art corgi logo and improved documentation structure. Added comprehensive metadata, badges, and professional community-focused sections emphasizing performance and open-source nature.
- Fixed GVWR Table join issue
- Fixed bug with DB path resolution in flat /dist directory. Added CI script for testing core decoding.

## 1.2.1

### Patch Changes

- Fixed issue with JSON output in CLI

## 1.2.0

### Minor Changes

- Enhanced README with pixel art corgi logo and improved documentation structure. Added comprehensive metadata, badges, and professional community-focused sections emphasizing performance and open-source nature.
- Fixed GVWR Table join issue
- Fixed bug with DB path resolution in flat /dist directory. Added CI script for testing core decoding.
