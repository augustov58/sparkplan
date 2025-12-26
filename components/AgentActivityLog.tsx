import React, { useState } from 'react';
import { Project } from '../types';
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  MessageSquare,
  Camera,
  Shield,
  Sparkles,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Database
} from 'lucide-react';
import { useAgentActivityLog, AgentActivityLog as LogEntry } from '../hooks/useAgentActivityLog';

// Simple time ago function
const timeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
};

interface AgentActivityLogProps {
  project: Project;
}

export const AgentActivityLog: React.FC<AgentActivityLogProps> = ({ project }) => {
  const { logs, loading, error, refresh } = useAgentActivityLog(project.id);

  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [filterEvent, setFilterEvent] = useState<string>('all');
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const toggleLog = (logId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    if (filterAgent !== 'all' && log.agent_name !== filterAgent) return false;
    if (filterEvent !== 'all' && log.event_type !== filterEvent) return false;
    return true;
  });

  // Get unique agents and event types for filters
  const uniqueAgents = Array.from(new Set(logs.map(log => log.agent_name)));
  const uniqueEvents = Array.from(new Set(logs.map(log => log.event_type)));

  const getAgentIcon = (agentName: string) => {
    switch (agentName) {
      case 'change_impact': return <TrendingUp className="w-4 h-4" />;
      case 'photo_analyzer': return <Camera className="w-4 h-4" />;
      case 'predictive_inspector': return <Shield className="w-4 h-4" />;
      case 'rfi_drafter': return <MessageSquare className="w-4 h-4" />;
      case 'content_generator': return <Sparkles className="w-4 h-4" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getAgentName = (agentName: string) => {
    switch (agentName) {
      case 'change_impact': return 'Change Impact Analyzer';
      case 'photo_analyzer': return 'Photo Analyzer';
      case 'predictive_inspector': return 'Predictive Inspector';
      case 'rfi_drafter': return 'RFI Drafter';
      case 'content_generator': return 'Content Generator';
      default: return agentName;
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'action_approved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'action_rejected': return <XCircle className="w-4 h-4 text-red-600" />;
      case 'action_queued': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'cache_hit': return <Database className="w-4 h-4 text-purple-600" />;
      case 'analysis_cached': return <Database className="w-4 h-4 text-indigo-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    switch (eventType) {
      case 'action_approved': return 'Approved';
      case 'action_rejected': return 'Rejected';
      case 'action_queued': return 'Queued';
      case 'cache_hit': return 'Cache Hit';
      case 'analysis_cached': return 'Cached';
      default: return eventType;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'action_approved': return 'bg-green-100 text-green-800 border-green-200';
      case 'action_rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'action_queued': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cache_hit': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'analysis_cached': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-electric-500 animate-spin" />
        <span className="ml-3 text-gray-600">Loading activity logs...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <p className="font-medium">Error loading activity logs</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-electric-500" />
            AI Agent Activity Log
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Complete audit trail of all AI agent interactions for {project.name}
          </p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-electric-500 text-white rounded-lg hover:bg-electric-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="font-medium text-gray-900">Filters</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Agent Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent</label>
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500 text-sm"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map(agent => (
                <option key={agent} value={agent}>{getAgentName(agent)}</option>
              ))}
            </select>
          </div>

          {/* Event Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-electric-500 focus:border-electric-500 text-sm"
            >
              <option value="all">All Events</option>
              {uniqueEvents.map(event => (
                <option key={event} value={event}>{getEventLabel(event)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredLogs.length} of {logs.length} logs
        </div>
      </div>

      {/* Activity Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No activity logs found</p>
          <p className="text-sm text-gray-500 mt-1">
            AI agent activity will appear here as you use the features
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Log Header */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleLog(log.id)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {/* Agent Icon */}
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-electric-100 flex items-center justify-center text-electric-600">
                      {getAgentIcon(log.agent_name)}
                    </div>

                    {/* Event Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-900">
                          {getAgentName(log.agent_name)}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getEventColor(log.event_type)} flex items-center gap-1`}>
                          {getEventIcon(log.event_type)}
                          {getEventLabel(log.event_type)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600">
                        {log.details?.title || log.details?.action_type || 'Activity logged'}
                      </p>

                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {timeAgo(new Date(log.created_at))}
                      </div>
                    </div>

                    {/* Expand Icon */}
                    <div className="flex-shrink-0">
                      {expandedLogs.has(log.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedLogs.has(log.id) && log.details && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 mt-3">Details:</h4>
                  <pre className="text-xs bg-white border border-gray-200 rounded p-3 overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>

                  {log.agent_action_id && (
                    <div className="mt-2 text-xs text-gray-500">
                      <span className="font-medium">Action ID:</span> {log.agent_action_id}
                    </div>
                  )}

                  <div className="mt-1 text-xs text-gray-500">
                    <span className="font-medium">Timestamp:</span> {new Date(log.created_at).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {uniqueEvents.map(eventType => {
          const count = logs.filter(log => log.event_type === eventType).length;
          return (
            <div key={eventType} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center mb-2">
                {getEventIcon(eventType)}
              </div>
              <div className="text-2xl font-bold text-gray-900">{count}</div>
              <div className="text-xs text-gray-600">{getEventLabel(eventType)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
