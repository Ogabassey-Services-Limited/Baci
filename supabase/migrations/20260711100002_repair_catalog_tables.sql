-- Repairs services catalogue: service types, devices, and per-device quotes.
--
-- Device-first model: customers pick a device (brand -> model) and see repair
-- types + prices. Every cross-table link is tenant-scoped via composite foreign
-- keys so a row can never reference another merchant's row.
--
-- Security posture (verified against the anon key AND an authenticated customer
-- session on a Supabase branch before merge):
--   * Public SELECT is gated by is_active AND repairs_catalog_publicly_enabled()
--     so REST never exposes rows for merchants with the flag OFF or a
--     non-electronics business type.
--   * Column-scoped SELECT grants exclude repair_quotes.internal_notes from both
--     anon AND authenticated (signed-in storefront customers use authenticated).
--   * Staff writes are gated by check_staff_permission('repairs', ...).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.repair_service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_service_types_merchant_slug_key UNIQUE (merchant_id, slug),
  CONSTRAINT repair_service_types_id_merchant_key UNIQUE (id, merchant_id)
);

CREATE TABLE IF NOT EXISTS public.repair_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  brand text NOT NULL,
  model text NOT NULL,
  slug text NOT NULL,
  device_type text,
  product_id uuid,
  aliases text[] NOT NULL DEFAULT '{}',
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_devices_merchant_slug_key UNIQUE (merchant_id, slug),
  CONSTRAINT repair_devices_id_merchant_key UNIQUE (id, merchant_id),
  CONSTRAINT repair_devices_device_type_check CHECK (
    device_type IS NULL OR device_type IN (
      'Smartphone', 'Laptop', 'Tablet', 'Console', 'Smartwatch', 'Other'
    )
  )
);

CREATE TABLE IF NOT EXISTS public.repair_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  device_id uuid NOT NULL,
  service_type_id uuid NOT NULL,
  price numeric(12, 2) NOT NULL CHECK (price >= 0),
  is_from_price boolean NOT NULL DEFAULT true,
  part_quality text,
  turnaround text,
  warranty_days integer,
  description text,
  internal_notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT repair_quotes_id_merchant_key UNIQUE (id, merchant_id)
);

-- ---------------------------------------------------------------------------
-- Tenant-scoped composite foreign keys
-- ---------------------------------------------------------------------------

-- Backing unique index so repair_devices can reference products within one tenant.
CREATE UNIQUE INDEX IF NOT EXISTS products_id_merchant_id_key
  ON public.products (id, merchant_id);

