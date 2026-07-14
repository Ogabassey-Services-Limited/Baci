-- Atomic analytics-event recording and durable enqueue.

CREATE UNIQUE INDEX IF NOT EXISTS analytics_events_merchant_event_id_type_uidx
  ON public.analytics_events (merchant_id, event_id, event_type);

CREATE OR REPLACE FUNCTION public.record_analytics_domain_event_v1(
  p_merchant_id uuid,
  p_event_type text,
  p_event_name text,
  p_event_data jsonb,
  p_domain_event_data jsonb,
  p_external_event_id text,
  p_source text,
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
    RAISE EXCEPTION 'forbidden: record_analytics_domain_event_v1 requires service_role'
      USING ERRCODE = '42501';
  END IF;
  IF p_external_event_id IS NULL OR length(p_external_event_id) = 0 THEN
    RAISE EXCEPTION 'analytics_external_event_id_required'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_event_data, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_domain_event_data, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'analytics_event_data_object_required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.analytics_events (
    merchant_id,
    event_type,
    event_data,
    event_id,
    source,
    event_timestamp
  ) VALUES (
    p_merchant_id,
    p_event_type,
    COALESCE(p_event_data, '{}'::jsonb),
    p_external_event_id,
    p_source,
    p_event_timestamp
  )
  ON CONFLICT (merchant_id, event_id, event_type) DO NOTHING;

  RETURN QUERY
  SELECT *
  FROM eventing.enqueue_domain_event_v1(
    p_producer,
    p_trust_level,
    format(
      'analytics:%s',
      pg_catalog.encode(
        extensions.digest(
          format('%s:%s:%s', p_merchant_id, p_event_type, p_external_event_id),
          'sha256'
        ),
        'hex'
      )
    ),
    p_external_event_id,
    p_event_name,
    'analytics_event',
    p_external_event_id,
    p_merchant_id,
    jsonb_build_object('schema', 'public', 'table', 'analytics_events'),
    jsonb_build_object(
      'event_type', p_event_type,
      'event_data', COALESCE(p_domain_event_data, '{}'::jsonb),
      'source', p_source
    ),
    COALESCE(p_metadata, '{}'::jsonb),
    p_event_timestamp,
    NULL,
    NULL,
    NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_analytics_domain_event_v1(
  uuid, text, text, jsonb, jsonb, text, text, text, text, timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_analytics_domain_event_v1(
  uuid, text, text, jsonb, jsonb, text, text, text, text, timestamptz, jsonb
) TO service_role;
