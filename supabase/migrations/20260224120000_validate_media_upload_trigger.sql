-- Migration: Add magic-byte validation trigger for media uploads
-- Created: 2026-02-24
-- Description: Creates a database trigger on storage.objects that calls the
--   validate-media-upload Edge Function via pg_net when blog images are uploaded.
--   Also adds allowed_mime_types to the media bucket as a first line of defense.
--
-- Security context: The signed URL upload flow trusts client-provided Content-Type
--   headers. This trigger validates actual file bytes (magic bytes) asynchronously
--   and deletes files that don't match an allowed image format.
--
-- Rollback instructions:
--   DROP TRIGGER IF EXISTS on_media_blog_upload ON storage.objects;
--   DROP FUNCTION IF EXISTS public.handle_media_upload_validation();
--   UPDATE storage.buckets SET allowed_mime_types = NULL WHERE id = 'media';

-- =============================================================================
-- 1. BUCKET MIME TYPE RESTRICTION (first line of defense — header check)
-- =============================================================================

-- Restrict the media bucket to only accept image uploads via Content-Type header.
-- This is enforced at the Supabase Storage layer before the file is written.
-- Note: This only checks the header, not the actual file bytes — that's what the
-- Edge Function trigger handles.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif'
]
WHERE id = 'media';

-- =============================================================================
-- 2. TRIGGER FUNCTION — Call Edge Function to validate magic bytes
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_media_upload_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  project_url text := nullif(current_setting('app.project_url', true), '');
  service_role_key text := nullif(current_setting('app.settings.service_role_key', true), '');
  function_name text := 'validate-media-upload';
  payload jsonb;
  request_id bigint;
BEGIN
  -- Guard: require runtime config
  IF project_url IS NULL THEN
    RAISE WARNING 'handle_media_upload_validation: missing app.project_url; skipping.';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL THEN
    RAISE WARNING 'handle_media_upload_validation: missing app.settings.service_role_key; skipping.';
    RETURN NEW;
  END IF;

  -- Construct webhook payload matching the WebhookPayload interface
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'objects',
    'record', jsonb_build_object(
      'id', NEW.id,
      'bucket_id', NEW.bucket_id,
      'name', NEW.name,
      'metadata', NEW.metadata
    ),
    'schema', 'storage'
  );

  -- Call the Edge Function asynchronously via pg_net with a 5-second timeout.
  -- This does NOT block the INSERT — the file is written immediately.
  -- The Edge Function validates and deletes invalid files after the fact.
  BEGIN
    SELECT net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := payload,
      timeout_milliseconds := 5000
    ) INTO request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log but never block the upload
    RAISE WARNING 'handle_media_upload_validation: net.http_post failed — %: %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 3. TRIGGER — Fires only for blog image uploads in the media bucket
-- =============================================================================

-- Scoped to blog paths only: {merchant_id}/blog/{filename}
-- Uses a WHEN condition to avoid firing for product images, logos, etc.
-- The regex enforces exactly 3 path segments: {non-slash}/{literal "blog"}/{non-slash}
DROP TRIGGER IF EXISTS on_media_blog_upload ON storage.objects;

CREATE TRIGGER on_media_blog_upload
  AFTER INSERT ON storage.objects
  FOR EACH ROW
  WHEN (
    NEW.bucket_id = 'media'
    AND NEW.name ~ '^[^/]+/blog/[^/]+$'
  )
  EXECUTE FUNCTION public.handle_media_upload_validation();

-- Documentation
COMMENT ON FUNCTION public.handle_media_upload_validation() IS
'Async trigger that calls the validate-media-upload Edge Function to check magic bytes of uploaded blog images. Deletes files that do not match an allowed image format.';
