-- Regression test for the final virtual-terminal sync contract established by
-- 20260713203000_allow_staff_manage_virtual_terminals.sql and
-- 20260714121500_lock_down_virtual_terminal_sync.sql.
-- Usage: psql $DATABASE_URL -v ON_ERROR_STOP=1 -f \
--   supabase/migrations/tests/virtual_terminal_staff_rls.sql

BEGIN;

DO $$
DECLARE
  function_definition text;
  function_security_definer boolean;
BEGIN
  SELECT
    pg_get_functiondef(oid),
    prosecdef
  INTO function_definition, function_security_definer
  FROM pg_proc
  WHERE oid = 'public.sync_virtual_terminal_local(uuid,text,text,boolean,text,text,text)'::regprocedure;

  IF function_definition IS NULL OR function_security_definer THEN
    RAISE EXCEPTION 'server-only virtual terminal sync RPC is missing or unexpectedly SECURITY DEFINER';
  END IF;

  IF function_definition ~ 'check_staff_permission'
    OR function_definition !~ 'Trusted virtual terminal mapping not found'
    OR function_definition !~ 'active = COALESCE\(p_active, active\)'
    OR function_definition !~ 'account_number = COALESCE\(.+NULLIF\(btrim\(p_account_number\).+account_number'
    OR function_definition !~ 'account_name = COALESCE\(.+NULLIF\(btrim\(p_account_name\).+account_name'
    OR function_definition !~ 'bank = COALESCE\(.+NULLIF\(btrim\(p_bank\).+bank'
  THEN
    RAISE EXCEPTION 'server-only virtual terminal sync RPC has unexpected definition: %', function_definition;
  END IF;

  IF has_function_privilege('authenticated',
      'public.sync_virtual_terminal_local(uuid,text,text,boolean,text,text,text)',
      'EXECUTE')
  THEN
    RAISE EXCEPTION 'authenticated must not execute virtual terminal sync RPC';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
