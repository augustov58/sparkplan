/**
 * Supabase Edge Function: support-inbound (Gmail API polling variant)
 *
 * Polls the support@sparkplan.app Gmail mailbox for unread replies that target
 * plus-addressed ticket addresses (`support+ticket-<uuid>@sparkplan.app`), threads
 * them into the corresponding ticket as support_replies rows, and echoes an email
 * to the other party so both parties stay in sync.
 *
 * Trigger: pg_cron every minute (authenticates via SUPPORT_INBOUND_SECRET).
 *
 * Flow per message:
 *   1. fetch full message via Gmail API
 *   2. extract ticket UUID from plus-addressed recipient
 *   3. authenticate sender: must be ADMIN_EMAIL or ticket.user_email
 *   4. strip quoted reply history
 *   5. insert into support_replies (service_role bypasses RLS)
 *   6. emit support_ticket_events row (future AI-investigation hook consumes this)
 *   7. invoke support-notify to email the *other* party
 *   8. mark message as read so it's not re-processed
 *
 * Required env vars:
 *   SUPPORT_INBOUND_SECRET          — shared secret between pg_cron caller and this fn
 *   GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN / GMAIL_MAILBOX
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 *   SUPPORT_ADMIN_AUTH_USER_ID      — admin's auth.users.id (needed for NOT NULL user_id on admin email replies)
 */

// @ts-ignore: Deno global
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getAccessToken,
  listMessages,
  getMessage,
  markAsRead,
  type GmailMessageFull,
} from "../_shared/gmail.ts";
import {
  getAdminClient,
  emitSupportEvent,
  extractTicketIdFromText,
  extractBareAddress,
  stripQuotedReply,
} from "../_shared/supportEvents.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-support-inbound-secret',
};

const ADMIN_EMAIL = 'augustovalbuena@gmail.com';

// Gmail search query — "to:" matches Delivered-To / To / Cc / Bcc headers.
// `newer_than:1d` caps the processing window if something falls behind.
const GMAIL_QUERY = 'to:support+ticket- is:unread newer_than:1d';

interface ProcessResult {
  messageId: string;
  ticketId?: string;
  outcome: 'inserted' | 'ignored-no-ticket-id' | 'ignored-ticket-not-found' | 'ignored-unauthorized' | 'ignored-empty' | 'error';
  reason?: string;
}

