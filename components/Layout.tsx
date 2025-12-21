
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Zap,
  CircuitBoard,
  ShieldCheck,
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
  Network
} from 'lucide-react';
import { useAuthContext } from './Auth/AuthProvider';
import { ProjectType } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
  onSignOut?: () => void;
  projectType?: ProjectType; // Used to conditionally show/hide tabs
}

interface SidebarItemProps {
  icon: any;
  label: string;
  path: string;
  active: boolean;
  nested?: boolean;
}

interface SidebarSectionProps {
  title: string;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({ title }) => {
  return (
    <div className="px-4 py-2 mt-4 mb-1">
      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
    </div>
  );
};

const SidebarItem: React.FC<SidebarItemProps> = ({ icon: Icon, label, path, active, nested = false }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      className={`
        flex items-center gap-3 cursor-pointer transition-all duration-200 group
        ${nested ? 'pl-12 pr-4 py-2' : 'px-4 py-3'}
        ${active ? 'bg-gray-50 border-r-4 border-electric-500' : 'hover:bg-gray-50 border-r-4 border-transparent'}
      `}
    >
      <Icon className={`${nested ? 'w-4 h-4' : 'w-5 h-5'} ${active ? 'text-electric-500' : 'text-gray-400 group-hover:text-gray-600'}`} />
      <span className={`${nested ? 'text-xs' : 'text-sm'} font-medium ${active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
        {label}
      </span>
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onSignOut, projectType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();

  // Extract user initials from email
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

  // Extract Project ID if in project route
  const isProjectRoute = location.pathname.includes('/project/');
  const projectId = isProjectRoute ? location.pathname.split('/')[2] : '';

  // Determine which tabs to show based on project type
  const isResidential = projectType === ProjectType.RESIDENTIAL;
  const isCommercialOrIndustrial = projectType === ProjectType.COMMERCIAL || projectType === ProjectType.INDUSTRIAL;

  // Build navigation structure with sections
  const navigationSections = isProjectRoute ? [
    {
      title: 'PROJECT DESIGN',
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
          show: isCommercialOrIndustrial,
          nested: [
            { label: 'One-Line Diagram', icon: Network, path: `/project/${projectId}/diagram` }
          ]
        },
        { label: 'Panel Schedules', icon: LayoutGrid, path: `/project/${projectId}/panel`, show: true },
        { label: 'Grounding & Bonding', icon: Zap, path: `/project/${projectId}/grounding`, show: true },
        { label: 'Feeder Sizing', icon: Cable, path: `/project/${projectId}/feeders`, show: isCommercialOrIndustrial },
        { label: 'Short Circuit Analysis', icon: Activity, path: `/project/${projectId}/short-circuit`, show: true },
        { label: 'Tools & Calculators', icon: Calculator, path: `/project/${projectId}/tools`, show: true },
      ]
    },
    {
      title: 'PROJECT MANAGEMENT',
      items: [
        { label: 'Inspection & Issues', icon: AlertOctagon, path: `/project/${projectId}/issues`, show: true },
        { label: 'RFI Tracking', icon: MessageSquare, path: `/project/${projectId}/rfis`, show: true },
        { label: 'Site Visits', icon: MapPin, path: `/project/${projectId}/site-visits`, show: true },
        { label: 'Calendar', icon: Calendar, path: `/project/${projectId}/calendar`, show: true },
        { label: 'Inspector Mode AI', icon: Shield, path: `/project/${projectId}/inspector`, show: true },
        { label: 'Pre-Inspection Check', icon: CheckSquare, path: `/project/${projectId}/check`, show: true },
        { label: 'Permit Packet', icon: FileText, path: `/project/${projectId}/permit-packet`, show: true },
      ]
    }
  ] : [];

  return (
    <div className="min-h-screen bg-white flex flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-100 h-screen sticky top-0 flex flex-col bg-white z-10">
        <div className="p-6 border-b border-gray-50">
          <div className="flex items-center gap-2" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-electric-500 rounded flex items-center justify-center cursor-pointer">
              <Zap className="text-white w-5 h-5 fill-current" />
            </div>
            <span className="font-bold text-lg tracking-tight text-gray-900 cursor-pointer">NEC PRO</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {!isProjectRoute && (
            <>
              <SidebarItem
                icon={LayoutGrid}
                label="All Projects"
                path="/"
                active={location.pathname === '/'}
              />
              <SidebarItem
                icon={Calendar}
                label="Calendar"
                path="/calendar"
                active={location.pathname === '/calendar'}
              />
            </>
          )}

          {isProjectRoute && (
            <>
              <div className="px-4 py-2 mb-2">
                <button
                  onClick={() => navigate('/')}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" /> Back to Dashboard
                </button>
              </div>
              {navigationSections.map((section, sectionIndex) => (
                <React.Fragment key={section.title}>
                  <SidebarSection title={section.title} />
                  {section.items
                    .filter(item => item.show !== false)
                    .map((item) => (
                      <React.Fragment key={item.label}>
                        <SidebarItem
                          icon={item.icon}
                          label={item.label}
                          path={item.path}
                          active={location.pathname === item.path}
                        />
                        {item.nested && item.nested.map((nestedItem: any) => (
                          <SidebarItem
                            key={nestedItem.label}
                            icon={nestedItem.icon}
                            label={nestedItem.label}
                            path={nestedItem.path}
                            active={location.pathname === nestedItem.path}
                            nested={true}
                          />
                        ))}
                      </React.Fragment>
                    ))}
                </React.Fragment>
              ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-electric-100 flex items-center justify-center text-xs font-bold text-electric-700">
              {getUserInitials()}
            </div>
            <div className="text-xs overflow-hidden">
              <p className="font-medium text-gray-900 truncate">{getUserDisplayName()}</p>
              <p className="text-gray-400 truncate">{user?.email || 'No email'}</p>
            </div>
          </div>
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 bg-gradient-to-br from-gray-50 via-white to-blue-50/30 relative">
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(0 0 0) 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />

        <header className="h-16 border-b border-gray-100 flex items-center px-8 justify-between sticky top-0 bg-white/80 backdrop-blur-sm z-10">
          <h1 className="text-xl font-medium text-gray-900">{title}</h1>
          <div className="flex items-center gap-4">
             {/* Header Actions Could Go Here */}
          </div>
        </header>
        <div className="p-8 max-w-[1600px] mx-auto relative z-0">
          {children}
        </div>
      </main>
    </div>
  );
};
