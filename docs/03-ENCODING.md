# VIN Encoding Specification

## Overview

This document defines the format for describing how manufacturers encode vehicle attributes into VIN positions. It provides a standardized way to represent what NHTSA's vPIC does internally.

---

## Core Concepts

### VIN Structure (ISO 3779)

```
Position:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17
           ─────────  ───────────────  ────────────────────────
Section:      WMI           VDS                   VIS
           (1-3)         (4-9)               (10-17)

WMI = World Manufacturer Identifier
VDS = Vehicle Descriptor Section
VIS = Vehicle Indicator Section
```

**Position 9** is the check digit (North America only).
**Position 10** is the model year code.
**Position 11** is the plant code.
**Positions 12-17** are the production sequence number.

### Encoding Document

An **Encoding Document** describes how a specific manufacturer (identified by WMI) encodes vehicle attributes into VIN positions.

```yaml
wmi: "5YJ"                        # World Manufacturer Identifier
manufacturer: "Tesla, Inc."
region: "North America"
country: "US"
vehicleTypes: ["Passenger Car"]

patterns:
  - positions: "4-6"              # VDS positions
    path: "model"                 # Ontology path
    values:
      "E1E": "Model 3"
      "J3E": "Model Y"
      "S2E": "Model S"
      "X2E": "Model X"

  - positions: "7"
    path: "driveWheelConfiguration"
    values:
      "A": "RearWheelDriveConfiguration"
      "B": "AllWheelDriveConfiguration"
      "F": "AllWheelDriveConfiguration"    # Performance AWD

  - positions: "8"
    path: "battery.batteryCapacity"
    values:
      "A": { value: 82, unitCode: "KWH" }
      "B": { value: 100, unitCode: "KWH" }
      "F": { value: 60, unitCode: "KWH" }
```

---

## Pattern Definition

### Positions

Positions can be specified as:

| Format | Example | Meaning |
|--------|---------|---------|
| Single | `"4"` | Position 4 only |
| Range | `"4-6"` | Positions 4, 5, and 6 |
| Multiple | `"4,6,8"` | Positions 4, 6, and 8 |
| VDS | `"vds"` | Positions 4-9 |
| VIS | `"vis"` | Positions 10-17 |
| VIS suffix | `"vis:12-17"` | VIS positions 12-17 |

### Path

The `path` field specifies where in the ontology the decoded value should be placed.

```yaml
path: "model"                             # Top-level property
path: "vehicleEngine.engineDisplacement"  # Nested property
path: "battery.batteryCapacity"           # Component property
path: "adasFeatures.adaptiveCruiseControl"  # Feature boolean
```

### Values

Values can be:

**Simple mapping:**
```yaml
values:
  "ABC": "Camry"
  "DEF": "Corolla"
```

**Object mapping:**
```yaml
values:
  "A":
    value: 2.5
    unitCode: "LTR"
  "B":
    value: 3.5
    unitCode: "LTR"
```

**Multi-property mapping:**
```yaml
values:
  "A":
    model: "Camry"
    bodyType: "sedan"
  "B":
    model: "Camry"
    bodyType: "wagon"
```

---

## Pattern Matching

### Wildcards

| Character | Meaning |
|-----------|---------|
| `*` | Match any single character |
| `[A-Z]` | Match character range |
| `[ABC]` | Match character set |
| `[^ABC]` | Match any except set |

```yaml
patterns:
  - positions: "4-6"
    path: "model"
    values:
      "E1E": "Model 3"          # Exact match
      "E1*": "Model 3 Variant"  # Wildcard position 6
      "[EJ]1E": "Model 3/Y"     # E or J in position 4
```

### Priority & Weight

When multiple patterns match, priority is determined by:

1. **Specificity** — Exact matches beat wildcards
2. **Weight** — Explicit weight field
3. **Source** — Higher-priority sources win

```yaml
patterns:
  - positions: "4-6"
    path: "model"
    weight: 100                 # Higher = more authoritative
    values:
      "E1E": "Model 3"

  - positions: "4-6"
    path: "model"
    weight: 50                  # Fallback pattern
    values:
      "E**": "Model 3 Unknown Variant"
```