-- repair_devices.product_id -> products, scoped to the same merchant.
-- Column-list SET NULL (PG15) so deleting a product nulls only the link, never
-- merchant_id (which is NOT NULL). MATCH SIMPLE lets a NULL product_id pass.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_devices_product_fk'
      AND conrelid = 'public.repair_devices'::regclass
  ) THEN
    ALTER TABLE public.repair_devices
      ADD CONSTRAINT repair_devices_product_fk
      FOREIGN KEY (product_id, merchant_id)
      REFERENCES public.products (id, merchant_id)
      ON DELETE SET NULL (product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_quotes_device_fk'
      AND conrelid = 'public.repair_quotes'::regclass
  ) THEN
    ALTER TABLE public.repair_quotes
      ADD CONSTRAINT repair_quotes_device_fk
      FOREIGN KEY (device_id, merchant_id)
      REFERENCES public.repair_devices (id, merchant_id)
      ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repair_quotes_service_type_fk'
      AND conrelid = 'public.repair_quotes'::regclass
  ) THEN
    ALTER TABLE public.repair_quotes
      ADD CONSTRAINT repair_quotes_service_type_fk
      FOREIGN KEY (service_type_id, merchant_id)
      REFERENCES public.repair_service_types (id, merchant_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Indexes (foreign keys + lookup + uniqueness)
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS repair_devices_merchant_brand_idx
  ON public.repair_devices (merchant_id, brand);
CREATE INDEX IF NOT EXISTS repair_devices_product_id_idx
  ON public.repair_devices (product_id);
CREATE INDEX IF NOT EXISTS repair_quotes_merchant_id_idx
  ON public.repair_quotes (merchant_id);
CREATE INDEX IF NOT EXISTS repair_quotes_device_id_idx
  ON public.repair_quotes (device_id);
CREATE INDEX IF NOT EXISTS repair_quotes_service_type_id_idx
  ON public.repair_quotes (service_type_id);

-- One quote per device x service type x part quality. NULLS NOT DISTINCT (PG15)
-- so two NULL part_quality rows for the same pair still collide.
CREATE UNIQUE INDEX IF NOT EXISTS repair_quotes_device_service_quality_key
  ON public.repair_quotes (device_id, service_type_id, part_quality)
  NULLS NOT DISTINCT;

-- ---------------------------------------------------------------------------
-- updated_at triggers (reuse the shared helper)
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS repair_service_types_updated_at ON public.repair_service_types;
CREATE TRIGGER repair_service_types_updated_at
  BEFORE UPDATE ON public.repair_service_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS repair_devices_updated_at ON public.repair_devices;
CREATE TRIGGER repair_devices_updated_at
  BEFORE UPDATE ON public.repair_devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS repair_quotes_updated_at ON public.repair_quotes;
CREATE TRIGGER repair_quotes_updated_at
  BEFORE UPDATE ON public.repair_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Public feature-gate helper
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER so the RLS policies can answer "is the catalogue publicly
-- enabled?" without granting anon read access to merchant_feature_settings.
-- Normalizes business_type exactly like the app (electronics + legacy gadgets).
CREATE OR REPLACE FUNCTION public.repairs_catalog_publicly_enabled(p_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.merchants AS m
    JOIN public.merchant_feature_settings AS mfs ON mfs.merchant_id = m.id
    WHERE m.id = p_merchant_id
      AND mfs.repairs_catalog_enabled IS TRUE
      AND lower(m.business_type) IN ('electronics', 'gadgets')
  );
$$;

COMMENT ON FUNCTION public.repairs_catalog_publicly_enabled(uuid) IS
  'True when the merchant has repairs_catalog_enabled and an electronics/gadgets business type. Used by the public catalogue RLS policies.';

REVOKE ALL ON FUNCTION public.repairs_catalog_publicly_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.repairs_catalog_publicly_enabled(uuid)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

ALTER TABLE public.repair_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_quotes ENABLE ROW LEVEL SECURITY;

-- Public read: active rows for merchants whose catalogue is publicly enabled.
DROP POLICY IF EXISTS repair_service_types_public_read ON public.repair_service_types;
CREATE POLICY repair_service_types_public_read ON public.repair_service_types
  FOR SELECT TO anon, authenticated
  USING (is_active AND public.repairs_catalog_publicly_enabled(merchant_id));

DROP POLICY IF EXISTS repair_devices_public_read ON public.repair_devices;
CREATE POLICY repair_devices_public_read ON public.repair_devices
  FOR SELECT TO anon, authenticated
  USING (is_active AND public.repairs_catalog_publicly_enabled(merchant_id));

DROP POLICY IF EXISTS repair_quotes_public_read ON public.repair_quotes;
CREATE POLICY repair_quotes_public_read ON public.repair_quotes
  FOR SELECT TO anon, authenticated
  USING (is_active AND public.repairs_catalog_publicly_enabled(merchant_id));

-- Staff read: owners/staff with repairs.view see all their rows (incl. inactive).
DROP POLICY IF EXISTS repair_service_types_staff_read ON public.repair_service_types;
CREATE POLICY repair_service_types_staff_read ON public.repair_service_types
  FOR SELECT TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'view'));

DROP POLICY IF EXISTS repair_devices_staff_read ON public.repair_devices;
CREATE POLICY repair_devices_staff_read ON public.repair_devices
  FOR SELECT TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'view'));

