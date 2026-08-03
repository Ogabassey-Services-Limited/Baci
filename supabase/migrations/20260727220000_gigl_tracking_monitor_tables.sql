-- Durable, service-owned state for GIGL shipment monitoring and notifications.

CREATE TABLE public.shipment_tracking_monitors (
  shipment_id uuid PRIMARY KEY REFERENCES public.shipments(id) ON DELETE CASCADE,
  tracking_epoch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  tracking_timeline_generation integer NOT NULL
    CHECK (tracking_timeline_generation > 0),
  provider text NOT NULL CHECK (provider = 'GIGL'),
  tracking_number text NOT NULL CHECK (
    btrim(tracking_number) <> ''
    AND pg_catalog.char_length(tracking_number) <= 128
    AND pg_catalog.char_length(btrim(tracking_number)) <= 128
  ),
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'final_poll', 'paused', 'terminal', 'inactive')),
  notification_events_not_before timestamptz,
  next_poll_at timestamptz,
  last_polled_at timestamptz,
  last_event_at timestamptz,
  storefront_refresh_requested_at timestamptz,
  storefront_refresh_lease_until timestamptz,
  unchanged_poll_count integer NOT NULL DEFAULT 0 CHECK (unchanged_poll_count >= 0),
  consecutive_failures integer NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  last_error text,
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.shipment_tracking_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  tracking_epoch_id uuid NOT NULL,
  tracking_number text NOT NULL CHECK (
    btrim(tracking_number) <> ''
    AND pg_catalog.char_length(tracking_number) <= 128
    AND pg_catalog.char_length(btrim(tracking_number)) <= 128
  ),
  provider text NOT NULL CHECK (provider = 'GIGL'),
  provider_event_key text NOT NULL CHECK (
    btrim(provider_event_key) <> ''
    AND pg_catalog.char_length(provider_event_key) <= 256
  ),
  provider_event_id text CHECK (
    provider_event_id IS NULL OR pg_catalog.char_length(provider_event_id) <= 128
  ),
  raw_status text NOT NULL CHECK (
    btrim(raw_status) <> '' AND pg_catalog.char_length(raw_status) <= 128
  ),
  normalized_status text NOT NULL CHECK (
    pg_catalog.char_length(normalized_status) <= 64
  ),
  description text NOT NULL CHECK (
    pg_catalog.char_length(description) <= 2048
  ),
  location text CHECK (location IS NULL OR pg_catalog.char_length(location) <= 512),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipment_tracking_events_identity_key
    UNIQUE (shipment_id, tracking_epoch_id, provider_event_key)
);

CREATE TABLE public.shipment_tracking_notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  tracking_epoch_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  tracking_event_id uuid NOT NULL REFERENCES public.shipment_tracking_events(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('merchant', 'customer')),
  notification_kind text NOT NULL CHECK (notification_kind IN (
    'pickup_assigned', 'pickup_en_route', 'pickup_delayed', 'picked_up',
    'transit_started', 'out_for_delivery', 'delivered',
    'delivery_attempt_failed', 'return_in_progress', 'shipment_exception',
    'failed', 'returned', 'cancelled'
  )),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'skipped', 'failed')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  delivery_started_at timestamptz,
  sent_at timestamptz,
  skipped_at timestamptz,
  skip_reason text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shipment_tracking_notifications_identity_key
    UNIQUE (shipment_id, tracking_epoch_id, audience, notification_kind)
);

CREATE INDEX shipment_tracking_monitors_due_idx
  ON public.shipment_tracking_monitors (next_poll_at)
  WHERE state IN ('active', 'final_poll') AND next_poll_at IS NOT NULL;
CREATE INDEX shipment_tracking_monitors_order_id_idx
  ON public.shipment_tracking_monitors (order_id);
CREATE INDEX shipment_tracking_events_shipment_occurred_idx
  ON public.shipment_tracking_events (shipment_id, occurred_at DESC);
CREATE INDEX shipment_tracking_notification_outbox_ready_idx
  ON public.shipment_tracking_notification_outbox (next_attempt_at)
  WHERE status = 'pending';
CREATE INDEX shipment_tracking_notification_outbox_order_id_idx
  ON public.shipment_tracking_notification_outbox (order_id);
CREATE INDEX shipment_tracking_notification_outbox_merchant_id_idx
  ON public.shipment_tracking_notification_outbox (merchant_id);
CREATE INDEX shipment_tracking_notification_outbox_tracking_event_id_idx
  ON public.shipment_tracking_notification_outbox (tracking_event_id);

ALTER TABLE public.shipment_tracking_monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_monitors FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_tracking_notification_outbox FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shipment_tracking_monitors FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shipment_tracking_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shipment_tracking_notification_outbox FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_tracking_monitors TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_tracking_events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipment_tracking_notification_outbox TO service_role;

CREATE POLICY shipment_tracking_monitors_service_all
  ON public.shipment_tracking_monitors FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
CREATE POLICY shipment_tracking_events_service_all
  ON public.shipment_tracking_events FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
CREATE POLICY shipment_tracking_notification_outbox_service_all
  ON public.shipment_tracking_notification_outbox FOR ALL TO postgres, service_role
  USING (true) WITH CHECK (true);
