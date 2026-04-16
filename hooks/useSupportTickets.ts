import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type TicketCategory = 'bug' | 'question' | 'feedback' | 'feature_request';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface SupportTicket {
  id: string;
  user_id: string;
  category: TicketCategory;
  subject: string;
  message: string;
  attachment_urls: string[];
  page_url: string | null;
  plan_tier: string | null;
  browser_info: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  user_email: string;
  user_last_seen_at: string | null;
  created_at: string;
  updated_at: string;
  unread_count?: number;
}

export interface SupportReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  attachment_urls: string[];
  created_at: string;
}

export interface CreateTicketInput {
  category: TicketCategory;
  subject: string;
  message: string;
  attachment_urls?: string[];
  plan_tier?: string | null;
}

export interface UseSupportTicketsReturn {
  tickets: SupportTicket[];
  loading: boolean;
  error: string | null;
  createTicket: (input: CreateTicketInput) => Promise<SupportTicket | null>;
  getReplies: (ticketId: string) => Promise<SupportReply[]>;
  addReply: (ticketId: string, message: string, isAdmin?: boolean) => Promise<SupportReply | null>;
  updateTicketStatus: (ticketId: string, status: TicketStatus) => Promise<void>;
  updateTicketPriority: (ticketId: string, priority: TicketPriority) => Promise<void>;
  markTicketSeen: (ticketId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

function captureBrowserInfo(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent.slice(0, 300);
  const lang = navigator.language || '';
  const platform = (navigator as any).platform || '';
  return `${ua} | lang=${lang} | platform=${platform}`;
}

export function useSupportTickets(adminMode = false): UseSupportTicketsReturn {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('support_tickets')
        .select('*, support_replies(created_at, is_admin)')
        .order('created_at', { ascending: false });

      if (!adminMode) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setTickets([]);
          return;
        }
        query = query.eq('user_id', user.id);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      // Compute unread_count per ticket (admin replies after user_last_seen_at)
      const enriched = ((data || []) as any[]).map((row) => {
        const lastSeen = row.user_last_seen_at
          ? new Date(row.user_last_seen_at).getTime()
          : 0;
        const replies = (row.support_replies || []) as Array<{
          created_at: string;
          is_admin: boolean;
        }>;
        const unread = replies.filter(
          (r) => r.is_admin && new Date(r.created_at).getTime() > lastSeen
        ).length;
        const { support_replies, ...ticket } = row;
        return { ...ticket, unread_count: unread } as SupportTicket;
      });

      setTickets(enriched);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch support tickets');
      console.error('Error fetching tickets:', err);
    } finally {
      setLoading(false);
    }
  }, [adminMode]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Realtime subscription — refetch on any change to tickets or replies
  // (need replies so unread badge + history list update when admin replies come in)
  useEffect(() => {
    const channel = supabase
      .channel(`support_tickets_${adminMode ? 'admin' : 'user'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'support_tickets',
        },
        () => {
          fetchTickets();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_replies',
        },
        () => {
          fetchTickets();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [fetchTickets, adminMode]);

  const createTicket = async (input: CreateTicketInput): Promise<SupportTicket | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload = {
        user_id: user.id,
        user_email: user.email || '',
        category: input.category,
        subject: input.subject,
        message: input.message,
        attachment_urls: input.attachment_urls || [],
        plan_tier: input.plan_tier ?? null,
        page_url: typeof window !== 'undefined' ? window.location.href : null,
        browser_info: captureBrowserInfo(),
      };

      const { data, error: insertError } = await supabase
        .from('support_tickets')
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      const ticket = data as SupportTicket;
      setTickets((prev) => [ticket, ...prev]);

      // Fire-and-forget email notification
      supabase.functions
        .invoke('support-notify', {
          body: {
            type: 'new_ticket',
            ticketId: ticket.id,
            subject: ticket.subject,
            category: ticket.category,
            message: ticket.message,
            userEmail: ticket.user_email,
            planTier: ticket.plan_tier,
            pageUrl: ticket.page_url,
          },
        })
        .catch((err) => console.warn('support-notify (new_ticket) failed:', err));

      return ticket;
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
      console.error('Error creating ticket:', err);
      return null;
    }
  };

  const getReplies = async (ticketId: string): Promise<SupportReply[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('support_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;
      return (data as SupportReply[]) || [];
    } catch (err: any) {
      console.error('Error fetching replies:', err);
      return [];
    }
  };

  const addReply = async (
    ticketId: string,
    message: string,
    isAdmin = false
  ): Promise<SupportReply | null> => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('support_replies')
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          message,
          is_admin: isAdmin,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const reply = data as SupportReply;

      if (isAdmin) {
        // Find the ticket to get the recipient email
        const ticket = tickets.find((t) => t.id === ticketId);
        if (ticket) {
          supabase.functions
            .invoke('support-notify', {
              body: {
                type: 'admin_reply',
                ticketId,
                replyMessage: message,
                recipientEmail: ticket.user_email,
                subject: ticket.subject,
              },
            })
            .catch((err) => console.warn('support-notify (admin_reply) failed:', err));
        }

        // Bump ticket status to in_progress if it was open
        const target = tickets.find((t) => t.id === ticketId);
        if (target && target.status === 'open') {
          await updateTicketStatus(ticketId, 'in_progress');
        }
      }

      return reply;
    } catch (err: any) {
      setError(err.message || 'Failed to add reply');
      console.error('Error adding reply:', err);
      return null;
    }
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus): Promise<void> => {
    const previous = [...tickets];
    const targetTicket = previous.find((t) => t.id === ticketId);
    const oldStatus = targetTicket?.status;

    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status } : t)));

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId);

    if (updateError) {
      setTickets(previous);
      setError(updateError.message);
      console.error('Error updating status:', updateError);
      return;
    }

    // Only email the user when admin changes status (not when it auto-bumps to in_progress
    // from the user's own reply on their own ticket). Admin-mode is the proxy for "admin did it".
    if (adminMode && targetTicket && oldStatus !== status) {
      supabase.functions
        .invoke('support-notify', {
          body: {
            type: 'status_changed',
            ticketId,
            newStatus: status,
            recipientEmail: targetTicket.user_email,
            subject: targetTicket.subject,
          },
        })
        .catch((err) => console.warn('support-notify (status_changed) failed:', err));
    }
  };

  const markTicketSeen = async (ticketId: string): Promise<void> => {
    // Optimistic: update local state so unread count drops immediately
    const now = new Date().toISOString();
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, user_last_seen_at: now } : t))
    );

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ user_last_seen_at: now })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error marking ticket seen:', updateError);
    }
  };

  const updateTicketPriority = async (
    ticketId: string,
    priority: TicketPriority
  ): Promise<void> => {
    const previous = [...tickets];
    setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, priority } : t)));

    const { error: updateError } = await supabase
      .from('support_tickets')
      .update({ priority })
      .eq('id', ticketId);

    if (updateError) {
      setTickets(previous);
      setError(updateError.message);
      console.error('Error updating priority:', updateError);
    }
  };

  return {
    tickets,
    loading,
    error,
    createTicket,
    getReplies,
    addReply,
    updateTicketStatus,
    updateTicketPriority,
    markTicketSeen,
    refetch: fetchTickets,
  };
}
