import React from 'react';
import { Project } from '../types';
import { FileText, CheckCircle2, AlertTriangle, UserCheck } from 'lucide-react';

interface ReportProps {
  project: Project;
}

export const ComplianceReport: React.FC<ReportProps> = ({ project }) => {
  const totalItems = (project.inspectionList || []).length;
  const passedItems = (project.inspectionList || []).filter(i => i.status === 'Pass').length;
  const progress = totalItems ? Math.round((passedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-light text-gray-900 tracking-tight mb-2">NEC Compliance Certificate</h2>
            <p className="text-gray-500">Generated for Local Authority Having Jurisdiction (AHJ)</p>
        </div>

        <div className="bg-white border border-gray-200 p-12 shadow-sm relative overflow-hidden">
            {/* Watermark */}
            <div className="absolute top-10 right-10 opacity-5">
                <CheckCircle2 className="w-64 h-64 text-gray-900" />
            </div>

            <div className="flex justify-between border-b border-gray-100 pb-8 mb-8">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 uppercase tracking-widest">Project Report</h3>
                    <p className="text-sm text-gray-500 mt-1">{project.id}</p>
                </div>
                <div className="text-right">
                    <p className="font-bold text-gray-900">{project.name}</p>
                    <p className="text-gray-500">{project.address}</p>
                    <p className="text-[#2d3b2d] font-mono mt-2">{new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 mb-12">
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Code Adoption</h4>
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm border-b border-gray-50 pb-2">
                            <span className="text-gray-600">Edition</span>
                            <span className="font-medium">NEC {project.necEdition}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-gray-50 pb-2">
                            <span className="text-gray-600">Project Type</span>
                            <span className="font-medium">{project.type}</span>
                        </div>
                        <div className="flex justify-between text-sm border-b border-gray-50 pb-2">
                            <span className="text-gray-600">Service</span>
                            <span className="font-medium">{project.serviceVoltage}V {project.servicePhase}Φ</span>
                        </div>
                    </div>
                </div>
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Compliance Status</h4>
                    <div className="flex items-center gap-4 mb-4">
                        <div className="text-4xl font-light text-gray-900">{progress}%</div>
                        <div className="text-xs text-gray-500">
                             Overall<br />Completeness
                        </div>
                    </div>
                    {progress === 100 ? (
                        <div className="bg-green-50 text-green-800 px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" /> Ready for Inspection
                        </div>
                    ) : (
                        <div className="bg-[#fff8e6] text-[#7a6200] px-4 py-2 rounded text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Action Required
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-12">
                <h4 className="text-xs font-bold text-gray-400 uppercase mb-4">Grounding System Verification</h4>
                <p className="text-sm text-gray-600 mb-2">
                    GEC Size: <span className="font-mono text-black bg-gray-100 px-1 rounded">{project.grounding?.gecSize || 'N/A'}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                    {project.grounding?.electrodes?.map(e => (
                        <span key={e} className="border border-gray-200 px-2 py-1 rounded text-xs text-gray-500">{e}</span>
                    ))}
                </div>
            </div>

            <div className="border-t border-gray-100 pt-8 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-gray-500" />
                    </div>
                    <div className="text-xs">
                        <p className="font-bold text-gray-900">John Smith</p>
                        <p className="text-gray-400">Master Electrician License #48291</p>
                    </div>
                </div>
                <button className="bg-black text-white px-6 py-3 rounded hover:bg-gray-800 transition-colors flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Download PDF Report
                </button>
            </div>
        </div>
    </div>
  );
};
