/**
 * Supabase Edge Function: Founder Signup
 *
 * Public endpoint (no JWT verification) — first half of the /founder-signup
 * flow. Validates the coupon code, creates an auto-confirmed user via the
 * admin API, marks the application as redeemed. The client then signs in
 * with the password and calls `founder-checkout` to launch Stripe.
 *
 * Deploy with:
 *   supabase functions deploy founder-signup --no-verify-jwt
 *
 * Gating model:
 *   The coupon code is the entire gate. To get one, an applicant must:
 *     1. Have submitted at /founders
 *     2. Have been manually approved by Augusto (review_status = 'approved')
 *     3. Have a coupon_code set on their founding_applications row
 *     4. Not have already redeemed (coupon_redeemed_at IS NULL)
 *
 * Anyone hitting this endpoint without a valid coupon gets 403. The
 * standard /signup route remains the path for non-Founders.
 *
 * Required Edge Function secrets:
 *   - SUPABASE_URL (auto)
 *   - SUPABASE_SERVICE_ROLE_KEY (auto)
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

interface FounderSignupPayload {
  coupon_code: string;
  full_name: string;
  email: string;
  password: string;
}

function trimOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validate(payload: FounderSignupPayload): string | null {
  const coupon = trimOrEmpty(payload.coupon_code);
  if (coupon.length < 3 || coupon.length > 60) {
    return 'Please enter your coupon code.';
  }

  const name = trimOrEmpty(payload.full_name);
  if (name.length < 2 || name.length > 200) {
    return 'Please enter your full name.';
  }

  const email = trimOrEmpty(payload.email).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return 'Please enter a valid email address.';
  }

  // Supabase default minimum is 6; we'll require 8.
  if (typeof payload.password !== 'string' || payload.password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (payload.password.length > 128) {
    return 'Password is too long.';
  }

  return null;
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
    const payload = (await req.json()) as FounderSignupPayload;

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

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const couponCode = payload.coupon_code.trim();
    const email = payload.email.trim().toLowerCase();
    const fullName = payload.full_name.trim();

    // Look up the coupon. Case-insensitive match against the index we created
    // on lower(coupon_code).
    const { data: application, error: lookupError } = await admin
      .from('founding_applications')
      .select('id, email, review_status, coupon_redeemed_at, redeemed_user_id, full_name')
      .ilike('coupon_code', couponCode)
      .maybeSingle();

    if (lookupError) {
      console.error('founder-signup: coupon lookup error', lookupError);
      throw lookupError;
    }

    if (!application) {
      return new Response(
        JSON.stringify({ error: "We couldn't find that coupon code. Double-check the spelling — codes are case-insensitive." }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    if (application.review_status !== 'approved') {
      return new Response(
        JSON.stringify({ error: "This coupon isn't active yet. If you just got approved, give us a few minutes and try again." }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    if (application.coupon_redeemed_at) {
      return new Response(
        JSON.stringify({
          error: "This coupon has already been redeemed. If you're locked out of your account, reply to your welcome email and we'll get you back in.",
          alreadyRedeemed: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409,
        }
      );
    }

    // Soft consistency check: email used at signup should match the application
    // email. Not a hard fail (the contractor might use a different work email),
    // but we log + warn.
    if (application.email.toLowerCase() !== email) {
      console.warn(
        `founder-signup: signup email ${email} differs from application email ${application.email} for coupon ${couponCode}`
      );
    }

    // Create the user via admin API. email_confirm: true bypasses the standard
    // confirmation email — Founders are pre-vetted, so we don't need them to
    // round-trip through an inbox.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: payload.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        is_founder: true,
        coupon_code: couponCode,
      },
    });

    if (createError || !created?.user) {
      // The most common error here is "User already registered". That's not a
      // server error — surface as 409 so the form can prompt them to sign in.
      if (createError?.message?.toLowerCase().includes('already')) {
        return new Response(
          JSON.stringify({
            error: 'That email is already registered. Sign in instead, then visit /pricing to activate your Founders period.',
            emailExists: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 409,
          }
        );
      }
      console.error('founder-signup: createUser error', createError);
      throw createError ?? new Error('User creation failed');
    }

    // Mark redemption atomically. If this UPDATE fails for any reason, we have
    // a created user with no redemption record — surface the error but don't
    // try to delete the user (recovery is easier than retry-create).
    const { error: updateError } = await admin
      .from('founding_applications')
      .update({
        coupon_redeemed_at: new Date().toISOString(),
        redeemed_user_id: created.user.id,
      })
      .eq('id', application.id)
      .is('coupon_redeemed_at', null); // belt-and-suspenders against race

    if (updateError) {
      console.error('founder-signup: redemption mark failed', updateError);
      // User exists; redemption tracking failed. Don't block them.
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: created.user.id,
        email: created.user.email,
        application_id: application.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('founder-signup error:', error?.message || error);
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again or email support@sparkplan.app.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
