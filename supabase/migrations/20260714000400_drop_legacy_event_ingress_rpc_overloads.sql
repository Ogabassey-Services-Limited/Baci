-- Remove pre-delivery-context overloads so every durable event ingress call
-- must provide the capability-bound delivery payload introduced later.

DROP FUNCTION IF EXISTS public.record_analytics_domain_event_v1(
  uuid, text, text, jsonb, jsonb, text, text, text, text, timestamptz, jsonb
);

DROP FUNCTION IF EXISTS public.record_platform_domain_event_v1(
  text, text, jsonb, text, uuid, text, text, text, text, text, timestamptz, jsonb
);
