-- Enable Realtime for AI Agent Tables
-- This allows frontend to receive live updates when agent actions/logs change

-- Enable realtime for agent_actions table (AI suggestions queue)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_actions;

-- Enable realtime for agent_analysis_cache table (AI analysis cache)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_analysis_cache;

-- Enable realtime for agent_activity_log table (AI activity audit trail)
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activity_log;

-- Enable realtime for project_photos table (if it exists - Vision AI photos)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'project_photos'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.project_photos;
    END IF;
END $$;

-- Verify realtime is enabled (optional check)
SELECT
    schemaname,
    tablename
FROM
    pg_publication_tables
WHERE
    pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('agent_actions', 'agent_analysis_cache', 'agent_activity_log', 'project_photos')
ORDER BY tablename;
