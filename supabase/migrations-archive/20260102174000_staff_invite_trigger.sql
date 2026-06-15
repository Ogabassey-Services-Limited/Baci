-- Migration: Add Staff Invite Trigger
-- Created: 2026-01-02
-- Description: Adds a trigger to call the 'send-staff-invite' Edge Function when a new staff member is inserted.

-- Ensure pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_staff_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  -- Project URL for Edge Functions
  -- In a robust setup, this should be stored in a settings table or vault
  project_url text := 'https://aivqthbxdshhltbwipbr.supabase.co';
  function_name text := 'send-staff-invite';
  payload jsonb;
  request_id integer;
BEGIN
  -- Construct the payload
  -- We send the raw record. The Edge Function parses it.
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'staff_members',
    'record', row_to_json(NEW),
    'schema', 'public'
  );

  -- Call the Edge Function using pg_net
  -- NOTE: Requires 'Verify JWT' to be DISABLED for this function in Supabase Dashboard,
  -- OR a valid Authorization header to be added here.
  -- Since we cannot safely hardcode secrets in SQL, we rely on the function being internal-use or verifying secrets in body if needed.
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
DROP TRIGGER IF EXISTS on_staff_invite ON public.staff_members;

-- Create the trigger
CREATE TRIGGER on_staff_invite
  AFTER INSERT OR UPDATE OF invitation_token ON public.staff_members
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_staff_invite();
