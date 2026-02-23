# Community VIN Pattern Schema

This document defines the YAML schema for contributing VIN patterns to corgi.

## Overview

Contributors write simple YAML files describing WMI codes and their VIN decoding patterns. A build tool transforms these into VPIC-compatible SQL that gets merged into the database.

## Directory Structure

```
community/
├── schema.md           # This file
├── wmi/
│   ├── tesla/
│   │   ├── LRW.yaml    # Tesla Shanghai
│   │   ├── XP7.yaml    # Tesla Berlin
│   │   └── 7SA.yaml    # Tesla Austin (supplement)
│   ├── byd/
│   │   └── LFV.yaml    # BYD China
│   └── ...
└── build/
    ├── generate.ts     # YAML → SQL generator
    └── validate.ts     # Schema validation
```

## YAML Schema

### Top-Level Fields

| Field | Required | Description |
|-------|----------|-------------|
| `wmi` | Yes | 3-character WMI code |
| `manufacturer` | Yes | Manufacturer name (must match existing or define new) |
| `make` | Yes | Make name (must match existing or define new) |
| `country` | Yes | Country name (must match existing) |
| `vehicle_type` | Yes | Vehicle type (Passenger Car, MPV, Truck, etc.) |
| `years` | Yes | Year range this schema applies to |
| `schema_name` | No | Custom schema name (auto-generated if omitted) |
| `patterns` | Yes | VIN decoding patterns |

### Pattern Positions

VIN positions 4-9 (VDS) are represented as a 6-character pattern:
- Position 4: Character 1 in pattern
- Position 5: Character 2 in pattern
- ...
- Position 9: Character 6 in pattern

Use `*` for wildcard (any character matches).

### Pattern Elements

Each pattern maps a position pattern to an element value:

```yaml
patterns:
  - pattern: "Y*****"    # Position 4 = Y
    element: Model
    value: "Model Y"

  - pattern: "*G****"    # Position 5 = G
    element: Body Class
    value: "Hatchback"
```

### Supported Elements

| Element | Description | Lookup Table |
|---------|-------------|--------------|
| `Model` | Vehicle model name | Model |
| `Body Class` | Body style | BodyStyle |
| `Doors` | Number of doors | (literal) |
| `Drive Type` | AWD, FWD, RWD | DriveType |
| `Fuel Type - Primary` | Electric, Gas, etc. | FuelType |
| `Electrification Level` | BEV, PHEV, HEV | ElectrificationLevel |
| `Transmission` | Auto, Manual | Transmission |
| `Plant City` | Assembly plant city | (literal) |
| `Plant Country` | Assembly country | Country |
| `Other Engine Info` | Motor configuration | (literal) |
| `Other Restraint System Info` | Restraint details | (literal) |

## Example: Tesla Shanghai (LRW)

See `wmi/tesla/LRW.yaml` for a complete example.
