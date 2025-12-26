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
  Shield
} from 'lucide-react';
import { useAgentActions } from '../hooks/useAgentActions';
import type { AgentAction } from '../types';

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
        className="fixed right-4 bottom-4 bg-electric-500 text-white p-3 rounded-full shadow-lg hover:bg-electric-600 transition-colors z-50"
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
    <div className="fixed right-0 top-16 bottom-0 w-96 bg-white border-l border-gray-200 shadow-xl z-40 flex flex-col">
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
