-- Support Inbound: pg_cron schedule
--
-- Schedules a once-per-minute HTTPS POST to the support-inbound edge function.
-- The edge function polls Gmail for unread replies to plus-addressed ticket
-- addresses (support+ticket-<uuid>@sparkplan.app) and threads them back into
-- the corresponding ticket.
--
-- Auth model:
--   pg_cron runs inside the database — no user session, no JWT.
--   We authenticate with a shared secret stored in Supabase Vault and sent via
--   the x-support-inbound-secret header. The edge function constant-time-compares
--   this against its SUPPORT_INBOUND_SECRET env var.
--
-- MANUAL SETUP REQUIRED (once per environment, before applying this migration):
--   1. Generate a strong random secret (64+ chars, e.g. `openssl rand -hex 32`)
--   2. Set it on the edge function:
--        supabase secrets set SUPPORT_INBOUND_SECRET=<value>
--   3. Store the SAME value in Supabase Vault so pg_cron can read it:
--      In Studio → Settings → Vault → New Secret:
--        name  = support_inbound_secret
--        value = <same value as step 2>
--   4. Also store the project's functions base URL in Vault:
--        name  = supabase_functions_base_url
--        value = https://<project-ref>.supabase.co/functions/v1
--
-- Why Vault instead of hardcoding?
--   Migration files are committed to git. Hardcoding the secret or URL would
--   (a) leak credentials in SCM, and (b) make per-environment overrides
--   impossible. Vault stores encrypted; we decrypt at call time.

-- Enable extensions (idempotent; no-op if already enabled on the project)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop any previous scheduling of this job so re-running the migration is safe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'support-inbound-poll') THEN
    PERFORM cron.unschedule('support-inbound-poll');
  END IF;
END $$;

-- Schedule: every minute. Gmail's throughput on one mailbox is well under
-- its API quotas at this rate, and one-minute latency is imperceptible to
-- users relative to email-delivery jitter.
SELECT cron.schedule(
  'support-inbound-poll',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_functions_base_url'
    ) || '/support-inbound',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-support-inbound-secret', (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'support_inbound_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS
  'Used by support-inbound-poll to fire the Gmail polling edge function every minute.';
