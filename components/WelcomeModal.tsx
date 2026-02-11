/**
 * Welcome Modal Component
 * Shown to new users on first login
 */

import React, { useState } from 'react';
import { X, Zap, CheckCircle, Rocket, FileText, Calculator } from 'lucide-react';
import { TemplateType } from '../services/sampleTemplates';

interface WelcomeModalProps {
  onClose: () => void;
  onCreateProject: (templateType?: TemplateType) => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose, onCreateProject }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType | undefined>('residential');

  const steps = [
    {
      title: 'Welcome to SparkPlan',
      icon: <Zap className="w-12 h-12 text-electric-500" />,
      description: 'Your professional electrical design and compliance platform powered by AI.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            SparkPlan helps electrical contractors and engineers design safe, compliant electrical systems with:
          </p>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">
                <strong>Load Calculations</strong> - NEC 220.82, 220.84, and commercial methods
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">
                <strong>One-Line Diagrams</strong> - Professional riser diagrams with PDF export
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">
                <strong>Panel Schedules</strong> - Automated circuit tracking and panel design
              </span>
            </li>
            <li className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">
                <strong>AI NEC Assistant</strong> - Instant answers to code questions
              </span>
            </li>
          </ul>
        </div>
      ),
    },
    {
      title: 'Professional Features',
      icon: <Calculator className="w-12 h-12 text-electric-500" />,
      description: 'Everything you need for electrical design and compliance.',
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Calculations</h4>
              <ul className="space-y-1 text-xs text-gray-700">
                <li>• Voltage Drop</li>
                <li>• Short Circuit</li>
                <li>• Arc Flash</li>
                <li>• Feeder Sizing</li>
                <li>• EV Charging</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Project Management</h4>
              <ul className="space-y-1 text-xs text-gray-700">
                <li>• RFI Tracking</li>
                <li>• Site Visit Logs</li>
                <li>• Calendar Events</li>
                <li>• Inspector AI</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Export & Sharing</h4>
              <ul className="space-y-1 text-xs text-gray-700">
                <li>• PDF Export</li>
                <li>• Permit Packets</li>
                <li>• Panel Schedules</li>
                <li>• One-Line Diagrams</li>
              </ul>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-2">Compliance</h4>
              <ul className="space-y-1 text-xs text-gray-700">
                <li>• Grounding System</li>
                <li>• Pre-Inspection Check</li>
                <li>• NEC Validation</li>
                <li>• Code References</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Ready to Get Started?',
      icon: <Rocket className="w-12 h-12 text-electric-500" />,
      description: 'Create your first project and start designing compliant electrical systems.',
      content: (
        <div className="space-y-4">
          <p className="text-gray-600">
            Choose a project template to get started:
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedTemplate('residential')}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                selectedTemplate === 'residential'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200 bg-gray-50 hover:border-electric-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">🏠</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900">Residential Home</h4>
                  <p className="text-xs text-gray-600 mt-1">2,400 sq ft single-family with typical loads</p>
                </div>
                {selectedTemplate === 'residential' && (
                  <CheckCircle className="w-5 h-5 text-electric-600 flex-shrink-0" />
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedTemplate('commercial')}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                selectedTemplate === 'commercial'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200 bg-gray-50 hover:border-electric-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">🏢</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900">Commercial Office</h4>
                  <p className="text-xs text-gray-600 mt-1">5,000 sq ft office with HVAC</p>
                </div>
                {selectedTemplate === 'commercial' && (
                  <CheckCircle className="w-5 h-5 text-electric-600 flex-shrink-0" />
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedTemplate('industrial')}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                selectedTemplate === 'industrial'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200 bg-gray-50 hover:border-electric-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">🏭</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900">Light Manufacturing</h4>
                  <p className="text-xs text-gray-600 mt-1">10,000 sq ft with machinery</p>
                </div>
                {selectedTemplate === 'industrial' && (
                  <CheckCircle className="w-5 h-5 text-electric-600 flex-shrink-0" />
                )}
              </div>
            </button>

            <button
              onClick={() => setSelectedTemplate('ev-charging')}
              className={`text-left border-2 rounded-lg p-4 transition-all ${
                selectedTemplate === 'ev-charging'
                  ? 'border-electric-500 bg-electric-50'
                  : 'border-gray-200 bg-gray-50 hover:border-electric-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">⚡</div>
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-gray-900">EV Charging Install</h4>
                  <p className="text-xs text-gray-600 mt-1">Residential with Level 2 charger</p>
                </div>
                {selectedTemplate === 'ev-charging' && (
                  <CheckCircle className="w-5 h-5 text-electric-600 flex-shrink-0" />
                )}
              </div>
            </button>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-4">
            <p className="text-xs text-gray-700">
              <strong>Sample projects include:</strong> Pre-configured loads, grounding system, and project settings.
              You can modify everything after creation!
            </p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
            <h4 className="font-semibold text-gray-900 text-sm mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Pro Tip
            </h4>
            <p className="text-xs text-gray-700">
              Use the AI NEC Assistant (chat icon in bottom-right) to ask code questions while you work!
            </p>
          </div>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-electric-500 rounded flex items-center justify-center">
              <Zap className="text-white w-6 h-6 fill-current" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">SPARKPLAN</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'w-8 bg-electric-500'
                    : index < currentStep
                    ? 'w-2 bg-electric-300'
                    : 'w-2 bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center mb-4">
              {currentStepData.icon}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {currentStepData.title}
            </h3>
            <p className="text-sm text-gray-600">
              {currentStepData.description}
            </p>
          </div>

          <div className="mb-8">
            {currentStepData.content}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Back
          </button>

          <div className="text-xs text-gray-500">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-4 py-2 bg-electric-500 hover:bg-electric-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={() => {
                onClose();
                onCreateProject(selectedTemplate);
              }}
              className="px-6 py-2 bg-electric-500 hover:bg-electric-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <Rocket className="w-4 h-4" />
              Create Project from Template
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
