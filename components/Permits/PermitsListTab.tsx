/**
 * PermitsListTab — full list of permits for the project with row click ->
 * detail drawer + inline "New permit" dialog.
 */
import React, { useState } from 'react';
import { Plus, FileText } from 'lucide-react';
import {
  usePermits,
  type Permit,
  type PermitInsert,
} from '../../hooks/usePermits';
import { PermitStatusPill } from './PermitStatusPill';
import { PermitDetailDrawer } from './PermitDetailDrawer';
import {
  PERMIT_TYPES,
  type PermitStatus,
  getStatusLabel,
} from '../../services/permits/permitStatusTransitions';
import {
  formatExpirationLabel,
  getExpirationStatus,
} from '../../services/permits/permitExpirationWarning';

interface PermitsListTabProps {
  projectId: string;
}

const PERMIT_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  evse: 'EVSE',
  low_voltage: 'Low Voltage',
  service_upgrade: 'Service Upgrade',
  other: 'Other',
};

export const PermitsListTab: React.FC<PermitsListTabProps> = ({ projectId }) => {
  const { permits, loading, error, createPermit, updatePermit, deletePermit } =
    usePermits(projectId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const selected = permits.find((p) => p.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          All permits for this project
          {permits.length > 0 ? ` (${permits.length})` : ''}
        </p>
        <button
          onClick={() => setShowNew(true)}
          className="bg-[#2d3b2d] hover:bg-black text-white px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          New permit
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-400 py-12 text-sm">
          Loading permits…
        </div>
      )}

      {!loading && permits.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-lg p-12 text-center">
          <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500 mb-4">
            No permits yet. Add your first permit to start tracking submission
            and inspection lifecycle.
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="bg-[#2d3b2d] hover:bg-black text-white px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New permit
          </button>
        </div>
      )}

      {!loading && permits.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Number</th>
                <th className="px-4 py-3 text-left font-medium">AHJ</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {permits.map((p) => {
                const expStatus = getExpirationStatus(p.expires_at);
                const expLabel = formatExpirationLabel(p.expires_at);
                return (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-800">
                      {PERMIT_TYPE_LABELS[p.permit_type] || p.permit_type}
                    </td>
                    <td className="px-4 py-3 text-gray-700 font-mono text-xs">
                      {p.permit_number || (
                        <span className="text-gray-400 italic font-sans">
                          (pending)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 truncate max-w-[200px]">
                      {p.ahj_jurisdiction}
                    </td>
                    <td className="px-4 py-3">
                      <PermitStatusPill status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {expLabel ? (
                        <span
                          className={
                            expStatus === 'expired'
                              ? 'text-red-600 font-medium'
                              : expStatus === 'expiring_soon'
                                ? 'text-amber-700 font-medium'
                                : 'text-gray-500'
                          }
                        >
                          {expLabel}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <PermitDetailDrawer
          permit={selected}
          onClose={() => setSelectedId(null)}
          onSave={updatePermit}
          onDelete={deletePermit}
        />
      )}

      {showNew && (
        <NewPermitDialog
          projectId={projectId}
          onClose={() => setShowNew(false)}
          onCreate={async (insert) => {
            const created = await createPermit(insert);
            if (created) {
              setShowNew(false);
              setSelectedId(created.id);
            }
          }}
        />
      )}
    </div>
  );
};

// -----------------------------------------------------------------------
// NewPermitDialog — minimal modal so contractors can stand up a draft fast.
// Drafts only require AHJ jurisdiction; everything else is editable later.
// -----------------------------------------------------------------------
interface NewPermitDialogProps {
  projectId: string;
  onClose: () => void;
  onCreate: (
    insert: Omit<PermitInsert, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  ) => Promise<void>;
}

const NewPermitDialog: React.FC<NewPermitDialogProps> = ({
  projectId,
  onClose,
  onCreate,
}) => {
  const [permitType, setPermitType] = useState<string>('electrical');
  const [ahj, setAhj] = useState('');
  const [description, setDescription] = useState('');
  const [permitNumber, setPermitNumber] = useState('');
  const [status, setStatus] = useState<PermitStatus>('draft');
  const [submitting, setSubmitting] = useState(false);

  // Advisory: we surface a hint when AHJ is empty but still let the user
  // save a placeholder. Hard-blocking is contrary to the project's
  // validation-as-warning preference.
  const ahjMissing = ahj.trim().length === 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onCreate({
        project_id: projectId,
        permit_type: permitType,
        ahj_jurisdiction: ahj.trim() || 'TBD',
        description: description.trim() || null,
        permit_number: permitNumber.trim() || null,
        status,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-md rounded-lg shadow-xl">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">New permit</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type
            </label>
            <select
              value={permitType}
              onChange={(e) => setPermitType(e.target.value)}
              className="input-std w-full"
            >
              {PERMIT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PERMIT_TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              AHJ jurisdiction
            </label>
            <input
              type="text"
              placeholder="e.g. Orange County, FL"
              value={ahj}
              onChange={(e) => setAhj(e.target.value)}
              className="input-std w-full"
            />
            {ahjMissing && (
              <p className="text-[11px] text-amber-700 mt-1">
                AHJ is required at submission. You can save with TBD and fill
                in later.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 200A service upgrade"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-std w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Permit # (if known)
              </label>
              <input
                type="text"
                placeholder="(pending)"
                value={permitNumber}
                onChange={(e) => setPermitNumber(e.target.value)}
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Initial status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PermitStatus)}
                className="input-std w-full"
              >
                <option value="draft">{getStatusLabel('draft')}</option>
                <option value="submitted">{getStatusLabel('submitted')}</option>
                <option value="in_review">{getStatusLabel('in_review')}</option>
                <option value="approved">{getStatusLabel('approved')}</option>
              </select>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#2d3b2d] hover:bg-black disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            {submitting ? 'Creating…' : 'Create permit'}
          </button>
        </div>
      </div>
    </div>
  );
};
