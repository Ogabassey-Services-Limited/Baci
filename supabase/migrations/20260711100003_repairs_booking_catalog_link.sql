-- Link repair bookings to the services catalogue.
--
-- All new columns are nullable so the free-text intake path keeps working for
-- merchants without a catalogue. Composite foreign keys keep device/quote links
-- inside one tenant and use the PG15 column-list SET NULL form so a catalogue
-- row deletion nulls only the link, never repairs.merchant_id (which is NOT NULL).

ALTER TABLE public.repairs
  ADD COLUMN IF NOT EXISTS device_id uuid,
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS quoted_price numeric(12, 2),
  ADD COLUMN IF NOT EXISTS repair_type_label text,
  ADD COLUMN IF NOT EXISTS shipment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repairs_shipment_fk'
      AND conrelid = 'public.repairs'::regclass
  ) THEN
    ALTER TABLE public.repairs
      ADD CONSTRAINT repairs_shipment_fk
      FOREIGN KEY (shipment_id)
      REFERENCES public.shipments (id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repairs_device_fk'
      AND conrelid = 'public.repairs'::regclass
  ) THEN
    ALTER TABLE public.repairs
      ADD CONSTRAINT repairs_device_fk
      FOREIGN KEY (device_id, merchant_id)
      REFERENCES public.repair_devices (id, merchant_id)
      ON DELETE SET NULL (device_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'repairs_quote_fk'
      AND conrelid = 'public.repairs'::regclass
  ) THEN
    ALTER TABLE public.repairs
      ADD CONSTRAINT repairs_quote_fk
      FOREIGN KEY (quote_id, merchant_id)
      REFERENCES public.repair_quotes (id, merchant_id)
      ON DELETE SET NULL (quote_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS repairs_device_id_idx ON public.repairs (device_id);
CREATE INDEX IF NOT EXISTS repairs_quote_id_idx ON public.repairs (quote_id);
CREATE INDEX IF NOT EXISTS repairs_shipment_id_idx ON public.repairs (shipment_id);

-- Status-lookup index for the public status page: scope by merchant, then match
-- ticket + normalized email.
CREATE INDEX IF NOT EXISTS repairs_status_lookup_idx
  ON public.repairs (merchant_id, ticket_number, lower(customer_email));

COMMENT ON COLUMN public.repairs.device_id IS 'Optional catalogue device link (tenant-scoped).';
COMMENT ON COLUMN public.repairs.quote_id IS 'Optional catalogue quote link (tenant-scoped).';
COMMENT ON COLUMN public.repairs.quoted_price IS 'Server-snapshotted price from the linked quote at booking time.';
COMMENT ON COLUMN public.repairs.repair_type_label IS 'Server-snapshotted service type name from the linked quote at booking time.';
COMMENT ON COLUMN public.repairs.shipment_id IS 'Optional courier pickup shipment link.';
