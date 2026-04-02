# Technical Architecture

## Overview

This document describes the technical implementation of the Vehicle Identity Standard, including data structures, transforms, and runtime architecture.

---

## Design Goals

1. **Offline-first** — Decode VINs without network access
2. **Zero dependencies** — No SQLite, no native modules
3. **Fast startup** — Sub-100ms cold start
4. **Small bundle** — <1MB for common use cases
5. **Universal runtime** — Browser, Node, Edge, Deno, Bun
6. **Source-aware** — Track provenance of every fact

---

## Data Architecture

### Current State (v2 / corgi)

```
┌─────────────────┐      ┌─────────────────┐
│   SQLite DB     │ ──── │  SQL Queries    │
│   (vpic.db)     │      │  at runtime     │
│   ~100MB        │      │                 │
└─────────────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Decoded Result │
└─────────────────┘
```

**Problems:**
- SQLite dependency (native bindings in Node, WASM in browser)
- Large file size
- Cold start overhead
- Complex relational queries at runtime

### Target State (v3)

```
┌─────────────────┐      ┌─────────────────┐
│  Encoding YAML  │      │   Variant DB    │
│  (per-WMI)      │      │   (optional)    │
└────────┬────────┘      └────────┬────────┘
         │                        │
         ▼                        │
┌─────────────────┐               │
│    Transform    │               │
│  (build time)   │               │
└────────┬────────┘               │
         │                        │
         ▼                        │
┌─────────────────┐               │
│  Binary Index   │               │
│  (patterns.idx) │               │
│  ~500KB         │               │
└────────┬────────┘               │
         │                        │
         ▼                        ▼
┌─────────────────────────────────────────┐
│              Runtime Decoder            │
│  - Binary search on sorted keys         │
│  - Zero-copy where possible             │
│  - Lazy loading                         │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Vehicle Record │
│  (Ontology)     │
└─────────────────┘
```

---

## Binary Index Format

### Goals

- O(log n) lookup by key
- Minimal parsing overhead
- Streaming decode (no full load required)
- Cross-platform (no endianness issues)

### Index Structure

```
┌──────────────────────────────────────────────────────────────┐
│ Header (32 bytes)                                            │
├──────────────────────────────────────────────────────────────┤
│ Magic:     "VIS1"            (4 bytes)                       │
│ Version:   1                 (2 bytes, big-endian)           │
│ Flags:     0x00              (2 bytes)                       │
│ Key Count: n                 (4 bytes, big-endian)           │
│ Strings Offset:              (4 bytes, big-endian)           │
│ Values Offset:               (4 bytes, big-endian)           │
│ Reserved:                    (12 bytes)                      │
├──────────────────────────────────────────────────────────────┤
│ Key Index (n * 8 bytes)                                      │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Key Hash:        (4 bytes) - FNV-1a hash of key         │  │
│ │ Value Offset:    (4 bytes) - Offset into values section │  │
│ └─────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│ String Table                                                 │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Length-prefixed strings, deduplicated                   │  │
│ │ Each: [length: u16] [bytes...]                          │  │
│ └─────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│ Values (MessagePack encoded)                                 │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ Array of Lookup records                                 │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Lookup Record

Each lookup is a pattern → value mapping:

```typescript
interface Lookup {
  pattern: string;      // VDS/VIS pattern with wildcards
  path: string;         // Ontology path (e.g., "model", "vehicleEngine.displacement")
  value: unknown;       // Resolved value (string, number, object)
  weight: number;       // Priority (higher = more authoritative)
  source: string;       // Source identifier
  positions?: number[]; // Which VIN positions this pattern covers
}
```

### Key Format

Keys are structured for efficient prefix lookup:

```
{wmi}:{vds_pattern}:{vis_pattern}
```

Examples:
```
5YJ:E1E***:********    → Model 3
5YJ:E1E*A*:********    → Model 3 RWD
5YJ:******:*F******    → Fremont plant
```

---

## Transform Pipeline

### Overview

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│   Source    │   │   Source    │   │   Source    │
│   NHTSA     │   │    RDW      │   │  Community  │
└──────┬──────┘   └──────┬──────┘   └──────┬──────┘
       │                 │                 │
       ▼                 ▼                 ▼
┌─────────────────────────────────────────────────┐
│              Source Adapters                    │
│  - Parse source format                          │
│  - Emit Encoding Documents                      │
└─────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│              Normalization                      │
│  - Validate against ontology                    │
│  - Normalize values                             │
│  - Resolve conflicts                            │
└─────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│              Index Builder                      │
│  - Sort keys                                    │
│  - Deduplicate strings                          │
│  - Serialize to binary                          │
└─────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│              Output Artifacts                   │
│  - patterns.idx (main index)                    │
│  - wmi.idx (WMI lookup)                         │
│  - plants.idx (plant codes)                     │
│  - manifest.json (metadata)                     │
└─────────────────────────────────────────────────┘
```

### Source Adapters

Each data source has an adapter that transforms its format into Encoding Documents:

#### NHTSA Adapter

