import React, { useState } from 'react';
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

interface LandingPageProps {
  onStart: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900 selection:bg-electric-200">
      
      {/* 1. Navbar */}
      <nav className="fixed top-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-b border-gray-100 z-50 flex items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo(0,0)}>
          <div className="bg-electric-500 w-8 h-8 rounded flex items-center justify-center">
            <Bolt className="text-white w-5 h-5 fill-current" />
          </div>
          <span className="font-bold text-xl tracking-tight text-gray-900">NEC Compliance</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <button onClick={() => scrollTo('features')} className="hover:text-gray-900 transition-colors">Features</button>
          <button onClick={() => scrollTo('pricing')} className="hover:text-gray-900 transition-colors">Pricing</button>
          <button onClick={() => scrollTo('faq')} className="hover:text-gray-900 transition-colors">FAQ</button>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <button 
            onClick={onStart}
            className="bg-electric-400 hover:bg-electric-500 text-gray-900 px-5 py-2 text-sm font-medium rounded-sm transition-colors shadow-sm"
          >
            Get Started
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
           <button onClick={() => scrollTo('features')} className="text-lg font-medium text-gray-900">Features</button>
           <button onClick={() => scrollTo('pricing')} className="text-lg font-medium text-gray-900">Pricing</button>
           <button onClick={() => scrollTo('faq')} className="text-lg font-medium text-gray-900">FAQ</button>
           <button onClick={onStart} className="bg-electric-400 text-gray-900 py-3 rounded-sm font-bold text-center">Get Started</button>
        </div>
      )}

      {/* 2. Hero Section */}
      <section className="pt-32 pb-20 px-6 lg:px-12 max-w-7xl mx-auto text-center">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
          NEC Compliance. <br className="hidden md:block"/>
          <span className="text-gray-400">Simplified. Automated.</span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          The modern way to plan, verify, and document electrical installations. Get guided through every NEC step — from load calculations to inspection readiness.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button 
            onClick={onStart}
            className="w-full sm:w-auto bg-electric-400 hover:bg-electric-500 text-gray-900 px-8 py-4 text-base font-semibold rounded-sm shadow-lg shadow-electric-200 transition-all hover:-translate-y-1"
          >
            Sign In
          </button>
          <button 
            onClick={onStart}
            className="w-full sm:w-auto bg-white border border-gray-200 hover:border-gray-400 text-gray-900 px-8 py-4 text-base font-medium rounded-sm transition-all"
          >
            Start Today
          </button>
        </div>
      </section>

      {/* 3. Social Proof */}
      <section className="border-y border-gray-100 bg-gray-50/50 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-8">Trusted by modern electrical contractors and engineering teams</p>
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
          <div className="space-y-4 group hover:bg-gray-50 p-6 rounded-lg transition-colors border border-transparent hover:border-gray-100">
            <div className="w-12 h-12 bg-electric-50 rounded-lg flex items-center justify-center text-electric-600 group-hover:bg-electric-400 group-hover:text-gray-900 transition-colors">
              <ListChecks className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Guided NEC Workflows</h3>
            <p className="text-gray-600 leading-relaxed">
              Follow structured, step-by-step workflows aligned with the NEC — from planning and load calculations to protection devices, grounding, and inspection preparation.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="space-y-4 group hover:bg-gray-50 p-6 rounded-lg transition-colors border border-transparent hover:border-gray-100">
            <div className="w-12 h-12 bg-electric-50 rounded-lg flex items-center justify-center text-electric-600 group-hover:bg-electric-400 group-hover:text-gray-900 transition-colors">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Automated Code Validation</h3>
            <p className="text-gray-600 leading-relaxed">
              The system automatically checks conductor sizing, OCPD selection, grounding rules, derating, panel configurations, wiring methods, and more — helping prevent costly code violations.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="space-y-4 group hover:bg-gray-50 p-6 rounded-lg transition-colors border border-transparent hover:border-gray-100">
            <div className="w-12 h-12 bg-electric-50 rounded-lg flex items-center justify-center text-electric-600 group-hover:bg-electric-400 group-hover:text-gray-900 transition-colors">
              <FolderKanban className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Project Documentation Hub</h3>
            <p className="text-gray-600 leading-relaxed">
              Store drawings, calculations, checklists, inspection notes, and revision logs in a unified project workspace.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Pricing Section */}
      <section id="pricing" className="bg-gray-900 text-white py-24 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Simple, transparent pricing.</h2>
            <p className="text-gray-400">Choose the plan that fits your team size.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Starter */}
            <div className="bg-gray-800 p-8 rounded-lg border border-gray-700 flex flex-col">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Starter</h3>
                <p className="text-gray-400 mt-2 text-sm h-10">Ideal for electricians or small teams beginning their NEC compliance workflow.</p>
              </div>
              <div className="text-4xl font-bold mb-8">$29<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Guided NEC Workflows', 'Project Dashboard', 'Document Storage (2GB)', 'Load Calculation Templates', '2 Team Members'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-electric-400" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={onStart} className="w-full bg-white text-gray-900 hover:bg-gray-100 py-3 rounded-sm font-semibold transition-colors">
                Get Started
              </button>
            </div>

            {/* Pro */}
            <div className="bg-gray-800 p-8 rounded-lg border border-electric-500 relative flex flex-col shadow-2xl shadow-electric-500/10">
              <div className="absolute top-0 right-0 bg-electric-500 text-gray-900 text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">POPULAR</div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-white">Pro</h3>
                <p className="text-gray-400 mt-2 text-sm h-10">Automation for contractors managing multiple installations and large project scopes.</p>
              </div>
              <div className="text-4xl font-bold mb-8">$79<span className="text-lg text-gray-500 font-normal">/mo</span></div>
              <ul className="space-y-4 mb-8 flex-1">
                {['Automated Validation Engine', 'Multi-Project Support (Up to 5)', 'Grounding & Fault Calculators', 'Digital Inspection Reports', 'Document Storage (10GB)', '5 Team Members'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm text-gray-300">
                    <Check className="w-4 h-4 text-electric-400" /> {item}
                  </li>
                ))}
              </ul>
              <button onClick={onStart} className="w-full bg-electric-400 hover:bg-electric-500 text-gray-900 py-3 rounded-sm font-semibold transition-colors">
                Start Pro Trial
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ Section */}
      <section id="faq" className="py-24 px-6 lg:px-12 max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">Frequently Asked Questions</h2>
        <div className="space-y-6">
          {[
            { q: "Is the platform aligned with the National Electrical Code?", a: "Yes. All workflows, calculators, and validations follow the latest NEC edition, with updates as new editions are released." },
            { q: "Can I export my project documentation?", a: "Yes — including PDF, DOCX, panel schedules, load calculations, and full project packages." },
            { q: "Does this help me prepare for inspections?", a: "It provides guided NEC steps and inspector-ready documentation, reducing rework and code issues." },
            { q: "Can my team collaborate?", a: "Yes, with user permissions and project-based access depending on your subscription." },
            { q: "Is my data secure?", a: "We use bank-level encryption (AES-256) for all project data and documents." },
            { q: "Does this replace an inspector?", a: "No. It supports your engineering workflow, but final approval depends on the AHJ." }
          ].map((faq, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-6 hover:shadow-sm transition-shadow">
              <h3 className="font-semibold text-lg text-gray-900 mb-2">{faq.q}</h3>
              <p className="text-gray-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-gray-50 border-t border-gray-100 py-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
          <div className="col-span-1">
             <div className="flex items-center gap-2 mb-4">
                <div className="bg-electric-500 w-6 h-6 rounded flex items-center justify-center">
                  <Bolt className="text-white w-4 h-4 fill-current" />
                </div>
                <span className="font-bold text-lg tracking-tight text-gray-900">NEC Compliance</span>
             </div>
             <p className="text-sm text-gray-500">The modern standard for electrical code compliance.</p>
          </div>
          
          <div>
            <h4 className="font-bold text-gray-900 mb-4">Product</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><button onClick={() => scrollTo('features')} className="hover:text-gray-900">Features</button></li>
              <li><button onClick={() => scrollTo('pricing')} className="hover:text-gray-900">Pricing</button></li>
              <li><button onClick={() => scrollTo('faq')} className="hover:text-gray-900">FAQ</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-gray-900">About</a></li>
              <li><a href="#" className="hover:text-gray-900">Contact</a></li>
              <li><a href="#" className="hover:text-gray-900">Careers</a></li>
            </ul>
          </div>

          <div>
             <h4 className="font-bold text-gray-900 mb-4">Contact</h4>
             <ul className="space-y-2 text-sm text-gray-500">
               <li>support@neccompliance.com</li>
               <li>+1 (555) 987-6543</li>
             </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-200 text-center md:text-left flex flex-col md:flex-row justify-between text-sm text-gray-400">
          <p>© {new Date().getFullYear()} NEC Compliance Inc. All rights reserved.</p>
          <div className="flex gap-6 justify-center md:justify-end mt-4 md:mt-0">
             <a href="#" className="hover:text-gray-600">Privacy Policy</a>
             <a href="#" className="hover:text-gray-600">Terms of Service</a>
          </div>
        </div>
      </footer>

    </div>
  );
};
