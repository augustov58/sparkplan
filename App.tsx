
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LoadCalculator } from './components/LoadCalculator';
import { OneLineDiagram } from './components/OneLineDiagram';
import { DiagramOnlyView } from './components/DiagramOnlyView';
import { GroundingBonding } from './components/GroundingBonding';
import { PanelSchedule } from './components/PanelSchedule';
import { PreInspection } from './components/PreInspection';
import { LandingPage } from './components/LandingPage';
import { ProjectSetup } from './components/ProjectSetup';
import { Calculators } from './components/Calculators';
import { IssuesLog } from './components/IssuesLog';
import { MaterialTakeOff } from './components/MaterialTakeOff';
import { FeederManager } from './components/FeederManager';
import { DwellingLoadCalculator } from './components/DwellingLoadCalculator';
import { CommercialLoadCalculator } from './components/CommercialLoadCalculator';
import { InspectorMode } from './components/InspectorMode';
import { PermitPacketGenerator } from './components/PermitPacketGenerator';
import { ShortCircuitResults } from './components/ShortCircuitResults';
import { RFIManager } from './components/RFIManager';
import { SiteVisitManager } from './components/SiteVisitManager';
import { CalendarView } from './components/CalendarView';
import { AgentActivityLog } from './components/AgentActivityLog';
import { UtilityInterconnectionForm } from './components/UtilityInterconnectionForm';
import { EVPanelTemplates } from './components/EVPanelTemplates';
import { Project, ProjectStatus, ProjectType } from './types';
import { askNecAssistant } from './services/geminiService';
import { buildProjectContext, formatContextForAI } from './services/ai/projectContextBuilder';
import { usePanels } from './hooks/usePanels';
import { useCircuits } from './hooks/useCircuits';
import { useFeeders } from './hooks/useFeeders';
import { useTransformers } from './hooks/useTransformers';
import { Send, MessageSquare, Info, Copy, Check, Bot, User, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { nanoid } from 'nanoid';
import { useAuthContext } from './components/Auth/AuthProvider';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { useProjects } from './hooks/useProjects';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary';
import { TemplateSelector } from './components/TemplateSelector';
import type { ProjectTemplate } from './data/project-templates';

// Note: Mock data removed - now using Supabase database

// Wrapper component to fetch data for Utility Interconnection Form
const UtilityInterconnectionWrapper = ({ project }: { project: Project }) => {
    const { panels } = usePanels(project.id);
    const { circuits } = useCircuits(project.id);
    const { transformers } = useTransformers(project.id);

    return (
        <UtilityInterconnectionForm
            project={project}
            panels={panels}
            circuits={circuits}
            transformers={transformers}
        />
    );
};

const ProjectWrapper = ({ projects, updateProject, deleteProject, onSignOut }: { projects: Project[], updateProject: (p: Project) => void, deleteProject: (id: string) => void, onSignOut: () => void }) => {
    const { id } = useParams();
    const project = projects.find(p => p.id === id);

    if (!project) return <Navigate to="/" />;

    return (
        <Layout title={project.name} showBack onSignOut={onSignOut} projectType={project.type}>
            <Routes>
                <Route path="/" element={
                    <FeatureErrorBoundary>
                        <ProjectSetup project={project} updateProject={updateProject} deleteProject={deleteProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/load-calc" element={
                    <FeatureErrorBoundary>
                        {/* Residential projects use DwellingLoadCalculator, Commercial/Industrial use CommercialLoadCalculator */}
                        {project.type === ProjectType.RESIDENTIAL ? (
                            <DwellingLoadCalculator project={project} updateProject={updateProject} />
                        ) : project.type === ProjectType.COMMERCIAL || project.type === ProjectType.INDUSTRIAL ? (
                            <CommercialLoadCalculator projectId={project.id} />
                        ) : (
                            <LoadCalculator project={project} updateProject={updateProject} />
                        )}
                    </FeatureErrorBoundary>
                } />
                <Route path="/circuits" element={
                    <FeatureErrorBoundary>
                        <OneLineDiagram project={project} updateProject={updateProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/diagram" element={
                    <FeatureErrorBoundary>
                        <OneLineDiagram project={project} updateProject={updateProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/tools" element={
                    <FeatureErrorBoundary>
                        <Calculators projectId={project.id} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/utility-interconnection" element={
                    <FeatureErrorBoundary>
                        <UtilityInterconnectionWrapper project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/ev-templates" element={
                    <FeatureErrorBoundary>
                        <EVPanelTemplates project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/grounding" element={
                    <FeatureErrorBoundary>
                        <GroundingBonding project={project} updateProject={updateProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/panel" element={
                    <FeatureErrorBoundary>
                        <PanelSchedule project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/issues" element={
                    <FeatureErrorBoundary>
                        <IssuesLog project={project} updateProject={updateProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/rfis" element={
                    <FeatureErrorBoundary>
                        <RFIManager project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/site-visits" element={
                    <FeatureErrorBoundary>
                        <SiteVisitManager project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/calendar" element={
                    <FeatureErrorBoundary>
                        <CalendarView project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/check" element={
                    <FeatureErrorBoundary>
                        <PreInspection project={project} updateProject={updateProject} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/inspector" element={
                    <FeatureErrorBoundary>
                        <InspectorMode
                            projectId={project.id}
                            projectType={project.type}
                            serviceVoltage={project.serviceVoltage}
                            servicePhase={project.servicePhase}
                        />
                    </FeatureErrorBoundary>
                } />
                {/* Activity log merged into Inspector Mode - route kept for backwards compatibility */}
                <Route path="/activity-log" element={
                    <Navigate to={`/project/${project.id}/inspector`} replace />
                } />
                <Route path="/materials" element={
                    <FeatureErrorBoundary>
                        <MaterialTakeOff project={project} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/feeders" element={
                    <FeatureErrorBoundary>
                        <FeederManager
                            projectId={project.id}
                            projectVoltage={project.serviceVoltage}
                            projectPhase={project.servicePhase}
                        />
                    </FeatureErrorBoundary>
                } />
                <Route path="/permit-packet" element={
                    <FeatureErrorBoundary>
                        <PermitPacketGenerator projectId={project.id} />
                    </FeatureErrorBoundary>
                } />
                <Route path="/short-circuit" element={
                    <FeatureErrorBoundary>
                        <ShortCircuitResults />
                    </FeatureErrorBoundary>
                } />
            </Routes>
        </Layout>
    );
};

interface Message {
    role: 'user' | 'ai';
    text: string;
    timestamp: Date;
}

const NecAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const messagesEndRef = React.useRef<HTMLDivElement>(null);
    const location = useLocation();
    
    // Detect project context from URL
    const projectMatch = location.pathname.match(/\/project\/([^/]+)/);
    const projectId = projectMatch ? projectMatch[1] : undefined;
    
    // Fetch project data if in project context
    const { panels } = usePanels(projectId);
    const { circuits } = useCircuits(projectId);
    const { feeders } = useFeeders(projectId);
    const { transformers } = useTransformers(projectId);
    
    // Get project info from projects list (if available)
    const { projects } = useProjects();
    const currentProject = projectId ? projects.find(p => p.id === projectId) : undefined;
    
    // Build context if in project
    const hasContext = projectId && currentProject && panels.length > 0;
    const projectContext = hasContext && currentProject
        ? buildProjectContext(
            projectId,
            currentProject.name,
            currentProject.type,
            currentProject.serviceVoltage,
            currentProject.servicePhase,
            panels,
            circuits,
            feeders,
            transformers
          )
        : null;

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, loading]);

    // Format timestamp
    const formatTime = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return date.toLocaleDateString();
    };

    // Copy message to clipboard
    const handleCopy = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    // Extract and link NEC article references
    const processNecReferences = (text: string): string => {
        // Pattern: NEC 220.42, Article 250, etc.
        return text.replace(
            /(?:NEC|Article)\s+(\d+(?:\.\d+)?)/gi,
            (match, article) => {
                const articleNum = article.replace(/\./g, '-');
                return `[${match}](https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70&tab=code-chapters)`;
            }
        );
    };

    // Quick action examples
    const quickActions = hasContext ? [
        `Can I use #10 wire for the AC unit on panel ${panels[0]?.name || 'H1'}?`,
        `Is my service sized correctly?`,
        `What size breaker for circuit 5 on panel ${panels[0]?.name || 'H1'}?`,
        `Describe my riser diagram configuration`
    ] : [
        'What is NEC 220.42 demand factor?',
        'How do I size a grounding electrode conductor?',
        'What are the requirements for EV charging circuits?',
        'Explain NEC Article 250 grounding requirements'
    ];

    const handleAsk = async (question?: string) => {
        const q = question || query.trim();
        if (!q) return;
        
        setQuery('');
        setHistory(prev => [...prev, { role: 'user', text: q, timestamp: new Date() }]);
        setLoading(true);
        
        // Build context string if available
        const contextString = projectContext 
            ? formatContextForAI(projectContext)
            : undefined;
        
        const ans = await askNecAssistant(q, contextString);
        setLoading(false);
        setHistory(prev => [...prev, { role: 'ai', text: ans || 'Sorry, I could not retrieve that information.', timestamp: new Date() }]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className={`bg-white border border-gray-200 shadow-2xl rounded-lg mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 transition-all ${
                    isEnlarged ? 'w-[600px] h-[700px]' : 'w-96 h-[500px]'
                }`}>
                    {/* Header */}
                    <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white p-4 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-electric-500"/>
                            <span className="font-medium">NEC Copilot</span>
                            {hasContext && (
                                <span className="text-xs bg-electric-500 text-black px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                    <Info className="w-3 h-3" />
                                    Project Context
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsEnlarged(!isEnlarged)}
                                className="text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-gray-700"
                                aria-label={isEnlarged ? "Minimize chat" : "Maximize chat"}
                                title={isEnlarged ? "Minimize" : "Maximize"}
                            >
                                {isEnlarged ? (
                                    <Minimize2 className="w-4 h-4" />
                                ) : (
                                    <Maximize2 className="w-4 h-4" />
                                )}
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)} 
                                className="text-gray-400 hover:text-white transition-colors"
                                aria-label="Close chat"
                            >
                                ×
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {history.length === 0 && (
                            <div className="text-center text-gray-500 text-sm mt-8">
                                {hasContext ? (
                                    <>
                                        <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium text-gray-700 mb-3">Ask about your project</p>
                                        <div className="space-y-2">
                                            {quickActions.map((action, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAsk(action)}
                                                    className="block w-full text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-electric-500 hover:bg-electric-50 transition-colors text-gray-600"
                                                >
                                                    "{action}"
                                                </button>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-400 mt-4">Or type your own question</p>
                                    </>
                                ) : (
                                    <>
                                        <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p className="font-medium text-gray-700 mb-3">Ask any NEC question</p>
                                        <div className="space-y-2">
                                            {quickActions.map((action, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleAsk(action)}
                                                    className="block w-full text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-electric-500 hover:bg-electric-50 transition-colors text-gray-600"
                                                >
                                                    "{action}"
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {history.map((msg, idx) => (
                            <div 
                                key={idx} 
                                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'ai' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-electric-400 to-electric-600 flex items-center justify-center mt-1">
                                        <Bot className="w-4 h-4 text-black" />
                                    </div>
                                )}
                                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`group relative rounded-lg p-3 text-sm ${
                                        msg.role === 'user' 
                                        ? 'bg-gradient-to-br from-electric-400 to-electric-500 text-black' 
                                        : 'bg-white border border-gray-200 text-gray-700 shadow-sm'
                                    }`}>
                                        {msg.role === 'ai' ? (
                                            <div className="prose prose-sm max-w-none">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({node, ...props}) => (
                                                            <a {...props} target="_blank" rel="noopener noreferrer" className="text-electric-600 hover:text-electric-700 underline" />
                                                        ),
                                                        code: ({node, ...props}) => (
                                                            <code {...props} className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono" />
                                                        ),
                                                        pre: ({node, ...props}) => (
                                                            <pre {...props} className="bg-gray-100 p-2 rounded text-xs overflow-x-auto" />
                                                        ),
                                                        ul: ({node, ...props}) => (
                                                            <ul {...props} className="list-disc list-inside space-y-1 my-2" />
                                                        ),
                                                        ol: ({node, ...props}) => (
                                                            <ol {...props} className="list-decimal list-inside space-y-1 my-2" />
                                                        ),
                                                        strong: ({node, ...props}) => (
                                                            <strong {...props} className="font-semibold text-gray-900" />
                                                        ),
                                                    }}
                                                >
                                                    {msg.text}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                        )}
                                        
                                        {/* Copy button - always visible for AI messages */}
                                        {msg.role === 'ai' && (
                                            <button
                                                onClick={() => handleCopy(msg.text, idx)}
                                                className={`absolute top-2 right-2 transition-all bg-gray-100 hover:bg-gray-200 p-1.5 rounded text-gray-600 hover:text-gray-900 ${
                                                    copiedIndex === idx ? 'opacity-100 bg-green-100 hover:bg-green-200' : 'opacity-70 group-hover:opacity-100'
                                                }`}
                                                aria-label="Copy message"
                                                title="Copy message"
                                            >
                                                {copiedIndex === idx ? (
                                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-gray-400 px-1">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                        {msg.role === 'ai' && (
                                            <button
                                                onClick={() => handleCopy(msg.text, idx)}
                                                className="text-xs text-gray-400 hover:text-electric-600 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100"
                                                title="Copy message"
                                            >
                                                <Copy className="w-3 h-3" />
                                                {copiedIndex === idx && <span className="text-green-600">Copied!</span>}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {msg.role === 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mt-1">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}
                        
                        {/* Typing Indicator */}
                        {loading && (
                            <div className="flex gap-2 justify-start">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-electric-400 to-electric-600 flex items-center justify-center">
                                    <Bot className="w-4 h-4 text-black" />
                                </div>
                                <div className="bg-white border border-gray-200 rounded-lg p-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-gray-100">
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20 outline-none transition-all"
                                placeholder="Type your question..."
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleAsk();
                                    }
                                }}
                                disabled={loading}
                            />
                            <button 
                                onClick={() => handleAsk()} 
                                disabled={loading || !query.trim()} 
                                className="bg-gray-900 text-white p-2 rounded-lg hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Send message"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-900 hover:bg-black text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 relative"
                aria-label="Open chat"
            >
                <MessageSquare className="w-6 h-6 text-electric-500" />
                {history.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-electric-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {history.length}
                    </span>
                )}
            </button>
        </div>
    );
};

function AppContent() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuthContext();
  const { projects, createProject, updateProject: updateProjectDB, deleteProject, error: projectsError } = useProjects();

  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

  const createNewProject = async () => {
    // Show template selector instead of creating immediately
    setShowTemplateSelector(true);
  };

  const handleTemplateSelection = async (template: ProjectTemplate | null) => {
    const newProject: Partial<Project> = {
      name: template ? template.name : `New Project ${projects.length + 1}`,
      address: 'TBD',
      type: template ? template.type : ProjectType.RESIDENTIAL,
      necEdition: '2023',
      status: ProjectStatus.PLANNING,
      progress: 0,
      serviceVoltage: template ? template.serviceVoltage : 120,
      servicePhase: template ? template.servicePhase : 1,
      settings: {
        serviceVoltage: template ? template.serviceVoltage : 120,
        servicePhase: template ? template.servicePhase : 1,
        conductorMaterial: 'Cu',
        temperatureRating: 75,
        occupancyType: 'dwelling' // Default for new projects
      }
    };

    const created = await createProject(newProject);

    if (created) {
      // If template selected, apply it
      if (template) {
        try {
          const { applyTemplate } = await import('./services/templateService');
          await applyTemplate(created.id, template);
          console.log('Template applied successfully');
        } catch (error) {
          console.error('Failed to apply template:', error);
          alert('Project created but template application failed. You can add panels manually.');
        }
      }

      // Navigate to new project
      navigate(`/project/${created.id}`);
    }
  };

  const updateProject = async (updated: Project) => {
    await updateProjectDB(updated);
  };

  const handleDeleteProject = async (id: string) => {
    if (confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      await deleteProject(id);
      // Navigate back to dashboard if we're on the deleted project
      if (window.location.hash.includes(id)) {
        navigate('/');
      }
    }
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-electric border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        {/* Landing page - shows only if not authenticated */}
        <Route path="/" element={
          user ? (
            <Layout title="Dashboard" onSignOut={handleSignOut}>
              {projectsError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                  <strong>Error:</strong> {projectsError}
                  <p className="text-sm mt-1">Check browser console for details. Have you set up Supabase?</p>
                </div>
              )}
              <Dashboard projects={projects} createNewProject={createNewProject} deleteProject={handleDeleteProject} />
            </Layout>
          ) : (
            <LandingPage />
          )
        } />

        {/* Global calendar - shows all events across all projects */}
        <Route path="/calendar" element={
          <ProtectedRoute>
            <Layout title="Calendar - All Projects" onSignOut={handleSignOut}>
              <CalendarView />
            </Layout>
          </ProtectedRoute>
        } />

        {/* Authentication routes */}
        <Route path="/login" element={
          user ? <Navigate to="/" replace /> : <Login onSuccess={() => {}} />
        } />
        <Route path="/signup" element={
          user ? <Navigate to="/" replace /> : <Signup onSuccess={() => {}} />
        } />

        {/* Protected project routes */}
        <Route path="/project/:id/*" element={
          <ProtectedRoute>
            <ProjectWrapper
              projects={projects}
              updateProject={updateProject}
              deleteProject={handleDeleteProject}
              onSignOut={handleSignOut}
            />
          </ProtectedRoute>
        } />
      </Routes>

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelection}
      />

      {user && <NecAssistant />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  );
}
