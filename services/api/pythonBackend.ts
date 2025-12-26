/**
 * Python Backend API Client
 *
 * Calls the FastAPI + Pydantic AI backend for agent operations
 */

import { supabase } from '../../lib/supabase';
import type { AgentAction } from '../../types';

const API_URL = import.meta.env.VITE_PYTHON_API_URL || 'http://localhost:8000';

/**
 * Get authenticated user's JWT token for backend auth
 */
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }
  return session.access_token;
}

/**
 * Make authenticated request to Python backend
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const message = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail || error);
    throw new Error(message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger Change Impact Analyzer agent
 *
 * Analyzes cascading impacts when user modifies electrical system
 * Example: "Add 3x 50A EV chargers" → service upgrade needed?
 */
export async function analyzeChangeImpact(
  projectId: string,
  changeDescription: string,
  proposedLoads: Array<{
    type: string;
    amps: number;
    quantity: number;
  }>
): Promise<AgentAction> {
  return apiRequest<AgentAction>('/api/agent-actions/analyze-change', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      change_description: changeDescription,
      proposed_loads: proposedLoads,
    }),
  });
}

/**
 * Trigger RFI Drafter agent
 *
 * Generates professional RFI questions with NEC references
 */
export async function draftRFI(
  projectId: string,
  topic: string,
  context?: string
): Promise<AgentAction> {
  const params = new URLSearchParams({
    project_id: projectId,
    topic,
  });
  if (context) {
    params.append('context', context);
  }

  return apiRequest<AgentAction>(`/api/agent-actions/draft-rfi?${params.toString()}`, {
    method: 'POST',
  });
}

/**
 * Trigger Photo Analyzer agent (Vision AI)
 *
 * Analyzes electrical installation photos for NEC violations
 * UNIQUE FEATURE - competitors don't have this
 */
export async function analyzePhoto(
  projectId: string,
  photoFile: File,
  description?: string
): Promise<AgentAction> {
  const token = await getAuthToken();

  const formData = new FormData();
  formData.append('project_id', projectId);
  formData.append('photo', photoFile);
  if (description) {
    formData.append('description', description);
  }

  const response = await fetch(`${API_URL}/api/agent-actions/analyze-photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      // Don't set Content-Type - browser will set it with boundary for multipart/form-data
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    const message = typeof error.detail === 'string'
      ? error.detail
      : JSON.stringify(error.detail || error);
    throw new Error(message || `API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Trigger Predictive Inspector agent
 *
 * Predicts inspection failures before they happen
 */
export async function predictInspection(
  projectId: string
): Promise<AgentAction> {
  return apiRequest<AgentAction>(`/api/agent-actions/predict-inspection?project_id=${projectId}`, {
    method: 'POST',
  });
}

/**
 * Health check - verify Python backend is running
 */
export async function checkBackendHealth(): Promise<{
  status: string;
  environment: string;
  services: {
    supabase: string;
    gemini: string;
  };
}> {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) {
    throw new Error('Python backend is not available');
  }
  return response.json();
}
