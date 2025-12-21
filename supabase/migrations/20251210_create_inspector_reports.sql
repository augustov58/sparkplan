-- Create inspector_reports table for persisting Inspector Mode AI reports
-- This allows users to view historical inspection results

CREATE TABLE IF NOT EXISTS public.inspector_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inspection results
  score INTEGER NOT NULL,
  total_checks INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  warnings INTEGER NOT NULL,
  critical INTEGER NOT NULL,

  -- JSON data
  issues JSONB DEFAULT '[]'::jsonb,
  passed_checks JSONB DEFAULT '[]'::jsonb,
  nec_articles_referenced TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Timestamps
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_inspector_reports_project_id ON public.inspector_reports(project_id);
CREATE INDEX idx_inspector_reports_user_id ON public.inspector_reports(user_id);
CREATE INDEX idx_inspector_reports_inspected_at ON public.inspector_reports(inspected_at DESC);

-- Row Level Security (RLS)
ALTER TABLE public.inspector_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own reports
CREATE POLICY "Users can view their own inspector reports"
  ON public.inspector_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own reports
CREATE POLICY "Users can create their own inspector reports"
  ON public.inspector_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own reports
CREATE POLICY "Users can update their own inspector reports"
  ON public.inspector_reports
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own reports
CREATE POLICY "Users can delete their own inspector reports"
  ON public.inspector_reports
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_inspector_reports_updated_at
  BEFORE UPDATE ON public.inspector_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comment on table
COMMENT ON TABLE public.inspector_reports IS 'Stores Inspector Mode AI inspection reports for projects';
