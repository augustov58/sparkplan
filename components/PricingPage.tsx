/**
 * Pricing Page Component
 * Displays subscription plans with upgrade/downgrade functionality for authenticated users
 */

import React, { useState } from 'react';
import { Check, Loader2, Crown, AlertCircle, ExternalLink, X, Clock, Gift } from 'lucide-react';
import { useSubscription, SubscriptionPlan, PLAN_FEATURES, PLAN_LIMITS, FEATURE_COMPARISON } from '@/hooks/useSubscription';
import { PromoCodeInput } from './TrialBanner';

const PLAN_PRICING: Record<SubscriptionPlan, { price: number; interval: string }> = {
  free: { price: 0, interval: 'forever' },
  starter: { price: 29, interval: 'mo' },
  pro: { price: 49, interval: 'mo' },
  business: { price: 149, interval: 'mo' },
  enterprise: { price: 0, interval: 'custom' }, // Contact sales
};

const PLAN_DESCRIPTIONS: Record<SubscriptionPlan, string> = {
  free: 'Try NEC compliance tools with no commitment.',
  starter: 'For solo electricians starting with permits.',
  pro: 'Unlimited projects with EV tools.',
  business: 'AI suite, PM tools, and team features.',
  enterprise: 'Custom solutions for large organizations.',
};

// Helper component for feature comparison table cells
const FeatureCell: React.FC<{ value: boolean | string; highlight?: boolean }> = ({ value, highlight }) => {
  if (value === true) {
    return <Check className={`w-5 h-5 mx-auto ${highlight ? 'text-electric-600' : 'text-green-500'}`} />;
  }
  if (value === false) {
    return <X className="w-5 h-5 mx-auto text-gray-300" />;
  }
  if (value === 'Coming Soon') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
        <Clock className="w-3 h-3" /> Soon
      </span>
    );
  }
  // String value (like "10", "Unlimited", "Community", etc.)
  return <span className={`text-sm font-medium ${highlight ? 'text-electric-700' : 'text-gray-700'}`}>{value}</span>;
};

