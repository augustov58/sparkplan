/**
 * Supabase Edge Function: Support Notifications
 *
 * Payload types:
 *  - 'new_ticket'     → emails support@sparkplan.app that a new ticket was submitted
 *  - 'admin_reply'    → emails the ticket creator with the admin's reply
 *  - 'user_reply'     → emails admin when a customer replies via email (echoed by support-inbound)
 *  - 'status_changed' → emails the ticket creator when status changes
 *
 * Authentication:
 *  - Normal callers authenticate via Supabase Auth header (logged-in user).
 *  - admin_reply / status_changed require the caller's email to match ADMIN_EMAIL.
 *  - Internal edge-function callers (support-inbound) pass the service_role key as the bearer
 *    token — this bypasses user resolution and is treated as trusted system-level.
 *
 * Reply-To addressing uses plus-addressing on our Google Workspace mailbox:
 *    support+ticket-<uuid>@sparkplan.app
 * The support-inbound Gmail poller extracts the ticket UUID and threads replies back in.
 *
 * Uses Resend (already configured for sparkplan.app). Requires RESEND_API_KEY in Edge Function secrets.
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ADMIN_EMAIL = 'augustovalbuena@gmail.com';
const SUPPORT_FROM = 'SparkPlan Support <support@sparkplan.app>';
const SUPPORT_INBOX = 'support@sparkplan.app';
const SUPPORT_DOMAIN = 'sparkplan.app';

// Plus-addressing on the existing Google Workspace mailbox — Gmail delivers
// support+anything@sparkplan.app to the same inbox, where support-inbound polls it.
function ticketReplyAddress(ticketId: string): string {
  return `support+ticket-${ticketId}@${SUPPORT_DOMAIN}`;
}

interface NewTicketPayload {
  type: 'new_ticket';
  ticketId: string;
  subject: string;
  category: string;
  message: string;
  userEmail: string;
  planTier?: string | null;
  pageUrl?: string | null;
}

interface AdminReplyPayload {
  type: 'admin_reply';
  ticketId: string;
  replyMessage: string;
  recipientEmail: string;
  subject: string;
}

interface StatusChangedPayload {
  type: 'status_changed';
  ticketId: string;
  newStatus: 'open' | 'in_progress' | 'resolved' | 'closed';
  recipientEmail: string;
  subject: string;
}

// Emitted by support-inbound when a customer replies via email.
// Recipient is always the admin; senderEmail is the customer who replied.
interface UserReplyPayload {
  type: 'user_reply';
  ticketId: string;
  replyMessage: string;
  recipientEmail: string;   // admin
  senderEmail: string;      // the customer who sent the email
  subject: string;
}

type Payload =
  | NewTicketPayload
  | AdminReplyPayload
  | StatusChangedPayload
  | UserReplyPayload;

function statusLabel(status: string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'in_progress':
      return 'In progress';
    case 'resolved':
      return 'Resolved';
    case 'closed':
      return 'Closed';
    default:
      return status;
  }
}

function statusBlurb(status: string): string {
  switch (status) {
    case 'in_progress':
      return "We're looking into it and will reply soon.";
    case 'resolved':
      return "We believe this is resolved. If you're still running into the issue, just reply and we'll re-open.";
    case 'closed':
      return 'This ticket has been closed. Feel free to open a new one any time.';
    case 'open':
      return "We've re-opened this ticket.";
    default:
      return '';
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case 'bug':
      return 'Bug';
    case 'question':
      return 'Question';
    case 'feedback':
      return 'Feedback';
    case 'feature_request':
      return 'Feature Request';
    default:
      return cat;
  }
}

async function sendEmail(params: {
  apiKey: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<void> {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: SUPPORT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      reply_to: params.replyTo,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error ${response.status}: ${text}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const bearerToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Internal-trust path: support-inbound (pg_cron-driven) calls us with the
    // service_role key. Treat as trusted — no user lookup needed.
    const isInternalCall = !!serviceRoleKey && bearerToken === serviceRoleKey;

    let callerEmail: string | null = null;
    if (!isInternalCall) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const {
        data: { user },
        error: userError,
      } = await supabaseClient.auth.getUser();
      if (userError || !user) throw new Error('Unauthorized');
      callerEmail = user.email ?? null;
    }

    // Helper: is this caller authorized to act as the admin?
    // Service-role internal calls are always trusted; user calls must match ADMIN_EMAIL.
    const isAdminCaller = isInternalCall || callerEmail === ADMIN_EMAIL;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) throw new Error('RESEND_API_KEY not configured');

    const body = (await req.json()) as Payload;

    if (body.type === 'new_ticket') {
      // Anyone authenticated can trigger this (it's a notification for their own ticket)
      const {
        ticketId,
        subject,
        category,
        message,
        userEmail,
        planTier,
        pageUrl,
      } = body;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #faf9f7;">
          <div style="background: #2d3b2d; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">New Support Ticket</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
            <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">${escapeHtml(subject)}</h2>
            <table style="width: 100%; font-size: 13px; color: #4b5563; margin-bottom: 16px;">
              <tr><td style="padding: 4px 0; width: 100px;"><strong>From:</strong></td><td>${escapeHtml(userEmail)}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Category:</strong></td><td>${escapeHtml(categoryLabel(category))}</td></tr>
              <tr><td style="padding: 4px 0;"><strong>Plan:</strong></td><td>${escapeHtml(planTier || 'unknown')}</td></tr>
              ${pageUrl ? `<tr><td style="padding: 4px 0;"><strong>Page:</strong></td><td><a href="${escapeHtml(pageUrl)}" style="color: #2d3b2d;">${escapeHtml(pageUrl)}</a></td></tr>` : ''}
              <tr><td style="padding: 4px 0;"><strong>Ticket ID:</strong></td><td style="font-family: monospace; font-size: 11px;">${escapeHtml(ticketId)}</td></tr>
            </table>
            <div style="background: #f9fafb; border-left: 3px solid #2d3b2d; padding: 12px 16px; border-radius: 4px; white-space: pre-wrap; font-size: 14px; color: #111827;">${escapeHtml(message)}</div>
            <p style="margin-top: 16px; font-size: 12px; color: #6b7280;">
              Reply from the Admin Panel → Support tab to keep the thread in-app.
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        apiKey: resendApiKey,
        to: SUPPORT_INBOX,
        subject: `[SparkPlan Support] ${categoryLabel(category)}: ${subject}`,
        html,
        replyTo: ticketReplyAddress(ticketId),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (body.type === 'admin_reply') {
      // Only admin (or internal service_role calls) can trigger this
      if (!isAdminCaller) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: admin access required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const { ticketId, replyMessage, recipientEmail, subject } = body;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #faf9f7;">
          <div style="background: #2d3b2d; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">SparkPlan Support</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">
              Re: <strong>${escapeHtml(subject)}</strong>
            </p>
            <div style="background: #f9fafb; border-left: 3px solid #2d3b2d; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 14px; color: #111827; margin-bottom: 20px;">${escapeHtml(replyMessage)}</div>
            <p style="font-size: 13px; color: #4b5563;">
              You can continue the conversation from inside SparkPlan — just click the support button (bottom-left) and open this ticket.
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              Ticket ID: ${escapeHtml(ticketId)}
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        apiKey: resendApiKey,
        to: recipientEmail,
        subject: `Re: ${subject}`,
        html,
        replyTo: ticketReplyAddress(ticketId),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (body.type === 'status_changed') {
      // Only admin (or internal service_role calls) can send status-change notifications
      if (!isAdminCaller) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: admin access required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const { ticketId, newStatus, recipientEmail, subject } = body;
      const label = statusLabel(newStatus);
      const blurb = statusBlurb(newStatus);

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #faf9f7;">
          <div style="background: #2d3b2d; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">Ticket status updated</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 8px;">
              Re: <strong>${escapeHtml(subject)}</strong>
            </p>
            <p style="font-size: 14px; color: #111827; margin: 0 0 12px;">
              Your ticket status is now
              <span style="display: inline-block; background: #e8f5e8; color: #2d3b2d; font-weight: 600; padding: 2px 10px; border-radius: 12px; font-size: 13px; margin-left: 4px;">${escapeHtml(label)}</span>.
            </p>
            ${blurb ? `<p style="font-size: 13px; color: #4b5563; margin: 0 0 16px;">${escapeHtml(blurb)}</p>` : ''}
            <p style="font-size: 13px; color: #4b5563;">
              Open the support widget (bottom-left in SparkPlan) to see the full thread or reply.
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              Ticket ID: ${escapeHtml(ticketId)}
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        apiKey: resendApiKey,
        to: recipientEmail,
        subject: `[SparkPlan Support] Status updated: ${label} — ${subject}`,
        html,
        replyTo: ticketReplyAddress(ticketId),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (body.type === 'user_reply') {
      // Echo from support-inbound (Gmail poller) → notify admin that a customer replied.
      // Only internal service_role callers should trigger this; if a logged-in user tried
      // to send it they'd be impersonating another customer.
      if (!isInternalCall) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: internal caller required' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          }
        );
      }

      const { ticketId, replyMessage, recipientEmail, senderEmail, subject } = body;

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #faf9f7;">
          <div style="background: #2d3b2d; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">Customer replied via email</h1>
          </div>
          <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 4px;">
              Re: <strong>${escapeHtml(subject)}</strong>
            </p>
            <p style="font-size: 13px; color: #6b7280; margin: 0 0 16px;">
              From: <strong>${escapeHtml(senderEmail)}</strong>
            </p>
            <div style="background: #f9fafb; border-left: 3px solid #2d3b2d; padding: 16px; border-radius: 4px; white-space: pre-wrap; font-size: 14px; color: #111827; margin-bottom: 20px;">${escapeHtml(replyMessage)}</div>
            <p style="font-size: 13px; color: #4b5563;">
              This reply is already threaded in the Admin Panel → Support tab. Reply there (or directly from Gmail) to continue.
            </p>
            <p style="font-size: 11px; color: #9ca3af; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
              Ticket ID: ${escapeHtml(ticketId)}
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        apiKey: resendApiKey,
        to: recipientEmail,
        subject: `[SparkPlan Support] Customer reply — ${subject}`,
        html,
        replyTo: ticketReplyAddress(ticketId),
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown request type' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  } catch (error: any) {
    console.error('support-notify error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
