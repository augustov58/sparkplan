/**
 * Subscription Hook
 * Manages user subscription state and Stripe integration
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';

export type SubscriptionPlan = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'incomplete_expired' | 'paused' | 'unpaid';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  permits_used_this_month: number;
  projects_count: number;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  trial_start: string | null;
  trial_end: string | null;
  created_at: string;
  updated_at: string;
}

// Plan limits (permits unlimited for all paid tiers — limit by projects, not generations)
export const PLAN_LIMITS: Record<SubscriptionPlan, { projects: number }> = {
  free: { projects: 3 },
  starter: { projects: 10 },
  pro: { projects: Infinity },
  business: { projects: Infinity },
  enterprise: { projects: Infinity },
};

// Plan features (for display - short list)
export const PLAN_FEATURES: Record<SubscriptionPlan, string[]> = {
  free: [
    'Explore the platform',
    'Basic calculators',
    'NEC code search',
    '3 projects max',
  ],
  starter: [
    'Unlimited permits per project',
    '10 projects',
    'All residential calculators',
    'Panel schedules & diagrams',
    'Permit Packet Generator',
    'Jurisdiction Wizard',
  ],
  pro: [
    'Unlimited projects',
    'Everything in Starter',
    'Service Upgrade Wizard',
    'EVEMS Calculator',
    'EV Panel Templates',
    'Priority email support',
  ],
  business: [
    'Everything in Pro',
    'AI Copilot Chatbot',
    'AI Inspector Mode',
    'AI Pre-Inspection Checklist',
    'Project Management Suite',
    'Arc Flash & Advanced SC',
    'Team collaboration (5 users)',
  ],
  enterprise: [
    'Everything in Business',
    'Unlimited seats',
    'SSO/SAML',
    'Dedicated support',
    'Custom integrations',
  ],
};

// Feature access control - which plans have access to which features
export const FEATURE_ACCESS: Record<string, SubscriptionPlan[]> = {
  // ═══════════════════════════════════════════════════════════════
  // FREE TIER - Basic exploration only
  // ═══════════════════════════════════════════════════════════════
  'nec-search': ['free', 'starter', 'pro', 'business', 'enterprise'],
  'voltage-drop-calc': ['free', 'starter', 'pro', 'business', 'enterprise'],
  'conductor-sizing-calc': ['free', 'starter', 'pro', 'business', 'enterprise'],
  'basic-calculators': ['free', 'starter', 'pro', 'business', 'enterprise'],

  // ═══════════════════════════════════════════════════════════════
  // STARTER TIER ($29) - Full residential workflow
  // ═══════════════════════════════════════════════════════════════
  // Calculators
  'dwelling-load-calc': ['starter', 'pro', 'business', 'enterprise'],
  'commercial-load-calc': ['starter', 'pro', 'business', 'enterprise'],
  'residential-calculators': ['starter', 'pro', 'business', 'enterprise'],
  'grounding-calc': ['starter', 'pro', 'business', 'enterprise'],
  'short-circuit-basic': ['starter', 'pro', 'business', 'enterprise'],

  // Design tools
  'panel-schedules': ['starter', 'pro', 'business', 'enterprise'],
  'one-line-diagram': ['starter', 'pro', 'business', 'enterprise'],
  'feeder-sizing': ['starter', 'pro', 'business', 'enterprise'],
  'circuit-design': ['starter', 'pro', 'business', 'enterprise'],

  // Permit workflow
  'create-permit': ['starter', 'pro', 'business', 'enterprise'],
  'permit-packet': ['starter', 'pro', 'business', 'enterprise'],
  'jurisdiction-wizard': ['starter', 'pro', 'business', 'enterprise'],

  // ═══════════════════════════════════════════════════════════════
  // PRO TIER ($49) - EV installers & unlimited projects
  // ═══════════════════════════════════════════════════════════════
  'service-upgrade-wizard': ['pro', 'business', 'enterprise'],
  'evems-calculator': ['pro', 'business', 'enterprise'],
  'ev-panel-templates': ['pro', 'business', 'enterprise'],
  'ev-charging-calc': ['pro', 'business', 'enterprise'],
  'circuit-sharing-calc': ['pro', 'business', 'enterprise'],
  'multi-family-ev': ['pro', 'business', 'enterprise'],
  'unlimited-projects': ['pro', 'business', 'enterprise'],

  // ═══════════════════════════════════════════════════════════════
  // BUSINESS TIER ($149) - AI suite, teams & commercial
  // ═══════════════════════════════════════════════════════════════
  // AI features (consolidated here — highest-cost backend features)
  'ai-copilot': ['business', 'enterprise'],
  'ai-inspector': ['business', 'enterprise'],
  'pre-inspection-check': ['business', 'enterprise'],
  'change-impact': ['business', 'enterprise'],

  // Project Management Suite
  'rfi-tracking': ['business', 'enterprise'],
  'site-visits': ['business', 'enterprise'],
  'project-calendar': ['business', 'enterprise'],
  'issues-log': ['business', 'enterprise'],
  'pm-suite': ['business', 'enterprise'],

  // Advanced calculations
  'arc-flash': ['business', 'enterprise'],
  'short-circuit-advanced': ['business', 'enterprise'],

  // Team features
  'team-collaboration': ['business', 'enterprise'],
  'custom-branding': ['business', 'enterprise'],

  // ═══════════════════════════════════════════════════════════════
  // ENTERPRISE - Custom solutions
  // ═══════════════════════════════════════════════════════════════
  'sso-saml': ['enterprise'],
  'api-access': ['enterprise'],
  'white-label': ['enterprise'],
  'unlimited-seats': ['enterprise'],
};

// Full feature comparison matrix for pricing page
export const FEATURE_COMPARISON: { category: string; features: { name: string; free: boolean | string; starter: boolean | string; pro: boolean | string; business: boolean | string }[] }[] = [
  {
    category: 'Core Limits',
    features: [
      { name: 'Projects', free: '3', starter: '10', pro: 'Unlimited', business: 'Unlimited' },
      { name: 'Permit Generation', free: false, starter: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    ]
  },
  {
    category: 'Calculators',
    features: [
      { name: 'Voltage Drop Calculator', free: true, starter: true, pro: true, business: true },
      { name: 'Conductor Sizing', free: true, starter: true, pro: true, business: true },
      { name: 'NEC Code Search', free: true, starter: true, pro: true, business: true },
      { name: 'Dwelling Load Calculator', free: false, starter: true, pro: true, business: true },
      { name: 'Commercial Load Calculator', free: false, starter: true, pro: true, business: true },
      { name: 'Grounding Calculator', free: false, starter: true, pro: true, business: true },
      { name: 'Short Circuit (Basic)', free: false, starter: true, pro: true, business: true },
      { name: 'Service Upgrade Wizard', free: false, starter: false, pro: true, business: true },
      { name: 'EVEMS Calculator', free: false, starter: false, pro: true, business: true },
      { name: 'Short Circuit (Advanced)', free: false, starter: false, pro: false, business: true },
      { name: 'Arc Flash Calculator', free: false, starter: false, pro: false, business: 'Coming Soon' },
    ]
  },
  {
    category: 'Design Tools',
    features: [
      { name: 'Panel Schedules', free: false, starter: true, pro: true, business: true },
      { name: 'One-Line Diagrams', free: false, starter: true, pro: true, business: true },
      { name: 'Feeder Sizing', free: false, starter: true, pro: true, business: true },
      { name: 'Circuit Design', free: false, starter: true, pro: true, business: true },
      { name: 'EV Panel Templates', free: false, starter: false, pro: true, business: true },
    ]
  },
  {
    category: 'Permit Workflow',
    features: [
      { name: 'Permit Packet Generator', free: false, starter: true, pro: true, business: true },
      { name: 'Jurisdiction Wizard', free: false, starter: true, pro: true, business: true },
    ]
  },
  {
    category: 'AI Suite',
    features: [
      { name: 'AI Copilot Chatbot', free: false, starter: false, pro: false, business: true },
      { name: 'AI Inspector Mode', free: false, starter: false, pro: false, business: true },
      { name: 'AI Pre-Inspection Checklist', free: false, starter: false, pro: false, business: true },
      { name: 'Change Impact Analyzer', free: false, starter: false, pro: false, business: true },
    ]
  },
  {
    category: 'Project Management',
    features: [
      { name: 'RFI Tracking', free: false, starter: false, pro: false, business: true },
      { name: 'Site Visit Logging', free: false, starter: false, pro: false, business: true },
      { name: 'Project Calendar', free: false, starter: false, pro: false, business: true },
      { name: 'Issues & Inspection Log', free: false, starter: false, pro: false, business: true },
    ]
  },
  {
    category: 'Team & Support',
    features: [
      { name: 'Team Members', free: '1', starter: '1', pro: '1', business: '5' },
      { name: 'Custom Report Branding', free: false, starter: false, pro: false, business: true },
      { name: 'Team Collaboration', free: false, starter: false, pro: false, business: 'Coming Soon' },
      { name: 'Support', free: 'Community', starter: 'Email', pro: 'Priority Email', business: 'Priority Chat + Email' },
    ]
  },
];

export interface PromoCodeResult {
  success: boolean;
  error?: string;
  plan?: SubscriptionPlan;
  duration_days?: number;
  message?: string;
}

export interface UseSubscriptionReturn {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  plan: SubscriptionPlan;
  effectivePlan: SubscriptionPlan; // The plan after considering trial expiration
  isActive: boolean;
  isTrial: boolean;
  isTrialExpired: boolean;
  daysUntilTrialEnd: number | null;
  /** @deprecated Permits are now unlimited per project. Always returns Infinity. */
  permitsRemaining: number;
  projectsRemaining: number;
  /** @deprecated Permits are now unlimited per project. Always returns true. */
  canCreatePermit: boolean;
  canCreateProject: boolean;
  hasFeature: (feature: string) => boolean;
  createCheckoutSession: (plan: SubscriptionPlan) => Promise<string | null>;
  openBillingPortal: () => Promise<string | null>;
  redeemPromoCode: (code: string) => Promise<PromoCodeResult>;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        // If no subscription exists, create one with free plan
        if (fetchError.code === 'PGRST116') {
          const { data: newSub, error: createError } = await supabase
            .from('subscriptions')
            .insert({ user_id: user.id, plan: 'free', status: 'active' })
            .select()
            .single();

          if (createError) throw createError;
          setSubscription(newSub);
        } else {
          throw fetchError;
        }
      } else {
        setSubscription(data);
      }
    } catch (err: any) {
      console.error('Error fetching subscription:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial fetch and real-time subscription
  useEffect(() => {
    fetchSubscription();

    // Subscribe to changes
    if (user) {
      const channel = supabase
        .channel('subscription-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscriptions',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new) {
              setSubscription(payload.new as Subscription);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user, fetchSubscription]);

  // Derived state
  const plan = subscription?.plan || 'free';
  const isTrial = subscription?.status === 'trialing';

  // Calculate days until trial ends
  const daysUntilTrialEnd = (() => {
    if (!subscription?.trial_end) return null;
    const trialEnd = new Date(subscription.trial_end);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  })();

  // Check if trial has expired
  const isTrialExpired = (() => {
    if (!isTrial || !subscription?.trial_end) return false;
    const trialEnd = new Date(subscription.trial_end);
    return new Date() > trialEnd;
  })();

  // Effective plan considers trial expiration - if trial expired, fall back to free
  const effectivePlan: SubscriptionPlan = (() => {
    if (isTrialExpired) return 'free';
    if (subscription?.status === 'active' || subscription?.status === 'trialing') {
      return plan;
    }
    return 'free';
  })();

  const isActive = (subscription?.status === 'active' || subscription?.status === 'trialing') && !isTrialExpired;

  // Calculate remaining projects based on effective plan
  const limits = PLAN_LIMITS[effectivePlan];
  const projectsRemaining = limits.projects === Infinity
    ? Infinity
    : Math.max(0, limits.projects - (subscription?.projects_count || 0));

  // Permits are now unlimited for all paid tiers (limit by projects, not generations)
  const permitsRemaining = Infinity;
  const canCreatePermit = true;
  const canCreateProject = projectsRemaining > 0;

  // Check if user has a specific feature (using effective plan)
  const hasFeature = useCallback((feature: string): boolean => {
    const allowedPlans = FEATURE_ACCESS[feature];
    if (!allowedPlans) return true; // Feature not gated
    return allowedPlans.includes(effectivePlan);
  }, [effectivePlan]);

  // Create Stripe checkout session
  const createCheckoutSession = useCallback(async (targetPlan: SubscriptionPlan): Promise<string | null> => {
    if (!user) {
      setError('Please sign in to upgrade');
      return null;
    }

    if (targetPlan === 'free') {
      setError('Cannot checkout for free plan');
      return null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ plan: targetPlan }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      return data.url;
    } catch (err: any) {
      console.error('Error creating checkout session:', err);
      setError(err.message);
      return null;
    }
  }, [user]);

  // Open Stripe billing portal
  const openBillingPortal = useCallback(async (): Promise<string | null> => {
    if (!user) {
      setError('Please sign in');
      return null;
    }

    if (!subscription?.stripe_customer_id) {
      setError('No active subscription found');
      return null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-portal`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({}),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal');
      }

      return data.url;
    } catch (err: any) {
      console.error('Error opening billing portal:', err);
      setError(err.message);
      return null;
    }
  }, [user, subscription]);

  // Redeem a promo code
  const redeemPromoCode = useCallback(async (code: string): Promise<PromoCodeResult> => {
    if (!user) {
      return { success: false, error: 'Please sign in to redeem a promo code' };
    }

    try {
      const { data, error: rpcError } = await supabase
        .rpc('redeem_promo_code', {
          p_code: code.toUpperCase().trim(),
          p_user_id: user.id
        });

      if (rpcError) {
        console.error('Error redeeming promo code:', rpcError);
        return { success: false, error: rpcError.message };
      }

      // Refresh subscription data after redemption
      if (data?.success) {
        await fetchSubscription();
      }

      return data as PromoCodeResult;
    } catch (err: any) {
      console.error('Error redeeming promo code:', err);
      return { success: false, error: err.message };
    }
  }, [user, fetchSubscription]);

  return {
    subscription,
    loading,
    error,
    plan,
    effectivePlan,
    isActive,
    isTrial,
    isTrialExpired,
    daysUntilTrialEnd,
    permitsRemaining,
    projectsRemaining,
    canCreatePermit,
    canCreateProject,
    hasFeature,
    createCheckoutSession,
    openBillingPortal,
    redeemPromoCode,
    refresh: fetchSubscription,
  };
}
