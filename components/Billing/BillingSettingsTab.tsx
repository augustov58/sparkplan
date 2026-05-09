/**
 * BillingSettingsTab — single-form view of `project_billing_settings`.
 *
 * Sections:
 *   - Default rates (billable + cost)
 *   - Materials (default markup, tax %)
 *   - Invoice defaults (prefix, next number, payment terms)
 *   - Customer info (name, email, address, PO #)
 *
 * Saves via `useProjectBillingSettings.upsertSettings`. Validation is
 * advisory — user can save partial drafts, the schema only flags type
 * mistakes (negative rates, invalid email, etc.).
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  projectBillingSettingsSchema,
  type ProjectBillingSettingsFormData,
} from '@/lib/validation-schemas';
import { useProjectBillingSettings } from '@/hooks/useProjectBillingSettings';

interface BillingSettingsTabProps {
  projectId: string;
}

export const BillingSettingsTab: React.FC<BillingSettingsTabProps> = ({ projectId }) => {
  const { settings, loading, upsertSettings } = useProjectBillingSettings(projectId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProjectBillingSettingsFormData>({
    resolver: zodResolver(projectBillingSettingsSchema),
    defaultValues: {
      default_billable_rate: null,
      default_cost_rate: null,
      default_material_markup_pct: 20,
      tax_pct: 0,
      payment_terms_days: 30,
      invoice_prefix: 'INV-',
      next_invoice_number: 1,
      customer_name: '',
      customer_email: '',
      customer_address: '',
      customer_po_number: '',
    },
  });

  // Re-seed form when settings load from DB (or change via realtime)
  useEffect(() => {
    if (settings) {
      reset({
        default_billable_rate: settings.default_billable_rate,
        default_cost_rate: settings.default_cost_rate,
        default_material_markup_pct: settings.default_material_markup_pct,
        tax_pct: settings.tax_pct,
        payment_terms_days: settings.payment_terms_days,
        invoice_prefix: settings.invoice_prefix ?? 'INV-',
        next_invoice_number: settings.next_invoice_number,
        customer_name: settings.customer_name ?? '',
        customer_email: settings.customer_email ?? '',
        customer_address: settings.customer_address ?? '',
        customer_po_number: settings.customer_po_number ?? '',
      });
    }
  }, [settings, reset]);

  const onSubmit = async (values: ProjectBillingSettingsFormData) => {
    // Empty-string → null for nullable text columns to keep the DB tidy
    await upsertSettings({
      ...values,
      invoice_prefix: values.invoice_prefix?.trim() || null,
      customer_name: values.customer_name?.trim() || null,
      customer_email: values.customer_email?.trim() || null,
      customer_address: values.customer_address?.trim() || null,
      customer_po_number: values.customer_po_number?.trim() || null,
    });
  };

  if (loading) {
    return <div className="p-6 text-sm text-[#666]">Loading billing settings...</div>;
  }

  const inputCls =
    'w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500';
  const labelCls = 'block text-xs font-medium text-[#444] mb-1';
  const errCls = 'mt-1 text-xs text-red-600';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {!settings && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg px-4 py-3 flex items-start gap-2">
          <SettingsIcon className="w-4 h-4 mt-0.5" />
          <div>
            No billing settings saved yet. Set default rates and customer info before logging time
            or generating invoices.
          </div>
        </div>
      )}

      <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Default rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Billable rate ($/hr)</label>
            <input
              type="number"
              step="0.01"
              {...register('default_billable_rate', {
                setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
              })}
              className={inputCls}
              placeholder="e.g., 95.00"
            />
            {errors.default_billable_rate && (
              <p className={errCls}>{errors.default_billable_rate.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>
              Cost rate ($/hr) <span className="text-[#888] font-normal">optional</span>
            </label>
            <input
              type="number"
              step="0.01"
              {...register('default_cost_rate', {
                setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
              })}
              className={inputCls}
              placeholder="Internal payroll-loaded rate"
            />
            {errors.default_cost_rate && (
              <p className={errCls}>{errors.default_cost_rate.message}</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Materials</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Default markup (%)</label>
            <input
              type="number"
              step="0.1"
              {...register('default_material_markup_pct', { valueAsNumber: true })}
              className={inputCls}
            />
            {errors.default_material_markup_pct && (
              <p className={errCls}>{errors.default_material_markup_pct.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Sales tax (%)</label>
            <input
              type="number"
              step="0.001"
              {...register('tax_pct', { valueAsNumber: true })}
              className={inputCls}
            />
            <p className="mt-1 text-[11px] text-[#888]">
              Applied to taxable materials only. Labor not taxed.
            </p>
            {errors.tax_pct && <p className={errCls}>{errors.tax_pct.message}</p>}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Invoice defaults</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Prefix</label>
            <input
              type="text"
              {...register('invoice_prefix')}
              className={inputCls}
              placeholder="INV-"
            />
            {errors.invoice_prefix && (
              <p className={errCls}>{errors.invoice_prefix.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Next invoice #</label>
            <input
              type="number"
              {...register('next_invoice_number', { valueAsNumber: true })}
              className={inputCls}
            />
            {errors.next_invoice_number && (
              <p className={errCls}>{errors.next_invoice_number.message}</p>
            )}
          </div>
          <div>
            <label className={labelCls}>Payment terms (days)</label>
            <input
              type="number"
              {...register('payment_terms_days', { valueAsNumber: true })}
              className={inputCls}
            />
            {errors.payment_terms_days && (
              <p className={errCls}>{errors.payment_terms_days.message}</p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-white border border-[#e8e6e3] rounded-lg p-4">
        <h3 className="text-sm font-semibold text-[#1a1a1a] mb-3">Customer info</h3>
        <p className="text-xs text-[#666] mb-3">
          Snapshotted onto each invoice when generated; later edits don't change historical
          invoices.
        </p>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Customer name</label>
            <input type="text" {...register('customer_name')} className={inputCls} />
            {errors.customer_name && (
              <p className={errCls}>{errors.customer_name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" {...register('customer_email')} className={inputCls} />
              {errors.customer_email && (
                <p className={errCls}>{errors.customer_email.message}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>PO number</label>
              <input type="text" {...register('customer_po_number')} className={inputCls} />
              {errors.customer_po_number && (
                <p className={errCls}>{errors.customer_po_number.message}</p>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Billing address</label>
            <textarea {...register('customer_address')} rows={3} className={inputCls} />
            {errors.customer_address && (
              <p className={errCls}>{errors.customer_address.message}</p>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          type="submit"
          variant="primary"
          icon={<Save className="w-4 h-4" />}
          loading={isSubmitting}
          disabled={!isDirty}
        >
          Save settings
        </Button>
      </div>
    </form>
  );
};
