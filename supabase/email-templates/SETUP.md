# Email Setup Guide

## Goal
Send branded SparkPlan emails from `noreply@sparkplan.app` instead of Supabase's default address.

## Stack
- **Domain**: sparkplan.app (managed by Vercel)
- **Email provider**: Resend (recommended — has Vercel integration, free tier: 3k emails/month)
- **SMTP config**: Supabase Authentication settings

---

## Step 1: Create a Resend account

1. Go to https://resend.com and sign up
2. Add domain: `sparkplan.app`
3. Resend will give you DNS records to add (SPF, DKIM, MX)

## Step 2: Add DNS records in Vercel

1. Go to Vercel Dashboard → sparkplan.app → DNS
2. Add each record Resend provides (usually 3–4 records)
3. Wait for Resend to verify the domain (can take a few minutes)

## Step 3: Get Resend SMTP credentials

In Resend dashboard → SMTP → Generate credentials:
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: (your Resend API key)

## Step 4: Configure Supabase SMTP

Supabase Dashboard → Authentication → SMTP Settings:
- Enable custom SMTP: ON
- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: (Resend API key)
- Sender email: `noreply@sparkplan.app`
- Sender name: `SparkPlan`

## Step 5: Apply the email template

Supabase Dashboard → Authentication → Email Templates → Confirm signup:
- Subject: `Confirm your SparkPlan account`
- Body: paste contents of `confirmation.html`

## Step 6: Test

Sign up with a test email and verify:
- Email arrives from `noreply@sparkplan.app`
- Subject line shows "Confirm your SparkPlan account"
- SparkPlan branding is visible
- Confirmation link works and redirects to sparkplan.app
