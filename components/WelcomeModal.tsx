/**
 * Welcome Modal Component - Industrial Schematic Design
 * System initialization interface for new users
 */

import React, { useState } from 'react';
import { X, Zap, Check, Rocket, FileText, Calculator, CircuitBoard, Activity, ChevronRight } from 'lucide-react';
import { TemplateType } from '../services/sampleTemplates';

interface WelcomeModalProps {
  onClose: () => void;
  onCreateProject: (templateType?: TemplateType) => void;
}

// Status LED component
const StatusLED = ({ active = true, color = 'emerald' }: { active?: boolean; color?: string }) => (
  <div
    className={`w-2 h-2 rounded-full flex-shrink-0 ${
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

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose, onCreateProject }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | undefined>('residential');

  const steps = [
    {
      title: 'System Initialization',
      subtitle: 'NEC Pro Compliance Platform',
      icon: <Zap className="w-8 h-8 text-amber-400" />,
      description: 'Professional electrical design and compliance platform powered by AI.',
      content: (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Core system modules activated:
          </p>
          <div className="space-y-2">
            {[
              { label: 'Load Calculations', sub: 'NEC 220.82, 220.84, Commercial Methods' },
              { label: 'One-Line Diagrams', sub: 'Professional riser diagrams with PDF export' },
              { label: 'Panel Schedules', sub: 'Automated circuit tracking and panel design' },
              { label: 'AI NEC Assistant', sub: 'Instant answers to code questions' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
                <div className="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-white">{item.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: 'Module Overview',
      subtitle: 'System Capabilities',
      icon: <Calculator className="w-8 h-8 text-amber-400" />,
      description: 'Complete toolkit for electrical design and compliance.',
      content: (
        <div className="grid grid-cols-2 gap-3">
          {[
            { title: 'Calculations', color: 'blue', items: ['Voltage Drop', 'Short Circuit', 'Arc Flash', 'Feeder Sizing', 'EV Charging'] },
            { title: 'Management', color: 'emerald', items: ['RFI Tracking', 'Site Visit Logs', 'Calendar Events', 'Inspector AI'] },
            { title: 'Export', color: 'purple', items: ['PDF Export', 'Permit Packets', 'Panel Schedules', 'One-Line Diagrams'] },
            { title: 'Compliance', color: 'amber', items: ['Grounding System', 'Pre-Inspection', 'NEC Validation', 'Code References'] },
          ].map((module, i) => (
            <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <StatusLED active color={module.color === 'amber' ? 'amber' : 'emerald'} />
                <h4 className="font-semibold text-white text-sm">{module.title}</h4>
              </div>
              <ul className="space-y-1.5">
                {module.items.map((item, j) => (
                  <li key={j} className="text-xs text-slate-400 flex items-center gap-2">
                    <span className="w-1 h-1 bg-slate-600 rounded-full" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: 'Initialize Project',
      subtitle: 'Select Template',
      icon: <Rocket className="w-8 h-8 text-amber-400" />,
      description: 'Choose a project template to begin system configuration.',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'residential' as TemplateType, icon: '01', title: 'Residential Home', desc: '2,400 sq ft single-family' },
              { id: 'commercial' as TemplateType, icon: '02', title: 'Commercial Office', desc: '5,000 sq ft with HVAC' },
              { id: 'industrial' as TemplateType, icon: '03', title: 'Light Manufacturing', desc: '10,000 sq ft with machinery' },
              { id: 'ev-charging' as TemplateType, icon: '04', title: 'EV Charging Install', desc: 'Residential Level 2 charger' },
            ].map((template) => (
              <button
                key={template.id}
                onClick={() => setSelectedTemplate(template.id)}
                className={`text-left border rounded-lg p-4 transition-all ${
                  selectedTemplate === template.id
                    ? 'border-amber-400/50 bg-amber-400/10'
                    : 'border-slate-700 bg-slate-800/30 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded flex items-center justify-center font-mono text-xs ${
                    selectedTemplate === template.id
                      ? 'bg-amber-400/20 text-amber-400'
                      : 'bg-slate-800 text-slate-500'
                  }`}>
                    {template.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-sm ${
                      selectedTemplate === template.id ? 'text-amber-400' : 'text-white'
                    }`}>
                      {template.title}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">{template.desc}</p>
                  </div>
                  {selectedTemplate === template.id && (
                    <StatusLED active color="amber" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <CircuitBoard className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-medium text-blue-400 font-mono uppercase tracking-wider">Template Info</span>
            </div>
            <p className="text-xs text-slate-400">
              Sample projects include pre-configured loads, grounding system, and project settings. All data can be modified after creation.
            </p>
          </div>

          <div className="bg-amber-400/10 border border-amber-400/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400 font-mono uppercase tracking-wider">Pro Tip</span>
            </div>
            <p className="text-xs text-slate-400">
              Use the AI NEC Assistant (chat icon in bottom-right) to ask code questions while you work!
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-800/50 border-b border-slate-700/50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-500 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full border border-slate-900" />
            </div>
            <div>
              <span className="font-bold text-white" style={{ fontFamily: "'JetBrains Mono', monospace" }}>NEC PRO</span>
              <div className="flex items-center gap-1.5">
                <StatusLED active />
                <span className="text-[9px] text-slate-500 uppercase tracking-wider">Initializing</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <VoltageBar level={currentStep + 2} />
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded flex items-center justify-center font-mono text-xs transition-all ${
                    index === currentStep
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/50'
                      : index < currentStep
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-600'
                  }`}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-px ${
                    index < currentStep ? 'bg-emerald-500/50' : 'bg-slate-700'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-800 border border-slate-700 rounded-xl mb-4">
              {currentStepData.icon}
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <StatusLED active color="amber" />
              <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{currentStepData.subtitle}</span>
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-slate-400">
              {currentStepData.description}
            </p>
          </div>

          <div className="mb-6">
            {currentStepData.content}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-800/30 border-t border-slate-700/50 px-5 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          <div className="text-xs text-slate-600 font-mono">
            Step {String(currentStep + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="group px-5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onCreateProject(selectedTemplate);
              }}
              className="group px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-900 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              <Activity className="w-4 h-4" />
              Initialize Project
              <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
