-- Migration: Add Negotiation Notification Trigger
-- Created: 2026-02-03
-- Description: Adds a trigger to call the 'handle-negotiation' Edge Function when a negotiation is created or updated.

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_negotiation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  project_url text := 'https://aivqthbxdshhltbwipbr.supabase.co';
  function_name text := 'handle-negotiation';
  payload jsonb;
BEGIN
  -- Construct the payload
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', 'negotiation_requests',
    'record', row_to_json(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
    'schema', 'public'
  ) - 'old_record' || jsonb_build_object('old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END); -- Ensure valid JSON structure

  -- Call the Edge Function using pg_net
  -- NOTE: Requires 'Verify JWT' to be DISABLED for this function in Supabase Dashboard,
  -- OR a valid Authorization header to be added here.
  PERFORM net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := payload
  );

  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_negotiation_change ON public.negotiation_requests;

-- Create the trigger
CREATE TRIGGER on_negotiation_change
  AFTER INSERT OR UPDATE ON public.negotiation_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_negotiation_update();