### Conditional Patterns

Patterns can depend on other positions:

```yaml
patterns:
  - positions: "7"
    path: "variant"
    when:
      positions: "4-6"
      equals: "E1E"             # Only when Model 3
    values:
      "A": "Standard Range Plus"
      "B": "Long Range"
      "P": "Performance"
```

---

## Model Year Encoding

Position 10 encodes the model year using a standard character mapping:

```yaml
modelYearCodes:
  "A": 2010
  "B": 2011
  "C": 2012
  "D": 2013
  "E": 2014
  "F": 2015
  "G": 2016
  "H": 2017
  "J": 2018    # I skipped (ISO 3779)
  "K": 2019
  "L": 2020
  "M": 2021
  "N": 2022
  "P": 2023    # O skipped (ISO 3779)
  "R": 2024    # Q skipped (ISO 3779)
  "S": 2025
  "T": 2026
  "V": 2027
  "W": 2028
  "X": 2029
  "Y": 2030
  "1": 2031
  "2": 2032
  "3": 2033
  "4": 2034
  "5": 2035
  "6": 2036
  "7": 2037
  "8": 2038
  "9": 2039
  # Cycle repeats after 2039
```

Note: Years before 2010 follow the same pattern but offset by 30 years. Implementation should handle the 30-year cycle.

---

## Plant Encoding

Position 11 identifies the manufacturing plant. Plant codes are manufacturer-specific:

```yaml
wmi: "5YJ"
plants:
  "F":
    name: "Fremont Factory"
    city: "Fremont"
    country: "US"
    coordinates: [37.4942, -121.9447]
  "A":
    name: "Gigafactory Shanghai"
    city: "Shanghai"
    country: "CN"
    coordinates: [31.0941, 121.7778]
  "B":
    name: "Gigafactory Berlin"
    city: "Grünheide"
    country: "DE"
    coordinates: [52.3936, 13.7886]
  "T":
    name: "Gigafactory Texas"
    city: "Austin"
    country: "US"
    coordinates: [30.2205, -97.6206]
```

---

## Complete Encoding Document Example

