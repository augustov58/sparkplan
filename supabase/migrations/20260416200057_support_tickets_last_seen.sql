-- Track when the user last opened each ticket, so admin replies after that
-- timestamp are counted as "unread" for the widget badge.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS user_last_seen_at TIMESTAMPTZ DEFAULT NOW();

-- Existing tickets: mark everything as seen at creation so old threads don't
-- show phantom unread badges.
UPDATE public.support_tickets
SET user_last_seen_at = COALESCE(user_last_seen_at, created_at)
WHERE user_last_seen_at IS NULL;

-- Allow users to update their own last-seen timestamp (but not status/priority).
-- Column-level grant restricts which columns this UPDATE can touch.
GRANT UPDATE (user_last_seen_at) ON public.support_tickets TO authenticated;

DROP POLICY IF EXISTS "Users can update own tickets last_seen" ON public.support_tickets;
CREATE POLICY "Users can update own tickets last_seen"
  ON public.support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
