-- Migration: Add fed_from_circuit_number to panels table
-- Purpose: Allow sub-panels to be assigned to specific breaker slots in parent panel
-- When NULL = feed-thru lug (not breaker-fed), when set = breaker position in parent

ALTER TABLE panels
ADD COLUMN IF NOT EXISTS fed_from_circuit_number INTEGER DEFAULT NULL;

COMMENT ON COLUMN panels.fed_from_circuit_number IS
  'Circuit/breaker number in parent panel where this sub-panel is fed from. NULL = feed-thru lug (not breaker-fed)';

-- Add check constraint to ensure valid circuit numbers (1-84 covers most panel sizes)
ALTER TABLE panels
ADD CONSTRAINT panels_fed_from_circuit_number_range
CHECK (fed_from_circuit_number IS NULL OR (fed_from_circuit_number >= 1 AND fed_from_circuit_number <= 84));