export const PricingPage: React.FC = () => {
  const {
    subscription,
    plan: currentPlan,
    isActive,
    isTrial,
    daysUntilTrialEnd,
    createCheckoutSession,
    openBillingPortal,
    loading,
    error,
  } = useSubscription();

  const [checkoutLoading, setCheckoutLoading] = useState<SubscriptionPlan | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const handleUpgrade = async (targetPlan: SubscriptionPlan) => {
    if (targetPlan === 'free' || targetPlan === 'enterprise') return;

    setCheckoutLoading(targetPlan);
    try {
      const url = await createCheckoutSession(targetPlan);
      if (url) {
        window.location.href = url;
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const url = await openBillingPortal();
      if (url) {
        window.location.href = url;
      }
    } finally {
      setPortalLoading(false);
    }
  };

  const getPlanButton = (plan: SubscriptionPlan) => {
    const isCurrentPlan = plan === currentPlan;
    const isUpgrade = getPlanRank(plan) > getPlanRank(currentPlan);
    const isDowngrade = getPlanRank(plan) < getPlanRank(currentPlan);
    const isLoading = checkoutLoading === plan;

    if (plan === 'enterprise') {
      return (
        <a
          href="mailto:sales@sparkplan.app?subject=Enterprise%20Plan%20Inquiry"
          className="w-full block text-center bg-white text-gray-900 hover:bg-gray-100 py-2.5 rounded-sm font-semibold transition-colors"
        >
          Contact Sales
        </a>
      );
    }

    if (isCurrentPlan) {
      return (
        <button
          disabled
          className="w-full bg-gray-600 text-gray-300 py-2.5 rounded-sm font-semibold cursor-not-allowed"
        >
          Current Plan
        </button>
      );
    }

    if (plan === 'free') {
      return subscription?.stripe_subscription_id ? (
        <button
          onClick={handleManageSubscription}
          disabled={portalLoading}
          className="w-full bg-gray-700 text-white hover:bg-gray-600 py-2.5 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Manage in Portal'}
        </button>
      ) : (
        <button disabled className="w-full bg-gray-600 text-gray-400 py-2.5 rounded-sm cursor-not-allowed">
          Current Plan
        </button>
      );
    }

    if (isUpgrade) {
      return (
        <button
          onClick={() => handleUpgrade(plan)}
          disabled={isLoading}
          className={`w-full py-2.5 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
            plan === 'pro'
              ? 'bg-electric-400 hover:bg-electric-500 text-gray-900'
              : 'bg-white text-gray-900 hover:bg-gray-100'
          }`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              Upgrade to {plan.charAt(0).toUpperCase() + plan.slice(1)}
              {isTrial && ' (14-day trial)'}
            </>
          )}
        </button>
      );
    }

    if (isDowngrade && subscription?.stripe_subscription_id) {
      return (
        <button
          onClick={handleManageSubscription}
          disabled={portalLoading}
          className="w-full bg-gray-700 text-white hover:bg-gray-600 py-2.5 rounded-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Downgrade in Portal'}
        </button>
      );
    }

    return null;
  };

  const getPlanRank = (plan: SubscriptionPlan): number => {
    const ranks: Record<SubscriptionPlan, number> = {
      free: 0,
      starter: 1,
      pro: 2,
      business: 3,
      enterprise: 4,
    };
    return ranks[plan];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-electric-500" />
      </div>
    );
  }

  const plans: SubscriptionPlan[] = ['free', 'starter', 'pro', 'business'];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Choose Your Plan</h1>
        <p className="text-gray-600">Scale your NEC compliance workflow with the right tools.</p>
      </div>

      {/* Current subscription info */}
      {subscription && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5 text-electric-500" />
              <div>
                <span className="font-semibold text-gray-900">
                  Current Plan: {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
                </span>
                {isTrial && daysUntilTrialEnd !== null && (
                  <span className="ml-2 text-sm text-amber-600">
                    ({daysUntilTrialEnd} days left in trial)
                  </span>
                )}
                {subscription.cancel_at_period_end && (
                  <span className="ml-2 text-sm text-red-600">
                    (Cancels at period end)
                  </span>
                )}
              </div>
            </div>
            {subscription.stripe_subscription_id && (
              <button
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="text-sm text-electric-600 hover:text-electric-700 font-medium flex items-center gap-1"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Manage Subscription <ExternalLink className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Pricing grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isPopular = plan === 'pro';
          const isCurrent = plan === currentPlan;
          const pricing = PLAN_PRICING[plan];
          const features = PLAN_FEATURES[plan];
          const limits = PLAN_LIMITS[plan];

          return (
            <div
              key={plan}
              className={`bg-white p-6 rounded-lg border-2 relative flex flex-col ${
                isPopular
                  ? 'border-electric-500 shadow-sm'
                  : isCurrent
                  ? 'border-gray-400'
                  : 'border-gray-200'
              }`}
            >
              {isPopular && (
                <div className="absolute top-0 right-0 bg-electric-500 text-gray-900 text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                  POPULAR
                </div>
              )}
              {isCurrent && !isPopular && (
                <div className="absolute top-0 right-0 bg-gray-700 text-white text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-lg">
                  CURRENT
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900 capitalize">{plan}</h3>
                <p className="text-gray-500 mt-1 text-sm h-10">{PLAN_DESCRIPTIONS[plan]}</p>
              </div>

              <div className="text-3xl font-bold text-gray-900 mb-4">
                {pricing.price === 0 ? (
                  plan === 'enterprise' ? 'Custom' : '$0'
                ) : (
                  `$${pricing.price}`
                )}
                <span className="text-lg text-gray-500 font-normal">/{pricing.interval}</span>
              </div>

              {/* Limits */}
              <div className="text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                <div className="flex justify-between">
                  <span>Projects:</span>
                  <span className="font-medium">
                    {limits.projects === Infinity ? 'Unlimited' : limits.projects}
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span>Permits:</span>
                  <span className="font-medium">
                    {plan === 'free' ? 'None' : 'Unlimited'}
                  </span>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2 mb-6 flex-1 text-sm">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-gray-700">
                    <Check className="w-4 h-4 text-electric-500 flex-shrink-0 mt-0.5" />
                    {feature}
                  </li>
                ))}
              </ul>

              {/* Action button */}
              {getPlanButton(plan)}
            </div>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="mt-8 bg-gray-900 rounded-lg p-8 text-center">
        <h3 className="text-xl font-bold text-white mb-2">Need Enterprise Features?</h3>
        <p className="text-gray-400 mb-4">
          Get unlimited seats, SSO/SAML, dedicated support, and custom integrations.
        </p>
        <a
          href="mailto:sales@sparkplan.app?subject=Enterprise%20Plan%20Inquiry"
          className="inline-block bg-electric-400 hover:bg-electric-500 text-gray-900 px-6 py-2.5 rounded-sm font-semibold transition-colors"
        >
          Contact Sales
        </a>
      </div>

      {/* Promo Code Section */}
      <div className="mt-8 bg-gradient-to-r from-electric-50 to-blue-50 border border-electric-200 rounded-lg p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-electric-100 rounded-full">
            <Gift className="w-5 h-5 text-electric-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Have a promo code?</h3>
            <p className="text-gray-600 text-sm mb-4">
              Enter your promotional code below to unlock special access or extend your trial.
            </p>
            <PromoCodeInput className="max-w-md" />
          </div>
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="mt-12">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Complete Feature Comparison</h3>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-5 bg-gray-50 border-b border-gray-200">
            <div className="p-4 font-semibold text-gray-700 text-sm">Feature</div>
            <div className="p-4 font-semibold text-gray-700 text-sm text-center">Free</div>
            <div className="p-4 font-semibold text-gray-700 text-sm text-center">Starter<br/><span className="font-normal text-gray-500">$29/mo</span></div>
            <div className="p-4 font-semibold text-electric-600 text-sm text-center bg-electric-50">Pro<br/><span className="font-normal text-electric-500">$49/mo</span></div>
            <div className="p-4 font-semibold text-gray-700 text-sm text-center">Business<br/><span className="font-normal text-gray-500">$149/mo</span></div>
          </div>

          {/* Table Body */}
          {FEATURE_COMPARISON.map((category, catIndex) => (
            <div key={category.category}>
              {/* Category Header */}
              <div className="grid grid-cols-5 bg-gray-100 border-b border-gray-200">
                <div className="col-span-5 p-3 font-semibold text-gray-800 text-sm uppercase tracking-wide">
                  {category.category}
                </div>
              </div>

              {/* Features in Category */}
              {category.features.map((feature, featIndex) => (
                <div
                  key={feature.name}
                  className={`grid grid-cols-5 border-b border-gray-100 ${
                    featIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <div className="p-3 text-sm text-gray-700">{feature.name}</div>
                  <div className="p-3 text-center">
                    <FeatureCell value={feature.free} />
                  </div>
                  <div className="p-3 text-center">
                    <FeatureCell value={feature.starter} />
                  </div>
                  <div className="p-3 text-center bg-electric-50/30">
                    <FeatureCell value={feature.pro} highlight />
                  </div>
                  <div className="p-3 text-center">
                    <FeatureCell value={feature.business} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Pricing FAQ</h3>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">What happens after my trial?</h4>
            <p className="text-sm text-gray-600">
              Your 14-day trial gives you full access to your chosen plan. After the trial, you'll be charged automatically unless you cancel.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Can I change plans anytime?</h4>
            <p className="text-sm text-gray-600">
              Yes! Upgrade instantly or downgrade at the end of your billing period. Changes take effect immediately for upgrades.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Are permit generations limited?</h4>
            <p className="text-sm text-gray-600">
              No! All paid plans include unlimited permit generations. Regenerate as many times as you need — we don't penalize iteration.
            </p>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Do you offer annual billing?</h4>
            <p className="text-sm text-gray-600">
              Yes! Contact us for annual pricing with 20% discount. Email sales@sparkplan.app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
