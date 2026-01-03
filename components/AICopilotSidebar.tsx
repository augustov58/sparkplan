import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Check,
  XCircle,
  AlertTriangle,
  Info,
  TrendingUp,
  MessageSquare,
  Camera,
  Shield,
  Clock,
  BookOpen,
  CheckSquare
} from 'lucide-react';
import { useAgentActions } from '../hooks/useAgentActions';
import type { AgentAction } from '../types';

// ============================================================================
// TypeScript Interfaces for Pydantic AI Prediction Data
// ============================================================================

interface PredictedIssue {
  category: string;
  description: string;
  nec_reference: string;
  likelihood: number; // 0.0 - 1.0
  suggested_fix: string;
  estimated_fix_time: string;
}

interface InspectionPrediction {
  failure_likelihood: number; // 0.0 - 1.0
  risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
  predicted_issues: PredictedIssue[];
  preparation_checklist: string[];
  estimated_prep_time: string;
  confidence: number; // 0.0 - 1.0
}

interface RFIDraft {
  subject: string;
  question: string;
  suggested_recipient: string | null;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  related_nec_articles: string[];
  rationale: string;
}

interface NecViolation {
  nec_article: string;
  description: string;
  severity: 'Info' | 'Warning' | 'Critical';
  recommendation: string;
  location_in_photo: string | null;
}

interface Equipment {
  type: string;
  manufacturer: string | null;
  model: string | null;
  rating: string | null;
  condition: 'Good' | 'Fair' | 'Poor' | 'Unknown';
}

interface PhotoAnalysis {
  summary: string;
  violations: NecViolation[];
  equipment_identified: Equipment[];
  recommendations: string[];
  severity: 'Info' | 'Warning' | 'Critical';
  requires_correction: boolean;
  suggested_actions: string[];
}

