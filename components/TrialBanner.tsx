/**
 * Trial Banner Component
 * Shows trial status and countdown for users on trial plans
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Sparkles, AlertTriangle, X } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

interface TrialBannerProps {
  onDismiss?: () => void;
  compact?: boolean;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onDismiss, compact = false }) => {
  const navigate = useNavigate();
  const { isTrial, isTrialExpired, daysUntilTrialEnd, plan } = useSubscription();

  // Don't show if not on trial
  if (!isTrial && !isTrialExpired) return null;

  // Trial expired state
  if (isTrialExpired) {
    return (
      <div className="bg-gradient-to-r from-[#f0f5f0] to-[#e8f5e8] border-b border-[#3d6b3d]/30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#e8f5e8] rounded-full">
                <AlertTriangle className="w-4 h-4 text-[#3d6b3d]" />
              </div>
              <div>
                <span className="text-amber-800 font-medium">Your free trial has ended.</span>
                <span className="text-[#2d3b2d] ml-2">
                  Upgrade now to continue using Pro features.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/pricing')}
                className="bg-[#f0f5f0]0 hover:bg-[#2d3b2d] text-white font-medium px-4 py-1.5 rounded-lg text-sm transition-colors"
              >
                View Plans
              </button>
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-amber-500 hover:text-[#2d3b2d] p-1"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Determine urgency level
  const isUrgent = daysUntilTrialEnd !== null && daysUntilTrialEnd <= 3;
  const isWarning = daysUntilTrialEnd !== null && daysUntilTrialEnd <= 7;

  // Compact version for header
  if (compact) {
    return (
      <button
        onClick={() => navigate('/pricing')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
          isUrgent
            ? 'bg-red-100 text-red-700 hover:bg-red-200'
            : isWarning
            ? 'bg-[#e8f5e8] text-[#2d3b2d] hover:bg-[#e8f5e8]'
            : 'bg-[#e8f5e8] text-[#2d3b2d] hover:bg-[#d1e7d1]'
        }`}
      >
        <Clock className="w-3.5 h-3.5" />
        <span>{daysUntilTrialEnd} days left</span>
      </button>
    );
  }

  // Full banner
  return (
    <div className={`border-b ${
      isUrgent
        ? 'bg-gradient-to-r from-red-50 to-[#e8f5e8] border-red-200'
        : isWarning
        ? 'bg-gradient-to-r from-[#f0f5f0] to-[#fff8e6] border-[#3d6b3d]/30'
        : 'bg-gradient-to-r from-[#f0f5f0] to-blue-50 border-[#2d3b2d]/30'
    }`}>
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded-full ${
              isUrgent
                ? 'bg-red-100'
                : isWarning
                ? 'bg-[#e8f5e8]'
                : 'bg-[#e8f5e8]'
            }`}>
              <Sparkles className={`w-4 h-4 ${
                isUrgent
                  ? 'text-red-600'
                  : isWarning
                  ? 'text-[#3d6b3d]'
                  : 'text-[#2d3b2d]'
              }`} />
            </div>
            <div>
              <span className={`font-medium ${
                isUrgent
                  ? 'text-red-800'
                  : isWarning
                  ? 'text-amber-800'
                  : 'text-[#1a231a]'
              }`}>
                {daysUntilTrialEnd === 1 ? 'Last day' : `${daysUntilTrialEnd} days left`} of your {plan.charAt(0).toUpperCase() + plan.slice(1)} trial!
              </span>
              <span className={`ml-2 ${
                isUrgent
                  ? 'text-red-700'
                  : isWarning
                  ? 'text-[#2d3b2d]'
                  : 'text-[#2d3b2d]'
              }`}>
                {isUrgent
                  ? 'Upgrade now to keep your Pro features.'
                  : 'Enjoying the full experience? Subscribe to continue.'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/pricing')}
              className={`font-medium px-4 py-1.5 rounded-lg text-sm transition-colors ${
                isUrgent
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : isWarning
                  ? 'bg-[#f0f5f0]0 hover:bg-[#2d3b2d] text-white'
                  : 'bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white'
              }`}
            >
              Upgrade Now
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`p-1 ${
                  isUrgent
                    ? 'text-red-500 hover:text-red-700'
                    : isWarning
                    ? 'text-amber-500 hover:text-[#2d3b2d]'
                    : 'text-[#2d3b2d] hover:text-[#2d3b2d]'
                }`}
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Promo Code Input Component
 * Allows users to redeem promotional codes
 */
interface PromoCodeInputProps {
  className?: string;
}

export const PromoCodeInput: React.FC<PromoCodeInputProps> = ({ className = '' }) => {
  const [code, setCode] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const { redeemPromoCode } = useSubscription();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || loading) return;

    setLoading(true);
    setResult(null);

    const response = await redeemPromoCode(code);

    setLoading(false);
    if (response.success) {
      setResult({
        success: true,
        message: response.message || `Success! You now have ${response.duration_days} days of ${response.plan?.toUpperCase()} access.`
      });
      setCode('');
    } else {
      setResult({
        success: false,
        message: response.error || 'Failed to redeem code'
      });
    }
  };

  return (
    <div className={`${className}`}>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter promo code"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-[#2d3b2d] focus:ring-2 focus:ring-[#2d3b2d]/20/20 outline-none uppercase"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!code.trim() || loading}
          className="bg-[#2d3b2d] hover:bg-[#3d4f3d] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </form>

      {result && (
        <p className={`mt-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
          {result.message}
        </p>
      )}
    </div>
  );
};
