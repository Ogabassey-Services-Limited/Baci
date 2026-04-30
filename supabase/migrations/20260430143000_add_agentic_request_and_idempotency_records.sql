CREATE TABLE IF NOT EXISTS public.agentic_request_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  api_version text NOT NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS agentic_request_records_merchant_request_id_idx
  ON public.agentic_request_records (merchant_id, request_id);

CREATE INDEX IF NOT EXISTS agentic_request_records_expires_at_idx
  ON public.agentic_request_records (expires_at);

ALTER TABLE public.agentic_request_records ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.agentic_idempotency_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  route text NOT NULL,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_body jsonb,
  status_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS agentic_idempotency_records_key_idx
  ON public.agentic_idempotency_records (merchant_id, route, idempotency_key);

CREATE INDEX IF NOT EXISTS agentic_idempotency_records_expires_at_idx
  ON public.agentic_idempotency_records (expires_at);

ALTER TABLE public.agentic_idempotency_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.touch_agentic_idempotency_records_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agentic_idempotency_records_updated_at_trg
  ON public.agentic_idempotency_records;
CREATE TRIGGER agentic_idempotency_records_updated_at_trg
  BEFORE UPDATE ON public.agentic_idempotency_records
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_agentic_idempotency_records_updated_at();

DROP POLICY IF EXISTS "Agentic clients manage own request records" ON public.agentic_request_records;
CREATE POLICY "Agentic clients manage own request records"
  ON public.agentic_request_records
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

DROP POLICY IF EXISTS "Agentic clients manage own idempotency records" ON public.agentic_idempotency_records;
CREATE POLICY "Agentic clients manage own idempotency records"
  ON public.agentic_idempotency_records
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );
