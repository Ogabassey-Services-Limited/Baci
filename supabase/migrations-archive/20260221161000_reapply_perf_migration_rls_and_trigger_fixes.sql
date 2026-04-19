-- Migration: Reapply RLS and trigger fixes after initial performance migrations
-- Date: 2026-02-21
-- Purpose:
--   Apply the intended final state for environments where:
--     - 20260221140000_db_optimizations_rls_indexes_analyze.sql
--     - 20260221150000_fix_pg_net_trigger_performance.sql
--   were already executed before follow-up fixes were committed.

-- ============================================================================
-- 1) merchants RLS: restore owner + active staff read access
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own merchant" ON public.merchants;

CREATE POLICY "Users can view their own merchant"
ON public.merchants FOR SELECT
USING (
  ((select auth.uid()) = user_id)
  OR EXISTS (
    SELECT 1
    FROM public.staff_members sm
    WHERE sm.user_id = (select auth.uid())
      AND sm.merchant_id = merchants.id
      AND sm.status = 'active'
  )
);

-- Keep audit_logs policy definitions explicitly schema-qualified.
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users can insert own audit logs"
ON public.audit_logs FOR INSERT
WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- 2) staff invite trigger/function: auth header + request id correlation
-- ============================================================================

DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;

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

  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'staff_members',
    'record', row_to_json(NEW),
    'schema', 'public'
  );

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

    PERFORM pg_notify(
      'staff_invite_request_ids',
      jsonb_build_object(
        'request_id', request_id,
        'staff_member_id', NEW.id,
        'operation', TG_OP
      )::text
    );
  EXCEPTION WHEN OTHERS THEN
    -- Catch enqueue-time failures only; HTTP status failures are async in net._http_response.
    RAISE WARNING 'handle_new_staff_invite: net.http_post failed — %: %',
      SQLSTATE, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_staff_invite
  AFTER INSERT OR UPDATE OF invitation_token ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_staff_invite();

-- ============================================================================
-- 3) negotiation trigger/function: rely on WAL-based postgres_changes events
-- ============================================================================

DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;
DROP TRIGGER IF EXISTS on_negotiation_change_status ON public.negotiation_requests;
DROP FUNCTION IF EXISTS public.handle_negotiation_update();
