CREATE TABLE public.orders (
  id uuid PRIMARY KEY,
  merchant_id uuid NOT NULL
);

CREATE TABLE public.shipments (
  id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  merchant_id uuid NOT NULL
);

CREATE TABLE public.shipment_tracking_monitors (
  shipment_id uuid PRIMARY KEY,
  order_id uuid NOT NULL,
  provider text NOT NULL,
  state text NOT NULL,
  next_poll_at timestamptz,
  stopped_at timestamptz,
  storefront_refresh_requested_at timestamptz,
  storefront_refresh_lease_until timestamptz,
  locked_at timestamptz,
  locked_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.orders (id, merchant_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012');

INSERT INTO public.shipments (id, order_id, merchant_id)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000012');

INSERT INTO public.shipment_tracking_monitors (shipment_id, order_id, provider, state)
VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'GIGL', 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000002', 'GIGL', 'active');
