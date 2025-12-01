-- Migration: Add Transformers Support
-- Run this in your Supabase SQL Editor
-- This adds transformer management and updates panel relationships

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
        ALTER TABLE public.panels
        ADD COLUMN fed_from_type TEXT DEFAULT 'panel' CHECK (fed_from_type IN ('panel', 'transformer', 'service'));
    END IF;

    -- Add fed_from_transformer_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'panels'
        AND column_name = 'fed_from_transformer_id'
    ) THEN
        ALTER TABLE public.panels
        ADD COLUMN fed_from_transformer_id UUID REFERENCES public.transformers(id) ON DELETE SET NULL;

        -- Add index
        CREATE INDEX idx_panels_fed_from_transformer ON public.panels(fed_from_transformer_id);
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
-- STEP 3: ADD CONSTRAINT TO ENSURE PANEL FED_FROM IS CONSISTENT
-- ============================================================================

-- Add check constraint to ensure panel is fed from either panel OR transformer, not both
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'panels' AND constraint_name = 'panels_fed_from_check'
    ) THEN
        ALTER TABLE public.panels
        ADD CONSTRAINT panels_fed_from_check CHECK (
            (fed_from_type = 'service' AND fed_from IS NULL AND fed_from_transformer_id IS NULL) OR
            (fed_from_type = 'panel' AND fed_from IS NOT NULL AND fed_from_transformer_id IS NULL) OR
            (fed_from_type = 'transformer' AND fed_from IS NULL AND fed_from_transformer_id IS NOT NULL)
        );
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify the migration worked)
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

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this migration:
-- 1. Panels can now be fed from transformers (fed_from_type = 'transformer')
-- 2. Transformers track primary and secondary voltages
-- 3. System will automatically show transformers in one-line diagrams
-- 4. Existing panels will have fed_from_type = 'panel' by default