export const AICopilotSidebar: React.FC = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const { actions, loading, approve, reject } = useAgentActions(projectId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const getPriorityColor = (priority: number) => {
    if (priority >= 80) return 'text-red-600 bg-red-50 border-red-200';
    if (priority >= 60) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (priority >= 40) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'change_impact': return <TrendingUp className="w-4 h-4" />;
      case 'photo_analyzer': return <Camera className="w-4 h-4" />;
      case 'predictive_inspector': return <Shield className="w-4 h-4" />;
      case 'rfi_drafter': return <MessageSquare className="w-4 h-4" />;
      default: return <Sparkles className="w-4 h-4" />;
    }
  };

  const getAgentLabel = (agentName: string) => {
    switch (agentName) {
      case 'change_impact': return 'Change Impact';
      case 'photo_analyzer': return 'Photo Analysis';
      case 'predictive_inspector': return 'Inspection Prediction';
      case 'rfi_drafter': return 'RFI Draft';
      case 'content_generator': return 'Content Generator';
      default: return 'AI Agent';
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-4 bottom-24 bg-electric-500 text-white p-3 rounded-full shadow-lg hover:bg-electric-600 transition-colors z-50"
        aria-label="Open AI Copilot"
        title="AI Copilot - View AI suggestions"
      >
        <Sparkles className="w-6 h-6" />
        {actions.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {actions.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <>
      {/* Mobile overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-16 bottom-0 w-full max-w-sm md:w-96 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-electric-50 to-blue-50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-electric-500" />
          <h2 className="font-semibold text-gray-900">AI Copilot</h2>
          {actions.length > 0 && (
            <span className="bg-electric-500 text-white text-xs font-medium px-2 py-1 rounded-full">
              {actions.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Actions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <Sparkles className="w-8 h-8 mx-auto mb-2 animate-pulse text-electric-500" />
            <p className="text-sm">Loading AI suggestions...</p>
          </div>
        ) : actions.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Info className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm font-medium">No pending suggestions</p>
            <p className="text-xs mt-1">AI is monitoring your project</p>
          </div>
        ) : (
          actions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              expanded={expanded === action.id}
              onToggle={() => setExpanded(expanded === action.id ? null : action.id)}
              onApprove={() => approve(action.id)}
              onReject={() => reject(action.id)}
              getPriorityColor={getPriorityColor}
              getAgentIcon={getAgentIcon}
              getAgentLabel={getAgentLabel}
            />
          ))
        )}
      </div>
    </div>
    </>
  );
};

// ============================================================================
// RFI Draft Display Component
// ============================================================================

interface RFIDraftViewProps {
  draft: RFIDraft;
}

const RFIDraftView: React.FC<RFIDraftViewProps> = ({ draft }) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-3">
      {/* Priority & Subject */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getPriorityColor(draft.priority)}`}>
            {draft.priority} Priority
          </span>
          {draft.suggested_recipient && (
            <span className="text-xs text-gray-600">
              To: <span className="font-medium">{draft.suggested_recipient}</span>
            </span>
          )}
        </div>

        <h4 className="text-sm font-bold text-gray-900 mb-1">{draft.subject}</h4>
        <p className="text-xs text-gray-600 italic">{draft.rationale}</p>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h5 className="text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
          <MessageSquare className="w-3 h-3 text-blue-500" />
          Question:
        </h5>
        <p className="text-xs text-gray-700 whitespace-pre-wrap">{draft.question}</p>
      </div>

      {/* NEC References */}
      {draft.related_nec_articles.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <h5 className="text-xs font-bold text-blue-800 mb-1.5 flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            Related NEC Articles:
          </h5>
          <div className="flex flex-wrap gap-1.5">
            {draft.related_nec_articles.map((article, index) => (
              <span key={index} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">
                {article}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Photo Analysis Display Component
// ============================================================================

interface PhotoAnalysisViewProps {
  analysis: PhotoAnalysis;
}

const PhotoAnalysisView: React.FC<PhotoAnalysisViewProps> = ({ analysis }) => {
  const [expandedViolations, setExpandedViolations] = useState<Set<number>>(new Set());

  const toggleViolation = (index: number) => {
    const newExpanded = new Set(expandedViolations);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedViolations(newExpanded);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'Warning': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Info': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'Good': return 'text-green-700 bg-green-50';
      case 'Fair': return 'text-yellow-700 bg-yellow-50';
      case 'Poor': return 'text-red-700 bg-red-50';
      default: return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <div className="space-y-3">
      {/* Summary & Overall Severity */}
      <div className="bg-gradient-to-r from-gray-50 to-purple-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-start justify-between mb-2">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(analysis.severity)}`}>
            {analysis.severity}
          </span>
          {analysis.requires_correction && (
            <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
              Correction Required
            </span>
          )}
        </div>
        <p className="text-xs text-gray-700">{analysis.summary}</p>
      </div>

      {/* NEC Violations */}
      {analysis.violations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            NEC Violations Detected ({analysis.violations.length})
          </h4>

          {analysis.violations.map((violation, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-red-200 overflow-hidden hover:shadow-sm transition-shadow"
            >
              {/* Violation Header */}
              <div
                className="p-2 cursor-pointer hover:bg-red-50 transition-colors"
                onClick={() => toggleViolation(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${getSeverityColor(violation.severity)} px-2 py-0.5 rounded`}>
                        {violation.severity}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">
                        {violation.nec_article}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 line-clamp-2">{violation.description}</p>
                    {violation.location_in_photo && (
                      <p className="text-xs text-gray-500 mt-0.5">📍 {violation.location_in_photo}</p>
                    )}
                  </div>
                  {expandedViolations.has(index) ? (
                    <ChevronUp className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" />
                  )}
                </div>
              </div>

              {/* Expanded Recommendation */}
              {expandedViolations.has(index) && (
                <div className="px-2 pb-2 bg-red-50 border-t border-red-100">
                  <div className="bg-white rounded p-2 mt-2">
                    <p className="text-xs text-gray-600 font-medium mb-0.5">Recommendation:</p>
                    <p className="text-xs text-gray-700">{violation.recommendation}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Equipment Identified */}
      {analysis.equipment_identified.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
          <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
            <Camera className="w-3 h-3 text-gray-500" />
            Equipment Identified ({analysis.equipment_identified.length})
          </h4>
          <div className="space-y-2">
            {analysis.equipment_identified.map((equip, index) => (
              <div key={index} className="bg-white rounded p-2 border border-gray-200">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-900">{equip.type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${getConditionColor(equip.condition)}`}>
                    {equip.condition}
                  </span>
                </div>
                <div className="text-xs text-gray-600 space-y-0.5">
                  {equip.manufacturer && <p>• Manufacturer: {equip.manufacturer}</p>}
                  {equip.model && <p>• Model: {equip.model}</p>}
                  {equip.rating && <p>• Rating: {equip.rating}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Actions */}
      {analysis.suggested_actions.length > 0 && (
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <h4 className="text-xs font-bold text-green-800 mb-1.5 flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            Suggested Actions
          </h4>
          <ul className="space-y-1">
            {analysis.suggested_actions.map((action, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-green-900">
                <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* General Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <h4 className="text-xs font-bold text-blue-800 mb-1.5">General Recommendations:</h4>
          <ul className="text-xs text-blue-900 space-y-1">
            {analysis.recommendations.map((rec, index) => (
              <li key={index}>• {rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Inspection Prediction Display Component
// ============================================================================

interface InspectionPredictionViewProps {
  prediction: InspectionPrediction;
}

const InspectionPredictionView: React.FC<InspectionPredictionViewProps> = ({ prediction }) => {
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());

  const toggleIssue = (index: number) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedIssues(newExpanded);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'Critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'High': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getLikelihoodColor = (likelihood: number) => {
    if (likelihood >= 0.7) return 'bg-red-500';
    if (likelihood >= 0.4) return 'bg-orange-500';
    if (likelihood >= 0.2) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-3">
      {/* Risk Level & Failure Likelihood */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-3 border border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getRiskColor(prediction.risk_level)}`}>
            {prediction.risk_level} Risk
          </span>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3 text-gray-500" />
            <span className="text-xs text-gray-600 font-medium">{prediction.estimated_prep_time}</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">Failure Likelihood</span>
            <span className="text-gray-900 font-bold">{Math.round(prediction.failure_likelihood * 100)}%</span>
          </div>
          <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all ${getLikelihoodColor(prediction.failure_likelihood)}`}
              style={{ width: `${prediction.failure_likelihood * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Predicted Issues */}
      {prediction.predicted_issues && prediction.predicted_issues.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-orange-500" />
            Predicted Issues ({prediction.predicted_issues.length})
          </h4>

          {prediction.predicted_issues.map((issue, index) => (
            <div
              key={index}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
            >
              {/* Issue Header */}
              <div
                className="p-2 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleIssue(index)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-900">{issue.category}</span>
                      <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-mono">
                        {issue.nec_reference}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-1">{issue.description}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 font-medium">
                      {Math.round(issue.likelihood * 100)}%
                    </span>
                    {expandedIssues.has(index) ? (
                      <ChevronUp className="w-3 h-3 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Likelihood Bar */}
                <div className="mt-1.5 bg-gray-200 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-1 rounded-full ${getLikelihoodColor(issue.likelihood)}`}
                    style={{ width: `${issue.likelihood * 100}%` }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {expandedIssues.has(index) && (
                <div className="px-2 pb-2 space-y-2 bg-gray-50 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-600 font-medium mb-0.5">Description:</p>
                    <p className="text-xs text-gray-700">{issue.description}</p>
                  </div>

                  <div className="bg-blue-50 rounded p-2 border border-blue-100">
                    <p className="text-xs text-blue-700 font-medium mb-0.5 flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      Suggested Fix:
                    </p>
                    <p className="text-xs text-blue-900">{issue.suggested_fix}</p>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    <span>Estimated time: {issue.estimated_fix_time}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Preparation Checklist */}
      {prediction.preparation_checklist && prediction.preparation_checklist.length > 0 && (
        <div className="bg-green-50 rounded-lg p-3 border border-green-200">
          <h4 className="text-xs font-bold text-green-800 mb-2 flex items-center gap-1">
            <CheckSquare className="w-3 h-3" />
            Preparation Checklist
          </h4>
          <ul className="space-y-1">
            {prediction.preparation_checklist.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-green-900">
                <Check className="w-3 h-3 text-green-600 flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

interface ActionCardProps {
  action: AgentAction;
  expanded: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  getPriorityColor: (priority: number) => string;
  getAgentIcon: (agentName: string) => React.ReactNode;
  getAgentLabel: (agentName: string) => string;
}

const ActionCard: React.FC<ActionCardProps> = ({
  action,
  expanded,
  onToggle,
  onApprove,
  onReject,
  getPriorityColor,
  getAgentIcon,
  getAgentLabel,
}) => {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`p-1.5 rounded border ${getPriorityColor(action.priority)}`}>
                {getAgentIcon(action.agent_name)}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                {getAgentLabel(action.agent_name)}
              </span>
            </div>
            <h3 className="font-medium text-sm text-gray-900 mb-1">{action.title}</h3>
            <p className="text-xs text-gray-600 line-clamp-2">{action.description}</p>
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
          )}
        </div>

        {/* Confidence Score Bar */}
        {action.confidence_score !== undefined && action.confidence_score !== null && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Confidence:</span>
            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-electric-500 h-1.5 rounded-full transition-all"
                style={{ width: `${action.confidence_score * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 font-medium">
              {Math.round(action.confidence_score * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-3 pt-0 space-y-3 bg-white">
          {/* Reasoning */}
          {action.reasoning && (
            <div className="bg-blue-50 rounded p-3 text-xs border border-blue-100">
              <p className="text-blue-700 font-medium mb-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                AI Reasoning:
              </p>
              <p className="text-blue-900">{action.reasoning}</p>
            </div>
          )}

          {/* Impact Analysis */}
          {action.impact_analysis && (
            <div className="bg-gray-50 rounded p-3 text-xs border border-gray-200 space-y-2">
              <p className="text-gray-700 font-medium mb-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Impact Analysis:
              </p>
              <p className="text-gray-700">{action.impact_analysis.impact_summary}</p>

              {/* Service Impact */}
              {action.impact_analysis.service_impact && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-600 font-medium text-xs mb-1">Service Impact:</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      action.impact_analysis.service_impact.upgrade_needed
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {action.impact_analysis.service_impact.upgrade_needed ? 'Upgrade Required' : 'OK'}
                    </span>
                    <span className="text-xs text-gray-600">
                      {action.impact_analysis.service_impact.utilization_after.toFixed(1)}% utilization
                    </span>
                  </div>
                </div>
              )}

              {/* Cost Estimate */}
              {action.impact_analysis.cost_estimate && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-600 font-medium text-xs mb-1">Estimated Cost:</p>
                  <p className="text-gray-900 font-bold">
                    ${action.impact_analysis.cost_estimate.low.toLocaleString()} -
                    ${action.impact_analysis.cost_estimate.high.toLocaleString()}
                  </p>
                </div>
              )}

              {/* Timeline Impact */}
              {action.impact_analysis.timeline_impact && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-600 font-medium text-xs mb-1">Timeline Impact:</p>
                  <p className="text-gray-700 text-xs">
                    +{action.impact_analysis.timeline_impact.delay_days} days delay
                  </p>
                </div>
              )}

              {/* Recommendations */}
              {action.impact_analysis.recommendations && action.impact_analysis.recommendations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-gray-600 font-medium text-xs mb-1">Recommendations:</p>
                  <ul className="list-disc list-inside space-y-0.5">
                    {action.impact_analysis.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-xs text-gray-700">{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* RFI Draft (RFI Drafter Agent) */}
          {action.agent_name === 'rfi_drafter' && action.action_data && (
            <RFIDraftView draft={action.action_data as RFIDraft} />
          )}

          {/* Photo Analysis (Photo Analyzer Agent) */}
          {action.agent_name === 'photo_analyzer' && action.action_data && (
            <PhotoAnalysisView analysis={action.action_data as PhotoAnalysis} />
          )}

          {/* Inspection Prediction (Predictive Inspector Agent) */}
          {action.agent_name === 'predictive_inspector' && action.action_data && (
            <InspectionPredictionView prediction={action.action_data as InspectionPrediction} />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={(e) => { e.stopPropagation(); onApprove(); }}
              className="flex-1 bg-electric-500 text-white px-3 py-2 rounded text-sm font-medium hover:bg-electric-600 transition-colors flex items-center justify-center gap-1 shadow-sm"
            >
              <Check className="w-4 h-4" />
              Approve
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onReject(); }}
              className="flex-1 bg-gray-200 text-gray-700 px-3 py-2 rounded text-sm font-medium hover:bg-gray-300 transition-colors flex items-center justify-center gap-1"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
