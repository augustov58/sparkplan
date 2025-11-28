import React, { useState } from 'react';
import { Project, InspectionItem } from '../types';
import { generateInspectionChecklist } from '../services/geminiService';
import { CheckSquare, Camera, AlertTriangle, Plus } from 'lucide-react';

interface InspectionProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const PreInspection: React.FC<InspectionProps> = ({ project, updateProject }) => {
  const [loading, setLoading] = useState(false);

  const handleAutoGenerate = async () => {
    setLoading(true);
    // Parse the response from AI
    const jsonStr = await generateInspectionChecklist(project.type, 'Rough-In');
    try {
        const items = JSON.parse(jsonStr);
        const newItems: InspectionItem[] = items.map((item: any, idx: number) => ({
            id: Date.now().toString() + idx,
            category: item.category || 'General',
            requirement: item.requirement || 'Check wiring',
            status: 'Pending'
        }));
        updateProject({ ...project, inspectionList: [...(project.inspectionList || []), ...newItems] });
    } catch (e) {
        console.error("Failed to parse checklist");
    }
    setLoading(false);
  };

  const updateItemStatus = (id: string, status: InspectionItem['status']) => {
    const newList = (project.inspectionList || []).map(item => 
        item.id === id ? { ...item, status } : item
    );
    updateProject({ ...project, inspectionList: newList });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Pass': return 'bg-green-100 text-green-700 border-green-200';
        case 'Fail': return 'bg-red-100 text-red-700 border-red-200';
        case 'N/A': return 'bg-gray-100 text-gray-500 border-gray-200';
        default: return 'bg-white text-gray-500 border-gray-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
       <div className="flex justify-between items-center">
         <div>
           <h2 className="text-2xl font-light text-gray-900">Pre-Inspection Checklist</h2>
           <p className="text-gray-500 mt-1">Rough-in and Final inspection verification.</p>
         </div>
         <button 
           onClick={handleAutoGenerate}
           disabled={loading}
           className="bg-gray-900 hover:bg-black text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2"
         >
           <Plus className="w-4 h-4" />
           {loading ? 'Generating...' : 'Auto-Populate from NEC'}
         </button>
      </div>

      <div className="bg-white border border-gray-100 rounded-lg overflow-hidden shadow-sm">
         <div className="grid grid-cols-12 bg-gray-50 p-4 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase">
             <div className="col-span-1">Status</div>
             <div className="col-span-7">Requirement (NEC Reference)</div>
             <div className="col-span-2 text-center">Evidence</div>
             <div className="col-span-2 text-right">Actions</div>
         </div>
         <div className="divide-y divide-gray-50">
             {(project.inspectionList || []).length === 0 && (
                 <div className="p-8 text-center text-gray-400">
                     No checklist items. Click 'Auto-Populate' to start.
                 </div>
             )}
             {(project.inspectionList || []).map(item => (
                 <div key={item.id} className="grid grid-cols-12 p-4 items-center gap-4 hover:bg-gray-50 transition-colors">
                     <div className="col-span-1">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border text-[10px] font-bold ${getStatusColor(item.status)}`}>
                            {item.status === 'Pending' ? '...' : item.status[0]}
                        </div>
                     </div>
                     <div className="col-span-7">
                         <span className="block text-sm font-medium text-gray-900">{item.requirement}</span>
                         <span className="text-xs text-electric-600 bg-electric-50 px-2 py-0.5 rounded-full mt-1 inline-block">{item.category}</span>
                     </div>
                     <div className="col-span-2 text-center">
                         <button className="text-gray-400 hover:text-electric-600 transition-colors">
                            <Camera className="w-5 h-5 mx-auto" />
                         </button>
                     </div>
                     <div className="col-span-2 flex justify-end gap-1">
                         <button onClick={() => updateItemStatus(item.id, 'Pass')} className="px-3 py-1 text-xs font-bold text-green-700 hover:bg-green-50 rounded border border-transparent hover:border-green-200">Pass</button>
                         <button onClick={() => updateItemStatus(item.id, 'Fail')} className="px-3 py-1 text-xs font-bold text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200">Fail</button>
                     </div>
                 </div>
             ))}
         </div>
      </div>
    </div>
  );
};
