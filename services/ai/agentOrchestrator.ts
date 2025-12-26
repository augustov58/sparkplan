import { supabase } from '../../lib/supabase';
import type {
  AgentAction,
  AgentActionType,
  AgentName,
  ImpactAnalysis,
  NecViolation
} from '../../types';

/**
 * Queue an AI-suggested action for user review
 */
export async function queueAgentAction(
  projectId: string,
  actionType: AgentActionType,
  agentName: AgentName,
  title: string,
  description: string,
  actionData: Record<string, any>,
  options?: {
    priority?: number; // 0-100, default 50
    reasoning?: string;
    confidence?: number; // 0.00 - 1.00
    impactAnalysis?: ImpactAnalysis;
    expiresInHours?: number; // Default 72
  }
): Promise<AgentAction | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + (options?.expiresInHours || 72));

  const { data, error } = await supabase
    .from('agent_actions')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action_type: actionType,
      agent_name: agentName,
      title,
      description,
      action_data: actionData,
      priority: options?.priority || 50,
      reasoning: options?.reasoning,
      confidence_score: options?.confidence,
      impact_analysis: options?.impactAnalysis,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error queueing agent action:', error);
    return null;
  }

  // Log activity
  await logActivity(projectId, user.id, agentName, 'action_queued', {
    action_id: data.id,
    action_type: actionType,
    title,
  });

  return data;
}

/**
 * Get pending actions for a project
 */
export async function getPendingActions(
  projectId: string,
  options?: { agentName?: AgentName; limit?: number }
): Promise<AgentAction[]> {
  let query = supabase
    .from('agent_actions')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false });

  if (options?.agentName) {
    query = query.eq('agent_name', options.agentName);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching pending actions:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all actions for a project (including approved/rejected for history)
 */
export async function getAllActions(
  projectId: string,
  options?: { agentName?: AgentName; status?: string; limit?: number }
): Promise<AgentAction[]> {
  let query = supabase
    .from('agent_actions')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (options?.agentName) {
    query = query.eq('agent_name', options.agentName);
  }

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching all actions:', error);
    return [];
  }

  return data || [];
}

/**
 * Approve an agent action (user confirms)
 */
export async function approveAction(
  actionId: string,
  userNotes?: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Fetch action to get details
  const { data: action } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (!action) return false;

  // Update action status
  const { error } = await supabase
    .from('agent_actions')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      user_notes: userNotes,
    })
    .eq('id', actionId);

  if (error) {
    console.error('Error approving action:', error);
    return false;
  }

  // Execute the action (delegate to specific handler)
  await executeAction(action);

  // Log activity
  await logActivity(action.project_id, user.id, action.agent_name, 'action_approved', {
    action_id: actionId,
    action_type: action.action_type,
  });

  return true;
}

/**
 * Reject an agent action (user declines)
 */
export async function rejectAction(
  actionId: string,
  reason?: string
): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: action } = await supabase
    .from('agent_actions')
    .select('agent_name, action_type, project_id')
    .eq('id', actionId)
    .single();

  const { error } = await supabase
    .from('agent_actions')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq('id', actionId);

  if (error) {
    console.error('Error rejecting action:', error);
    return false;
  }

  // Log activity
  if (action) {
    await logActivity(action.project_id, user.id, action.agent_name, 'action_rejected', {
      action_id: actionId,
      action_type: action.action_type,
      reason,
    });
  }

  return true;
}

/**
 * Execute approved action (create issues, update specs, etc.)
 */
async function executeAction(action: AgentAction): Promise<void> {
  switch (action.action_type) {
    case 'flag_violation':
      // Create issue from photo-detected violation
      await createIssueFromViolation(action);
      break;

    case 'suggest_change':
      // Apply change impact (if user approved)
      // This would update panels, circuits, feeders, etc.
      // Implementation depends on Phase 2 Change Impact Analyzer
      break;

    case 'predict_failure':
      // No execution needed, just informational
      break;

    case 'draft_rfi':
      // Create an RFI record
      await createRFIFromDraft(action);
      break;

    case 'recommend_upgrade':
      // No execution needed, just informational
      break;

    case 'generate_notes':
      // No execution needed, content already in action_data
      break;

    default:
      console.warn(`Unknown action type: ${action.action_type}`);
  }
}

