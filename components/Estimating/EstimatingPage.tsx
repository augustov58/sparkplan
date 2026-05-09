/**
 * Estimating top-level page.
 *
 * Replaces components/EstimatingStub.tsx. Wires up:
 *   - useEstimates (project-scoped) for the list view
 *   - useEstimateLineItems (estimate-scoped) loaded inside EstimateDetailView
 *
 * State machine:
 *   - When `selectedEstimateId` is null  -> show <EstimatesListView />
 *   - When `selectedEstimateId` is set   -> show <EstimateDetailView />
 *
 * Auto-takeoff at create time: when the user checks the "Auto-populate from
 * project" box on the create form, we run the takeoff once after the new
 * estimate row resolves and bulk-insert the seed line items. Subsequent
 * project edits do NOT propagate (per plan §5 decision 4).
 */

import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import type { Project } from '@/types';
import { useEstimates } from '@/hooks/useEstimates';
import { usePanels } from '@/hooks/usePanels';
import { useCircuits } from '@/hooks/useCircuits';
import { useFeeders } from '@/hooks/useFeeders';
import { useTransformers } from '@/hooks/useTransformers';
import { supabase } from '@/lib/supabase';
import { useAuthContext } from '@/components/Auth/AuthProvider';
import { autoTakeoffFromProject } from '@/services/estimating/autoTakeoffFromProject';
import { showToast, toastMessages } from '@/lib/toast';
import { EstimatesListView } from './EstimatesListView';
import { EstimateDetailView } from './EstimateDetailView';

interface EstimatingPageProps {
  project: Project;
}

export const EstimatingPage: React.FC<EstimatingPageProps> = ({ project }) => {
  const { user } = useAuthContext();
  const { estimates, loading, createEstimate, updateEstimate, deleteEstimate, cloneAsRevision } =
    useEstimates(project.id);

  const { panels } = usePanels(project.id);
  const { circuits } = useCircuits(project.id);
  const { feeders } = useFeeders(project.id);
  const { transformers } = useTransformers(project.id);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = selectedId ? estimates.find((e) => e.id === selectedId) ?? null : null;

  // Drop the selection if the underlying estimate gets deleted (e.g. realtime).
  useEffect(() => {
    if (selectedId && !estimates.find((e) => e.id === selectedId) && !loading) {
      setSelectedId(null);
    }
  }, [estimates, selectedId, loading]);

  const handleCreate = async ({
    name,
    runAutoTakeoff,
  }: {
    name: string;
    runAutoTakeoff: boolean;
  }) => {
    const created = await createEstimate({
      project_id: project.id,
      name,
      revision: 1,
      status: 'draft',
      markup_pct: 25,
      tax_pct: 0,
    });
    if (!created) return;

    if (runAutoTakeoff && user) {
      const result = autoTakeoffFromProject({ panels, circuits, feeders, transformers });
      if (result.lineItems.length > 0) {
        const rows = result.lineItems.map((li) => ({
          estimate_id: created.id,
          user_id: user.id,
          position: li.position,
          category: li.category,
          description: li.description,
          quantity: li.quantity,
          unit: li.unit,
          unit_cost: li.unit_cost,
          unit_price: li.unit_price,
          line_total: li.line_total,
          source_kind: li.source_kind,
          source_id: li.source_id,
          taxable: li.taxable,
          notes: li.notes,
        }));
        const { error } = await supabase.from('estimate_line_items').insert(rows);
        if (error) {
          console.error('Auto-takeoff insert failed', error);
          showToast.error(toastMessages.estimateLineItem.error);
        } else {
          showToast.success(toastMessages.estimate.autoTakeoff(result.lineItems.length));
        }
      } else {
        showToast.success(toastMessages.estimate.autoTakeoff(0));
      }
    }
    setSelectedId(created.id);
  };

  const handleClone = async (sourceId: string): Promise<string | null> => {
    const cloned = await cloneAsRevision(sourceId);
    if (!cloned || !user) return null;

    // Copy line items from the source.
    const { data: sourceItems, error: fetchError } = await supabase
      .from('estimate_line_items')
      .select('*')
      .eq('estimate_id', sourceId);
    if (fetchError) {
      console.error('Clone: failed to fetch source line items', fetchError);
      return cloned.id;
    }
    if (sourceItems && sourceItems.length > 0) {
      const rows = sourceItems.map((r: any) => ({
        estimate_id: cloned.id,
        user_id: user.id,
        position: r.position,
        category: r.category,
        description: r.description,
        quantity: r.quantity,
        unit: r.unit,
        unit_cost: r.unit_cost,
        unit_price: r.unit_price,
        line_total: r.line_total,
        source_kind: r.source_kind,
        source_id: r.source_id,
        assembly_key: r.assembly_key,
        taxable: r.taxable,
        markup_overridden: r.markup_overridden,
        notes: r.notes,
      }));
      const { error: insertError } = await supabase.from('estimate_line_items').insert(rows);
      if (insertError) console.error('Clone: failed to copy line items', insertError);
    }

    setSelectedId(cloned.id);
    return cloned.id;
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4">
      <header className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-electric-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Estimating</h1>
          <p className="text-xs uppercase tracking-wide text-electric-600">
            Beta — bid generation tied to your project model
          </p>
        </div>
      </header>

      {!selected && (
        <EstimatesListView
          estimates={estimates}
          loading={loading}
          onSelect={setSelectedId}
          onCreate={handleCreate}
          onDelete={deleteEstimate}
        />
      )}

      {selected && (
        <EstimateDetailView
          estimate={selected}
          project={project}
          onBack={() => setSelectedId(null)}
          onUpdate={updateEstimate}
          onClone={handleClone}
        />
      )}
    </div>
  );
};
