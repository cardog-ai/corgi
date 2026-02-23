# Community VIN Pattern Schema

Quick reference for the YAML schema used in community VIN pattern contributions.

**For full contribution guidelines, see [CONTRIBUTING.md](./CONTRIBUTING.md).**

## File Structure

```
community/
├── CONTRIBUTING.md     # Full contribution guidelines
├── schema.md           # This file (quick reference)
├── wmi/
│   ├── tesla/
│   │   ├── LRW.yaml    # Tesla Shanghai
│   │   └── XP7.yaml    # Tesla Berlin
│   ├── byd/
│   │   └── LFV.yaml    # BYD China (example)
│   └── {make}/
│       └── {WMI}.yaml
└── build/
    ├── generate.ts     # YAML → SQL generator
    └── test-decode.ts  # Test utility
```

## YAML Schema (Quick Reference)

```yaml
wmi: LRW                          # Required: 3-char WMI code
manufacturer: "TESLA, INC."       # Required: Exact VPIC name
make: Tesla                       # Required: Exact VPIC name
country: CHINA                    # Required: Exact VPIC name
vehicle_type: Passenger Car       # Required: Exact VPIC name
years:
  from: 2020                      # Required: Start year
  to: null                        # Optional: End year (null = ongoing)

sources:                          # Required: Documentation sources
  - type: service_manual
    url: https://...
    description: "..."

patterns:                         # Required: Decoding patterns
  - pattern: "Y*****"             # 6-char pattern (* = wildcard)
    element: Model                # VPIC Element name
    value: "Model Y"              # Decoded value

test_vins:                        # Required: At least 3 VINs
  - vin: "LRWYGDEE1PC010116"
    expected:
      make: Tesla
      model: Model Y
      year: 2023
```

## Pattern Syntax

| Pattern | Matches | Example |
|---------|---------|---------|
| `Y*****` | Position 4 = Y | Model indicator |
| `*G****` | Position 5 = G | Steering/market |
| `***A**` | Position 7 = A | Motor type |
| `******` | All positions | Universal (fuel type, plant) |

## Validation Commands

```bash
# Generate SQL
npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml

# Test decode
cp db/vpic.lite.db db/vpic.community-test.db
npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml | sqlite3 db/vpic.community-test.db
npx tsx community/build/test-decode.ts LRWYGDEE1PC010116 --db db/vpic.community-test.db

# Run tests
pnpm test -t "Community"
```

## Common Lookup Values

```bash
# Body styles
sqlite3 db/vpic.lite.db "SELECT Name FROM BodyStyle WHERE Name LIKE '%Sedan%' OR Name LIKE '%Hatch%';"
# → Sedan/Saloon, Hatchback/Liftback/Notchback

# Drive types
sqlite3 db/vpic.lite.db "SELECT Name FROM DriveType;"
# → AWD/All-Wheel Drive, RWD/Rear-Wheel Drive, FWD/Front-Wheel Drive

# Fuel types (electric)
sqlite3 db/vpic.lite.db "SELECT Name FROM FuelType WHERE Name LIKE '%Elec%';"
# → Electric

# Electrification levels
sqlite3 db/vpic.lite.db "SELECT Name FROM ElectrificationLevel;"
# → BEV (Battery Electric Vehicle), PHEV (Plug-in Hybrid Electric Vehicle), ...
```
