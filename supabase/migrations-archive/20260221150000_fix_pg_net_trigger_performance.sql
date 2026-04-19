-- Migration: Fix pg_net HTTP trigger performance bottleneck
-- Created: 2026-02-21
-- Description: Replaces two synchronous net.http_post() triggers that consume 53.5%
--   of total database execution time (3m50s / 10,809 calls). The staff invite trigger
--   gets error handling, auth headers, and a timeout. The negotiation trigger keeps
--   DB-side logic minimal so Supabase Realtime clients can rely on WAL-based
--   postgres_changes events.
--
-- Rollback instructions:
--   To revert to the original triggers, re-run the original migration SQL from:
--     supabase/migrations/20260102174000_staff_invite_trigger.sql
--     supabase/migrations/20260203103000_add_negotiation_notifications_trigger.sql
--   Specifically:
--     DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;
--     DROP FUNCTION IF EXISTS public.handle_new_staff_invite();
--     DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;
--     DROP TRIGGER IF EXISTS on_negotiation_change_status ON public.negotiation_requests;
--     DROP FUNCTION IF EXISTS public.handle_negotiation_update();
--   Then recreate the original functions and triggers from those migration files.

-- =============================================================================
-- 1. STAFF INVITE TRIGGER — Add error handling + 5s timeout
-- =============================================================================

-- Drop existing trigger first (must drop before replacing the function)
DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;

-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_new_staff_invite();

-- Recreate with error handling and timeout
CREATE OR REPLACE FUNCTION public.handle_new_staff_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  project_url text := nullif(current_setting('app.project_url', true), '');
  service_role_key text := nullif(current_setting('app.settings.service_role_key', true), '');
  function_name text := 'send-staff-invite';
  payload jsonb;
  request_id bigint;
BEGIN
  IF project_url IS NULL THEN
    RAISE WARNING 'Missing required setting app.project_url for handle_new_staff_invite; skipping edge enqueue.';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL THEN
    RAISE WARNING 'Missing required setting app.settings.service_role_key for handle_new_staff_invite; skipping edge enqueue.';
    RETURN NEW;
  END IF;

  -- Construct the payload
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'staff_members',
    'record', row_to_json(NEW),
    'schema', 'public'
  );

  -- Call the Edge Function using pg_net with a 5-second timeout.
  -- The timeout prevents this trigger from blocking the transaction
  -- if the edge function is slow or unreachable.
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

    -- Correlate async pg_net responses via net._http_response by request_id.
    PERFORM pg_notify(
      'staff_invite_request_ids',
      jsonb_build_object(
        'request_id', request_id,
        'staff_member_id', NEW.id,
        'operation', TG_OP
      )::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- This catches enqueue-time failures only; downstream HTTP status failures
    -- happen asynchronously in net._http_response.
    -- Log the error but do NOT block the transaction.
    RAISE WARNING 'handle_new_staff_invite: net.http_post failed — %: %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate the trigger with the same conditions as the original
CREATE TRIGGER on_staff_invite
  AFTER INSERT OR UPDATE OF invitation_token ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_staff_invite();


-- =============================================================================
-- 2. NEGOTIATION TRIGGER — Keep DB-side logic minimal for WAL-based Realtime
-- =============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;
DROP TRIGGER IF EXISTS on_negotiation_change_status ON public.negotiation_requests;

-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_negotiation_update();
