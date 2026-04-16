-- Fix: admin RLS policies were subquerying auth.users, but the `authenticated`
-- role lacks SELECT on auth.users, which raises "permission denied for table users"
-- during policy evaluation (policies are OR-combined and all applicable branches
-- are evaluated). Switch to auth.jwt() which reads email directly from JWT claims
-- with no table access required.

-- ============================================
-- support_tickets
-- ============================================

DROP POLICY IF EXISTS "Admin can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Admin can update any ticket" ON public.support_tickets;

CREATE POLICY "Admin can view all tickets"
  ON public.support_tickets FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

CREATE POLICY "Admin can update any ticket"
  ON public.support_tickets FOR UPDATE
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

-- ============================================
-- support_replies
-- ============================================

DROP POLICY IF EXISTS "Admin can view all replies" ON public.support_replies;
DROP POLICY IF EXISTS "Admin can reply to any ticket" ON public.support_replies;

CREATE POLICY "Admin can view all replies"
  ON public.support_replies FOR SELECT
  USING ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

CREATE POLICY "Admin can reply to any ticket"
  ON public.support_replies FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com');

-- ============================================
-- storage.objects (support-attachments bucket)
-- ============================================

DROP POLICY IF EXISTS "Admin reads all support files" ON storage.objects;

CREATE POLICY "Admin reads all support files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'support-attachments'
    AND (auth.jwt() ->> 'email') = 'augustovalbuena@gmail.com'
  );
