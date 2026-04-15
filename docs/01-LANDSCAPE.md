# Vehicle Identity Standards Landscape

## Overview

This document surveys existing standards, ontologies, and specifications relevant to vehicle identification and data exchange. It identifies gaps that the Vehicle Identity Standard (VIS) aims to fill.

---

## The Core Problem

**ISO 3779** defines the 17-character VIN structure. **ISO 3780** governs WMI assignment.

Neither standard defines **what the characters mean**.

Each manufacturer encodes different attributes in different positions using different schemes. This information exists in fragmented sources with no interoperability standard.

---

## Existing Standards

### ISO 3779 / 3780 — VIN Structure

| Aspect | Coverage |
|--------|----------|
| VIN format | 17 characters, 3 sections (WMI, VDS, VIS) |
| Character set | Alphanumeric excluding I, O, Q |
| Check digit | Position 9 (North America) |
| WMI assignment | Via national bodies |
| **Semantics** | NOT DEFINED |
| **Resolution** | NOT DEFINED |

**Gap:** Structure without meaning. The standard says position 4-8 is "Vehicle Descriptor Section" but not what it describes.

---

### NHTSA vPIC — De Facto US Standard

| Aspect | Coverage |
|--------|----------|
| VIN decoding | Yes, ~120 attributes |
| API | REST, returns XML/JSON |
| Coverage | US-market vehicles primarily |
| Pattern data | Internal, not standardized |
| **Formal spec** | NO |
| **International** | NO |

**Gap:** Proprietary implementation, US-centric, no published specification for data format or pattern encoding.

---

### COVESA Vehicle Signal Specification (VSS)

| Aspect | Coverage |
|--------|----------|
| Scope | Vehicle signals and telemetry |
| Format | YAML-based tree structure |
| Adoption | BMW, Volvo, JLR, Bosch, AWS FleetWise |
| Version | 6.0 |
| **Vehicle identity** | ASSUMES KNOWN |
| **VIN resolution** | NO |

**Gap:** Excellent for signals/telemetry AFTER vehicle is identified. Does not address identification itself.

**Relevant patterns:**
- Hierarchical tree organization
- YAML/JSON specification format
- Layered overlays (base + vendor extensions)

---

### COVESA VISS — Vehicle Information Service Specification

| Aspect | Coverage |
|--------|----------|
| Scope | Access protocol for VSS data |
| Transports | HTTPS, MQTT, WebSocket |
| Access control | Consent framework |
| **Vehicle identity** | ASSUMES KNOWN |

**Gap:** Access protocol without identity layer.

---

### Schema.org Vehicle

| Aspect | Coverage |
|--------|----------|
| Scope | Web vocabulary for vehicle markup |
| Format | JSON-LD, RDFa, Microdata |
| Types | Vehicle, Car, Motorcycle, BusOrCoach, MotorizedBicycle |
| Properties | ~40 vehicle-specific properties |
| **VIN semantics** | NO |
| **Resolution** | NO |

**Key properties defined:**
```
vehicleIdentificationNumber
vehicleEngine → EngineSpecification
vehicleTransmission
driveWheelConfiguration  (enumerated: FWD, RWD, AWD, 4WD)
bodyType
fuelType
numberOfDoors
seatingCapacity
wheelbase
engineDisplacement
enginePower
torque
emissionsCO2
productionDate
```

**Naming convention:** camelCase

**Gap:** Web markup vocabulary, not a resolution or encoding standard. Good foundation for attribute names.

---

### W3C AUTO Ontology

| Aspect | Coverage |
|--------|----------|
| Scope | OWL ontology for automotive concepts |
| Format | OWL/RDF |
| Base | Extends Schema.org |
| **Adoption** | Limited |

**Gap:** Semantic foundation but not practical implementation.

---

### VSSo — Vehicle Signal Specification Ontology

| Aspect | Coverage |
|--------|----------|
| Scope | RDF/OWL representation of VSS |
| Format | Turtle, JSON-LD |
| Integration | SSN/SOSA for observations |

