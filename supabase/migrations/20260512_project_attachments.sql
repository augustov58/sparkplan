-- ============================================================================
-- SPRINT 2B PR-1 — project_attachments + permit-attachments storage bucket
-- ============================================================================
-- Created: 2026-05-12
-- Branch:  feat/sprint2b-foundation
-- Spec:    docs/sprints/sprint2b-uploads.md
--
-- Foundation for Sprint 2B uploads + merge engine. Contractors upload PDFs
-- (site plans, cut sheets, fire stopping schedules, NOCs, HOA letters, surveys,
-- manufacturer data) which the permit-packet generator splices into the
-- composed PDF behind SparkPlan-themed title sheets (PR-3 / PR-4).
--
-- artifact_type uses a TEXT CHECK constraint, matching the existing migration
-- style (see 20260106045201_subscriptions.sql, 20260510_permits_and_inspections.sql).
-- No Postgres ENUM types in the codebase.
--
-- RLS: standard per-user scoping pattern (auth.uid() = user_id). Same as
-- project_billing_settings, time_entries, project_photos.
--
-- Storage: `permit-attachments` bucket, private (not public). Object path is
-- `{user_id}/{project_id}/{artifact_type}/{filename}` so the standard
-- storage.foldername(name)[1] prefix-check pattern enforces per-user isolation
-- (same convention as site-visit-photos — see 20251220000001).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: project_attachments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.project_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Discipline of the uploaded artifact. Drives manifest slotting + sheet ID
  -- discipline prefix (E- electrical / C- civil / X- manufacturer).
  artifact_type TEXT NOT NULL,

  -- File metadata snapshot (the storage object is the source of truth).
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  page_count INTEGER,

  -- Human-friendly title rendered onto the SparkPlan title sheet that
  -- precedes the uploaded PDF in the merged packet.
  display_title TEXT,

  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT project_attachments_artifact_type_check
    CHECK (artifact_type IN (
      'site_plan',
      'cut_sheet',
      'fire_stopping',
      'noc',
      'hoa_letter',
      'survey',
      'manufacturer_data'
    )),
  CONSTRAINT project_attachments_page_count_pos
    CHECK (page_count IS NULL OR page_count > 0)
);

-- Lookup index for the M1 detect() path in Sprint 2C: "does this project
-- have a site_plan?" — one row check per (project_id, artifact_type) pair.
CREATE INDEX IF NOT EXISTS idx_project_attachments_project_type
  ON public.project_attachments(project_id, artifact_type);

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_attachments_select_own"
  ON public.project_attachments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "project_attachments_insert_own"
  ON public.project_attachments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "project_attachments_update_own"
  ON public.project_attachments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "project_attachments_delete_own"
  ON public.project_attachments FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.project_attachments IS
  'User-supplied PDF artifacts (site plans, cut sheets, NOCs, HOA letters, fire stopping schedules, surveys, manufacturer data) that the permit-packet generator splices into the composed packet.';
COMMENT ON COLUMN public.project_attachments.artifact_type IS
  'Discipline of artifact. Drives manifest slotting + sheet ID discipline prefix (E- electrical / C- civil / X- manufacturer).';
COMMENT ON COLUMN public.project_attachments.storage_path IS
  'Object key in the permit-attachments bucket. Convention: {user_id}/{project_id}/{artifact_type}/{filename}.';
COMMENT ON COLUMN public.project_attachments.page_count IS
  'Page count of the uploaded PDF. Cached so the merge engine can pre-allocate sheet IDs without re-parsing.';
COMMENT ON COLUMN public.project_attachments.display_title IS
  'Human-friendly title rendered on the SparkPlan title sheet preceding this artifact in the merged packet.';

-- ---------------------------------------------------------------------------
-- STORAGE: permit-attachments bucket + RLS on storage.objects
-- ---------------------------------------------------------------------------
-- Idempotent: the bucket-row insert is a no-op if it already exists. RLS
-- policies on storage.objects are dropped + recreated to keep the migration
-- re-runnable.

INSERT INTO storage.buckets (id, name, public)
VALUES ('permit-attachments', 'permit-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: {user_id}/{project_id}/{artifact_type}/{filename}.
-- storage.foldername(name)[1] returns the first path segment ({user_id}),
-- which we match against auth.uid() to enforce per-user object isolation.

DROP POLICY IF EXISTS "permit_attachments_select_own" ON storage.objects;
DROP POLICY IF EXISTS "permit_attachments_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "permit_attachments_update_own" ON storage.objects;
DROP POLICY IF EXISTS "permit_attachments_delete_own" ON storage.objects;

CREATE POLICY "permit_attachments_select_own"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'permit-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "permit_attachments_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'permit-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "permit_attachments_update_own"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'permit-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "permit_attachments_delete_own"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'permit-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
