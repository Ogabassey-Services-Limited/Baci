ALTER TABLE public.agentic_request_records
  ADD COLUMN IF NOT EXISTS agent_id text;

COMMENT ON COLUMN public.agentic_request_records.agent_id IS
  'Optional signed agent identity header used for merchant dashboard provenance.';

CREATE OR REPLACE FUNCTION public.get_agentic_action_health_records(
  p_merchant_id uuid,
  p_record_limit integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_record_limit, 25), 1), 100);
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant id is required' USING ERRCODE = '22004';
  END IF;

  IF NOT public.has_merchant_access(p_merchant_id)
    OR NOT public.check_staff_permission(
      auth.uid(),
      p_merchant_id,
      'dashboard',
      'view'
    )
  THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'idempotency_records',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'route', records.route,
            'status_code', records.status_code,
            'created_at', records.created_at,
            'updated_at', records.updated_at,
            'expires_at', records.expires_at
          )
          ORDER BY records.updated_at DESC
        )
        FROM (
          SELECT route, status_code, created_at, updated_at, expires_at
          FROM public.agentic_idempotency_records
          WHERE merchant_id = p_merchant_id
          ORDER BY updated_at DESC
          LIMIT v_limit
        ) records
      ),
      '[]'::jsonb
    ),
    'request_records',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'agent_id', records.agent_id,
            'api_version', records.api_version,
            'route', records.route,
            'created_at', records.created_at,
            'expires_at', records.expires_at
          )
          ORDER BY records.created_at DESC
        )
        FROM (
          SELECT agent_id, api_version, route, created_at, expires_at
          FROM public.agentic_request_records
          WHERE merchant_id = p_merchant_id
          ORDER BY created_at DESC
          LIMIT v_limit
        ) records
      ),
      '[]'::jsonb
    ),
    'checkout_sessions',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'session_id', sessions.session_id,
            'status', sessions.status,
            'metadata', sessions.metadata,
            'updated_at', sessions.updated_at
          )
          ORDER BY sessions.updated_at DESC
        )
        FROM (
          SELECT session_id, status, metadata, updated_at
          FROM public.checkout_sessions
          WHERE merchant_id = p_merchant_id
            AND metadata -> 'agentic' IS NOT NULL
          ORDER BY updated_at DESC
          LIMIT v_limit
        ) sessions
      ),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_agentic_action_health_records(uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_agentic_action_health_records(uuid, integer)
  TO authenticated;
