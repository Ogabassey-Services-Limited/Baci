-- The secret table is in the private schema and has no client grants. Add an
-- explicit deny-all policy as defense in depth and to keep Supabase advisors
-- from reporting "RLS enabled with no policy" for this table.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'private'
      AND tablename = 'quiz_rpc_server_secrets'
      AND policyname = 'quiz_rpc_server_secrets_no_client_access'
  ) THEN
    CREATE POLICY quiz_rpc_server_secrets_no_client_access
      ON private.quiz_rpc_server_secrets
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;
END;
$$;
