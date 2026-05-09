/**
 * MaterialEntryEditor — modal-style form for creating / editing a material
 * entry. Computed `billing_unit_price` and `billing_amount` are previewed
 * live as the user types so they can sanity-check before saving.
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  materialEntrySchema,
  type MaterialEntryFormData,
} from '@/lib/validation-schemas';
import type { Database } from '@/lib/database.types';
import {
  computeMaterialBillingUnitPrice,
  computeMaterialBillingAmount,
  formatUSD,
} from '@/services/billing/billingMath';

type MaterialEntry = Database['public']['Tables']['material_entries']['Row'];
type Settings = Database['public']['Tables']['project_billing_settings']['Row'] | null;

interface MaterialEntryEditorProps {
  entry?: MaterialEntry;
  settings: Settings;
  onSubmit: (values: MaterialEntryFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const MaterialEntryEditor: React.FC<MaterialEntryEditorProps> = ({
  entry,
  settings,
  onSubmit,
  onDelete,
  onClose,
}) => {
  const isEditing = !!entry;

  const defaults: MaterialEntryFormData = {
    installed_date: entry?.installed_date ?? todayISO(),
    description: entry?.description ?? '',
    cost_code: entry?.cost_code ?? '',
    quantity: entry?.quantity ?? 1,
    unit: entry?.unit ?? 'ea',
    invoice_unit_cost: entry?.invoice_unit_cost ?? 0,
    markup_pct: entry?.markup_pct ?? settings?.default_material_markup_pct ?? 20,
    taxable: entry?.taxable ?? true,
    supplier_name: entry?.supplier_name ?? '',
    supplier_invoice_number: entry?.supplier_invoice_number ?? '',
    receipt_url: entry?.receipt_url ?? '',
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialEntryFormData>({
    resolver: zodResolver(materialEntrySchema),
    defaultValues: defaults,
  });

  useEffect(() => {
    reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  const watchedQty = Number(watch('quantity')) || 0;
  const watchedCost = Number(watch('invoice_unit_cost')) || 0;
  const watchedMarkup = Number(watch('markup_pct')) || 0;
  const previewUnitPrice = computeMaterialBillingUnitPrice(watchedCost, watchedMarkup);
  const previewBillingAmount = computeMaterialBillingAmount(watchedQty, previewUnitPrice);

  const submit = async (values: MaterialEntryFormData) => {
    await onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#e8e6e3]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            {isEditing ? 'Edit material entry' : 'New material entry'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[#f0eeeb] text-[#666]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <form onSubmit={handleSubmit(submit)} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Installed date</label>
              <input
                type="date"
                {...register('installed_date')}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.installed_date && (
                <p className="mt-1 text-xs text-red-600">{errors.installed_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Cost code</label>
              <input
                type="text"
                {...register('cost_code')}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.cost_code && (
                <p className="mt-1 text-xs text-red-600">{errors.cost_code.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Description</label>
            <input
              type="text"
              {...register('description')}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              placeholder='e.g., 500 ft #12 THHN copper'
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Quantity</label>
              <input
                type="number"
                step="0.001"
                {...register('quantity', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.quantity && (
                <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Unit</label>
              <input
                type="text"
                {...register('unit')}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
                placeholder="ea / ft / lb"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm text-[#444]">
                <input type="checkbox" {...register('taxable')} className="rounded" />
                Taxable
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">
                Invoice unit cost ($)
              </label>
              <input
                type="number"
                step="0.0001"
                {...register('invoice_unit_cost', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.invoice_unit_cost && (
                <p className="mt-1 text-xs text-red-600">{errors.invoice_unit_cost.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Markup (%)</label>
              <input
                type="number"
                step="0.1"
                {...register('markup_pct', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.markup_pct && (
                <p className="mt-1 text-xs text-red-600">{errors.markup_pct.message}</p>
              )}
            </div>
          </div>

          <div className="bg-[#faf9f7] border border-[#e8e6e3] rounded px-3 py-2 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-[#666]">Billing unit price</span>
              <span className="tabular-nums text-[#1a1a1a]">{formatUSD(previewUnitPrice)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-[#444]">Line total</span>
              <span className="tabular-nums text-[#1a1a1a]">
                {formatUSD(previewBillingAmount)}
              </span>
            </div>
          </div>

          <details className="border-t border-[#e8e6e3] pt-3">
            <summary className="text-xs text-[#666] cursor-pointer">Supplier / receipt info</summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#444] mb-1">Supplier</label>
                  <input
                    type="text"
                    {...register('supplier_name')}
                    className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#444] mb-1">
                    Supplier invoice #
                  </label>
                  <input
                    type="text"
                    {...register('supplier_invoice_number')}
                    className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#444] mb-1">Receipt URL</label>
                <input
                  type="text"
                  {...register('receipt_url')}
                  className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
                  placeholder="https://..."
                />
              </div>
            </div>
          </details>

          <footer className="flex items-center justify-between pt-2 border-t border-[#e8e6e3]">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={async () => {
                    if (window.confirm('Delete this material entry?')) {
                      await onDelete();
                    }
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                icon={<Save className="w-4 h-4" />}
                loading={isSubmitting}
              >
                {isEditing ? 'Save' : 'Add entry'}
              </Button>
            </div>
          </footer>
        </form>
      </div>
    </div>
  );
};
