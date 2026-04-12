/**
 * Supabase Edge Function: Stripe Refund & Cancel
 * Admin-only: refunds the latest payment and cancels a user's subscription
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14?target=denonext"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20.acacia'
})

const ADMIN_EMAIL = 'augustovalbuena@gmail.com'

interface RefundRequest {
  userId: string
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Admin check — only admin can issue refunds
    if (user.email !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: admin access required' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      )
    }

    // Parse request body
    const { userId }: RefundRequest = await req.json()

    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!userId || !UUID_REGEX.test(userId)) {
      throw new Error('Invalid userId')
    }

    // Look up the user's Stripe subscription
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { data: subscription, error: subError } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id')
      .eq('user_id', userId)
      .single()

    if (subError || !subscription?.stripe_subscription_id) {
      throw new Error('No active Stripe subscription found for this user')
    }

    let refunded = false
    let refundMessage = ''

    // Attempt to refund the latest invoice
    try {
      const invoices = await stripe.invoices.list({
        subscription: subscription.stripe_subscription_id,
        limit: 1,
      })

      const latestInvoice = invoices.data[0]

      if (latestInvoice?.payment_intent) {
        await stripe.refunds.create({
          payment_intent: latestInvoice.payment_intent as string,
        })
        refunded = true
        refundMessage = 'Latest payment refunded. '
      } else {
        refundMessage = 'No payment to refund. '
      }
    } catch (refundErr: any) {
      console.error('Refund error:', refundErr.message)
      refundMessage = 'Refund could not be processed. '
    }

    // Cancel the subscription — webhook handles DB update
    try {
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
    } catch (cancelErr: any) {
      console.error('Cancel error:', cancelErr.message)
      // Subscription may already be canceled — not a fatal error
    }

    return new Response(
      JSON.stringify({
        success: true,
        refunded,
        message: `${refundMessage}Subscription canceled.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error) {
    console.error('Error processing refund:', error)

    return new Response(
      JSON.stringify({ error: 'Failed to process refund' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
