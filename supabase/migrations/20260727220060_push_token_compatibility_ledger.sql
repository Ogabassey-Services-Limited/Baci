-- Identifier-free, append-only evidence for the Stage A push-token bridge.
-- The mutable push_tokens row is deliberately not the adoption ledger.

CREATE TABLE private.push_token_compatibility_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_kind text NOT NULL CHECK (event_kind IN ('legacy_registration', 'legacy_direct_logout')),
  app_type text NOT NULL CHECK (app_type IN ('admin', 'storefront')),
  platform text NOT NULL,
  build_number integer,
  shipment_update_capability integer,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.push_token_compatibility_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON SCHEMA private FROM anon, authenticated;
REVOKE ALL ON TABLE private.push_token_compatibility_events FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON TABLE private.push_token_compatibility_events TO service_role;
-- No client role can write or alter rollout evidence. The owner-executed RPC
-- and trigger functions are the only insertion paths.
REVOKE INSERT, UPDATE, DELETE ON TABLE private.push_token_compatibility_events
  FROM PUBLIC, anon, authenticated, service_role;
