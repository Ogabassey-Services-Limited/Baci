-- Wallet-funded order auto-debit.
--
-- A customer transfers to their reusable Paystack wallet DVA. The Paystack
-- webhook first marks the funding transaction completed, then this finalizer
-- credits the wallet once and, only when the expected shortfall is fully
-- funded, debits the wallet exactly once to mark the order paid.

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS wallet_order_auto_debit_enabled boolean DEFAULT false;

COMMENT ON COLUMN public.merchant_feature_settings.wallet_order_auto_debit_enabled IS
  'Enables checkout bank transfer to customer wallet DVA with automatic wallet debit for the order.';

CREATE TABLE IF NOT EXISTS public.order_wallet_funding_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  wallet_payment_account_id uuid NOT NULL REFERENCES public.customer_wallet_payment_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  expected_amount numeric(12,2) NOT NULL,
  target_order_amount numeric(12,2) NOT NULL,
  wallet_balance_snapshot numeric(12,2) NOT NULL DEFAULT 0,
  funded_amount numeric(12,2) NOT NULL DEFAULT 0,
  debited_amount numeric(12,2) NOT NULL DEFAULT 0,
  excess_amount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'pending',
  idempotency_key text NOT NULL,
  last_gateway_reference text,
  last_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_wallet_funding_intents_provider_check
    CHECK (provider = 'paystack'),
  CONSTRAINT order_wallet_funding_intents_amounts_check CHECK (
    expected_amount > 0
    AND target_order_amount > 0
    AND wallet_balance_snapshot >= 0
    AND funded_amount >= 0
    AND debited_amount >= 0
    AND excess_amount >= 0
    AND target_order_amount >= debited_amount
    AND target_order_amount >= expected_amount
  ),
  CONSTRAINT order_wallet_funding_intents_currency_check
    CHECK (currency = upper(currency)),
  CONSTRAINT order_wallet_funding_intents_status_check
    CHECK (status = ANY (ARRAY[
      'pending'::text,
      'underfunded'::text,
      'funded'::text,
      'processing'::text,
      'completed'::text,
      'expired'::text,
      'cancelled'::text,
      'review_required'::text,
      'failed'::text
    ]))
);

CREATE TABLE IF NOT EXISTS public.order_wallet_funding_intent_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intent_id uuid NOT NULL REFERENCES public.order_wallet_funding_intents(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  gateway_reference text NOT NULL,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id),
  amount numeric(12,2) NOT NULL,
  gateway_fee numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  paid_at timestamptz NOT NULL,
  wallet_credit_transaction_id uuid REFERENCES public.customer_wallet_transactions(id),
  wallet_debit_transaction_id uuid REFERENCES public.customer_wallet_transactions(id),
  order_payment_transaction_id uuid REFERENCES public.transactions(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_wallet_funding_intent_payments_provider_check
    CHECK (provider = 'paystack'),
  CONSTRAINT order_wallet_funding_intent_payments_amount_check
    CHECK (amount > 0 AND gateway_fee >= 0),
  CONSTRAINT order_wallet_funding_intent_payments_currency_check
    CHECK (currency = upper(currency))
);

CREATE TABLE IF NOT EXISTS public.order_wallet_funding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  intent_id uuid REFERENCES public.order_wallet_funding_intents(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  gateway_reference text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_wallet_funding_events_event_type_check
    CHECK (event_type = ANY (ARRAY[
      'wallet_funding_ambiguous_review_created'::text,
      'wallet_funding_conflict'::text,
      'wallet_funding_idempotent_hit'::text,
      'wallet_funding_not_processable'::text,
      'wallet_funding_order_payment_created'::text,
      'wallet_funding_review_created'::text,
      'wallet_funding_underfunded'::text
    ]))
);

CREATE UNIQUE INDEX IF NOT EXISTS order_wallet_funding_intents_order_active_unique_idx
  ON public.order_wallet_funding_intents (order_id)
  WHERE status <> ALL (ARRAY['expired'::text, 'cancelled'::text, 'failed'::text]);

CREATE UNIQUE INDEX IF NOT EXISTS order_wallet_funding_intents_idempotency_key_unique_idx
  ON public.order_wallet_funding_intents (idempotency_key);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_merchant_id_idx
  ON public.order_wallet_funding_intents (merchant_id);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_customer_id_idx
  ON public.order_wallet_funding_intents (customer_id);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_order_id_idx
  ON public.order_wallet_funding_intents (order_id);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_wallet_payment_account_id_idx
  ON public.order_wallet_funding_intents (wallet_payment_account_id);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_wallet_status_expires_idx
  ON public.order_wallet_funding_intents (wallet_payment_account_id, status, expires_at);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_merchant_customer_status_expires_idx
  ON public.order_wallet_funding_intents (merchant_id, customer_id, status, expires_at);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intents_last_transaction_id_idx
  ON public.order_wallet_funding_intents (last_transaction_id)
  WHERE last_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_reference_unique_idx
  ON public.order_wallet_funding_intent_payments (provider, gateway_reference);

CREATE UNIQUE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_transaction_unique_idx
  ON public.order_wallet_funding_intent_payments (transaction_id);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_intent_idx
  ON public.order_wallet_funding_intent_payments (intent_id, paid_at);

