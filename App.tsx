
import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ProjectSetup } from './components/ProjectSetup';
import { LandingPage } from './components/LandingPage';
import { LoadingSpinner } from './components/LoadingSpinner';

// Lazy load heavy components for better performance
const LoadCalculator = lazy(() => import('./components/LoadCalculator').then(m => ({ default: m.LoadCalculator })));
const OneLineDiagram = lazy(() => import('./components/OneLineDiagram').then(m => ({ default: m.OneLineDiagram })));
const DiagramOnlyView = lazy(() => import('./components/DiagramOnlyView').then(m => ({ default: m.DiagramOnlyView })));
const GroundingBonding = lazy(() => import('./components/GroundingBonding').then(m => ({ default: m.GroundingBonding })));
const PanelSchedule = lazy(() => import('./components/PanelSchedule').then(m => ({ default: m.PanelSchedule })));
const PreInspection = lazy(() => import('./components/PreInspection').then(m => ({ default: m.PreInspection })));
const Calculators = lazy(() => import('./components/Calculators').then(m => ({ default: m.Calculators })));
const MaterialTakeOff = lazy(() => import('./components/MaterialTakeOff').then(m => ({ default: m.MaterialTakeOff })));
const FeederManager = lazy(() => import('./components/FeederManager').then(m => ({ default: m.FeederManager })));
const DwellingLoadCalculator = lazy(() => import('./components/DwellingLoadCalculator').then(m => ({ default: m.DwellingLoadCalculator })));
const CommercialLoadCalculator = lazy(() => import('./components/CommercialLoadCalculator').then(m => ({ default: m.CommercialLoadCalculator })));
const InspectorMode = lazy(() => import('./components/InspectorMode').then(m => ({ default: m.InspectorMode })));
const PermitPacketGenerator = lazy(() => import('./components/PermitPacketGenerator').then(m => ({ default: m.PermitPacketGenerator })));
const ShortCircuitResults = lazy(() => import('./components/ShortCircuitResults').then(m => ({ default: m.ShortCircuitResults })));
const RFIManager = lazy(() => import('./components/RFIManager').then(m => ({ default: m.RFIManager })));
const SiteVisitManager = lazy(() => import('./components/SiteVisitManager').then(m => ({ default: m.SiteVisitManager })));
const CalendarView = lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const EstimatingPage = lazy(() => import('./components/Estimating/EstimatingPage').then(m => ({ default: m.EstimatingPage })));
const PermitsPage = lazy(() => import('./components/Permits/PermitsPage').then(m => ({ default: m.PermitsPage })));
const BillingPage = lazy(() => import('./components/Billing/BillingPage').then(m => ({ default: m.BillingPage })));
const AgentActivityLog = lazy(() => import('./components/AgentActivityLog').then(m => ({ default: m.AgentActivityLog })));
const UtilityInterconnectionForm = lazy(() => import('./components/UtilityInterconnectionForm').then(m => ({ default: m.UtilityInterconnectionForm })));
const PricingPage = lazy(() => import('./components/PricingPage').then(m => ({ default: m.PricingPage })));
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const UserProfile = lazy(() => import('./components/UserProfile').then(m => ({ default: m.UserProfile })));
// EVPanelTemplates moved to Calculators component
import { Project, ProjectStatus, ProjectType } from './types';
import { askNecAssistantWithTools, applyConfirmedAction } from './services/geminiService';
import { buildProjectContext, formatContextForAI, type ProjectContext } from './services/ai/projectContextBuilder';
import { buildConversationHistory } from './services/ai/conversationBuilder';
import { usePanels } from './hooks/usePanels';
import { useCircuits } from './hooks/useCircuits';
import { useFeeders } from './hooks/useFeeders';
import { useTransformers } from './hooks/useTransformers';
import { useShortCircuitCalculations } from './hooks/useShortCircuitCalculations';
import { Send, MessageSquare, Info, Copy, Check, User, Sparkles, Maximize2, Minimize2, Trash2, Square, RotateCw, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { nanoid } from 'nanoid';
import { useAuthContext } from './components/Auth/AuthProvider';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { useProjects } from './hooks/useProjects';
import { ErrorBoundary, FeatureErrorBoundary } from './components/ErrorBoundary';
import { FeatureGate } from './components/FeatureGate';
import { useSubscription } from './hooks/useSubscription';
import { TemplateSelector } from './components/TemplateSelector';
import type { ProjectTemplate } from './data/project-templates';
import { Toaster } from 'react-hot-toast';
import { TemplateType, createProjectFromTemplate } from './services/sampleTemplates';

const SupportWidget = lazy(() =>
  import('./components/SupportWidget').then((m) => ({ default: m.SupportWidget }))
);

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
                        <FeatureGate feature="dwelling-load-calc" message="NEC load calculations for residential, commercial, and industrial projects. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                {/* Residential projects use DwellingLoadCalculator, Commercial/Industrial use CommercialLoadCalculator */}
                                {project.type === ProjectType.RESIDENTIAL ? (
                                    <DwellingLoadCalculator project={project} updateProject={updateProject} />
                                ) : project.type === ProjectType.COMMERCIAL || project.type === ProjectType.INDUSTRIAL ? (
                                    <CommercialLoadCalculator projectId={project.id} project={project} />
                                ) : (
                                    <LoadCalculator project={project} updateProject={updateProject} />
                                )}
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/circuits" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="circuit-design" message="Design branch circuits with NEC-compliant sizing and wire selection. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <OneLineDiagram project={project} updateProject={updateProject} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/diagram" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="one-line-diagram" message="Generate professional one-line diagrams for your electrical system. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <OneLineDiagram project={project} updateProject={updateProject} diagramOnly={true} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/tools" element={
                    <FeatureErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                            <Calculators projectId={project.id} />
                        </Suspense>
                    </FeatureErrorBoundary>
                } />
                {/* COMING SOON: Utility Interconnection (Phase 2 - EV Niche) */}
                {/* <Route path="/utility-interconnection" element={
                    <FeatureErrorBoundary>
                        <UtilityInterconnectionWrapper project={project} />
                    </FeatureErrorBoundary>
                } /> */}
                {/* EV Panel Builder moved to Tools & Calculators tab */}
                {/* <Route path="/ev-templates" element={
                    <FeatureErrorBoundary>
                        <EVPanelTemplates project={project} />
                    </FeatureErrorBoundary>
                } /> */}
                <Route path="/grounding" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="grounding-calc" message="Design NEC Article 250 compliant grounding systems. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <GroundingBonding project={project} updateProject={updateProject} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/panel" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="panel-schedules" message="Create professional panel schedules with automatic load balancing. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <PanelSchedule project={project} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                {/* /issues legacy route — redirect into the Permits tabs.
                    Bookmarks that still point at /project/:id/issues land on
                    /project/:id/permits?tab=issues which renders the same
                    IssuesLog UI inside the new tabbed Permits page. */}
                <Route path="/issues" element={
                    <Navigate to={`/project/${project.id}/permits?tab=issues`} replace />
                } />
                <Route path="/rfis" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="rfi-tracking" message="Manage Requests for Information (RFIs) with AI-powered PDF extraction. Available in Business plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <RFIManager project={project} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/site-visits" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="site-visits" message="Log site visits with photo uploads and field observations. Available in Business plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <SiteVisitManager project={project} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/calendar" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="project-calendar" message="Track project milestones, inspections, and deadlines with the Project Calendar. Available in Business plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <CalendarView project={project} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/estimating" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="estimating" message="Generate electrical takeoffs and bid pricing tied to your panel/circuit model. Available on the Business plan — preview free during your trial.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <EstimatingPage project={project} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/permits" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="permits" message="Track the full permit + inspection lifecycle: submission, AHJ review, approval, inspection scheduling, results, corrections. Available on the Business plan — preview free during your trial.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <PermitsPage project={project} updateProject={updateProject} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/billing" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="tm-billing" message="Time & materials billing with phases, change orders, and AIA pay applications for commercial electrical subcontractors. Available on the Business plan — preview free during your trial.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <BillingPage projectId={project.id} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/check" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="pre-inspection-check" message="Pre-inspection checklists help you prepare for inspections with AI-powered analysis.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <PreInspection project={project} updateProject={updateProject} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/inspector" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="ai-inspector" message="AI Inspector Mode uses advanced AI to analyze your project and identify potential code violations before inspection.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <InspectorMode
                                    projectId={project.id}
                                    projectType={project.type}
                                    serviceVoltage={project.serviceVoltage}
                                    servicePhase={project.servicePhase}
                                />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                {/* Activity log merged into Inspector Mode - route kept for backwards compatibility */}
                <Route path="/activity-log" element={
                    <Navigate to={`/project/${project.id}/inspector`} replace />
                } />
                <Route path="/materials" element={
                    <FeatureErrorBoundary>
                        <Suspense fallback={<LoadingSpinner />}>
                            <MaterialTakeOff project={project} />
                        </Suspense>
                    </FeatureErrorBoundary>
                } />
                <Route path="/feeders" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="feeder-sizing" message="Design and size feeder cables between panels with NEC compliance. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <FeederManager
                                    projectId={project.id}
                                    projectVoltage={project.serviceVoltage}
                                    projectPhase={project.servicePhase}
                                />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/permit-packet" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="permit-packet" message="Generate complete permit packages with all required documentation. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <PermitPacketGenerator projectId={project.id} />
                            </Suspense>
                        </FeatureGate>
                    </FeatureErrorBoundary>
                } />
                <Route path="/short-circuit" element={
                    <FeatureErrorBoundary>
                        <FeatureGate feature="short-circuit-basic" message="Calculate available fault current per NEC 110.9 requirements. Available in Starter plan.">
                            <Suspense fallback={<LoadingSpinner />}>
                                <ShortCircuitResults />
                            </Suspense>
                        </FeatureGate>
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
    toolUsed?: {
        name: string;
        result: unknown;
    };
    pendingAction?: {
        toolName: string;
        params: Record<string, unknown>;
    };
    actionResolved?: 'applied' | 'cancelled';
}

