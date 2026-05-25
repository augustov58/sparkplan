/**
 * Founder Signup Page (/#/founder-signup)
 *
 * The pre-vetted path for approved Founding Contractors. Differences vs the
 * standard /signup:
 *   - Requires a valid coupon code (issued by Augusto after approval)
 *   - No email confirmation (auto-confirmed via admin API)
 *   - Skips the 14-day app trial — goes straight to Stripe Checkout with
 *     the coupon pre-applied (100% off for 2 months) and no card required
 *
 * Submission orchestrates 3 calls in sequence:
 *   1. POST /founder-signup       → creates user, marks coupon redeemed
 *   2. supabase.auth.signInWithPassword → establishes session
 *   3. POST /founder-checkout     → returns Stripe Checkout URL
 *   4. window.location = checkout URL
 *
 * Failure semantics:
 *   - Step 1 fails (invalid/redeemed coupon) → show inline error, don't
 *     touch auth or DB
 *   - Step 2 fails (unlikely — we just created the user) → show error +
 *     hint to use /login
 *   - Step 3 fails → user is signed in, account exists, coupon redeemed,
 *     but no Stripe subscription. Show error + a "Retry checkout" button
 *     that re-calls step 3 without re-creating the user.
 */

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Sparkles, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';

import { supabase } from '../lib/supabase';

