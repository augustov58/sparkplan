-- Migration: Add Meter Stack and Meters tables for Multi-Family Projects
-- Date: 2026-02-08
-- Purpose: Support CT cabinet / meter stack entities for multi-family buildings
--
-- Multi-family buildings use meter stacks (CT cabinets) between the utility
-- and MDP. This migration adds:
-- 1. meter_stacks table - CT cabinet specifications
-- 2. meters table - individual meter positions within a stack
-- 3. Extends panels table with fed_from_meter_stack_id for MDP→meter stack relationships
--
-- NEC References:
-- - NEC 408 - Switchboards, Panelboards, and Distribution Boards
-- - NEC 230 - Services
-- - NEC 312 - Cabinets, Cutout Boxes, and Meter Socket Enclosures

-- ============================================
-- 1. Create meter_stacks table (CT Cabinet)
-- ============================================

CREATE TABLE IF NOT EXISTS meter_stacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'CT Cabinet',
  location TEXT,
  bus_rating_amps INTEGER NOT NULL DEFAULT 400,
  voltage INTEGER NOT NULL DEFAULT 208,
  phase INTEGER NOT NULL DEFAULT 3,
  num_meter_positions INTEGER NOT NULL DEFAULT 12,
  ct_ratio TEXT,
  manufacturer TEXT,
  model_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT meter_stacks_bus_rating_positive CHECK (bus_rating_amps > 0),
  CONSTRAINT meter_stacks_voltage_valid CHECK (voltage IN (120, 208, 240, 277, 480, 600)),
  CONSTRAINT meter_stacks_phase_valid CHECK (phase IN (1, 3)),
  CONSTRAINT meter_stacks_positions_positive CHECK (num_meter_positions > 0 AND num_meter_positions <= 200)
);

-- RLS policies (same pattern as panels)
ALTER TABLE meter_stacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meter_stacks"
  ON meter_stacks FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own meter_stacks"
  ON meter_stacks FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own meter_stacks"
  ON meter_stacks FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own meter_stacks"
  ON meter_stacks FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meter_stacks_project ON meter_stacks(project_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE meter_stacks;

-- Comments
COMMENT ON TABLE meter_stacks IS 'CT cabinet / meter stack for multi-family buildings. Contains multiple meter positions.';
COMMENT ON COLUMN meter_stacks.bus_rating_amps IS 'Main bus rating of the CT cabinet in amps';
COMMENT ON COLUMN meter_stacks.ct_ratio IS 'Current transformer ratio (e.g., 200:5, 400:5)';
COMMENT ON COLUMN meter_stacks.num_meter_positions IS 'Total available meter positions in the cabinet';

-- ============================================
-- 2. Create meters table (Individual Meters)
-- ============================================

CREATE TABLE IF NOT EXISTS meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meter_stack_id UUID NOT NULL REFERENCES meter_stacks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  meter_type TEXT NOT NULL DEFAULT 'unit',
  position_number INTEGER,
  panel_id UUID REFERENCES panels(id) ON DELETE SET NULL,
  breaker_amps INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT meters_type_valid CHECK (meter_type IN ('unit', 'house', 'ev', 'common')),
  CONSTRAINT meters_position_positive CHECK (position_number IS NULL OR position_number > 0),
  CONSTRAINT meters_breaker_positive CHECK (breaker_amps IS NULL OR breaker_amps > 0)
);

-- RLS policies
ALTER TABLE meters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meters"
  ON meters FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own meters"
  ON meters FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own meters"
  ON meters FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own meters"
  ON meters FOR DELETE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meters_project ON meters(project_id);
CREATE INDEX IF NOT EXISTS idx_meters_meter_stack ON meters(meter_stack_id);
CREATE INDEX IF NOT EXISTS idx_meters_panel ON meters(panel_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE meters;

-- Comments
COMMENT ON TABLE meters IS 'Individual meter positions within a meter stack. Each meter serves a specific unit, house panel, or EV panel.';
COMMENT ON COLUMN meters.meter_type IS 'unit = dwelling unit, house = common/house panel, ev = EV charging panel, common = common area';
COMMENT ON COLUMN meters.position_number IS 'Physical position number in the meter stack cabinet';
COMMENT ON COLUMN meters.panel_id IS 'FK to the panel this meter feeds (unit panel, house panel, etc.)';

-- ============================================
-- 3. Extend panels table for meter stack support
-- ============================================

-- Add fed_from_meter_stack_id column
ALTER TABLE panels
ADD COLUMN IF NOT EXISTS fed_from_meter_stack_id UUID REFERENCES meter_stacks(id) ON DELETE SET NULL;

COMMENT ON COLUMN panels.fed_from_meter_stack_id IS 'FK to meter stack that feeds this panel. Used when fed_from_type = meter_stack (multi-family MDP).';

CREATE INDEX IF NOT EXISTS idx_panels_fed_from_meter_stack ON panels(fed_from_meter_stack_id);

-- Update fed_from_type CHECK constraint to include 'meter_stack'
-- First drop existing constraint if it exists
ALTER TABLE panels DROP CONSTRAINT IF EXISTS panels_fed_from_type_check;

-- Add new constraint that includes 'meter_stack'
ALTER TABLE panels ADD CONSTRAINT panels_fed_from_type_check
  CHECK (fed_from_type IS NULL OR fed_from_type IN ('service', 'panel', 'transformer', 'meter_stack'));

-- Update discriminated union constraint to include 'meter_stack' case
ALTER TABLE panels DROP CONSTRAINT IF EXISTS panels_fed_from_check;
ALTER TABLE panels ADD CONSTRAINT panels_fed_from_check CHECK (
    (fed_from_type = 'service' AND fed_from IS NULL AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'panel' AND (fed_from IS NOT NULL OR is_main = FALSE) AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'transformer' AND fed_from IS NULL AND fed_from_transformer_id IS NOT NULL) OR
    (fed_from_type = 'meter_stack' AND fed_from IS NULL AND fed_from_transformer_id IS NULL)
);
