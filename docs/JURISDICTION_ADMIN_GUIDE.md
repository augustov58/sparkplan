# Jurisdiction Database Maintenance Guide

This guide provides SQL commands for managing the jurisdictions database. Jurisdictions are reference data shared across all users and should be maintained by administrators via Supabase SQL Editor.

**Database Table**: `jurisdictions`
**Admin Access**: Supabase Dashboard → SQL Editor
**No User UI**: Jurisdictions are admin-maintained (not user-editable)

---

## Table of Contents

1. [Adding a New Jurisdiction](#adding-a-new-jurisdiction)
2. [Updating Existing Jurisdictions](#updating-existing-jurisdictions)
3. [Managing Requirements Arrays](#managing-requirements-arrays)
4. [Soft Delete (Deactivating)](#soft-delete-deactivating)
5. [Common Queries](#common-queries)
6. [Field Reference](#field-reference)

---

## Adding a New Jurisdiction

### Basic Template

```sql
INSERT INTO jurisdictions
  (jurisdiction_name, city, county, state, ahj_name, required_documents, required_calculations, notes, nec_edition)
VALUES
  (
    'Phoenix, Maricopa County, AZ',
    'Phoenix',
    'Maricopa',
    'AZ',
    'City of Phoenix Development Services',
    ARRAY['one_line_diagram', 'load_calculation', 'panel_schedules', 'short_circuit_analysis'],
    ARRAY['load_calculation', 'voltage_drop', 'short_circuit'],
    'NEC 2023 adopted. Online submittal via ePlan. Expedited review available.',
    '2023'
  );
```

### Example: California Jurisdiction

```sql
INSERT INTO jurisdictions
  (jurisdiction_name, city, county, state, ahj_name, ahj_website, required_documents, required_calculations, notes, nec_edition, estimated_review_days)
VALUES
  (
    'San Francisco, San Francisco County, CA',
    'San Francisco',
    'San Francisco',
    'CA',
    'SF Department of Building Inspection',
    'https://sfdbi.org',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'equipment_specifications',
      'short_circuit_analysis',
      'arc_flash_analysis',
      'grounding_plan',
      'site_plan'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'short_circuit',
      'arc_flash',
      'grounding'
    ],
    'NEC 2023 with California amendments. Title 24 energy compliance required. Online portal: sfdbi.org/ebis',
    '2023',
    15
  );
```

### Example: Texas Jurisdiction

```sql
INSERT INTO jurisdictions
  (jurisdiction_name, city, county, state, ahj_name, required_documents, required_calculations, notes, nec_edition)
VALUES
  (
    'San Antonio, Bexar County, TX',
    'San Antonio',
    'Bexar',
    'TX',
    'City of San Antonio Development Services',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'service_entrance_details'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop'
    ],
    'NEC 2020 currently adopted. 2023 adoption expected Q2 2026.',
    '2020'
  );
```

---

## Updating Existing Jurisdictions

### Update Basic Information

```sql
-- Update AHJ website
UPDATE jurisdictions
SET ahj_website = 'https://www.miamidade.gov/building'
WHERE city = 'Miami' AND state = 'FL';

-- Update estimated review days
UPDATE jurisdictions
SET estimated_review_days = 12
WHERE city = 'Dallas' AND state = 'TX';

-- Update NEC edition (when jurisdiction adopts new code)
UPDATE jurisdictions
SET nec_edition = '2023'
WHERE city = 'Dallas' AND state = 'TX';

-- Update notes
UPDATE jurisdictions
SET notes = 'NEC 2023 adopted effective Jan 1, 2026. Arc flash analysis required for commercial >400A.'
WHERE city = 'Houston' AND state = 'TX';
```

### Update Multiple Fields

```sql
UPDATE jurisdictions
SET
  nec_edition = '2023',
  estimated_review_days = 10,
  notes = 'NEC 2023 adopted. Expedited review available for residential projects under 200A.',
  updated_at = NOW()
WHERE city = 'Austin' AND state = 'TX';
```

---

## Managing Requirements Arrays

### Add Document Requirement

```sql
-- Add arc flash analysis to Houston requirements
UPDATE jurisdictions
SET required_documents = array_append(required_documents, 'arc_flash_analysis')
WHERE city = 'Houston' AND state = 'TX';

-- Add multiple documents at once
UPDATE jurisdictions
SET required_documents = array_cat(required_documents, ARRAY['photometric_plan', 'site_plan'])
WHERE city = 'Orlando' AND state = 'FL';
```

### Remove Document Requirement

```sql
-- Remove photometric plan requirement
UPDATE jurisdictions
SET required_documents = array_remove(required_documents, 'photometric_plan')
WHERE city = 'Miami' AND state = 'FL';
```

### Replace Entire Array

```sql
-- Replace all required documents
UPDATE jurisdictions
SET required_documents = ARRAY[
  'one_line_diagram',
  'load_calculation',
  'panel_schedules',
  'equipment_specifications'
]
WHERE city = 'Tampa' AND state = 'FL';
```

### Add Calculation Requirement

```sql
-- Add arc flash calculation
UPDATE jurisdictions
SET required_calculations = array_append(required_calculations, 'arc_flash')
WHERE city = 'Dallas' AND state = 'TX';

-- Add conductor sizing calculation
UPDATE jurisdictions
SET required_calculations = array_append(required_calculations, 'conductor_sizing')
WHERE city = 'Miami' AND state = 'FL';
```

### Remove Calculation Requirement

```sql
-- Remove conduit fill calculation
UPDATE jurisdictions
SET required_calculations = array_remove(required_calculations, 'conduit_fill')
WHERE city = 'Austin' AND state = 'TX';
```

---

## Soft Delete (Deactivating)

**Important**: Use soft delete (is_active = false) instead of DELETE to preserve data integrity. Projects reference jurisdictions via FK, and soft delete prevents breaking existing projects.

### Deactivate Jurisdiction

```sql
-- Deactivate a jurisdiction (hide from UI)
UPDATE jurisdictions
SET is_active = false
WHERE city = 'OldCity' AND state = 'XX';
```

### Reactivate Jurisdiction

```sql
-- Reactivate a jurisdiction
UPDATE jurisdictions
SET is_active = true
WHERE city = 'Phoenix' AND state = 'AZ';
```

### Permanent Delete (NOT RECOMMENDED)

```sql
-- ONLY use if absolutely necessary (breaks project references)
DELETE FROM jurisdictions
WHERE city = 'TestCity' AND state = 'XX';
```

---

## Common Queries

### List All Active Jurisdictions

```sql
-- All jurisdictions sorted by state, then city
SELECT
  jurisdiction_name,
  ahj_name,
  nec_edition,
  estimated_review_days,
  array_length(required_documents, 1) as doc_count,
  array_length(required_calculations, 1) as calc_count
FROM jurisdictions
WHERE is_active = true
ORDER BY state, city;
```

### Find Jurisdictions by State

```sql
-- All Florida jurisdictions
SELECT * FROM jurisdictions
WHERE state = 'FL' AND is_active = true
ORDER BY city;

-- All Texas jurisdictions
SELECT * FROM jurisdictions
WHERE state = 'TX' AND is_active = true
ORDER BY city;
```

### Search by City/County

```sql
-- Search for "Miami" (case-insensitive)
SELECT * FROM jurisdictions
WHERE (
  city ILIKE '%Miami%'
  OR county ILIKE '%Miami%'
  OR jurisdiction_name ILIKE '%Miami%'
)
AND is_active = true;
```

### Find Jurisdictions with Specific Requirements

```sql
-- Jurisdictions requiring arc flash analysis
SELECT jurisdiction_name, state
FROM jurisdictions
WHERE 'arc_flash_analysis' = ANY(required_documents)
AND is_active = true;

-- Jurisdictions requiring short circuit calculation
SELECT jurisdiction_name, state
FROM jurisdictions
WHERE 'short_circuit' = ANY(required_calculations)
AND is_active = true;
```

### Count Requirements

```sql
-- Jurisdictions with most requirements
SELECT
  jurisdiction_name,
  array_length(required_documents, 1) as docs,
  array_length(required_calculations, 1) as calcs,
  (array_length(required_documents, 1) + array_length(required_calculations, 1)) as total
FROM jurisdictions
WHERE is_active = true
ORDER BY total DESC
LIMIT 10;
```

### Find Projects Using Jurisdiction

```sql
-- Count projects per jurisdiction
SELECT
  j.jurisdiction_name,
  COUNT(p.id) as project_count
FROM jurisdictions j
LEFT JOIN projects p ON p.jurisdiction_id = j.id
GROUP BY j.id, j.jurisdiction_name
ORDER BY project_count DESC;
```

---

## Field Reference

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `jurisdiction_name` | TEXT | Full jurisdiction display name | "Miami, Miami-Dade County, FL" |
| `city` | TEXT | City name | "Miami" |
| `state` | TEXT | 2-letter state code | "FL" |

### Optional Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `county` | TEXT | County name (without "County") | "Miami-Dade" |
| `ahj_name` | TEXT | Full AHJ department name | "City of Miami Building Department" |
| `ahj_website` | TEXT | AHJ website URL | "https://www.miamigov.com/building" |
| `notes` | TEXT | Special requirements, fees, processes | "Requires stamped drawings for commercial" |
| `nec_edition` | TEXT | NEC code version ('2020' or '2023') | "2023" |
| `estimated_review_days` | INTEGER | Typical plan review time | 15 |

### Array Fields

| Field | Type | Valid Values | Description |
|-------|------|--------------|-------------|
| `required_documents` | TEXT[] | See Document Types below | Document checklist |
| `required_calculations` | TEXT[] | See Calculation Types below | Calculation checklist |

### System Fields (Auto-Managed)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `is_active` | BOOLEAN | Soft delete flag (default true) |
| `created_at` | TIMESTAMPTZ | Creation timestamp (auto) |
| `updated_at` | TIMESTAMPTZ | Last update (auto via trigger) |

---

## Document Types

Use these exact values in `required_documents` array:

| Value | Label | Description |
|-------|-------|-------------|
| `one_line_diagram` | One-Line Diagram | Single-line electrical diagram |
| `load_calculation` | Load Calculation Summary | NEC 220 load calculations |
| `panel_schedules` | Panel Schedules | Panel schedule forms |
| `equipment_specifications` | Equipment Specifications | Equipment cut sheets/specs |
| `short_circuit_analysis` | Short Circuit Analysis | Fault current study |
| `arc_flash_analysis` | Arc Flash Analysis | NFPA 70E arc flash study |
| `voltage_drop_report` | Voltage Drop Report | Voltage drop calculations |
| `grounding_plan` | Grounding System Plan | NEC 250 grounding details |
| `service_entrance_details` | Service Entrance Details | Service entrance drawings |
| `riser_diagram` | Riser Diagram | Vertical electrical distribution |
| `site_plan` | Site Plan / Plot Plan | Site layout drawing |
| `photometric_plan` | Photometric Plan (Lighting) | Lighting calculations |

---

## Calculation Types

Use these exact values in `required_calculations` array:

| Value | Label | Description |
|-------|-------|-------------|
| `load_calculation` | Load Calculation (NEC 220) | NEC Article 220 load calc |
| `voltage_drop` | Voltage Drop Calculation | NEC Chapter 9 voltage drop |
| `short_circuit` | Short Circuit Analysis (NEC 110.9) | Fault current/SCCR |
| `arc_flash` | Arc Flash Hazard Analysis (NFPA 70E) | Arc flash incident energy |
| `grounding` | Grounding Electrode Sizing (NEC 250) | NEC 250 grounding calc |
| `conductor_sizing` | Conductor Ampacity Sizing (NEC 310) | NEC 310 wire sizing |
| `conduit_fill` | Conduit Fill Calculation (NEC 310) | NEC 310 conduit fill |

---

## Best Practices

### 1. Naming Conventions

**Jurisdiction Name Format**: `"{City}, {County} County, {State}"`

Examples:
- ✅ "Miami, Miami-Dade County, FL"
- ✅ "Houston, Harris County, TX"
- ✅ "Phoenix, Maricopa County, AZ"
- ❌ "Miami FL" (missing county)
- ❌ "Miami, FL" (missing county)

**Exception**: Cities that are also counties (San Francisco, Denver, etc.):
- ✅ "San Francisco, San Francisco County, CA"
- ✅ "Denver, Denver County, CO"

### 2. AHJ Names

Use full official department names:
- ✅ "City of Miami Building Department"
- ✅ "Los Angeles Department of Building and Safety"
- ❌ "Miami Building Dept" (abbreviation)
- ❌ "LA DBS" (acronym)

### 3. NEC Edition

- Use '2020' or '2023' (string, not integer)
- Update when jurisdiction adopts new code
- Include adoption date in notes if available

### 4. Required Documents/Calculations

- Start with minimum viable set (don't over-specify)
- Add more requirements based on actual AHJ checklists
- Remove requirements that are rarely enforced
- Review/update annually

### 5. Notes Field

Include useful information:
- Online portal URLs
- Special fees or processes
- Exemptions (e.g., "No arc flash required for residential")
- Adoption timeline (e.g., "NEC 2023 effective Jan 1, 2026")

### 6. Estimated Review Days

- Use median, not minimum (more accurate expectation)
- Update based on user feedback
- Omit if unknown (leave NULL)

---

## Data Quality Checklist

Before adding a new jurisdiction, verify:

- [ ] Jurisdiction name follows format: "{City}, {County} County, {State}"
- [ ] City, state, county fields match jurisdiction_name
- [ ] State is 2-letter code (uppercase)
- [ ] AHJ name is full official department name
- [ ] AHJ website URL is valid (if provided)
- [ ] NEC edition is '2020' or '2023'
- [ ] Required documents use exact values from Document Types table
- [ ] Required calculations use exact values from Calculation Types table
- [ ] Notes include useful information (not generic boilerplate)
- [ ] Estimated review days is realistic median (if provided)
- [ ] is_active is true (default)

---

## Bulk Import Template

For adding multiple jurisdictions at once:

```sql
INSERT INTO jurisdictions
  (jurisdiction_name, city, county, state, ahj_name, required_documents, required_calculations, notes, nec_edition)
VALUES
  (
    'City 1, County 1, ST',
    'City 1',
    'County 1',
    'ST',
    'AHJ Name 1',
    ARRAY['one_line_diagram', 'load_calculation', 'panel_schedules'],
    ARRAY['load_calculation', 'voltage_drop'],
    'Notes for City 1',
    '2023'
  ),
  (
    'City 2, County 2, ST',
    'City 2',
    'County 2',
    'ST',
    'AHJ Name 2',
    ARRAY['one_line_diagram', 'load_calculation'],
    ARRAY['load_calculation'],
    'Notes for City 2',
    '2020'
  ),
  (
    'City 3, County 3, ST',
    'City 3',
    'County 3',
    'ST',
    'AHJ Name 3',
    ARRAY['one_line_diagram', 'load_calculation', 'panel_schedules', 'short_circuit_analysis'],
    ARRAY['load_calculation', 'voltage_drop', 'short_circuit'],
    'Notes for City 3',
    '2023'
  );
```

---

## Troubleshooting

### Error: Array contains invalid value

**Symptom**: INSERT fails with constraint error

**Cause**: Document/calculation type not in allowed values

**Fix**: Check spelling against Document Types / Calculation Types tables above

```sql
-- WRONG
ARRAY['oneline_diagram', 'load_calc']

-- CORRECT
ARRAY['one_line_diagram', 'load_calculation']
```

### Error: Duplicate jurisdiction

**Symptom**: Unique constraint violation

**Cause**: jurisdiction_name already exists

**Fix**: Use UPDATE instead of INSERT, or check for duplicates first

```sql
-- Check for duplicates before inserting
SELECT * FROM jurisdictions
WHERE jurisdiction_name = 'Miami, Miami-Dade County, FL';
```

### Projects Not Finding Jurisdiction

**Symptom**: Search returns 0 results

**Cause**: Jurisdiction is inactive

**Fix**: Check is_active flag

```sql
-- Find inactive jurisdictions
SELECT jurisdiction_name, is_active
FROM jurisdictions
WHERE is_active = false;

-- Reactivate if needed
UPDATE jurisdictions
SET is_active = true
WHERE jurisdiction_name = 'Your Jurisdiction';
```

---

## Maintenance Schedule

**Quarterly** (Every 3 months):
- Review estimated_review_days accuracy
- Update notes with any process changes
- Add new jurisdictions based on user requests

**Semi-Annual** (Every 6 months):
- Check for NEC code adoptions (update nec_edition)
- Verify AHJ website URLs still work
- Review required_documents/calculations accuracy

**Annual** (Every 12 months):
- Audit all jurisdictions for data quality
- Remove inactive jurisdictions (soft delete)
- Expand coverage to new states/cities

---

## Future Enhancements

**Planned for Later Versions:**

1. **React Admin UI** - Web interface for managing jurisdictions (no SQL required)
2. **AHJ Contact Info** - Phone, email, office hours
3. **Submittal Links** - Direct links to online permit portals (pre-fill data)
4. **Requirement Versioning** - Track when requirements change over time
5. **AI-Powered Extraction** - Scrape AHJ websites to auto-populate requirements
6. **User Feedback Loop** - Allow users to suggest requirement updates

---

## Support

**Questions?** Contact development team or create issue in GitHub repository.

**Data Sources:**
- AHJ official websites
- ICC (International Code Council) adoption maps
- NFPA code adoption tracking
- User feedback and contractor input

**Last Updated**: December 31, 2025
**Version**: 1.0.0
