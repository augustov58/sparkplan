
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { LoadCalculator } from './components/LoadCalculator';
import { OneLineDiagram } from './components/OneLineDiagram';
import { GroundingBonding } from './components/GroundingBonding';
import { PanelSchedule } from './components/PanelSchedule';
import { PreInspection } from './components/PreInspection';
import { ComplianceReport } from './components/ComplianceReport';
import { LandingPage } from './components/LandingPage';
import { ProjectSetup } from './components/ProjectSetup';
import { Calculators } from './components/Calculators';
import { IssuesLog } from './components/IssuesLog';
import { Project, ProjectStatus, ProjectType } from './types';
import { askNecAssistant } from './services/geminiService';
import { Send, MessageSquare } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useAuthContext } from './components/Auth/AuthProvider';
import { Login } from './components/Auth/Login';
import { Signup } from './components/Auth/Signup';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { useProjects } from './hooks/useProjects';

// Note: Mock data removed - now using Supabase database

const ProjectWrapper = ({ projects, updateProject, deleteProject, onSignOut }: { projects: Project[], updateProject: (p: Project) => void, deleteProject: (id: string) => void, onSignOut: () => void }) => {
    const { id } = useParams();
    const project = projects.find(p => p.id === id);

    if (!project) return <Navigate to="/" />;

    return (
        <Layout title={project.name} showBack onSignOut={onSignOut}>
            <Routes>
                <Route path="/" element={<ProjectSetup project={project} updateProject={updateProject} deleteProject={deleteProject} />} />
                <Route path="/load-calc" element={<LoadCalculator project={project} updateProject={updateProject} />} />
                <Route path="/circuits" element={<OneLineDiagram project={project} updateProject={updateProject} />} />
                <Route path="/tools" element={<Calculators />} />
                <Route path="/grounding" element={<GroundingBonding project={project} updateProject={updateProject} />} />
                <Route path="/panel" element={<PanelSchedule project={project} />} />
                <Route path="/issues" element={<IssuesLog project={project} updateProject={updateProject} />} />
                <Route path="/check" element={<PreInspection project={project} updateProject={updateProject} />} />
                <Route path="/reports" element={<ComplianceReport project={project} />} />
            </Routes>
        </Layout>
    );
};

const NecAssistant = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [history, setHistory] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [loading, setLoading] = useState(false);

    const handleAsk = async () => {
        if (!query.trim()) return;
        const q = query;
        setQuery('');
        setHistory(prev => [...prev, { role: 'user', text: q }]);
        setLoading(true);
        const ans = await askNecAssistant(q);
        setLoading(false);
        setHistory(prev => [...prev, { role: 'ai', text: ans || 'Sorry, I could not retrieve that information.' }]);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {isOpen && (
                <div className="bg-white border border-gray-200 shadow-2xl rounded-lg w-96 h-[500px] mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                        <span className="font-medium flex items-center gap-2"><MessageSquare className="w-4 h-4 text-electric-500"/> NEC Copilot</span>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">×</button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {history.length === 0 && (
                            <div className="text-center text-gray-400 text-sm mt-10">
                                Ask any question about NEC 2023 code requirements.
                            </div>
                        )}
                        {history.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-electric-400 text-black' 
                                    : 'bg-white border border-gray-200 text-gray-700 shadow-sm'
                                }`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && <div className="text-xs text-gray-400 ml-2">Consulting NEC database...</div>}
                    </div>
                    <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                        <input 
                            className="flex-1 border border-gray-200 rounded px-3 py-2 text-sm focus:border-electric-500 outline-none"
                            placeholder="Type your question..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
                        />
                        <button onClick={handleAsk} disabled={loading} className="bg-gray-900 text-white p-2 rounded hover:bg-black">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className="bg-gray-900 hover:bg-black text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
            >
                <MessageSquare className="w-6 h-6 text-electric-500" />
            </button>
        </div>
    );
};

function AppContent() {
  const navigate = useNavigate();
  const { user, loading, signOut } = useAuthContext();
  const { projects, createProject, updateProject: updateProjectDB, deleteProject, error: projectsError } = useProjects();

  const createNewProject = async () => {
    const newProject: Partial<Project> = {
      name: 'New Project ' + (projects.length + 1),
      address: 'TBD',
      type: ProjectType.RESIDENTIAL,
      necEdition: '2023',
      status: ProjectStatus.PLANNING,
      progress: 0,
      serviceVoltage: 120,
      servicePhase: 1,
      settings: { serviceVoltage: 120, servicePhase: 1, conductorMaterial: 'Cu', temperatureRating: 75 }
    };

    const created = await createProject(newProject);

    // Navigate to new project immediately
    if (created) {
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
      {user && <NecAssistant />}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
}
