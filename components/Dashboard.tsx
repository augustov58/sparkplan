
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project, ProjectStatus } from '../types';
import { Plus, ChevronRight, AlertCircle, CheckCircle2, Clock, AlertTriangle, Trash2, MessageSquare, MapPin, Calendar, FileText, Filter, FolderPlus, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useAllOpenItems } from '../hooks/useAllOpenItems';
import { WelcomeModal } from './WelcomeModal';
import { EmptyState } from './LoadingSpinner';
import { ProjectExportImportCompact } from './ProjectExportImport';
import { TemplateType, createProjectFromTemplate } from '../services/sampleTemplates';
import { useProjects } from '../hooks/useProjects';
import { supabase } from '../lib/supabase';

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

  // Filter and sort state
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'priority'>('priority');

  // Welcome modal state
  const [showWelcome, setShowWelcome] = useState(false);

  // Show welcome modal for new users (no projects + hasn't dismissed it before)
  useEffect(() => {
    if (projects.length === 0 && !localStorage.getItem('welcomeModalDismissed')) {
      setShowWelcome(true);
    }
  }, [projects.length]);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('welcomeModalDismissed', 'true');
  };

  // Handle template-based project creation from WelcomeModal
  const handleCreateFromTemplate = async (templateType?: TemplateType) => {
    if (!user) return;

    if (templateType) {
      // Create project from sample template
      const { project: templateProject, panels: templatePanels } = createProjectFromTemplate(templateType, user.id);
      const newProject = await createProject(templateProject);

      if (newProject) {
        // Create panels for the project
        if (templatePanels.length > 0) {
          try {
            const { error } = await supabase
              .from('panels')
              .insert(templatePanels);

            if (error) {
              console.error('Error creating template panels:', error);
            }
          } catch (err) {
            console.error('Failed to create panels:', err);
          }
        }

        // Navigate to the new project
        navigate(`/project/${newProject.id}`);
      }
    } else {
      // Fall back to standard project creation
      createNewProject();
    }
  };

  // Get user's display name from metadata or email
  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    if (user?.email) {
      // Extract first part of email before @
      return user.email.split('@')[0];
    }
    return 'there';
  };

  const handleDeleteClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent navigation to project
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
        return 'bg-red-100 text-red-700 border-red-200';
      case 'High':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Warning':
      case 'Medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'Low':
      case 'Info':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getPriorityValue = (priority: string): number => {
    switch (priority) {
      case 'Critical':
      case 'Urgent':
        return 4;
      case 'High':
        return 3;
      case 'Warning':
      case 'Medium':
        return 2;
      case 'Low':
      case 'Info':
        return 1;
      default:
        return 0;
    }
  };

  // Filter and sort open items
  const filteredAndSortedItems = useMemo(() => {
    let filtered = openItems;

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(item => item.project_id === selectedProject);
    }

    // Filter by type
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType);
    }

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'priority') {
        // Sort by priority first, then by date
        const priorityDiff = getPriorityValue(b.priority) - getPriorityValue(a.priority);
        if (priorityDiff !== 0) return priorityDiff;

        // If same priority, sort by date
        const dateA = a.due_date || a.created_at;
        const dateB = b.due_date || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      } else {
        // Sort by date
        const dateA = a.due_date || a.created_at;
        const dateB = b.due_date || b.created_at;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      }
    });

    return sorted;
  }, [openItems, selectedProject, selectedType, sortBy]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Welcome back, {getUserName()}</h2>
          <p className="text-gray-500 mt-1">You have <span className="font-medium text-electric-600">{projects.length} active projects</span> requiring NEC compliance review.</p>
        </div>
        <div className="flex items-center gap-3">
          <ProjectExportImportCompact
            onImportSuccess={(projectId, projectName) => {
              navigate(`/project/${projectId}`);
            }}
          />
          <button
            onClick={createNewProject}
            className="bg-electric-400 hover:bg-electric-500 text-black px-6 py-3 rounded-md font-medium flex items-center gap-2 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Create New NEC Project
          </button>
        </div>
      </div>

      {/* Project Cards */}
      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderPlus className="w-16 h-16" />}
          title="No projects yet"
          description="Create your first NEC compliance project to get started with electrical design and code validation."
          action={{
            label: "Create First Project",
            onClick: createNewProject
          }}
        />
      ) : (
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

                {/* Delete button */}
                <button
                  onClick={(e) => handleDeleteClick(e, project.id)}
                  className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

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
      )}

      {/* Open Items Section (Below Project Cards) */}
      {!loadingOpenItems && openItems.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-lg p-6">
          {/* Header with Filters */}
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                  <Filter className="w-5 h-5 text-electric-500" />
                  Open Items Across All Projects
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredAndSortedItems.length} of {openItems.length} {filteredAndSortedItems.length === 1 ? 'item' : 'items'} shown
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              {/* Project Filter */}
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white hover:border-electric-400 transition-colors focus:outline-none focus:ring-2 focus:ring-electric-400"
              >
                <option value="all">All Projects</option>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white hover:border-electric-400 transition-colors focus:outline-none focus:ring-2 focus:ring-electric-400"
              >
                <option value="all">All Types</option>
                <option value="rfi">RFIs</option>
                <option value="issue">Issues</option>
                <option value="site_visit">Site Visits</option>
                <option value="calendar_event">Calendar Events</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'priority')}
                className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white hover:border-electric-400 transition-colors focus:outline-none focus:ring-2 focus:ring-electric-400"
              >
                <option value="priority">Sort by Priority</option>
                <option value="date">Sort by Date</option>
              </select>

              {/* Clear Filters */}
              {(selectedProject !== 'all' || selectedType !== 'all' || sortBy !== 'priority') && (
                <button
                  onClick={() => {
                    setSelectedProject('all');
                    setSelectedType('all');
                    setSortBy('priority');
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-electric-600 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Items List */}
          {filteredAndSortedItems.length > 0 ? (
            <div className="space-y-2">
              {filteredAndSortedItems.map(item => (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => navigate(item.url)}
                  className="group flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-electric-400 hover:bg-electric-50 cursor-pointer transition-all"
                >
                  <div className={`p-2 rounded ${getPriorityColor(item.priority)}`}>
                    {getItemTypeIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {getItemTypeLabel(item.type)}
                      </span>
                      <span className="text-xs text-gray-500">{item.project_name}</span>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                      {item.status && (
                        <span className="text-xs text-gray-400">{item.status}</span>
                      )}
                    </div>
                    <p className="font-medium text-sm text-gray-900 truncate group-hover:text-electric-700 transition-colors">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-600 truncate mt-0.5">{item.description}</p>
                    {item.due_date && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {new Date(item.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-electric-600 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No items match the selected filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Welcome Modal for New Users */}
      {showWelcome && (
        <WelcomeModal
          onClose={handleCloseWelcome}
          onCreateProject={handleCreateFromTemplate}
        />
      )}
    </div>
  );
};
