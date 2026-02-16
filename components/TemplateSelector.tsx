/**
 * Template Selector Component
 * Allows users to choose from pre-configured project templates
 * Speeds up project creation for common scenarios
 */

import React, { useState } from 'react';
import { X, Check, Clock, Zap } from 'lucide-react';
import { ProjectType } from '../types';
import {
  getAllTemplates,
  getTemplateById,
  type ProjectTemplate
} from '../data/project-templates';
import { TemplateType, getTemplateInfo } from '../services/sampleTemplates';

interface TemplateSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (template: ProjectTemplate | null, projectType?: ProjectType) => void;
  onSelectSampleTemplate?: (templateType: TemplateType) => void;
}

export const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
  onSelectSampleTemplate
}) => {
  const [selectedType, setSelectedType] = useState<ProjectType>(ProjectType.RESIDENTIAL);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedSampleTemplate, setSelectedSampleTemplate] = useState<TemplateType | null>(null);

  const allTemplates = getAllTemplates();
  const templates = allTemplates[selectedType];

  // Define sample templates for quick start
  const sampleTemplates: Array<{type: TemplateType, icon: string, projectType: ProjectType}> = [
    { type: 'residential', icon: '🏠', projectType: ProjectType.RESIDENTIAL },
    { type: 'ev-charging', icon: '⚡', projectType: ProjectType.RESIDENTIAL },
    { type: 'commercial', icon: '🏢', projectType: ProjectType.COMMERCIAL },
    { type: 'industrial', icon: '🏭', projectType: ProjectType.INDUSTRIAL },
  ];

  const visibleSampleTemplates = sampleTemplates.filter(t => t.projectType === selectedType);

  const handleSelectTemplate = () => {
    if (selectedSampleTemplate && onSelectSampleTemplate) {
      // Use new comprehensive sample template
      onSelectSampleTemplate(selectedSampleTemplate);
      onClose();
    } else if (selectedTemplateId) {
      // Use old panel/circuit template
      const template = getTemplateById(selectedTemplateId);
      onSelectTemplate(template || null);
      onClose();
    } else {
      // Start blank - pass the selected project type from tabs
      onSelectTemplate(null, selectedType);
      onClose();
    }
  };

  const handleStartBlank = () => {
    onSelectTemplate(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-semibold">Choose a Project Template</h2>
            <p className="text-sm text-gray-300 mt-1">
              Start with a pre-configured template or create from scratch
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Project Type Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50 px-6">
          {Object.values(ProjectType).map((type) => (
            <button
              key={type}
              onClick={() => {
                setSelectedType(type);
                setSelectedTemplateId(null);
              }}
              className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                selectedType === type
                  ? 'border-[#2d3b2d] text-[#2d3b2d]'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Quick Start Templates Section */}
          {visibleSampleTemplates.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2d3b2d]" />
                Quick Start Templates
              </h3>
              <p className="text-xs text-gray-600 mb-4">
                Complete project templates with loads, grounding, and NEC-compliant settings
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {visibleSampleTemplates.map((template) => {
                  const info = getTemplateInfo(template.type);
                  return (
                    <button
                      key={template.type}
                      onClick={() => {
                        setSelectedSampleTemplate(template.type);
                        setSelectedTemplateId(null);
                      }}
                      className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                        selectedSampleTemplate === template.type
                          ? 'border-[#2d3b2d] bg-[#f0f5f0]'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-4xl">{template.icon}</div>
                        {selectedSampleTemplate === template.type && (
                          <Check className="w-6 h-6 text-[#2d3b2d]" />
                        )}
                      </div>
                      <h4 className="font-semibold text-lg text-gray-900 mb-2">
                        {info.name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">
                        {info.description}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="font-medium">Includes:</span>
                        <span>{info.loadCount} pre-configured loads + grounding</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Detailed Panel Templates Section */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Advanced Panel Templates
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Pre-configured panels with detailed circuit layouts
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Blank Option */}
              <button
                onClick={() => {
                  setSelectedTemplateId(null);
                  setSelectedSampleTemplate(null);
                }}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                  selectedTemplateId === null && selectedSampleTemplate === null
                    ? 'border-[#2d3b2d] bg-[#f0f5f0]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
              <div className="flex items-start justify-between mb-3">
                <div className="text-4xl">⚡</div>
                {selectedTemplateId === null && selectedSampleTemplate === null && (
                  <Check className="w-6 h-6 text-[#2d3b2d]" />
                )}
              </div>
              <h3 className="font-semibold text-lg text-gray-900 mb-2">
                Start from Scratch
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Create a blank project and build your design from the ground up
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Zap className="w-4 h-4" />
                <span>Full control, no presets</span>
              </div>
            </button>

            {/* Template Options */}
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setSelectedSampleTemplate(null);
                }}
                className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-lg ${
                  selectedTemplateId === template.id
                    ? 'border-[#2d3b2d] bg-[#f0f5f0]'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{template.icon}</div>
                  {selectedTemplateId === template.id && (
                    <Check className="w-6 h-6 text-[#2d3b2d]" />
                  )}
                </div>

                <h3 className="font-semibold text-lg text-gray-900 mb-2">
                  {template.name}
                </h3>

                <p className="text-sm text-gray-600 mb-3">
                  {template.description}
                </p>

                <div className="space-y-2 mb-3">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-medium">Service:</span>
                    <span>
                      {template.serviceVoltage}V {template.servicePhase}-Phase
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-medium">Panels:</span>
                    <span>{template.panels.length} pre-configured</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="font-medium">Circuits:</span>
                    <span>
                      {template.panels.reduce(
                        (sum, panel) => sum + panel.circuits.length,
                        0
                      )}{' '}
                      typical circuits
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 pt-3 border-t border-gray-200">
                  <Clock className="w-4 h-4" />
                  <span>Setup time: {template.estimatedTime}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
        <div className="bg-gray-50 p-6 flex justify-end items-center border-t border-gray-200 gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectTemplate}
            className="px-6 py-2 rounded-md font-medium bg-[#2d3b2d] text-white hover:bg-[#2d3b2d] transition-colors"
          >
            {selectedSampleTemplate || selectedTemplateId ? 'Use This Template' : 'Start Blank Project'}
          </button>
        </div>
      </div>
    </div>
  );
};
