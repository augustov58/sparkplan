/**
 * PermitDetailDrawer — slide-out drawer to edit a single permit.
 *
 * Inputs are advisory (per the project's "validation is advisory, not
 * blocking" preference) — drafts with TBD fields must remain saveable.
 * Status changes use the forward-only state machine in
 * services/permits/permitStatusTransitions.ts.
 */
import React, { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import type { Permit, PermitUpdate } from '../../hooks/usePermits';
import {
  PERMIT_TYPES,
  type PermitStatus,
  getValidNextStatuses,
  getStatusLabel,
  isTerminalStatus,
} from '../../services/permits/permitStatusTransitions';
import { PermitStatusPill } from './PermitStatusPill';
import { usePermitInspections } from '../../hooks/usePermitInspections';
import { InspectionStatusPill } from './InspectionStatusPill';
import { formatExpirationLabel } from '../../services/permits/permitExpirationWarning';

interface PermitDetailDrawerProps {
  permit: Permit;
  onClose: () => void;
  onSave: (id: string, updates: PermitUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const PERMIT_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  evse: 'EVSE',
  low_voltage: 'Low Voltage',
  service_upgrade: 'Service Upgrade',
  other: 'Other',
};

// Convert ISO string -> yyyy-mm-dd for <input type="date">
const toDateInput = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

// Convert yyyy-mm-dd -> ISO string at midnight UTC for DB storage.
const fromDateInput = (yyyymmdd: string): string | null => {
  if (!yyyymmdd) return null;
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export const PermitDetailDrawer: React.FC<PermitDetailDrawerProps> = ({
  permit,
  onClose,
  onSave,
  onDelete,
}) => {
  const [form, setForm] = useState({
    permit_number: permit.permit_number ?? '',
    permit_type: permit.permit_type,
    description: permit.description ?? '',
    ahj_jurisdiction: permit.ahj_jurisdiction,
    ahj_contact_name: permit.ahj_contact_name ?? '',
    ahj_contact_email: permit.ahj_contact_email ?? '',
    ahj_contact_phone: permit.ahj_contact_phone ?? '',
    status: permit.status as PermitStatus,
    submitted_at: toDateInput(permit.submitted_at),
    approved_at: toDateInput(permit.approved_at),
    expires_at: toDateInput(permit.expires_at),
    closed_at: toDateInput(permit.closed_at),
    fee_amount: permit.fee_amount?.toString() ?? '',
    fee_paid_at: toDateInput(permit.fee_paid_at),
    plan_review_id: permit.plan_review_id ?? '',
    notes: permit.notes ?? '',
  });

  const [saving, setSaving] = useState(false);
  const { inspections } = usePermitInspections(permit.project_id, permit.id);

  useEffect(() => {
    // Reset form when permit changes (drawer reused for different rows)
    setForm({
      permit_number: permit.permit_number ?? '',
      permit_type: permit.permit_type,
      description: permit.description ?? '',
      ahj_jurisdiction: permit.ahj_jurisdiction,
      ahj_contact_name: permit.ahj_contact_name ?? '',
      ahj_contact_email: permit.ahj_contact_email ?? '',
      ahj_contact_phone: permit.ahj_contact_phone ?? '',
      status: permit.status as PermitStatus,
      submitted_at: toDateInput(permit.submitted_at),
      approved_at: toDateInput(permit.approved_at),
      expires_at: toDateInput(permit.expires_at),
      closed_at: toDateInput(permit.closed_at),
      fee_amount: permit.fee_amount?.toString() ?? '',
      fee_paid_at: toDateInput(permit.fee_paid_at),
      plan_review_id: permit.plan_review_id ?? '',
      notes: permit.notes ?? '',
    });
  }, [permit]);

  const validNext = getValidNextStatuses(form.status);
  const statusOptions: PermitStatus[] = [form.status, ...validNext];

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: PermitUpdate = {
        permit_number: form.permit_number.trim() || null,
        permit_type: form.permit_type,
        description: form.description.trim() || null,
        ahj_jurisdiction: form.ahj_jurisdiction.trim(),
        ahj_contact_name: form.ahj_contact_name.trim() || null,
        ahj_contact_email: form.ahj_contact_email.trim() || null,
        ahj_contact_phone: form.ahj_contact_phone.trim() || null,
        status: form.status,
        submitted_at: fromDateInput(form.submitted_at),
        approved_at: fromDateInput(form.approved_at),
        expires_at: fromDateInput(form.expires_at),
        closed_at: fromDateInput(form.closed_at),
        fee_amount: form.fee_amount ? Number(form.fee_amount) : null,
        fee_paid_at: fromDateInput(form.fee_paid_at),
        plan_review_id: form.plan_review_id.trim() || null,
        notes: form.notes.trim() || null,
      };
      await onSave(permit.id, updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Delete this permit? This will also remove its inspections and cannot be undone.',
      )
    )
      return;
    await onDelete(permit.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close drawer"
      />
      {/* Drawer */}
      <div className="relative ml-auto w-full max-w-xl h-full bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {PERMIT_TYPE_LABELS[form.permit_type] || form.permit_type} Permit
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <PermitStatusPill status={form.status} />
              {form.expires_at && (
                <span className="text-xs text-gray-500">
                  {formatExpirationLabel(fromDateInput(form.expires_at))}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Status — only valid next states + current shown */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as PermitStatus })
              }
              className="input-std w-full"
              disabled={isTerminalStatus(form.status) && validNext.length === 0}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {getStatusLabel(s)}
                </option>
              ))}
            </select>
            {validNext.length === 0 && (
              <p className="text-[11px] text-gray-500 mt-1">
                Terminal status — no further transitions available.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Permit number
              </label>
              <input
                type="text"
                placeholder="(pending)"
                value={form.permit_number}
                onChange={(e) =>
                  setForm({ ...form, permit_number: e.target.value })
                }
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                value={form.permit_type}
                onChange={(e) =>
                  setForm({ ...form, permit_type: e.target.value })
                }
                className="input-std w-full"
              >
                {PERMIT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {PERMIT_TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="One-line scope summary"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="input-std w-full"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">AHJ</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Jurisdiction (e.g. Orange County, FL)"
                value={form.ahj_jurisdiction}
                onChange={(e) =>
                  setForm({ ...form, ahj_jurisdiction: e.target.value })
                }
                className="input-std w-full"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Contact name"
                  value={form.ahj_contact_name}
                  onChange={(e) =>
                    setForm({ ...form, ahj_contact_name: e.target.value })
                  }
                  className="input-std w-full"
                />
                <input
                  type="text"
                  placeholder="Plan review ID"
                  value={form.plan_review_id}
                  onChange={(e) =>
                    setForm({ ...form, plan_review_id: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="email"
                  placeholder="Contact email"
                  value={form.ahj_contact_email}
                  onChange={(e) =>
                    setForm({ ...form, ahj_contact_email: e.target.value })
                  }
                  className="input-std w-full"
                />
                <input
                  type="tel"
                  placeholder="Contact phone"
                  value={form.ahj_contact_phone}
                  onChange={(e) =>
                    setForm({ ...form, ahj_contact_phone: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Lifecycle dates
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Submitted
                </label>
                <input
                  type="date"
                  value={form.submitted_at}
                  onChange={(e) =>
                    setForm({ ...form, submitted_at: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Approved
                </label>
                <input
                  type="date"
                  value={form.approved_at}
                  onChange={(e) =>
                    setForm({ ...form, approved_at: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Expires
                </label>
                <input
                  type="date"
                  value={form.expires_at}
                  onChange={(e) =>
                    setForm({ ...form, expires_at: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Closed
                </label>
                <input
                  type="date"
                  value={form.closed_at}
                  onChange={(e) =>
                    setForm({ ...form, closed_at: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Fees</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.fee_amount}
                  onChange={(e) =>
                    setForm({ ...form, fee_amount: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Paid on
                </label>
                <input
                  type="date"
                  value={form.fee_paid_at}
                  onChange={(e) =>
                    setForm({ ...form, fee_paid_at: e.target.value })
                  }
                  className="input-std w-full"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes</h3>
            <textarea
              rows={3}
              placeholder="Internal notes — not shown to AHJ."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="input-std w-full"
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Inspections ({inspections.length})
            </h3>
            {inspections.length === 0 && (
              <p className="text-xs text-gray-400 italic">
                No inspections logged yet for this permit.
              </p>
            )}
            <ul className="space-y-2">
              {inspections.map((insp) => (
                <li
                  key={insp.id}
                  className="flex items-center justify-between text-xs bg-gray-50 border border-gray-100 rounded px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 capitalize">
                      {insp.inspection_type.replace('_', ' ')}
                    </span>
                    {insp.scheduled_date && (
                      <span className="text-gray-500">
                        · {new Date(insp.scheduled_date).toLocaleDateString()}
                      </span>
                    )}
                    {insp.inspector_name && (
                      <span className="text-gray-500">
                        · {insp.inspector_name}
                      </span>
                    )}
                  </div>
                  <InspectionStatusPill status={insp.status} />
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-2">
              Manage inspections from the Inspections tab.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete permit
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-[#2d3b2d] hover:bg-black disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
