# Vehicle Identity Standard

**Version 0.1.0 — Draft**

## Abstract

This specification defines a complete system for vehicle identification, extending ISO 3779 (VIN structure) with semantics, resolution, and exchange protocols. It provides the missing layer between the 17-character VIN string and meaningful vehicle data.

## Status

This is a working draft. See the [detailed documentation](./docs/) for full specifications.

---

## 1. Problem Statement

ISO 3779 defines VIN structure. ISO 3780 governs WMI assignment.

Neither standard defines **what the characters mean**.

Each manufacturer encodes different attributes in different positions using different schemes. This information exists in:
- NHTSA's vPIC database (US)
- National registries (RDW, Transport Canada, etc.)
- OEM technical documentation
- Proprietary databases

There is no standard for:
- How to represent these encodings
- How to resolve a VIN to vehicle data
- How to exchange vehicle data between systems

This specification fills that gap.

---

## 2. Goals

1. **Complete Ontology** — Define everything a vehicle IS, not just what VINs encode
2. **Universal Encoding Format** — Standard way to describe how VINs map to vehicle data
3. **Open Resolution** — Protocol for resolving VINs, like DNS for domain names
4. **Interoperable Exchange** — JSON-LD format compatible with Schema.org

## 3. Non-Goals

- Replacing ISO 3779/3780
- Vehicle history or title data
- Real-time telematics or connected vehicle protocols

---

## 4. Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                             │
│         Dealers, Insurance, DMV, Fleet, Marketplaces            │
├─────────────────────────────────────────────────────────────────┤
│                     EXCHANGE FORMAT                             │
│              Vehicle JSON-LD / Linked Data                      │
├─────────────────────────────────────────────────────────────────┤
│                   RESOLUTION PROTOCOL                           │
│              VIN → Vehicle Record Resolution                    │
├─────────────────────────────────────────────────────────────────┤
│                     VIN ENCODING                                │
│          Per-WMI Pattern Definitions & Mappings                 │
├─────────────────────────────────────────────────────────────────┤
│                   VEHICLE ONTOLOGY                              │
│             Complete Vehicle Data Model                         │
├─────────────────────────────────────────────────────────────────┤
│                    ISO 3779 / 3780                              │
│              VIN Structure, WMI Assignment                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Detailed Specifications

### 5.1 Standards Landscape

Analysis of existing standards (ISO, NHTSA vPIC, COVESA VSS, Schema.org, SAE) and identified gaps.

**See:** [docs/01-LANDSCAPE.md](./docs/01-LANDSCAPE.md)

### 5.2 Vehicle Ontology

Complete vehicle data model adopting Schema.org naming conventions (`camelCase`) with extensions for features, ADAS, connectivity, and EV-specific attributes.

**Key types:**
- `Vehicle` — Root type with identity, body, powertrain, weight, production, compliance
- `EngineSpecification` — ICE engine details (Schema.org)
- `MotorSpecification` — Electric motor details (extension)
- `BatterySpecification` — EV battery details (extension)
- `ADASFeatures` — ADAS capabilities aligned with SAE J3016
- `ConnectivityFeatures` — CarPlay, Android Auto, etc.
- `ComfortFeatures` — Heated seats, sunroof, etc.
- `SafetyFeatures` — Airbags, active safety systems

**See:** [docs/02-ONTOLOGY.md](./docs/02-ONTOLOGY.md)

### 5.3 VIN Encoding

Format for describing how manufacturers encode vehicle attributes into VIN positions.

**Key concepts:**
- **Encoding Document** — Per-WMI pattern definitions
- **Pattern matching** — Wildcards, ranges, character classes
- **Ontology paths** — Map patterns to vehicle attributes
- **Source attribution** — Track provenance and confidence

**See:** [docs/03-ENCODING.md](./docs/03-ENCODING.md)

### 5.4 Technical Architecture

Implementation details including binary index format, transform pipeline, and runtime decoder.

**Key concepts:**
- **Binary index** — O(log n) lookup, no SQLite
- **Transform pipeline** — NHTSA, RDW, community → unified format
- **Pattern matching** — Efficient wildcard matching
- **Type generation** — TypeScript types from ontology

**See:** [docs/04-ARCHITECTURE.md](./docs/04-ARCHITECTURE.md)

---

## 6. Conformance Levels

### Level 1: Basic

- Decode WMI (manufacturer, country)
- Extract model year from position 10
- Validate VIN format and check digit

### Level 2: Standard

- Decode all NHTSA vPIC attributes
- Pattern matching with wildcards
- Source attribution

### Level 3: Extended

- Multiple source federation
- Community pattern support
- Feature enrichment from variant data

### Level 4: Full

- Complete ontology compliance
- JSON-LD exchange format
- Resolution protocol support

---

## 7. References

### Normative

- ISO 3779:2009 — Road vehicles — Vehicle identification number (VIN)
- ISO 3780:2009 — Road vehicles — World manufacturer identifier (WMI)
- Schema.org Vehicle — https://schema.org/Vehicle
- JSON-LD 1.1 — https://www.w3.org/TR/json-ld11/

### Informative

- NHTSA vPIC — https://vpic.nhtsa.dot.gov/
- COVESA VSS — https://covesa.github.io/vehicle_signal_specification/
- SAE J3016 — Taxonomy for Automated Driving
- RDW Open Data — https://opendata.rdw.nl/

---

## Appendix A: Quick Reference

### VIN Structure (ISO 3779)

```
Position:  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 17
           ─────────  ───────────────  ────────────────────────
Section:      WMI           VDS                   VIS

WMI = World Manufacturer Identifier (positions 1-3)
VDS = Vehicle Descriptor Section (positions 4-9)
VIS = Vehicle Indicator Section (positions 10-17)

Position 9: Check digit (North America)
Position 10: Model year code
Position 11: Plant code
Positions 12-17: Production sequence
```

### Model Year Codes

```
A=2010  B=2011  C=2012  D=2013  E=2014  F=2015  G=2016  H=2017
J=2018  K=2019  L=2020  M=2021  N=2022  P=2023  R=2024  S=2025
T=2026  V=2027  W=2028  X=2029  Y=2030  1=2031  2=2032  ...
```

### JSON-LD Example

```json
{
  "@context": "https://vis.cardog.dev/context.jsonld",
  "@type": "Car",
  "vehicleIdentificationNumber": "5YJ3E1EA1PF123456",
  "brand": { "@type": "Brand", "name": "Tesla" },
  "model": "Model 3",
  "vehicleModelDate": "2023",
  "bodyType": "sedan",
  "powertrainType": "bev",
  "driveWheelConfiguration": "AllWheelDriveConfiguration"
}
```
