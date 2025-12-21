-- Phase 0: Basic Project Management Features
-- RFI tracking, site visits, calendar events
-- Created: 2025-12-19

-- =======================
-- 1. RFIs Table
-- =======================
CREATE TABLE IF NOT EXISTS public.rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- RFI identification
  rfi_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Answered', 'Closed')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),

  -- Assignment
  assigned_to TEXT,
  requested_by TEXT,
  responded_by TEXT,

  -- Dates
  due_date TIMESTAMPTZ,
  response_date TIMESTAMPTZ,
  closed_date TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =======================
-- 2. Site Visits Table
-- =======================
CREATE TABLE IF NOT EXISTS public.site_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Visit details
  visit_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  visit_type TEXT NOT NULL DEFAULT 'Site Inspection',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  weather_conditions TEXT,

  -- People present
  attendees TEXT[],
  inspector_name TEXT,

  -- Follow-up
  issues_found TEXT[],
  action_items TEXT[],
  next_visit_date TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'Completed',
  duration_hours NUMERIC,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =======================
-- 3. Calendar Events Table
-- =======================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL DEFAULT 'Deadline',
  event_date TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT false,

  -- Status
  status TEXT NOT NULL DEFAULT 'Upcoming' CHECK (status IN ('Upcoming', 'Completed', 'Cancelled')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),

  -- Associations (link to RFIs, site visits, etc.)
  related_rfi_id UUID REFERENCES public.rfis(id) ON DELETE SET NULL,

  -- Notifications
  reminder_hours_before INTEGER,
  location TEXT,
  attendees TEXT[],
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =======================
-- Indexes
-- =======================

-- RFIs
CREATE INDEX idx_rfis_project ON rfis(project_id);
CREATE INDEX idx_rfis_user ON rfis(user_id);
CREATE INDEX idx_rfis_status ON rfis(status);
CREATE INDEX idx_rfis_priority ON rfis(priority);
CREATE INDEX idx_rfis_due_date ON rfis(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_rfis_created ON rfis(created_at DESC);

-- Site Visits
CREATE INDEX idx_site_visits_project ON site_visits(project_id);
CREATE INDEX idx_site_visits_user ON site_visits(user_id);
CREATE INDEX idx_site_visits_date ON site_visits(visit_date DESC);
CREATE INDEX idx_site_visits_status ON site_visits(status);
CREATE INDEX idx_site_visits_created ON site_visits(created_at DESC);

-- Calendar Events
CREATE INDEX idx_calendar_events_project ON calendar_events(project_id);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_status ON calendar_events(status);
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX idx_calendar_events_related_rfi ON calendar_events(related_rfi_id) WHERE related_rfi_id IS NOT NULL;

-- =======================
-- RLS Policies
-- =======================

-- RFIs
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RFIs for own projects" ON rfis
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = rfis.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert RFIs for own projects" ON rfis
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = rfis.project_id
      AND projects.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update RFIs for own projects" ON rfis
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = rfis.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete RFIs for own projects" ON rfis
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = rfis.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Site Visits
ALTER TABLE site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view site visits for own projects" ON site_visits
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = site_visits.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert site visits for own projects" ON site_visits
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = site_visits.project_id
      AND projects.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update site visits for own projects" ON site_visits
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = site_visits.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete site visits for own projects" ON site_visits
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = site_visits.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Calendar Events
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view calendar events for own projects" ON calendar_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = calendar_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert calendar events for own projects" ON calendar_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = calendar_events.project_id
      AND projects.user_id = auth.uid()
    )
    AND auth.uid() = user_id
  );

CREATE POLICY "Users can update calendar events for own projects" ON calendar_events
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = calendar_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete calendar events for own projects" ON calendar_events
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = calendar_events.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- =======================
-- Auto-update triggers
-- =======================

-- RFIs
CREATE TRIGGER update_rfis_updated_at
  BEFORE UPDATE ON rfis
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Site Visits
CREATE TRIGGER update_site_visits_updated_at
  BEFORE UPDATE ON site_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Calendar Events
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- Helper Functions
-- =======================

-- Auto-generate RFI number
CREATE OR REPLACE FUNCTION generate_rfi_number(p_project_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(rfi_number FROM 'RFI-(\d+)') AS INTEGER)), 0) + 1
  INTO next_number
  FROM rfis
  WHERE project_id = p_project_id;

  RETURN 'RFI-' || LPAD(next_number::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
