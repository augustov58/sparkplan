/**
 * PermitsOverviewTab — at-a-glance summary cards for each permit + recent
 * activity timeline. Read-only; the user clicks into the Permits tab to
 * edit. Phase 1 Permits Beta (docs/plans/permits-implementation.md §4.4).
 */
import React, { useMemo } from 'react';
import { FileText, Calendar } from 'lucide-react';
import { usePermits, type Permit } from '../../hooks/usePermits';
import { usePermitInspections } from '../../hooks/usePermitInspections';
import { PermitStatusPill } from './PermitStatusPill';
import {
  formatExpirationLabel,
  getExpirationStatus,
} from '../../services/permits/permitExpirationWarning';
import { getStatusLabel } from '../../services/permits/permitStatusTransitions';

interface PermitsOverviewTabProps {
  projectId: string;
  onSwitchToPermits?: () => void;
}

const PERMIT_TYPE_LABELS: Record<string, string> = {
  electrical: 'Electrical',
  evse: 'EVSE',
  low_voltage: 'Low Voltage',
  service_upgrade: 'Service Upgrade',
  other: 'Other',
};

const ACTIVE_STATUSES = new Set([
  'submitted',
  'in_review',
  'returned',
  'approved',
]);

const formatPermitTitle = (p: Permit): string => {
  const t = PERMIT_TYPE_LABELS[p.permit_type] || p.permit_type;
  return `${t} Permit`;
};

export const PermitsOverviewTab: React.FC<PermitsOverviewTabProps> = ({
  projectId,
  onSwitchToPermits,
}) => {
  const { permits, loading } = usePermits(projectId);
  const { inspections } = usePermitInspections(projectId);

  const activePermits = useMemo(
    () => permits.filter((p) => ACTIVE_STATUSES.has(p.status)),
    [permits],
  );

  const activity = useMemo(() => {
    const events: Array<{
      timestamp: string;
      label: string;
      permit?: Permit;
    }> = [];

    for (const p of permits) {
      if (p.submitted_at) {
        events.push({
          timestamp: p.submitted_at,
          label: `${formatPermitTitle(p)} submitted`,
          permit: p,
        });
      }
      if (p.approved_at) {
        events.push({
          timestamp: p.approved_at,
          label: `${formatPermitTitle(p)} approved`,
          permit: p,
        });
      }
      if (p.closed_at) {
        events.push({
          timestamp: p.closed_at,
          label: `${formatPermitTitle(p)} closed`,
          permit: p,
        });
      }
    }

    for (const i of inspections) {
      if (i.performed_at) {
        const status = i.status === 'passed' ? 'passed' : i.status;
        events.push({
          timestamp: i.performed_at,
          label: `${i.inspection_type.replace('_', ' ')} inspection ${status}`,
        });
      }
    }

    return events
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 8);
  }, [permits, inspections]);

  const inspectionsByPermit = useMemo(() => {
    const map: Record<string, typeof inspections> = {};
    for (const i of inspections) {
      if (!map[i.permit_id]) map[i.permit_id] = [];
      map[i.permit_id].push(i);
    }
    return map;
  }, [inspections]);

  const nextInspectionFor = (permitId: string) => {
    const arr = inspectionsByPermit[permitId] || [];
    return arr
      .filter((i) => i.status === 'scheduled')
      .sort((a, b) => {
        if (!a.scheduled_date) return 1;
        if (!b.scheduled_date) return -1;
        return (
          new Date(a.scheduled_date).getTime() -
          new Date(b.scheduled_date).getTime()
        );
      })[0];
  };

  if (loading) {
    return (
      <div className="text-center text-gray-400 py-12 text-sm">
        Loading permits…
      </div>
    );
  }

  if (permits.length === 0) {
    return (
      <div className="border border-dashed border-gray-200 rounded-lg p-12 text-center">
        <FileText className="w-10 h-10 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 mb-3">
          No permits yet for this project.
        </p>
        {onSwitchToPermits && (
          <button
            onClick={onSwitchToPermits}
            className="bg-[#2d3b2d] hover:bg-black text-white px-3 py-1.5 rounded text-sm font-medium"
          >
            Create a permit
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm text-gray-500">
          Active permits: {activePermits.length} of {permits.length} total
        </h3>
      </div>

      <div className="space-y-3">
        {permits.map((p) => {
          const expStatus = getExpirationStatus(p.expires_at);
          const expLabel = formatExpirationLabel(p.expires_at);
          const next = nextInspectionFor(p.id);
          const inspCount = (inspectionsByPermit[p.id] || []).length;
          return (
            <div
              key={p.id}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-base font-semibold text-gray-900">
                      {formatPermitTitle(p)}
                    </h4>
                    <PermitStatusPill status={p.status} />
                    {expStatus && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          expStatus === 'expired'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {expLabel}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {p.ahj_jurisdiction} ·{' '}
                    {p.permit_number ? (
                      <span className="font-mono">{p.permit_number}</span>
                    ) : (
                      <span className="italic">number pending</span>
                    )}
                  </p>
                  {p.description && (
                    <p className="text-xs text-gray-600 mt-1">{p.description}</p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100 mt-3 pt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-600">
                {p.submitted_at && (
                  <span>
                    Submitted {new Date(p.submitted_at).toLocaleDateString()}
                  </span>
                )}
                {p.approved_at && (
                  <span>
                    Approved {new Date(p.approved_at).toLocaleDateString()}
                  </span>
                )}
                {expLabel && !expStatus && <span>{expLabel}</span>}
                <span>
                  {inspCount === 0
                    ? 'No inspections yet'
                    : `${inspCount} inspection${inspCount === 1 ? '' : 's'}`}
                </span>
                {next && next.scheduled_date && (
                  <span className="text-blue-700">
                    Next: {next.inspection_type.replace('_', ' ')}{' '}
                    {new Date(next.scheduled_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {activity.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            Recent activity
          </h3>
          <ul className="space-y-2">
            {activity.map((e, idx) => (
              <li
                key={idx}
                className="text-xs text-gray-600 flex items-baseline gap-3"
              >
                <span className="text-gray-400 font-mono w-24 flex-shrink-0">
                  {new Date(e.timestamp).toLocaleDateString()}
                </span>
                <span className="capitalize">
                  {e.label}
                  {e.permit && (
                    <span className="text-gray-400 ml-1">
                      ({getStatusLabel(e.permit.status as never)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
