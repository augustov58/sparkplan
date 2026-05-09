/**
 * InspectionDetailDrawer — slide-out drawer to edit a single inspection.
 */
import React, { useState, useEffect } from 'react';
import { X, Trash2, Save } from 'lucide-react';
import type {
  PermitInspection,
  PermitInspectionUpdate,
} from '../../hooks/usePermitInspections';
import {
  INSPECTION_TYPES,
  INSPECTION_STATUSES,
} from '../../services/permits/permitStatusTransitions';
import { InspectionStatusPill } from './InspectionStatusPill';

interface InspectionDetailDrawerProps {
  inspection: PermitInspection;
  permitLabel?: string;
  onClose: () => void;
  onSave: (id: string, updates: PermitInspectionUpdate) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const TYPE_LABELS: Record<string, string> = {
  rough_in: 'Rough-in',
  underground: 'Underground',
  service: 'Service',
  final: 'Final',
  temporary: 'Temporary',
  reinspection: 'Reinspection',
  other: 'Other',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  passed: 'Passed',
  failed: 'Failed',
  conditional_pass: 'Conditional Pass',
  cancelled: 'Cancelled',
  no_show: 'No Show',
};

export const InspectionDetailDrawer: React.FC<InspectionDetailDrawerProps> = ({
  inspection,
  permitLabel,
  onClose,
  onSave,
  onDelete,
}) => {
  const [form, setForm] = useState({
    inspection_type: inspection.inspection_type,
    status: inspection.status,
    sequence: inspection.sequence,
    description: inspection.description ?? '',
    scheduled_date: inspection.scheduled_date ?? '',
    scheduled_window: inspection.scheduled_window ?? '',
    inspector_name: inspection.inspector_name ?? '',
    result_notes: inspection.result_notes ?? '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      inspection_type: inspection.inspection_type,
      status: inspection.status,
      sequence: inspection.sequence,
      description: inspection.description ?? '',
      scheduled_date: inspection.scheduled_date ?? '',
      scheduled_window: inspection.scheduled_window ?? '',
      inspector_name: inspection.inspector_name ?? '',
      result_notes: inspection.result_notes ?? '',
    });
  }, [inspection]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: PermitInspectionUpdate = {
        inspection_type: form.inspection_type,
        status: form.status,
        sequence: form.sequence || 1,
        description: form.description.trim() || null,
        scheduled_date: form.scheduled_date || null,
        scheduled_window: form.scheduled_window.trim() || null,
        inspector_name: form.inspector_name.trim() || null,
        result_notes: form.result_notes.trim() || null,
        // performed_at is auto-set when status transitions to a terminal
        // outcome. Done in the hook callsite.
        performed_at:
          form.status === 'passed' ||
          form.status === 'failed' ||
          form.status === 'conditional_pass'
            ? inspection.performed_at || new Date().toISOString()
            : null,
      };
      await onSave(inspection.id, updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this inspection? This cannot be undone.'))
      return;
    await onDelete(inspection.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div className="relative ml-auto w-full max-w-lg h-full bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right duration-200">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {TYPE_LABELS[form.inspection_type] || form.inspection_type}{' '}
              Inspection
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <InspectionStatusPill status={form.status} />
              {permitLabel && (
                <span className="text-xs text-gray-500">· {permitLabel}</span>
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

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Type
              </label>
              <select
                value={form.inspection_type}
                onChange={(e) =>
                  setForm({ ...form, inspection_type: e.target.value })
                }
                className="input-std w-full"
              >
                {INSPECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t] || t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="input-std w-full"
              >
                {INSPECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s] || s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Scheduled date
              </label>
              <input
                type="date"
                value={form.scheduled_date}
                onChange={(e) =>
                  setForm({ ...form, scheduled_date: e.target.value })
                }
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Window (e.g. AM, 8-12)
              </label>
              <input
                type="text"
                placeholder="AM"
                value={form.scheduled_window}
                onChange={(e) =>
                  setForm({ ...form, scheduled_window: e.target.value })
                }
                className="input-std w-full"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Inspector name
              </label>
              <input
                type="text"
                placeholder="(pending)"
                value={form.inspector_name}
                onChange={(e) =>
                  setForm({ ...form, inspector_name: e.target.value })
                }
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sequence (1st, 2nd, …)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.sequence}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sequence: Number(e.target.value) || 1,
                  })
                }
                className="input-std w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Service inspection for 200A upgrade"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="input-std w-full"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Result notes / corrections
            </label>
            <textarea
              rows={4}
              placeholder="Inspector's notes, corrections list, or pass conditions"
              value={form.result_notes}
              onChange={(e) =>
                setForm({ ...form, result_notes: e.target.value })
              }
              className="input-std w-full"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete inspection
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
