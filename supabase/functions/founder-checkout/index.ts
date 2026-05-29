/**
 * Supabase Edge Function: Founder Checkout
 *
 * Second half of the /founder-signup flow. Caller is signed-in (JWT required).
 * Creates a Stripe Checkout session for Business tier with:
 *   - Coupon (promotion code) pre-applied — Founder doesn't have to paste it
 *   - No trial — the standard 14-day app trial is bypassed because the
 *     subscription becomes "active" immediately with the coupon at 100% off
 *   - payment_method_collection: 'if_required' — Stripe skips card collection
 *     since the first 2 invoices are $0
 *
 * Total free: ~60 days from checkout completion (the duration of a "repeating
 * 2 months" Stripe Coupon at 100% off).
 *
 * Deploy:
 *   supabase functions deploy founder-checkout
 *
 * Required Edge Function secrets:
 *   - SUPABASE_URL (auto)
 *   - SUPABASE_ANON_KEY (auto)
 *   - SUPABASE_SERVICE_ROLE_KEY (auto)
 *   - STRIPE_SECRET_KEY
 *   - STRIPE_PRICE_BUSINESS
 *   - APP_URL (optional, falls back to localhost:3000)
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

// @ts-ignore: Deno URL import resolved at runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno URL import resolved at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore: Deno URL import resolved at runtime
import Stripe from 'https://esm.sh/stripe@14?target=denonext';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20.acacia',
});

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

const STRIPE_PRICE_BUSINESS = getRequiredEnv('STRIPE_PRICE_BUSINESS');

interface FounderCheckoutPayload {
  successUrl?: string;
  cancelUrl?: string;
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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    // Verify caller is signed in
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) throw new Error('Unauthorized');

    // Service role for reading the redeemed application + writing subscription
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // The Founder's redeemed coupon — set atomically by founder-signup
    // when the user was created. Lookup is by redeemed_user_id, not email
    // (founder may have signed up with any email; coupon owns the link).
    const { data: coupon, error: couponError } = await admin
      .from('founder_coupons')
      .select('id, code, redeemed_user_id')
      .eq('redeemed_user_id', user.id)
      .maybeSingle();

    if (couponError) throw couponError;

    if (!coupon || !coupon.code) {
      return new Response(
        JSON.stringify({ error: 'No active Founders coupon found for this account. Reply to your welcome email if this is wrong.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    // Resolve the Stripe promotion code by its user-facing code string.
    // We pre-apply it via the `discounts` parameter so the Founder doesn't
    // have to paste it at the Stripe-hosted Checkout page.
    const promoCodes = await stripe.promotionCodes.list({
      code: coupon.code,
      active: true,
      limit: 1,
    });

    const promotionCode = promoCodes.data[0];
    if (!promotionCode) {
      console.error(
        `founder-checkout: no active Stripe promotion code found for "${coupon.code}"`
      );
      return new Response(
        JSON.stringify({ error: "Your coupon couldn't be applied. Please reply to your welcome email so we can re-issue it." }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Fail fast on a misconfigured Business price BEFORE creating a Stripe
    // customer. Otherwise a bad STRIPE_PRICE_BUSINESS (wrong casing, wrong
    // mode, deleted price) only surfaces later at checkout.sessions.create —
    // after a customer has already been created — which orphans customers and
    // returns an opaque 400 the founder never sees. Validate up front.
    try {
      await stripe.prices.retrieve(STRIPE_PRICE_BUSINESS);
    } catch (priceError: any) {
      console.error(
        `founder-checkout: STRIPE_PRICE_BUSINESS is invalid ("${STRIPE_PRICE_BUSINESS}"): ${priceError?.message || priceError}`
      );
      return new Response(
        JSON.stringify({ error: 'Founders checkout is temporarily misconfigured on our end. Please reply to your welcome email and we will get you activated right away.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      );
    }

    // Get-or-create the Stripe customer for this user (mirrors stripe-checkout
    // pattern). The standard signup trigger has already created a
    // `subscriptions` row for them, but stripe_customer_id may still be null.
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let customerId = subscription?.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
          is_founder: 'true',
          coupon_code: coupon.code,
        },
      });
      customerId = customer.id;

      await admin
        .from('subscriptions')
        .update({ stripe_customer_id: customerId })
        .eq('user_id', user.id);
    }

    const baseUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    const { successUrl, cancelUrl } = ((await req.json()) as FounderCheckoutPayload) || {};

    // Build the Checkout session. Two non-obvious bits:
    //
    //   - `discounts` (not `allow_promotion_codes`) pre-applies the coupon.
    //     allow_promotion_codes + discounts are mutually exclusive in the API.
    //
    //   - `payment_method_collection: 'if_required'` means Stripe will NOT
    //     collect a card when the immediate amount due is $0. Once the
    //     coupon expires (~60 days), Stripe will email the customer to add
    //     a payment method — that's the natural conversion moment.
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      line_items: [
        {
          price: STRIPE_PRICE_BUSINESS,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${baseUrl}/#/?founder_activated=1`,
      cancel_url: cancelUrl || `${baseUrl}/#/founder-signup?canceled=1`,
      discounts: [{ promotion_code: promotionCode.id }],
      payment_method_collection: 'if_required',
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          is_founder: 'true',
          plan: 'business',
          coupon_code: coupon.code,
        },
      },
      // tax_id_collection and billing_address_collection: omitted so the
      // checkout is one click for the Founder (no extra fields).
    });

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('founder-checkout error:', error?.message || error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