**Relevant patterns:**
- Static attributes vs dynamic signals
- Observation/measurement patterns

---

### SAE Standards

| Standard | Scope | Relevance |
|----------|-------|-----------|
| J1939 | CAN bus protocol (heavy-duty) | Communication, not identity |
| J2735 | V2X message dictionary | Communication, not identity |
| J3016 | Autonomous driving taxonomy (L0-L5) | Feature naming reference |

**Gap:** Communication protocols, not vehicle identification.

---

### Vehicle Sales Ontology (VSO) / GoodRelations

| Aspect | Coverage |
|--------|----------|
| Scope | E-commerce vehicle listings |
| Used by | Volkswagen, automotive retailers |
| Extends | Schema.org |

**Relevant patterns:**
- Variant modeling (`isVariantOf`)
- Make/model relationships

---

### EU Data Act / VDLF

| Aspect | Status |
|--------|--------|
| Scope | Vehicle data standardization |
| Timeline | Full applicability Sept 2025 |
| **Specification** | Not yet published |

**Gap:** Regulatory mandate without published technical standard yet.

---

## Gap Analysis

| Need | ISO 3779 | vPIC | VSS | Schema.org | VIS (Ours) |
|------|----------|------|-----|------------|------------|
| VIN structure | Yes | - | - | - | Adopts |
| VIN semantics | No | Internal | - | - | **Yes** |
| Pattern encoding | No | Internal | - | - | **Yes** |
| Resolution protocol | No | Proprietary | - | - | **Yes** |
| Attribute vocabulary | No | Ad-hoc | Signals | Partial | **Yes** |
| Features ontology | No | Limited | - | No | **Yes** |
| JSON-LD compatible | - | No | No | Yes | **Yes** |
| International | Yes | No | Yes | Yes | **Yes** |

---

## Strategic Position

```
┌─────────────────────────────────────────────────────────────────┐
│                        APPLICATIONS                             │
│         Dealers, Insurance, DMV, Fleet, Marketplaces            │
├─────────────────────────────────────────────────────────────────┤
│                     VISS / Access Protocol                      │
│                   (How to get data)                             │
├─────────────────────────────────────────────────────────────────┤
│                VEHICLE IDENTITY STANDARD                        │  ← WE ARE HERE
│         VIN Resolution + Attribute Vocabulary                   │
├─────────────────────────────────────────────────────────────────┤
│                     VSS / Schema.org                            │
│              (Signal definitions, web vocab)                    │
├─────────────────────────────────────────────────────────────────┤
│                    ISO 3779 / 3780                              │
│              (VIN Structure, WMI Assignment)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Design Principles (Derived from Research)

1. **Adopt Schema.org naming** — Use `vehicleEngine` not `vehicle_engine`
2. **Extend, don't replace** — Build on ISO 3779, Schema.org, VSS where applicable
3. **JSON-LD native** — Semantic web compatible from day one
4. **Pattern-based encoding** — Formalize what vPIC does internally
5. **Federated resolution** — Like DNS, not a single central authority
6. **Source attribution** — Every fact has provenance

---

## Sources

- ISO 3779:2009 — Road vehicles — Vehicle identification number (VIN)
- ISO 3780:2009 — Road vehicles — World manufacturer identifier (WMI)
- NHTSA vPIC — https://vpic.nhtsa.dot.gov/
- COVESA VSS — https://github.com/COVESA/vehicle_signal_specification
- COVESA VISS — https://github.com/COVESA/vehicle_information_service_specification
- Schema.org Vehicle — https://schema.org/Vehicle
- Schema.org Automotive — https://schema.org/docs/automotive.html
- W3C AUTO — https://www.w3.org/community/gao/
- VSSo — https://www.w3.org/TR/vsso/
- SAE J3016 — https://www.sae.org/standards/content/j3016/
- EU Data Act — Regulation (EU) 2023/2854
