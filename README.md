# Corgi VIN Decoder

<div align="center">
  <img src="./corgi.png" alt="Corgi - Fast VIN Decoder" width="200" height="200">
</div>

Fast, offline VIN decoding for Node.js, browsers, and Cloudflare Workers. Powered by the NHTSA VPIC database.

[![npm version](https://badge.fury.io/js/%40cardog%2Fcorgi.svg)](https://badge.fury.io/js/%40cardog%2Fcorgi)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

## Installation

```bash
npm install @cardog/corgi
```

## Quick Start

```typescript
import { createDecoder } from "@cardog/corgi";

const decoder = await createDecoder();
const result = await decoder.decode("KM8K2CAB4PU001140");

console.log(result.components.vehicle);
// { make: 'Hyundai', model: 'Kona', year: 2023, ... }

await decoder.close();
```

## Platform Support

### Node.js

```typescript
import { createDecoder } from "@cardog/corgi";

const decoder = await createDecoder();
const result = await decoder.decode("1HGCM82633A123456");

// Custom database path
const decoder = await createDecoder({
  databasePath: "/path/to/vpic.lite.db",
});
```

### Browser

```typescript
import { createDecoder } from "@cardog/corgi/browser";

const decoder = await createDecoder({
  databasePath: "https://corgi.cardog.io/vpic.lite.db.gz",
  runtime: "browser",
});
```

### Cloudflare Workers (D1)

```typescript
import { createDecoder, initD1Adapter } from "@cardog/corgi";

initD1Adapter(env.D1_DATABASE);

const decoder = await createDecoder({
  databasePath: "D1",
  runtime: "cloudflare",
});
```

## Configuration

```typescript
const decoder = await createDecoder({
  databasePath: "./custom/path.db",
  forceFresh: true,
  defaultOptions: {
    includePatternDetails: true,
    includeRawData: false,
    confidenceThreshold: 0.8,
    includeDiagnostics: true,
  },
});

// Per-decode options
const result = await decoder.decode("VIN12345678901234", {
  modelYear: 2024,
  includePatternDetails: true,
});
```

## Response Structure

```typescript
interface DecodeResult {
  vin: string;
  valid: boolean;

  components: {
    vehicle?: {
      make: string;
      model: string;
      year: number;
      series?: string;
      bodyStyle?: string;
      driveType?: string;
      fuelType?: string;
      doors?: string;
    };
    wmi?: {
      manufacturer: string;
      make: string;
      country: string;
      region: string;
    };
    plant?: {
      country: string;
      city?: string;
      code: string;
    };
    engine?: {
      model?: string;
      cylinders?: string;
      displacement?: string;
      fuel?: string;
    };
    modelYear?: {
      year: number;
      source: string;
      confidence: number;
    };
    checkDigit?: {
      isValid: boolean;
      expected?: string;
      actual: string;
    };
  };

  errors: DecodeError[];
  metadata?: DiagnosticInfo;
  patterns?: PatternMatch[];
}
```

## Error Handling

```typescript
import { ErrorCode } from "@cardog/corgi";

const result = await decoder.decode("INVALID_VIN");

if (!result.valid) {
  result.errors.forEach((error) => {
    switch (error.code) {
      case ErrorCode.INVALID_CHECK_DIGIT:
      case ErrorCode.INVALID_LENGTH:
      case ErrorCode.WMI_NOT_FOUND:
        console.log(error.message);
    }
  });
}
```

## CLI

```bash
npx @cardog/corgi decode 1HGCM82633A123456
npx @cardog/corgi decode 1HGCM82633A123456 --patterns --format json
npx @cardog/corgi --help
```

---

## Architecture

### VIN Structure

A Vehicle Identification Number (VIN) is a 17-character identifier assigned to every vehicle manufactured for road use. The structure is defined by ISO 3779 and follows this format:

```
Position:  1-3    4-8      9       10      11      12-17
           WMI    VDS      Check   Year    Plant   VIS
           │      │        │       │       │       │
           │      │        │       │       │       └─ Sequential production number
           │      │        │       │       └───────── Assembly plant code
           │      │        │       └─────────────── Model year (A-Y, 1-9, excluding I,O,Q,U,Z,0)
           │      │        └─────────────────────── Check digit (0-9, X)
           │      └──────────────────────────────── Vehicle attributes (model, body, engine, etc.)
           └─────────────────────────────────────── World Manufacturer Identifier
```

**WMI (Positions 1-3)**: Identifies the manufacturer. First character indicates country/region, second indicates manufacturer, third indicates vehicle type or manufacturing division.

**VDS (Positions 4-8)**: Vehicle Descriptor Section. Manufacturer-defined attributes including model, body style, engine type, and restraint system.

**Check Digit (Position 9)**: Validates VIN integrity using a weighted algorithm. Required for all vehicles sold in North America.

**Model Year (Position 10)**: Encodes the model year. Uses letters A-Y (excluding I, O, Q, U, Z) and digits 1-9 in a 30-year cycle.

**Plant Code (Position 11)**: Identifies the assembly plant. Manufacturer-specific encoding.

**VIS (Positions 12-17)**: Vehicle Identifier Section. Sequential production number unique within the model year and plant.

### Check Digit Algorithm

The check digit (position 9) is calculated by:

1. Assigning each character a value (A=1, B=2, ..., N=5, P=7, ..., 0-9 = face value)
2. Multiplying each position by a weight: `[8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2]`
3. Summing all products and taking modulo 11
4. Result 10 = 'X', otherwise the digit itself

### Model Year Decoding

Per 49 CFR 565.15, model year codes cycle every 30 years:

| Code | Years |
|------|-------|
| A | 1980, 2010 |
| B | 1981, 2011 |
| ... | ... |
| X | 1999, 2029 |
| Y | 2000, 2030 |
| 1 | 2001, 2031 |
| ... | ... |
| 9 | 2009, 2039 |

Characters I, O, Q are excluded from all VIN positions. U, Z, and 0 are additionally excluded from position 10.

---

## Database

### VPIC Lite

Corgi uses an optimized subset of the NHTSA vPIC (Vehicle Product Information Catalog) database. The database is compressed and bundled with the package for offline operation.

**Specifications:**
- Source: NHTSA VPIC
- Format: SQLite (optimized)
- Compressed: ~20MB (gzip)
- Uncompressed: ~40MB
- Updates: Monthly via automated pipeline

### Hosted Database

Cardog maintains a public CDN with the latest VPIC database builds:

**Base URL:** `https://corgi.cardog.io`

| File | Description |
|------|-------------|
| `vpic.lite.db.gz` | Database (gzip) |
| `vpic.lite.db.bz2` | Database (bzip2) |
| `vpic.lite.db.xz` | Database (xz) |
| `vpic.lite.db.zst` | Database (zstd) |
| `vpic.lite.json` | Metadata (version, checksums, record counts) |
| `vpic.lite.sha256` | SHA256 checksums |

Dated archives are also available: `vpic_lite_YYYYMMDD.db.gz`

### Local Cache

- **Node.js**: `~/.corgi-cache/vpic.lite.db`
- **Browser**: Loaded from provided URL
- **Cloudflare**: Managed by D1

```typescript
import { getDatabasePath } from "@cardog/corgi";

const dbPath = await getDatabasePath();
const decoder = await createDecoder({ forceFresh: true }); // Force refresh
```

---

## Exports

```typescript
// Core
import { createDecoder, quickDecode, getDatabasePath } from "@cardog/corgi";

// Types
import type { DecodeResult, DecodeOptions, DecoderConfig } from "@cardog/corgi";

// Enums
import { ErrorCode, ErrorCategory, BodyStyle } from "@cardog/corgi";

// Adapters
import { initD1Adapter } from "@cardog/corgi/d1-adapter";
import { createDecoder } from "@cardog/corgi/browser";
```

---

## License

ISC License - see [LICENSE](LICENSE) for details.
