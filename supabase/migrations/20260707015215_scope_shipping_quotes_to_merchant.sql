ALTER TABLE public.shipping_quotes
  ADD COLUMN IF NOT EXISTS merchant_id uuid;

UPDATE public.shipping_quotes sq
SET merchant_id = o.merchant_id
FROM public.orders o
WHERE o.selected_quote_id = sq.id
  AND sq.merchant_id IS NULL
  AND o.merchant_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.shipping_quotes'::regclass
      AND conname = 'shipping_quotes_merchant_id_fkey'
  ) THEN
    ALTER TABLE public.shipping_quotes
      ADD CONSTRAINT shipping_quotes_merchant_id_fkey
      FOREIGN KEY (merchant_id)
      REFERENCES public.merchants(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_shipping_quotes_merchant_id
  ON public.shipping_quotes (merchant_id);

CREATE OR REPLACE FUNCTION public.get_checkout_shipping_quote(
  p_quote_id uuid,
  p_merchant_id uuid
)
RETURNS TABLE (
  merchant_id uuid,
  provider text,
  provider_rate_id text,
  quote_request jsonb,
  price numeric,
  expires_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    sq.merchant_id,
    sq.provider,
    sq.provider_rate_id,
    sq.quote_request - 'sender',
    sq.price,
    sq.expires_at
  FROM public.shipping_quotes sq
  WHERE sq.id = p_quote_id
    AND sq.merchant_id = p_merchant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_checkout_shipping_quote(uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_shipping_quote(uuid, uuid)
  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public can create quotes"
  ON public.shipping_quotes;
DROP POLICY IF EXISTS "Public can read quotes"
  ON public.shipping_quotes;
DROP POLICY IF EXISTS "Can update recent quotes"
  ON public.shipping_quotes;
DROP POLICY IF EXISTS "Merchant staff can create scoped shipping quotes"
  ON public.shipping_quotes;
DROP POLICY IF EXISTS "Merchant staff can read scoped shipping quotes"
  ON public.shipping_quotes;
DROP POLICY IF EXISTS "Merchant staff can update recent scoped shipping quotes"
  ON public.shipping_quotes;

REVOKE ALL ON TABLE public.shipping_quotes FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.shipping_quotes TO authenticated;
GRANT ALL ON TABLE public.shipping_quotes TO service_role;

CREATE POLICY "Merchant staff can create scoped shipping quotes"
  ON public.shipping_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    merchant_id IS NOT NULL
    AND price IS NOT NULL
    AND public.has_merchant_access(merchant_id)
  );

CREATE POLICY "Merchant staff can read scoped shipping quotes"
  ON public.shipping_quotes
  FOR SELECT
  TO authenticated
  USING (
    merchant_id IS NOT NULL
    AND public.has_merchant_access(merchant_id)
  );

CREATE POLICY "Merchant staff can update recent scoped shipping quotes"
  ON public.shipping_quotes
  FOR UPDATE
  TO authenticated
  USING (
    merchant_id IS NOT NULL
    AND created_at > now() - interval '24 hours'
    AND public.has_merchant_access(merchant_id)
  )
  WITH CHECK (
    merchant_id IS NOT NULL
    AND created_at > now() - interval '24 hours'
    AND public.has_merchant_access(merchant_id)
  );
