-- Migration: Add Transformers Support (FIXED VERSION)
-- Run this in your Supabase SQL Editor
-- This version properly handles existing panel data

-- ============================================================================
-- STEP 1: CREATE TRANSFORMERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transformers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    location TEXT,

    -- Transformer ratings
    kva_rating INTEGER NOT NULL CHECK (kva_rating > 0),

    -- Primary side (input from upstream panel)
    primary_voltage INTEGER NOT NULL,
    primary_phase INTEGER NOT NULL CHECK (primary_phase IN (1, 3)),
    primary_breaker_amps INTEGER NOT NULL,
    primary_conductor_size TEXT,

    -- Secondary side (output to downstream panels)
    secondary_voltage INTEGER NOT NULL,
    secondary_phase INTEGER NOT NULL CHECK (secondary_phase IN (1, 3)),
    secondary_breaker_amps INTEGER,
    secondary_conductor_size TEXT,

    -- Connection and characteristics
    connection_type TEXT DEFAULT 'delta-wye' CHECK (connection_type IN ('delta-wye', 'wye-wye', 'delta-delta')),
    impedance_percent DECIMAL(4,2) DEFAULT 5.75,

    -- Relationships
    fed_from_panel_id UUID REFERENCES public.panels(id) ON DELETE SET NULL,

    -- Metadata
    manufacturer TEXT,
    catalog_number TEXT,
    nema_type TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transformers_project_id ON public.transformers(project_id);
CREATE INDEX IF NOT EXISTS idx_transformers_fed_from_panel ON public.transformers(fed_from_panel_id);

-- Enable Row Level Security
ALTER TABLE public.transformers ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage transformers for their own projects
CREATE POLICY "Users can view transformers for own projects"
    ON public.transformers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = transformers.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create transformers for own projects"
    ON public.transformers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = transformers.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update transformers for own projects"
    ON public.transformers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = transformers.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete transformers for own projects"
    ON public.transformers FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = transformers.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 2: UPDATE PANELS TABLE TO SUPPORT TRANSFORMER RELATIONSHIPS
-- ============================================================================

-- Add columns to track what feeds a panel (panel OR transformer)
DO $$
BEGIN
    -- Add fed_from_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'panels'
        AND column_name = 'fed_from_type'
    ) THEN
        ALTER TABLE public.panels ADD COLUMN fed_from_type TEXT;
    END IF;

    -- Add fed_from_transformer_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'panels'
        AND column_name = 'fed_from_transformer_id'
    ) THEN
        ALTER TABLE public.panels ADD COLUMN fed_from_transformer_id UUID REFERENCES public.transformers(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_panels_fed_from_transformer ON public.panels(fed_from_transformer_id);
    END IF;

    -- Add feeder information columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'panels'
        AND column_name = 'feeder_breaker_amps'
    ) THEN
        ALTER TABLE public.panels
        ADD COLUMN feeder_breaker_amps INTEGER,
        ADD COLUMN feeder_conductor_size TEXT,
        ADD COLUMN feeder_conduit TEXT,
        ADD COLUMN feeder_length INTEGER;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: FIX EXISTING DATA TO MEET CONSTRAINT REQUIREMENTS
-- ============================================================================

-- Update existing panels to have proper fed_from_type values
-- Main panels get 'service'
UPDATE public.panels
SET fed_from_type = 'service'
WHERE is_main = TRUE AND fed_from_type IS NULL;

-- Panels with fed_from set get 'panel'
UPDATE public.panels
SET fed_from_type = 'panel'
WHERE is_main = FALSE AND fed_from IS NOT NULL AND fed_from_type IS NULL;

-- Panels without fed_from (orphaned subpanels) get 'panel' with null fed_from
-- These will need to be manually reassigned by the user
UPDATE public.panels
SET fed_from_type = 'panel'
WHERE is_main = FALSE AND fed_from IS NULL AND fed_from_type IS NULL;

-- ============================================================================
-- STEP 4: ADD CONSTRAINT (NOW THAT DATA IS CLEAN)
-- ============================================================================

-- Drop constraint if it exists (in case this is being re-run)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'panels_fed_from_check' AND table_name = 'panels'
    ) THEN
        ALTER TABLE public.panels DROP CONSTRAINT panels_fed_from_check;
    END IF;
END $$;

-- Add the constraint
ALTER TABLE public.panels
ADD CONSTRAINT panels_fed_from_check CHECK (
    (fed_from_type = 'service' AND fed_from IS NULL AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'panel' AND (fed_from IS NOT NULL OR is_main = FALSE) AND fed_from_transformer_id IS NULL) OR
    (fed_from_type = 'transformer' AND fed_from IS NULL AND fed_from_transformer_id IS NOT NULL)
);

-- ============================================================================
-- VERIFICATION QUERIES (Optional - uncomment to check results)
-- ============================================================================

-- Check if transformers table exists and has correct structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'transformers' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check if panel columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'panels' AND column_name IN ('fed_from_type', 'fed_from_transformer_id', 'feeder_breaker_amps')
-- ORDER BY ordinal_position;

-- Check existing panels to see their fed_from_type values
-- SELECT id, name, is_main, fed_from, fed_from_type, fed_from_transformer_id
-- FROM public.panels
-- ORDER BY is_main DESC, name;

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this migration:
-- 1. All existing main panels have fed_from_type = 'service'
-- 2. All existing subpanels have fed_from_type = 'panel'
-- 3. Panels can now be fed from transformers (fed_from_type = 'transformer')
-- 4. Transformers track primary and secondary voltages
-- 5. System will automatically show transformers in one-line diagrams
-- 6. If you have orphaned panels (fed_from = null, is_main = false), you'll need to reassign them
