
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
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

// Mock Initial Data
const INITIAL_PROJECTS: Project[] = [
  {
    id: '1',
    name: 'Skyline Lofts Renovation',
    address: '1200 Market St, San Francisco, CA',
    type: ProjectType.RESIDENTIAL,
    necEdition: '2023',
    status: ProjectStatus.IN_PROGRESS,
    progress: 45,
    serviceVoltage: 240,
    servicePhase: 1,
    settings: {
        serviceVoltage: 240,
        servicePhase: 1,
        conductorMaterial: 'Cu',
        temperatureRating: 75
    },
    loads: [
        { id: 'l1', description: 'General Lighting', watts: 3000, type: 'lighting', continuous: true, phase: 'A' },
        { id: 'l2', description: 'Kitchen Appliances', watts: 4500, type: 'appliance', continuous: false, phase: 'B' },
        { id: 'l3', description: 'HVAC Unit', watts: 5000, type: 'hvac', continuous: true, phase: 'A' }
    ],
    circuits: [
        { id: 'c1', circuitNumber: 1, description: 'Lighting Zone A', breakerAmps: 15, pole: 1, loadWatts: 1200, conductorSize: '14 AWG' },
        { id: 'c2', circuitNumber: 3, description: 'Kitchen Receptacles', breakerAmps: 20, pole: 1, loadWatts: 1500, conductorSize: '12 AWG' }
    ],
    issues: [
        { id: 'i1', description: 'Missing AFCI protection in Bedroom 2', article: '210.12', status: 'Open', severity: 'Critical', assignedTo: 'John', createdAt: Date.now() }
    ],
    inspectionList: [],
    grounding: { electrodes: ["Metal Underground Water Pipe"], gecSize: "6 AWG", bonding: ["Interior Water Piping"], notes: "" }
  },
  {
    id: '2',
    name: 'TechFlow Server Room',
    address: '800 Innovation Dr, Austin, TX',
    type: ProjectType.COMMERCIAL,
    necEdition: '2023',
    status: ProjectStatus.PLANNING,
    progress: 15,
    serviceVoltage: 208,
    servicePhase: 3,
    settings: {
        serviceVoltage: 208,
        servicePhase: 3,
        conductorMaterial: 'Cu',
        temperatureRating: 75
    },
    loads: [],
    circuits: [],
    issues: [],
    inspectionList: [],
    grounding: { electrodes: [], gecSize: "4 AWG", bonding: [], notes: "" }
  }
];

const ProjectWrapper = ({ projects, updateProject, onSignOut }: { projects: Project[], updateProject: (p: Project) => void, onSignOut: () => void }) => {
    const { id } = useParams();
    const project = projects.find(p => p.id === id);

    if (!project) return <Navigate to="/" />;

    return (
        <Layout title={project.name} showBack onSignOut={onSignOut}>
            <Routes>
                <Route path="/" element={<ProjectSetup project={project} updateProject={updateProject} />} />
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

export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [showLanding, setShowLanding] = useState(true);

  const createNewProject = () => {
    const newProject: Project = {
        id: Math.random().toString(36).substr(2, 9),
        name: 'New Project ' + (projects.length + 1),
        address: 'TBD',
        type: ProjectType.RESIDENTIAL,
        necEdition: '2023',
        status: ProjectStatus.PLANNING,
        progress: 0,
        settings: { serviceVoltage: 120, servicePhase: 1, conductorMaterial: 'Cu', temperatureRating: 75 },
        serviceVoltage: 120, // keep legacy for safety
        servicePhase: 1, // keep legacy for safety
        loads: [],
        circuits: [],
        issues: [],
        inspectionList: [],
        grounding: { electrodes: [], gecSize: '6 AWG', bonding: [], notes: '' }
    };
    setProjects([newProject, ...projects]);
  };

  const updateProject = (updated: Project) => {
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
  };

  const handleSignOut = () => {
    setShowLanding(true);
  };

  if (showLanding) {
    return <LandingPage onStart={() => setShowLanding(false)} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={
            <Layout title="Dashboard" onSignOut={handleSignOut}>
                <Dashboard projects={projects} createNewProject={createNewProject} />
            </Layout>
        } />
        <Route path="/project/:id/*" element={
            <ProjectWrapper 
                projects={projects} 
                updateProject={updateProject} 
                onSignOut={handleSignOut} 
            />
        } />
      </Routes>
      <NecAssistant />
    </HashRouter>
  );
}
