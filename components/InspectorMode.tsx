/**
 * Inspector Mode - Pre-Inspection AI Audit Component
 * 
 * Performs automated NEC compliance checks on the current project
 * before inspector review. Reduces failed inspections by catching
 * issues early.
 * 
 * @module components/InspectorMode
 */

import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Sparkles,
  FileText,
  Zap,
  ExternalLink,
  Clock,
  Target,
  BookOpen
} from 'lucide-react';
import { usePanels } from '../hooks/usePanels';
import { useCircuits } from '../hooks/useCircuits';
import { useFeeders } from '../hooks/useFeeders';
import { useTransformers } from '../hooks/useTransformers';
import { useGrounding } from '../hooks/useGrounding';
import { 
  runInspection, 
  getIssueExplanationPrompt,
  InspectionResult, 
  InspectionIssue,
  IssueCategory,
  IssueSeverity
} from '../services/inspection/inspectorMode';
import { askNecAssistant } from '../services/geminiService';

interface InspectorModeProps {
  projectId: string;
  projectType: 'Residential' | 'Commercial' | 'Industrial';
  serviceVoltage: number;
  servicePhase: 1 | 3;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SeverityBadge: React.FC<{ severity: IssueSeverity }> = ({ severity }) => {
  const styles = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    info: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  
  const icons = {
    critical: <AlertCircle className="w-3.5 h-3.5" />,
    warning: <AlertTriangle className="w-3.5 h-3.5" />,
    info: <Info className="w-3.5 h-3.5" />,
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[severity]}`}>
      {icons[severity]}
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
};

const CategoryBadge: React.FC<{ category: IssueCategory }> = ({ category }) => {
  const labels: Record<IssueCategory, string> = {
    panel: 'Panel',
    circuit: 'Circuit',
    feeder: 'Feeder',
    grounding: 'Grounding',
    service: 'Service',
    conductor: 'Conductor',
    protection: 'Protection',
  };
  
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
      {labels[category]}
    </span>
  );
};

const ScoreGauge: React.FC<{ score: number }> = ({ score }) => {
  const getColor = () => {
    if (score >= 90) return 'text-green-500';
    if (score >= 70) return 'text-amber-500';
    return 'text-red-500';
  };
  
  const getLabel = () => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Good';
    if (score >= 70) return 'Fair';
    if (score >= 50) return 'Needs Work';
    return 'Critical';
  };
  
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (score / 100) * circumference;
  
  return (
    <div className="relative w-32 h-32">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <circle
          cx="64"
          cy="64"
          r="45"
          fill="none"
          stroke={score >= 90 ? '#22c55e' : score >= 70 ? '#f59e0b' : '#ef4444'}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${getColor()}`}>{score}</span>
        <span className="text-xs text-gray-500">{getLabel()}</span>
      </div>
    </div>
  );
};