```typescript
interface NHTSAAdapter {
  input: SQLiteDatabase;  // vpic.db

  // Transforms NHTSA's relational model:
  // - WMI → Manufacturer
  // - Pattern → Element → Lookup
  // - VehicleType, Make, Model relationships

  output: EncodingDocument[];
}
```

**Key transformations:**
- `Element.Name` → ontology path mapping
- Pattern position extraction
- Confidence scoring based on source reliability

#### RDW Adapter

```typescript
interface RDWAdapter {
  input: CSVFile | APIResponse;

  // Netherlands vehicle registration data
  // Contains EU-specific attributes

  output: EncodingDocument[];
}
```

#### Community Adapter

```typescript
interface CommunityAdapter {
  input: YAMLFile;  // Already in encoding format

  // Validate and normalize
  // Lower confidence scores

  output: EncodingDocument[];
}
```

### Conflict Resolution

When multiple sources provide values for the same pattern:

1. **Source priority**: `oem` > `nhtsa` > `registry` > `community` > `inferred`
2. **Specificity**: Exact patterns beat wildcards
3. **Weight**: Explicit weight field
4. **Recency**: Newer sources preferred (for updates)

```typescript
function resolveConflict(a: Lookup, b: Lookup): Lookup {
  // Compare by source priority
  if (SOURCE_PRIORITY[a.source] !== SOURCE_PRIORITY[b.source]) {
    return SOURCE_PRIORITY[a.source] > SOURCE_PRIORITY[b.source] ? a : b;
  }

  // Compare by specificity (fewer wildcards = more specific)
  const aWildcards = countWildcards(a.pattern);
  const bWildcards = countWildcards(b.pattern);
  if (aWildcards !== bWildcards) {
    return aWildcards < bWildcards ? a : b;
  }

  // Compare by weight
  return a.weight >= b.weight ? a : b;
}
```

---

## Runtime Architecture

### Decoder

```typescript
class VINDecoder {
  private wmiIndex: Index;
  private patternIndex: Index;
  private plantIndex: Index;

  decode(vin: string): VehicleRecord {
    // 1. Validate VIN format
    const validation = this.validate(vin);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    // 2. Extract components
    const components = {
      wmi: vin.slice(0, 3),
      vds: vin.slice(3, 9),
      vis: vin.slice(9, 17),
      checkDigit: vin[8],
      modelYear: decodeModelYear(vin[9]),
      plantCode: vin[10],
      sequence: vin.slice(11, 17),
    };

    // 3. Lookup WMI
    const wmiInfo = this.wmiIndex.get(components.wmi);

    // 4. Match patterns
    const matches = this.patternIndex.match(
      components.wmi,
      components.vds,
      components.vis
    );

    // 5. Deduplicate and merge
    const vehicle = this.mergeMatches(matches);

    // 6. Resolve plant
    vehicle.productionPlant = this.plantIndex.get(
      components.wmi,
      components.plantCode
    );

    return {
      valid: true,
      vin,
      components,
      vehicle,
      sources: this.collectSources(matches),
    };
  }
}
```

### Index Reader

Binary search on sorted keys:

```typescript
class Index {
  private buffer: ArrayBuffer;
  private view: DataView;
  private keyCount: number;
  private stringsOffset: number;
  private valuesOffset: number;

  constructor(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.view = new DataView(buffer);

    // Parse header
    const magic = this.readString(0, 4);
    if (magic !== 'VIS1') throw new Error('Invalid index');

    this.keyCount = this.view.getUint32(8, false);
    this.stringsOffset = this.view.getUint32(12, false);
    this.valuesOffset = this.view.getUint32(16, false);
  }

  get(key: string): Lookup[] {
    const hash = fnv1a(key);
    const index = this.binarySearch(hash);
    if (index < 0) return [];

    const valueOffset = this.view.getUint32(32 + index * 8 + 4, false);
    return this.decodeValue(valueOffset);
  }

  private binarySearch(hash: number): number {
    let low = 0;
    let high = this.keyCount - 1;

    while (low <= high) {
      const mid = (low + high) >>> 1;
      const midHash = this.view.getUint32(32 + mid * 8, false);

      if (midHash < hash) {
        low = mid + 1;
      } else if (midHash > hash) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return -1;
  }
}
```

### Pattern Matching

```typescript
function matchPattern(input: string, pattern: string): boolean {
  if (input.length !== pattern.length) return false;

  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i];
    const c = input[i];

    if (p === '*') continue;  // Wildcard matches anything

    if (p === '[') {
      // Character class: [A-Z] or [ABC]
      const end = pattern.indexOf(']', i);
      const class = pattern.slice(i + 1, end);
      if (!matchCharClass(c, class)) return false;
      i = end;
      continue;
    }

    if (p !== c) return false;
  }

  return true;
}

function matchCharClass(char: string, class: string): boolean {
  if (class[0] === '^') {
    // Negation
    return !matchCharClass(char, class.slice(1));
  }

  for (let i = 0; i < class.length; i++) {
    if (class[i + 1] === '-' && class[i + 2]) {
      // Range: A-Z
      if (char >= class[i] && char <= class[i + 2]) return true;
      i += 2;
    } else {
      // Single character
      if (char === class[i]) return true;
    }
  }

  return false;
}
```