```yaml
# Tesla VIN Encoding Document
# Version: 1.0.0
# Last Updated: 2024-01-15
# Source: OEM technical documentation

meta:
  version: "1.0.0"
  updated: "2024-01-15"
  source: "oem"
  confidence: 0.99

wmi:
  - code: "5YJ"
    region: "North America"
    country: "US"
    vehicleTypes: ["Passenger Car"]
  - code: "7SA"
    region: "North America"
    country: "US"
    vehicleTypes: ["Multipurpose Passenger Vehicle"]
  - code: "LRW"
    region: "Asia"
    country: "CN"
    vehicleTypes: ["Passenger Car"]

manufacturer:
  name: "Tesla, Inc."
  brands: ["Tesla"]

patterns:
  # Model identification (positions 4-6)
  - positions: "4-6"
    path: "model"
    values:
      "E1E": "Model 3"
      "J3E": "Model Y"
      "S2E": "Model S"
      "X2E": "Model X"
      "R1W": "Roadster"
      "K3W": "Cybertruck"

  # Body type derivation
  - positions: "4-6"
    path: "bodyType"
    values:
      "E1E": "sedan"
      "J3E": "crossover"
      "S2E": "sedan"
      "X2E": "crossover"
      "K3W": "pickup"

  # Drive configuration (position 7)
  - positions: "7"
    path: "driveWheelConfiguration"
    values:
      "A": "RearWheelDriveConfiguration"
      "B": "AllWheelDriveConfiguration"
      "D": "AllWheelDriveConfiguration"
      "E": "AllWheelDriveConfiguration"
      "F": "AllWheelDriveConfiguration"
      "N": "AllWheelDriveConfiguration"
      "P": "AllWheelDriveConfiguration"

  # Battery / powertrain (position 8)
  - positions: "8"
    path: "battery.batteryCapacity"
    values:
      "A":
        value: 82
        unitCode: "KWH"
      "B":
        value: 100
        unitCode: "KWH"
      "C":
        value: 100
        unitCode: "KWH"
      "E":
        value: 100
        unitCode: "KWH"
      "F":
        value: 60
        unitCode: "KWH"
      "G":
        value: 75
        unitCode: "KWH"
      "H":
        value: 75
        unitCode: "KWH"

  # Variant names (combined positions)
  - positions: "7-8"
    path: "variant"
    when:
      positions: "4-6"
      equals: "E1E"
    values:
      "AA": "Standard Range Plus RWD"
      "AB": "Long Range AWD"
      "AF": "Standard Range RWD"
      "PA": "Performance"

  # Restraint system (position 5 - some manufacturers)
  - positions: "5"
    path: "safetyFeatures"
    values:
      "1":
        frontAirbags: true
        sideAirbags: true
        curtainAirbags: true
      "2":
        frontAirbags: true
        sideAirbags: true
        curtainAirbags: true
        kneeAirbags: true

  # Powertrain type (implicit for Tesla)
  - positions: "4"
    path: "powertrainType"
    values:
      "*": "bev"  # All Teslas are BEV

  - positions: "4"
    path: "fuelType"
    values:
      "*": "electric"

plants:
  "F":
    name: "Fremont Factory"
    city: "Fremont"
    country: "US"
  "A":
    name: "Gigafactory Shanghai"
    city: "Shanghai"
    country: "CN"
  "B":
    name: "Gigafactory Berlin"
    city: "Grünheide"
    country: "DE"
  "T":
    name: "Gigafactory Texas"
    city: "Austin"
    country: "US"

features:
  # Standard features for all vehicles from this manufacturer
  standard:
    adasFeatures:
      adaptiveCruiseControl: true
      automaticEmergencyBraking: true
      laneKeepAssist: true
      blindSpotMonitoring: true
      backupCamera: true
    connectivityFeatures:
      bluetooth: true
      wifiHotspot: true
      wirelessCharging: true
    infotainmentFeatures:
      touchscreen: true
      navigationSystem: true
      voiceControl: true
```

---

## Source Types

Encoding documents can come from multiple sources with different authority levels:

| Source | Authority | Example |
|--------|-----------|---------|
| `oem` | Highest | Manufacturer technical documentation |
| `nhtsa` | High | NHTSA vPIC database |
| `registry` | High | National registries (RDW, Transport Canada) |
| `community` | Medium | Community-contributed patterns |
| `inferred` | Low | Patterns inferred from data analysis |

```yaml
meta:
  source: "community"
  confidence: 0.85
  contributors:
    - "github:username"
  verified: false
```

---

## Validation Rules

Encoding documents MUST:

1. Include valid WMI code(s)
2. Reference only valid ontology paths
3. Use valid position specifications
4. Produce valid ontology values

Encoding documents SHOULD:

1. Include source metadata
2. Include version information
3. Include confidence scores for uncertain patterns
4. Document any manufacturer-specific deviations from ISO 3779

---

## File Naming Convention

```
{wmi}.yaml           # Primary WMI
{wmi}-{suffix}.yaml  # Variant (e.g., 5YJ-2024.yaml for year-specific patterns)
```

Multiple WMIs for the same manufacturer can be combined in one file if they share the same encoding logic.

---

## Directory Structure

```
encodings/
├── meta/
│   ├── model-years.yaml       # Global model year mapping
│   └── regions.yaml           # WMI region prefixes
├── nhtsa/                     # NHTSA-sourced patterns
│   ├── 1G1.yaml               # GM (Chevrolet)
│   ├── 5YJ.yaml               # Tesla
│   └── ...
├── registry/                  # National registry patterns
│   ├── rdw/                   # Netherlands RDW
│   └── tc/                    # Transport Canada
├── community/                 # Community contributions
│   └── byd/
│       └── LFV.yaml
└── oem/                       # OEM-provided (if available)
    └── ...
```
