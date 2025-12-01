-- ============================================================================
-- Feeders Table Migration
-- NEC Article 215 - Feeder Sizing and Calculations
-- ============================================================================

-- Create feeders table
CREATE TABLE IF NOT EXISTS feeders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_panel_id uuid REFERENCES panels(id) ON DELETE SET NULL,
  destination_panel_id uuid REFERENCES panels(id) ON DELETE SET NULL,
  destination_transformer_id uuid REFERENCES transformers(id) ON DELETE SET NULL,
  distance_ft numeric NOT NULL CHECK (distance_ft > 0),
  conductor_material text NOT NULL CHECK (conductor_material IN ('Cu', 'Al')),
  conduit_type text,
  ambient_temperature_c integer DEFAULT 30 CHECK (ambient_temperature_c >= -40 AND ambient_temperature_c <= 100),
  num_current_carrying integer DEFAULT 3 CHECK (num_current_carrying >= 2),

  -- Calculated results (cached for display)
  total_load_va numeric,
  continuous_load_va numeric,
  noncontinuous_load_va numeric,
  design_load_va numeric,
  phase_conductor_size text,
  neutral_conductor_size text,
  egc_size text,
  conduit_size text,
  voltage_drop_percent numeric,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add constraint: must have either destination panel or transformer (but not both)
ALTER TABLE feeders ADD CONSTRAINT feeders_destination_check
  CHECK (
    (destination_panel_id IS NOT NULL AND destination_transformer_id IS NULL) OR
    (destination_panel_id IS NULL AND destination_transformer_id IS NOT NULL)
  );

-- Enable Row Level Security
ALTER TABLE feeders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own feeders"
  ON feeders FOR SELECT
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own feeders"
  ON feeders FOR INSERT
  WITH CHECK (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own feeders"
  ON feeders FOR UPDATE
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own feeders"
  ON feeders FOR DELETE
  USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Indexes for performance
CREATE INDEX idx_feeders_project_id ON feeders(project_id);
CREATE INDEX idx_feeders_source_panel ON feeders(source_panel_id);
CREATE INDEX idx_feeders_destination_panel ON feeders(destination_panel_id);
CREATE INDEX idx_feeders_destination_transformer ON feeders(destination_transformer_id);

-- Add supplied_by_feeder_id to panels table (tracks which feeder supplies each panel)
ALTER TABLE panels ADD COLUMN IF NOT EXISTS supplied_by_feeder_id uuid REFERENCES feeders(id) ON DELETE SET NULL;

-- Add supplied_by_feeder_id to transformers table (tracks which feeder supplies each transformer)
ALTER TABLE transformers ADD COLUMN IF NOT EXISTS supplied_by_feeder_id uuid REFERENCES feeders(id) ON DELETE SET NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_feeders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feeders_updated_at
BEFORE UPDATE ON feeders
FOR EACH ROW
EXECUTE FUNCTION update_feeders_updated_at();
