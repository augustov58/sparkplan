
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus } from '../types';
import { Plus, ChevronRight, AlertCircle, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';

interface DashboardProps {
  projects: Project[];
  createNewProject: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, createNewProject }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Welcome back, John</h2>
          <p className="text-gray-500 mt-1">You have <span className="font-medium text-electric-600">{projects.length} active projects</span> requiring NEC compliance review.</p>
        </div>
        <button 
          onClick={createNewProject}
          className="bg-electric-400 hover:bg-electric-500 text-black px-6 py-3 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Create New NEC Project
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map(project => {
            const openIssues = project.issues.filter(i => i.status === 'Open').length;
            const criticalIssues = project.issues.filter(i => i.status === 'Open' && i.severity === 'Critical').length;
            
            return (
              <div 
                key={project.id}
                onClick={() => navigate(`/project/${project.id}`)}
                className="group bg-white border border-gray-100 hover:border-electric-400 rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-gray-100 group-hover:bg-electric-400 transition-colors"></div>
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50 px-2 py-0.5 rounded">{project.type}</span>
                        <span className="text-[10px] font-bold text-electric-700 uppercase tracking-wider bg-electric-50 px-2 py-0.5 rounded">NEC {project.necEdition}</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mt-2 group-hover:text-electric-600 transition-colors">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{project.address}</p>
                  </div>
                  <div className={`p-2 rounded-full ${
                    project.status === ProjectStatus.COMPLIANT ? 'bg-green-50 text-green-600' : 
                    project.status === ProjectStatus.IN_PROGRESS ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400'
                  }`}>
                    {project.status === ProjectStatus.COMPLIANT ? <CheckCircle2 className="w-5 h-5" /> : 
                     project.status === ProjectStatus.IN_PROGRESS ? <Clock className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>NEC Compliance Progress</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-electric-500 h-full rounded-full transition-all duration-1000 ease-out" 
                        style={{ width: `${project.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4 border-t border-gray-50">
                    <div className="text-center">
                       <span className="block text-lg font-bold text-gray-900">{project.loads.length}</span>
                       <span className="text-[10px] text-gray-400 uppercase">Loads</span>
                    </div>
                    <div className={`text-center border-l border-gray-100 pl-4 ${criticalIssues > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                       <span className="block text-lg font-bold flex items-center justify-center gap-1">
                          {openIssues}
                          {criticalIssues > 0 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                       </span>
                       <span className="text-[10px] text-gray-400 uppercase">Open Issues</span>
                    </div>
                    <div className="ml-auto flex items-center text-electric-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
                      Open Project <ChevronRight className="w-4 h-4 ml-1" />
                    </div>
                  </div>
                </div>
              </div>
            );
        })}
      </div>
    </div>
  );
};
