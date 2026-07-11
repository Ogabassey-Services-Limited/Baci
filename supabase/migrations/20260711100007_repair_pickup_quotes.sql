-- Reverse-logistics pickup for repairs: a PRIVATE quote-persistence table.
--
-- Topship bookShipment (providers/topship.ts) needs stored quote metadata with a
-- shipment charge. Order shipping persists that in public.shipping_quotes, but
-- shipping_quotes has a public SELECT USING (true) with anon grants and stores
-- sender/receiver PII in quote_request (a pre-existing exposure flagged as a
-- separate security follow-up). Repairs must NOT add to that surface, so pickup
-- quotes live here with merchant-only RLS and NO anon grants.
--
-- Also: repair pickups are courier shipments with no order, so shipments.order_id
-- is relaxed to NULL (existing rows are unaffected; the FK already allows NULL).

-- ---------------------------------------------------------------------------
-- Allow order-less shipments (repair courier pickups)
-- ---------------------------------------------------------------------------

ALTER TABLE public.shipments ALTER COLUMN order_id DROP NOT NULL;

COMMENT ON COLUMN public.shipments.order_id IS
  'Nullable: NULL for repair courier pickups (linked via public.repairs.shipment_id), set for order fulfilment shipments.';

-- ---------------------------------------------------------------------------
-- Private pickup-quote table
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.repair_pickup_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'TOPSHIP',
  service_tier text,
  carrier_name text,
  provider_rate_id text,
  charge numeric(12, 2) NOT NULL CHECK (charge >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  estimated_days integer,
  -- Sender/receiver PII + items for a booking refresh (never exposed publicly).
  quote_request jsonb NOT NULL,
  provider_metadata jsonb,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS repair_pickup_quotes_merchant_id_idx
  ON public.repair_pickup_quotes (merchant_id);
CREATE INDEX IF NOT EXISTS repair_pickup_quotes_repair_id_idx
  ON public.repair_pickup_quotes (repair_id);

DROP TRIGGER IF EXISTS repair_pickup_quotes_updated_at ON public.repair_pickup_quotes;
CREATE TRIGGER repair_pickup_quotes_updated_at
  BEFORE UPDATE ON public.repair_pickup_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Row level security (merchant/staff only; no public/anon path)
-- ---------------------------------------------------------------------------

ALTER TABLE public.repair_pickup_quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS repair_pickup_quotes_staff_read ON public.repair_pickup_quotes;
CREATE POLICY repair_pickup_quotes_staff_read ON public.repair_pickup_quotes
  FOR SELECT TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'view'));

DROP POLICY IF EXISTS repair_pickup_quotes_staff_insert ON public.repair_pickup_quotes;
CREATE POLICY repair_pickup_quotes_staff_insert ON public.repair_pickup_quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_pickup_quotes_staff_update ON public.repair_pickup_quotes;
CREATE POLICY repair_pickup_quotes_staff_update ON public.repair_pickup_quotes
  FOR UPDATE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'))
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_pickup_quotes_staff_delete ON public.repair_pickup_quotes;
CREATE POLICY repair_pickup_quotes_staff_delete ON public.repair_pickup_quotes
  FOR DELETE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'delete'));

-- ---------------------------------------------------------------------------
-- Grants: lock everything down; service_role + staff writes only, never anon.
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.repair_pickup_quotes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.repair_pickup_quotes TO service_role;
-- Authenticated staff act through the check_staff_permission policies above.
-- anon is deliberately granted NOTHING (this table carries pickup PII).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_pickup_quotes TO authenticated;

COMMENT ON TABLE public.repair_pickup_quotes IS
  'Private per-repair courier pickup quotes (Topship). Merchant-only RLS, no anon grants; quote_request holds pickup PII and must never be publicly readable.';
COMMENT ON COLUMN public.repair_pickup_quotes.charge IS
  'Shipment charge in naira from the persisted quote; required by Topship bookShipment.';
COMMENT ON COLUMN public.repair_pickup_quotes.quote_request IS
  'Full quote request (sender=customer pickup address, receiver=merchant repair center, items) for a booking refresh. Private.';
