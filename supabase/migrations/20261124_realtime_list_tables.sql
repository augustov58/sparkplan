-- #315 (owner ruling 2026-11-24, item 7): the list hooks subscribe to
-- postgres_changes on these tables, but they were never added to the
-- supabase_realtime publication, so no realtime event ever fired for them.
-- An update made outside the app (or in another tab) showed only after a
-- full reload. Checked on prod 2026-11-24: the publication held 11 tables;
-- these 23 subscribed tables were missing. Every one has RLS enabled with
-- policies, and Realtime applies RLS per subscriber, so no row reaches a
-- user who can't select it.
--
-- Idempotent: adds only the tables that exist and aren't members yet.
-- NOT APPLIED until the owner says yes (CLAUDE.md Escalation Rule 3).

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'calendar_events', 'circuits', 'feeders', 'grounding_details',
    'inspection_items', 'inspector_reports', 'invoices', 'issues', 'loads',
    'material_entries', 'panels', 'payments', 'permit_inspections', 'permits',
    'project_attachments', 'project_billing_settings', 'projects', 'rfis',
    'short_circuit_calculations', 'site_visits', 'subscriptions',
    'time_entries', 'transformers'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t)
       AND NOT EXISTS (
         SELECT 1 FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
       )
    THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
