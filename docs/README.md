# Vehicle Identity Standard - Documentation

## Documents

| Document | Purpose |
|----------|---------|
| [01-LANDSCAPE.md](./01-LANDSCAPE.md) | Standards landscape, existing work, gap analysis |
| [02-ONTOLOGY.md](./02-ONTOLOGY.md) | Vehicle data model aligned with Schema.org |
| [03-ENCODING.md](./03-ENCODING.md) | VIN pattern encoding specification |
| [04-ARCHITECTURE.md](./04-ARCHITECTURE.md) | Technical implementation details |

## Overview

The **Vehicle Identity Standard (VIS)** fills the gap between:
- **ISO 3779/3780** — VIN structure (what a VIN looks like)
- **Meaningful vehicle data** — What a VIN means

### The Problem

Every manufacturer encodes different attributes in different VIN positions using different schemes. This information exists in fragmented sources (NHTSA vPIC, national registries, OEM documentation) with no interoperability standard.

### The Solution

A complete standard defining:
1. **Vehicle Ontology** — Canonical data model for vehicles (aligned with Schema.org)
2. **VIN Encoding** — Format for describing per-WMI pattern mappings
3. **Resolution Protocol** — How to resolve VIN → vehicle data (like DNS)
4. **Exchange Format** — JSON-LD for interoperability

### Design Principles

1. **Adopt existing standards** — Schema.org naming, ISO 3779 structure
2. **Extend, don't replace** — Build on what exists
3. **JSON-LD native** — Semantic web compatible
4. **Offline-first** — No network required for decoding
5. **Source-aware** — Every fact has provenance

## Status

**Version:** 0.1.0 (Draft)

This is early-stage work. The ontology and encoding format are being refined based on real-world data from NHTSA vPIC, RDW Netherlands, and community contributions.

## Related

- [SPEC.md](../SPEC.md) — Formal specification (WIP)
- [corgi v3 implementation](../src/) — Reference implementation