CREATE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_wallet_credit_idx
  ON public.order_wallet_funding_intent_payments (wallet_credit_transaction_id)
  WHERE wallet_credit_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_wallet_debit_idx
  ON public.order_wallet_funding_intent_payments (wallet_debit_transaction_id)
  WHERE wallet_debit_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_wallet_funding_intent_payments_order_payment_idx
  ON public.order_wallet_funding_intent_payments (order_payment_transaction_id)
  WHERE order_payment_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS order_wallet_funding_events_intent_created_idx
  ON public.order_wallet_funding_events (intent_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_wallet_funding_events_type_created_idx
  ON public.order_wallet_funding_events (event_type, created_at DESC);

DROP TRIGGER IF EXISTS order_wallet_funding_intents_updated_at
  ON public.order_wallet_funding_intents;
CREATE TRIGGER order_wallet_funding_intents_updated_at
  BEFORE UPDATE ON public.order_wallet_funding_intents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS order_wallet_funding_intent_payments_updated_at
  ON public.order_wallet_funding_intent_payments;
CREATE TRIGGER order_wallet_funding_intent_payments_updated_at
  BEFORE UPDATE ON public.order_wallet_funding_intent_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.order_wallet_funding_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_wallet_funding_intent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_wallet_funding_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.order_wallet_funding_intents FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_wallet_funding_intent_payments FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.order_wallet_funding_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.order_wallet_funding_intents TO authenticated;
GRANT SELECT ON TABLE public.order_wallet_funding_intent_payments TO authenticated;
GRANT ALL ON TABLE public.order_wallet_funding_intents TO service_role;
GRANT ALL ON TABLE public.order_wallet_funding_intent_payments TO service_role;
GRANT ALL ON TABLE public.order_wallet_funding_events TO service_role;

DROP POLICY IF EXISTS order_wallet_funding_intents_customer_select
  ON public.order_wallet_funding_intents;
CREATE POLICY order_wallet_funding_intents_customer_select
  ON public.order_wallet_funding_intents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = order_wallet_funding_intents.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = order_wallet_funding_intents.merchant_id
    )
  );

DROP POLICY IF EXISTS order_wallet_funding_intent_payments_customer_select
  ON public.order_wallet_funding_intent_payments;
CREATE POLICY order_wallet_funding_intent_payments_customer_select
  ON public.order_wallet_funding_intent_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.order_wallet_funding_intents i
      JOIN public.customers c
        ON c.id = i.customer_id
       AND c.merchant_id = i.merchant_id
      WHERE i.id = order_wallet_funding_intent_payments.intent_id
        AND c.user_id = auth.uid()
    )
  );

ALTER TABLE public.reconciliation_review
  DROP CONSTRAINT IF EXISTS reconciliation_review_issue_type_check;

ALTER TABLE public.reconciliation_review
  ADD CONSTRAINT reconciliation_review_issue_type_check CHECK (issue_type IN (
    'payment_match_ambiguous',
    'payment_match_zero_candidates',
    'manage_stock_cancellation_held',
    'tax_basis_unclassified',
    'tax_basis_inconsistent_total',
    'wallet_dva_order_alias_conflict',
    'customer_savings_auto_debit_allocation_failed',
    'wallet_order_funding_ambiguous',
    'wallet_order_funding_conflict',
    'wallet_order_funding_finalize_failed'
  ));

DROP FUNCTION IF EXISTS public.get_storefront_payment_settings(uuid);

