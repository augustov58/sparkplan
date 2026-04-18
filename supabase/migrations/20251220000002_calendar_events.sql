-- Calendar Events Table
-- Created: 2025-12-20
-- Purpose: Track project deadlines, inspections, meetings, and milestones

-- Create calendar events table
CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  title TEXT NOT NULL,
  description TEXT,
  event_date TIMESTAMPTZ NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'Deadline' CHECK (event_type IN ('Deadline', 'Inspection', 'Meeting', 'Milestone', 'Site Visit')),

  -- Optional location
  location TEXT,

  -- Related items (optional links)
  related_rfi_id UUID REFERENCES public.rfis(id) ON DELETE SET NULL,
  related_site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE SET NULL,

  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_calendar_events_project ON calendar_events(project_id);
CREATE INDEX idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX idx_calendar_events_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_events_type ON calendar_events(event_type);
CREATE INDEX idx_calendar_events_upcoming ON calendar_events(event_date) WHERE NOT completed;

-- RLS Policies
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Users can only access their own calendar events
CREATE POLICY "Users manage own calendar events" ON calendar_events
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update timestamp trigger
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE calendar_events IS 'Project calendar events including deadlines, inspections, and meetings';
COMMENT ON COLUMN calendar_events.event_type IS 'Type of event: Deadline, Inspection, Meeting, Milestone, or Site Visit';
COMMENT ON COLUMN calendar_events.related_rfi_id IS 'Optional link to related RFI';
COMMENT ON COLUMN calendar_events.related_site_visit_id IS 'Optional link to related site visit';
