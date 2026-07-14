-- Internal eventing schema and shared operator authorization helper.

CREATE SCHEMA IF NOT EXISTS eventing;
REVOKE ALL ON SCHEMA eventing FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION eventing.is_event_pipeline_operator_v1()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE((SELECT auth.role()), '') = 'service_role'
    OR EXISTS (
      SELECT 1
      FROM public.merchants AS merchant
      WHERE merchant.user_id = (SELECT auth.uid())
        AND merchant.is_platform_admin IS TRUE
    );
$$;

REVOKE ALL ON FUNCTION eventing.is_event_pipeline_operator_v1()
  FROM PUBLIC, anon, authenticated, service_role;
