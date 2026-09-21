-- Cron maintenance: slow the support poll, prune and compact its bookkeeping.
--
-- Supersedes the scheduling decision in 20260417000001_support_inbound_cron.sql.
-- That migration's comment argues for a one-minute poll on the grounds that
-- Gmail's quotas allow it. True, but it accounted only for the API cost, not
-- the storage cost inside Postgres. By 2026-09-21 this one job had grown the
-- database to 376 MB, of which 357 MB (95%) was its own exhaust:
--
--   cron.job_run_details  152 MB  224,177 rows back to 2026-04-18, all
--                                 'succeeded'. pg_cron appends one row per run
--                                 and never prunes.
--   net._http_response    205 MB  file holding 436 kB of live data (360 rows
--                                 at ~1.2 kB). pg_net deletes responses on a
--                                 6-hour TTL, so the table is a treadmill;
--                                 autovacuum clears the tuples but never
--                                 returns pages to the OS, and its thresholds
--                                 scale with table size, so the larger it grew
--                                 the less often it ran.
--
-- Free-plan projects go read-only above 500 MB of database size, so this was
-- roughly seven weeks from taking writes down. Actual application data is a
-- few MB; the largest table in public is circuits at 488 kB.
--
-- The one-off cleanup (a 214,170-row delete and VACUUM FULL on both tables,
-- 376 MB -> 27 MB) is deliberately NOT in this migration. It was a repair of
-- accumulated state, not schema, and replaying it on a fresh environment would
-- do nothing. What belongs in version control is the steady state below.
--
-- Preferred fix, unavailable here: per-table autovacuum tuning
--   ALTER TABLE net._http_response SET (autovacuum_vacuum_scale_factor = 0.0,
--                                       autovacuum_vacuum_threshold = 500);
-- fails with 'must be owner of table' - cron.job_run_details and
-- net._http_response are owned by supabase_admin, not postgres. Scheduled
-- VACUUM FULL is the fallback. Verified 2026-09-21 that pg_cron can execute it
-- despite VACUUM being a utility statement: seven consecutive test runs
-- returned 'VACUUM' in 20-150 ms each.

-- Poll every 5 minutes instead of every minute. A support reply arriving up to
-- five minutes later is imperceptible next to email-delivery jitter, and it
-- cuts both tables' growth by 5x. alter_job is used rather than re-scheduling
-- so the command body stays defined in one place.
DO $$
DECLARE
  v_jobid bigint;
BEGIN
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'support-inbound-poll';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.alter_job(v_jobid, schedule => '*/5 * * * *');
  END IF;
END $$;

-- Re-running this migration must be safe.
DO $$
DECLARE
  v_name text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['prune-cron-history', 'vacuum-cron-history', 'vacuum-net-responses']
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_name) THEN
      PERFORM cron.unschedule(v_name);
    END IF;
  END LOOP;
END $$;

-- Keep a week of run history. This alone stops the row count growing without
-- bound, but a DELETE does not shrink the file, hence the vacuum below.
SELECT cron.schedule(
  'prune-cron-history',
  '0 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days'$$
);

-- Return the freed pages to the OS. Weekly is ample: at a 5-minute poll these
-- tables churn ~2,000 rows a week, and both are small enough that the
-- ACCESS EXCLUSIVE lock lasts milliseconds.
SELECT cron.schedule(
  'vacuum-cron-history',
  '30 3 * * 0',
  $$VACUUM FULL cron.job_run_details$$
);

SELECT cron.schedule(
  'vacuum-net-responses',
  '45 3 * * 0',
  $$VACUUM FULL net._http_response$$
);
