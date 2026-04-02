# Contributing Community VIN Patterns

This guide explains how to contribute VIN decoding patterns for vehicles not covered by the official NHTSA VPIC database.

## Overview

The VPIC database primarily covers vehicles sold in the United States. Many international vehicles (particularly from China, Europe, and other markets) are not included. Community contributions help fill these gaps.

## Before You Start

### Check if the WMI Already Exists

```bash
sqlite3 db/vpic.lite.db "SELECT w.Wmi, m.Name as Make, c.Name as Country
FROM Wmi w
LEFT JOIN Make m ON w.MakeId = m.Id
LEFT JOIN Country c ON w.CountryId = c.Id
WHERE w.Wmi = 'YOUR_WMI';"
```

If the WMI exists with full data, no contribution is needed. If it exists but is missing Make or patterns, you may submit a supplemental contribution.

### Required Information

Before submitting, you must have:

1. **Official documentation** - Service manuals, regulatory filings, or manufacturer specifications
2. **Sample VINs** - At least 3 verified VINs with known correct decoding
3. **Pattern verification** - Understanding of what each VIN position encodes

## YAML Schema

### File Location

```
community/wmi/{make}/{WMI}.yaml
```

Example: `community/wmi/tesla/LRW.yaml`

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `wmi` | string | 3-character WMI code |
| `manufacturer` | string | Exact manufacturer name from VPIC |
| `make` | string | Exact make name from VPIC |
| `country` | string | Country name (must exist in VPIC) |
| `vehicle_type` | string | "Passenger Car", "Truck", "MPV", etc. |
| `years` | object | `from` (required), `to` (null for ongoing) |
| `patterns` | array | Pattern definitions (see below) |
| `test_vins` | array | Validation VINs with expected values |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `schema_name` | string | Custom schema name (auto-generated if omitted) |
| `sources` | array | Documentation sources (highly recommended) |
| `notes` | string | Additional context or limitations |

### Pattern Definition

```yaml
patterns:
  - pattern: "Y*****"      # 6-char pattern for positions 4-9
    element: Model         # Element name (must exist in VPIC)
    value: "Model Y"       # Decoded value (must exist in lookup table)
```

**Pattern syntax:**
- `*` = wildcard (matches any character)
- Literal characters match exactly
- Pattern length must be exactly 6 characters

### Supported Elements

| Element | Lookup Table | Notes |
|---------|--------------|-------|
| `Model` | Model | Must use Make-specific Model ID |
| `Body Class` | BodyStyle | Use exact VPIC names |
| `Doors` | (literal) | Number as string |
| `Drive Type` | DriveType | "AWD/All-Wheel Drive", etc. |
| `Fuel Type - Primary` | FuelType | "Electric", "Gasoline", etc. |
| `Electrification Level` | ElectrificationLevel | "BEV (Battery Electric Vehicle)", etc. |
| `Transmission` | Transmission | "Automatic", "Manual", etc. |
| `Plant City` | (literal) | City name in uppercase |
| `Plant Country` | Country | Must exist in VPIC |
| `Other Engine Info` | (literal) | Motor/engine descriptions |
| `Other Restraint System Info` | (literal) | Restraint/market info |

### Lookup Value Names

Values must use **exact VPIC names**. To find correct names:

```bash
# Find body styles
sqlite3 db/vpic.lite.db "SELECT Id, Name FROM BodyStyle ORDER BY Name;"

# Find drive types
sqlite3 db/vpic.lite.db "SELECT Id, Name FROM DriveType ORDER BY Name;"

# Find fuel types
sqlite3 db/vpic.lite.db "SELECT Id, Name FROM FuelType ORDER BY Name;"

# Find electrification levels
sqlite3 db/vpic.lite.db "SELECT Id, Name FROM ElectrificationLevel ORDER BY Name;"
```

## Complete Example

