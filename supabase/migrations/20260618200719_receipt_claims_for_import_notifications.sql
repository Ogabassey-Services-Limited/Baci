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
  notification_sent_at timestamp with time zone,
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

CREATE INDEX IF NOT EXISTS idx_receipt_claims_import_job_id
  ON public.receipt_claims (import_job_id);

CREATE INDEX IF NOT EXISTS idx_receipt_claims_expires_at
  ON public.receipt_claims (expires_at)
  WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_receipt_claim_orders_order_id
  ON public.receipt_claim_orders (order_id);

ALTER TABLE public.receipt_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_claim_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_claims_service_role_all ON public.receipt_claims;
CREATE POLICY receipt_claims_service_role_all
  ON public.receipt_claims
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS receipt_claim_orders_service_role_all ON public.receipt_claim_orders;
CREATE POLICY receipt_claim_orders_service_role_all
  ON public.receipt_claim_orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.receipt_claims FROM anon, authenticated;
REVOKE ALL ON TABLE public.receipt_claim_orders FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipt_claims TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.receipt_claim_orders TO service_role;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.preview_receipt_claim(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim public.receipt_claims%ROWTYPE;
  v_merchant jsonb;
  v_orders jsonb;
BEGIN
  SELECT rc.* INTO v_claim
  FROM public.receipt_claims AS rc
  WHERE rc.token_hash = p_token_hash
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE public.receipt_claims
  SET last_viewed_at = now(),
      updated_at = now()
  WHERE id = v_claim.id;

  SELECT jsonb_build_object(
    'business_name', m.business_name,
    'slug', m.slug
  )
  INTO v_merchant
  FROM public.merchants AS m
  WHERE m.id = v_claim.merchant_id;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'order_number', o.order_number,
        'order_items', COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', oi.name,
                'quantity', oi.quantity
              )
              ORDER BY oi.created_at NULLS LAST, oi.id
            )
            FROM public.order_items AS oi
            WHERE oi.order_id = o.id
          ),
          '[]'::jsonb
        )
      )
      ORDER BY o.created_at NULLS LAST, o.id
    ),
    '[]'::jsonb
  )
  INTO v_orders
  FROM public.receipt_claim_orders AS rco
  JOIN public.orders AS o
    ON o.id = rco.order_id
  WHERE rco.receipt_claim_id = v_claim.id;

  RETURN jsonb_build_object(
    'id', v_claim.id,
    'merchant_id', v_claim.merchant_id,
    'customer_id', v_claim.customer_id,
    'customer_email', v_claim.customer_email,
    'customer_name', v_claim.customer_name,
    'expires_at', v_claim.expires_at,
    'claimed_at', v_claim.claimed_at,
    'claimed_by_user_id', v_claim.claimed_by_user_id,
    'merchant', v_merchant,
    'orders', v_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION private.preview_receipt_claim(text)
  FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO anon, authenticated;
GRANT EXECUTE ON FUNCTION private.preview_receipt_claim(text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_receipt_claim(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.preview_receipt_claim(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.preview_receipt_claim(text)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_receipt_claim(text)
  TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.redeem_receipt_claim(p_token_hash text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_claim public.receipt_claims%ROWTYPE;
  v_customer_id uuid;
  v_user_email text := lower(btrim(COALESCE(auth.jwt() ->> 'email', '')));
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('status', 'unauthorized');
  END IF;

  SELECT rc.* INTO v_claim
  FROM public.receipt_claims AS rc
  WHERE rc.token_hash = p_token_hash
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_claim.expires_at <= now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF lower(btrim(v_claim.customer_email)) <> v_user_email THEN
    RETURN jsonb_build_object('status', 'email_mismatch');
  END IF;

  IF v_claim.claimed_by_user_id IS NOT NULL
    AND v_claim.claimed_by_user_id <> v_user_id THEN
    RETURN jsonb_build_object('status', 'already_used');
  END IF;

  UPDATE public.customers AS c
  SET user_id = v_user_id,
      last_login_at = now(),
      updated_at = now()
  WHERE c.id = v_claim.customer_id
    AND c.merchant_id = v_claim.merchant_id
    AND (c.user_id IS NULL OR c.user_id = v_user_id)
  RETURNING c.id INTO v_customer_id;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('status', 'customer_link_failed');
  END IF;

  UPDATE public.receipt_claims
  SET claimed_at = COALESCE(claimed_at, now()),
      claimed_by_user_id = v_user_id,
      last_viewed_at = now(),
      updated_at = now()
  WHERE id = v_claim.id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'redirectPath', '/receipts'
  );
END;
$$;

REVOKE ALL ON FUNCTION private.redeem_receipt_claim(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.redeem_receipt_claim(text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.redeem_receipt_claim(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.redeem_receipt_claim(p_token_hash);
$$;

REVOKE ALL ON FUNCTION public.redeem_receipt_claim(text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_receipt_claim(text)
  TO authenticated;

COMMENT ON TABLE public.receipt_claims IS
  'Stores hashed one-time receipt claim links generated for imported order notification emails.';

COMMENT ON TABLE public.receipt_claim_orders IS
  'Links receipt claim emails to the imported orders the customer can claim after email-verified sign-in.';

COMMENT ON COLUMN public.receipt_claims.token_hash IS
  'SHA-256 hash of the emailed claim token. The raw bearer token is never stored.';
