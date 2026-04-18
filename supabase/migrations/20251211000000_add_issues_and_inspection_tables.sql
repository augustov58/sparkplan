-- Migration to add issues and inspection_items tables with proper column checking
-- Handles existing tables by adding missing columns

-- ============================================================================
-- ISSUES TABLE - Add missing columns if needed
-- ============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  article TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to issues table
DO $$
BEGIN
    -- Add user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'issues'
                   AND column_name = 'user_id') THEN
        ALTER TABLE public.issues ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add assigned_to if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'issues'
                   AND column_name = 'assigned_to') THEN
        ALTER TABLE public.issues ADD COLUMN assigned_to TEXT;
    END IF;

    -- Add notes if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'issues'
                   AND column_name = 'notes') THEN
        ALTER TABLE public.issues ADD COLUMN notes TEXT;
    END IF;

    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'issues'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.issues ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Add constraints to issues table if they don't exist
DO $$
BEGIN
    -- Add severity check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_severity_check') THEN
        ALTER TABLE public.issues ADD CONSTRAINT issues_severity_check
        CHECK (severity IN ('Critical', 'Warning', 'Info'));
    END IF;

    -- Add status check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'issues_status_check') THEN
        ALTER TABLE public.issues ADD CONSTRAINT issues_status_check
        CHECK (status IN ('Open', 'Resolved'));
    END IF;
END $$;

-- ============================================================================
-- INSPECTION ITEMS TABLE
-- ============================================================================

-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  requirement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns to inspection_items table
DO $$
BEGIN
    -- Add user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'inspection_items'
                   AND column_name = 'user_id') THEN
        ALTER TABLE public.inspection_items ADD COLUMN user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- Add notes if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'inspection_items'
                   AND column_name = 'notes') THEN
        ALTER TABLE public.inspection_items ADD COLUMN notes TEXT;
    END IF;

    -- Add photo_url if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'inspection_items'
                   AND column_name = 'photo_url') THEN
        ALTER TABLE public.inspection_items ADD COLUMN photo_url TEXT;
    END IF;

    -- Add inspection_date if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'inspection_items'
                   AND column_name = 'inspection_date') THEN
        ALTER TABLE public.inspection_items ADD COLUMN inspection_date TIMESTAMPTZ;
    END IF;

    -- Add updated_at if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'inspection_items'
                   AND column_name = 'updated_at') THEN
        ALTER TABLE public.inspection_items ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Add constraints to inspection_items table if they don't exist
DO $$
BEGIN
    -- Add status check constraint
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspection_items_status_check') THEN
        ALTER TABLE public.inspection_items ADD CONSTRAINT inspection_items_status_check
        CHECK (status IN ('Pending', 'Pass', 'Fail', 'N/A'));
    END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Issues indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issues_project_id') THEN
        CREATE INDEX idx_issues_project_id ON public.issues(project_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issues_user_id') THEN
        CREATE INDEX idx_issues_user_id ON public.issues(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issues_status') THEN
        CREATE INDEX idx_issues_status ON public.issues(status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issues_severity') THEN
        CREATE INDEX idx_issues_severity ON public.issues(severity);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_issues_created_at') THEN
        CREATE INDEX idx_issues_created_at ON public.issues(created_at DESC);
    END IF;
END $$;

-- Inspection items indexes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inspection_items_project_id') THEN
        CREATE INDEX idx_inspection_items_project_id ON public.inspection_items(project_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inspection_items_user_id') THEN
        CREATE INDEX idx_inspection_items_user_id ON public.inspection_items(user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inspection_items_status') THEN
        CREATE INDEX idx_inspection_items_status ON public.inspection_items(status);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_inspection_items_category') THEN
        CREATE INDEX idx_inspection_items_category ON public.inspection_items(category);
    END IF;
END $$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- ISSUES TABLE RLS
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own issues" ON public.issues;
DROP POLICY IF EXISTS "Users can create their own issues" ON public.issues;
DROP POLICY IF EXISTS "Users can update their own issues" ON public.issues;
DROP POLICY IF EXISTS "Users can delete their own issues" ON public.issues;

CREATE POLICY "Users can view their own issues"
  ON public.issues
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own issues"
  ON public.issues
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own issues"
  ON public.issues
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own issues"
  ON public.issues
  FOR DELETE
  USING (auth.uid() = user_id);

-- INSPECTION ITEMS TABLE RLS
ALTER TABLE public.inspection_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own inspection items" ON public.inspection_items;
DROP POLICY IF EXISTS "Users can create their own inspection items" ON public.inspection_items;
DROP POLICY IF EXISTS "Users can update their own inspection items" ON public.inspection_items;
DROP POLICY IF EXISTS "Users can delete their own inspection items" ON public.inspection_items;

CREATE POLICY "Users can view their own inspection items"
  ON public.inspection_items
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own inspection items"
  ON public.inspection_items
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inspection items"
  ON public.inspection_items
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inspection items"
  ON public.inspection_items
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- AUTO-UPDATE TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_issues_updated_at ON public.issues;
DROP TRIGGER IF EXISTS update_inspection_items_updated_at ON public.inspection_items;

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inspection_items_updated_at
  BEFORE UPDATE ON public.inspection_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.issues IS 'Stores NEC code violations and punch list items for projects';
COMMENT ON TABLE public.inspection_items IS 'Stores pre-inspection checklist items for rough-in and final inspections';