/**
 * Create issue from photo-detected violation
 */
async function createIssueFromViolation(action: AgentAction): Promise<void> {
  const violations = action.action_data.violations as NecViolation[];
  const photoId = action.action_data.photo_id as string;

  if (!violations || violations.length === 0) return;

  for (const violation of violations) {
    await supabase.from('issues').insert({
      project_id: action.project_id,
      user_id: action.user_id,
      description: violation.description,
      article: violation.nec_article,
      severity: violation.severity === 'critical' ? 'Critical' : 'Warning',
      status: 'Open',
      // Note: photo_url field may need to be added to issues table
      notes: `Detected via AI photo analysis. Photo ID: ${photoId}. Recommendation: ${violation.recommendation}`,
    });
  }
}

/**
 * Create RFI from AI-drafted content
 */
async function createRFIFromDraft(action: AgentAction): Promise<void> {
  const { subject, question, priority } = action.action_data;

  if (!subject || !question) return;

  // Get next RFI number
  const { data: existingRFIs } = await supabase
    .from('rfis')
    .select('rfi_number')
    .eq('project_id', action.project_id)
    .order('created_at', { ascending: false })
    .limit(1);

  let rfiNumber = 'RFI-001';
  if (existingRFIs && existingRFIs.length > 0) {
    const lastNumber = parseInt(existingRFIs[0].rfi_number.split('-')[1]);
    rfiNumber = `RFI-${String(lastNumber + 1).padStart(3, '0')}`;
  }

  await supabase.from('rfis').insert({
    project_id: action.project_id,
    user_id: action.user_id,
    rfi_number: rfiNumber,
    subject,
    question,
    priority: priority || 'Medium',
    status: 'Pending',
  });
}

/**
 * Log agent activity for audit trail
 */
async function logActivity(
  projectId: string,
  userId: string,
  agentName: AgentName,
  eventType: string,
  details?: Record<string, any>
): Promise<void> {
  await supabase.from('agent_activity_log').insert({
    project_id: projectId,
    user_id: userId,
    agent_name: agentName,
    event_type: eventType,
    details,
  });
}

/**
 * Check analysis cache before calling AI
 */
export async function checkAnalysisCache(
  projectId: string,
  analysisType: string,
  contextHash: string
): Promise<any | null> {
  const { data } = await supabase
    .from('agent_analysis_cache')
    .select('results')
    .eq('project_id', projectId)
    .eq('analysis_type', analysisType)
    .eq('context_hash', contextHash)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (data) {
    // Log cache hit
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await logActivity(projectId, user.id, 'content_generator', 'cache_hit', {
        analysis_type: analysisType,
        context_hash: contextHash,
      });
    }
  }

  return data?.results || null;
}

/**
 * Save analysis to cache
 */
export async function saveAnalysisCache(
  projectId: string,
  analysisType: string,
  contextHash: string,
  results: any,
  tokensUsed?: number,
  processingTimeMs?: number
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await supabase.from('agent_analysis_cache').insert({
    project_id: projectId,
    user_id: user.id,
    analysis_type: analysisType,
    context_hash: contextHash,
    results,
    tokens_used: tokensUsed,
    processing_time_ms: processingTimeMs,
    expires_at: expiresAt.toISOString(),
  });

  // Log cache save
  await logActivity(projectId, user.id, 'content_generator', 'analysis_cached', {
    analysis_type: analysisType,
    tokens_used: tokensUsed,
    processing_time_ms: processingTimeMs,
  });
}

/**
 * Generate context hash for caching
 */
export function generateContextHash(context: any): string {
  // Simple hash function using string encoding
  const str = JSON.stringify(context);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16);
}
