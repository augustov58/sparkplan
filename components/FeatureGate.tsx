/**
 * Feature Gate Component
 * Controls access to features based on subscription plan
 * Shows upgrade prompts when users try to access gated features
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Sparkles } from 'lucide-react';
import { useSubscription, SubscriptionPlan, FEATURE_ACCESS } from '@/hooks/useSubscription';

interface FeatureGateProps {
  /** The feature key to check access for (must match key in FEATURE_ACCESS) */
  feature: string;
  /** Content to render if user has access */
  children: React.ReactNode;
  /** Optional custom message for the upgrade prompt */
  message?: string;
  /** Minimum plan required (auto-detected from FEATURE_ACCESS if not provided) */
  minPlan?: SubscriptionPlan;
  /** Render as inline badge instead of blocking overlay */
  inline?: boolean;
  /** Show a subtle lock icon instead of full overlay */
  subtle?: boolean;
}

/**
 * Get the minimum plan required for a feature
 */
const getMinimumPlan = (feature: string): SubscriptionPlan => {
  const allowedPlans = FEATURE_ACCESS[feature];
  if (!allowedPlans || allowedPlans.length === 0) return 'free';

  const planOrder: SubscriptionPlan[] = ['free', 'starter', 'pro', 'business', 'enterprise'];
  for (const plan of planOrder) {
    if (allowedPlans.includes(plan)) return plan;
  }
  return 'enterprise';
};

/**
 * Get friendly plan name
 */
const getPlanDisplayName = (plan: SubscriptionPlan): string => {
  const names: Record<SubscriptionPlan, string> = {
    free: 'Free',
    starter: 'Starter',
    pro: 'Pro',
    business: 'Business',
    enterprise: 'Enterprise',
  };
  return names[plan];
};

/**
 * FeatureGate Component
 * Wraps content and controls access based on subscription
 *
 * @example
 * // Full blocking gate
 * <FeatureGate feature="ai-inspector">
 *   <AIInspectorContent />
 * </FeatureGate>
 *
 * @example
 * // Subtle lock icon
 * <FeatureGate feature="arc-flash" subtle>
 *   <ArcFlashCalculator />
 * </FeatureGate>
 *
 * @example
 * // Inline badge
 * <FeatureGate feature="evems-calculator" inline>
 *   <button>Open EVEMS Calculator</button>
 * </FeatureGate>
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({
  feature,
  children,
  message,
  minPlan,
  inline = false,
  subtle = false,
}) => {
  const navigate = useNavigate();
  const { hasFeature, plan: currentPlan } = useSubscription();

  // Check if user has access
  const hasAccess = hasFeature(feature);

  // If user has access, render children normally
  if (hasAccess) {
    return <>{children}</>;
  }

  // Determine minimum required plan
  const requiredPlan = minPlan || getMinimumPlan(feature);
  const planName = getPlanDisplayName(requiredPlan);

  // Default message
  const defaultMessage = `This feature requires a ${planName} plan or higher.`;
  const displayMessage = message || defaultMessage;

  // Inline mode - show a small badge/tooltip
  if (inline) {
    return (
      <div className="relative inline-flex items-center gap-2 opacity-60 cursor-not-allowed">
        {children}
        <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
          <Lock className="w-3 h-3" />
          {planName}
        </span>
      </div>
    );
  }

  // Subtle mode - show lock icon overlay
  if (subtle) {
    return (
      <div className="relative">
        <div className="opacity-40 pointer-events-none select-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={() => navigate('/pricing')}
            className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition-shadow"
          >
            <Lock className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              Upgrade to {planName}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Full blocking mode - show upgrade prompt overlay
  return (
    <div className="relative min-h-[300px] bg-gray-50 border border-gray-200 rounded-lg">
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 bg-[#e8f5e8] rounded-full flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-[#2d3b2d]" />
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2">
          Upgrade to {planName}
        </h3>

        <p className="text-gray-600 mb-6 max-w-md">
          {displayMessage}
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/pricing')}
            className="inline-flex items-center gap-2 bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
          >
            View Plans
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          You're currently on the <span className="font-medium capitalize">{currentPlan}</span> plan.
        </p>
      </div>
    </div>
  );
};

/**
 * Hook to check feature access programmatically
 * Useful for conditionally rendering UI elements
 *
 * @example
 * const { canAccess, requiredPlan } = useFeatureAccess('ai-inspector');
 * if (!canAccess) {
 *   return <UpgradePrompt plan={requiredPlan} />;
 * }
 */
export const useFeatureAccess = (feature: string) => {
  const { hasFeature, plan } = useSubscription();

  return {
    canAccess: hasFeature(feature),
    requiredPlan: getMinimumPlan(feature),
    currentPlan: plan,
  };
};

/**
 * Simple upgrade banner component
 * Shows a dismissable banner prompting users to upgrade
 */
interface UpgradeBannerProps {
  feature: string;
  onDismiss?: () => void;
}

export const UpgradeBanner: React.FC<UpgradeBannerProps> = ({ feature, onDismiss }) => {
  const navigate = useNavigate();
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) return null;

  const requiredPlan = getMinimumPlan(feature);
  const planName = getPlanDisplayName(requiredPlan);

  return (
    <div className="bg-gradient-to-r from-[#f0f5f0] to-blue-50 border border-[#2d3b2d]/30 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-[#2d3b2d]" />
          <span className="text-sm text-gray-700">
            Unlock this feature with <span className="font-semibold">{planName}</span> plan
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/pricing')}
            className="text-sm font-medium text-[#2d3b2d] hover:text-[#2d3b2d]"
          >
            Upgrade
          </button>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-gray-400 hover:text-gray-500"
            >
              &times;
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
