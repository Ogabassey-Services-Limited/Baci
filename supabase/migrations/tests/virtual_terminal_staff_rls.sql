-- Regression test for 20260713203000_allow_staff_manage_virtual_terminals.sql.
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

  IF function_definition IS NULL OR NOT function_security_definer THEN
    RAISE EXCEPTION 'constrained virtual terminal sync RPC is missing or not SECURITY DEFINER';
  END IF;

  IF function_definition !~ 'check_staff_permission.+integrations.+manage'
    OR function_definition !~ 'virtual_terminal_code = p_code'
    OR function_definition !~ 'ON CONFLICT \(code\) DO UPDATE'
    OR function_definition !~ 'virtual_terminals.merchant_id = p_merchant_id'
    OR function_definition !~ 'v_staff_permissions.+integrations.+\*'
    OR function_definition !~ 'NOT v_is_owner.+p_account_number IS NOT NULL'
    OR function_definition !~ 'account_number = COALESCE\(.+NULLIF\(btrim\(p_account_number\).+account_number'
    OR function_definition !~ 'account_name = COALESCE\(.+NULLIF\(btrim\(p_account_name\).+account_name'
    OR function_definition !~ 'bank = COALESCE\(.+NULLIF\(btrim\(p_bank\).+bank'
    OR function_definition !~ 'COALESCE\(p_active, true\)'
  THEN
    RAISE EXCEPTION 'constrained virtual terminal sync RPC has unexpected definition: %', function_definition;
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
