-- ============================================================================
-- JURISDICTION REQUIREMENTS WIZARD - DATABASE SCHEMA
-- ============================================================================
-- Created: 2025-12-31
-- Purpose: Enable jurisdiction-specific permit requirement checklists
--
-- Tables:
--   1. jurisdictions - Reference table for AHJ permit requirements
--   2. projects.jurisdiction_id - FK link to jurisdictions
--
-- Initial Coverage: FL (Miami, Tampa, Orlando) + TX (Houston, Dallas, Austin)
-- ============================================================================

-- ============================================================================
-- 1. CREATE JURISDICTIONS TABLE
-- ============================================================================

-- Jurisdictions: Shared reference data (no RLS needed - read-only for all users)
CREATE TABLE IF NOT EXISTS public.jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location (searchable)
  jurisdiction_name TEXT NOT NULL,      -- "Miami, Miami-Dade County, FL"
  city TEXT NOT NULL,                   -- "Miami"
  county TEXT,                          -- "Miami-Dade" (optional)
  state TEXT NOT NULL,                  -- "FL" (2-letter code)

  -- AHJ Details
  ahj_name TEXT,                        -- "City of Miami Building Department"
  ahj_website TEXT,                     -- URL for reference

  -- Requirements (TEXT arrays - matches existing codebase pattern)
  required_documents TEXT[] DEFAULT '{}',    -- ['one_line_diagram', 'load_calc', ...]
  required_calculations TEXT[] DEFAULT '{}', -- ['short_circuit', 'voltage_drop', ...]

  -- Metadata
  notes TEXT,                           -- Special requirements, fees, etc.
  nec_edition TEXT DEFAULT '2023',      -- '2020' | '2023'
  estimated_review_days INTEGER,        -- Typical plan review time
  is_active BOOLEAN DEFAULT true,       -- Soft delete pattern

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES FOR SEARCH PERFORMANCE
-- ============================================================================

-- Index on jurisdiction name for exact lookups
CREATE INDEX idx_jurisdictions_name ON jurisdictions(jurisdiction_name);

-- Composite index for city + state searches
CREATE INDEX idx_jurisdictions_city_state ON jurisdictions(city, state);

-- Partial index for active jurisdictions only (most common query)
CREATE INDEX idx_jurisdictions_active ON jurisdictions(is_active) WHERE is_active = true;

-- Full-text search index for autocomplete searches
-- Supports: "Miami Beach", "Dade County", "Tampa FL", etc.
CREATE INDEX idx_jurisdictions_search ON jurisdictions
  USING gin(to_tsvector('english', jurisdiction_name || ' ' || city || ' ' || COALESCE(county, '') || ' ' || state));

-- ============================================================================
-- 3. CREATE TRIGGER FOR UPDATED_AT TIMESTAMP
-- ============================================================================

-- Trigger to auto-update updated_at on row changes
CREATE TRIGGER update_jurisdictions_updated_at
  BEFORE UPDATE ON jurisdictions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. LINK JURISDICTIONS TO PROJECTS TABLE
-- ============================================================================

-- Add optional jurisdiction FK to projects table
-- ON DELETE SET NULL: If jurisdiction deleted, projects survive (won't happen in practice)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS jurisdiction_id UUID
  REFERENCES jurisdictions(id) ON DELETE SET NULL;

-- Index for filtering projects by jurisdiction
CREATE INDEX IF NOT EXISTS idx_projects_jurisdiction ON projects(jurisdiction_id);

-- ============================================================================
-- 5. SEED INITIAL DATA - FLORIDA + TEXAS (6 JURISDICTIONS)
-- ============================================================================

INSERT INTO jurisdictions
  (jurisdiction_name, city, county, state, ahj_name, required_documents, required_calculations, notes, nec_edition, estimated_review_days)
VALUES
  -- ============================================================================
  -- FLORIDA (3 jurisdictions)
  -- ============================================================================

  -- Miami, FL
  (
    'Miami, Miami-Dade County, FL',
    'Miami',
    'Miami-Dade',
    'FL',
    'City of Miami Building Department',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'equipment_specifications',
      'short_circuit_analysis',
      'grounding_plan',
      'service_entrance_details'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'short_circuit',
      'grounding'
    ],
    'Requires stamped/sealed drawings for commercial projects. Plan review fee based on project valuation.',
    '2023',
    15
  ),

  -- Tampa, FL
  (
    'Tampa, Hillsborough County, FL',
    'Tampa',
    'Hillsborough',
    'FL',
    'City of Tampa Building Department',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'short_circuit_analysis',
      'grounding_plan'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'short_circuit',
      'grounding'
    ],
    'Accepts electronic plan submittal via ProjectDox. Typical review: 10-15 business days.',
    '2023',
    12
  ),

  -- Orlando, FL
  (
    'Orlando, Orange County, FL',
    'Orlando',
    'Orange',
    'FL',
    'City of Orlando Building Department',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'equipment_specifications',
      'grounding_plan'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'grounding'
    ],
    'NEC 2023 adopted. Online permit portal: Orlando.gov/permits',
    '2023',
    10
  ),

  -- ============================================================================
  -- TEXAS (3 jurisdictions)
  -- ============================================================================

  -- Houston, TX
  (
    'Houston, Harris County, TX',
    'Houston',
    'Harris',
    'TX',
    'City of Houston Permitting Department',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'short_circuit_analysis',
      'arc_flash_analysis',
      'equipment_specifications'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'short_circuit',
      'arc_flash'
    ],
    'Arc flash analysis required for commercial >400A. Submit via PDD Online.',
    '2023',
    20
  ),

  -- Dallas, TX
  (
    'Dallas, Dallas County, TX',
    'Dallas',
    'Dallas',
    'TX',
    'City of Dallas Development Services',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'short_circuit_analysis'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'short_circuit'
    ],
    'NEC 2020 in effect (2023 adoption pending). Online portal: DallasCityHall.com/permits',
    '2020',
    18
  ),

  -- Austin, TX
  (
    'Austin, Travis County, TX',
    'Austin',
    'Travis',
    'TX',
    'City of Austin Development Services Department',
    ARRAY[
      'one_line_diagram',
      'load_calculation',
      'panel_schedules',
      'grounding_plan',
      'service_entrance_details'
    ],
    ARRAY[
      'load_calculation',
      'voltage_drop',
      'grounding'
    ],
    'NEC 2023 adopted. Expedited review available for residential projects.',
    '2023',
    14
  );

-- ============================================================================
-- 6. VERIFY SEED DATA
-- ============================================================================

-- Query to verify all jurisdictions were inserted
DO $$
DECLARE
  jurisdiction_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO jurisdiction_count FROM jurisdictions WHERE is_active = true;

  IF jurisdiction_count = 6 THEN
    RAISE NOTICE '✓ Successfully seeded 6 jurisdictions (FL: Miami, Tampa, Orlando | TX: Houston, Dallas, Austin)';
  ELSE
    RAISE WARNING '⚠ Expected 6 jurisdictions, found %', jurisdiction_count;
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Next Steps:
-- 1. Run this migration in Supabase SQL Editor
-- 2. Regenerate TypeScript types: npx supabase gen types typescript --local > lib/database.types.ts
-- 3. Verify with: SELECT jurisdiction_name FROM jurisdictions ORDER BY state, city;
