CREATE TABLE IF NOT EXISTS public.imei_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  tier text NOT NULL,
  imei_hash text NOT NULL,
  idempotency_key uuid NOT NULL UNIQUE,
  amount_ngn numeric(12, 2) NOT NULL,
  status text NOT NULL CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'wallet_rejected'::text,
        'refunded_error'::text,
        'refunded_not_found'::text,
        'refund_pending'::text,
        'completed'::text
      ]
    )
  ),
  sickw_status text,
  cached_response jsonb,
  cached_status integer,
  response_hash text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_imei_lookups_customer_created_at
  ON public.imei_lookups (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_imei_lookups_merchant_created_at
  ON public.imei_lookups (merchant_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.update_imei_lookups_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_imei_lookups_updated_at ON public.imei_lookups;
CREATE TRIGGER update_imei_lookups_updated_at
  BEFORE UPDATE ON public.imei_lookups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_imei_lookups_updated_at();

ALTER TABLE public.imei_lookups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.imei_lookups FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.imei_lookups TO authenticated;
GRANT ALL ON public.imei_lookups TO service_role;

CREATE POLICY "customer_reads_own_imei_lookups" ON public.imei_lookups
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = imei_lookups.customer_id
        AND c.user_id = (SELECT auth.uid())
    )
  );