DROP POLICY IF EXISTS repair_quotes_staff_read ON public.repair_quotes;
CREATE POLICY repair_quotes_staff_read ON public.repair_quotes
  FOR SELECT TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'view'));

-- Staff insert: repairs.edit.
DROP POLICY IF EXISTS repair_service_types_staff_insert ON public.repair_service_types;
CREATE POLICY repair_service_types_staff_insert ON public.repair_service_types
  FOR INSERT TO authenticated
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_devices_staff_insert ON public.repair_devices;
CREATE POLICY repair_devices_staff_insert ON public.repair_devices
  FOR INSERT TO authenticated
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_quotes_staff_insert ON public.repair_quotes;
CREATE POLICY repair_quotes_staff_insert ON public.repair_quotes
  FOR INSERT TO authenticated
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

-- Staff update: repairs.edit.
DROP POLICY IF EXISTS repair_service_types_staff_update ON public.repair_service_types;
CREATE POLICY repair_service_types_staff_update ON public.repair_service_types
  FOR UPDATE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'))
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_devices_staff_update ON public.repair_devices;
CREATE POLICY repair_devices_staff_update ON public.repair_devices
  FOR UPDATE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'))
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

DROP POLICY IF EXISTS repair_quotes_staff_update ON public.repair_quotes;
CREATE POLICY repair_quotes_staff_update ON public.repair_quotes
  FOR UPDATE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'))
  WITH CHECK (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'edit'));

-- Staff delete: repairs.delete.
DROP POLICY IF EXISTS repair_service_types_staff_delete ON public.repair_service_types;
CREATE POLICY repair_service_types_staff_delete ON public.repair_service_types
  FOR DELETE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'delete'));

DROP POLICY IF EXISTS repair_devices_staff_delete ON public.repair_devices;
CREATE POLICY repair_devices_staff_delete ON public.repair_devices
  FOR DELETE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'delete'));

DROP POLICY IF EXISTS repair_quotes_staff_delete ON public.repair_quotes;
CREATE POLICY repair_quotes_staff_delete ON public.repair_quotes
  FOR DELETE TO authenticated
  USING (public.check_staff_permission((SELECT auth.uid()), merchant_id, 'repairs', 'delete'));

-- ---------------------------------------------------------------------------
-- Grants: lock everything down, then hand back column-scoped reads + staff writes
-- ---------------------------------------------------------------------------

REVOKE ALL ON TABLE public.repair_service_types FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_devices FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.repair_quotes FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.repair_service_types TO service_role;
GRANT ALL ON TABLE public.repair_devices TO service_role;
GRANT ALL ON TABLE public.repair_quotes TO service_role;

-- Column-scoped public reads (both anon and signed-in customers).
GRANT SELECT (
  id, merchant_id, name, slug, description, sort_order, is_active, created_at, updated_at
) ON public.repair_service_types TO anon, authenticated;

GRANT SELECT (
  id, merchant_id, brand, model, slug, device_type, product_id, aliases, image_url,
  is_active, sort_order, created_at, updated_at
) ON public.repair_devices TO anon, authenticated;

-- internal_notes is deliberately excluded from this grant for BOTH roles.
GRANT SELECT (
  id, merchant_id, device_id, service_type_id, price, is_from_price, part_quality,
  turnaround, warranty_days, description, is_active, created_at, updated_at
) ON public.repair_quotes TO anon, authenticated;

-- Staff writes flow through the check_staff_permission policies above.
GRANT INSERT, UPDATE, DELETE ON public.repair_service_types TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.repair_devices TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.repair_quotes TO authenticated;

COMMENT ON TABLE public.repair_service_types IS 'Per-merchant repair service categories (e.g. Screen Replacement).';
COMMENT ON TABLE public.repair_devices IS 'Per-merchant repairable devices; product_id links to the device product catalogue within one tenant.';
COMMENT ON TABLE public.repair_quotes IS 'Per-device repair prices. internal_notes is merchant-only and excluded from public column grants.';
