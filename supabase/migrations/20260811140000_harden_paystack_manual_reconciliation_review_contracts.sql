-- Keep the reconciliation migrations append-only while tightening the
-- effective RPC contracts and replacing the chat-order notes lookup with a
-- durable relationship.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS chat_order_id uuid;

UPDATE public.orders AS o
   SET chat_order_id = matches.chat_order_id
  FROM (
    SELECT t.order_id, min(co.id) AS chat_order_id
      FROM public.transactions AS t
      JOIN public.chat_orders AS co
        ON NULLIF(trim(co.payment_reference), '') =
           NULLIF(trim(t.gateway_reference), '')
      JOIN public.orders AS candidate ON candidate.id = t.order_id
     WHERE candidate.chat_order_id IS NULL
       AND candidate.source = 'chat'
     GROUP BY t.order_id
    HAVING count(DISTINCT co.id) = 1
  ) AS matches
 WHERE o.id = matches.order_id
   AND o.chat_order_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_catalog.pg_constraint
     WHERE conname = 'orders_chat_order_id_fkey'
       AND conrelid = 'public.orders'::pg_catalog.regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_chat_order_id_fkey
      FOREIGN KEY (chat_order_id) REFERENCES public.chat_orders(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orders_chat_order_id_key
  ON public.orders (chat_order_id)
  WHERE chat_order_id IS NOT NULL;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
       'public.convert_chat_order_to_paid_order_with_inventory(uuid,text,text,numeric,text)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.convert_chat_order_to_paid_order_with_inventory_v1(uuid,text,text,numeric,text)'
     ) IS NULL THEN
    ALTER FUNCTION public.convert_chat_order_to_paid_order_with_inventory(
      uuid, text, text, numeric, text
    ) RENAME TO convert_chat_order_to_paid_order_with_inventory_v1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.convert_chat_order_to_paid_order_with_inventory(
  p_chat_order_id uuid,
  p_gateway text,
  p_reference text,
  p_amount numeric,
  p_currency text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result jsonb;
  v_order_id uuid;
  v_order_number text;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF lower(trim(COALESCE(p_gateway, ''))) = 'paystack' THEN
    IF NULLIF(trim(COALESCE(p_reference, '')), '') IS NULL THEN
      RAISE EXCEPTION 'reference_required' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(trim(p_reference), 0)
    );

    SELECT o.id, o.order_number
      INTO v_order_id, v_order_number
      FROM public.chat_orders AS co
      JOIN public.orders AS o ON o.chat_order_id = co.id
      JOIN public.transactions AS t ON t.order_id = o.id
     WHERE co.id = p_chat_order_id
       AND co.status IN ('completed', 'processing')
       AND lower(trim(COALESCE(t.gateway, ''))) = 'paystack'
       AND t.gateway_reference = trim(p_reference)
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'order_number', v_order_number,
        'already_processed', true
      );
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.transactions AS t
       WHERE lower(trim(COALESCE(t.gateway, ''))) = 'paystack'
         AND t.gateway_reference = trim(p_reference)
    ) THEN
      RAISE EXCEPTION 'paystack_reference_already_recorded';
    END IF;
  END IF;

  v_result := public.convert_chat_order_to_paid_order_with_inventory_v1(
    p_chat_order_id,
    p_gateway,
    p_reference,
    p_amount,
    p_currency
  );

  v_order_id := NULLIF(v_result ->> 'order_id', '')::uuid;
  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
       SET chat_order_id = p_chat_order_id
     WHERE id = v_order_id
       AND source = 'chat'
       AND (chat_order_id IS NULL OR chat_order_id = p_chat_order_id);
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory_v1(
  uuid, text, text, numeric, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory_v1(
  uuid, text, text, numeric, text
) TO service_role;
REVOKE ALL ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory(
  uuid, text, text, numeric, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.convert_chat_order_to_paid_order_with_inventory(
  uuid, text, text, numeric, text
) TO service_role;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
       'public.reconcile_paystack_unmatched_partial_payment(uuid,uuid,uuid,text,numeric,text,text,text,numeric,numeric,numeric,jsonb,uuid,text)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.reconcile_paystack_unmatched_partial_payment_v1(uuid,uuid,uuid,text,numeric,text,text,text,numeric,numeric,numeric,jsonb,uuid,text)'
     ) IS NULL THEN
    ALTER FUNCTION public.reconcile_paystack_unmatched_partial_payment(
      uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric,
      numeric, jsonb, uuid, text
    ) RENAME TO reconcile_paystack_unmatched_partial_payment_v1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  p_review_id uuid,
  p_order_id uuid,
  p_merchant_id uuid,
  p_paystack_reference text,
  p_amount numeric,
  p_currency text,
  p_customer_email text,
  p_customer_name text,
  p_gateway_fee numeric,
  p_platform_fee numeric,
  p_merchant_amount numeric,
  p_gateway_response jsonb,
  p_operator_user_id uuid,
  p_actor text DEFAULT 'manual_reconcile_paystack_partial'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: reconcile_paystack_unmatched_partial_payment requires service_role';
  END IF;

  IF NULLIF(trim(COALESCE(p_paystack_reference, '')), '') IS NOT NULL THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(trim(p_paystack_reference), 0)
    );
    IF EXISTS (
      SELECT 1
        FROM public.transactions AS t
       WHERE lower(trim(COALESCE(t.gateway, ''))) = 'paystack'
         AND t.gateway_reference = trim(p_paystack_reference)
    ) THEN
      RAISE EXCEPTION 'paystack_reference_already_recorded';
    END IF;
  END IF;

  RETURN public.reconcile_paystack_unmatched_partial_payment_v1(
    p_review_id, p_order_id, p_merchant_id, p_paystack_reference, p_amount,
    p_currency, p_customer_email, p_customer_name, p_gateway_fee,
    p_platform_fee, p_merchant_amount, p_gateway_response,
    p_operator_user_id, p_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_paystack_unmatched_partial_payment_v1(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_unmatched_partial_payment_v1(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text
) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text
) TO service_role;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure(
       'public.reconcile_paystack_unmatched_partial_payment(uuid,uuid,uuid,text,numeric,text,text,text,numeric,numeric,numeric,jsonb,uuid,text,boolean)'
     ) IS NOT NULL
     AND pg_catalog.to_regprocedure(
       'public.reconcile_paystack_unmatched_partial_payment_v1(uuid,uuid,uuid,text,numeric,text,text,text,numeric,numeric,numeric,jsonb,uuid,text,boolean)'
     ) IS NULL THEN
    ALTER FUNCTION public.reconcile_paystack_unmatched_partial_payment(
      uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric,
      numeric, jsonb, uuid, text, boolean
    ) RENAME TO reconcile_paystack_unmatched_partial_payment_v1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  p_review_id uuid,
  p_order_id uuid,
  p_merchant_id uuid,
  p_paystack_reference text,
  p_amount numeric,
  p_currency text,
  p_customer_email text,
  p_customer_name text,
  p_gateway_fee numeric,
  p_platform_fee numeric,
  p_merchant_amount numeric,
  p_gateway_response jsonb,
  p_operator_user_id uuid,
  p_actor text,
  p_allow_email_mismatch boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
  v_transaction_id uuid;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden: reconcile_paystack_unmatched_partial_payment requires service_role';
  END IF;

  v_result := public.reconcile_paystack_unmatched_partial_payment_v1(
    p_review_id, p_order_id, p_merchant_id, p_paystack_reference, p_amount,
    p_currency, p_customer_email, p_customer_name, p_gateway_fee,
    p_platform_fee, p_merchant_amount, p_gateway_response,
    p_operator_user_id, p_actor, p_allow_email_mismatch
  );
  v_transaction_id := NULLIF(v_result ->> 'transaction_id', '')::uuid;
  IF v_transaction_id IS NULL THEN
    RAISE EXCEPTION 'email_mismatch_override_missing_transaction_id';
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_paystack_unmatched_partial_payment_v1(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text, boolean
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_unmatched_partial_payment_v1(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text, boolean
) TO service_role;
REVOKE ALL ON FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text, boolean
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_paystack_unmatched_partial_payment(
  uuid, uuid, uuid, text, numeric, text, text, text, numeric, numeric, numeric,
  jsonb, uuid, text, boolean
) TO service_role;

COMMENT ON COLUMN public.orders.chat_order_id IS
  'Durable link to the originating chat order for idempotent chat conversion retries.';
