-- ============================================================================
-- FOUNDING CONTRACTORS — COUPON TRACKING (single-use redemption gate)
-- ============================================================================
-- Created: 2026-05-24
-- Purpose: Make the coupon the gate for the /founder-signup flow. Augusto
--          approves an application, generates a Stripe Promotion Code (e.g.
--          "FOUNDER-DAVIS"), and pastes it into founding_applications.
--          coupon_code. The /founder-signup edge function validates the code
--          against this column, creates the user (auto-confirmed, no email
--          verification), marks the redemption, and routes them to Stripe
--          Checkout with the same code pre-applied.
--
-- Single-use: coupon_code UNIQUE on (lower-cased) ensures no code is reused.
--             coupon_redeemed_at prevents the same code from being redeemed
--             twice (edge function checks this before allowing signup).
--
-- The Stripe coupon enforces the discount mechanics (100% off for 2 months).
-- This column enforces the gate (only approved Founders can use the route).
-- ============================================================================

ALTER TABLE public.founding_applications
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS coupon_redeemed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS redeemed_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Unique on lower(coupon_code) so case doesn't matter when the contractor
-- types it. NULL coupons are permitted (pending/declined applications).
CREATE UNIQUE INDEX IF NOT EXISTS idx_founding_applications_coupon_code_lower
  ON public.founding_applications (lower(coupon_code))
  WHERE coupon_code IS NOT NULL;

-- Length cap to keep the form sane.
ALTER TABLE public.founding_applications
  DROP CONSTRAINT IF EXISTS founding_applications_coupon_code_length;

ALTER TABLE public.founding_applications
  ADD CONSTRAINT founding_applications_coupon_code_length
  CHECK (coupon_code IS NULL OR char_length(coupon_code) BETWEEN 3 AND 60);

COMMENT ON COLUMN public.founding_applications.coupon_code IS
  'Stripe promotion code issued to this Founder after manual approval. Augusto creates the code in Stripe Dashboard (e.g., FOUNDER-DAVIS), pastes it here. /founder-signup edge function validates against this column.';
COMMENT ON COLUMN public.founding_applications.coupon_redeemed_at IS
  'Set when the Founder successfully completes /founder-signup. Used to prevent double-redemption of the same code.';
COMMENT ON COLUMN public.founding_applications.redeemed_user_id IS
  'auth.users.id of the Founder who redeemed this coupon. Set atomically with coupon_redeemed_at.';
