/**
 * Founding Contractors application form (public, /founders).
 *
 * Anonymous submission → `founding-application` edge function → row in
 * `founding_applications` + email to Augusto. EC license # is optional.
 *
 * Honeypot: the `website` field is visually hidden but present in the DOM.
 * Bots that auto-fill all fields will trip the server-side reject.
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, CheckCircle2 } from 'lucide-react';

import {
  foundingApplicationSchema,
  PERMIT_VOLUME_BUCKETS,
  PREFERRED_CONTACT_OPTIONS,
  REFERRAL_SOURCES,
  TYPICAL_WORK_OPTIONS,
  type FoundingApplicationFormData,
} from '../lib/validation-schemas';
import { supabase } from '../lib/supabase';
import { showToast, toastMessages } from '../lib/toast';

// Google Ads conversion action for the Founders campaign. Fired once on a
// genuine successful application submit (not on duplicates). The base gtag.js
// tag is loaded by FoundingApplicationPage. NOTE: verify the action name in
// Google Ads matches "Founders Application" — swap the label if it doesn't.
const GOOGLE_ADS_CONVERSION = 'AW-617991515/ROd2CJH2rdgBENua16YC';

const TYPICAL_WORK_LABELS: Record<typeof TYPICAL_WORK_OPTIONS[number], string> = {
  single_family: 'Single-family residential',
  multi_family: 'Multi-family residential',
  commercial: 'Commercial',
  ev: 'EV charging',
  service_upgrade: 'Service upgrades',
  solar: 'Solar / PV',
};

const PERMIT_BUCKET_LABELS: Record<typeof PERMIT_VOLUME_BUCKETS[number], string> = {
  '0': '0 — I don\'t pull permits myself',
  '1-5': '1–5 per year',
  '6-20': '6–20 per year',
  '21-50': '21–50 per year',
  '50+': '50+ per year',
};

const REFERRAL_LABELS: Record<typeof REFERRAL_SOURCES[number], string> = {
  youtube: 'YouTube',
  mike_holt: 'Mike Holt forum',
  reddit: 'Reddit',
  linkedin: 'LinkedIn',
  dm: 'Direct message',
  other: 'Other',
};

const CONTACT_LABELS: Record<typeof PREFERRED_CONTACT_OPTIONS[number], { title: string; hint: string }> = {
  slack: { title: 'Slack', hint: 'Private cohort channel — the main experience' },
  phone_call: { title: 'Phone call', hint: 'Direct call — best for on-site contractors' },
  sms_imessage: { title: 'SMS / iMessage', hint: 'Text-based, async, works from a truck' },
};

interface Props {
  onSuccess?: () => void;
}

export const FoundingApplicationForm: React.FC<Props> = ({ onSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FoundingApplicationFormData>({
    resolver: zodResolver(foundingApplicationSchema),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      company_name: '',
      ec_license_number: '',
      state: 'FL',
      primary_counties: '',
      typical_work: [],
      active_job_detail: '',
      preferred_contact: 'slack',
      website: '',
    },
  });

  const onSubmit = async (data: FoundingApplicationFormData) => {
    setSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke(
        'founding-application',
        { body: data }
      );

      if (error) {
        // supabase-js wraps non-2xx into `error`; pull a friendly message if available.
        const ctx: any = (error as any).context;
        const responseError = ctx?.error || ctx?.body?.error;
        if (ctx?.body?.duplicate) {
          showToast.success(toastMessages.foundingApplication.duplicate);
          setSubmitted(true);
          onSuccess?.();
          return;
        }
        showToast.error(responseError || toastMessages.foundingApplication.error);
        return;
      }

      if (result?.success) {
        // Report the lead to Google Ads. Queues into dataLayer if gtag.js is
        // still loading, so a fast submit isn't dropped. Guarded in case the
        // tag was blocked (ad blocker / no consent).
        (window as any).gtag?.('event', 'conversion', { send_to: GOOGLE_ADS_CONVERSION });
        showToast.success(toastMessages.foundingApplication.submitted);
        setSubmitted(true);
        onSuccess?.();
      } else {
        showToast.error(toastMessages.foundingApplication.error);
      }
    } catch (err: any) {
      showToast.error(err?.message || toastMessages.foundingApplication.error);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-white border border-[#e8e6e3] rounded-xl p-8 text-center">
        <div className="w-14 h-14 bg-[#e8f5e8] rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-7 h-7 text-[#3d6b3d]" />
        </div>
        <h2 className="font-serif text-2xl text-[#1a1a1a] mb-2">Application received</h2>
        <p className="text-[#666] leading-relaxed max-w-md mx-auto">
          We'll review within 48 hours. If your license verifies and your work matches the pilot,
          you'll get a personal email with a Slack invite and your Founding Contractor coupon code.
        </p>
        <p className="text-sm text-[#888] mt-4">
          Questions in the meantime? Email <a href="mailto:support@sparkplan.app" className="text-[#2d3b2d] font-medium underline">support@sparkplan.app</a>.
        </p>
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded-md bg-white focus:outline-none focus:border-[#2d3b2d] focus:ring-1 focus:ring-[#2d3b2d]/30 transition-colors';
  const labelClass = 'block text-sm font-medium text-[#1a1a1a] mb-1.5';
  const errorClass = 'mt-1 text-xs text-red-600';

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white border border-[#e8e6e3] rounded-xl p-6 md:p-8 space-y-5"
      noValidate
    >
      {/* Honeypot — visually hidden, accessibility-hidden, off-tab */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="website-hp">Website</label>
        <input id="website-hp" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <label className={labelClass} htmlFor="full_name">
            Full name <span className="text-red-600">*</span>
          </label>
          <input id="full_name" type="text" className={inputClass} {...register('full_name')} />
          {errors.full_name && <p className={errorClass}>{errors.full_name.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="email">
            Email <span className="text-red-600">*</span>
          </label>
          <input id="email" type="email" className={inputClass} {...register('email')} />
          {errors.email && <p className={errorClass}>{errors.email.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="phone">
            Phone <span className="text-[#888] font-normal">(optional)</span>
          </label>
          <input id="phone" type="tel" className={inputClass} {...register('phone')} />
          {errors.phone && <p className={errorClass}>{errors.phone.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="company_name">
            Company name <span className="text-[#888] font-normal">(optional)</span>
          </label>
          <input id="company_name" type="text" className={inputClass} {...register('company_name')} />
          {errors.company_name && <p className={errorClass}>{errors.company_name.message}</p>}
        </div>

        <div>
          <label className={labelClass} htmlFor="ec_license_number">
            FL EC / ER license # <span className="text-[#888] font-normal">(optional)</span>
          </label>
          <input
            id="ec_license_number"
            type="text"
            placeholder="EC#######"
            className={inputClass}
            {...register('ec_license_number')}
          />
          {errors.ec_license_number && <p className={errorClass}>{errors.ec_license_number.message}</p>}
          <p className="mt-1 text-xs text-[#888]">If you don't have it handy, leave blank — we'll verify on review.</p>
        </div>

        <div>
          <label className={labelClass} htmlFor="state">
            State <span className="text-red-600">*</span>
          </label>
          <input
            id="state"
            type="text"
            maxLength={4}
            placeholder="FL"
            className={inputClass}
            {...register('state')}
          />
          {errors.state && <p className={errorClass}>{errors.state.message}</p>}
          <p className="mt-1 text-xs text-[#888]">The pilot is Florida-only. Out-of-state contractors get the standard trial.</p>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="primary_counties">
          Which FL counties or cities do you pull permits in? <span className="text-red-600">*</span>
        </label>
        <textarea
          id="primary_counties"
          rows={2}
          placeholder="e.g., Miami-Dade unincorporated, Pompano Beach, Town of Davie"
          className={inputClass}
          {...register('primary_counties')}
        />
        {errors.primary_counties && <p className={errorClass}>{errors.primary_counties.message}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="permits_last_12mo">
          Approximate # electrical permits submitted in the last 12 months <span className="text-red-600">*</span>
        </label>
        <select id="permits_last_12mo" className={inputClass} {...register('permits_last_12mo')} defaultValue="">
          <option value="" disabled>Select…</option>
          {PERMIT_VOLUME_BUCKETS.map((bucket) => (
            <option key={bucket} value={bucket}>{PERMIT_BUCKET_LABELS[bucket]}</option>
          ))}
        </select>
        {errors.permits_last_12mo && <p className={errorClass}>{errors.permits_last_12mo.message}</p>}
      </div>

      <div>
        <label className={labelClass}>
          Which best describes your typical work? <span className="text-red-600">*</span>
          <span className="block text-xs font-normal text-[#888] mt-0.5">Select all that apply</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {TYPICAL_WORK_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-center gap-2 px-3 py-2 border border-[#e8e6e3] rounded-md text-sm cursor-pointer hover:border-[#2d3b2d] transition-colors"
            >
              <input
                type="checkbox"
                value={option}
                className="rounded text-[#2d3b2d] focus:ring-[#2d3b2d]"
                {...register('typical_work')}
              />
              {TYPICAL_WORK_LABELS[option]}
            </label>
          ))}
        </div>
        {errors.typical_work && <p className={errorClass}>{errors.typical_work.message as string}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="active_job_detail">
          Do you have an active or near-term FL job SparkPlan could help with?{' '}
          <span className="text-[#888] font-normal">(optional)</span>
        </label>
        <textarea
          id="active_job_detail"
          rows={3}
          placeholder="e.g., 24-unit condo in Pompano adding 6 Level-2 chargers — need to know if the existing 800A service can handle it."
          className={inputClass}
          {...register('active_job_detail')}
        />
        {errors.active_job_detail && <p className={errorClass}>{errors.active_job_detail.message}</p>}
        <p className="mt-1 text-xs text-[#888]">
          Founding Contractors get hands-on help with their first real project — tell us what you're working on.
        </p>
      </div>

      <div>
        <label className={labelClass}>
          How would you prefer we stay in touch during the cohort? <span className="text-red-600">*</span>
          <span className="block text-xs font-normal text-[#888] mt-0.5">
            Slack is the main channel, but we know many electricians prefer phone or text. Pick what works for you.
          </span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {PREFERRED_CONTACT_OPTIONS.map((option) => (
            <label
              key={option}
              className="flex items-start gap-2 px-3 py-2.5 border border-[#e8e6e3] rounded-md text-sm cursor-pointer hover:border-[#2d3b2d] transition-colors"
            >
              <input
                type="radio"
                value={option}
                className="mt-0.5 text-[#2d3b2d] focus:ring-[#2d3b2d]"
                {...register('preferred_contact')}
              />
              <span>
                <span className="block font-medium text-[#1a1a1a]">{CONTACT_LABELS[option].title}</span>
                <span className="block text-xs text-[#888]">{CONTACT_LABELS[option].hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.preferred_contact && <p className={errorClass}>{errors.preferred_contact.message as string}</p>}
      </div>

      <div>
        <label className={labelClass} htmlFor="referral_source">
          How did you hear about us? <span className="text-[#888] font-normal">(optional)</span>
        </label>
        <select id="referral_source" className={inputClass} {...register('referral_source')} defaultValue="">
          <option value="">Choose one…</option>
          {REFERRAL_SOURCES.map((source) => (
            <option key={source} value={source}>{REFERRAL_LABELS[source]}</option>
          ))}
        </select>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#2d3b2d] hover:bg-[#3d4f3d] disabled:bg-[#666] text-white px-6 py-3 text-base font-semibold rounded-md transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : 'Apply for Founding Contractors'}
        </button>
        <p className="text-xs text-[#888] text-center mt-3">
          We review applications within 48 hours. By submitting you agree we may contact you about the pilot.
        </p>
      </div>
    </form>
  );
};
