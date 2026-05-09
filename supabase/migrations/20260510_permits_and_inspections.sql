-- ============================================================================
-- PERMITS + INSPECTIONS (Phase 1 — Permits Beta v1)
-- ============================================================================
-- Created: 2026-05-10
-- Purpose: Adds the `permits` and `permit_inspections` tables to back the
--          new Permits page (replacing the PR #29 stub). Models the full
--          contractor-side permit lifecycle from draft → submitted → review
--          → approved → expired/closed plus 1:N inspections per permit.
--
-- Per Permits Implementation Plan (docs/plans/permits-implementation.md §4.2)
-- ============================================================================

-- -------------------------------------------------------------------------
-- permits
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Permit identification
  permit_number TEXT,                                    -- nullable until AHJ assigns one
  permit_type TEXT NOT NULL DEFAULT 'electrical',
  description TEXT,

  -- AHJ
  ahj_jurisdiction TEXT NOT NULL,
  ahj_contact_name TEXT,
  ahj_contact_email TEXT,
  ahj_contact_phone TEXT,

  -- Status lifecycle
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,

  -- Fees
  fee_amount NUMERIC(10,2),
  fee_paid_at TIMESTAMPTZ,
  fee_receipt_url TEXT,

  -- Plan review reference (AHJ-side ID)
  plan_review_id TEXT,

  -- Conditions / notes / packet linkage
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  packet_url TEXT,
  packet_generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT permits_status_known
    CHECK (status IN ('draft','submitted','in_review','returned','approved','expired','closed','cancelled')),
  CONSTRAINT permits_type_known
    CHECK (permit_type IN ('electrical','evse','low_voltage','service_upgrade','other')),
  CONSTRAINT permits_email_format
    CHECK (ahj_contact_email IS NULL OR ahj_contact_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_permits_project ON public.permits(project_id);
CREATE INDEX IF NOT EXISTS idx_permits_status ON public.permits(status, expires_at)
  WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX IF NOT EXISTS idx_permits_user ON public.permits(user_id);

ALTER TABLE public.permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permits_select_own" ON public.permits;
CREATE POLICY "permits_select_own" ON public.permits
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "permits_insert_own" ON public.permits;
CREATE POLICY "permits_insert_own" ON public.permits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "permits_update_own" ON public.permits;
CREATE POLICY "permits_update_own" ON public.permits
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "permits_delete_own" ON public.permits;
CREATE POLICY "permits_delete_own" ON public.permits
  FOR DELETE USING (auth.uid() = user_id);

-- updated_at trigger (uses the existing update_updated_at_column() function
-- already defined by prior migrations in this codebase).
DROP TRIGGER IF EXISTS permits_updated_at ON public.permits;
CREATE TRIGGER permits_updated_at
  BEFORE UPDATE ON public.permits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- permit_inspections
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permit_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id UUID NOT NULL REFERENCES public.permits(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Inspection identification
  inspection_type TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 1,
  description TEXT,

  -- Scheduling
  scheduled_date DATE,
  scheduled_window TEXT,

  -- Inspector
  inspector_name TEXT,

  -- Result
  status TEXT NOT NULL DEFAULT 'scheduled',
  performed_at TIMESTAMPTZ,
  result_notes TEXT,

  -- For reinspections: link to the original failed inspection
  parent_inspection_id UUID REFERENCES public.permit_inspections(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT permit_inspections_status_known
    CHECK (status IN ('scheduled','passed','failed','conditional_pass','cancelled','no_show')),
  CONSTRAINT permit_inspections_type_known
    CHECK (inspection_type IN ('rough_in','underground','service','final','temporary','reinspection','other'))
);

CREATE INDEX IF NOT EXISTS idx_permit_inspections_permit ON public.permit_inspections(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_inspections_scheduled
  ON public.permit_inspections(scheduled_date) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_permit_inspections_project ON public.permit_inspections(project_id);

ALTER TABLE public.permit_inspections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permit_inspections_select_own" ON public.permit_inspections;
CREATE POLICY "permit_inspections_select_own" ON public.permit_inspections
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "permit_inspections_insert_own" ON public.permit_inspections;
CREATE POLICY "permit_inspections_insert_own" ON public.permit_inspections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "permit_inspections_update_own" ON public.permit_inspections;
CREATE POLICY "permit_inspections_update_own" ON public.permit_inspections
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "permit_inspections_delete_own" ON public.permit_inspections;
CREATE POLICY "permit_inspections_delete_own" ON public.permit_inspections
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS permit_inspections_updated_at ON public.permit_inspections;
CREATE TRIGGER permit_inspections_updated_at
  BEFORE UPDATE ON public.permit_inspections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -------------------------------------------------------------------------
-- issues.permit_inspection_id (Phase 1.5 — column shipped now, UI in Phase 2)
-- -------------------------------------------------------------------------
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS permit_inspection_id UUID
    REFERENCES public.permit_inspections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_issues_inspection
  ON public.issues(permit_inspection_id)
  WHERE permit_inspection_id IS NOT NULL;
