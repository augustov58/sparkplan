-- In-App Support Ticket System
-- Users submit tickets with category, message, and optional image attachments.
-- Admin (augustovalbuena@gmail.com) views, replies to, and manages tickets via the Admin Panel.

-- ============================================
-- 1. support_tickets table
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ticket content
  category TEXT NOT NULL CHECK (category IN ('bug', 'question', 'feedback', 'feature_request')),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_urls TEXT[] DEFAULT '{}',

  -- Auto-captured context
  page_url TEXT,
  plan_tier TEXT,
  browser_info TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),

  -- Denormalized user email (admin convenience — avoids join on every list render)
  user_email TEXT NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS support_tickets_created_at_idx ON public.support_tickets(created_at DESC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Users can read their own tickets
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own tickets
CREATE POLICY "Users can create own tickets"
  ON public.support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admin (by email) can read ALL tickets
CREATE POLICY "Admin can view all tickets"
  ON public.support_tickets FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'augustovalbuena@gmail.com'
  );

-- Admin can update any ticket (status, priority)
CREATE POLICY "Admin can update any ticket"
  ON public.support_tickets FOR UPDATE
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'augustovalbuena@gmail.com'
  );

-- Reuse the updated_at trigger function defined in the subscriptions migration
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_subscription_updated_at();

-- Enable realtime so widgets and admin panel see live changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- ============================================
-- 2. support_replies table (thread on tickets)
-- ============================================

CREATE TABLE IF NOT EXISTS public.support_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  attachment_urls TEXT[] DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS support_replies_ticket_id_idx ON public.support_replies(ticket_id);
CREATE INDEX IF NOT EXISTS support_replies_created_at_idx ON public.support_replies(created_at);

ALTER TABLE public.support_replies ENABLE ROW LEVEL SECURITY;

-- Users can read replies on their own tickets
CREATE POLICY "Users can view replies on own tickets"
  ON public.support_replies FOR SELECT
  USING (
    ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
  );

-- Users can reply to their own tickets (follow-up messages)
CREATE POLICY "Users can reply to own tickets"
  ON public.support_replies FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_admin = FALSE
    AND ticket_id IN (SELECT id FROM public.support_tickets WHERE user_id = auth.uid())
  );

-- Admin can read all replies
CREATE POLICY "Admin can view all replies"
  ON public.support_replies FOR SELECT
  USING (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'augustovalbuena@gmail.com'
  );

-- Admin can reply to any ticket
CREATE POLICY "Admin can reply to any ticket"
  ON public.support_replies FOR INSERT
  WITH CHECK (
    (SELECT email FROM auth.users WHERE id = auth.uid()) = 'augustovalbuena@gmail.com'
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_replies;

-- ============================================
-- 3. Grants
-- ============================================

GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT UPDATE (status, priority, updated_at) ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.support_replies TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
GRANT ALL ON public.support_replies TO service_role;

COMMENT ON TABLE public.support_tickets IS 'User support tickets with categories, attachments, and status tracking';
COMMENT ON TABLE public.support_replies IS 'Admin and user replies on support tickets';
