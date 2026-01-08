# Stripe Integration Setup Guide

This guide covers how to configure Stripe for the NEC Compliance subscription system.

## Overview

The integration consists of:
- **Stripe Checkout** - Hosted payment pages for new subscriptions
- **Stripe Billing Portal** - Customer self-service for managing subscriptions
- **Stripe Webhooks** - Real-time subscription status updates

## Prerequisites

- [x] Database migration applied (`20260105_subscriptions.sql`)
- [ ] Stripe account (create at https://stripe.com)
- [ ] Supabase project with Edge Functions enabled

---

## Step 1: Create Stripe Account

1. Go to https://stripe.com and create an account
2. Complete business verification (can use test mode initially)
3. Note your dashboard URL: https://dashboard.stripe.com

---

## Step 2: Create Products and Prices

In Stripe Dashboard → Products → Add Product:

### Starter Plan
- **Name:** Starter
- **Description:** For solo electricians starting with permits
- **Pricing:** $29/month (recurring)
- Save and note the **Price ID** (starts with `price_`)

### Pro Plan
- **Name:** Pro
- **Description:** Unlimited permits with AI-powered tools
- **Pricing:** $49/month (recurring)
- Save and note the **Price ID**

### Business Plan
- **Name:** Business
- **Description:** For teams needing commercial features
- **Pricing:** $149/month (recurring)
- Save and note the **Price ID**

**Tip:** In test mode, price IDs look like `price_1234567890abcdef`

---

## Step 3: Get API Keys

In Stripe Dashboard → Developers → API Keys:

1. Copy your **Secret key** (starts with `sk_test_` or `sk_live_`)
2. Keep this secure - never expose in frontend code

---

## Step 4: Configure Supabase Edge Function Secrets

In Supabase Dashboard → Edge Functions → Secrets, add:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `STRIPE_SECRET_KEY` | `sk_test_xxx` or `sk_live_xxx` | Your Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | Webhook signing secret (Step 5) |
| `STRIPE_PRICE_STARTER` | `price_xxx` | Starter plan price ID |
| `STRIPE_PRICE_PRO` | `price_xxx` | Pro plan price ID |
| `STRIPE_PRICE_BUSINESS` | `price_xxx` | Business plan price ID |
| `APP_URL` | `https://your-domain.com` | Your app's production URL |

---

## Step 5: Set Up Webhook Endpoint

### 5.1 Deploy Edge Functions

First, deploy the Stripe Edge Functions to Supabase:

```bash
# From project root
npx supabase functions deploy stripe-webhook
npx supabase functions deploy stripe-checkout
npx supabase functions deploy stripe-portal
```

### 5.2 Create Webhook in Stripe

In Stripe Dashboard → Developers → Webhooks → Add Endpoint:

1. **Endpoint URL:**
   ```
   https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook
   ```

2. **Events to send:** Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

3. Click **Add endpoint**

4. Copy the **Signing secret** (starts with `whsec_`)

5. Add this to Supabase secrets as `STRIPE_WEBHOOK_SECRET`

---

## Step 6: Configure Billing Portal

In Stripe Dashboard → Settings → Billing → Customer Portal:

1. Enable the customer portal
2. Configure allowed actions:
   - [x] Update payment methods
   - [x] View invoices
   - [x] Cancel subscriptions
   - [x] Switch plans (optional)
3. Set redirect URL: `https://your-domain.com/#/settings`
4. Save changes

---

## Step 7: Test the Integration

### Test Mode Testing

1. Use Stripe test mode (toggle in dashboard)
2. Use test card: `4242 4242 4242 4242` (any future expiry, any CVC)
3. Sign up for a new account in your app
4. Navigate to `/pricing`
5. Click "Upgrade to Pro"
6. Complete checkout with test card
7. Verify subscription appears in Supabase `subscriptions` table

### Webhook Testing

In Stripe Dashboard → Developers → Webhooks → Your endpoint:

1. Click "Send test webhook"
2. Select `customer.subscription.created`
3. Click "Send test webhook"
4. Check Edge Function logs in Supabase Dashboard

---

## Step 8: Go Live

When ready for production:

1. Complete Stripe account activation/verification
2. Switch from test to live API keys
3. Create live products/prices (or copy from test mode)
4. Update all secrets with live values
5. Update webhook endpoint to use live signing secret
6. Test with a real card (you can refund immediately)

---

## Troubleshooting

### Webhook not receiving events
- Verify endpoint URL is correct
- Check Edge Function logs for errors
- Ensure webhook signing secret is correct
- Test with Stripe CLI: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`

### Checkout session fails
- Check browser console for errors
- Verify price IDs are correct
- Ensure user is authenticated
- Check Edge Function logs

### Subscription not updating in database
- Check webhook logs in Stripe Dashboard
- Verify `stripe_customer_id` is set after first checkout
- Check Supabase Edge Function logs

### "No Stripe customer found" error
- User needs to complete checkout first
- Check if `stripe_customer_id` exists in subscriptions table

---

## File Reference

| File | Purpose |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Handles Stripe webhook events |
| `supabase/functions/stripe-checkout/index.ts` | Creates checkout sessions |
| `supabase/functions/stripe-portal/index.ts` | Creates billing portal sessions |
| `supabase/migrations/20260105_subscriptions.sql` | Database schema |
| `hooks/useSubscription.ts` | Frontend subscription hook |
| `components/PricingPage.tsx` | Pricing UI for authenticated users |

---

## Price ID Mapping

The webhook handler uses this mapping to convert Stripe price IDs to plan names:

```typescript
// In stripe-webhook/index.ts
const PRICE_TO_PLAN: Record<string, string> = {
  'price_starter_monthly': 'starter',
  'price_pro_monthly': 'pro',
  'price_business_monthly': 'business',
}
```

**Important:** Update this mapping with your actual Stripe price IDs, or use environment variables (recommended).

---

## Security Notes

1. **Never expose `STRIPE_SECRET_KEY`** in frontend code
2. **Always verify webhook signatures** (handled by Edge Function)
3. **Use HTTPS** for all webhook endpoints
4. **Rotate keys** if compromised
5. **Monitor webhook events** for failed deliveries

---

## Support

- Stripe Documentation: https://stripe.com/docs
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Stripe Webhook Guide: https://stripe.com/docs/webhooks
