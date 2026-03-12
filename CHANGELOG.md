# @cardog/corgi

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