const COPILOT_STORAGE_PREFIX = 'sparkplan.copilot.history';
const copilotStorageKey = (projectId?: string) => `${COPILOT_STORAGE_PREFIX}.${projectId || 'global'}`;

const loadCopilotHistory = (projectId?: string): Message[] => {
    try {
        const raw = localStorage.getItem(copilotStorageKey(projectId));
        if (!raw) return [];
        const parsed = JSON.parse(raw) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>;
        return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp) }));
    } catch {
        return [];
    }
};

const saveCopilotHistory = (projectId: string | undefined, history: Message[]) => {
    try {
        if (history.length === 0) {
            localStorage.removeItem(copilotStorageKey(projectId));
        } else {
            localStorage.setItem(copilotStorageKey(projectId), JSON.stringify(history));
        }
    } catch {
        // storage full or disabled — silently ignore
    }
};

const linkNecReferences = (text: string): string =>
    text.replace(
        /(?:NEC|Article)\s+(\d+(?:\.\d+)?)/gi,
        (match) => `[${match}](https://www.nfpa.org/codes-and-standards/all-codes-and-standards/list-of-codes-and-standards/detail?code=70)`
    );

const NecAssistant = () => {
    const { hasFeature } = useSubscription();
    const navigate = useNavigate();
    const location = useLocation();

    const projectMatch = location.pathname.match(/\/project\/([^/]+)/);
    const projectId = projectMatch ? projectMatch[1] : undefined;

    const [isOpen, setIsOpen] = useState(false);
    const [isEnlarged, setIsEnlarged] = useState(false);
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<Message[]>(() => loadCopilotHistory(projectId));
    const [loading, setLoading] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
    const [expandedToolIdx, setExpandedToolIdx] = useState<number | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [, forceTick] = useState(0);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const generationIdRef = useRef<string | null>(null);

    const { panels } = usePanels(projectId);
    const { circuits } = useCircuits(projectId);
    const { feeders } = useFeeders(projectId);
    const { transformers } = useTransformers(projectId);
    const { calculations: shortCircuitCalculations } = useShortCircuitCalculations(projectId);

    const { projects } = useProjects();
    const currentProject = projectId ? projects.find(p => p.id === projectId) : undefined;

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
            transformers,
            currentProject.settings?.residential,
            undefined, // estimates - not yet wired into Copilot
            undefined, // permits
            undefined, // inspections
            shortCircuitCalculations
          )
        : null;

    useEffect(() => {
        setHistory(loadCopilotHistory(projectId));
        setErrorMessage(null);
    }, [projectId]);

    useEffect(() => {
        saveCopilotHistory(projectId, history);
    }, [history, projectId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [history, loading, errorMessage]);

    useEffect(() => {
        if (!isOpen || history.length === 0) return;
        const id = setInterval(() => forceTick(t => t + 1), 60_000);
        return () => clearInterval(id);
    }, [isOpen, history.length]);

    useEffect(() => {
        if (!isOpen) return;
        const t = setTimeout(() => textareaRef.current?.focus(), 120);
        return () => clearTimeout(t);
    }, [isOpen]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsOpen(v => !v);
                return;
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, [query]);

    if (!hasFeature('ai-copilot')) {
        return (
            <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50">
                <button
                    onClick={() => navigate('/pricing')}
                    className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all relative"
                    aria-label="Spark Copilot (upgrade required)"
                    title="Spark Copilot — Upgrade to unlock"
                >
                    <Sparkles className="w-6 h-6 text-[var(--color-accent-300)]" />
                    <span className="absolute -top-1 -right-1 bg-white text-[var(--color-primary)] rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                        <Lock className="w-3 h-3" />
                    </span>
                </button>
            </div>
        );
    }

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

    const handleCopy = async (text: string, index: number) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleClear = () => {
        if (history.length === 0) return;
        if (!window.confirm('Clear this conversation? This cannot be undone.')) return;
        setHistory([]);
        setErrorMessage(null);
        setExpandedToolIdx(null);
    };

    const handleStop = () => {
        generationIdRef.current = null;
        setLoading(false);
    };

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
        setErrorMessage(null);

        const priorHistory = history;
        const newUserMessage: Message = { role: 'user', text: q, timestamp: new Date() };
        setHistory(prev => [...prev, newUserMessage]);
        setLoading(true);

        const thisGen = nanoid();
        generationIdRef.current = thisGen;

        try {
            const conversationHistory = buildConversationHistory(
                priorHistory.map(m => ({
                    id: nanoid(),
                    role: m.role === 'ai' ? 'assistant' : 'user',
                    content: m.text,
                    timestamp: m.timestamp
                })),
                10
            );
            const isFirstMessage = priorHistory.length === 0;
            const context: ProjectContext = projectContext || {
                projectId: '',
                projectName: 'General',
                projectType: 'Commercial',
                serviceVoltage: 480,
                servicePhase: 3,
                summary: 'No project selected',
                panels: [],
                circuits: [],
                feeders: [],
                transformers: [],
                totalLoad: { connectedVA: 0, demandVA: 0 }
            };

            // B-1: pass raw rows so feeder-related tools can live-derive
            // voltage drop from current circuit data instead of reading the
            // potentially stale `feeder.voltageDropPercent` cache. Falls back
            // to summary-only behavior if `hasContext` is false.
            const result = await askNecAssistantWithTools(
                q,
                conversationHistory,
                context,
                isFirstMessage,
                hasContext
                    ? { panels, circuits, feeders, transformers }
                    : undefined,
            );

            if (generationIdRef.current !== thisGen) return;

            const aiMessage: Message = {
                role: 'ai',
                text: result.response || 'Sorry, I could not retrieve that information.',
                timestamp: new Date(),
                toolUsed: result.toolUsed,
                pendingAction: result.pendingAction,
            };
            setHistory(prev => [...prev, aiMessage]);
        } catch (error: any) {
            if (generationIdRef.current !== thisGen) return;
            console.error('Chat error:', error);
            setErrorMessage(error?.message || 'Something went wrong. Please try again.');
        } finally {
            if (generationIdRef.current === thisGen) {
                setLoading(false);
                generationIdRef.current = null;
            }
        }
    };

    const handleRetry = () => {
        const lastUser = [...history].reverse().find(m => m.role === 'user');
        if (!lastUser) return;
        setHistory(prev => prev.filter((_, i) => !(i === prev.length - 1 && prev[i].role === 'user')));
        setErrorMessage(null);
        handleAsk(lastUser.text);
    };

    const handleApplyAction = async (msgIdx: number) => {
        const msg = history[msgIdx];
        if (!msg?.pendingAction || msg.actionResolved) return;

        const ctx: ProjectContext = projectContext || {
            projectId: '',
            projectName: 'General',
            projectType: 'Commercial',
            serviceVoltage: 480,
            servicePhase: 3,
            summary: 'No project selected',
            panels: [],
            circuits: [],
            feeders: [],
            transformers: [],
            totalLoad: { connectedVA: 0, demandVA: 0 },
        };

        // Mark resolved up-front to disable buttons during async call
        setHistory(prev => prev.map((m, i) => i === msgIdx ? { ...m, actionResolved: 'applied' } : m));
        setLoading(true);
        try {
            const result = await applyConfirmedAction(
                msg.pendingAction.toolName,
                msg.pendingAction.params,
                ctx,
                hasContext ? { panels, circuits, feeders, transformers } : undefined,
            );
            const resultMessage: Message = {
                role: 'ai',
                text: result.response,
                timestamp: new Date(),
                toolUsed: result.toolUsed,
            };
            setHistory(prev => [...prev, resultMessage]);
        } catch (error: any) {
            console.error('Apply action error:', error);
            setErrorMessage(error?.message || 'Action failed.');
            // Revert resolved state so user can retry
            setHistory(prev => prev.map((m, i) => i === msgIdx ? { ...m, actionResolved: undefined } : m));
        } finally {
            setLoading(false);
        }
    };

    const handleCancelAction = (msgIdx: number) => {
        setHistory(prev => prev.map((m, i) => i === msgIdx ? { ...m, actionResolved: 'cancelled' } : m));
    };

    return (
        <div className="fixed bottom-4 right-4 left-4 md:left-auto md:bottom-6 md:right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Spark Copilot"
                    className={`bg-white border border-[var(--color-border)] shadow-2xl rounded-xl mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300 transition-all w-full ${
                        isEnlarged ? 'md:w-[600px] h-[90vh] md:h-[700px]' : 'md:w-96 h-[70vh] md:h-[500px]'
                    }`}
                >
                    {/* Header */}
                    <div className="bg-[var(--color-primary)] text-white px-4 py-3 flex justify-between items-center">
                        <div className="flex items-center gap-2 min-w-0">
                            <Sparkles className="w-4 h-4 text-[var(--color-accent-300)] flex-shrink-0" />
                            <span className="font-serif text-base truncate">Spark Copilot</span>
                            {hasContext && (
                                <span className="text-[10px] uppercase tracking-wider bg-[var(--color-accent-100)] text-[var(--color-accent-700)] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 flex-shrink-0">
                                    <Info className="w-3 h-3" />
                                    Project
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleClear}
                                disabled={history.length === 0}
                                className="text-white/60 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                aria-label="Clear conversation"
                                title="Clear conversation"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setIsEnlarged(!isEnlarged)}
                                className="text-white/60 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
                                aria-label={isEnlarged ? "Minimize chat" : "Maximize chat"}
                                title={isEnlarged ? "Minimize" : "Maximize"}
                            >
                                {isEnlarged ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/60 hover:text-white transition-colors p-1.5 rounded hover:bg-white/10"
                                aria-label="Close chat"
                                title="Close (Esc)"
                            >
                                <span className="text-lg leading-none">×</span>
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div
                        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[var(--color-paper)]"
                        aria-live="polite"
                        aria-busy={loading}
                    >
                        {history.length === 0 && (
                            <div className="text-center text-[var(--color-muted)] text-sm mt-8">
                                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                                    <Sparkles className="w-6 h-6 text-[var(--color-primary)]" />
                                </div>
                                <p className="font-serif text-base text-[var(--color-ink)] mb-3">
                                    {hasContext ? 'Ask about your project' : 'Ask any NEC question'}
                                </p>
                                <div className="space-y-2">
                                    {quickActions.map((action, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleAsk(action)}
                                            className="block w-full text-left text-xs bg-white border border-[var(--color-border)] rounded-lg px-3 py-2 hover:border-[var(--color-primary)] hover:bg-[var(--color-accent-50)] transition-colors text-[var(--color-muted)]"
                                        >
                                            "{action}"
                                        </button>
                                    ))}
                                </div>
                                {hasContext && (
                                    <p className="text-xs text-[var(--color-subtle)] mt-4">Or type your own question</p>
                                )}
                            </div>
                        )}

                        {history.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                {msg.role === 'ai' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-[var(--color-border)] flex items-center justify-center mt-1 shadow-sm">
                                        <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
                                    </div>
                                )}
                                <div className={`flex flex-col max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                    <div className={`group relative rounded-xl p-3 text-sm ${
                                        msg.role === 'user'
                                        ? 'bg-[var(--color-primary)] text-white'
                                        : 'bg-white border border-[var(--color-border)] text-[var(--color-ink)] shadow-sm'
                                    }`}>
                                        {msg.role === 'ai' ? (
                                            <div className="prose prose-sm max-w-none pr-6">
                                                <ReactMarkdown
                                                    remarkPlugins={[remarkGfm]}
                                                    components={{
                                                        a: ({node, ...props}) => (
                                                            <a {...props} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline" />
                                                        ),
                                                        code: ({node, ...props}) => (
                                                            <code {...props} className="bg-[var(--color-border-light)] px-1 py-0.5 rounded text-xs font-mono" />
                                                        ),
                                                        pre: ({node, ...props}) => (
                                                            <pre {...props} className="bg-[var(--color-border-light)] p-2 rounded text-xs overflow-x-auto" />
                                                        ),
                                                        ul: ({node, ...props}) => (
                                                            <ul {...props} className="list-disc list-inside space-y-1 my-2" />
                                                        ),
                                                        ol: ({node, ...props}) => (
                                                            <ol {...props} className="list-decimal list-inside space-y-1 my-2" />
                                                        ),
                                                        strong: ({node, ...props}) => (
                                                            <strong {...props} className="font-semibold text-[var(--color-ink)]" />
                                                        ),
                                                    }}
                                                >
                                                    {linkNecReferences(msg.text)}
                                                </ReactMarkdown>
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.text}</p>
                                        )}

                                        {msg.role === 'ai' && (
                                            <button
                                                onClick={() => handleCopy(msg.text, idx)}
                                                className={`absolute top-2 right-2 transition-all p-1.5 rounded ${
                                                    copiedIndex === idx
                                                        ? 'opacity-100 bg-[var(--color-success-bg)] text-[var(--color-success)]'
                                                        : 'opacity-0 group-hover:opacity-100 bg-[var(--color-border-light)] hover:bg-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                                }`}
                                                aria-label="Copy message"
                                                title="Copy message"
                                            >
                                                {copiedIndex === idx ? (
                                                    <Check className="w-3.5 h-3.5" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-[var(--color-subtle)] px-1">
                                            {formatTime(msg.timestamp)}
                                        </span>
                                        {msg.toolUsed && (
                                            <button
                                                onClick={() => setExpandedToolIdx(expandedToolIdx === idx ? null : idx)}
                                                className="text-xs bg-[var(--color-accent-50)] text-[var(--color-accent-700)] border border-[var(--color-accent-200)] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 hover:bg-[var(--color-accent-100)] transition-colors"
                                                title="Show tool details"
                                            >
                                                <Sparkles className="w-3 h-3" />
                                                {msg.toolUsed.name.replace(/_/g, ' ')}
                                                {expandedToolIdx === idx
                                                    ? <ChevronDown className="w-3 h-3" />
                                                    : <ChevronRight className="w-3 h-3" />}
                                            </button>
                                        )}
                                    </div>
                                    {msg.toolUsed && expandedToolIdx === idx && (
                                        <pre className="mt-1 max-w-full overflow-x-auto text-[10px] bg-white border border-[var(--color-border)] rounded p-2 text-[var(--color-muted)] font-mono">
                                            {JSON.stringify(msg.toolUsed.result, null, 2).slice(0, 2000)}
                                        </pre>
                                    )}
                                    {msg.pendingAction && !msg.actionResolved && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <button
                                                onClick={() => handleApplyAction(idx)}
                                                disabled={loading}
                                                className="text-xs bg-[var(--color-accent-500)] hover:bg-[var(--color-accent-600)] disabled:opacity-50 text-white px-3 py-1.5 rounded-md font-medium transition-colors"
                                            >
                                                Apply
                                            </button>
                                            <button
                                                onClick={() => handleCancelAction(idx)}
                                                disabled={loading}
                                                className="text-xs bg-white hover:bg-[var(--color-border-light)] disabled:opacity-50 border border-[var(--color-border)] text-[var(--color-ink)] px-3 py-1.5 rounded-md font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                    {msg.actionResolved === 'cancelled' && (
                                        <p className="mt-2 text-xs text-[var(--color-muted)] italic">Action cancelled.</p>
                                    )}
                                </div>
                                {msg.role === 'user' && (
                                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary-800)] flex items-center justify-center mt-1">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="flex gap-2 justify-start">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-[var(--color-border)] flex items-center justify-center shadow-sm">
                                    <Sparkles className="w-4 h-4 text-[var(--color-primary)] animate-pulse" />
                                </div>
                                <div className="bg-white border border-[var(--color-border)] rounded-xl p-3">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-[var(--color-primary)]/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-[var(--color-primary)]/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-[var(--color-primary)]/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {errorMessage && !loading && (
                            <div className="flex gap-2 items-start bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 rounded-xl p-3 text-xs">
                                <Info className="w-4 h-4 text-[var(--color-danger)] flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[var(--color-danger)] font-medium">Request failed</p>
                                    <p className="text-[var(--color-muted)] mt-0.5 break-words">{errorMessage}</p>
                                    <button
                                        onClick={handleRetry}
                                        className="mt-2 inline-flex items-center gap-1 text-[var(--color-primary)] font-medium hover:text-[var(--color-primary-hover)]"
                                    >
                                        <RotateCw className="w-3 h-3" /> Retry
                                    </button>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-3 bg-white border-t border-[var(--color-border)]">
                        <div className="flex gap-2 items-end">
                            <textarea
                                ref={textareaRef}
                                rows={1}
                                className="flex-1 border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 outline-none transition-all resize-none bg-white"
                                placeholder="Type your question… (Shift+Enter for newline)"
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
                            {loading ? (
                                <button
                                    onClick={handleStop}
                                    className="bg-[var(--color-danger)] text-white p-2 rounded-lg hover:opacity-90 transition-all"
                                    aria-label="Stop generation"
                                    title="Stop"
                                >
                                    <Square className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAsk()}
                                    disabled={!query.trim()}
                                    className="bg-[var(--color-primary)] text-white p-2 rounded-lg hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    aria-label="Send message"
                                    title="Send (Enter)"
                                >
                                    <Send className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <p className="text-[10px] text-[var(--color-subtle)] mt-1.5 px-1">
                            Press <kbd className="px-1 py-0.5 bg-[var(--color-border-light)] rounded font-mono">⌘K</kbd> / <kbd className="px-1 py-0.5 bg-[var(--color-border-light)] rounded font-mono">Ctrl+K</kbd> to toggle
                        </p>
                    </div>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 relative"
                aria-label={isOpen ? "Close Spark Copilot" : "Open Spark Copilot"}
                title="Spark Copilot (⌘K)"
            >
                <Sparkles className="w-6 h-6 text-[var(--color-accent-300)]" />
                {!isOpen && history.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[var(--color-accent-500)] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
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

  const handleTemplateSelection = async (template: ProjectTemplate | null, projectType?: ProjectType) => {
    // Determine project type: use template type if available, otherwise use the projectType parameter from tab selection, fallback to RESIDENTIAL
    const selectedType = template ? template.type : (projectType || ProjectType.RESIDENTIAL);

    // Set default service parameters based on project type
    const defaultServiceVoltage = selectedType === ProjectType.RESIDENTIAL ? 240 :
                                   selectedType === ProjectType.COMMERCIAL ? 208 : 480;
    const defaultServicePhase = selectedType === ProjectType.RESIDENTIAL ? 1 : 3;

    const newProject: Partial<Project> = {
      name: template ? template.name : `New ${selectedType} Project ${projects.length + 1}`,
      address: 'TBD',
      type: selectedType,
      necEdition: '2023',
      status: ProjectStatus.PLANNING,
      progress: 0,
      serviceVoltage: template ? template.serviceVoltage : defaultServiceVoltage,
      servicePhase: template ? template.servicePhase : defaultServicePhase,
      settings: {
        serviceVoltage: template ? template.serviceVoltage : defaultServiceVoltage,
        servicePhase: template ? template.servicePhase : defaultServicePhase,
        conductorMaterial: 'Cu',
        temperatureRating: 75,
        occupancyType: selectedType === ProjectType.RESIDENTIAL ? 'dwelling' : 'office' // Default based on project type
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

  const handleSampleTemplateSelection = async (templateType: TemplateType) => {
    if (!user) return;

    // Create project from comprehensive sample template
    const { project: templateProject, panels: templatePanels } = createProjectFromTemplate(templateType, user.id);
    const created = await createProject(templateProject);

    if (created) {
      const { supabase } = await import('./lib/supabase');

      // Create loads for the project
      if (templateProject.loads && templateProject.loads.length > 0) {
        try {
          const loadsWithCorrectId = templateProject.loads.map(load => ({
            ...load,
            project_id: created.id, // Use actual database-generated project ID
          }));

          const { error: loadsError } = await supabase
            .from('loads')
            .insert(loadsWithCorrectId);

          if (loadsError) {
            console.error('Error creating template loads:', loadsError);
          }
        } catch (err) {
          console.error('Failed to create loads:', err);
        }
      }

      // Create panels for the project
      if (templatePanels.length > 0) {
        try {
          const panelsWithCorrectId = templatePanels.map(panel => ({
            ...panel,
            project_id: created.id, // Use actual database-generated project ID
          }));

          const { error: panelsError } = await supabase
            .from('panels')
            .insert(panelsWithCorrectId);

          if (panelsError) {
            console.error('Error creating template panels:', panelsError);
          }
        } catch (err) {
          console.error('Failed to create panels:', err);
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
              <Suspense fallback={<LoadingSpinner />}>
                <CalendarView />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        } />

        {/* Pricing page - subscription management */}
        <Route path="/pricing" element={
          <ProtectedRoute>
            <Layout title="Pricing & Plans" onSignOut={handleSignOut}>
              <Suspense fallback={<LoadingSpinner />}>
                <PricingPage />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        } />

        {/* Account Settings */}
        <Route path="/settings" element={
          <ProtectedRoute>
            <Layout title="Account Settings" onSignOut={handleSignOut}>
              <Suspense fallback={<LoadingSpinner />}>
                <UserProfile />
              </Suspense>
            </Layout>
          </ProtectedRoute>
        } />

        {/* Admin panel - restricted to admin email */}
        <Route path="/admin" element={
          <ProtectedRoute>
            {user?.email === 'augustovalbuena@gmail.com' ? (
              <Layout title="Admin Panel" onSignOut={handleSignOut}>
                <Suspense fallback={<LoadingSpinner />}>
                  <AdminPanel />
                </Suspense>
              </Layout>
            ) : (
              <Navigate to="/" replace />
            )}
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
        onSelectSampleTemplate={handleSampleTemplateSelection}
      />

      {user && <NecAssistant />}
      {user && (
        <Suspense fallback={null}>
          <SupportWidget />
        </Suspense>
      )}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 5000,
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  );
}
