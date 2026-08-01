-- The worker reads this finite, database-owned policy rather than deriving
-- customer or merchant notifications from arbitrary provider status text.

CREATE TABLE private.gigl_tracking_notification_policy (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  raw_status text,
  normalized_status text,
  audience text NOT NULL CHECK (audience IN ('merchant', 'customer')),
  notification_kind text NOT NULL CHECK (notification_kind IN (
    'pickup_assigned', 'pickup_en_route', 'pickup_delayed', 'picked_up',
    'transit_started', 'out_for_delivery', 'delivered',
    'delivery_attempt_failed', 'return_in_progress', 'shipment_exception',
    'failed', 'returned', 'cancelled'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gigl_tracking_notification_policy_one_selector
    CHECK (num_nonnulls(raw_status, normalized_status) = 1),
  CONSTRAINT gigl_tracking_notification_policy_raw_status_format
    CHECK (
      raw_status IS NULL OR (
        btrim(raw_status) <> ''
        AND raw_status = upper(raw_status)
        AND char_length(raw_status) <= 128
      )
    ),
  CONSTRAINT gigl_tracking_notification_policy_normalized_status_format
    CHECK (
      normalized_status IS NULL OR normalized_status IN (
        'pending', 'booked', 'pickup_scheduled', 'picked_up', 'in_transit',
        'out_for_delivery', 'delivered', 'cancelled', 'failed', 'returned'
      )
    ),
  CONSTRAINT gigl_tracking_notification_policy_raw_key
    UNIQUE (raw_status, audience, notification_kind),
  CONSTRAINT gigl_tracking_notification_policy_normalized_key
    UNIQUE (normalized_status, audience, notification_kind)
);

INSERT INTO private.gigl_tracking_notification_policy (
  raw_status, normalized_status, audience, notification_kind
) VALUES
  (NULL, 'pickup_scheduled', 'merchant', 'pickup_assigned'),
  ('RIDER EN ROUTE FOR PICKUP', NULL, 'merchant', 'pickup_en_route'),
  (NULL, 'picked_up', 'merchant', 'picked_up'),
  (NULL, 'in_transit', 'customer', 'transit_started'),
  (NULL, 'out_for_delivery', 'customer', 'out_for_delivery'),
  (NULL, 'delivered', 'customer', 'delivered'),
  (NULL, 'failed', 'merchant', 'failed'),
  (NULL, 'failed', 'customer', 'delivery_attempt_failed'),
  (NULL, 'returned', 'merchant', 'returned'),
  (NULL, 'returned', 'customer', 'return_in_progress'),
  (NULL, 'cancelled', 'merchant', 'cancelled')
ON CONFLICT DO NOTHING;

ALTER TABLE private.gigl_tracking_notification_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.gigl_tracking_notification_policy FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE private.gigl_tracking_notification_policy
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT SELECT ON TABLE private.gigl_tracking_notification_policy TO service_role;

CREATE POLICY gigl_tracking_notification_policy_service_read
  ON private.gigl_tracking_notification_policy
  FOR SELECT TO postgres, service_role
  USING (true);
