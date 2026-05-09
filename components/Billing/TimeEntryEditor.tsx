/**
 * TimeEntryEditor — modal-style form for creating / editing a single time
 * entry. Used by `TimeEntriesTab`. Pre-fills `billable_rate` and `cost_rate`
 * from project billing settings when creating a new entry; the user can
 * override per-entry (rates are snapshotted on the row, not looked up later).
 *
 * Validation is RHF + Zod (`timeEntrySchema`). Errors render inline. Per the
 * "validation advisory not blocking" rule the user CAN save partial drafts —
 * but the schema still catches type mistakes (negative hours, etc.).
 */

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Save, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import {
  timeEntrySchema,
  type TimeEntryFormData,
} from '@/lib/validation-schemas';
import type { Database } from '@/lib/database.types';
import { computeTimeEntryBillable, formatUSD } from '@/services/billing/billingMath';

type TimeEntry = Database['public']['Tables']['time_entries']['Row'];
type Settings = Database['public']['Tables']['project_billing_settings']['Row'] | null;

interface TimeEntryEditorProps {
  /** When provided, the form edits that entry. When undefined, creates a new one. */
  entry?: TimeEntry;
  settings: Settings;
  onSubmit: (values: TimeEntryFormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export const TimeEntryEditor: React.FC<TimeEntryEditorProps> = ({
  entry,
  settings,
  onSubmit,
  onDelete,
  onClose,
}) => {
  const isEditing = !!entry;

  const defaults: TimeEntryFormData = {
    worker_name: entry?.worker_name ?? '',
    work_date: entry?.work_date ?? todayISO(),
    hours: entry?.hours ?? 8,
    description: entry?.description ?? '',
    cost_code: entry?.cost_code ?? '',
    billable_rate: entry?.billable_rate ?? settings?.default_billable_rate ?? 0,
    cost_rate: entry?.cost_rate ?? settings?.default_cost_rate ?? null,
  };

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TimeEntryFormData>({
    resolver: zodResolver(timeEntrySchema),
    defaultValues: defaults,
  });

  // Re-seed when switching between create/edit targets.
  useEffect(() => {
    reset(defaults);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id]);

  const watchedHours = watch('hours');
  const watchedRate = watch('billable_rate');
  const previewBillable = computeTimeEntryBillable(
    typeof watchedHours === 'number' ? watchedHours : Number(watchedHours) || 0,
    typeof watchedRate === 'number' ? watchedRate : Number(watchedRate) || 0,
  );

  const submit = async (values: TimeEntryFormData) => {
    await onSubmit(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <header className="flex items-center justify-between px-5 py-4 border-b border-[#e8e6e3]">
          <h2 className="text-lg font-semibold text-[#1a1a1a]">
            {isEditing ? 'Edit time entry' : 'New time entry'}
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
          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Worker</label>
            <input
              type="text"
              {...register('worker_name')}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              placeholder="e.g., J. Smith"
            />
            {errors.worker_name && (
              <p className="mt-1 text-xs text-red-600">{errors.worker_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Date</label>
              <input
                type="date"
                {...register('work_date')}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.work_date && (
                <p className="mt-1 text-xs text-red-600">{errors.work_date.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">Hours</label>
              <input
                type="number"
                step="0.25"
                {...register('hours', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.hours && (
                <p className="mt-1 text-xs text-red-600">{errors.hours.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Cost code</label>
            <input
              type="text"
              {...register('cost_code')}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              placeholder="e.g., 16-2050 (free-text in v1; lookup library coming)"
            />
            {errors.cost_code && (
              <p className="mt-1 text-xs text-red-600">{errors.cost_code.message}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444] mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              placeholder="What was worked on?"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">
                Billable rate ($/hr)
              </label>
              <input
                type="number"
                step="0.01"
                {...register('billable_rate', { valueAsNumber: true })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.billable_rate && (
                <p className="mt-1 text-xs text-red-600">{errors.billable_rate.message}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-[#444] mb-1">
                Cost rate ($/hr) <span className="text-[#888] font-normal">optional</span>
              </label>
              <input
                type="number"
                step="0.01"
                {...register('cost_rate', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })}
                className="w-full px-3 py-2 text-sm border border-[#e8e6e3] rounded focus:outline-none focus:ring-2 focus:ring-electric-500"
              />
              {errors.cost_rate && (
                <p className="mt-1 text-xs text-red-600">{errors.cost_rate.message}</p>
              )}
            </div>
          </div>

          <div className="bg-[#faf9f7] border border-[#e8e6e3] rounded px-3 py-2 text-sm flex justify-between">
            <span className="text-[#444]">Billable amount</span>
            <span className="font-medium text-[#1a1a1a] tabular-nums">
              {formatUSD(previewBillable)}
            </span>
          </div>

          <footer className="flex items-center justify-between pt-2 border-t border-[#e8e6e3]">
            <div>
              {isEditing && onDelete && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={async () => {
                    if (window.confirm('Delete this time entry?')) {
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
