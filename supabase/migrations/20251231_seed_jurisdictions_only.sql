-- ============================================================================
-- SEED JURISDICTION DATA ONLY
-- ============================================================================
-- Safe script to insert jurisdiction data without recreating table/indexes
-- Run this in Supabase SQL Editor if the table already exists
-- ============================================================================

-- Delete any existing data first (safe because projects have ON DELETE SET NULL)
DELETE FROM jurisdictions;

-- Insert 6 jurisdictions: FL (Miami, Tampa, Orlando) + TX (Houston, Dallas, Austin)
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
-- VERIFY SEED DATA
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

-- Display inserted jurisdictions
SELECT
  jurisdiction_name,
  ahj_name,
  nec_edition,
  estimated_review_days as review_days,
  array_length(required_documents, 1) as num_docs,
  array_length(required_calculations, 1) as num_calcs
FROM jurisdictions
ORDER BY state, city;
