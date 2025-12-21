-- Fix assigned_to column to allow NULL values
-- The column was incorrectly created as NOT NULL

ALTER TABLE public.issues
ALTER COLUMN assigned_to DROP NOT NULL;

-- Verify the change
COMMENT ON COLUMN public.issues.assigned_to IS 'Optional: Person assigned to resolve this issue';
