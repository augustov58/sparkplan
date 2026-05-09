/**
 * InspectionsListTab — flat table of every inspection across all permits
 * in the project, with row click -> detail drawer + a "New inspection"
 * action that requires picking a parent permit.
 */
import React, { useMemo, useState } from 'react';
import { Plus, ClipboardCheck } from 'lucide-react';
import {
  usePermitInspections,
  type PermitInspection,
  type PermitInspectionInsert,
} from '../../hooks/usePermitInspections';
import { usePermits, type Permit } from '../../hooks/usePermits';
import { InspectionStatusPill } from './InspectionStatusPill';
import { InspectionDetailDrawer } from './InspectionDetailDrawer';
import {
  INSPECTION_TYPES,
  INSPECTION_STATUSES,
} from '../../services/permits/permitStatusTransitions';

interface InspectionsListTabProps {
  projectId: string;
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

const PERMIT_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  evse: 'EVSE',
  low_voltage: 'Low Voltage',
  service_upgrade: 'Service Upgrade',
  other: 'Other',
};

const formatPermitLabel = (p: Permit): string => {
  const typeLabel = PERMIT_TYPE_LABELS[p.permit_type] || p.permit_type;
  if (p.permit_number) return `${typeLabel} (${p.permit_number})`;
  return typeLabel;
};

export const InspectionsListTab: React.FC<InspectionsListTabProps> = ({
  projectId,
}) => {
  const {
    inspections,
    loading,
    error,
    createInspection,
    updateInspection,
    deleteInspection,
  } = usePermitInspections(projectId);
  const { permits } = usePermits(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  const permitsById = useMemo(() => {
    const map: Record<string, Permit> = {};
    for (const p of permits) map[p.id] = p;
    return map;
  }, [permits]);

  const selected = inspections.find((i) => i.id === selectedId) || null;
  const selectedPermitLabel =
    selected && permitsById[selected.permit_id]
      ? formatPermitLabel(permitsById[selected.permit_id])
      : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          All inspections for this project
          {inspections.length > 0 ? ` (${inspections.length})` : ''}
        </p>
        <button
          onClick={() => setShowNew(true)}
          disabled={permits.length === 0}
          className="bg-[#2d3b2d] hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded text-sm font-medium inline-flex items-center gap-1.5"
          title={
            permits.length === 0
              ? 'Create a permit first before scheduling an inspection.'
              : ''
          }
        >
          <Plus className="w-4 h-4" />
          New inspection
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center text-gray-400 py-12 text-sm">
          Loading inspections…
        </div>
      )}

      {!loading && inspections.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-lg p-12 text-center">
          <ClipboardCheck className="w-10 h-10 mx-auto text-gray-300 mb-3" />
          <p className="text-sm text-gray-500">
            {permits.length === 0
              ? 'Create a permit first, then schedule its inspections here.'
              : 'No inspections scheduled yet.'}
          </p>
        </div>
      )}

      {!loading && inspections.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Permit</th>
                <th className="px-4 py-3 text-left font-medium">Scheduled</th>
                <th className="px-4 py-3 text-left font-medium">Inspector</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((insp) => {
                const parent = permitsById[insp.permit_id];
                return (
                  <tr
                    key={insp.id}
                    onClick={() => setSelectedId(insp.id)}
                    className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-800 capitalize">
                      {TYPE_LABELS[insp.inspection_type] ||
                        insp.inspection_type.replace('_', ' ')}
                      {insp.sequence > 1 && (
                        <span className="text-gray-400 ml-1">
                          (#{insp.sequence})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {parent ? formatPermitLabel(parent) : insp.permit_id}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-xs">
                      {insp.scheduled_date ? (
                        <>
                          {new Date(insp.scheduled_date).toLocaleDateString()}
                          {insp.scheduled_window && (
                            <span className="text-gray-400 ml-1">
                              · {insp.scheduled_window}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-300">unscheduled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {insp.inspector_name || (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <InspectionStatusPill status={insp.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <InspectionDetailDrawer
          inspection={selected}
          permitLabel={selectedPermitLabel}
          onClose={() => setSelectedId(null)}
          onSave={updateInspection}
          onDelete={deleteInspection}
        />
      )}

      {showNew && (
        <NewInspectionDialog
          projectId={projectId}
          permits={permits}
          onClose={() => setShowNew(false)}
          onCreate={async (insert) => {
            const created = await createInspection(insert);
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
// NewInspectionDialog
// -----------------------------------------------------------------------
interface NewInspectionDialogProps {
  projectId: string;
  permits: Permit[];
  onClose: () => void;
  onCreate: (
    insert: Omit<
      PermitInspectionInsert,
      'id' | 'user_id' | 'created_at' | 'updated_at'
    >,
  ) => Promise<void>;
}

const NewInspectionDialog: React.FC<NewInspectionDialogProps> = ({
  projectId,
  permits,
  onClose,
  onCreate,
}) => {
  const [permitId, setPermitId] = useState<string>(permits[0]?.id ?? '');
  const [inspectionType, setInspectionType] = useState<string>('rough_in');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledWindow, setScheduledWindow] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [status, setStatus] = useState<string>('scheduled');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!permitId) return;
    setSubmitting(true);
    try {
      await onCreate({
        project_id: projectId,
        permit_id: permitId,
        inspection_type: inspectionType,
        sequence: 1,
        scheduled_date: scheduledDate || null,
        scheduled_window: scheduledWindow.trim() || null,
        inspector_name: inspectorName.trim() || null,
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
          <h2 className="text-base font-semibold text-gray-900">
            New inspection
          </h2>
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
              Parent permit
            </label>
            <select
              value={permitId}
              onChange={(e) => setPermitId(e.target.value)}
              className="input-std w-full"
            >
              {permits.map((p) => (
                <option key={p.id} value={p.id}>
                  {formatPermitLabel(p)} — {p.ahj_jurisdiction}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Inspection type
            </label>
            <select
              value={inspectionType}
              onChange={(e) => setInspectionType(e.target.value)}
              className="input-std w-full"
            >
              {INSPECTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t] || t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Scheduled date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Window
              </label>
              <input
                type="text"
                placeholder="AM"
                value={scheduledWindow}
                onChange={(e) => setScheduledWindow(e.target.value)}
                className="input-std w-full"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Inspector
              </label>
              <input
                type="text"
                placeholder="(pending)"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                className="input-std w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-std w-full"
              >
                {INSPECTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
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
            disabled={submitting || !permitId}
            className="bg-[#2d3b2d] hover:bg-black disabled:opacity-50 text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            {submitting ? 'Creating…' : 'Schedule inspection'}
          </button>
        </div>
      </div>
    </div>
  );
};