const founderSignupFormSchema = z.object({
  coupon_code: z.string().trim().min(3, 'Please enter your coupon code').max(60, 'Coupon code too long'),
  full_name: z.string().trim().min(2, 'Please enter your full name').max(200),
  email: z.string().trim().email('Please enter a valid email').max(320),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

type FounderSignupFormData = z.infer<typeof founderSignupFormSchema>;

type SubmitStage = 'idle' | 'creating_account' | 'signing_in' | 'preparing_checkout' | 'redirecting';

const STAGE_LABELS: Record<SubmitStage, string> = {
  idle: '',
  creating_account: 'Creating your account…',
  signing_in: 'Signing you in…',
  preparing_checkout: 'Preparing your Founders activation…',
  redirecting: 'Redirecting to Stripe…',
};

export const FounderSignupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get('canceled') === '1';

  const [submitting, setSubmitting] = useState(false);
  const [stage, setStage] = useState<SubmitStage>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [retryCheckoutAvailable, setRetryCheckoutAvailable] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<FounderSignupFormData>({
    resolver: zodResolver(founderSignupFormSchema),
    defaultValues: {
      coupon_code: searchParams.get('code') ?? '',
      full_name: '',
      email: '',
      password: '',
    },
  });

  const launchCheckout = async () => {
    setStage('preparing_checkout');
    const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke(
      'founder-checkout',
      { body: {} }
    );

    if (checkoutError || !checkoutData?.url) {
      const ctx: any = (checkoutError as any)?.context;
      const message = ctx?.body?.error || checkoutError?.message || 'Could not start Stripe Checkout. Please try again.';
      setSubmitError(message);
      setRetryCheckoutAvailable(true);
      setStage('idle');
      setSubmitting(false);
      return;
    }

    setStage('redirecting');
    window.location.href = checkoutData.url;
  };

  const onSubmit = async (data: FounderSignupFormData) => {
    setSubmitting(true);
    setSubmitError(null);
    setRetryCheckoutAvailable(false);

    // Step 1: validate coupon + create user
    setStage('creating_account');
    const { data: signupResult, error: signupError } = await supabase.functions.invoke(
      'founder-signup',
      { body: data }
    );

    if (signupError) {
      const ctx: any = (signupError as any).context;
      const message = ctx?.body?.error || signupError.message || 'Signup failed';
      setSubmitError(message);
      setStage('idle');
      setSubmitting(false);
      return;
    }

    if (!signupResult?.success) {
      setSubmitError(signupResult?.error || 'Signup failed');
      setStage('idle');
      setSubmitting(false);
      return;
    }

    // Step 2: sign in with the password they just typed
    setStage('signing_in');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email.trim().toLowerCase(),
      password: data.password,
    });

    if (signInError) {
      setSubmitError(
        `Account created, but auto sign-in failed: ${signInError.message}. Try signing in manually at /login with the password you just set.`
      );
      setStage('idle');
      setSubmitting(false);
      return;
    }

    // Step 3: launch Stripe Checkout
    await launchCheckout();
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] font-sans text-[#1a1a1a]">
      <nav className="border-b border-[#e8e6e3] bg-white">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-[#666] hover:text-[#1a1a1a] text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </button>
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <span className="font-serif font-semibold text-lg tracking-tight">⚡ SparkPlan</span>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/15 text-[#9c7c1c] px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Approved Founders
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-medium tracking-tight mb-3">
            Activate your Founders period
          </h1>
          <p className="text-[#666] leading-relaxed">
            Enter the coupon code from your welcome email plus your account details below.
            We'll set up your account and 60 days of Business access in one step — no card required.
          </p>
        </div>

        {canceled && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              Stripe Checkout was canceled. Your account is still set up — just submit below and we'll re-launch checkout.
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-white border border-[#e8e6e3] rounded-xl p-6 md:p-8 space-y-5"
          noValidate
        >
          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5" htmlFor="coupon_code">
              Founders coupon code <span className="text-red-600">*</span>
            </label>
            <input
              id="coupon_code"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="FOUNDER-XXXX"
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded-md bg-white focus:outline-none focus:border-[#2d3b2d] focus:ring-1 focus:ring-[#2d3b2d]/30 font-mono uppercase tracking-wider"
              {...register('coupon_code')}
            />
            {errors.coupon_code && <p className="mt-1 text-xs text-red-600">{errors.coupon_code.message}</p>}
            <p className="mt-1 text-xs text-[#888]">
              From your welcome email. Case doesn't matter.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5" htmlFor="full_name">
              Full name <span className="text-red-600">*</span>
            </label>
            <input
              id="full_name"
              type="text"
              autoComplete="name"
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded-md bg-white focus:outline-none focus:border-[#2d3b2d] focus:ring-1 focus:ring-[#2d3b2d]/30"
              {...register('full_name')}
            />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5" htmlFor="email">
              Email <span className="text-red-600">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded-md bg-white focus:outline-none focus:border-[#2d3b2d] focus:ring-1 focus:ring-[#2d3b2d]/30"
              {...register('email')}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5" htmlFor="password">
              Choose a password <span className="text-red-600">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded-md bg-white focus:outline-none focus:border-[#2d3b2d] focus:ring-1 focus:ring-[#2d3b2d]/30"
              {...register('password')}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
            <p className="mt-1 text-xs text-[#888]">At least 8 characters.</p>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {retryCheckoutAvailable ? (
            <button
              type="button"
              onClick={async () => {
                setSubmitting(true);
                setSubmitError(null);
                setRetryCheckoutAvailable(false);
                await launchCheckout();
              }}
              disabled={submitting}
              className="w-full bg-[#2d3b2d] hover:bg-[#3d4f3d] disabled:bg-[#666] text-white px-6 py-3 text-base font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {STAGE_LABELS[stage]}</>
                : <>Retry Stripe Checkout</>}
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#2d3b2d] hover:bg-[#3d4f3d] disabled:bg-[#666] text-white px-6 py-3 text-base font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {STAGE_LABELS[stage]}</>
                : <>Activate Founders period — 60 days Business, no card</>}
            </button>
          )}

          <div className="border-t border-[#e8e6e3] pt-4">
            <p className="text-xs text-[#888] text-center leading-relaxed">
              Don't have a coupon code? You can still try SparkPlan with the standard{' '}
              <Link to="/signup" className="underline hover:text-[#1a1a1a]">14-day free trial</Link>.
              Already have an account? <Link to="/login" className="underline hover:text-[#1a1a1a]">Sign in</Link>.
            </p>
          </div>
        </form>

        <div className="mt-8 grid md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-[#3d6b3d] mb-2" />
            <p className="font-medium text-[#1a1a1a]">No card required</p>
            <p className="text-xs text-[#666] mt-1">
              Your coupon makes the first 60 days free. Stripe skips card collection.
            </p>
          </div>
          <div className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-[#3d6b3d] mb-2" />
            <p className="font-medium text-[#1a1a1a]">Business tier unlocked</p>
            <p className="text-xs text-[#666] mt-1">
              AI Copilot, Inspector Mode, Arc Flash, Permit Packets — everything we have.
            </p>
          </div>
          <div className="bg-white border border-[#e8e6e3] rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 text-[#3d6b3d] mb-2" />
            <p className="font-medium text-[#1a1a1a]">Cancel any time</p>
            <p className="text-xs text-[#666] mt-1">
              At day 60 Stripe asks for a card to continue. Cancel from Settings → Billing if it's not for you.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
