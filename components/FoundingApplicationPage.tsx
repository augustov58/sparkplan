import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Bolt, ArrowLeft } from 'lucide-react';

import { FoundingApplicationForm } from './FoundingApplicationForm';

// SparkPlan Founding Contractors launch video — YouTube unlisted.
// Paste the 11-character video ID from the unlisted share URL
// (https://youtu.be/<ID> or https://www.youtube.com/watch?v=<ID>).
// Leave empty to hide the player until the upload is ready.
const FOUNDERS_VIDEO_ID = 'bEaC5JTaG8E';

// Google Ads tag (gtag.js) for the Founders landing campaign. Injected only on
// this route (see useEffect below) so app/admin traffic isn't tagged into the
// campaign's audience. Conversion events can be added later with the conversion
// label from Google Ads.
const GOOGLE_ADS_ID = 'AW-617991515';

export const FoundingApplicationPage: React.FC = () => {
  const navigate = useNavigate();

  // Load the Google Ads base tag once, scoped to the Founders page. Equivalent
  // to pasting the gtag.js <script> in <head>, but only while this route is
  // mounted. Guarded so SPA re-entry doesn't inject it twice.
  useEffect(() => {
    if (document.getElementById('gtag-founders')) return;

    const script = document.createElement('script');
    script.id = 'gtag-founders';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
    document.head.appendChild(script);

    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    function gtag() { w.dataLayer.push(arguments); }
    w.gtag = w.gtag || gtag;
    w.gtag('js', new Date());
    w.gtag('config', GOOGLE_ADS_ID);
  }, []);

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

      <main className="max-w-5xl mx-auto px-6 py-12 md:py-16">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/15 text-[#9c7c1c] px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-5">
            <Bolt className="w-3.5 h-3.5" />
            Florida pilot · 20 spots
          </div>
          <h1 className="font-serif text-4xl md:text-5xl font-medium tracking-tight mb-5">
            Founding Contractors
          </h1>
          <p className="text-lg text-[#666] leading-relaxed">
            We're building SparkPlan with a small cohort of Florida electrical contractors before
            opening it up more broadly. Founding Contractors get 60 days of full access, a private
            Slack channel with the team, and hands-on help submitting real permits — in exchange
            for honest feedback and one case study.
          </p>
        </div>

        {FOUNDERS_VIDEO_ID ? (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="aspect-video w-full overflow-hidden rounded-xl border border-[#e8e6e3] bg-black shadow-sm">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${FOUNDERS_VIDEO_ID}?rel=0&modestbranding=1`}
                title="SparkPlan Founding Contractors — launch video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          </div>
        ) : null}

        <div className="grid md:grid-cols-3 gap-5 mb-12 max-w-4xl mx-auto">
          <div className="bg-white border border-[#e8e6e3] rounded-xl p-5">
            <h3 className="font-serif text-lg font-medium mb-2">What you get</h3>
            <ul className="space-y-2 text-sm text-[#666]">
              {[
                '60 days full access (every tier)',
                'Private Slack channel with the team',
                'Hands-on help with your first FL permit',
                'AHJ-specific packet tuning',
                'Direct line to the founding PE',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#3d6b3d] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-[#e8e6e3] rounded-xl p-5">
            <h3 className="font-serif text-lg font-medium mb-2">What we ask</h3>
            <ul className="space-y-2 text-sm text-[#666]">
              {[
                'Submit at least one real FL permit using the packet',
                'A 30-minute feedback call at the end of month 1',
                'Share inspector responses (red-lines or approvals)',
                'Be willing to be a case study (anonymized OK)',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#3d6b3d] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white border border-[#e8e6e3] rounded-xl p-5">
            <h3 className="font-serif text-lg font-medium mb-2">Who fits</h3>
            <ul className="space-y-2 text-sm text-[#666]">
              {[
                'FL-licensed electrical contractor (EC or ER)',
                'Pulling permits regularly in Florida',
                'Works on EV, multi-family, or service upgrades',
                'Has at least one active or near-term FL job',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#3d6b3d] flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <FoundingApplicationForm />
        </div>

        <p className="text-center text-xs text-[#888] mt-8 max-w-md mx-auto">
          Don't qualify, or out of state? You can still try SparkPlan with the standard{' '}
          <button onClick={() => navigate('/signup')} className="underline hover:text-[#1a1a1a]">
            14-day free trial
          </button>.
        </p>
      </main>
    </div>
  );
};