interface IssueCardProps {
  issue: InspectionIssue;
  onExplain: (issue: InspectionIssue) => void;
  explaining: boolean;
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onExplain, explaining }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      issue.severity === 'critical' 
        ? 'border-red-200 bg-red-50/50' 
        : issue.severity === 'warning'
        ? 'border-amber-200 bg-amber-50/50'
        : 'border-blue-200 bg-blue-50/50'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-white/50 transition-colors"
      >
        <div className="mt-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <SeverityBadge severity={issue.severity} />
            <CategoryBadge category={issue.category} />
            <span className="text-xs font-mono text-gray-500">{issue.necArticle}</span>
          </div>
          <h4 className="font-medium text-gray-900 mt-1">{issue.title}</h4>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{issue.location}</p>
        </div>
      </button>
      
      {expanded && (
        <div className="px-4 pb-4 pt-0 ml-7 border-t border-gray-100">
          <p className="text-sm text-gray-700 mt-3">{issue.description}</p>
          
          {(issue.currentValue || issue.requiredValue) && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              {issue.currentValue && (
                <div className="bg-white rounded-lg px-3 py-2 border">
                  <span className="text-xs text-gray-500 block">Current</span>
                  <span className="font-medium text-gray-900">{issue.currentValue}</span>
                </div>
              )}
              {issue.requiredValue && (
                <div className="bg-white rounded-lg px-3 py-2 border">
                  <span className="text-xs text-gray-500 block">Required</span>
                  <span className="font-medium text-gray-900">{issue.requiredValue}</span>
                </div>
              )}
            </div>
          )}
          
          <div className="mt-3 p-3 bg-white rounded-lg border">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recommendation</span>
            <p className="text-sm text-gray-700 mt-1">{issue.recommendation}</p>
          </div>
          
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExplain(issue);
              }}
              disabled={explaining}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {explaining ? 'Getting AI Explanation...' : 'Explain with AI'}
            </button>
            
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(issue.necArticle + ' explained')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Lookup NEC
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const InspectorMode: React.FC<InspectorModeProps> = ({
  projectId,
  projectType,
  serviceVoltage,
  servicePhase,
}) => {
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [explainingIssueId, setExplainingIssueId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');
  
  // Fetch project data
  const { panels, loading: panelsLoading } = usePanels(projectId);
  const { circuits, loading: circuitsLoading } = useCircuits(projectId);
  const { feeders, loading: feedersLoading } = useFeeders(projectId);
  const { transformers, loading: transformersLoading } = useTransformers(projectId);
  const { grounding, loading: groundingLoading } = useGrounding(projectId);
  
  const dataLoading = panelsLoading || circuitsLoading || feedersLoading || transformersLoading || groundingLoading;
  
  // Run inspection
  const runAudit = async () => {
    setLoading(true);
    setAiExplanation(null);
    
    // Small delay for UI feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const inspectionData = {
      projectId,
      projectType,
      serviceVoltage,
      servicePhase,
      panels,
      circuits,
      feeders,
      transformers,
      grounding: grounding ? {
        electrodes: grounding.electrodes || [],
        gecSize: grounding.gec_size || '',
        bonding: grounding.bonding || [],
      } : undefined,
    };
    
    const inspectionResult = runInspection(inspectionData);
    setResult(inspectionResult);
    setLoading(false);
  };
  
  // Get AI explanation for an issue
  const handleExplain = async (issue: InspectionIssue) => {
    setExplainingIssueId(issue.id);
    setAiExplanation(null);
    
    try {
      const prompt = getIssueExplanationPrompt(issue);
      const explanation = await askNecAssistant(prompt);
      setAiExplanation(explanation);
    } catch (error) {
      setAiExplanation('Unable to generate explanation. Please try again.');
    } finally {
      setExplainingIssueId(null);
    }
  };
  
  // Filter issues
  const filteredIssues = useMemo(() => {
    if (!result) return [];
    if (filter === 'all') return result.issues;
    return result.issues.filter(i => i.severity === filter);
  }, [result, filter]);
  
  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const grouped = new Map<IssueCategory, InspectionIssue[]>();
    filteredIssues.forEach(issue => {
      const existing = grouped.get(issue.category) || [];
      grouped.set(issue.category, [...existing, issue]);
    });
    return grouped;
  }, [filteredIssues]);
  
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Inspector Mode</h2>
              <p className="text-gray-500 text-sm">Pre-Inspection AI Audit</p>
            </div>
          </div>
          <p className="mt-3 text-gray-600 max-w-xl">
            Automated NEC compliance check before inspector review. Catch issues early and 
            reduce failed inspections.
          </p>
        </div>
        
        <button
          onClick={runAudit}
          disabled={loading || dataLoading}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running Audit...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              Run Inspection
            </>
          )}
        </button>
      </div>
      
      {/* Data loading state */}
      {dataLoading && (
        <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">Loading project data...</p>
        </div>
      )}
      
      {/* No data state */}
      {!dataLoading && panels.length === 0 && !result && (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Panels Configured</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Add panels and circuits to your project using the One-Line Diagram tool, then 
            run the inspection audit.
          </p>
        </div>
      )}
      
      {/* Initial state - ready to run */}
      {!dataLoading && panels.length > 0 && !result && !loading && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ready to Inspect</h3>
          <p className="text-gray-600 max-w-md mx-auto mb-4">
            Your project has {panels.length} panel{panels.length !== 1 ? 's' : ''} and{' '}
            {circuits.length} circuit{circuits.length !== 1 ? 's' : ''}. 
            Click "Run Inspection" to check NEC compliance.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Target className="w-4 h-4" />
              {panels.length} Panels
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-4 h-4" />
              {circuits.length} Circuits
            </span>
            <span className="flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              10+ NEC Articles
            </span>
          </div>
        </div>
      )}
      
      {/* Results */}
      {result && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Score Card */}
            <div className="md:col-span-1 bg-white border border-gray-100 rounded-xl p-6 flex flex-col items-center justify-center">
              <ScoreGauge score={result.summary.score} />
              <p className="text-sm text-gray-500 mt-2">Compliance Score</p>
            </div>
            
            {/* Stats Cards */}
            <div className="md:col-span-3 grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-700">{result.summary.passed}</p>
                    <p className="text-sm text-green-600">Passed</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-amber-700">{result.summary.warnings}</p>
                    <p className="text-sm text-amber-600">Warnings</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-red-700">{result.summary.critical}</p>
                    <p className="text-sm text-red-600">Critical</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Timestamp and NEC Articles */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Last run: {result.timestamp.toLocaleString()}
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              {result.necArticlesReferenced.length} NEC articles checked
            </div>
          </div>
          
          {/* AI Explanation Modal */}
          {aiExplanation && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-2">AI Explanation</h4>
                  <div className="prose prose-sm text-gray-700 whitespace-pre-wrap">
                    {aiExplanation}
                  </div>
                  <button
                    onClick={() => setAiExplanation(null)}
                    className="mt-4 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Issues Section */}
          {result.issues.length > 0 ? (
            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              {/* Filter tabs */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-4 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Filter:</span>
                <div className="flex gap-1">
                  {(['all', 'critical', 'warning'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        filter === f 
                          ? 'bg-gray-900 text-white' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {f === 'all' ? `All (${result.issues.length})` 
                        : f === 'critical' ? `Critical (${result.summary.critical})`
                        : `Warnings (${result.summary.warnings})`}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Issues list */}
              <div className="divide-y divide-gray-100">
                {Array.from(issuesByCategory.entries()).map(([category, categoryIssues]) => (
                  <div key={category} className="p-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                      {category} Issues ({categoryIssues.length})
                    </h4>
                    <div className="space-y-3">
                      {categoryIssues.map(issue => (
                        <IssueCard 
                          key={issue.id} 
                          issue={issue}
                          onExplain={handleExplain}
                          explaining={explainingIssueId === issue.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* No issues - all passed */
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-green-900 mb-2">
                All Checks Passed! 🎉
              </h3>
              <p className="text-green-700 max-w-md mx-auto">
                Your project passed all {result.summary.totalChecks} NEC compliance checks. 
                You're ready for inspection!
              </p>
            </div>
          )}
          
          {/* Passed Checks Collapsible */}
          {result.passedChecks.length > 0 && (
            <details className="bg-white border border-gray-100 rounded-xl overflow-hidden">
              <summary className="px-4 py-3 bg-green-50 cursor-pointer hover:bg-green-100 transition-colors flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-900">
                  View {result.passedChecks.length} Passed Checks
                </span>
              </summary>
              <div className="p-4 divide-y divide-gray-50">
                {result.passedChecks.map(check => (
                  <div key={check.id} className="py-2 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{check.description}</span>
                    <span className="text-xs font-mono text-gray-400 ml-auto">{check.necArticle}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
          
          {/* NEC Articles Referenced */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              NEC Articles Referenced
            </h4>
            <div className="flex flex-wrap gap-2">
              {result.necArticlesReferenced.map(article => (
                <a
                  key={article}
                  href={`https://www.google.com/search?q=${encodeURIComponent(article + ' NEC')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-mono text-gray-600 hover:bg-gray-100 hover:border-gray-300 transition-colors"
                >
                  {article}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

