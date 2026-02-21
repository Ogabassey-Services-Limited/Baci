-- Migration: Fix pg_net HTTP trigger performance bottleneck
-- Created: 2026-02-21
-- Description: Replaces two synchronous net.http_post() triggers that consume 53.5%
--   of total database execution time (3m50s / 10,809 calls). The staff invite trigger
--   gets error handling and a timeout. The negotiation trigger replaces the HTTP
--   round-trip with pg_notify() since the edge function only broadcasts via Realtime.
--
-- Rollback instructions:
--   To revert to the original triggers, re-run the original migration SQL from:
--     supabase/migrations/20260102174000_staff_invite_trigger.sql
--     supabase/migrations/20260203103000_add_negotiation_notifications_trigger.sql
--   Specifically:
--     DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;
--     DROP FUNCTION IF EXISTS public.handle_new_staff_invite();
--     DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;
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
  project_url text := 'https://aivqthbxdshhltbwipbr.supabase.co';
  function_name text := 'send-staff-invite';
  payload jsonb;
BEGIN
  -- Construct the payload
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'staff_members',
    'record', row_to_json(NEW),
    'schema', 'public'
  );

  -- Call the Edge Function using pg_net with a 5-second timeout.
  -- The timeout prevents this trigger from blocking the transaction
  -- if the edge function is slow or unreachable.
  BEGIN
    PERFORM net.http_post(
      url := project_url || '/functions/v1/' || function_name,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := payload,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the error but do NOT block the INSERT transaction.
    -- Staff invite emails can be retried manually if the edge function fails.
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
-- 2. NEGOTIATION TRIGGER — Replace HTTP call with pg_notify()
-- =============================================================================

-- Drop existing trigger first
DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;

-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_negotiation_update();

-- Recreate using pg_notify instead of net.http_post.
-- The original edge function only sent a Supabase Realtime broadcast.
-- pg_notify achieves the same result without an HTTP round-trip, eliminating
-- the performance bottleneck entirely. Application code listening on the
-- 'negotiation_updates' channel will receive these notifications.
CREATE OR REPLACE FUNCTION public.handle_negotiation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_notify(
    'negotiation_updates',
    json_build_object(
      'merchant_id', NEW.merchant_id,
      'id', NEW.id,
      'status', NEW.status,
      'type', TG_OP
    )::text
  );

  RETURN NEW;
END;
$$;

-- Recreate the trigger with the same conditions as the original
CREATE TRIGGER on_negotiation_change
  AFTER INSERT OR UPDATE ON public.negotiation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_negotiation_update();
