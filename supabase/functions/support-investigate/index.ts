/**
 * Supabase Edge Function: support-investigate (STUB — scaffolding for future integration)
 *
 * Purpose (when fully implemented):
 *   Triggered by qualifying ticket events (new bug report, status='open' for >N minutes, etc.),
 *   this function will spawn an automated investigation (Claude Code or an internal runbook),
 *   capture the findings, and notify the admin via Slack + the admin dashboard.
 *
 * Current behavior:
 *   - Accepts the same contract we expect from the final implementation.
 *   - Writes a `support_ticket_investigations` row with status='skipped' so the admin UI
 *     shows "investigation deferred" rather than nothing.
 *   - Emits a `investigation_requested` event for auditability.
 *   - Returns 202 Accepted.
 *
 * When to flip this on:
 *   1. Point a CLAUDE_CODE_WEBHOOK_URL (or similar) env var at the runner that will pick up
 *      `pending` investigations from the table (or from a payload we POST to it).
 *   2. Set SLACK_WEBHOOK_URL for #support-investigations.
 *   3. Replace the `status='skipped'` write below with `status='pending'` and POST to the runner.
 *   4. The runner updates the row to 'running' → 'completed' with findings/artifacts + notified_at.
 *
 * Contract for triggering handlers (e.g., pg trigger on support_ticket_events):
 *   POST /functions/v1/support-investigate
 *   Authorization: Bearer <service_role_key>
 *   {
 *     "ticketId": "<uuid>",
 *     "triggeredByEventId": "<uuid | null>",
 *     "reason": "new_bug_report" | "stalled_ticket" | "manual"
 *   }
 */

// @ts-ignore: Deno global
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAdminClient, emitSupportEvent } from "../_shared/supportEvents.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvestigateRequest {
  ticketId: string;
  triggeredByEventId?: string | null;
  reason?: string;
}

function isInternalCall(req: Request): boolean {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  return !!serviceRoleKey && bearer === serviceRoleKey;
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

  if (!isInternalCall(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json()) as InvestigateRequest;
    if (!body.ticketId) {
      return new Response(JSON.stringify({ error: 'ticketId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = getAdminClient();

    // ------------------------------------------------------------
    // TODO: when the Claude Code integration ships, replace the
    // status='skipped' write below with status='pending' and either:
    //   (a) POST to Deno.env.get('CLAUDE_CODE_WEBHOOK_URL') with { investigationId, ticketId }, OR
    //   (b) leave status='pending' for a pull-based worker to poll.
    //
    // The runner is expected to UPDATE this row to status='running', then
    // status='completed' with `findings`, `artifacts`, `completed_at`, and
    // `notified_via`+`notified_at` once Slack/dashboard notification is sent.
    // ------------------------------------------------------------

    const { data: investigation, error: insertErr } = await admin
      .from('support_ticket_investigations')
      .insert({
        ticket_id: body.ticketId,
        triggered_by_event_id: body.triggeredByEventId ?? null,
        investigator: 'claude-code',
        status: 'skipped',
        error_message: 'Claude Code integration not yet implemented — scaffolding only.',
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('support-investigate: insert failed', insertErr);
      return new Response(
        JSON.stringify({ error: `Insert failed: ${insertErr.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await emitSupportEvent(admin, {
      ticketId: body.ticketId,
      eventType: 'investigation_requested',
      source: 'system',
      payload: {
        investigation_id: investigation?.id,
        reason: body.reason ?? 'unspecified',
        implemented: false,
      },
    });

    // TODO (future): POST to Slack via SLACK_WEBHOOK_URL announcing the investigation started.

    return new Response(
      JSON.stringify({
        ok: true,
        investigationId: investigation?.id,
        status: 'skipped',
        note: 'Scaffolding only — Claude Code runner not yet wired up.',
      }),
      {
        status: 202,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('support-investigate error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
