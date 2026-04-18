-- Support System: Event Log + Investigation Scaffolding
--
-- Adds two tables to make the support system observable and extensible:
--   1. support_ticket_events — append-only log of everything that happens to a ticket
--      (creation, replies, status changes, source: widget/dashboard/email). Source of
--      truth for analytics, audit, and future event-driven handlers.
--   2. support_ticket_investigations — durable record of AI-driven (or human) investigations
--      linked to a ticket. Claude Code integration is deferred, but the schema and lifecycle
--      columns are shaped to accept it without migration churn.
--
-- Design principles:
--   - Events are append-only, never updated. Downstream handlers read-only.
--   - Investigations are the "side channel" where automated tooling writes findings back.
--   - Both tables are admin-read-only via RLS (service_role writes on behalf of the system).
--   - The Slack / Claude / etc. integration is a handler that reads events + writes
--     investigation rows. The handler itself is NOT implemented here — just the surface.

-- ============================================
-- 1. support_ticket_events (append-only log)
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,

  -- What happened
  event_type TEXT NOT NULL CHECK (event_type IN (
    'ticket_created',
    'user_reply',
    'admin_reply',
    'status_changed',
    'priority_changed',
    'investigation_requested',
    'investigation_completed'
  )),

  -- Where the action originated (useful for analytics + selective handler filtering)
  source TEXT NOT NULL CHECK (source IN ('widget', 'dashboard', 'email', 'system')),

  -- Per-event payload. Handlers read whatever they need from here.
  -- For a reply event: { reply_id, message_preview, is_admin, author_email }
  -- For status_changed: { old_status, new_status }
  -- For ticket_created: { category, subject, plan_tier, page_url }
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_ticket_events_ticket_id_idx
  ON public.support_ticket_events(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_events_event_type_idx
  ON public.support_ticket_events(event_type, created_at DESC);

ALTER TABLE public.support_ticket_events ENABLE ROW LEVEL SECURITY;

-- Admin-only read access (events are internal diagnostic data, not user-facing)
CREATE POLICY "Admin can view all events"
  ON public.support_ticket_events FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

-- Nobody writes via RLS; service_role (edge functions) is the only writer.
GRANT SELECT ON public.support_ticket_events TO authenticated;
GRANT ALL ON public.support_ticket_events TO service_role;

COMMENT ON TABLE public.support_ticket_events IS
  'Append-only event log for support ticket lifecycle. Powers future event-driven handlers (AI investigation, Slack notifications, etc.)';


-- ============================================
-- 2. support_ticket_investigations (AI/human investigation records)
-- ============================================
--
-- Future Claude Code integration will INSERT a row here with status='pending' when a
-- triggering event fires, then update it to status='completed' with findings populated.
-- Schema is forward-compatible — the Claude integration only needs to write, not migrate.

CREATE TABLE IF NOT EXISTS public.support_ticket_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  triggered_by_event_id UUID REFERENCES public.support_ticket_events(id) ON DELETE SET NULL,

  -- Which investigator ran (for multiple engines down the road: claude-code, internal-runbook, human)
  investigator TEXT NOT NULL DEFAULT 'claude-code'
    CHECK (investigator IN ('claude-code', 'human', 'automated-check')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),

  -- Human-readable summary of what the investigator found
  findings TEXT,

  -- Structured outputs: reproduction steps, code refs, suspected files, log excerpts, etc.
  -- Shape intentionally loose — each investigator defines its own.
  artifacts JSONB DEFAULT '{}'::jsonb,

  -- Where we pushed the findings ('slack', 'email', 'admin-panel', or null if not yet notified).
  -- Null until the notification handler runs.
  notified_via TEXT CHECK (notified_via IN ('slack', 'email', 'admin-panel')),
  notified_at TIMESTAMPTZ,

  -- Error details if status='failed'
  error_message TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_ticket_investigations_ticket_id_idx
  ON public.support_ticket_investigations(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_ticket_investigations_status_idx
  ON public.support_ticket_investigations(status)
  WHERE status IN ('pending', 'running');

ALTER TABLE public.support_ticket_investigations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view all investigations"
  ON public.support_ticket_investigations FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

GRANT SELECT ON public.support_ticket_investigations TO authenticated;
GRANT ALL ON public.support_ticket_investigations TO service_role;

-- Reuse the shared updated_at trigger function
DROP TRIGGER IF EXISTS update_support_investigations_updated_at
  ON public.support_ticket_investigations;
CREATE TRIGGER update_support_investigations_updated_at
  BEFORE UPDATE ON public.support_ticket_investigations
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

-- Realtime so the admin panel can show live investigation progress when the handler is added
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_ticket_investigations;

COMMENT ON TABLE public.support_ticket_investigations IS
  'Records of automated or human investigations attached to support tickets. Claude Code integration writes here when implemented.';


-- ============================================
-- 3. Gmail watermark (for polling state)
-- ============================================
--
-- Tracks the historyId of the last Gmail sync so each poll only fetches new messages.
-- Single-row singleton pattern — `id` is fixed at 1.

CREATE TABLE IF NOT EXISTS public.support_gmail_sync_state (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_history_id TEXT,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.support_gmail_sync_state (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.support_gmail_sync_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin reads gmail sync state"
  ON public.support_gmail_sync_state FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

GRANT SELECT ON public.support_gmail_sync_state TO authenticated;
GRANT ALL ON public.support_gmail_sync_state TO service_role;

COMMENT ON TABLE public.support_gmail_sync_state IS
  'Singleton row tracking Gmail API polling watermark. Ensures each poll only processes new messages.';
