-- Activate player-facing contract v2 only after its database projections and
-- application route adapters are present in the same release.

CREATE OR REPLACE FUNCTION public.quiz_runtime_contract_version()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = ''
AS $$ SELECT 2 $$;

REVOKE ALL ON FUNCTION public.quiz_runtime_contract_version()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quiz_runtime_contract_version()
  TO authenticated, service_role;

COMMENT ON FUNCTION public.quiz_runtime_contract_version() IS
  'Readiness sentinel for player-facing quiz contract v2 routes.';
