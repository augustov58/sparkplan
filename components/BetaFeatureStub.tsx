import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from './Auth/AuthProvider';
import toast from 'react-hot-toast';

type FeatureKey = 'estimating' | 'permits' | 'tm_billing';

interface BetaFeatureStubProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  featureKey: FeatureKey;
  description: string;
  comingWhen?: string;
  /**
   * Optional pointer to an existing page that this beta is set to absorb.
   * Renders as: "Existing X tracking is moving here — until then, open <link>."
   */
  forwardLink?: { label: string; path: string };
  projectId?: string;
}

export const BetaFeatureStub: React.FC<BetaFeatureStubProps> = ({
  icon: Icon,
  title,
  featureKey,
  description,
  comingWhen = 'Coming this quarter',
  forwardLink,
  projectId,
}) => {
  const { user } = useAuthContext();
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Please sign in to share feedback.');
      return;
    }
    if (note.trim().length === 0) {
      toast.error('Tell us what you would want from this feature.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('feature_interest').insert({
        user_id: user.id,
        feature_name: featureKey,
        note: note.trim(),
        project_id: projectId || null,
      });
      if (error) throw error;
      setSubmitted(true);
      setNote('');
      toast.success('Thanks — we will use this to prioritize.');
    } catch (err: any) {
      console.error('feature_interest insert failed:', err);
      toast.error(err?.message || 'Could not record feedback. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 md:p-8">
      <div className="bg-white border border-[#e8e6e3] rounded-xl shadow-sm overflow-hidden">
        <div className="bg-[#faf9f7] border-b border-[#e8e6e3] p-6 flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#fef3c7] border border-[#fde68a] flex items-center justify-center flex-shrink-0">
            <Icon className="w-6 h-6 text-[#92400e]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl text-[#1a1a1a]">{title}</h1>
              <span className="text-[10px] uppercase tracking-wider bg-[#fef3c7] text-[#92400e] border border-[#fde68a] px-1.5 py-0.5 rounded font-semibold">
                beta
              </span>
            </div>
            <p className="text-sm text-[#666] mt-1">{comingWhen}</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-[#444] leading-relaxed">{description}</p>

          {forwardLink && (
            <div className="text-sm bg-[#f0f5f0] border border-[#d4dcd4] rounded-lg p-4">
              <span className="text-[#444]">
                Existing functionality is moving here. Until then,{' '}
              </span>
              <Link
                to={forwardLink.path}
                className="text-[#2d3b2d] font-medium underline decoration-[#2d3b2d]/40 hover:decoration-[#2d3b2d]"
              >
                open {forwardLink.label} →
              </Link>
            </div>
          )}

          <div className="border-t border-[#e8e6e3] pt-5">
            {submitted ? (
              <div className="text-sm text-[#2d3b2d] bg-[#f0f5f0] border border-[#d4dcd4] rounded-lg p-4">
                Thanks — your input is logged. Submit another note any time.
                <button
                  onClick={() => setSubmitted(false)}
                  className="block mt-2 text-xs text-[#666] underline hover:text-[#1a1a1a]"
                >
                  Add another
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                  What would you want from this feature?
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  disabled={submitting}
                  placeholder="e.g. Tie estimating to the panel/circuit model so I do not retype."
                  className="w-full text-sm border border-[#e8e6e3] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2d3b2d]/20 focus:border-[#2d3b2d] resize-none"
                />
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-[#888]">{note.length}/2000</span>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || note.trim().length === 0}
                    className="text-sm bg-[#2d3b2d] hover:bg-[#1a2a1a] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md font-medium transition-colors"
                  >
                    {submitting ? 'Sending…' : 'Tell us'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
