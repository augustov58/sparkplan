-- Phase 1: Agentic AI Infrastructure - Core Database Schema
-- This migration creates the foundational tables for the AI agent orchestration system

-- Agent Actions Queue (staging for AI suggestions)
CREATE TABLE IF NOT EXISTS public.agent_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Agent metadata
  action_type TEXT NOT NULL, -- 'draft_rfi', 'suggest_change', 'predict_failure', 'flag_violation'
  agent_name TEXT NOT NULL,  -- 'rfi_drafter', 'change_impact', 'photo_analyzer', 'predictive_inspector'
  priority INTEGER NOT NULL DEFAULT 50, -- 0-100 (higher = more urgent)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),

  -- Content
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT, -- Why AI suggests this action
  confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0.00 AND confidence_score <= 1.00),

  -- Payload (flexible structure for different action types)
  action_data JSONB NOT NULL,
  impact_analysis JSONB, -- Detailed analysis (costs, timeline, affected components)

  -- User interaction
  user_notes TEXT,
  rejection_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '72 hours',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analysis Cache (avoid redundant AI calls)
CREATE TABLE IF NOT EXISTS public.agent_analysis_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cache key
  analysis_type TEXT NOT NULL, -- 'change_impact', 'inspection_prediction', 'photo_analysis'
  context_hash TEXT NOT NULL, -- Hash of input context (for cache matching)

  -- Cached results
  results JSONB NOT NULL,

  -- Metadata
  model_version TEXT NOT NULL DEFAULT 'gemini-2.0-flash-exp',
  tokens_used INTEGER,
  processing_time_ms INTEGER,

  -- Expiration
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',

  UNIQUE(project_id, analysis_type, context_hash)
);

-- Activity Log (audit trail)
CREATE TABLE IF NOT EXISTS public.agent_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_action_id UUID REFERENCES public.agent_actions(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL, -- 'action_queued', 'action_approved', 'action_rejected', 'analysis_cached'
  agent_name TEXT NOT NULL,
  details JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Photo Storage (for Vision AI)
CREATE TABLE IF NOT EXISTS public.project_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Storage reference
  storage_path TEXT NOT NULL, -- Supabase Storage: project-photos/{user_id}/{project_id}/{photo_id}.jpg
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,

  -- Metadata
  location TEXT, -- e.g., "Service entrance", "Panel H1 interior"
  description TEXT,
  tags TEXT[],

  -- Vision analysis results
  analyzed BOOLEAN DEFAULT false,
  analysis_results JSONB, -- Full Vision API response
  detected_violations JSONB[], -- Structured violations for UI display

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_actions_project ON public.agent_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user ON public.agent_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON public.agent_actions(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_agent_actions_priority ON public.agent_actions(priority DESC);

CREATE INDEX IF NOT EXISTS idx_cache_lookup ON public.agent_analysis_cache(project_id, analysis_type, context_hash);
CREATE INDEX IF NOT EXISTS idx_cache_expiration ON public.agent_analysis_cache(expires_at) WHERE expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_activity_project ON public.agent_activity_log(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.agent_activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_photos_project ON public.project_photos(project_id);
CREATE INDEX IF NOT EXISTS idx_photos_analyzed ON public.project_photos(analyzed) WHERE NOT analyzed;

-- Enable Row Level Security
ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_photos ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users manage own agent actions" ON public.agent_actions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own analysis cache" ON public.agent_analysis_cache
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users view own activity log" ON public.agent_activity_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users manage own photos" ON public.project_photos
  FOR ALL USING (auth.uid() = user_id);

-- Auto-update triggers
CREATE TRIGGER update_agent_actions_updated_at
  BEFORE UPDATE ON public.agent_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON public.project_photos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Cleanup function for expired cache and actions
CREATE OR REPLACE FUNCTION cleanup_expired_agent_data() RETURNS void AS $$
BEGIN
  DELETE FROM public.agent_analysis_cache WHERE expires_at < NOW();
  UPDATE public.agent_actions SET status = 'expired' WHERE status = 'pending' AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on cleanup function
GRANT EXECUTE ON FUNCTION cleanup_expired_agent_data() TO authenticated;