```yaml
# Tesla Shanghai (Gigafactory 3)
# WMI: LRW - Assigned to Tesla Manufacturing Shanghai
#
# Sources:
# - Tesla Service Manual (Position 4-8 encoding)
# - Chinese regulatory filings
# - Community VIN verification

wmi: LRW
manufacturer: "TESLA, INC."
make: Tesla
country: CHINA
vehicle_type: Passenger Car
years:
  from: 2020
  to: null  # ongoing

sources:
  - type: service_manual
    description: "Tesla Model 3/Y Service Manual - VIN Decoding Section"
  - type: regulatory
    description: "China Ministry of Industry WMI Registration"
  - type: community
    description: "Verified against 30+ VINs from production database"

patterns:
  # Position 4: Model
  - pattern: "Y*****"
    element: Model
    value: "Model Y"

  - pattern: "3*****"
    element: Model
    value: "Model 3"

  # Position 5: Body Type
  - pattern: "YA****"
    element: Body Class
    value: "Hatchback/Liftback/Notchback"

  - pattern: "YA****"
    element: Doors
    value: "5"

  # All Tesla = Electric
  - pattern: "******"
    element: Fuel Type - Primary
    value: "Electric"

  - pattern: "******"
    element: Electrification Level
    value: "BEV (Battery Electric Vehicle)"

  # Plant info
  - pattern: "******"
    element: Plant City
    value: "SHANGHAI"

  - pattern: "******"
    element: Plant Country
    value: "CHINA"

# Test VINs - REQUIRED
test_vins:
  - vin: "LRW3E1EB0PC932736"
    expected:
      make: Tesla
      model: Model 3
      body_class: Sedan
      year: 2023

  - vin: "LRWYGDEE1PC010116"
    expected:
      make: Tesla
      model: Model Y
      body_class: Hatchback
      year: 2023

  - vin: "LRWYGDEF4PC266095"
    expected:
      make: Tesla
      model: Model Y
      drive_type: AWD
      year: 2023
```

## Validation

### Generate SQL

```bash
npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml
```

The output should:
- Have no `__NEW_` placeholders (all values resolved)
- Be wrapped in `BEGIN TRANSACTION` / `COMMIT`
- Include INSERT statements for Wmi, Wmi_Make, VinSchema, Wmi_VinSchema, Pattern

### Test Decoding

```bash
# Create test database
cp db/vpic.lite.db db/vpic.community-test.db

# Apply patterns
npx tsx community/build/generate.ts community/wmi/tesla/LRW.yaml | sqlite3 db/vpic.community-test.db

# Test decode
npx tsx community/build/test-decode.ts LRW3E1EB0PC932736 --db db/vpic.community-test.db
```

### Add Unit Tests

Add tests to `test/community-patterns.test.ts`:

```typescript
const MY_NEW_VINS = [
  "VIN1...",
  "VIN2...",
  "VIN3...",
];

describe("XYZ (New WMI)", () => {
  it.skipIf(!dbExists)("should decode correctly", async () => {
    for (const vin of MY_NEW_VINS) {
      const result = await decoder.decode(vin);
      expect(result.valid).toBe(true);
      expect(result.components?.wmi?.make).toBe("ExpectedMake");
    }
  });
});
```

## Submission Checklist

- [ ] YAML file follows schema exactly
- [ ] All lookup values use exact VPIC names
- [ ] At least 3 test VINs included
- [ ] SQL generates without `__NEW_` placeholders
- [ ] Test decode produces correct results
- [ ] Unit tests added to `test/community-patterns.test.ts`
- [ ] Sources documented (service manual, regulatory filing, etc.)

## Pull Request Template

```markdown
## New Community Pattern: {WMI} ({Make} - {Country})

### Summary
Adding VIN decoding patterns for {description}.

### Sources
- [ ] Service manual / official documentation
- [ ] Regulatory filings
- [ ] Community verification (number of VINs tested)

### Validation
- [ ] SQL generates successfully
- [ ] Test decode works for all test VINs
- [ ] Unit tests pass

### Test VINs
| VIN | Expected Make | Expected Model | Verified |
|-----|---------------|----------------|----------|
| ... | ... | ... | Yes/No |
```

## Questions?

Open an issue at https://github.com/cardog-ai/corgi/issues with the `community-patterns` label.
