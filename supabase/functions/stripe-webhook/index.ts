/**
 * Supabase Edge Function: Stripe Webhook Handler
 * Handles Stripe subscription events and updates the database
 */

// @ts-ignore: Deno global available in Supabase Edge Functions
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Stripe from "https://esm.sh/stripe@14?target=denonext"

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') as string, {
  apiVersion: '2024-11-20.acacia'
})

// Create Stripe SubtleCrypto provider for webhook verification
const cryptoProvider = Stripe.createSubtleCryptoProvider()

// Price ID to plan mapping (configure these in Stripe Dashboard)
const PRICE_TO_PLAN: Record<string, string> = {
  // These should match your Stripe Price IDs
  'price_starter_monthly': 'starter',
  'price_pro_monthly': 'pro',
  'price_business_monthly': 'business',
  // Add your actual Stripe price IDs here
}

serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')

  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    // Get the raw body for signature verification
    const body = await req.text()

    // Verify the webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured')
    }

    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    )

    console.log(`Received Stripe event: ${event.type}`)

    // Create Supabase client with service role for database operations
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

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(supabaseAdmin, session)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdate(supabaseAdmin, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(supabaseAdmin, subscription)
        break
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        await handleInvoicePaid(supabaseAdmin, invoice)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        await handlePaymentFailed(supabaseAdmin, invoice)
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (err) {
    console.error('Webhook error:', err.message)
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }
})

/**
 * Handle successful checkout - link Stripe customer to user
 */
async function handleCheckoutCompleted(
  supabase: any,
  session: Stripe.Checkout.Session
) {
  const userId = session.client_reference_id
  const customerId = session.customer as string
  const subscriptionId = session.subscription as string

  if (!userId) {
    console.error('No user ID in checkout session')
    return
  }

  console.log(`Checkout completed for user ${userId}, customer ${customerId}`)

  // Update the user's subscription record
  const { error } = await supabase
    .from('subscriptions')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating subscription after checkout:', error)
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const priceId = subscription.items.data[0]?.price.id
  const plan = PRICE_TO_PLAN[priceId] || 'pro' // Default to pro if unknown

  console.log(`Subscription update for customer ${customerId}: ${subscription.status}`)

  // Find user by Stripe customer ID
  const { data: existingSubscription, error: findError } = await supabase
    .from('subscriptions')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (findError || !existingSubscription) {
    console.error('Could not find user for customer:', customerId)
    return
  }

  // Update subscription details
  const { error } = await supabase
    .from('subscriptions')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_price_id: priceId,
      plan: plan,
      status: mapStripeStatus(subscription.status),
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating subscription:', error)
  }
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(
  supabase: any,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string

  console.log(`Subscription deleted for customer ${customerId}`)

  // Downgrade to free plan
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan: 'free',
      status: 'canceled',
      stripe_subscription_id: null,
      stripe_price_id: null,
      canceled_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error handling subscription deletion:', error)
  }
}

/**
 * Handle successful invoice payment - reset monthly counters
 */
async function handleInvoicePaid(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string

  console.log(`Invoice paid for customer ${customerId}`)

  // Reset monthly permit count on successful payment
  const { error } = await supabase
    .from('subscriptions')
    .update({
      permits_used_this_month: 0,
      status: 'active',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error resetting monthly permits:', error)
  }
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(
  supabase: any,
  invoice: Stripe.Invoice
) {
  const customerId = invoice.customer as string

  console.log(`Payment failed for customer ${customerId}`)

  // Update status to past_due
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
    })
    .eq('stripe_customer_id', customerId)

  if (error) {
    console.error('Error updating subscription status:', error)
  }
}

/**
 * Map Stripe subscription status to our status enum
 */
function mapStripeStatus(stripeStatus: string): string {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'canceled': 'canceled',
    'incomplete': 'incomplete',
    'incomplete_expired': 'incomplete_expired',
    'past_due': 'past_due',
    'trialing': 'trialing',
    'unpaid': 'unpaid',
    'paused': 'paused',
  }
  return statusMap[stripeStatus] || 'active'
}
