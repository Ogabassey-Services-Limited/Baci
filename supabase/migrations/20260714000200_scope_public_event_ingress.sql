-- Permit browser event ingestion only through short-lived, server-signed JWT
-- capabilities. Durable worker calls continue to use service_role.

CREATE OR REPLACE FUNCTION public.is_event_ingress_capability_v1(
  p_kind text,
  p_merchant_id uuid,
  p_event_type text,
  p_event_name text,
  p_event_id text,
  p_event_timestamp timestamptz,
  p_producer text,
  p_source text,
  p_trust_level text
) RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT COALESCE(
    auth.role() = 'service_role'
    OR (
      auth.role() = 'anon'
      AND auth.jwt() ->> 'baci_event_ingress_kind' = p_kind
      AND auth.jwt() ->> 'baci_event_ingress_merchant_id' = COALESCE(p_merchant_id::text, '')
      AND auth.jwt() ->> 'baci_event_ingress_event_type' = p_event_type
      AND auth.jwt() ->> 'baci_event_ingress_event_id' = COALESCE(p_event_id, '')
      AND auth.jwt() ->> 'baci_event_ingress_event_timestamp_ms' = floor(extract(epoch FROM p_event_timestamp) * 1000)::bigint::text
      AND auth.jwt() ->> 'baci_event_ingress_producer' = p_producer
      AND auth.jwt() ->> 'baci_event_ingress_source' = COALESCE(p_source, '')
      AND auth.jwt() ->> 'baci_event_ingress_trust_level' = p_trust_level
      AND (p_event_name IS NULL OR auth.jwt() ->> 'baci_event_ingress_event_name' = p_event_name)
    ),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.record_analytics_domain_event_v1(
  p_merchant_id uuid, p_event_type text, p_event_name text, p_event_data jsonb,
  p_domain_event_data jsonb, p_delivery_data jsonb, p_external_event_id text,
  p_source text, p_producer text, p_trust_level text, p_event_timestamp timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (domain_event_id uuid, queue_message_id bigint, already_enqueued boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s' AS $$
BEGIN
  IF NOT public.is_event_ingress_capability_v1(
    'analytics', p_merchant_id, p_event_type, p_event_name, p_external_event_id,
    p_event_timestamp, p_producer, p_source, p_trust_level
  ) THEN
    RAISE EXCEPTION 'forbidden: invalid analytics event ingress capability' USING ERRCODE = '42501';
  END IF;
  IF p_external_event_id IS NULL OR length(p_external_event_id) = 0 THEN
    RAISE EXCEPTION 'analytics_external_event_id_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_event_data, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_domain_event_data, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_delivery_data, '{}'::jsonb)) <> 'object'
    OR octet_length(COALESCE(p_event_data, '{}'::jsonb)::text) > 65536
    OR octet_length(COALESCE(p_domain_event_data, '{}'::jsonb)::text) > 65536
    OR octet_length(COALESCE(p_delivery_data, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'analytics_event_data_object_required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.analytics_events (merchant_id, event_type, event_data, event_id, source, event_timestamp)
  VALUES (p_merchant_id, p_event_type, COALESCE(p_event_data, '{}'::jsonb), p_external_event_id, p_source, p_event_timestamp)
  ON CONFLICT (merchant_id, event_id, event_type) DO NOTHING;
  RETURN QUERY SELECT * FROM eventing.enqueue_domain_event_v1(
    p_producer, p_trust_level,
    format('analytics:%s', pg_catalog.encode(extensions.digest(format('%s:%s:%s', p_merchant_id, p_event_type, p_external_event_id), 'sha256'), 'hex')),
    p_external_event_id, p_event_name, 'analytics_event', p_external_event_id, p_merchant_id,
    jsonb_build_object('schema', 'public', 'table', 'analytics_events'),
    jsonb_build_object('event_type', p_event_type, 'event_data', COALESCE(p_domain_event_data, '{}'::jsonb), 'delivery_user_data', COALESCE(p_delivery_data, '{}'::jsonb), 'source', p_source),
    COALESCE(p_metadata, '{}'::jsonb), p_event_timestamp, NULL, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_platform_domain_event_v1(
  p_event_type text, p_event_name text, p_event_data jsonb, p_delivery_data jsonb,
  p_external_event_id text, p_merchant_id uuid, p_session_id text, p_page_url text,
  p_referrer text, p_producer text, p_trust_level text, p_event_timestamp timestamptz,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE (domain_event_id uuid, queue_message_id bigint, already_enqueued boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s' AS $$
BEGIN
  IF NOT public.is_event_ingress_capability_v1(
    'platform', p_merchant_id, p_event_type, p_event_name, p_external_event_id,
    p_event_timestamp, p_producer, '', p_trust_level
  ) THEN
    RAISE EXCEPTION 'forbidden: invalid platform event ingress capability' USING ERRCODE = '42501';
  END IF;
  IF p_external_event_id IS NULL OR length(p_external_event_id) = 0 THEN
    RAISE EXCEPTION 'platform_external_event_id_required' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_event_data, '{}'::jsonb)) <> 'object'
    OR jsonb_typeof(COALESCE(p_delivery_data, '{}'::jsonb)) <> 'object'
    OR octet_length(COALESCE(p_event_data, '{}'::jsonb)::text) > 65536
    OR octet_length(COALESCE(p_delivery_data, '{}'::jsonb)::text) > 65536 THEN
    RAISE EXCEPTION 'platform_event_data_object_required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.platform_events (event_type, event_data, event_id, merchant_id, session_id, referrer, page_url, event_timestamp)
  VALUES (p_event_type, COALESCE(p_event_data, '{}'::jsonb), p_external_event_id, p_merchant_id, p_session_id, p_referrer, p_page_url, p_event_timestamp)
  ON CONFLICT (event_type, event_id) WHERE event_id IS NOT NULL DO NOTHING;
  RETURN QUERY SELECT * FROM eventing.enqueue_domain_event_v1(
    p_producer, p_trust_level,
    format('platform:%s', pg_catalog.encode(extensions.digest(format('%s:%s', p_event_type, p_external_event_id), 'sha256'), 'hex')),
    p_external_event_id, p_event_name, 'platform_event', p_external_event_id, p_merchant_id,
    jsonb_build_object('schema', 'public', 'table', 'platform_events'),
    jsonb_build_object('event_type', p_event_type, 'event_data', COALESCE(p_event_data, '{}'::jsonb), 'delivery_user_data', COALESCE(p_delivery_data, '{}'::jsonb), 'page_url', p_page_url, 'source', 'web'),
    COALESCE(p_metadata, '{}'::jsonb), p_event_timestamp, NULL, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.record_analytics_domain_event_v1(uuid, text, text, jsonb, jsonb, jsonb, text, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_platform_domain_event_v1(text, text, jsonb, jsonb, text, uuid, text, text, text, text, text, timestamptz, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_analytics_domain_event_v1(uuid, text, text, jsonb, jsonb, jsonb, text, text, text, text, timestamptz, jsonb) TO anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_platform_domain_event_v1(text, text, jsonb, jsonb, text, uuid, text, text, text, text, text, timestamptz, jsonb) TO anon, service_role;

DROP POLICY IF EXISTS "Event ingress capability inserts analytics events" ON public.analytics_events;
CREATE POLICY "Event ingress capability inserts analytics events" ON public.analytics_events
FOR INSERT TO anon WITH CHECK (
  public.is_event_ingress_capability_v1('analytics', merchant_id, event_type, NULL, COALESCE(event_id, ''), event_timestamp, CASE WHEN source = 'mobile_app' THEN 'mobile' ELSE 'web' END, source, 'anonymous_client')
);

DROP POLICY IF EXISTS "Anyone can insert platform events" ON public.platform_events;
DROP POLICY IF EXISTS "Event ingress capability inserts platform events" ON public.platform_events;
CREATE POLICY "Event ingress capability inserts platform events" ON public.platform_events
FOR INSERT TO anon WITH CHECK (
  public.is_event_ingress_capability_v1('platform', merchant_id, event_type, NULL, COALESCE(event_id, ''), event_timestamp, 'web', '', 'anonymous_client')
);
