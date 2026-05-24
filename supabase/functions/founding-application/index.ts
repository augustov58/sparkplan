/**
 * Supabase Edge Function: Founding Contractors Application
 *
 * Public endpoint (no JWT verification) — receives form submissions from
 * strangers landing on /founders. Deploy with:
 *   supabase functions deploy founding-application --no-verify-jwt
 *
 * Flow:
 *   1. Validate payload (server-side defense — frontend Zod is just UX).
 *   2. Honeypot check: reject if `website` field is non-empty.
 *   3. Insert row into `founding_applications` using the service role.
 *      Duplicate email returns 409 with a friendly message.
 *   4. Email Augusto via Resend with the full application + a direct link
 *      to review (Supabase Studio row deep-link).
 *   5. Return 200 to the form. The form shows a success state — 48h review.
 *
 * Required Edge Function secrets:
 *   - SUPABASE_URL                (auto-populated)
 *   - SUPABASE_SERVICE_ROLE_KEY   (auto-populated)
 *   - RESEND_API_KEY              (set manually)
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

// @ts-ignore: Deno URL import resolved at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno URL import resolved at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Send to the brand inbox (Google Workspace), which already forwards to Augusto.
// Keeps the program-facing flow consistent with support@sparkplan.app and
// makes future delegation (hiring, alerts) trivial.
const NOTIFY_TO = 'support@sparkplan.app';
const NOTIFY_FROM = 'SparkPlan Apps <support@sparkplan.app>';

const TYPICAL_WORK_VALUES = new Set([
  'single_family',
  'multi_family',
  'commercial',
  'ev',
  'service_upgrade',
  'solar',
]);

const PERMIT_BUCKETS = new Set(['0', '1-5', '6-20', '21-50', '50+']);

const REFERRAL_SOURCES = new Set([
  'youtube',
  'mike_holt',
  'reddit',
  'linkedin',
  'dm',
  'other',
]);

const PREFERRED_CONTACT_VALUES = new Set(['slack', 'phone_call', 'sms_imessage']);

const CONTACT_LABEL: Record<string, string> = {
  slack: 'Slack (default)',
  phone_call: 'Phone call',
  sms_imessage: 'SMS / iMessage',
};

interface ApplicationPayload {
  full_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  ec_license_number?: string;
  state: string;
  primary_counties: string;
  permits_last_12mo: string;
  typical_work: string[];
  active_job_detail?: string;
  referral_source?: string;
  preferred_contact?: string;
  website?: string; // honeypot — must be empty
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(payload: ApplicationPayload): string | null {
  // Honeypot — silent reject (return same generic error so bots don't learn).
  if (payload.website && payload.website.trim().length > 0) {
    return 'Submission rejected.';
  }

  const fullName = trimOrEmpty(payload.full_name);
  if (fullName.length < 2 || fullName.length > 200) {
    return 'Please enter your full name.';
  }

  const email = trimOrEmpty(payload.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return 'Please enter a valid email address.';
  }

  const state = trimOrEmpty(payload.state).toUpperCase();
  if (state.length < 2 || state.length > 4) {
    return 'State is required.';
  }

  const primaryCounties = trimOrEmpty(payload.primary_counties);
  if (primaryCounties.length < 1 || primaryCounties.length > 500) {
    return 'Tell us which FL counties or cities you pull permits in.';
  }

  if (!PERMIT_BUCKETS.has(payload.permits_last_12mo)) {
    return 'Please select a permit volume bucket.';
  }

  if (!Array.isArray(payload.typical_work) || payload.typical_work.length === 0) {
    return 'Please select at least one type of work.';
  }
  for (const tag of payload.typical_work) {
    if (!TYPICAL_WORK_VALUES.has(tag)) {
      return 'Invalid work type selected.';
    }
  }

  const license = trimOrEmpty(payload.ec_license_number);
  if (license && !/^E[CR]\d{7}$/i.test(license)) {
    return 'If provided, license format is EC####### or ER####### (FL DBPR).';
  }

  if (payload.referral_source && !REFERRAL_SOURCES.has(payload.referral_source)) {
    return 'Invalid referral source.';
  }

  if (payload.preferred_contact && !PREFERRED_CONTACT_VALUES.has(payload.preferred_contact)) {
    return 'Invalid preferred contact method.';
  }

  const activeJob = trimOrEmpty(payload.active_job_detail);
  if (activeJob.length > 2000) {
    return 'Active job detail is too long.';
  }

  return null;
}

function buildAdminEmail(row: any): string {
  const license = row.ec_license_number || '(not provided)';
  const phone = row.phone || '(not provided)';
  const company = row.company_name || '(not provided)';
  const activeJob = row.active_job_detail || '(none)';
  const referral = row.referral_source || '(unknown)';
  const workTags = (row.typical_work as string[]).join(', ') || '(none)';
  const contactPref = CONTACT_LABEL[row.preferred_contact] || 'Slack (default)';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; background: #faf9f7;">
      <div style="background: #2d3b2d; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 18px;">New Founding Contractors Application</h1>
      </div>
      <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px;">
        <h2 style="margin: 0 0 16px; font-size: 16px; color: #111827;">${escapeHtml(row.full_name)}</h2>

        <table style="width: 100%; font-size: 13px; color: #4b5563; margin-bottom: 16px;">
          <tr><td style="padding: 4px 0; width: 160px;"><strong>Email:</strong></td><td><a href="mailto:${escapeHtml(row.email)}">${escapeHtml(row.email)}</a></td></tr>
          <tr><td style="padding: 4px 0;"><strong>Phone:</strong></td><td>${escapeHtml(phone)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Preferred contact:</strong></td><td><strong style="color: #2d3b2d;">${escapeHtml(contactPref)}</strong></td></tr>
          <tr><td style="padding: 4px 0;"><strong>Company:</strong></td><td>${escapeHtml(company)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>State:</strong></td><td>${escapeHtml(row.state)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>EC License #:</strong></td><td>${escapeHtml(license)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Counties / cities:</strong></td><td>${escapeHtml(row.primary_counties)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Permits last 12mo:</strong></td><td>${escapeHtml(row.permits_last_12mo)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Typical work:</strong></td><td>${escapeHtml(workTags)}</td></tr>
          <tr><td style="padding: 4px 0;"><strong>Referral:</strong></td><td>${escapeHtml(referral)}</td></tr>
        </table>

        <p style="font-size: 13px; color: #6b7280; margin: 16px 0 6px;"><strong>Active job they want help with:</strong></p>
        <div style="background: #f9fafb; border-left: 3px solid #2d3b2d; padding: 12px 16px; border-radius: 4px; white-space: pre-wrap; font-size: 14px; color: #111827;">${escapeHtml(activeJob)}</div>

        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
          <p style="margin: 0 0 6px;"><strong>Review checklist:</strong></p>
          <ol style="margin: 0; padding-left: 18px;">
            <li>FL DBPR license search → <a href="https://www.myfloridalicense.com/wl11.asp?mode=2&search=Name&SID=" style="color: #2d3b2d;">myfloridalicense.com</a></li>
            <li>Active + Florida + EC/ER class</li>
            <li>≥ 5 permits / year</li>
            <li>Wedge match (MF / EV / service upgrade preferred)</li>
          </ol>
          <p style="margin: 12px 0 0; font-family: monospace; font-size: 11px;">Application ID: ${escapeHtml(row.id)}</p>
        </div>
      </div>
    </div>
  `;
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
      from: NOTIFY_FROM,
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const payload = (await req.json()) as ApplicationPayload;

    const validationError = validate(payload);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase service role not configured');
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const insertRow = {
      full_name: payload.full_name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone?.trim() || null,
      company_name: payload.company_name?.trim() || null,
      ec_license_number: payload.ec_license_number?.trim() || null,
      state: payload.state.trim().toUpperCase(),
      primary_counties: payload.primary_counties.trim(),
      permits_last_12mo: payload.permits_last_12mo,
      typical_work: payload.typical_work,
      active_job_detail: payload.active_job_detail?.trim() || null,
      referral_source: payload.referral_source || null,
      preferred_contact: payload.preferred_contact || 'slack',
    };

    const { data: row, error: insertError } = await supabase
      .from('founding_applications')
      .insert(insertRow)
      .select()
      .single();

    if (insertError) {
      // Postgres unique-violation on (lower(email)) → code 23505
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({
            error: "We already have an application on file for that email. We'll be in touch within 48 hours.",
            duplicate: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }
      throw insertError;
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (resendApiKey) {
      try {
        await sendEmail({
          apiKey: resendApiKey,
          to: NOTIFY_TO,
          subject: `[Founding Contractors] ${row.full_name} (${row.state}) — ${row.permits_last_12mo} permits/yr`,
          html: buildAdminEmail(row),
          replyTo: row.email,
        });
      } catch (emailError: any) {
        // Don't fail the request if email delivery fails — the row is the source of truth.
        console.error('founding-application: email send failed', emailError?.message || emailError);
      }
    } else {
      console.error('founding-application: RESEND_API_KEY not configured — skipping admin email');
    }

    return new Response(JSON.stringify({ success: true, id: row.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('founding-application error:', error?.message || error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again or email us at support@sparkplan.app.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
