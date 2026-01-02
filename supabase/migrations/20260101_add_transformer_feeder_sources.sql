-- ============================================================================
-- ADD TRANSFORMER FEEDER SOURCES
-- ============================================================================
-- Created: 2026-01-01
-- Purpose: Allow transformers as feeder sources (not just destinations)
-- Issue: #30 - Cannot select transformer as source for feeder
--
-- Changes:
--   1. Add source_transformer_id column
--   2. Update CHECK constraint to allow transformer sources
--   3. Ensure exactly ONE source (panel XOR transformer)
-- ============================================================================

-- Add source_transformer_id column
ALTER TABLE feeders
ADD COLUMN IF NOT EXISTS source_transformer_id UUID REFERENCES transformers(id) ON DELETE SET NULL;

-- Drop old CHECK constraint that only allowed panel sources
ALTER TABLE feeders
DROP CONSTRAINT IF EXISTS feeders_destination_check;

-- Add new CHECK constraint allowing either panel OR transformer as source, and either panel OR transformer as destination
ALTER TABLE feeders
ADD CONSTRAINT feeders_source_and_destination_check CHECK (
  -- Exactly ONE source (panel XOR transformer)
  (
    (source_panel_id IS NOT NULL AND source_transformer_id IS NULL) OR
    (source_panel_id IS NULL AND source_transformer_id IS NOT NULL)
  )
  AND
  -- Exactly ONE destination (panel XOR transformer)
  (
    (destination_panel_id IS NOT NULL AND destination_transformer_id IS NULL) OR
    (destination_panel_id IS NULL AND destination_transformer_id IS NOT NULL)
  )
);

-- Add index for source_transformer_id for query performance
CREATE INDEX IF NOT EXISTS idx_feeders_source_transformer ON feeders(source_transformer_id);

-- Add comment to table
COMMENT ON COLUMN feeders.source_transformer_id IS 'Transformer serving as feeder source (mutually exclusive with source_panel_id)';
