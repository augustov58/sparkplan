-- Add missing columns to calendar_events table
-- This migration adds columns that were in the original schema but missing from the existing table

-- Add completed column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'completed'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add completed_at column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN completed_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add related_rfi_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'related_rfi_id'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN related_rfi_id UUID REFERENCES public.rfis(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add related_site_visit_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'related_site_visit_id'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN related_site_visit_id UUID REFERENCES public.site_visits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add location column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'location'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN location TEXT;
  END IF;
END $$;

-- Ensure updated_at column exists and has trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'calendar_events'
    AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.calendar_events
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- Create or replace the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;

-- Create trigger for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
