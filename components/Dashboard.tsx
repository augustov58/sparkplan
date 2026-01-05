/**
 * Dashboard Component - Industrial Schematic Design
 * Control room aesthetic with project modules and open tickets panel
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus } from '../types';
import {
  Plus,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Trash2,
  MessageSquare,
  MapPin,
  Calendar,
  FileText,
  Filter,
  FolderPlus,
  Upload,
  Zap,
  Activity,
  CircuitBoard
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAllOpenItems } from '../hooks/useAllOpenItems';
import { WelcomeModal } from './WelcomeModal';
import { ProjectExportImportCompact } from './ProjectExportImport';
import { TemplateType, createProjectFromTemplate } from '../services/sampleTemplates';
import { useProjects } from '../hooks/useProjects';
import { supabase } from '../lib/supabase';

// Status LED component
const StatusLED = ({ active = true, color = 'emerald', size = 'sm' }: { active?: boolean; color?: string; size?: 'sm' | 'md' }) => {
  const sizeClass = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  return (
    <div
      className={`${sizeClass} rounded-full flex-shrink-0 ${
        active
          ? color === 'amber'
            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
            : color === 'red'
              ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
              : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
          : 'bg-slate-600'
      }`}
    />
  );
};

// Voltage bar component
const VoltageBar = ({ level = 3, max = 5 }: { level?: number; max?: number }) => (
  <div className="flex gap-0.5">
    {[...Array(max)].map((_, i) => (
      <div
        key={i}
        className={`w-1 h-3 rounded-sm transition-all duration-300 ${
          i < level ? 'bg-amber-400' : 'bg-slate-700'
        }`}
      />
    ))}
  </div>
);

// Progress bar with circuit nodes
const CircuitProgressBar = ({ progress }: { progress: number }) => (
  <div className="relative">
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-1000 ease-out relative"
        style={{ width: `${progress}%` }}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
      </div>
    </div>
    {/* Node markers at 25%, 50%, 75% */}
    <div className="absolute top-1/2 -translate-y-1/2 left-[25%] w-1 h-1 rounded-full bg-slate-600" />
    <div className="absolute top-1/2 -translate-y-1/2 left-[50%] w-1 h-1 rounded-full bg-slate-600" />
    <div className="absolute top-1/2 -translate-y-1/2 left-[75%] w-1 h-1 rounded-full bg-slate-600" />
  </div>
);

// Section header component
const SectionHeader = ({ label, title, count }: { label: string; title: string; count?: number }) => (
  <div className="flex items-center gap-4 mb-6">
    <div className="flex items-center gap-2">
      <StatusLED active color="amber" />
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent" />
    <h2 className="text-xl font-semibold text-white">{title}</h2>
    {count !== undefined && (
      <span className="text-xs font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
        {count}
      </span>
    )}
    <div className="h-px flex-1 bg-gradient-to-l from-slate-700 to-transparent" />
    <VoltageBar level={4} />
  </div>
);

