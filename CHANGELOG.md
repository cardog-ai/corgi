# @cardog/corgi

## 2.0.0

### Major Changes

**BREAKING CHANGES:**
- Replaced `better-sqlite3` with custom native C++ SQLite binding
- Requires node-gyp and native build tools for installation (see README for platform-specific requirements)
- Minimum Node.js version increased to 18.0.0
- Package now requires compilation during installation

### Added

- **Native C++ SQLite Binding**: Custom read-only SQLite binding for Node.js, providing better cross-platform compatibility and removing dependency on better-sqlite3
- **Node.js 23+ Support**: Fixed compatibility with Node.js 23 and future versions (resolves issue #19)
- **Improved Type Exports**: Enums now properly exported for better TypeScript developer experience (PR #11)
  - `BodyStyle`, `ErrorCode`, `ErrorCategory`, `ErrorSeverity` now exported as enums
  - Better IntelliSense and type safety for library consumers
- **Enhanced Body Style Mappings** (PR #11):
  - `Truck-Tractor` properly mapped to TRACTOR
  - `Sport Utility Truck (SUT)` mapped to TRUCK
  - `Incomplete - Bus/Trailer Chassis` variants properly categorized
- **VIN 10th Digit '0' Handling**: VINs with '0' in position 10 (used by some non-US countries) now decode with a warning instead of failing (issue #14)

### Changed

- Removed `better-sqlite3` dependency entirely
- Database operations are synchronous at the native level (async API preserved at TypeScript level)
- Build process now includes native compilation step (`pnpm build:native`)
- Installation requires native build tools (Python, C++ compiler, node-gyp)

### Fixed

- Node.js 23 compatibility issue caused by better-sqlite3 prebuilt binaries
- VIN decoding for international vehicles that don't encode model year
- Type export structure for better DX

### Migration Guide

**Requirements:**
- Node.js 18.0.0 or higher
- Python 3.x
- C++ build tools (platform-specific)

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt-get install build-essential python3 libsqlite3-dev
```

**Windows:**
- Install Visual Studio Build Tools or Visual Studio with C++ support

**Installation:**
```bash
npm install @cardog/corgi@2
# or
pnpm add @cardog/corgi@2
```

The native module will build automatically during installation. The public API remains backward compatible - no code changes required for most users.

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
