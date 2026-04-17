/**
 * Shared support-system helpers used across edge functions:
 *   - emitSupportEvent()   writes to the append-only support_ticket_events log
 *   - stripQuotedReply()   trims inline reply boilerplate from incoming email text
 *   - parseTicketIdFromAddress()  extracts UUID from support+ticket-<uuid>@... or
 *                                  ticket-<uuid>@reply... style plus-addressing
 *
 * The event log is the future-extension seam for AI investigations and other
 * downstream handlers — see supabase/migrations/20260417_support_events_and_investigations.sql
 */

// @ts-ignore: Deno global
declare const Deno: any;

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type SupportEventType =
  | 'ticket_created'
  | 'user_reply'
  | 'admin_reply'
  | 'status_changed'
  | 'priority_changed'
  | 'investigation_requested'
  | 'investigation_completed';

export type SupportEventSource = 'widget' | 'dashboard' | 'email' | 'system';

export interface EmitEventParams {
  ticketId: string;
  eventType: SupportEventType;
  source: SupportEventSource;
  payload?: Record<string, unknown>;
}

/**
 * Append an event to the support_ticket_events log.
 * Failures are logged but NEVER thrown — event emission must not break the primary flow.
 */
export async function emitSupportEvent(
  client: SupabaseClient,
  params: EmitEventParams
): Promise<void> {
  try {
    const { error } = await client.from('support_ticket_events').insert({
      ticket_id: params.ticketId,
      event_type: params.eventType,
      source: params.source,
      payload: params.payload ?? {},
    });
    if (error) {
      console.error('emitSupportEvent insert failed:', error);
    }
  } catch (err) {
    console.error('emitSupportEvent exception:', err);
  }
}

/**
 * Lazily create an admin (service_role) Supabase client for edge functions.
 * Each caller should pass this client to emitSupportEvent to avoid re-creating it.
 */
export function getAdminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin credentials not configured');
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// -----------------------------------------------------------------
// Address parsing — supports both addressing schemes we've considered:
//   - support+ticket-<uuid>@sparkplan.app     (Gmail plus-addressing, current plan)
//   - ticket-<uuid>@reply.sparkplan.app       (dedicated subdomain, future option)
// Returns the first matching UUID found across the given addresses.
// -----------------------------------------------------------------

const TICKET_ADDRESS_PATTERNS: RegExp[] = [
  /support\+ticket-([0-9a-f-]{36})@[a-z0-9.-]+/i,
  /ticket-([0-9a-f-]{36})@reply\.[a-z0-9.-]+/i,
];

export function extractTicketIdFromText(text: string): string | null {
  if (!text) return null;
  for (const pat of TICKET_ADDRESS_PATTERNS) {
    const m = text.match(pat);
    if (m) return m[1];
  }
  return null;
}

export function extractBareAddress(input: string): string {
  const angled = input.match(/<([^>]+)>/);
  const raw = (angled ? angled[1] : input).trim().toLowerCase();
  return raw;
}

// -----------------------------------------------------------------
// Quoted-reply stripping — conservative multi-marker approach.
// -----------------------------------------------------------------

export function stripQuotedReply(body: string): string {
  if (!body) return '';
  const normalized = body.replace(/\r\n/g, '\n');
  let cutIdx = normalized.length;

  const markers: RegExp[] = [
    /\n[ \t]*-{2,}[ \t]*Original Message[ \t]*-{2,}/i,
    /\nOn\s+.+?\s+(?:at\s+.+?\s+)?wrote:[ \t]*\n/,
    /\nFrom:\s+.+?\nSent:\s+.+?\n/i,
    /\n_{10,}\s*\n/,
    /\nBegin forwarded message:/i,
    // Our own notification footer markers (prevent bot-to-bot loops if an auto-reply includes them)
    /\nRe:\s+\*\*.+?\*\*/,
  ];

  for (const re of markers) {
    const m = normalized.search(re);
    if (m >= 0 && m < cutIdx) cutIdx = m;
  }

  let cleaned = normalized.slice(0, cutIdx);

  const lines = cleaned.split('\n');
  while (lines.length) {
    const last = lines[lines.length - 1];
    if (last.trim() === '' || last.trim().startsWith('>')) {
      lines.pop();
    } else {
      break;
    }
  }

  return lines.join('\n').trim();
}
