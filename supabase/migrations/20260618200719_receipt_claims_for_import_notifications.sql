CREATE TABLE IF NOT EXISTS public.receipt_claims (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  customer_email text NOT NULL,
  customer_email_normalized text GENERATED ALWAYS AS (lower(btrim(customer_email))) STORED,
  customer_name text,
  token_hash text NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + interval '90 days') NOT NULL,
  claimed_at timestamp with time zone,
  claimed_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_viewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT receipt_claims_pkey PRIMARY KEY (id),
  CONSTRAINT receipt_claims_customer_email_not_empty CHECK (length(btrim(customer_email)) > 0),
  CONSTRAINT receipt_claims_token_hash_length CHECK (length(token_hash) = 64),
  CONSTRAINT receipt_claims_import_job_email_key UNIQUE (import_job_id, customer_email_normalized)
);

CREATE TABLE IF NOT EXISTS public.receipt_claim_orders (
  receipt_claim_id uuid NOT NULL REFERENCES public.receipt_claims(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT receipt_claim_orders_pkey PRIMARY KEY (receipt_claim_id, order_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipt_claims_token_hash
  ON public.receipt_claims (token_hash);

CREATE INDEX IF NOT EXISTS idx_receipt_claims_customer_id
  ON public.receipt_claims (customer_id);

CREATE INDEX IF NOT EXISTS idx_receipt_claims_claimed_by_user_id
  ON public.receipt_claims (claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipt_claims_merchant_job
  ON public.receipt_claims (merchant_id, import_job_id);

CREATE INDEX IF NOT EXISTS idx_receipt_claim_orders_order_id
  ON public.receipt_claim_orders (order_id);

ALTER TABLE public.receipt_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_claim_orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.receipt_claims FROM anon, authenticated;
REVOKE ALL ON TABLE public.receipt_claim_orders FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipt_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipt_claim_orders TO service_role;

COMMENT ON TABLE public.receipt_claims IS
  'Stores hashed one-time receipt claim links generated for imported order notification emails.';

COMMENT ON TABLE public.receipt_claim_orders IS
  'Links receipt claim emails to the imported orders the customer can claim after email-verified sign-in.';

COMMENT ON COLUMN public.receipt_claims.token_hash IS
  'SHA-256 hash of the emailed claim token. The raw bearer token is never stored.';
