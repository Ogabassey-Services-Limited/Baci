-- Keep direct-insert fallbacks aligned with the trust levels accepted by the
-- capability-bound RPCs. This path is used only when an ingress RPC is absent.

DROP POLICY IF EXISTS "Event ingress capability inserts analytics events"
ON public.analytics_events;
CREATE POLICY "Event ingress capability inserts analytics events"
ON public.analytics_events
FOR INSERT TO anon
WITH CHECK (
  public.is_event_ingress_capability_v1(
    'analytics', merchant_id, event_type, NULL, COALESCE(event_id, ''),
    event_timestamp,
    CASE WHEN source = 'mobile_app' THEN 'mobile' ELSE 'web' END,
    source, 'anonymous_client'
  )
  OR public.is_event_ingress_capability_v1(
    'analytics', merchant_id, event_type, NULL, COALESCE(event_id, ''),
    event_timestamp,
    CASE WHEN source = 'mobile_app' THEN 'mobile' ELSE 'web' END,
    source, 'tenant_verified_client'
  )
);

DROP POLICY IF EXISTS "Event ingress capability inserts platform events"
ON public.platform_events;
CREATE POLICY "Event ingress capability inserts platform events"
ON public.platform_events
FOR INSERT TO anon
WITH CHECK (
  public.is_event_ingress_capability_v1(
    'platform', merchant_id, event_type, NULL, COALESCE(event_id, ''),
    event_timestamp, 'web', '', 'anonymous_client'
  )
  OR public.is_event_ingress_capability_v1(
    'platform', merchant_id, event_type, NULL, COALESCE(event_id, ''),
    event_timestamp, 'web', '', 'tenant_verified_client'
  )
);
