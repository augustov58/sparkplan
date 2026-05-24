-- ============================================================================
-- FOUNDING CONTRACTORS APPLICATIONS
-- ============================================================================
-- Created: 2026-05-24
-- Purpose: Public application form for the "Founding Contractors" pilot cohort
--          (FL-licensed ECs who get 60-day free access + private Slack in
--          exchange for case studies and real permit submissions).
--
-- Scope: Inserts come from anonymous visitors via a public edge function
--        (`founding-application`, deployed --no-verify-jwt). The form lives at
--        /founders. The edge function uses the service role to insert, so we
--        only need an anon INSERT policy as a defense-in-depth fallback. No
--        SELECT/UPDATE/DELETE policies — admin reads via Supabase Studio
--        (service role) only.
--
-- License #: OPTIONAL. Augusto verifies live applicants against the FL DBPR
--            public license search before approval; license # in the form is a
--            convenience, not a gate. Self-attestation drives review.
--
-- Email uniqueness: prevents the same person from spamming the form. Repeat
--                   submissions update nothing — they error and the UI shows
--                   "we already have your application on file."
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Identity
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,

  -- License (FL DBPR EC/ER license number) — OPTIONAL
  ec_license_number TEXT,

  -- Geography / pulling activity
  state TEXT NOT NULL,                       -- expected: "FL"; non-FL applicants auto-decline
  primary_counties TEXT NOT NULL,            -- free text — counties/cities they pull in
  permits_last_12mo TEXT NOT NULL,           -- bucketed: "0", "1-5", "6-20", "21-50", "50+"

  -- Wedge match
  typical_work TEXT[] NOT NULL DEFAULT '{}', -- multi-select tags: single_family, multi_family, commercial, ev, service_upgrade, solar
  active_job_detail TEXT,                    -- "Do you have an active FL job SparkPlan could help with?" — qualitative

  -- Attribution
  referral_source TEXT,                      -- youtube / mike_holt / reddit / linkedin / dm / other

  -- Workflow
  review_status TEXT NOT NULL DEFAULT 'pending',  -- pending / approved / declined
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,

  CONSTRAINT founding_applications_email_format
    CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT founding_applications_full_name_length
    CHECK (char_length(full_name) BETWEEN 2 AND 200),
  CONSTRAINT founding_applications_state_length
    CHECK (char_length(state) BETWEEN 2 AND 4),
  CONSTRAINT founding_applications_primary_counties_length
    CHECK (char_length(primary_counties) BETWEEN 1 AND 500),
  CONSTRAINT founding_applications_permits_bucket
    CHECK (permits_last_12mo IN ('0', '1-5', '6-20', '21-50', '50+')),
  CONSTRAINT founding_applications_active_job_length
    CHECK (active_job_detail IS NULL OR char_length(active_job_detail) <= 2000),
  CONSTRAINT founding_applications_ec_license_length
    CHECK (ec_license_number IS NULL OR char_length(ec_license_number) <= 60),
  CONSTRAINT founding_applications_phone_length
    CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT founding_applications_company_length
    CHECK (company_name IS NULL OR char_length(company_name) <= 200),
  CONSTRAINT founding_applications_referral_length
    CHECK (referral_source IS NULL OR char_length(referral_source) <= 60),
  CONSTRAINT founding_applications_reviewer_notes_length
    CHECK (reviewer_notes IS NULL OR char_length(reviewer_notes) <= 4000),
  CONSTRAINT founding_applications_review_status_known
    CHECK (review_status IN ('pending', 'approved', 'declined'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_founding_applications_email_lower
  ON public.founding_applications (lower(email));

CREATE INDEX IF NOT EXISTS idx_founding_applications_review_status
  ON public.founding_applications (review_status, created_at DESC);

ALTER TABLE public.founding_applications ENABLE ROW LEVEL SECURITY;

-- The edge function writes via service role (bypasses RLS), so the anon policy
-- below is only a defense-in-depth fallback for the public PostgREST endpoint.
-- We restrict it to INSERT only; no anon SELECT/UPDATE/DELETE exists.
CREATE POLICY "founding_applications_anon_insert"
  ON public.founding_applications FOR INSERT
  TO anon
  WITH CHECK (true);

COMMENT ON TABLE public.founding_applications IS
  'Public application form submissions for the Founding Contractors pilot cohort. Edge function `founding-application` writes rows via service role. Admin reads via Supabase Studio.';
COMMENT ON COLUMN public.founding_applications.ec_license_number IS
  'FL DBPR EC/ER license number. OPTIONAL — Augusto verifies against myfloridalicense.com before approval.';
COMMENT ON COLUMN public.founding_applications.permits_last_12mo IS
  'Bucketed permit volume. Filters out non-pulling roles (estimators, retired electricians, sales).';
COMMENT ON COLUMN public.founding_applications.typical_work IS
  'Multi-select wedge tags: single_family, multi_family, commercial, ev, service_upgrade, solar. MF/EV/service_upgrade applicants jump the queue.';
COMMENT ON COLUMN public.founding_applications.review_status IS
  'Application lifecycle: pending → approved (sent coupon + Slack invite) or declined (sent polite decline pointing at standard 14-day trial).';
