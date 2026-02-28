# (Corgi) Community VIN Pattern Pipeline - Roadmap

**Issue:** Community-maintained VIN patterns for non-US vehicles
**PR:** https://github.com/cardog-ai/corgi/pull/25
**Status:** Phase 1 Complete (LRW, XP7)

---

## Overview

The VPIC database only covers US-market vehicles. This pipeline enables community contributions for international VINs (China, EU, etc.) using a YAML-based system that generates VPIC-compatible SQL.

**Current State:** Manual generation, 2 WMIs (Tesla LRW/XP7), basic validation

---

## Phase 1: Foundation ✅

- [x] YAML schema design
- [x] SQL generator (`community/build/generate.ts`)
- [x] Make-aware Model ID resolution (Make_Model table)
- [x] Test utility (`community/build/test-decode.ts`)
- [x] Tesla LRW (Shanghai) patterns
- [x] Tesla XP7 (Berlin) patterns
- [x] Test suite with 61 VINs
- [x] CONTRIBUTING.md documentation

---

## Phase 2: Validation & Quality

### P0: Schema Validation
- [ ] Zod schema for YAML validation
- [ ] Pattern syntax validation (6 chars, valid wildcards only)
- [ ] VIN check digit validation for `test_vins`
- [ ] Required fields enforcement (sources, test_vins >= 3)
- [ ] Pre-commit hook or CI check

```typescript
// community/build/schema.ts
const patternSchema = z.object({
  pattern: z.string().regex(/^[A-Z0-9*]{6}$/),
  element: z.enum([...VALID_ELEMENTS]),
  value: z.string().min(1),
});

const wmiSchema = z.object({
  wmi: z.string().length(3).regex(/^[A-Z0-9]{3}$/),
  manufacturer: z.string().min(1),
  make: z.string().min(1),
  country: z.string().min(1),
  vehicle_type: z.enum(['Passenger Car', 'Truck', 'MPV', ...]),
  years: z.object({
    from: z.number().min(1980).max(2100),
    to: z.number().nullable(),
  }),
  sources: z.array(sourceSchema).min(1),
  patterns: z.array(patternSchema).min(1),
  test_vins: z.array(testVinSchema).min(3),
});
```

### P0: Conflict Detection
- [ ] Same pattern + same element = error
- [ ] Year range overlap for same WMI = warning
- [ ] Conflict with existing VPIC patterns = warning
- [ ] Duplicate WMI across files = error

### P1: NHTSA Validation
- [ ] For test_vins, compare decoded values against NHTSA API
- [ ] Flag discrepancies (community pattern differs from NHTSA)
- [ ] Skip validation for WMIs not in NHTSA

---

## Phase 3: Build & Distribution

### P0: CI Pipeline
- [ ] GitHub Action: `.github/workflows/community-patterns.yml`
- [ ] Trigger on changes to `community/wmi/**/*.yaml`
- [ ] Steps:
  1. Validate all YAML files
  2. Generate SQL for each
  3. Apply to test database
  4. Run decoder tests
  5. Upload artifacts (SQL files)

```yaml
# .github/workflows/community-patterns.yml
name: Community Patterns
on:
  push:
    paths: ['packages/corgi/community/wmi/**/*.yaml']
  pull_request:
    paths: ['packages/corgi/community/wmi/**/*.yaml']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @cardog/corgi run community:validate
      - run: pnpm --filter @cardog/corgi run community:generate
      - run: pnpm --filter @cardog/corgi test
```

### P1: Database Merging
- [ ] Script to merge community SQL into `vpic.lite.db`
- [ ] Flag community patterns in database (source = 'community')
- [ ] Separate `vpic.community.db` option
- [ ] Release workflow to publish updated database

### P2: Versioning Strategy
- [ ] Handle VPIC quarterly updates (ID shifts)
- [ ] Migration script for existing community patterns
- [ ] Detect when VPIC adds official coverage
- [ ] Changelog for community database

---

## Phase 4: Expanded Coverage

### Priority WMIs

| Priority | WMI | Make | Country | Est. Effort |
|----------|-----|------|---------|-------------|
| P0 | 7SA supplement | Tesla | USA | Low (add missing patterns) |
| P1 | LFV | BYD | China | Medium |
| P1 | LSJ | MG/SAIC | China | Medium |
| P2 | WBA/WBS | BMW | Germany | Medium |
| P2 | WDD | Mercedes | Germany | Medium |
| P2 | VF1 | Renault | France | Medium |
| P3 | TMB | Škoda | Czech | Low |
| P3 | W0L | Opel | Germany | Low |
| P3 | ZFA | Fiat | Italy | Low |

### Supplemental Patterns
- [ ] Support `mode: supplement` for existing WMIs
- [ ] Add patterns without replacing WMI entry
- [ ] Merge strategy (append vs override)

```yaml
# Example: 7SA supplement
wmi: 7SA
mode: supplement  # Don't create new WMI, just add patterns
patterns:
  - pattern: "..."
```

---

## Phase 5: Developer Experience

### CLI Helpers
- [ ] `pnpm community:init <WMI>` - scaffold YAML from VINs
- [ ] `pnpm community:validate <file>` - validate single file
- [ ] `pnpm community:generate <file>` - generate SQL
- [ ] `pnpm community:test <file>` - test decode with patterns
- [ ] `pnpm community:lookup <table>` - search lookup values

```bash
# Scaffold from VINs (fetches NHTSA data as starting point)
pnpm community:init LFV --vins "LFVXXXXXX,LFVYYYYYY,LFVZZZZZZ"

# Validate before PR
pnpm community:validate community/wmi/byd/LFV.yaml

# Full workflow
pnpm community:generate community/wmi/byd/LFV.yaml | sqlite3 db/vpic.community-test.db
pnpm community:test LFV... --db db/vpic.community-test.db
```

### Pattern Templates
- [ ] Base templates for common patterns (all-electric, plant info)
- [ ] `extends` syntax for inheritance
- [ ] Make-level defaults

```yaml
# community/templates/tesla-electric.yaml
patterns:
  - pattern: "******"
    element: Fuel Type - Primary
    value: "Electric"
  - pattern: "******"
    element: Electrification Level
    value: "BEV (Battery Electric Vehicle)"

# community/wmi/tesla/LRW.yaml
extends: templates/tesla-electric
wmi: LRW
# ... only unique patterns needed
```

### Web UI (Future)
- [ ] Form-based YAML generation
- [ ] Lookup value search
- [ ] Pattern visualizer
- [ ] VIN tester

---

## Phase 6: Quality Assurance

### Source Verification
- [ ] Required source types enum
- [ ] URL validation for source links
- [ ] Confidence scoring based on source quality
- [ ] Community review process (2+ approvers)

### Regression Testing
- [ ] Snapshot tests for generated SQL
- [ ] Performance benchmarks
- [ ] Coverage report (WMIs/years covered)
- [ ] Automated testing on VPIC updates

---

## Open Questions

1. **Database distribution:** Ship merged db or separate community db?
2. **Conflict resolution:** When community differs from VPIC, which wins?
3. **Attribution:** How to credit contributors in the database?
4. **Licensing:** What license for community contributions?
5. **Governance:** Who approves community PRs?

---

## References

- PR #25: https://github.com/cardog-ai/corgi/pull/25
- Issue #23: https://github.com/cardog-ai/corgi/issues/23
- VPIC API: https://vpic.nhtsa.dot.gov/api/
- Tesla Service Manual: https://service.tesla.com
