-- Add photo storage support for site visits
-- Created: 2025-12-20

-- Add photos column to site_visits (array of storage URLs)
ALTER TABLE public.site_visits
ADD COLUMN IF NOT EXISTS photos TEXT[];

-- Create storage bucket for site visit photos (run this in Supabase Dashboard -> Storage)
-- Bucket name: 'site-visit-photos'
-- Public: false
-- File size limit: 10MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- RLS policies for storage bucket (add these in Supabase Dashboard -> Storage -> site-visit-photos -> Policies)
-- Policy 1: "Users can upload their own site visit photos"
--   FOR INSERT: bucket_id = 'site-visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- Policy 2: "Users can view their own site visit photos"
--   FOR SELECT: bucket_id = 'site-visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
--
-- Policy 3: "Users can delete their own site visit photos"
--   FOR DELETE: bucket_id = 'site-visit-photos' AND auth.uid()::text = (storage.foldername(name))[1]
