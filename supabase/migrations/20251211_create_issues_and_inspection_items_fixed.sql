-- Create tables for Issues Log and Pre-Inspection Checklist
-- Enables persistent storage of violation tracking and inspection checklists
-- Uses IF NOT EXISTS to handle incremental migrations safely

-- ============================================================================
-- ISSUES TABLE (Violation Log & Punch List)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Issue details
  description TEXT NOT NULL,
  article TEXT NOT NULL, -- NEC Article reference (e.g., "110.12", "250.50")
  severity TEXT NOT NULL CHECK (severity IN ('Critical', 'Warning', 'Info')),
  status TEXT NOT NULL CHECK (status IN ('Open', 'Resolved')) DEFAULT 'Open',
  assigned_to TEXT,
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INSPECTION ITEMS TABLE (Pre-Inspection Checklist)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Checklist item details
  category TEXT NOT NULL, -- e.g., "Grounding", "Wiring Methods", "Service Equipment"
  requirement TEXT NOT NULL, -- Description of what to check
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Pass', 'Fail', 'N/A')) DEFAULT 'Pending',
  notes TEXT,

  -- Optional evidence/photo tracking
  photo_url TEXT, -- Future feature: photo upload URL
  inspection_date TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (using IF NOT EXISTS - safer for re-running migrations)
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

-- Drop policies if they exist, then recreate
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

-- Drop policies if they exist, then recreate
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

-- Drop triggers if they exist, then recreate
DROP TRIGGER IF EXISTS update_issues_updated_at ON public.issues;
DROP TRIGGER IF EXISTS update_inspection_items_updated_at ON public.inspection_items;

-- Trigger for issues table
CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for inspection_items table
CREATE TRIGGER update_inspection_items_updated_at
  BEFORE UPDATE ON public.inspection_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.issues IS 'Stores NEC code violations and punch list items for projects';
COMMENT ON TABLE public.inspection_items IS 'Stores pre-inspection checklist items for rough-in and final inspections';
