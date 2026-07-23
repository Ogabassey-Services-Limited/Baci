-- Atomic platform-event recording and durable enqueue.

CREATE OR REPLACE FUNCTION public.record_platform_domain_event_v1(
  p_event_type text,
  p_event_name text,
  p_event_data jsonb,
  p_external_event_id text,
  p_merchant_id uuid,
  p_session_id text,
  p_page_url text,
  p_referrer text,
  p_producer text,
  p_trust_level text,
  p_event_timestamp timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (
  domain_event_id uuid,
  queue_message_id bigint,
  already_enqueued boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
SET statement_timeout = '5s'
AS $$
BEGIN
  IF COALESCE((SELECT auth.role()), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_platform_domain_event_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF p_external_event_id IS NULL OR length(p_external_event_id) = 0 THEN
    RAISE EXCEPTION 'platform_external_event_id_required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_events (
    event_type,
    event_data,
    event_id,
    merchant_id,
    session_id,
    referrer,
    page_url,
    event_timestamp
  ) VALUES (
    p_event_type,
    COALESCE(p_event_data, '{}'::jsonb),
    p_external_event_id,
    p_merchant_id,
    p_session_id,
    p_referrer,
    p_page_url,
    p_event_timestamp
  )
  ON CONFLICT (event_type, event_id) WHERE event_id IS NOT NULL DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM eventing.enqueue_domain_event_v1(
    p_producer,
    p_trust_level,
    format(
      'platform:%s',
      pg_catalog.encode(
        extensions.digest(
          format('%s:%s', p_event_type, p_external_event_id),
          'sha256'
        ),
        'hex'
      )
    ),
    p_external_event_id,
    p_event_name,
    'platform_event',
    p_external_event_id,
    p_merchant_id,
    jsonb_build_object('schema', 'public', 'table', 'platform_events'),
    jsonb_build_object(
      'event_type', p_event_type,
      'event_data', COALESCE(p_event_data, '{}'::jsonb),
      'page_url', p_page_url,
      'source', 'web'
    ),
    COALESCE(p_metadata, '{}'::jsonb),
    p_event_timestamp,
    NULL,
    NULL,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_platform_domain_event_v1(
  text, text, jsonb, text, uuid, text, text, text, text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_platform_domain_event_v1(
  text, text, jsonb, text, uuid, text, text, text, text, text, timestamptz, jsonb
) TO service_role;
