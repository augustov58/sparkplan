
import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
  Network,
  Plug,
  Package,
  Grid,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useAuthContext } from './Auth/AuthProvider';
import { ProjectType } from '../types';
import { AICopilotSidebar } from './AICopilotSidebar';
import { TrialBanner } from './TrialBanner';

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
  hasChildren?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
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

    // Toggle accordion if has children
    if (hasChildren && onToggle) {
      onToggle();
    }

    // Navigate to path (even if has children - allows parent route navigation)
    if (path) {
      navigate(path, { replace: false });
      // Close mobile menu after navigation
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
        flex items-center gap-3 cursor-pointer transition-all duration-200 group
        ${nested ? 'pl-12 pr-4 py-2' : 'px-4 py-3'}
        ${active ? 'bg-gray-50 border-r-4 border-electric-500' : 'hover:bg-gray-50 border-r-4 border-transparent'}
      `}
    >
      <Icon className={`${nested ? 'w-4 h-4' : 'w-5 h-5'} ${active ? 'text-electric-500' : 'text-gray-400 group-hover:text-gray-600'}`} />
      <span className={`${nested ? 'text-xs' : 'text-sm'} font-medium flex-1 ${active ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
        {label}
      </span>
      {hasChildren && (
        isExpanded ?
          <ChevronDown className="w-4 h-4 text-gray-400" /> :
          <ChevronRight className="w-4 h-4 text-gray-400" />
      )}
    </Link>
  );
};

export const Layout: React.FC<LayoutProps> = ({ children, title, showBack, onSignOut, projectType }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthContext();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    'Circuit Design': true // Default to expanded
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        // EV Panel Templates moved to Tools & Calculators tab
      ]
    },
    {
      title: 'PROJECT MANAGEMENT',
      items: [
        { label: 'Inspection & Issues', icon: AlertOctagon, path: `/project/${projectId}/issues`, show: true },
        { label: 'RFI Tracking', icon: MessageSquare, path: `/project/${projectId}/rfis`, show: true },
        { label: 'Site Visits', icon: MapPin, path: `/project/${projectId}/site-visits`, show: true },
        { label: 'Calendar', icon: Calendar, path: `/project/${projectId}/calendar`, show: true },
        { label: 'AI Inspector & Activity', icon: Shield, path: `/project/${projectId}/inspector`, show: true },
        { label: 'Pre-Inspection Check', icon: CheckSquare, path: `/project/${projectId}/check`, show: true },
        { label: 'Permit Packet', icon: FileText, path: `/project/${projectId}/permit-packet`, show: true },
        // COMING SOON: Utility Interconnection (Phase 2 - EV Niche)
        // { label: 'Utility Interconnection', icon: Plug, path: `/project/${projectId}/utility-interconnection`, show: true },
      ]
    }
  ] : [];

  return (
    <div className="min-h-screen bg-[var(--color-paper)] flex flex-row font-sans">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 border-r border-gray-200 h-screen flex flex-col bg-white z-50
        fixed md:sticky top-0
        transition-transform duration-300 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 bg-electric-500 rounded flex items-center justify-center">
                <Zap className="text-white w-5 h-5 fill-current" />
              </div>
              <span className="font-bold text-lg tracking-tight text-gray-900">NEC PRO</span>
            </div>
            {/* Close button - only show on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
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
              <div className="px-4 py-2 mb-2">
                <button
                  onClick={() => {
                    navigate('/');
                    setIsMobileMenuOpen(false);
                  }}
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

        <div className="p-4 border-t border-gray-200">
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
      <main className="flex-1 min-w-0 bg-[var(--color-paper)]">
        {/* Trial Banner - shows for users on trial */}
        <TrialBanner />

        <header className="h-16 border-b border-gray-200 flex items-center px-4 md:px-8 justify-between sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            {/* Hamburger menu button - only show on mobile */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-gray-600 hover:text-gray-900 p-2 -ml-2"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg md:text-xl font-medium text-gray-900">{title}</h1>
          </div>
          <div className="flex items-center gap-4">
             {/* Header Actions Could Go Here */}
          </div>
        </header>
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto">
          {/* Content Panel - white paper with subtle border */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            {children}
          </div>
        </div>
      </main>

      {/* AI Copilot Sidebar - Only show on project routes */}
      {isProjectRoute && <AICopilotSidebar />}
    </div>
  );
};
