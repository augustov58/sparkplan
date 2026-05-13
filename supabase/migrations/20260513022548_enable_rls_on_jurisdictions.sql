-- ============================================================================
-- ENABLE RLS ON public.jurisdictions
-- ============================================================================
-- Created:  2026-05-13
-- Branch:   chore/enable-rls-jurisdictions
-- Context:  Follow-up #10 from PR #51. Supabase advisor flagged
--           public.jurisdictions as having no RLS policy. The table
--           currently has 0 rows so there is no active exposure, but
--           Sprint 2C M1 will populate it with the 4 AHJ rows
--           (Pompano, Miami-Dade, Davie, Hillsborough/Tampa). RLS must
--           land BEFORE that population.
--
-- Pattern reference:
--   Mirrors the canonical "user-readable / service-role-writable"
--   pattern from supabase/migrations/20260106045201_subscriptions.sql
--   (subscriptions table) and the shared-read-only style of
--   supabase/migrations/20260417000000_support_events_and_investigations.sql
--   (e.g. support_ticket_events: SELECT to authenticated, ALL to
--   service_role).
--
--   Adapted for a reference / lookup table: jurisdictions has no
--   user_id column (rows are AHJ definitions shared across the
--   tenant), so the SELECT predicate is "any authenticated session"
--   rather than "auth.uid() = user_id". Write paths remain locked to
--   service_role only (no INSERT / UPDATE / DELETE policy granted to
--   the authenticated role — RLS denies by default in the absence of
--   a permissive policy).
--
-- Security posture (least privilege):
--   - SELECT: authenticated  (read-only reference data; the existing
--                             useJurisdictions hook depends on this)
--   - INSERT / UPDATE / DELETE: service_role only
--   - anon role: no access (no policy applies; default-deny)
--
-- Idempotent: DROP POLICY IF EXISTS guards match the convention used
-- elsewhere in this migrations directory (see
-- 20251211000000_add_issues_and_inspection_tables.sql,
-- 20260416193739_fix_support_rls_use_jwt.sql).
-- ============================================================================

-- 1. Enable RLS on the table
ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;

-- 2. Read policy: any authenticated user may read jurisdictions
DROP POLICY IF EXISTS "jurisdictions_select_authenticated"
  ON public.jurisdictions;

CREATE POLICY "jurisdictions_select_authenticated"
  ON public.jurisdictions
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Write policy: service_role only (used by migrations / seed scripts /
--    future admin tooling). The authenticated role gets no INSERT /
--    UPDATE / DELETE policy, so RLS denies those operations by default.
DROP POLICY IF EXISTS "jurisdictions_service_role_write"
  ON public.jurisdictions;

CREATE POLICY "jurisdictions_service_role_write"
  ON public.jurisdictions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Table-level GRANTs (mirrors subscriptions.sql convention)
--    GRANT controls whether the role can attempt the SQL at all;
--    RLS controls which rows are visible / mutable inside that grant.
GRANT SELECT ON public.jurisdictions TO authenticated;
GRANT ALL    ON public.jurisdictions TO service_role;

-- 5. Document the policy intent on the table itself for future auditors
COMMENT ON TABLE public.jurisdictions IS
  'AHJ reference table (jurisdiction-level permit requirements). RLS: authenticated SELECT, service_role write-only. Populated by migrations + Sprint 2C M1 seed scripts. No user-scoped rows.';
