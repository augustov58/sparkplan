
import React, { useState } from 'react';
import { Project } from '../types';
import { AlertCircle, CheckCircle, Search, Filter, Plus, Trash2 } from 'lucide-react';
import { useIssues } from '../hooks/useIssues';

interface IssuesLogProps {
  project: Project;
  updateProject: (p: Project) => void;
}

export const IssuesLog: React.FC<IssuesLogProps> = ({ project }) => {
  const { issues, loading, error, createIssue, toggleIssueStatus, deleteIssue: removeIssue } = useIssues(project.id);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [newIssue, setNewIssue] = useState({
    description: '',
    article: '',
    severity: 'Warning' as 'Critical' | 'Warning' | 'Info'
  });
  const [isAdding, setIsAdding] = useState(false);

  console.log('IssuesLog - issues:', issues, 'loading:', loading, 'error:', error);

  const handleAdd = async () => {
    if (!newIssue.description) return;

    console.log('Creating issue with data:', {
      project_id: project.id,
      description: newIssue.description,
      article: newIssue.article || 'General',
      severity: newIssue.severity,
      status: 'Open'
    });

    const result = await createIssue({
      project_id: project.id,
      description: newIssue.description,
      article: newIssue.article || 'General',
      severity: newIssue.severity,
      status: 'Open'
    });

    console.log('Issue creation result:', result);

    if (result) {
      setNewIssue({ description: '', article: '', severity: 'Warning' });
      setIsAdding(false);
    } else {
      console.error('Failed to create issue - check hook error state');
    }
  };

  const filteredIssues = issues.filter(i => {
    const matchesFilter = filter === 'All' || i.status === filter;
    const matchesSearch = i.description.toLowerCase().includes(searchTerm.toLowerCase()) || i.article.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
       <div className="flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-light text-gray-900">Violation Log & Punch List</h2>
            <p className="text-gray-500 mt-1">Track code violations and corrective actions.</p>
         </div>
         <button
           onClick={() => setIsAdding(!isAdding)}
           className="bg-gray-900 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 hover:bg-black"
         >
           <Plus className="w-4 h-4" /> Log Violation
         </button>
       </div>

       {error && (
         <div className="bg-red-50 border border-red-200 rounded-lg p-4">
           <p className="text-red-700 font-medium">Error: {error}</p>
         </div>
       )}

       {isAdding && (
         <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 animate-in slide-in-from-top-2">
            <h3 className="font-medium text-gray-900 mb-3">New Issue</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="md:col-span-2">
                    <input 
                      placeholder="Description of violation..." 
                      className="input-std w-full"
                      value={newIssue.description}
                      onChange={e => setNewIssue({...newIssue, description: e.target.value})}
                    />
                </div>
                <div>
                    <input 
                      placeholder="NEC Article (e.g. 110.12)" 
                      className="input-std w-full"
                      value={newIssue.article}
                      onChange={e => setNewIssue({...newIssue, article: e.target.value})}
                    />
                </div>
                <div>
                    <select 
                      className="input-std w-full"
                      value={newIssue.severity}
                      onChange={e => setNewIssue({...newIssue, severity: e.target.value as any})}
                    >
                        <option value="Critical">Critical</option>
                        <option value="Warning">Warning</option>
                        <option value="Info">Info</option>
                    </select>
                </div>
            </div>
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsAdding(false)} className="px-3 py-1 text-sm text-gray-500">Cancel</button>
                <button onClick={handleAdd} className="bg-electric-500 text-black px-4 py-1.5 rounded text-sm font-bold">Save Issue</button>
            </div>
         </div>
       )}

       <div className="flex gap-4 items-center bg-white p-2 rounded-lg border border-gray-100 shadow-sm">
         <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input 
                placeholder="Search issues..." 
                className="w-full pl-10 pr-4 py-2 text-sm border-none focus:ring-0"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
            />
         </div>
         <div className="flex gap-1 pr-2">
            {(['All', 'Open', 'Resolved'] as const).map(f => (
                <button 
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${filter === f ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                    {f}
                </button>
            ))}
         </div>
       </div>

       <div className="space-y-3">
          {loading && (
             <div className="text-center py-12 text-gray-400">
                Loading issues...
             </div>
          )}
          {!loading && filteredIssues.length === 0 && (
             <div className="text-center py-12 text-gray-400">
                No issues found matching your criteria.
             </div>
          )}
          {!loading && filteredIssues.map(issue => (
              <div
                key={issue.id}
                className={`bg-white border rounded-lg p-4 flex items-start gap-4 transition-all hover:shadow-md ${issue.status === 'Resolved' ? 'border-gray-100 opacity-60' : 'border-l-4 border-l-red-500 border-y-gray-100 border-r-gray-100'}`}
              >
                  <button onClick={() => toggleIssueStatus(issue.id)} className="mt-1 flex-shrink-0 text-gray-300 hover:text-green-500 transition-colors">
                      {issue.status === 'Resolved' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className="w-5 h-5 rounded-full border-2 border-current" />}
                  </button>

                  <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                              issue.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                              issue.severity === 'Warning' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-50 text-blue-600'
                          }`}>
                              {issue.severity}
                          </span>
                          <span className="text-xs font-mono text-gray-500">NEC {issue.article}</span>
                          <span className="text-xs text-gray-300 mx-1">•</span>
                          <span className="text-xs text-gray-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className={`text-sm ${issue.status === 'Resolved' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                          {issue.description}
                      </p>
                  </div>

                  <button onClick={() => removeIssue(issue.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                  </button>
              </div>
          ))}
       </div>
    </div>
  );
};
