import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Bolt,
  ListChecks,
  ShieldCheck,
  FolderKanban,
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f7] font-sans text-[#1a1a1a] selection:bg-primary-100">
      
      {/* 1. Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-[#e8e6e3] z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
          <span className="font-serif font-semibold text-xl tracking-tight text-[#1a1a1a]">⚡ SparkPlan</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#666]">
          <button onClick={() => scrollTo('features')} className="hover:text-[#1a1a1a] transition-colors">Features</button>
          <button onClick={() => scrollTo('pricing')} className="hover:text-[#1a1a1a] transition-colors">Pricing</button>
          <button onClick={() => scrollTo('faq')} className="hover:text-[#1a1a1a] transition-colors">FAQ</button>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => navigate('/login')}
            className="text-[#666] hover:text-[#1a1a1a] px-4 py-2 text-sm font-medium transition-colors"
          >
            Sign In
          </button>
          <button
            onClick={() => navigate('/signup')}
            className="bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white px-5 py-2 text-sm font-medium rounded-md transition-colors shadow-sm"
          >
            Sign Up
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-gray-600" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-16 bg-white z-40 p-6 flex flex-col gap-6 md:hidden animate-in slide-in-from-right-10">
           <button onClick={() => scrollTo('features')} className="text-lg font-medium text-[#1a1a1a]">Features</button>
           <button onClick={() => scrollTo('pricing')} className="text-lg font-medium text-[#1a1a1a]">Pricing</button>
           <button onClick={() => scrollTo('faq')} className="text-lg font-medium text-[#1a1a1a]">FAQ</button>
           <button onClick={() => navigate('/login')} className="border border-[#e8e6e3] text-[#1a1a1a] py-3 rounded-md font-bold text-center">Sign In</button>
           <button onClick={() => navigate('/signup')} className="bg-[#2d3b2d] text-white py-3 rounded-md font-bold text-center">Sign Up</button>
        </div>
      )}

      {/* 2. Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-12 max-w-7xl mx-auto text-center">
        <h1 className="font-serif text-5xl md:text-6xl font-medium tracking-tight text-[#1a1a1a] mb-6">
          SparkPlan. <br className="hidden md:block"/>
          <span className="text-[#c9a227]">Simplified. Automated.</span>
        </h1>
        <p className="text-xl text-[#666] max-w-2xl mx-auto mb-10 leading-relaxed">
          The modern way to plan, verify, and document electrical installations. Get guided through every NEC step — from load calculations to inspection readiness.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => navigate('/signup')}
            className="w-full sm:w-auto bg-[#2d3b2d] hover:bg-[#3d4f3d] text-white px-8 py-4 text-base font-semibold rounded-md transition-all hover:-translate-y-1"
          >
            Get Started Free
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full sm:w-auto bg-white border border-[#e8e6e3] hover:border-[#ccc] text-[#1a1a1a] px-8 py-4 text-base font-medium rounded-md transition-all"
          >
            Sign In
          </button>
        </div>
      </section>

      {/* 3. Social Proof */}
      <section className="border-y border-[#e8e6e3] bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-[#888] uppercase tracking-widest mb-8">Trusted by modern electrical contractors and engineering teams</p>
          <div className="flex flex-wrap justify-center gap-12 md:gap-20 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
            {/* Placeholder Logos */}
            <span className="text-xl font-bold font-mono">ELECTROPRO</span>
            <span className="text-xl font-bold font-mono">GRIDWORKS</span>
            <span className="text-xl font-bold font-mono">URBAN CURRENT</span>
            <span className="text-xl font-bold font-mono">AMPERION SYSTEMS</span>
          </div>
        </div>
      </section>

      {/* 4. Features Grid */}
      <section id="features" className="py-24 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-12">
          {/* Feature 1 */}
          <div className="space-y-4 group hover:bg-white p-6 rounded-xl transition-colors border border-transparent hover:border-[#e8e6e3] hover:shadow-sm">
            <div className="w-12 h-12 bg-[#e8f5e8] rounded-lg flex items-center justify-center text-[#3d6b3d] group-hover:bg-[#2d3b2d] group-hover:text-white transition-colors">
              <ListChecks className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#1a1a1a]">Guided NEC Workflows</h3>
            <p className="text-[#666] leading-relaxed">
              Follow structured, step-by-step workflows aligned with the NEC — from planning and load calculations to protection devices, grounding, and inspection preparation.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-4 group hover:bg-white p-6 rounded-xl transition-colors border border-transparent hover:border-[#e8e6e3] hover:shadow-sm">
            <div className="w-12 h-12 bg-[#fff8e6] rounded-lg flex items-center justify-center text-[#c9a227] group-hover:bg-[#2d3b2d] group-hover:text-white transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#1a1a1a]">Automated Code Validation</h3>
            <p className="text-[#666] leading-relaxed">
              The system automatically checks conductor sizing, OCPD selection, grounding rules, derating, panel configurations, wiring methods, and more — helping prevent costly code violations.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-4 group hover:bg-white p-6 rounded-xl transition-colors border border-transparent hover:border-[#e8e6e3] hover:shadow-sm">
            <div className="w-12 h-12 bg-[#e6f0ff] rounded-lg flex items-center justify-center text-[#3366cc] group-hover:bg-[#2d3b2d] group-hover:text-white transition-colors">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="font-serif text-xl font-medium text-[#1a1a1a]">Project Documentation Hub</h3>
            <p className="text-[#666] leading-relaxed">
              Store drawings, calculations, checklists, inspection notes, and revision logs in a unified project workspace.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section id="pricing" className="bg-[#2d3b2d] text-white py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-serif text-3xl font-medium mb-4">Simple, transparent pricing.</h2>
            <p className="text-white/70">Choose the plan that fits your team size.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free */}
            <div className="bg-[#1a231a] p-6 rounded-xl border border-[#3d4f3d] flex flex-col">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-medium text-white">Free</h3>
                <p className="text-white/60 mt-2 text-sm h-12">Explore the platform with basic calculators.</p>
              </div>
              <div className="font-serif text-3xl font-medium mb-6">$0<span className="text-lg text-white/50 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-6 flex-1 text-sm">
                {['Explore platform features', '3 projects max', 'Voltage drop calculator', 'Conductor sizing', 'NEC code search'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-white/80">
                    <Check className="w-4 h-4 text-[#c9a227] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/signup')} className="w-full bg-[#3d4f3d] text-white hover:bg-[#4d5f4d] py-2.5 rounded-md font-semibold transition-colors">
                Get Started
              </button>
            </div>

            {/* Starter */}
            <div className="bg-[#1a231a] p-6 rounded-xl border border-[#3d4f3d] flex flex-col">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-medium text-white">Starter</h3>
                <p className="text-white/60 mt-2 text-sm h-12">Full residential workflow with unlimited permits.</p>
              </div>
              <div className="font-serif text-3xl font-medium mb-6">$29<span className="text-lg text-white/50 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-6 flex-1 text-sm">
                {['Unlimited permits per project', '10 projects', 'All residential calculators', 'Permit Packet Generator', 'Jurisdiction Wizard', 'Panel schedules & diagrams'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-white/80">
                    <Check className="w-4 h-4 text-[#c9a227] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/signup')} className="w-full bg-white text-[#1a1a1a] hover:bg-gray-100 py-2.5 rounded-md font-semibold transition-colors">
                Start Free Trial
              </button>
            </div>

            {/* Pro */}
            <div className="bg-[#1a231a] p-6 rounded-xl border-2 border-[#c9a227] relative flex flex-col shadow-sm">
              <div className="absolute top-0 right-0 bg-[#c9a227] text-[#1a1a1a] text-xs font-bold px-2 py-1 rounded-bl-lg rounded-tr-xl">POPULAR</div>
              <div className="mb-4">
                <h3 className="font-serif text-lg font-medium text-white">Pro</h3>
                <p className="text-white/60 mt-2 text-sm h-12">Unlimited projects with EV tools.</p>
              </div>
              <div className="font-serif text-3xl font-medium mb-6">$49<span className="text-lg text-white/50 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-6 flex-1 text-sm">
                {['Unlimited projects', 'Everything in Starter', 'Service Upgrade Wizard', 'EVEMS Calculator', 'EV Panel Templates', 'Priority email support'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-white/80">
                    <Check className="w-4 h-4 text-[#c9a227] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/signup')} className="w-full bg-[#c9a227] hover:bg-[#d4ad32] text-[#1a1a1a] py-2.5 rounded-md font-semibold transition-colors">
                Start Pro Trial
              </button>
            </div>

            {/* Business */}
            <div className="bg-[#1a231a] p-6 rounded-xl border border-[#3d4f3d] flex flex-col">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-medium text-white">Business</h3>
                <p className="text-white/60 mt-2 text-sm h-12">AI suite, PM tools, and team features.</p>
              </div>
              <div className="font-serif text-3xl font-medium mb-6">$149<span className="text-lg text-white/50 font-normal">/mo</span></div>
              <ul className="space-y-3 mb-6 flex-1 text-sm">
                {['Everything in Pro', 'AI Copilot, Inspector & Pre-Inspection', 'Project Management Suite', 'Arc Flash & Advanced SC', 'Team collaboration (5 users)', 'Priority chat + email support'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-white/80">
                    <Check className="w-4 h-4 text-[#c9a227] flex-shrink-0" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={() => navigate('/signup')} className="w-full bg-white text-[#1a1a1a] hover:bg-gray-100 py-2.5 rounded-md font-semibold transition-colors">
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto">
        <h2 className="font-serif text-3xl font-medium text-center mb-16 text-[#1a1a1a]">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            { q: "Is the platform aligned with the National Electrical Code?", a: "Yes. All workflows, calculators, and validations follow the latest NEC edition, with updates as new editions are released." },
            { q: "Can I export my project documentation?", a: "Yes — including PDF, DOCX, panel schedules, load calculations, and full project packages." },
            { q: "Does this help me prepare for inspections?", a: "It provides guided NEC steps and inspector-ready documentation, reducing rework and code issues." },
            { q: "Can my team collaborate?", a: "Yes, with user permissions and project-based access depending on your subscription." },
            { q: "Is my data secure?", a: "We use bank-level encryption (AES-256) for all project data and documents." },
            { q: "Does this replace an inspector?", a: "No. It supports your engineering workflow, but final approval depends on the AHJ." }
          ].map((faq, i) => (
            <div key={i} className="border border-[#e8e6e3] rounded-xl p-6 bg-white hover:shadow-sm transition-shadow">
              <h3 className="font-serif font-medium text-lg text-[#1a1a1a] mb-2">{faq.q}</h3>
              <p className="text-[#666] leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-[#2d3b2d] text-white py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div className="col-span-1">
             <div className="flex items-center gap-2 mb-4">
                <span className="font-serif font-semibold text-lg tracking-tight">⚡ SparkPlan</span>
             </div>
             <p className="text-sm text-white/60">The modern standard for electrical code compliance.</p>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><button onClick={() => scrollTo('features')} className="hover:text-white">Features</button></li>
              <li><button onClick={() => scrollTo('pricing')} className="hover:text-white">Pricing</button></li>
              <li><button onClick={() => scrollTo('faq')} className="hover:text-white">FAQ</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Contact</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
            </ul>
          </div>

          <div>
             <h4 className="font-semibold text-white mb-4">Contact</h4>
             <ul className="space-y-2 text-sm text-white/60">
               <li>support@sparkplan.app</li>
               <li>+1 (555) 987-6543</li>
             </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-white/20 text-center md:text-left flex flex-col md:flex-row justify-between text-sm text-white/40">
          <p>© {new Date().getFullYear()} SparkPlan Inc. All rights reserved.</p>
          <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0">
             <a href="#" className="hover:text-white/80">Privacy Policy</a>
             <a href="#" className="hover:text-white/80">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