---

## Data Sources

### NHTSA vPIC

**Source:** https://vpic.nhtsa.dot.gov/
**Format:** SQLite database (downloadable) or REST API
**Coverage:** US-market vehicles
**Update frequency:** Monthly

**Tables used:**
- `WMI` — WMI to manufacturer mapping
- `Pattern` — VDS/VIS patterns
- `Element` — Attribute definitions
- `Lookup` — Pattern → value mappings
- `VehicleType`, `Make`, `Model` — Reference data

### RDW (Netherlands)

**Source:** https://opendata.rdw.nl/
**Format:** CSV, API
**Coverage:** EU-market vehicles registered in Netherlands
**Update frequency:** Daily

**Datasets:**
- Gekentekende voertuigen (registered vehicles)
- Voertuigtypen (vehicle types)
- Brandstof (fuel data)

### Transport Canada

**Source:** https://tc.canada.ca/
**Format:** CSV
**Coverage:** Canadian-market vehicles
**Update frequency:** Periodic

### Community Patterns

**Source:** `community/` directory
**Format:** YAML (Encoding Document format)
**Coverage:** Varies (Tesla, BYD, etc.)
**Update frequency:** Pull request based

---

## Variant Enrichment (Future)

The core decoder provides identity + basic attributes from VIN patterns. Variant enrichment adds detailed features from the variant database.

```
┌─────────────────┐
│   VIN Decode    │  → Make, Model, Year, Engine (from patterns)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Variant Lookup  │  → Detailed features (from variant DB)
│ (optional)      │     - ADAS features
└────────┬────────┘     - Connectivity
         │              - Comfort
         ▼              - Safety
┌─────────────────┐
│ Complete Record │
└─────────────────┘
```

### Variant Matching Strategy

Current problem: Trim strings don't match across sources.

Solution: Match by powertrain signature, not trim name.

```typescript
interface PowertrainSignature {
  engine?: {
    displacement: number;  // ±0.1L tolerance
    cylinders: number;
    fuel: string;
  };
  motor?: {
    power: number;  // ±5kW tolerance
  };
  transmission: string;
  drivetrain: string;
}

function matchVariant(
  decoded: VehicleRecord,
  variants: Variant[]
): Variant | null {
  const signature = extractSignature(decoded);

  return variants.find(v =>
    signatureMatches(signature, extractSignature(v))
  );
}
```

### Variant Data Normalization

The variant database has 3 different schemas (US, CA, EU). Each needs a transform:

```typescript
// US: Values encoded in keys
// "12.3\" infotainment display size": true
// → displaySize: 12.3

// CA: Structured categories
// { Infotainment: { "Navigation System": true } }
// → infotainmentFeatures: { navigationSystem: true }

// EU: Flat mechanical specs
// { horsepower: 150, displacement: 2.0 }
// → vehicleEngine: { enginePower: 150, engineDisplacement: 2.0 }
```

---

## Bundle Sizes

Target bundle sizes for different use cases:

| Use Case | Contents | Size |
|----------|----------|------|
| Minimal | WMI lookup only | ~50KB |
| Standard | Common makes (top 50) | ~300KB |
| Full | All NHTSA patterns | ~1MB |
| Extended | + Community + RDW | ~1.5MB |

Lazy loading by WMI prefix:

```typescript
// Load only what's needed
const decoder = await createDecoder({
  lazyLoad: true,
  preload: ['5YJ', '1G1', 'WVG'],  // Tesla, GM, VW
});
```

---

## TypeScript Type Generation

Generate TypeScript types from ontology:

```typescript
// Generated from ontology
export type Make =
  | 'Acura' | 'Alfa Romeo' | 'Aston Martin' | 'Audi'
  | 'Bentley' | 'BMW' | 'Buick' | 'BYD'
  | 'Cadillac' | 'Chevrolet' | 'Chrysler' | 'Citroën'
  // ... etc

export type BodyType =
  | 'sedan' | 'coupe' | 'hatchback' | 'wagon'
  | 'suv' | 'crossover' | 'pickup' | 'van'
  | 'minivan' | 'convertible' | 'roadster'
  // ... etc

export type DriveWheelConfiguration =
  | 'FrontWheelDriveConfiguration'
  | 'RearWheelDriveConfiguration'
  | 'AllWheelDriveConfiguration'
  | 'FourWheelDriveConfiguration';

export interface VehicleRecord {
  vehicleIdentificationNumber: string;
  manufacturer?: string;
  brand?: Make;
  model?: string;
  vehicleModelDate?: number;
  bodyType?: BodyType;
  driveWheelConfiguration?: DriveWheelConfiguration;
  // ... etc
}
```

---

## Testing Strategy

### Unit Tests

- Pattern matching logic
- Index reader
- Validation functions
- Type conversions

### Integration Tests

- Full decode pipeline
- Known VIN → expected output
- Round-trip: encode → decode

### Conformance Tests

- Ontology validation
- Schema compliance
- JSON-LD context validation

### Regression Tests

- Golden file comparisons
- vPIC API comparison
- Before/after transform validation
