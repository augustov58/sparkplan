-- Migration: Add Panels Table and Update Circuits
-- Run this in your Supabase SQL Editor
-- This adds the panels management system to your existing database

-- ============================================================================
-- STEP 1: CREATE PANELS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.panels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    bus_rating INTEGER NOT NULL CHECK (bus_rating > 0),
    voltage INTEGER NOT NULL,
    phase INTEGER NOT NULL CHECK (phase IN (1, 3)),
    main_breaker_amps INTEGER,
    location TEXT,
    fed_from UUID REFERENCES public.panels(id) ON DELETE SET NULL,
    is_main BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_panels_project_id ON public.panels(project_id);
CREATE INDEX IF NOT EXISTS idx_panels_fed_from ON public.panels(fed_from);

-- Enable Row Level Security
ALTER TABLE public.panels ENABLE ROW LEVEL SECURITY;

-- Policies: Users can manage panels for their own projects
CREATE POLICY "Users can view panels for own projects"
    ON public.panels FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create panels for own projects"
    ON public.panels FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update panels for own projects"
    ON public.panels FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete panels for own projects"
    ON public.panels FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects
            WHERE projects.id = panels.project_id
            AND projects.user_id = auth.uid()
        )
    );

-- ============================================================================
-- STEP 2: ADD PANEL_ID TO CIRCUITS TABLE
-- ============================================================================

-- Add panel_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'circuits'
        AND column_name = 'panel_id'
    ) THEN
        ALTER TABLE public.circuits
        ADD COLUMN panel_id UUID REFERENCES public.panels(id) ON DELETE CASCADE;

        -- Add index
        CREATE INDEX idx_circuits_panel_id ON public.circuits(panel_id);
    END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (Optional - run these to verify the migration worked)
-- ============================================================================

-- Check if panels table exists and has correct structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'panels' AND table_schema = 'public'
-- ORDER BY ordinal_position;

-- Check if panel_id was added to circuits
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'circuits' AND column_name = 'panel_id';

-- ============================================================================
-- NOTES
-- ============================================================================
-- After running this migration:
-- 1. Existing circuits will have NULL panel_id (you'll need to assign them)
-- 2. New projects will auto-create a Main Distribution Panel
-- 3. You can now add subpanels and assign circuits to specific panels
