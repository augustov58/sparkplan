-- ============================================================================
-- FOUNDER COUPONS POOL (decoupled from founding_applications)
-- ============================================================================
-- Created: 2026-05-24
-- Purpose: Pre-create the 20 coupon codes that gate the /founder-signup flow,
--          decoupled from any specific applicant. The matching Stripe
--          Promotion Codes (same strings) are created once in the Stripe
--          Dashboard: one Stripe Coupon (100% off / repeating 2 months) with
--          20 Promotion Codes pointing at it (FOUNDER-01..FOUNDER-20),
--          max_redemptions = 1 each.
--
-- Model: coupon ↔ applicant linkage happens at REDEMPTION, not at approval.
--        Augusto approves an applicant, picks any unused code from this pool,
--        emails it. The applicant signs up with whatever email they want.
--        The signup function records the redemption here (redeemed_user_id,
--        redeemed_email) regardless of whether that email matches the
--        original application.
--
-- Why this is cleaner than putting coupon_code on founding_applications:
--   1. Augusto doesn't have to touch Studio during approval (just review_status)
--   2. Contractors can sign up with any email
--   3. Coupons are reusable if unredeemed — send FOUNDER-03 to someone else
--      if the first recipient bails
--   4. Audit reads are obvious: who redeemed which code, when
--
-- The previous migration (20260524_founding_applications_coupon.sql) was
-- removed before merge — those columns were never applied to prod.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.founder_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Optional pre-assignment. Augusto can use this to say "I gave FOUNDER-03
  -- to applicant X" — useful for audit, but NOT required. The redemption
  -- flow works fine without it.
  assigned_application_id UUID REFERENCES public.founding_applications(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ,

  -- Redemption state. Set atomically by the founder-signup edge function
  -- when the Founder creates their account.
  redeemed_at TIMESTAMPTZ,
  redeemed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  redeemed_email TEXT,

  -- Free-form notes Augusto can use during program operations.
  notes TEXT,

  CONSTRAINT founder_coupons_code_length
    CHECK (char_length(code) BETWEEN 3 AND 60),
  CONSTRAINT founder_coupons_notes_length
    CHECK (notes IS NULL OR char_length(notes) <= 2000),
  CONSTRAINT founder_coupons_redeemed_email_length
    CHECK (redeemed_email IS NULL OR char_length(redeemed_email) <= 320),
  -- Belt-and-suspenders: if redeemed_at is set, all three redemption fields
  -- should be coherent (user_id + email set). Enforced at write time by the
  -- edge function; this check catches any drift from manual edits in Studio.
  CONSTRAINT founder_coupons_redemption_atomic
    CHECK (
      (redeemed_at IS NULL AND redeemed_user_id IS NULL AND redeemed_email IS NULL)
      OR (redeemed_at IS NOT NULL AND redeemed_user_id IS NOT NULL AND redeemed_email IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_founder_coupons_code_lower
  ON public.founder_coupons (lower(code));

CREATE INDEX IF NOT EXISTS idx_founder_coupons_unredeemed
  ON public.founder_coupons (code)
  WHERE redeemed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_founder_coupons_redeemed_user
  ON public.founder_coupons (redeemed_user_id)
  WHERE redeemed_user_id IS NOT NULL;

ALTER TABLE public.founder_coupons ENABLE ROW LEVEL SECURITY;

-- No anon policies — pool is read/written exclusively via service-role edge
-- functions (founder-signup, founder-checkout). Anyone who needs to view
-- the pool uses Supabase Studio (service role).

-- Pre-seed 20 codes. Matches the Stripe Promotion Codes Augusto creates
-- in the Dashboard (one-time setup).
INSERT INTO public.founder_coupons (code) VALUES
  ('FOUNDER-01'), ('FOUNDER-02'), ('FOUNDER-03'), ('FOUNDER-04'),
  ('FOUNDER-05'), ('FOUNDER-06'), ('FOUNDER-07'), ('FOUNDER-08'),
  ('FOUNDER-09'), ('FOUNDER-10'), ('FOUNDER-11'), ('FOUNDER-12'),
  ('FOUNDER-13'), ('FOUNDER-14'), ('FOUNDER-15'), ('FOUNDER-16'),
  ('FOUNDER-17'), ('FOUNDER-18'), ('FOUNDER-19'), ('FOUNDER-20')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.founder_coupons IS
  'Pool of pre-created coupon codes for the Founders cohort program. Codes match Stripe Promotion Codes (FOUNDER-01..FOUNDER-20). Gate for /founder-signup.';
COMMENT ON COLUMN public.founder_coupons.code IS
  'Stripe-side Promotion Code string. Case-insensitive uniqueness via lower(code) index.';
COMMENT ON COLUMN public.founder_coupons.redeemed_email IS
  'The email the Founder signed up with — may differ from the original founding_applications.email.';
COMMENT ON COLUMN public.founder_coupons.assigned_application_id IS
  'Optional. If Augusto wants to track "I sent code X to applicant Y," set this when emailing the approval. Not enforced by the signup flow.';