function verifySecret(req: Request): boolean {
  const expected = Deno.env.get('SUPPORT_INBOUND_SECRET');
  if (!expected) {
    console.warn('SUPPORT_INBOUND_SECRET not set — rejecting all requests');
    return false;
  }
  const provided = req.headers.get('x-support-inbound-secret') ?? '';
  // Constant-time compare
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

async function processMessage(
  msg: GmailMessageFull,
  admin: ReturnType<typeof getAdminClient>,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<ProcessResult> {
  const result: ProcessResult = { messageId: msg.id, outcome: 'error' };

  // Collect all recipient-ish header values (to/cc/delivered-to) to hunt for the plus-tagged address
  const recipientBlob = [
    msg.headers['to'] || '',
    msg.headers['cc'] || '',
    msg.headers['delivered-to'] || '',
    msg.headers['x-original-to'] || '',
  ].join(' ');

  const ticketId = extractTicketIdFromText(recipientBlob);
  if (!ticketId) {
    result.outcome = 'ignored-no-ticket-id';
    result.reason = `no plus-tag ticket id in recipients: ${recipientBlob.slice(0, 200)}`;
    return result;
  }
  result.ticketId = ticketId;

  // Resolve ticket (service_role bypasses RLS)
  const { data: ticket, error: ticketErr } = await admin
    .from('support_tickets')
    .select('id, user_id, user_email, subject, status')
    .eq('id', ticketId)
    .single();
  if (ticketErr || !ticket) {
    result.outcome = 'ignored-ticket-not-found';
    result.reason = ticketErr?.message ?? 'not found';
    return result;
  }

  // Authenticate the sender — must match admin or ticket owner.
  // Admin identity = EITHER the registered admin login email (used by the app)
  // OR the shared support mailbox (the one we poll, used for outbound replies).
  const fromHeader = msg.headers['from'] ?? '';
  const from = extractBareAddress(fromHeader);
  const supportMailbox = (Deno.env.get('GMAIL_MAILBOX') ?? '').toLowerCase();
  const isSenderAdmin =
    from === ADMIN_EMAIL.toLowerCase() ||
    (supportMailbox.length > 0 && from === supportMailbox);

  let isAdmin = false;
  let authorUserId: string;
  let authorEmail: string;

  if (isSenderAdmin) {
    const adminAuthId = Deno.env.get('SUPPORT_ADMIN_AUTH_USER_ID');
    if (!adminAuthId) {
      result.outcome = 'error';
      result.reason = 'SUPPORT_ADMIN_AUTH_USER_ID not configured';
      return result;
    }
    isAdmin = true;
    authorUserId = adminAuthId;
    authorEmail = ADMIN_EMAIL;
  } else if (from === (ticket.user_email ?? '').toLowerCase()) {
    isAdmin = false;
    authorUserId = ticket.user_id;
    authorEmail = ticket.user_email;
  } else {
    result.outcome = 'ignored-unauthorized';
    result.reason = `sender ${from} is neither admin nor ticket owner (${ticket.user_email})`;
    return result;
  }

  // Clean the body
  const cleaned = stripQuotedReply(msg.textBody);
  if (!cleaned) {
    result.outcome = 'ignored-empty';
    result.reason = 'body empty after strip';
    return result;
  }

  // Insert reply
  const { data: replyRow, error: insertErr } = await admin
    .from('support_replies')
    .insert({
      ticket_id: ticketId,
      user_id: authorUserId,
      message: cleaned,
      is_admin: isAdmin,
    })
    .select('id')
    .single();
  if (insertErr) {
    result.outcome = 'error';
    result.reason = `insert failed: ${insertErr.message}`;
    return result;
  }

  // Append to the append-only event log for downstream handlers (AI investigation, etc.)
  await emitSupportEvent(admin, {
    ticketId,
    eventType: isAdmin ? 'admin_reply' : 'user_reply',
    source: 'email',
    payload: {
      reply_id: replyRow?.id,
      author_email: authorEmail,
      message_preview: cleaned.slice(0, 280),
      gmail_message_id: msg.id,
    },
  });

  // Mirror dashboard behavior: admin reply bumps open → in_progress
  if (isAdmin && ticket.status === 'open') {
    await admin
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', ticketId);
  }

  // Echo notification to the OTHER party via support-notify.
  // We use service_role JWT so the admin-auth check inside support-notify trusts us.
  const notifyType = isAdmin ? 'admin_reply' : 'user_reply';
  const notifyBody: Record<string, unknown> = {
    type: notifyType,
    ticketId,
    subject: ticket.subject,
  };
  if (isAdmin) {
    notifyBody.replyMessage = cleaned;
    notifyBody.recipientEmail = ticket.user_email;
  } else {
    notifyBody.replyMessage = cleaned;
    notifyBody.recipientEmail = ADMIN_EMAIL;
    notifyBody.senderEmail = authorEmail;
  }

  try {
    await fetch(`${supabaseUrl}/functions/v1/support-notify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notifyBody),
    });
  } catch (err: any) {
    console.warn(`support-inbound: notify echo failed for ticket ${ticketId}:`, err);
    // Non-fatal — the reply is already persisted
  }

  result.outcome = 'inserted';
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!verifySecret(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const admin = getAdminClient();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const mailbox = Deno.env.get('GMAIL_MAILBOX') ?? 'support@sparkplan.app';
    const accessToken = await getAccessToken();

    const refs = await listMessages(accessToken, mailbox, GMAIL_QUERY, 25);

    const results: ProcessResult[] = [];
    for (const ref of refs) {
      try {
        const full = await getMessage(accessToken, mailbox, ref.id);
        const processed = await processMessage(full, admin, supabaseUrl, serviceRoleKey);
        // Always mark as read regardless of outcome — prevents re-processing noise
        // (unknown-sender emails, missing tickets, empty bodies). `error` is the only
        // case we skip-marking so a transient DB failure can be retried next poll.
        if (processed.outcome !== 'error') {
          try {
            await markAsRead(accessToken, mailbox, ref.id);
          } catch (err: any) {
            console.warn('support-inbound: mark-as-read failed', ref.id, err);
          }
        }
        results.push(processed);
      } catch (err: any) {
        console.error('support-inbound: processMessage failed', ref.id, err);
        results.push({ messageId: ref.id, outcome: 'error', reason: err.message });
      }
    }

    // Update polling watermark (currently purely informational; used for dashboards and debugging)
    await admin
      .from('support_gmail_sync_state')
      .update({
        last_synced_at: new Date().toISOString(),
        last_error: null,
      })
      .eq('id', 1);

    return new Response(
      JSON.stringify({
        ok: true,
        processed: results.length,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('support-inbound error:', error);
    // Record the failure for dashboard visibility
    try {
      const admin = getAdminClient();
      await admin
        .from('support_gmail_sync_state')
        .update({
          last_error: error.message ?? 'unknown',
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', 1);
    } catch {
      // Ignore secondary errors
    }
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
