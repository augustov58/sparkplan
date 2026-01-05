/**
 * Landing Page - Industrial Schematic Design
 * Blueprint meets Power Grid aesthetic
 * Matches Login page design system
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Zap,
  ListChecks,
  ShieldCheck,
  FolderKanban,
  ChevronDown,
  Menu,
  X,
  Cpu,
  Activity,
  Lock,
  FileText,
  Calculator,
  CircuitBoard
} from 'lucide-react';

// Circuit trace component for backgrounds
const CircuitTrace = ({ d, delay = 0, duration = 2 }: { d: string; delay?: number; duration?: number }) => (
  <path
    d={d}
    fill="none"
    stroke="url(#circuit-gradient)"
    strokeWidth="1.5"
    strokeLinecap="round"
    style={{
      strokeDasharray: 1000,
      strokeDashoffset: 1000,
      animation: `energize ${duration}s ease-out ${delay}s forwards`,
    }}
  />
);

// Status LED component
const StatusLED = ({ active = true, color = 'emerald' }: { active?: boolean; color?: string }) => (
  <div
    className={`w-2 h-2 rounded-full ${
      active
        ? color === 'amber'
          ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
          : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
        : 'bg-slate-600'
    }`}
  />
);

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

// Section header component
const SectionHeader = ({ label, title }: { label: string; title: string }) => (
  <div className="flex items-center gap-4 mb-12">
    <div className="flex items-center gap-2">
      <StatusLED active />
      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{label}</span>
    </div>
    <div className="h-px flex-1 bg-gradient-to-r from-slate-700 to-transparent" />
    <h2 className="text-3xl md:text-4xl font-bold text-white">{title}</h2>
    <div className="h-px flex-1 bg-gradient-to-l from-slate-700 to-transparent" />
    <VoltageBar level={4} />
  </div>
);

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
      setActiveSection(id);
    }
  };

  const features = [
    {
      icon: ListChecks,
      title: 'Guided NEC Workflows',
      description: 'Follow structured, step-by-step workflows aligned with the NEC — from load calculations to inspection preparation.',
      status: 'ACTIVE',
      voltage: 4
    },
    {
      icon: ShieldCheck,
      title: 'Automated Code Validation',
      description: 'Real-time validation of conductor sizing, OCPD selection, grounding rules, derating, and panel configurations.',
      status: 'MONITORING',
      voltage: 5
    },
    {
      icon: FolderKanban,
      title: 'Project Documentation Hub',
      description: 'Centralized storage for drawings, calculations, checklists, inspection notes, and revision logs.',
      status: 'SYNCED',
      voltage: 3
    }
  ];

  const pricingPlans = [
    {
      name: 'Starter',
      price: 29,
      description: 'For independent electricians and small teams',
      features: [
        'Guided NEC Workflows',
        'Project Dashboard',
        'Document Storage (2GB)',
        'Load Calculation Templates',
        '2 Team Members'
      ],
      popular: false
    },
    {
      name: 'Pro',
      price: 79,
      description: 'For contractors managing multiple installations',
      features: [
        'Automated Validation Engine',
        'Multi-Project Support (Up to 5)',
        'Grounding & Fault Calculators',
        'Digital Inspection Reports',
        'Document Storage (10GB)',
        '5 Team Members'
      ],
      popular: true
    }
  ];

  const faqs = [
    {
      q: 'Is the platform aligned with the National Electrical Code?',
      a: 'Yes. All workflows, calculators, and validations follow the latest NEC edition (2023), with updates as new editions are released.'
    },
    {
      q: 'Can I export my project documentation?',
      a: 'Yes — including PDF, DOCX, panel schedules, load calculations, and full permit-ready project packages.'
    },
    {
      q: 'Does this help me prepare for inspections?',
      a: 'It provides guided NEC steps, Inspector Mode AI pre-audit, and inspector-ready documentation to reduce rework and code issues.'
    },
    {
      q: 'Can my team collaborate?',
      a: 'Yes, with user permissions and project-based access depending on your subscription tier.'
    },
    {
      q: 'Is my data secure?',
      a: 'We use bank-level encryption (AES-256) for all project data. SOC 2 Type II certified infrastructure.'
    },
    {
      q: 'Does this replace an inspector?',
      a: 'No. It supports your engineering workflow and helps catch issues early, but final approval depends on the AHJ.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Global SVG Definitions */}
      <svg className="absolute w-0 h-0">
        <defs>
          <linearGradient id="circuit-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="circuit-gradient-vertical" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Blueprint Grid Background - Fixed */}
      <div
        className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(251, 191, 36, 0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(251, 191, 36, 0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:shadow-amber-500/40 transition-shadow">
                <Zap className="w-6 h-6 text-slate-900" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-950" />
            </div>
            <div>
              <span className="font-bold text-lg text-white tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                NEC PRO
              </span>
              <div className="flex items-center gap-1.5">
                <StatusLED active />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">System Online</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {['features', 'pricing', 'faq'].map((item) => (
              <button
                key={item}
                onClick={() => scrollTo(item)}
                className={`px-4 py-2 text-sm font-medium transition-all rounded ${
                  activeSection === item
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="group px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 text-sm font-semibold rounded transition-all hover:shadow-lg hover:shadow-amber-500/25 flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800 p-6 space-y-4">
            {['features', 'pricing', 'faq'].map((item) => (
              <button
                key={item}
                onClick={() => scrollTo(item)}
                className="block w-full text-left px-4 py-3 text-lg font-medium text-slate-300 hover:text-amber-400 hover:bg-slate-800/50 rounded transition-colors"
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full py-3 border border-slate-700 text-white font-medium rounded hover:bg-slate-800 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="w-full py-3 bg-amber-400 text-slate-900 font-semibold rounded hover:bg-amber-300 transition-colors"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-16">
        {/* Animated Circuit Background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
        >
          <g filter="url(#glow)" className={mounted ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 0.5s' }}>
            <CircuitTrace delay={0.2} duration={2.5} d="M 0 300 H 200 V 400 H 350 V 350 H 450" />
            <CircuitTrace delay={0.5} duration={3} d="M 150 0 V 150 H 300 V 250 H 400" />
            <CircuitTrace delay={0.8} duration={2} d="M 0 500 H 100 V 450 H 200 V 500 H 300" />
            <CircuitTrace delay={1.0} duration={2.5} d="M 500 200 H 400 V 300 H 350" />
            <CircuitTrace delay={0.3} duration={3} d="M 600 0 V 100 H 500 V 200 H 450" />
            <CircuitTrace delay={0.6} duration={2} d="M 800 250 H 700 V 350 H 600 V 300" />
            <CircuitTrace delay={0.9} duration={2.5} d="M 900 400 H 800 V 350 H 750" />
            <CircuitTrace delay={1.2} duration={2} d="M 1000 150 H 900 V 250 H 850" />
            <CircuitTrace delay={0.4} duration={3} d="M 1100 300 H 1000 V 400 H 950" />
            <CircuitTrace delay={0.7} duration={2.5} d="M 1200 100 H 1100 V 200 H 1050" />
          </g>

          {/* Connection nodes */}
          <g className={mounted ? 'opacity-100' : 'opacity-0'} style={{ transition: 'opacity 1s 1.5s' }}>
            {[[350, 350], [400, 250], [300, 500], [450, 200], [600, 300], [750, 350], [850, 250], [950, 400], [1050, 200]].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r="4"
                fill="#fbbf24"
                className="animate-pulse"
                style={{
                  animationDelay: `${i * 0.2 + 2}s`,
                  filter: 'drop-shadow(0 0 6px rgba(251, 191, 36, 0.8))'
                }}
              />
            ))}
          </g>
        </svg>

        {/* Hero Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-20">
          <div
            className={`max-w-4xl transform transition-all duration-1000 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
            }`}
          >
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700 rounded-full mb-8">
              <StatusLED active color="amber" />
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">NEC 2023 Compliant</span>
              <span className="text-slate-600">|</span>
              <span className="text-xs font-mono text-amber-400">v2.4.1</span>
            </div>

            {/* Main headline */}
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              <span className="text-white">NEC Compliance.</span>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-400 to-slate-500">
                Engineered. Automated.
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
              The modern control system for electrical design. Plan, verify, and document
              NEC-compliant installations with precision engineering tools.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="group relative px-8 py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-semibold rounded-lg overflow-hidden transition-all hover:shadow-xl hover:shadow-amber-500/25 hover:-translate-y-0.5"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Initialize System
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-amber-300 to-amber-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-8 py-4 border border-slate-700 text-white font-medium rounded-lg hover:bg-slate-800/50 hover:border-slate-600 transition-all flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Access Terminal
              </button>
            </div>

            {/* Quick stats */}
            <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl">
              {[
                { value: '50k+', label: 'Calculations' },
                { value: '99.9%', label: 'Uptime' },
                { value: '<100ms', label: 'Response' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className={`transform transition-all duration-700 ${
                    mounted ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
                  }`}
                  style={{ transitionDelay: `${0.8 + i * 0.1}s` }}
                >
                  <div className="text-2xl md:text-3xl font-bold text-amber-400 font-mono">{stat.value}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-bounce">
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">Scroll</span>
          <ChevronDown className="w-5 h-5 text-slate-600" />
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="relative py-16 border-y border-slate-800/50 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="h-px w-12 bg-slate-700" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em]">
              Trusted by Engineering Teams
            </span>
            <div className="h-px w-12 bg-slate-700" />
          </div>
          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-20">
            {['ELECTROPRO', 'GRIDWORKS', 'URBAN CURRENT', 'AMPERION'].map((name, i) => (
              <div
                key={i}
                className="text-xl font-bold font-mono text-slate-700 hover:text-slate-500 transition-colors cursor-default"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="relative py-24">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader label="Module 01" title="Core Systems" />

          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="group relative bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden hover:border-amber-400/30 transition-all duration-300"
              >
                {/* Card header bar */}
                <div className="h-10 bg-slate-800/50 border-b border-slate-700/50 flex items-center justify-between px-4">
                  <div className="flex items-center gap-2">
                    <StatusLED active color={i === 1 ? 'amber' : 'emerald'} />
                    <span className="text-[10px] font-mono text-slate-500 uppercase">{feature.status}</span>
                  </div>
                  <VoltageBar level={feature.voltage} />
                </div>

                {/* Card content */}
                <div className="p-6">
                  <div className="w-14 h-14 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center mb-6 group-hover:border-amber-400/50 group-hover:bg-amber-400/10 transition-all">
                    <feature.icon className="w-7 h-7 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm">{feature.description}</p>
                </div>

                {/* Hover circuit decoration */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>

          {/* Additional features grid */}
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Calculator, label: 'Load Calculations' },
              { icon: CircuitBoard, label: 'Panel Schedules' },
              { icon: Activity, label: 'Voltage Drop Analysis' },
              { icon: FileText, label: 'Permit Packets' }
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-4 bg-slate-900/30 border border-slate-800/50 rounded-lg hover:border-slate-700 transition-colors"
              >
                <item.icon className="w-5 h-5 text-amber-400/70" />
                <span className="text-sm text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="relative py-24 bg-slate-900/50">
        {/* Section circuit decoration */}
        <svg className="absolute top-0 left-0 w-full h-24 pointer-events-none opacity-30">
          <line x1="0" y1="1" x2="100%" y2="1" stroke="#334155" strokeWidth="1" />
          <line x1="10%" y1="0" x2="10%" y2="24" stroke="#334155" strokeWidth="1" />
          <line x1="90%" y1="0" x2="90%" y2="24" stroke="#334155" strokeWidth="1" />
        </svg>

        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader label="Module 02" title="Access Tiers" />

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <div
                key={i}
                className={`relative bg-slate-900/80 border rounded-lg overflow-hidden ${
                  plan.popular
                    ? 'border-amber-400/50 shadow-xl shadow-amber-400/5'
                    : 'border-slate-800'
                }`}
              >
                {/* Popular badge */}
                {plan.popular && (
                  <div className="absolute top-0 right-0 px-3 py-1 bg-amber-400 text-slate-900 text-[10px] font-bold uppercase tracking-wider rounded-bl-lg">
                    Recommended
                  </div>
                )}

                {/* Card header */}
                <div className="h-12 bg-slate-800/30 border-b border-slate-700/50 flex items-center justify-between px-6">
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${plan.popular ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{plan.name} Module</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusLED active color={plan.popular ? 'amber' : 'emerald'} />
                    <span className="text-[10px] font-mono text-slate-600">READY</span>
                  </div>
                </div>

                {/* Card content */}
                <div className="p-8">
                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-white">${plan.price}</span>
                      <span className="text-slate-500 font-mono">/mo</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">{plan.description}</p>
                  </div>

                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, j) => (
                      <li key={j} className="flex items-center gap-3 text-sm text-slate-300">
                        <div className="w-5 h-5 rounded bg-slate-800 flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3 text-amber-400" />
                        </div>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => navigate('/signup')}
                    className={`w-full py-3.5 rounded font-semibold transition-all flex items-center justify-center gap-2 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 hover:shadow-lg hover:shadow-amber-500/25'
                        : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                    }`}
                  >
                    {plan.popular ? 'Initialize Pro' : 'Start Free Trial'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="relative py-24">
        <div className="max-w-4xl mx-auto px-6">
          <SectionHeader label="Module 03" title="System Reference" />

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className={`border rounded-lg overflow-hidden transition-all ${
                  openFaq === i
                    ? 'border-amber-400/30 bg-slate-900/50'
                    : 'border-slate-800 bg-slate-900/30 hover:border-slate-700'
                }`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                      openFaq === i ? 'bg-amber-400/20' : 'bg-slate-800'
                    }`}>
                      <span className={`font-mono text-sm ${openFaq === i ? 'text-amber-400' : 'text-slate-500'}`}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="font-medium text-white">{faq.q}</span>
                  </div>
                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 transition-transform ${
                      openFaq === i ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 pl-[4.5rem]">
                    <p className="text-slate-400 leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-24 border-t border-slate-800/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full mb-6">
            <StatusLED active color="amber" />
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider">System Ready</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to initialize?
          </h2>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
            Join thousands of electrical professionals using NEC Pro to streamline compliance workflows.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/signup')}
              className="group px-10 py-4 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-semibold rounded-lg hover:shadow-xl hover:shadow-amber-500/25 transition-all flex items-center justify-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => scrollTo('pricing')}
              className="px-10 py-4 border border-slate-700 text-white font-medium rounded-lg hover:bg-slate-800/50 transition-colors"
            >
              View Pricing
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative py-16 border-t border-slate-800/50 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Logo column */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-amber-500 rounded flex items-center justify-center">
                  <Zap className="w-5 h-5 text-slate-900" />
                </div>
                <span className="font-bold text-lg text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  NEC PRO
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                The modern standard for electrical code compliance.
              </p>
              <div className="flex items-center gap-2">
                <StatusLED active />
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">All Systems Operational</span>
              </div>
            </div>

            {/* Links columns */}
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Product</h4>
              <ul className="space-y-3 text-sm">
                {['Features', 'Pricing', 'FAQ', 'Changelog'].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => item !== 'Changelog' && scrollTo(item.toLowerCase())}
                      className="text-slate-500 hover:text-amber-400 transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Company</h4>
              <ul className="space-y-3 text-sm">
                {['About', 'Contact', 'Careers', 'Blog'].map((item) => (
                  <li key={item}>
                    <a href="#" className="text-slate-500 hover:text-amber-400 transition-colors">{item}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">Contact</h4>
              <ul className="space-y-3 text-sm text-slate-500">
                <li className="font-mono">support@necpro.com</li>
                <li className="font-mono">+1 (555) 987-6543</li>
              </ul>
            </div>
          </div>

          {/* Footer bottom */}
          <div className="pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4 text-[10px] font-mono text-slate-600 uppercase tracking-wider">
              <span>NEC 2023</span>
              <span className="text-slate-800">|</span>
              <span>256-bit Encrypted</span>
              <span className="text-slate-800">|</span>
              <span>SOC 2 Type II</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-slate-300 transition-colors">Terms of Service</a>
              <span className="text-slate-700">© {new Date().getFullYear()} NEC Pro</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap');

        @keyframes energize {
          to {
            stroke-dashoffset: 0;
          }
        }

        html {
          scroll-behavior: smooth;
        }

        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #0f172a;
        }
        ::-webkit-scrollbar-thumb {
          background: #334155;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #475569;
        }
      `}</style>
    </div>
  );
};
