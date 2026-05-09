-- ============================================================================
-- FEATURE INTEREST (BETA WAITLIST + DEMAND SIGNAL)
-- ============================================================================
-- Created: 2026-05-09
-- Purpose: Lightweight demand-discovery table for beta sidebar items
--          (Estimating, Permits, T&M Billing). Each click on the "Tell us"
--          CTA inserts a row. We use clicks-per-feature as a priority signal
--          before investing sprint time in any single build.
--
-- Scope: append-only, scoped to authenticated user, no PII beyond the user's
--        own free-text note. RLS restricts SELECT/INSERT to the row owner.
--        Roadmap prioritization queries run server-side (service-role) via
--        Supabase Studio — no application-level admin policy needed yet.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  note TEXT,
  project_id UUID,  -- optional: project the user was viewing when they submitted
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT feature_interest_feature_name_known
    CHECK (feature_name IN ('estimating', 'permits', 'tm_billing')),
  CONSTRAINT feature_interest_note_length
    CHECK (note IS NULL OR char_length(note) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_feature_interest_user
  ON public.feature_interest (user_id);
CREATE INDEX IF NOT EXISTS idx_feature_interest_feature
  ON public.feature_interest (feature_name, created_at DESC);

ALTER TABLE public.feature_interest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_interest_select_own"
  ON public.feature_interest FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "feature_interest_insert_own"
  ON public.feature_interest FOR INSERT
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.feature_interest IS
  'Demand-discovery signals from beta sidebar stubs. One row per "Tell us" submission. Used to prioritize which beta features to actually build.';
COMMENT ON COLUMN public.feature_interest.feature_name IS
  'Which beta the user expressed interest in. Constrained to known beta keys.';
COMMENT ON COLUMN public.feature_interest.note IS
  'Free-text note from the user (max 2000 chars). What would they want from this feature?';