CREATE FUNCTION public.get_storefront_payment_settings(
  p_merchant_id uuid
) RETURNS TABLE(
  paystack_enabled boolean,
  korapay_enabled boolean,
  juicyway_enabled boolean,
  credpal_enabled boolean,
  credit_direct_enabled boolean,
  klump_enabled boolean,
  pay_on_delivery_enabled boolean,
  vat_registration_status text,
  vat_rate numeric,
  klump_min_amount numeric,
  klump_max_amount numeric,
  wallet_paystack_dva_enabled boolean,
  wallet_order_auto_debit_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT
    COALESCE(s.paystack_enabled, true) AS paystack_enabled,
    COALESCE(s.korapay_enabled, true) AS korapay_enabled,
    COALESCE(s.juicyway_enabled, false) AS juicyway_enabled,
    COALESCE(s.credpal_enabled, false) AS credpal_enabled,
    COALESCE(s.credit_direct_enabled, false) AS credit_direct_enabled,
    COALESCE(s.klump_enabled, false) AS klump_enabled,
    COALESCE(s.pay_on_delivery_enabled, false) AS pay_on_delivery_enabled,
    COALESCE(m.vat_registration_status, 'not_registered') AS vat_registration_status,
    COALESCE(m.vat_rate, 7.5) AS vat_rate,
    COALESCE(s.klump_min_amount, 10000) AS klump_min_amount,
    COALESCE(s.klump_max_amount, 500000) AS klump_max_amount,
    COALESCE(s.wallet_paystack_dva_enabled, false) AS wallet_paystack_dva_enabled,
    COALESCE(s.wallet_order_auto_debit_enabled, false) AS wallet_order_auto_debit_enabled
  FROM public.merchants m
  LEFT JOIN public.merchant_feature_settings s ON s.merchant_id = m.id
  WHERE m.id = p_merchant_id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_payment_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_payment_settings(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.expire_order_wallet_funding_intents(
  p_customer_id uuid DEFAULT NULL,
  p_merchant_id uuid DEFAULT NULL,
  p_wallet_payment_account_id uuid DEFAULT NULL,
  p_now timestamptz DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_effective_customer_id uuid := p_customer_id;
  v_effective_merchant_id uuid := p_merchant_id;
BEGIN
  IF v_role <> ALL (ARRAY['authenticated'::text, 'service_role'::text]) THEN
    RAISE EXCEPTION 'forbidden: expire_order_wallet_funding_intents requires authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  -- DEFAULT now() is used only when the argument is omitted; explicit NULL
  -- would make expiry comparisons ambiguous, so reject it clearly.
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'p_now cannot be NULL; omit to use default now()'
      USING ERRCODE = '22023';
  END IF;

  IF p_wallet_payment_account_id IS NOT NULL THEN
    SELECT customer_id, merchant_id
    INTO v_effective_customer_id, v_effective_merchant_id
    FROM public.customer_wallet_payment_accounts
    WHERE id = p_wallet_payment_account_id
      AND (p_customer_id IS NULL OR customer_id = p_customer_id)
      AND (p_merchant_id IS NULL OR merchant_id = p_merchant_id);

    IF v_effective_customer_id IS NULL OR v_effective_merchant_id IS NULL THEN
      RAISE EXCEPTION 'wallet_payment_account_not_found'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_role = 'authenticated' THEN
    IF v_effective_customer_id IS NULL OR v_effective_merchant_id IS NULL THEN
      RAISE EXCEPTION 'customer_scope_required'
        USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = v_effective_customer_id
        AND c.merchant_id = v_effective_merchant_id
        AND c.user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'customer_scope_forbidden'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.order_wallet_funding_intents i
  SET
    status = 'expired',
    updated_at = p_now
  WHERE i.status = ANY (ARRAY['pending'::text, 'underfunded'::text])
    AND i.expires_at < p_now
    AND (v_effective_customer_id IS NULL OR i.customer_id = v_effective_customer_id)
    AND (v_effective_merchant_id IS NULL OR i.merchant_id = v_effective_merchant_id)
    AND (p_wallet_payment_account_id IS NULL OR i.wallet_payment_account_id = p_wallet_payment_account_id);
END;
$$;

REVOKE ALL ON FUNCTION public.expire_order_wallet_funding_intents(uuid,uuid,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_order_wallet_funding_intents(uuid,uuid,uuid,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_order_wallet_funding_intent_for_customer(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_order_id uuid,
  p_wallet_payment_account_id uuid,
  p_now timestamptz DEFAULT now()
) RETURNS TABLE(
  id uuid,
  merchant_id uuid,
  customer_id uuid,
  order_id uuid,
  wallet_payment_account_id uuid,
  provider text,
  expected_amount numeric,
  target_order_amount numeric,
  wallet_balance_snapshot numeric,
  funded_amount numeric,
  debited_amount numeric,
  excess_amount numeric,
  currency text,
  status text,
  idempotency_key text,
  last_gateway_reference text,
  last_transaction_id uuid,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_order public.orders%ROWTYPE;
  v_existing public.order_wallet_funding_intents%ROWTYPE;
  v_wallet_balance numeric := 0;
  v_savings_amount numeric := 0;
  v_target_order_amount numeric;
  v_expected_amount numeric;
BEGIN
  IF v_role <> ALL (ARRAY['authenticated'::text, 'service_role'::text]) THEN
    RAISE EXCEPTION 'forbidden: create_order_wallet_funding_intent_for_customer requires authenticated caller'
      USING ERRCODE = '42501';
  END IF;

  IF p_customer_id IS NULL
    OR p_merchant_id IS NULL
    OR p_order_id IS NULL
    OR p_wallet_payment_account_id IS NULL
    OR p_now IS NULL
  THEN
    RAISE EXCEPTION 'create_order_wallet_funding_intent_for_customer missing required input'
      USING ERRCODE = '22023';
  END IF;

  IF v_role = 'authenticated'
    AND NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = p_customer_id
        AND c.merchant_id = p_merchant_id
        AND c.user_id = auth.uid()
    )
  THEN
    RAISE EXCEPTION 'customer_scope_forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.merchant_feature_settings s
    WHERE s.merchant_id = p_merchant_id
      AND COALESCE(s.paystack_enabled, true)
      AND COALESCE(s.wallet_paystack_dva_enabled, false)
      AND COALESCE(s.wallet_order_auto_debit_enabled, false)
  ) THEN
    RAISE EXCEPTION 'wallet_order_auto_debit_disabled'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders o
  WHERE o.id = p_order_id
    AND o.customer_id = p_customer_id
    AND o.merchant_id = p_merchant_id
  FOR UPDATE;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'order_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.payment_status <> ALL (ARRAY['pending'::text, 'unpaid'::text]) THEN
    RAISE EXCEPTION 'order_not_payable'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customer_wallet_payment_accounts a
    WHERE a.id = p_wallet_payment_account_id
      AND a.customer_id = p_customer_id
      AND a.merchant_id = p_merchant_id
      AND a.provider = 'paystack'
      AND a.status = 'active'
  ) THEN
    RAISE EXCEPTION 'wallet_payment_account_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM public.expire_order_wallet_funding_intents(
    p_customer_id,
    p_merchant_id,
    p_wallet_payment_account_id,
    p_now
  );

  SELECT *
  INTO v_existing
  FROM public.order_wallet_funding_intents i
  WHERE i.order_id = p_order_id
    AND i.customer_id = p_customer_id
    AND i.merchant_id = p_merchant_id
    AND i.status <> ALL (ARRAY['expired'::text, 'cancelled'::text, 'failed'::text])
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      i.id,
      i.merchant_id,
      i.customer_id,
      i.order_id,
      i.wallet_payment_account_id,
      i.provider,
      i.expected_amount,
      i.target_order_amount,
      i.wallet_balance_snapshot,
      i.funded_amount,
      i.debited_amount,
      i.excess_amount,
      i.currency,
      i.status,
      i.idempotency_key,
      i.last_gateway_reference,
      i.last_transaction_id,
      i.expires_at,
      i.created_at
    FROM public.order_wallet_funding_intents i
    WHERE i.id = v_existing.id;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.customer_wallet_transactions t
    WHERE t.customer_id = p_customer_id
      AND t.merchant_id = p_merchant_id
      AND t.source_type = 'order_redemption'
      AND t.source_id = p_order_id
      AND t.type = 'redemption'
  ) THEN
    RAISE EXCEPTION 'order_already_has_wallet_redemption'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(sum(r.amount), 0)
  INTO v_savings_amount
  FROM public.customer_savings_redemptions r
  WHERE r.order_id = p_order_id;

  v_target_order_amount := round(GREATEST(v_order.total - v_savings_amount, 0), 2);

  IF v_target_order_amount <= 0 THEN
    RAISE EXCEPTION 'order_not_payable'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(w.available_balance, 0)
  INTO v_wallet_balance
  FROM public.customer_wallets w
  WHERE w.customer_id = p_customer_id
    AND w.merchant_id = p_merchant_id;

  v_wallet_balance := COALESCE(v_wallet_balance, 0);
  v_expected_amount := round(GREATEST(v_target_order_amount - v_wallet_balance, 0), 2);

  IF v_expected_amount <= 0 THEN
    RAISE EXCEPTION 'wallet_balance_covers_order'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_wallet_funding_intents (
    merchant_id,
    customer_id,
    order_id,
    wallet_payment_account_id,
    expected_amount,
    target_order_amount,
    wallet_balance_snapshot,
    currency,
    status,
    idempotency_key,
    expires_at
  )
  VALUES (
    p_merchant_id,
    p_customer_id,
    p_order_id,
    p_wallet_payment_account_id,
    v_expected_amount,
    v_target_order_amount,
    v_wallet_balance,
    upper(COALESCE(v_order.currency, 'NGN')),
    'pending',
    'order-wallet-funding:'
      || p_order_id::text
      || ':'
      || p_merchant_id::text
      || ':'
      || p_customer_id::text
      || ':'
      || to_char(p_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    p_now + interval '30 minutes'
  )
  RETURNING * INTO v_existing;

  RETURN QUERY
  SELECT
    i.id,
    i.merchant_id,
    i.customer_id,
    i.order_id,
    i.wallet_payment_account_id,
    i.provider,
    i.expected_amount,
    i.target_order_amount,
    i.wallet_balance_snapshot,
    i.funded_amount,
    i.debited_amount,
    i.excess_amount,
    i.currency,
    i.status,
    i.idempotency_key,
    i.last_gateway_reference,
    i.last_transaction_id,
    i.expires_at,
    i.created_at
  FROM public.order_wallet_funding_intents i
  WHERE i.id = v_existing.id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_order_wallet_funding_intent_for_customer(uuid,uuid,uuid,uuid,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_order_wallet_funding_intent_for_customer(uuid,uuid,uuid,uuid,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_wallet_funding_intents_review_required(
  p_intent_ids uuid[],
  p_gateway_reference text,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: mark_wallet_funding_intents_review_required requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_intent_ids IS NULL OR array_length(p_intent_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.order_wallet_funding_intents i
  SET
    status = 'review_required',
    last_gateway_reference = p_gateway_reference,
    metadata = jsonb_set(
      COALESCE(i.metadata, '{}'::jsonb),
      '{review_reason}',
      to_jsonb(COALESCE(p_reason, 'review_required')),
      true
    ),
    updated_at = now()
  WHERE i.id = ANY (p_intent_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_wallet_funding_intents_review_required(uuid[],text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_wallet_funding_intents_review_required(uuid[],text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.record_wallet_order_funding_event(
  p_event_type text,
  p_intent_id uuid DEFAULT NULL,
  p_order_id uuid DEFAULT NULL,
  p_transaction_id uuid DEFAULT NULL,
  p_gateway_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_payload jsonb;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: record_wallet_order_funding_event requires service_role'
      USING ERRCODE = '42501';
  END IF;

  v_payload := jsonb_build_object(
    'event_type', p_event_type,
    'intent_id', p_intent_id,
    'order_id', p_order_id,
    'transaction_id', p_transaction_id,
    'gateway_reference', p_gateway_reference,
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  );

  INSERT INTO public.order_wallet_funding_events (
    event_type,
    intent_id,
    order_id,
    transaction_id,
    gateway_reference,
    metadata
  )
  VALUES (
    p_event_type,
    p_intent_id,
    p_order_id,
    p_transaction_id,
    p_gateway_reference,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  RAISE LOG 'wallet_order_funding_event %', v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.record_wallet_order_funding_event(text,uuid,uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_wallet_order_funding_event(text,uuid,uuid,uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.file_wallet_order_funding_ambiguous_review(
  p_gateway_reference text,
  p_intent_ids uuid[],
  p_reason text DEFAULT 'Wallet DVA transfer matched multiple active order funding intents; credited as plain wallet top-up for manual reconciliation.'
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: file_wallet_order_funding_ambiguous_review requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_gateway_reference IS NULL OR btrim(p_gateway_reference) = '' THEN
    RAISE EXCEPTION 'file_wallet_order_funding_ambiguous_review gateway reference is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_intent_ids IS NULL OR array_length(p_intent_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'file_wallet_order_funding_ambiguous_review intent ids are required'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.reconciliation_review (
    issue_type,
    paystack_ref,
    reason,
    candidates,
    metadata
  )
  VALUES (
    'wallet_order_funding_ambiguous',
    p_gateway_reference,
    p_reason,
    (
      SELECT jsonb_agg(jsonb_build_object('id', intent_id, 'type', 'order_wallet_funding_intent'))
      FROM unnest(p_intent_ids) AS intent_id
    ),
    jsonb_build_object('intent_ids', p_intent_ids)
  )
  ON CONFLICT (issue_type, paystack_ref)
    WHERE resolved_at IS NULL AND paystack_ref IS NOT NULL
  DO UPDATE SET
    reason = EXCLUDED.reason,
    candidates = EXCLUDED.candidates,
    metadata = EXCLUDED.metadata;

  PERFORM public.record_wallet_order_funding_event(
    'wallet_funding_ambiguous_review_created',
    NULL,
    NULL,
    NULL,
    p_gateway_reference,
    jsonb_build_object('intent_ids', p_intent_ids, 'reason', p_reason)
  );

  PERFORM public.mark_wallet_funding_intents_review_required(
    p_intent_ids,
    p_gateway_reference,
    'ambiguous wallet funding match'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.file_wallet_order_funding_ambiguous_review(text,uuid[],text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.file_wallet_order_funding_ambiguous_review(text,uuid[],text) TO service_role;

CREATE OR REPLACE FUNCTION public.finalize_wallet_funded_order(
  p_intent_id uuid,
  p_gateway_reference text,
  p_transaction_id uuid,
  p_received_amount numeric,
  p_gateway_fee numeric DEFAULT 0,
  p_paid_at timestamptz DEFAULT now(),
  p_currency text DEFAULT 'NGN'
) RETURNS TABLE(
  credited_amount numeric,
  funded_amount numeric,
  debited_amount numeric,
  excess_amount numeric,
  order_paid boolean,
  order_id uuid,
  order_payment_transaction_id uuid,
  wallet_credit_transaction_id uuid,
  wallet_debit_transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_intent public.order_wallet_funding_intents%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_funding_txn public.transactions%ROWTYPE;
  v_existing_payment public.order_wallet_funding_intent_payments%ROWTYPE;
  v_payment_id uuid;
  v_credit_result record;
  v_wallet_id uuid;
  v_wallet_balance numeric;
  v_debit_balance_after numeric;
  v_existing_debit public.customer_wallet_transactions%ROWTYPE;
  v_wallet_debit_transaction_id uuid;
  v_order_payment_transaction_id uuid;
  v_confirmed_savings_amount numeric := 0;
  v_order_amount_paid numeric;
  v_payment_method text;
  v_new_funded_amount numeric;
  v_excess_amount numeric;
  v_currency text := upper(COALESCE(p_currency, 'NGN'));
  v_amount_tolerance_kobo CONSTANT bigint := 0;
  v_amount_alert_threshold_kobo CONSTANT bigint := 100000;
  v_amount_difference_kobo bigint := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: finalize_wallet_funded_order requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_intent_id IS NULL THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order p_intent_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_transaction_id IS NULL THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order p_transaction_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_gateway_reference IS NULL OR btrim(p_gateway_reference) = '' THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order p_gateway_reference is required'
      USING ERRCODE = '22023';
  END IF;

  IF p_received_amount IS NULL OR p_received_amount <= 0 THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order p_received_amount must be greater than zero'
      USING ERRCODE = '22023';
  END IF;

  IF p_gateway_fee IS NULL OR p_gateway_fee < 0 THEN
    RAISE EXCEPTION 'finalize_wallet_funded_order p_gateway_fee must be non-negative'
      USING ERRCODE = '22023';
  END IF;

  IF v_currency <> 'NGN' THEN
    RAISE EXCEPTION 'unsupported_wallet_order_funding_currency: %', v_currency
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'order_wallet_funding_intent:' || p_intent_id::text,
      0
    )
  );

  SELECT *
  INTO v_intent
  FROM public.order_wallet_funding_intents
  WHERE id = p_intent_id
  FOR UPDATE;

  IF v_intent.id IS NULL THEN
    RAISE EXCEPTION 'wallet_order_funding_intent_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_existing_payment
  FROM public.order_wallet_funding_intent_payments
  WHERE provider = 'paystack'
    AND (
      gateway_reference = p_gateway_reference
      OR transaction_id = p_transaction_id
    )
  FOR UPDATE;

  IF v_existing_payment.id IS NOT NULL
    AND v_existing_payment.intent_id = v_intent.id
  THEN
    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_idempotent_hit',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'payment_id', v_existing_payment.id,
        'order_payment_transaction_id', v_existing_payment.order_payment_transaction_id,
        'wallet_credit_transaction_id', v_existing_payment.wallet_credit_transaction_id,
        'wallet_debit_transaction_id', v_existing_payment.wallet_debit_transaction_id
      )
    );

    RETURN QUERY
    SELECT
      v_existing_payment.amount,
      v_intent.funded_amount,
      v_intent.debited_amount,
      v_intent.excess_amount,
      v_intent.status = 'completed',
      v_intent.order_id,
      v_existing_payment.order_payment_transaction_id,
      v_existing_payment.wallet_credit_transaction_id,
      v_existing_payment.wallet_debit_transaction_id;
    RETURN;
  END IF;

  IF v_existing_payment.id IS NOT NULL
    AND v_existing_payment.intent_id <> v_intent.id
  THEN
    UPDATE public.order_wallet_funding_intents
    SET
      status = 'review_required',
      metadata = metadata || jsonb_build_object(
        'review_reason', 'gateway_reference_already_used_by_different_intent',
        'conflicting_intent_id', v_existing_payment.intent_id,
        'gateway_reference', p_gateway_reference,
        'transaction_id', p_transaction_id
      ),
      updated_at = now()
    WHERE id = v_intent.id;

    INSERT INTO public.reconciliation_review (
      issue_type,
      txn_id,
      paystack_ref,
      order_id,
      reason,
      candidates,
      metadata
    )
    VALUES (
      'wallet_order_funding_conflict',
      p_transaction_id,
      p_gateway_reference,
      v_intent.order_id,
      'Gateway reference or transaction id already belongs to a different wallet-funded order intent.',
      jsonb_build_array(v_intent.id, v_existing_payment.intent_id),
      jsonb_build_object('intent_id', v_intent.id)
    );

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_conflict',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'issue_type', 'wallet_order_funding_conflict',
        'conflicting_intent_id', v_existing_payment.intent_id,
        'reason', 'gateway_reference_already_used_by_different_intent'
      )
    );

    RETURN QUERY
    SELECT
      0::numeric,
      v_intent.funded_amount,
      v_intent.debited_amount,
      v_intent.excess_amount,
      false,
      v_intent.order_id,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid;
    RETURN;
  END IF;

  IF v_intent.status = ANY (ARRAY['cancelled'::text, 'expired'::text, 'completed'::text])
    OR v_intent.expires_at <= COALESCE(p_paid_at, now())
  THEN
    INSERT INTO public.reconciliation_review (
      issue_type,
      txn_id,
      paystack_ref,
      order_id,
      reason,
      candidates,
      metadata
    )
    VALUES (
      'wallet_order_funding_finalize_failed',
      p_transaction_id,
      p_gateway_reference,
      v_intent.order_id,
      'Wallet-funded order intent is not processable: ' || v_intent.status,
      jsonb_build_array(v_intent.id),
      jsonb_build_object(
        'intent_id', v_intent.id,
        'intent_status', v_intent.status,
        'expires_at', v_intent.expires_at,
        'paid_at', p_paid_at
      )
    );

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_not_processable',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'issue_type', 'wallet_order_funding_finalize_failed',
        'intent_status', v_intent.status,
        'expires_at', v_intent.expires_at,
        'paid_at', p_paid_at
      )
    );

    RAISE EXCEPTION 'wallet_order_funding_intent_not_processable: %, expires_at=%', v_intent.status, v_intent.expires_at
      USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO v_funding_txn
  FROM public.transactions
  WHERE id = p_transaction_id
  FOR UPDATE;

  IF v_funding_txn.id IS NULL THEN
    RAISE EXCEPTION 'wallet_order_funding_transaction_not_found'
      USING ERRCODE = 'P0001';
  END IF;

  v_amount_difference_kobo := abs(
    round(v_funding_txn.amount * 100)::bigint -
      round(p_received_amount * 100)::bigint
  );

  IF v_funding_txn.gateway IS DISTINCT FROM 'paystack'
    OR v_funding_txn.transaction_type IS DISTINCT FROM 'payment'
    OR v_funding_txn.status IS DISTINCT FROM 'completed'
    OR v_funding_txn.merchant_id IS DISTINCT FROM v_intent.merchant_id
    OR v_funding_txn.order_id IS NOT NULL
    -- Wallet-funded order DVA currently supports NGN only, so the amount
    -- comparison is exact in integer kobo to avoid decimal drift without
    -- accepting even a one-kobo reconciliation mismatch.
    -- If other currencies are added, update this tolerance with the
    -- v_funding_txn.currency check below because minor unit sizes can differ.
    OR v_amount_difference_kobo > v_amount_tolerance_kobo
    OR upper(v_funding_txn.currency) IS DISTINCT FROM v_currency
    OR v_funding_txn.gateway_reference IS DISTINCT FROM p_gateway_reference
    OR COALESCE(v_funding_txn.metadata->>'customer_id', '') <> v_intent.customer_id::text
    OR COALESCE(v_funding_txn.metadata->>'wallet_payment_account_id', '') <> v_intent.wallet_payment_account_id::text
  THEN
    UPDATE public.order_wallet_funding_intents
    SET
      status = 'review_required',
      metadata = metadata || jsonb_build_object(
        'review_reason', 'funding_transaction_validation_failed',
        'gateway_reference', p_gateway_reference,
        'transaction_id', p_transaction_id,
        'amount_difference', v_amount_difference_kobo::numeric / 100,
        'amount_difference_kobo', v_amount_difference_kobo,
        'amount_tolerance', v_amount_tolerance_kobo::numeric / 100,
        'amount_tolerance_kobo', v_amount_tolerance_kobo,
        'amount_alert_threshold', v_amount_alert_threshold_kobo::numeric / 100,
        'amount_alert_threshold_kobo', v_amount_alert_threshold_kobo,
        'amount_alert', v_amount_difference_kobo > v_amount_alert_threshold_kobo
      ),
      updated_at = now()
    WHERE id = v_intent.id;

    INSERT INTO public.reconciliation_review (
      issue_type,
      txn_id,
      paystack_ref,
      order_id,
      reason,
      candidates,
      metadata
    )
    VALUES (
      'wallet_order_funding_conflict',
      p_transaction_id,
      p_gateway_reference,
      v_intent.order_id,
      'Funding transaction did not match the wallet-funded order intent.',
      jsonb_build_array(v_intent.id),
      jsonb_build_object(
        'intent_id', v_intent.id,
        'amount_difference', v_amount_difference_kobo::numeric / 100,
        'amount_difference_kobo', v_amount_difference_kobo,
        'amount_tolerance', v_amount_tolerance_kobo::numeric / 100,
        'amount_tolerance_kobo', v_amount_tolerance_kobo,
        'amount_alert_threshold', v_amount_alert_threshold_kobo::numeric / 100,
        'amount_alert_threshold_kobo', v_amount_alert_threshold_kobo,
        'amount_alert', v_amount_difference_kobo > v_amount_alert_threshold_kobo
      )
    );

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_review_created',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'issue_type', 'wallet_order_funding_conflict',
        'reason', 'funding_transaction_validation_failed',
        'amount_difference', v_amount_difference_kobo::numeric / 100,
        'amount_difference_kobo', v_amount_difference_kobo,
        'amount_tolerance', v_amount_tolerance_kobo::numeric / 100,
        'amount_tolerance_kobo', v_amount_tolerance_kobo,
        'amount_alert_threshold', v_amount_alert_threshold_kobo::numeric / 100,
        'amount_alert_threshold_kobo', v_amount_alert_threshold_kobo,
        'amount_alert', v_amount_difference_kobo > v_amount_alert_threshold_kobo
      )
    );

    RETURN QUERY
    SELECT
      0::numeric,
      v_intent.funded_amount,
      v_intent.debited_amount,
      v_intent.excess_amount,
      false,
      v_intent.order_id,
      NULL::uuid,
      NULL::uuid,
      NULL::uuid;
    RETURN;
  END IF;

  SELECT *
  INTO v_order
  FROM public.orders
  WHERE id = v_intent.order_id
  FOR UPDATE;

  IF v_order.id IS NULL
    OR v_order.customer_id IS DISTINCT FROM v_intent.customer_id
    OR v_order.merchant_id IS DISTINCT FROM v_intent.merchant_id
  THEN
    RAISE EXCEPTION 'wallet_order_funding_order_not_found_or_mismatched'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.order_wallet_funding_intent_payments (
    intent_id,
    provider,
    gateway_reference,
    transaction_id,
    amount,
    gateway_fee,
    currency,
    paid_at,
    metadata
  )
  VALUES (
    v_intent.id,
    'paystack',
    p_gateway_reference,
    p_transaction_id,
    p_received_amount,
    p_gateway_fee,
    v_currency,
    COALESCE(p_paid_at, now()),
    jsonb_build_object(
      'funding_transaction_id', p_transaction_id,
      'wallet_payment_account_id', v_intent.wallet_payment_account_id
    )
  )
  RETURNING id INTO v_payment_id;

  SELECT *
  INTO v_existing_payment
  FROM public.order_wallet_funding_intent_payments
  WHERE id = v_payment_id
  FOR UPDATE;

  SELECT *
  INTO v_credit_result
  FROM public.credit_customer_wallet(
    v_intent.customer_id,
    v_intent.merchant_id,
    p_received_amount,
    'wallet_topup',
    p_transaction_id,
    'Wallet top-up for order ' || v_order.order_number
  );

  UPDATE public.order_wallet_funding_intent_payments
  SET wallet_credit_transaction_id = v_credit_result.transaction_id
  WHERE id = v_existing_payment.id;

  v_existing_payment.wallet_credit_transaction_id := v_credit_result.transaction_id;

  SELECT COALESCE(sum(amount), 0)
  INTO v_new_funded_amount
  FROM public.order_wallet_funding_intent_payments
  WHERE intent_id = v_intent.id;

  IF v_order.payment_status = ANY (ARRAY['cancelled'::text, 'expired'::text, 'paid'::text]) THEN
    v_excess_amount := GREATEST(v_new_funded_amount - v_intent.expected_amount, 0);

    UPDATE public.order_wallet_funding_intents
    SET
      funded_amount = v_new_funded_amount,
      excess_amount = v_excess_amount,
      status = 'review_required',
      last_gateway_reference = p_gateway_reference,
      last_transaction_id = p_transaction_id,
      metadata = metadata || jsonb_build_object(
        'review_reason', 'order_not_payable',
        'order_payment_status', v_order.payment_status
      ),
      updated_at = now()
    WHERE id = v_intent.id;

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_review_created',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'reason', 'order_not_payable',
        'order_payment_status', v_order.payment_status,
        'funded_amount', v_new_funded_amount,
        'excess_amount', v_excess_amount
      )
    );

    RETURN QUERY
    SELECT
      p_received_amount,
      v_new_funded_amount,
      0::numeric,
      v_excess_amount,
      false,
      v_intent.order_id,
      NULL::uuid,
      v_existing_payment.wallet_credit_transaction_id,
      NULL::uuid;
    RETURN;
  END IF;

  IF v_new_funded_amount < v_intent.expected_amount THEN
    UPDATE public.order_wallet_funding_intents
    SET
      funded_amount = v_new_funded_amount,
      status = 'underfunded',
      last_gateway_reference = p_gateway_reference,
      last_transaction_id = p_transaction_id,
      updated_at = now()
    WHERE id = v_intent.id;

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_underfunded',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'reason', 'funded_amount_below_expected_amount',
        'funded_amount', v_new_funded_amount,
        'expected_amount', v_intent.expected_amount
      )
    );

    RETURN QUERY
    SELECT
      p_received_amount,
      v_new_funded_amount,
      0::numeric,
      0::numeric,
      false,
      v_intent.order_id,
      NULL::uuid,
      v_existing_payment.wallet_credit_transaction_id,
      NULL::uuid;
    RETURN;
  END IF;

  SELECT id, available_balance
  INTO v_wallet_id, v_wallet_balance
  FROM public.customer_wallets
  WHERE customer_id = v_intent.customer_id
    AND merchant_id = v_intent.merchant_id
  FOR UPDATE;

  IF v_wallet_id IS NULL OR COALESCE(v_wallet_balance, 0) < v_intent.target_order_amount THEN
    UPDATE public.order_wallet_funding_intents
    SET
      funded_amount = v_new_funded_amount,
      status = 'underfunded',
      last_gateway_reference = p_gateway_reference,
      last_transaction_id = p_transaction_id,
      updated_at = now()
    WHERE id = v_intent.id;

    PERFORM public.record_wallet_order_funding_event(
      'wallet_funding_underfunded',
      v_intent.id,
      v_intent.order_id,
      p_transaction_id,
      p_gateway_reference,
      jsonb_build_object(
        'reason', 'wallet_balance_below_target_order_amount',
        'funded_amount', v_new_funded_amount,
        'wallet_balance', COALESCE(v_wallet_balance, 0),
        'target_order_amount', v_intent.target_order_amount
      )
    );

    RETURN QUERY
    SELECT
      p_received_amount,
      v_new_funded_amount,
      0::numeric,
      GREATEST(v_new_funded_amount - v_intent.expected_amount, 0),
      false,
      v_intent.order_id,
      NULL::uuid,
      v_existing_payment.wallet_credit_transaction_id,
      NULL::uuid;
    RETURN;
  END IF;

  SELECT *
  INTO v_existing_debit
  FROM public.customer_wallet_transactions
  WHERE source_type = 'order_redemption'
    AND source_id = v_intent.order_id
    AND customer_id = v_intent.customer_id
    AND merchant_id = v_intent.merchant_id
    AND type = 'redemption'
  FOR UPDATE;

  IF v_existing_debit.id IS NOT NULL THEN
    IF v_existing_debit.amount IS DISTINCT FROM v_intent.target_order_amount THEN
      UPDATE public.order_wallet_funding_intents
      SET
        funded_amount = v_new_funded_amount,
        status = 'review_required',
        metadata = metadata || jsonb_build_object(
          'review_reason', 'existing_wallet_redemption_amount_mismatch',
          'existing_wallet_debit_transaction_id', v_existing_debit.id,
          'existing_amount', v_existing_debit.amount
        ),
        updated_at = now()
      WHERE id = v_intent.id;

      INSERT INTO public.reconciliation_review (
        issue_type,
        txn_id,
        paystack_ref,
        order_id,
        reason,
        candidates,
        metadata
      )
      VALUES (
        'wallet_order_funding_conflict',
        p_transaction_id,
        p_gateway_reference,
        v_intent.order_id,
        'Existing wallet redemption for order has a different amount.',
        jsonb_build_array(v_intent.id),
        jsonb_build_object(
          'intent_id', v_intent.id,
          'existing_wallet_debit_transaction_id', v_existing_debit.id
        )
      );

      PERFORM public.record_wallet_order_funding_event(
        'wallet_funding_conflict',
        v_intent.id,
        v_intent.order_id,
        p_transaction_id,
        p_gateway_reference,
        jsonb_build_object(
          'issue_type', 'wallet_order_funding_conflict',
          'reason', 'existing_wallet_redemption_amount_mismatch',
          'existing_wallet_debit_transaction_id', v_existing_debit.id,
          'existing_amount', v_existing_debit.amount,
          'target_order_amount', v_intent.target_order_amount
        )
      );

      RETURN QUERY
      SELECT
        p_received_amount,
        v_new_funded_amount,
        0::numeric,
        GREATEST(v_new_funded_amount - v_intent.expected_amount, 0),
        false,
        v_intent.order_id,
        NULL::uuid,
        v_existing_payment.wallet_credit_transaction_id,
        NULL::uuid;
      RETURN;
    END IF;

    v_wallet_debit_transaction_id := v_existing_debit.id;
  ELSE
    v_debit_balance_after := v_wallet_balance - v_intent.target_order_amount;

    UPDATE public.customer_wallets
    SET
      available_balance = v_debit_balance_after,
      total_redeemed = COALESCE(total_redeemed, 0) + v_intent.target_order_amount,
      updated_at = now()
    WHERE id = v_wallet_id;

    INSERT INTO public.customer_wallet_transactions (
      wallet_id,
      customer_id,
      merchant_id,
      type,
      amount,
      balance_after,
      source_type,
      source_id,
      status,
      description,
      metadata
    )
    VALUES (
      v_wallet_id,
      v_intent.customer_id,
      v_intent.merchant_id,
      'redemption',
      v_intent.target_order_amount,
      v_debit_balance_after,
      'order_redemption',
      v_intent.order_id,
      'completed',
      'Order payment: ' || COALESCE(v_order.order_number, v_intent.order_id::text),
      jsonb_build_object(
        'wallet_order_funding_intent_id', v_intent.id,
        'gateway_reference', p_gateway_reference,
        'funding_transaction_id', p_transaction_id
      )
    )
    RETURNING id INTO v_wallet_debit_transaction_id;
  END IF;

  SELECT COALESCE(sum(r.amount), 0)
  INTO v_confirmed_savings_amount
  FROM public.customer_savings_redemptions r
  WHERE r.order_id = v_intent.order_id
    AND r.customer_id = v_intent.customer_id
    AND r.merchant_id = v_intent.merchant_id;

  v_payment_method := CASE
    WHEN v_confirmed_savings_amount > 0 THEN 'store_credit'
    ELSE 'wallet'
  END;
  v_order_amount_paid := LEAST(v_order.total, v_confirmed_savings_amount + v_intent.target_order_amount);

  INSERT INTO public.transactions (
    merchant_id,
    order_id,
    transaction_type,
    amount,
    currency,
    status,
    gateway,
    gateway_reference,
    platform_fee,
    merchant_amount,
    description,
    metadata
  )
  VALUES (
    v_intent.merchant_id,
    v_intent.order_id,
    'payment',
    v_intent.target_order_amount,
    v_currency,
    'completed',
    'wallet',
    'WALLET-DVA-ORDER-' || v_intent.order_id::text,
    0,
    v_intent.target_order_amount,
    'Wallet-funded payment for order ' || COALESCE(v_order.order_number, v_intent.order_id::text),
    jsonb_build_object(
      'wallet_order_funding_intent_id', v_intent.id,
      'wallet_debit_transaction_id', v_wallet_debit_transaction_id,
      'paystack_reference', p_gateway_reference,
      'paystack_transaction_id', p_transaction_id,
      'funded_amount', v_new_funded_amount,
      'expected_amount', v_intent.expected_amount
    )
  )
  ON CONFLICT (order_id, gateway_reference)
    WHERE gateway_reference IS NOT NULL
  DO NOTHING
  RETURNING id INTO v_order_payment_transaction_id;

  IF v_order_payment_transaction_id IS NULL THEN
    SELECT id
    INTO v_order_payment_transaction_id
    FROM public.transactions
    WHERE order_id = v_intent.order_id
      AND gateway_reference = 'WALLET-DVA-ORDER-' || v_intent.order_id::text
    LIMIT 1;
  END IF;

  UPDATE public.orders
  SET
    payment_status = 'paid',
    shipping_status = CASE
      WHEN shipping_status = 'pending' THEN 'processing'
      ELSE shipping_status
    END,
    payment_method = v_payment_method,
    amount_paid = v_order_amount_paid,
    wallet_amount_used = v_intent.target_order_amount,
    wallet_transaction_id = v_wallet_debit_transaction_id,
    updated_at = now()
  WHERE id = v_intent.order_id;

  v_excess_amount := GREATEST(v_new_funded_amount - v_intent.expected_amount, 0);

  UPDATE public.order_wallet_funding_intent_payments
  SET
    wallet_debit_transaction_id = v_wallet_debit_transaction_id,
    order_payment_transaction_id = v_order_payment_transaction_id,
    updated_at = now()
  WHERE id = v_existing_payment.id;

  UPDATE public.order_wallet_funding_intents
  SET
    funded_amount = v_new_funded_amount,
    debited_amount = v_intent.target_order_amount,
    excess_amount = v_excess_amount,
    status = 'completed',
    last_gateway_reference = p_gateway_reference,
    last_transaction_id = p_transaction_id,
    updated_at = now()
  WHERE id = v_intent.id;

  PERFORM public.record_wallet_order_funding_event(
    'wallet_funding_order_payment_created',
    v_intent.id,
    v_intent.order_id,
    p_transaction_id,
    p_gateway_reference,
    jsonb_build_object(
      'funded_amount', v_new_funded_amount,
      'debited_amount', v_intent.target_order_amount,
      'excess_amount', v_excess_amount,
      'order_payment_transaction_id', v_order_payment_transaction_id,
      'wallet_credit_transaction_id', v_existing_payment.wallet_credit_transaction_id,
      'wallet_debit_transaction_id', v_wallet_debit_transaction_id
    )
  );

  RETURN QUERY
  SELECT
    p_received_amount,
    v_new_funded_amount,
    v_intent.target_order_amount,
    v_excess_amount,
    true,
    v_intent.order_id,
    v_order_payment_transaction_id,
    v_existing_payment.wallet_credit_transaction_id,
    v_wallet_debit_transaction_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.finalize_wallet_funded_order(
  uuid, text, uuid, numeric, numeric, timestamptz, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_wallet_funded_order(
  uuid, text, uuid, numeric, numeric, timestamptz, text
) TO service_role;

COMMENT ON FUNCTION public.finalize_wallet_funded_order(
  uuid, text, uuid, numeric, numeric, timestamptz, text
) IS
  'Idempotently credits a Paystack wallet DVA funding transaction and exactly debits the customer wallet to pay the matching order when fully funded.';
