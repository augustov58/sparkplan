-- ============================================================================
-- FOUNDING CONTRACTORS — PREFERRED CONTACT METHOD
-- ============================================================================
-- Created: 2026-05-24
-- Purpose: Capture the applicant's preferred reply channel so review/approval
--          can use Slack / Phone / SMS-iMessage as the contractor expects.
--          Many FL electricians work from trucks and prefer phone/text over
--          desktop Slack — defaulting to Slack-only would lose those Founders.
--
-- Affect on Supabase: display-only metadata. No triggers, no automation.
-- Augusto sees the preference in the admin email and the Studio row, and
-- chooses the reply channel manually when approving. Storing it persists
-- the choice across the review window and enables future analytics
-- ("how many Founders prefer phone over Slack?").
-- ============================================================================

ALTER TABLE public.founding_applications
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT NOT NULL DEFAULT 'slack';

-- Drop the constraint first (idempotent re-run safety), then re-add it with
-- the allowed values. The DROP ... IF EXISTS form avoids erroring if the
-- migration is rerun.
ALTER TABLE public.founding_applications
  DROP CONSTRAINT IF EXISTS founding_applications_preferred_contact_known;

ALTER TABLE public.founding_applications
  ADD CONSTRAINT founding_applications_preferred_contact_known
  CHECK (preferred_contact IN ('slack', 'phone_call', 'sms_imessage'));

COMMENT ON COLUMN public.founding_applications.preferred_contact IS
  'How the applicant prefers to be contacted during the cohort. Display-only metadata used by Augusto during manual approval reply. Allowed values: slack (default), phone_call, sms_imessage.';