interface DashboardProps {
  projects: Project[];
  createNewProject: () => void;
  deleteProject: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, createNewProject, deleteProject }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { openItems, loading: loadingOpenItems } = useAllOpenItems();
  const { createProject } = useProjects();

  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('priority');
  const [showWelcome, setShowWelcome] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (projects.length === 0 && !localStorage.getItem('welcomeModalDismissed')) {
      setShowWelcome(true);
    }
  }, [projects.length]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('welcomeModalDismissed', 'true');
  };

  const handleCreateFromTemplate = async (templateType?: TemplateType) => {
    if (!user) return;

    if (templateType) {
      const { project: templateProject, panels: templatePanels } = createProjectFromTemplate(templateType, user.id);
      const newProject = await createProject(templateProject);

      if (newProject) {
        if (templatePanels.length > 0) {
          try {
            const { error } = await supabase.from('panels').insert(templatePanels);
            if (error) console.error('Error creating template panels:', error);
          } catch (err) {
            console.error('Failed to create panels:', err);
          }
        }
        navigate(`/project/${newProject.id}`);
      }
    } else {
      createNewProject();
    }
  };

  const getUserName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) return user.email.split('@')[0];
    return 'Operator';
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    deleteProject(projectId);
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'rfi': return <MessageSquare className="w-4 h-4" />;
      case 'issue': return <AlertTriangle className="w-4 h-4" />;
      case 'site_visit': return <MapPin className="w-4 h-4" />;
      case 'calendar_event': return <Calendar className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'rfi': return 'RFI';
      case 'issue': return 'Issue';
      case 'site_visit': return 'Site Visit';
      case 'calendar_event': return 'Event';
      default: return type;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical':
      case 'Urgent':
        return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', led: 'red' };
      case 'High':
        return { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', led: 'amber' };
      case 'Warning':
      case 'Medium':
        return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', led: 'amber' };
      case 'Low':
      case 'Info':
        return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', led: 'emerald' };
      default:
        return { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30', led: 'emerald' };
    }
  };

  const getPriorityValue = (priority: string): number => {
    switch (priority) {
      case 'Critical':
      case 'Urgent': return 4;
      case 'High': return 3;
      case 'Warning':
      case 'Medium': return 2;
      case 'Low':
      case 'Info': return 1;
      default: return 0;
    }
  };

  const getProjectStatus = (project: Project) => {
    if (project.status === ProjectStatus.COMPLIANT) {
      return { label: 'COMPLIANT', color: 'emerald', voltage: 5 };
    } else if (project.status === ProjectStatus.IN_PROGRESS) {
      return { label: 'IN PROGRESS', color: 'amber', voltage: 3 };
    }
    return { label: 'PENDING', color: 'slate', voltage: 1 };
  };

  const filteredAndSortedItems = useMemo(() => {
    let filtered = openItems;

    if (selectedProject !== 'all') {
      filtered = filtered.filter(item => item.project_id === selectedProject);
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
        if (priorityDiff !== 0) return priorityDiff;
        const dateA = a.due_date || a.created_at;
        const dateB = b.due_date || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      } else {
        const dateA = a.due_date || a.created_at;
        const dateB = b.due_date || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
    });

    return sorted;
  }, [openItems, selectedProject, selectedType, sortBy]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div
        className={`flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 transform transition-all duration-700 ${
          mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        }`}
      >
        <div>
          <div className="flex items-center gap-2 mb-2">
            <StatusLED active />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Control Terminal</span>
          </div>
          <h2 className="text-2xl font-semibold text-white">Welcome back, {getUserName()}</h2>
          <p className="text-slate-400 mt-1">
            You have <span className="font-medium text-amber-400">{projects.length} active projects</span> requiring NEC compliance review.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectExportImportCompact
            onImportSuccess={(projectId) => navigate(`/project/${projectId}`)}
          />
          <button
            onClick={createNewProject}
            className="group bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 px-5 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/30 hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Project</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <div
          className={`transform transition-all duration-700 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-12 text-center">
            <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center mx-auto mb-6">
              <FolderPlus className="w-10 h-10 text-slate-600" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No projects initialized</h3>
            <p className="text-slate-400 mb-6 max-w-md mx-auto">
              Create your first NEC compliance project to begin electrical design and code validation.
            </p>
            <button
              onClick={createNewProject}
              className="bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2 hover:shadow-lg hover:shadow-amber-500/25 transition-all"
            >
              <Plus className="w-5 h-5" />
              Initialize First Project
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`transform transition-all duration-700 delay-100 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <SectionHeader label="Module 01" title="Active Projects" count={projects.length} />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {projects.map((project, index) => {
              const openIssues = project.issues.filter(i => i.status === 'Open').length;
              const criticalIssues = project.issues.filter(i => i.status === 'Open' && i.severity === 'Critical').length;
              const status = getProjectStatus(project);

              return (
                <div
                  key={project.id}
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="group relative bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden cursor-pointer transition-all duration-300 hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-400/5"
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  {/* Card header bar */}
                  <div className="h-10 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                      <StatusLED active color={status.color as any} />
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{status.label}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <VoltageBar level={status.voltage} />
                      {/* Delete button */}
                      <button
                        onClick={(e) => handleDeleteClick(e, project.id)}
                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-950/30 rounded transition-all opacity-0 group-hover:opacity-100"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card content */}
                  <div className="p-5">
                    {/* Tags */}
                    <div className="flex gap-2 mb-3">
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded uppercase tracking-wider">
                        {project.type}
                      </span>
                      <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded uppercase tracking-wider">
                        NEC {project.necEdition}
                      </span>
                    </div>

                    {/* Project name */}
                    <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">
                      {project.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4 truncate">{project.address}</p>

                    {/* Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="text-slate-500 font-mono uppercase tracking-wider">Compliance</span>
                        <span className="text-amber-400 font-mono">{project.progress}%</span>
                      </div>
                      <CircuitProgressBar progress={project.progress} />
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                      <div className="flex gap-6">
                        <div className="text-center">
                          <span className="block text-lg font-bold text-white font-mono">{project.loads.length}</span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Loads</span>
                        </div>
                        <div className={`text-center ${criticalIssues > 0 ? 'text-red-400' : ''}`}>
                          <span className="block text-lg font-bold font-mono flex items-center justify-center gap-1">
                            {openIssues}
                            {criticalIssues > 0 && <AlertTriangle className="w-3 h-3 text-red-400" />}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Issues</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-amber-400 text-sm font-medium group-hover:translate-x-1 transition-transform">
                        <span className="hidden sm:inline">Open</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Hover glow effect */}
                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Open Items Section */}
      {!loadingOpenItems && openItems.length > 0 && (
        <div
          className={`transform transition-all duration-700 delay-200 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <SectionHeader label="Module 02" title="Open Tickets" count={filteredAndSortedItems.length} />

          <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
            {/* Panel header */}
            <div className="h-12 bg-slate-800/30 border-b border-slate-700/50 flex items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  {filteredAndSortedItems.length} of {openItems.length} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <StatusLED active color="amber" />
                <span className="text-[10px] font-mono text-slate-600">MONITORING</span>
              </div>
            </div>

            {/* Filters */}
            <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3">
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400/50 transition-colors font-mono"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400/50 transition-colors font-mono"
              >
                <option value="all">All Types</option>
                <option value="rfi">RFIs</option>
                <option value="issue">Issues</option>
                <option value="site_visit">Site Visits</option>
                <option value="calendar_event">Events</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-400/50 transition-colors font-mono"
              >
                <option value="priority">Sort: Priority</option>
                <option value="date">Sort: Date</option>
              </select>

              {(selectedProject !== 'all' || selectedType !== 'all' || sortBy !== 'priority') && (
                <button
                  onClick={() => {
                    setSelectedProject('all');
                    setSelectedType('all');
                    setSortBy('priority');
                  }}
                  className="px-3 py-2 text-sm text-slate-500 hover:text-amber-400 transition-colors font-mono uppercase tracking-wider"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Items List */}
            {filteredAndSortedItems.length > 0 ? (
              <div className="divide-y divide-slate-800/50">
                {filteredAndSortedItems.map((item, index) => {
                  const priority = getPriorityColor(item.priority);
                  return (
                    <div
                      key={`${item.type}-${item.id}`}
                      onClick={() => navigate(item.url)}
                      className="group flex items-start gap-4 p-4 hover:bg-slate-800/30 cursor-pointer transition-colors"
                    >
                      {/* Index number */}
                      <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-mono text-slate-500">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                      </div>

                      {/* Priority LED */}
                      <div className={`p-2 rounded ${priority.bg} flex-shrink-0`}>
                        {getItemTypeIcon(item.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${priority.bg} ${priority.text}`}>
                            {item.priority}
                          </span>
                          <span className="text-xs font-mono text-slate-600 bg-slate-800 px-2 py-0.5 rounded">
                            {getItemTypeLabel(item.type)}
                          </span>
                          <span className="text-xs text-slate-600 truncate">{item.project_name}</span>
                        </div>
                        <p className="font-medium text-white truncate group-hover:text-amber-400 transition-colors">
                          {item.title}
                        </p>
                        <p className="text-sm text-slate-500 truncate mt-0.5">{item.description}</p>
                        {item.due_date && (
                          <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(item.due_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <p className="text-slate-500 font-mono">No items match current filters</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <WelcomeModal
          onClose={handleCloseWelcome}
          onCreateProject={handleCreateFromTemplate}
        />
      )}
    </div>
  );
};
