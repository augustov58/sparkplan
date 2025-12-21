-- Create short_circuit_calculations table for project-integrated fault current tracking
-- Allows users to save calculations, associate with panels, and generate reports

CREATE TABLE IF NOT EXISTS public.short_circuit_calculations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Association with panel (optional - can be service-level or panel-level)
  panel_id UUID REFERENCES public.panels(id) ON DELETE SET NULL,
  location_name TEXT NOT NULL, -- e.g., "Service Entrance", "Panel H1", "LP-2"

  -- Calculation type
  calculation_type TEXT NOT NULL CHECK (calculation_type IN ('service', 'panel')),

  -- Service-level inputs (for transformer-based calculations)
  service_amps INTEGER,
  service_voltage INTEGER,
  service_phase INTEGER CHECK (service_phase IN (1, 3)),
  transformer_kva NUMERIC,
  transformer_impedance NUMERIC,

  -- Panel/downstream inputs (for point-to-point method)
  source_fault_current NUMERIC, -- Available fault current at upstream point (amperes)
  feeder_length NUMERIC, -- feet
  feeder_conductor_size TEXT,
  feeder_material TEXT CHECK (feeder_material IN ('Cu', 'Al')),
  feeder_conduit_type TEXT CHECK (feeder_conduit_type IN ('Steel', 'PVC', 'Aluminum')),
  feeder_voltage INTEGER,
  feeder_phase INTEGER CHECK (feeder_phase IN (1, 3)),

  -- Calculation results (stored as JSONB for flexibility)
  -- Contains: faultCurrent, requiredAIC, details, compliance
  results JSONB NOT NULL,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_sc_calc_project ON public.short_circuit_calculations(project_id);
CREATE INDEX IF NOT EXISTS idx_sc_calc_panel ON public.short_circuit_calculations(panel_id);
CREATE INDEX IF NOT EXISTS idx_sc_calc_user ON public.short_circuit_calculations(user_id);
CREATE INDEX IF NOT EXISTS idx_sc_calc_created ON public.short_circuit_calculations(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.short_circuit_calculations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own calculations

-- SELECT: Users can view their own calculations
CREATE POLICY "Users can view own short circuit calculations"
  ON public.short_circuit_calculations
  FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT: Users can create calculations
CREATE POLICY "Users can insert own short circuit calculations"
  ON public.short_circuit_calculations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Users can update their own calculations
CREATE POLICY "Users can update own short circuit calculations"
  ON public.short_circuit_calculations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: Users can delete their own calculations
CREATE POLICY "Users can delete own short circuit calculations"
  ON public.short_circuit_calculations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add helpful comment
COMMENT ON TABLE public.short_circuit_calculations IS 'Stores short circuit / fault current calculations associated with projects and panels for NEC 110.9 compliance tracking and permit documentation';
