-- Migration: Add Equipment Specification Fields to Panels and Transformers
-- Date: 2025-12-30
-- Purpose: Add manufacturer, model, UL listing, AIC ratings, and NEMA enclosure types
--          for permit packet generation and NEC 110.9 compliance validation

-- ============================================================================
-- PANELS TABLE - Add Equipment Specification Fields
-- ============================================================================

-- Manufacturer information
ALTER TABLE panels ADD COLUMN IF NOT EXISTS manufacturer TEXT;

-- Model and catalog information
ALTER TABLE panels ADD COLUMN IF NOT EXISTS model_number TEXT;

-- NEMA enclosure type (Type 1, 3R, 4X, etc.)
-- Reference: NEC 408.20 - Enclosure types must be specified
ALTER TABLE panels ADD COLUMN IF NOT EXISTS nema_enclosure_type TEXT;

-- UL listing information (e.g., 'UL 67 - Panelboards', 'UL 891 - Switchboards')
-- Reference: NEC 110.3(B) - All equipment must be listed
ALTER TABLE panels ADD COLUMN IF NOT EXISTS ul_listing TEXT;

-- AIC (Available Interrupting Current) rating in kA
-- Reference: NEC 110.9 - Equipment must have adequate interrupting rating
-- Common values: 10, 14, 22, 25, 42, 65, 100, 200 kA
ALTER TABLE panels ADD COLUMN IF NOT EXISTS aic_rating INTEGER;

-- Series rating flag (NEC 240.86)
-- Indicates if panel uses series-rated protection
ALTER TABLE panels ADD COLUMN IF NOT EXISTS series_rating BOOLEAN DEFAULT false;

-- Additional notes for equipment specifications
ALTER TABLE panels ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN panels.manufacturer IS 'Equipment manufacturer (e.g., Square D, Eaton, Siemens)';
COMMENT ON COLUMN panels.model_number IS 'Model or catalog number';
COMMENT ON COLUMN panels.nema_enclosure_type IS 'NEMA enclosure type (1, 3R, 4X, etc.) per NEC 408.20';
COMMENT ON COLUMN panels.ul_listing IS 'UL listing information per NEC 110.3(B)';
COMMENT ON COLUMN panels.aic_rating IS 'Available Interrupting Current rating in kA per NEC 110.9';
COMMENT ON COLUMN panels.series_rating IS 'Series-rated system flag per NEC 240.86';
COMMENT ON COLUMN panels.notes IS 'Additional equipment specification notes';

-- ============================================================================
-- TRANSFORMERS TABLE - Add Equipment Specification Fields
-- ============================================================================

-- Winding type (Dry-type, Liquid-filled)
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS winding_type TEXT;

-- Impedance percentage (already exists in schema, but ensure it's DECIMAL(4,2))
-- Check if column exists and alter type if needed
DO $$
BEGIN
  -- Check if impedance_percent column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transformers' AND column_name = 'impedance_percent'
  ) THEN
    -- Column exists, ensure correct type
    ALTER TABLE transformers ALTER COLUMN impedance_percent TYPE DECIMAL(4,2);
  ELSE
    -- Column doesn't exist, create it
    ALTER TABLE transformers ADD COLUMN impedance_percent DECIMAL(4,2);
  END IF;
END $$;

-- Cooling type (AA, AN, FA, etc.)
-- AA = Air-Air (natural convection)
-- AN = Air-Natural (natural air circulation)
-- FA = Forced Air (fan-cooled)
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS cooling_type TEXT;

-- UL listing information (e.g., 'UL 1561 - Dry-type', 'UL 1562 - Liquid-filled')
-- Reference: NEC 110.3(B) - All equipment must be listed
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS ul_listing TEXT;

-- Temperature rise rating (e.g., 80°C, 115°C, 150°C)
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS temperature_rise INTEGER;

-- Additional notes for equipment specifications
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN transformers.winding_type IS 'Winding type (Dry-type, Liquid-filled)';
COMMENT ON COLUMN transformers.impedance_percent IS 'Transformer impedance percentage (e.g., 5.75%)';
COMMENT ON COLUMN transformers.cooling_type IS 'Cooling type (AA, AN, FA, etc.)';
COMMENT ON COLUMN transformers.ul_listing IS 'UL listing information per NEC 110.3(B)';
COMMENT ON COLUMN transformers.temperature_rise IS 'Temperature rise rating in °C (80, 115, 150)';
COMMENT ON COLUMN transformers.notes IS 'Additional equipment specification notes';

-- ============================================================================
-- INDEXES (Optional - improve query performance)
-- ============================================================================

-- Index on manufacturer for quick filtering
CREATE INDEX IF NOT EXISTS idx_panels_manufacturer ON panels(manufacturer);
CREATE INDEX IF NOT EXISTS idx_transformers_manufacturer ON transformers(manufacturer);

-- Index on AIC rating for compliance queries
CREATE INDEX IF NOT EXISTS idx_panels_aic_rating ON panels(aic_rating);

-- ============================================================================
-- NOTES
-- ============================================================================

-- All new fields are optional (nullable) to avoid breaking existing data
-- Equipment specifications will be used for:
--   1. Permit packet generation (equipment schedules)
--   2. NEC 110.9 compliance validation (AIC vs. fault current)
--   3. Professional PDF export
--
-- Standard AIC ratings: 10, 14, 22, 25, 42, 65, 100, 200 kA
-- Common NEMA types: 1 (indoor), 3R (outdoor rainproof), 4X (outdoor corrosion-resistant)
--
-- After running this migration, regenerate TypeScript types:
--   npx supabase gen types typescript --local > lib/database.types.ts
