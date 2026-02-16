import React, { useState } from 'react';
import { Project } from '../types';
import { generateInspectionChecklist } from '../services/geminiService';
import { CheckSquare, Camera, AlertTriangle, Plus, Trash2, X } from 'lucide-react';
import { useInspectionItems } from '../hooks/useInspectionItems';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useFeeders } from '../hooks/useFeeders';
import { useTransformers } from '../hooks/useTransformers';
import { useGrounding } from '../hooks/useGrounding';
import { buildProjectContext, formatContextForAI } from '../services/ai/projectContextBuilder';

interface InspectionProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const PreInspection: React.FC<InspectionProps> = ({ project }) => {
  const { items, loading: itemsLoading, error, createItems, updateItemStatus, deleteItem } = useInspectionItems(project.id);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch project data for context
  const { panels } = usePanels(project.id);
  const { circuits } = useCircuits(project.id);
  const { feeders } = useFeeders(project.id);
  const { transformers } = useTransformers(project.id);
  const { grounding } = useGrounding(project.id);

  console.log('PreInspection - items:', items, 'loading:', itemsLoading, 'error:', error);

  // Handle checkbox toggle (maps to 'Pass' = checked, 'Pending' = unchecked)
  const handleCheckboxToggle = (itemId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Pass' ? 'Pending' : 'Pass';
    updateItemStatus(itemId, newStatus as any);
  };

  // Delete all items
  const handleBulkDelete = async () => {
    for (const item of items) {
      await deleteItem(item.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleAutoGenerate = async () => {
    setLoading(true);
    console.log('Generating inspection checklist for project:', project.id, 'type:', project.type);

    // Build project context if data is available
    let projectContext: string | undefined;
    if (panels.length > 0) {
      const context = buildProjectContext(
        project.id,
        project.name,
        project.type,
        project.serviceVoltage,
        project.servicePhase,
        panels,
        circuits,
        feeders,
        transformers
      );
      projectContext = formatContextForAI(context);
      console.log('Built project context with:', panels.length, 'panels,', circuits.length, 'circuits');
    } else {
      console.log('No project data available, generating generic checklist');
    }

    const jsonStr = await generateInspectionChecklist(project.type, 'Rough-In', projectContext);
    console.log('AI Response:', jsonStr);

    try {
        // Strip markdown code blocks if present (```json ... ```)
        let cleanedJson = jsonStr.trim();
        if (cleanedJson.startsWith('```')) {
            // Remove opening ```json and closing ```
            cleanedJson = cleanedJson.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        }
        console.log('Cleaned JSON:', cleanedJson);

        const parsed = JSON.parse(cleanedJson);
        console.log('Parsed items:', parsed);

        const newItems = parsed.map((item: any) => ({
            project_id: project.id,
            category: item.category || 'General',
            requirement: item.requirement || 'Check wiring',
            status: 'Pending' as const
        }));

        console.log('Creating items:', newItems);
        const result = await createItems(newItems);
        console.log('Create items result:', result);
    } catch (e) {
        console.error("Failed to parse checklist or create items", e);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="flex justify-between items-center">
         <div>
           <h2 className="text-2xl font-light text-gray-900">Pre-Inspection Checklist</h2>
           <p className="text-gray-500 mt-1">Rough-in and Final inspection verification.</p>
         </div>
         <div className="flex gap-2">
           {items.length > 0 && (
             <button
               onClick={() => setShowDeleteConfirm(true)}
               className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
             >
               <Trash2 className="w-4 h-4" />
               Clear All
             </button>
           )}
           <button
             onClick={handleAutoGenerate}
             disabled={loading}
             className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 disabled:opacity-50"
           >
             <Plus className="w-4 h-4" />
             {loading ? 'Generating...' : 'Auto-Populate from NEC'}
           </button>
         </div>
      </div>

      {/* Bulk Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Delete All Items?</h3>
                <p className="text-sm text-gray-500">This will remove all {items.length} checklist items.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-md font-medium"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">Error: {error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
         <div className="grid grid-cols-12 bg-gray-50 p-4 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
             <div className="col-span-1 flex items-center">
               <input type="checkbox" className="w-4 h-4 rounded opacity-0 pointer-events-none" />
             </div>
             <div className="col-span-8">Requirement (NEC Reference)</div>
             <div className="col-span-2 text-center">Evidence</div>
             <div className="col-span-1 text-right">Delete</div>
         </div>
         <div className="divide-y divide-gray-50">
             {itemsLoading && (
                 <div className="p-8 text-center text-gray-400">
                     Loading checklist items...
                 </div>
             )}
             {!itemsLoading && items.length === 0 && (
                 <div className="p-8 text-center text-gray-400">
                     No checklist items. Click 'Auto-Populate' to start.
                 </div>
             )}
             {!itemsLoading && items.map(item => (
                 <div key={item.id} className="grid grid-cols-12 p-4 items-center gap-4 hover:bg-gray-50 transition-colors">
                     <div className="col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={item.status === 'Pass'}
                          onChange={() => handleCheckboxToggle(item.id, item.status)}
                          className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                        />
                     </div>
                     <div className="col-span-8">
                         <span className={`block text-sm font-medium ${item.status === 'Pass' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                           {item.requirement}
                         </span>
                         <span className="text-xs text-[#2d3b2d] bg-[#f0f5f0] px-2 py-0.5 rounded-full mt-1 inline-block">{item.category}</span>
                     </div>
                     <div className="col-span-2 text-center">
                         <button className="text-gray-400 hover:text-[#2d3b2d] transition-colors">
                            <Camera className="w-5 h-5 mx-auto" />
                         </button>
                     </div>
                     <div className="col-span-1 flex justify-end">
                         <button
                           onClick={() => deleteItem(item.id)}
                           className="text-gray-400 hover:text-red-600 transition-colors"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                     </div>
                 </div>
             ))}
         </div>
      </div>
    </div>
  );
};
