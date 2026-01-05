/**
 * Layout Component - Industrial Schematic Design
 * Dark control room aesthetic matching Login/Landing pages
 */

import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  CircuitBoard,
  FileText,
  Settings,
  CheckSquare,
  Activity,
  ArrowLeft,
  LogOut,
  Calculator,
  AlertOctagon,
  Cable,
  Home,
  Shield,
  MessageSquare,
  MapPin,
  Calendar,
  Network,
  Grid,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Terminal
} from 'lucide-react';
import { useAuthContext } from './Auth/AuthProvider';
import { ProjectType } from '../types';
import { AICopilotSidebar } from './AICopilotSidebar';
import { ThemeToggle } from './ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onSignOut?: () => void;
  projectType?: ProjectType;
}

// Status LED component
const StatusLED = ({ active = true, color = 'emerald', size = 'sm' }: { active?: boolean; color?: string; size?: 'sm' | 'md' }) => {
  const sizeClass = size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  return (
    <div
      className={`${sizeClass} rounded-full ${
        active
          ? color === 'amber'
            ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
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

interface SidebarItemProps {
  icon: any;
  label: string;
  path: string;
  active: boolean;
  nested?: boolean;
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

interface SidebarSectionProps {
  title: string;
  moduleNumber?: string;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({ title, moduleNumber }) => {
  return (
    <div className="px-4 py-3 mt-4 mb-1 flex items-center gap-2">
      <StatusLED active color="amber" />
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
        {moduleNumber && <span className="text-amber-400/60">{moduleNumber}</span>} {title}
      </span>
      <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
    </div>
  );
};

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon: Icon,
  label,
  path,
  active,
  nested = false,
  hasChildren = false,
  isExpanded = false,
  onToggle,
  onNavigate
}) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    if (hasChildren && onToggle) {
      onToggle();
    }

    if (path) {
      navigate(path, { replace: false });
      if (onNavigate) {
        onNavigate();
      }
    }
  };

  return (
    <Link
      to={path}
      onClick={handleClick}
      className={`
        flex items-center gap-3 cursor-pointer transition-all duration-200 group relative
        ${nested ? 'pl-11 pr-4 py-2' : 'px-4 py-2.5'}
        ${active
          ? 'bg-amber-400/10 text-amber-400'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }
      `}
    >
      {/* Active indicator bar */}
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-amber-400 rounded-r" />
      )}

      {/* Nested connector line */}
      {nested && (
        <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-800" />
      )}
      {nested && (
        <div className="absolute left-6 top-1/2 w-3 h-px bg-slate-700" />
      )}

      <Icon className={`${nested ? 'w-4 h-4' : 'w-5 h-5'} ${active ? 'text-amber-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`} />
      <span className={`${nested ? 'text-xs' : 'text-sm'} font-medium flex-1 transition-colors`}>
        {label}
      </span>
      {hasChildren && (
        isExpanded ?
          <ChevronDown className="w-4 h-4 text-slate-500" /> :
          <ChevronRight className="w-4 h-4 text-slate-500" />
      )}
      {active && !hasChildren && (
        <StatusLED active size="sm" />
      )}
    </Link>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onSignOut, projectType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Circuit Design': true
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getUserInitials = () => {
    if (!user?.email) return '??';
    const name = user.email.split('@')[0];
    if (!name) return '??';
    return name.slice(0, 2).toUpperCase();
  };

  const getUserDisplayName = () => {
    if (!user?.email) return 'User';
    return user.email.split('@')[0];
  };

  const isProjectRoute = location.pathname.includes('/project/');
  const projectId = isProjectRoute ? location.pathname.split('/')[2] : '';
  const isResidential = projectType === ProjectType.RESIDENTIAL;

  const navigationSections = isProjectRoute ? [
    {
      title: 'DESIGN',
      moduleNumber: '01',
      items: [
        { label: 'Project Setup', icon: Settings, path: `/project/${projectId}`, show: true },
        {
          label: isResidential ? 'Dwelling Calculator' : 'Load Calculator',
          icon: isResidential ? Home : Activity,
          path: `/project/${projectId}/load-calc`,
          show: true
        },
        {
          label: 'Circuit Design',
          icon: CircuitBoard,
          path: `/project/${projectId}/circuits`,
          show: true,
          nested: [
            { label: 'One-Line Diagram', icon: Network, path: `/project/${projectId}/diagram` },
            { label: 'Panel Schedules', icon: Grid, path: `/project/${projectId}/panel` },
            { label: 'Feeder Sizing', icon: Cable, path: `/project/${projectId}/feeders` },
            { label: 'Short Circuit Analysis', icon: Activity, path: `/project/${projectId}/short-circuit` }
          ]
        },
        { label: 'Grounding & Bonding', icon: Zap, path: `/project/${projectId}/grounding`, show: true },
        { label: 'Tools & Calculators', icon: Calculator, path: `/project/${projectId}/tools`, show: true },
      ]
    },
    {
      title: 'MANAGEMENT',
      moduleNumber: '02',
      items: [
        { label: 'Inspection & Issues', icon: AlertOctagon, path: `/project/${projectId}/issues`, show: true },
        { label: 'RFI Tracking', icon: MessageSquare, path: `/project/${projectId}/rfis`, show: true },
        { label: 'Site Visits', icon: MapPin, path: `/project/${projectId}/site-visits`, show: true },
        { label: 'Calendar', icon: Calendar, path: `/project/${projectId}/calendar`, show: true },
        { label: 'AI Inspector', icon: Shield, path: `/project/${projectId}/inspector`, show: true },
        { label: 'Pre-Inspection', icon: CheckSquare, path: `/project/${projectId}/check`, show: true },
        { label: 'Permit Packet', icon: FileText, path: `/project/${projectId}/permit-packet`, show: true },
      ]
    }
  ] : [];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-row font-sans">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 border-r border-slate-800 h-screen flex flex-col bg-slate-900 z-50
        fixed md:sticky top-0
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Logo Header */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-shadow">
                  <Zap className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
              </div>
              <div>
                <span className="font-bold text-lg text-white tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  NEC PRO
                </span>
                <div className="flex items-center gap-1.5">
                  <StatusLED active />
                  <span className="text-[9px] text-slate-500 uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
            {/* Close button - mobile only */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-2">
          {!isProjectRoute && (
            <>
              <div className="px-4 py-3 flex items-center gap-2">
                <StatusLED active color="amber" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                  <span className="text-amber-400/60">00</span> NAVIGATION
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-slate-700 to-transparent" />
              </div>
              <SidebarItem
                icon={LayoutGrid}
                label="All Projects"
                path="/"
                active={location.pathname === '/'}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
              <SidebarItem
                icon={Calendar}
                label="Calendar"
                path="/calendar"
                active={location.pathname === '/calendar'}
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </>
          )}

          {isProjectRoute && (
            <>
              {/* Back to Dashboard */}
              <div className="px-4 py-3">
                <button
                  onClick={() => {
                    navigate('/');
                    setIsMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-2 text-xs text-slate-500 hover:text-amber-400 transition-colors group"
                >
                  <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  <span className="font-mono uppercase tracking-wider">Dashboard</span>
                </button>
              </div>

              {/* Navigation Sections */}
              {navigationSections.map((section) => (
                <React.Fragment key={section.title}>
                  <SidebarSection title={section.title} moduleNumber={section.moduleNumber} />
                  {section.items
                    .filter(item => item.show !== false)
                    .map((item) => (
                      <React.Fragment key={item.label}>
                        <SidebarItem
                          icon={item.icon}
                          label={item.label}
                          path={item.path}
                          active={location.pathname === item.path}
                          hasChildren={!!item.nested}
                          isExpanded={expandedSections[item.label]}
                          onToggle={() => setExpandedSections(prev => ({
                            ...prev,
                            [item.label]: !prev[item.label]
                          }))}
                          onNavigate={() => setIsMobileMenuOpen(false)}
                        />
                        {item.nested && expandedSections[item.label] && item.nested.map((nestedItem: any) => (
                          <SidebarItem
                            key={nestedItem.label}
                            icon={nestedItem.icon}
                            label={nestedItem.label}
                            path={nestedItem.path}
                            active={location.pathname === nestedItem.path}
                            nested={true}
                            onNavigate={() => setIsMobileMenuOpen(false)}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}
            </>
          )}
        </div>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400 font-mono">
              {getUserInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white truncate">{getUserDisplayName()}</p>
                <StatusLED active size="sm" />
              </div>
              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider truncate">Operator</p>
            </div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-slate-400 hover:text-red-400 bg-slate-800/50 hover:bg-red-950/30 border border-slate-700 hover:border-red-900/50 rounded-lg transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="font-mono uppercase tracking-wider">Terminate Session</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-slate-950 relative">
        {/* Blueprint Grid Background */}
        <div
          className="fixed inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(rgba(251, 191, 36, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(251, 191, 36, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Header */}
        <header className="h-14 border-b border-slate-800 flex items-center px-4 md:px-6 justify-between sticky top-0 bg-slate-900/80 backdrop-blur-xl z-10">
          <div className="flex items-center gap-4">
            {/* Hamburger menu - mobile only */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-400 hover:text-white p-2 -ml-2 hover:bg-slate-800 rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Title with terminal icon */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-slate-800/50 border border-slate-700 rounded">
                <Terminal className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Terminal</span>
              </div>
              <h1 className="text-lg font-medium text-white">{title}</h1>
            </div>
          </div>

          {/* Header right side */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-slate-600 uppercase tracking-wider">
              <span>NEC 2023</span>
              <span className="text-slate-800">|</span>
              <div className="flex items-center gap-1.5">
                <StatusLED active />
                <span>System Active</span>
              </div>
            </div>
            <ThemeToggle />
            <VoltageBar level={4} />
          </div>
        </header>

        {/* Main Content Area */}
        <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto relative z-0">
          {children}
        </div>
      </main>

      {/* AI Copilot Sidebar - Only on project routes */}
      {isProjectRoute && <AICopilotSidebar />}

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        /* Custom scrollbar for sidebar */
        aside::-webkit-scrollbar {
          width: 4px;
        }
        aside::-webkit-scrollbar-track {
          background: transparent;
        }
        aside::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 2px;
        }
        aside::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};
