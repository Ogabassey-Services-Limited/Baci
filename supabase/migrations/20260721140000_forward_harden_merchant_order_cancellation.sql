-- Forward-only repair for environments that already recorded 20260721093206.
-- Restore wallet/savings value atomically and replace the cancellation RPC.

CREATE OR REPLACE FUNCTION public.reverse_savings_redemption_for_order(
  p_order_id uuid,
  p_merchant_id uuid,
  p_actor uuid,
  p_reason text DEFAULT 'Order cancelled'
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_redemption record;
  v_new_amount numeric;
  v_new_status text;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('savings_reversal:' || p_order_id::text, 0)
  );

  SELECT r.id, r.goal_id, r.customer_id, r.amount, r.metadata,
         g.current_amount, g.target_amount
    INTO v_redemption
    FROM public.customer_savings_redemptions r
    JOIN public.customer_savings_goals g ON g.id = r.goal_id
   WHERE r.order_id = p_order_id
     AND r.merchant_id = p_merchant_id
   FOR UPDATE OF r, g;

  IF NOT FOUND OR COALESCE(v_redemption.metadata, '{}'::jsonb) ? 'reversed_at' THEN
    RETURN 0;
  END IF;

  v_new_amount := v_redemption.current_amount + v_redemption.amount;
  v_new_status := CASE
    WHEN v_new_amount >= v_redemption.target_amount THEN 'completed'
    ELSE 'paused'
  END;

  UPDATE public.customer_savings_goals
     SET current_amount = v_new_amount,
         status = v_new_status,
         spent_at = NULL,
         applied_order_id = CASE
           WHEN applied_order_id = p_order_id THEN NULL
           ELSE applied_order_id
         END,
         updated_at = now()
   WHERE id = v_redemption.goal_id;

  UPDATE public.customer_savings_redemptions
     SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
       'reversed_at', now(),
       'reversal_reason', p_reason
     )
   WHERE id = v_redemption.id;

  INSERT INTO public.customer_savings_events (
    goal_id, merchant_id, customer_id, event_type, actor_type, actor_id,
    metadata
  ) VALUES (
    v_redemption.goal_id, p_merchant_id, v_redemption.customer_id,
    'savings_order_redemption_reversed', 'merchant_staff', p_actor,
    jsonb_build_object(
      'amount', v_redemption.amount,
      'order_id', p_order_id,
      'reason', p_reason,
      'redemption_id', v_redemption.id
    )
  );

  RETURN v_redemption.amount;
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_savings_redemption_for_order(
  uuid, uuid, uuid, text
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.reverse_savings_redemption_for_order(
  uuid, uuid, uuid, text
) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_order_as_merchant(
  p_order_id uuid,
  p_reason text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_order record;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_wallet_reversed numeric := 0;
  v_savings_reversed numeric := 0;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'reason_too_long' USING ERRCODE = '22001';
  END IF;

  SELECT o.merchant_id, o.shipping_status, o.cancelled_at,
         o.payment_status, o.amount_paid, o.total,
         o.cancellation_reason, o.cancelled_by
    INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT (
    EXISTS (
      SELECT 1 FROM public.merchants m
       WHERE m.id = v_order.merchant_id AND m.user_id = v_actor
    )
    OR public.check_staff_permission(
      v_actor, v_order.merchant_id, 'orders', 'edit'
    )
  ) THEN
    RAISE EXCEPTION 'order_cancel_forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_order.shipping_status IN ('cancelled', 'canceled')
     OR v_order.cancelled_at IS NOT NULL THEN
    RETURN false;
  END IF;
  IF v_order.shipping_status IN (
    'shipped', 'out_for_delivery', 'delivered', 'completed', 'returned'
  ) THEN
    RAISE EXCEPTION 'order_not_cancellable' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.transactions t
     WHERE t.order_id = p_order_id
       AND t.merchant_id = v_order.merchant_id
       AND t.transaction_type = 'payment'
       AND t.status IN ('pending', 'processing')
  ) THEN
    RAISE EXCEPTION 'payment_capture_in_flight' USING ERRCODE = 'P0001';
  END IF;
  IF v_order.payment_status = 'paid'
     AND v_order.amount_paid IS DISTINCT FROM v_order.total THEN
    RAISE EXCEPTION 'paid_order_ledger_inconsistent' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
     SET shipping_status = 'cancelled', cancelled_at = now(),
         cancellation_reason = v_reason, cancelled_by = 'merchant',
         updated_at = now()
   WHERE id = p_order_id;

  UPDATE public.order_payment_accounts SET expires_at = now()
   WHERE order_id = p_order_id
     AND (expires_at IS NULL OR expires_at > now());
  UPDATE public.order_wallet_funding_intents
     SET status = 'cancelled', updated_at = now()
   WHERE order_id = p_order_id
     AND status NOT IN ('completed', 'cancelled', 'expired', 'failed');

  SELECT COALESCE(sum(reversed_amount), 0)
    INTO v_wallet_reversed
    FROM public.reverse_wallet_redemption(
      p_order_id, COALESCE(v_reason, 'Order cancelled'), v_order.merchant_id
    );
  v_savings_reversed := public.reverse_savings_redemption_for_order(
    p_order_id, v_order.merchant_id, v_actor,
    COALESCE(v_reason, 'Order cancelled')
  );

  PERFORM private.restock_order_items(p_order_id);
  PERFORM private.release_order_inventory_units(
    v_order.merchant_id, p_order_id, 'available'
  );

  INSERT INTO public.order_audit_events (
    merchant_id, order_id, actor_user_id, action, change_category,
    changed_fields, before_snapshot, after_snapshot, metadata
  ) VALUES (
    v_order.merchant_id, p_order_id, v_actor, 'order.update',
    'customer_visible',
    ARRAY['shipping_status', 'cancelled_at', 'cancellation_reason', 'cancelled_by'],
    jsonb_build_object(
      'shipping_status', v_order.shipping_status,
      'cancelled_at', v_order.cancelled_at,
      'cancellation_reason', v_order.cancellation_reason,
      'cancelled_by', v_order.cancelled_by
    ),
    jsonb_build_object(
      'shipping_status', 'cancelled', 'cancelled_at', now(),
      'cancellation_reason', v_reason, 'cancelled_by', 'merchant'
    ),
    jsonb_build_object(
      'operation', 'merchant_order_cancellation',
      'wallet_reversed', v_wallet_reversed,
      'savings_reversed', v_savings_reversed
    )
  );

  INSERT INTO public.order_cancellation_side_effects (
    order_id, merchant_id, step, status, claim_token, attempts
  ) VALUES (
    p_order_id, v_order.merchant_id, 'customer_email', 'failed',
    extensions.gen_random_uuid(), 0
  ) ON CONFLICT (order_id, step) DO NOTHING;

  IF EXISTS (
    SELECT 1 FROM public.transactions t
     WHERE t.order_id = p_order_id
       AND t.merchant_id = v_order.merchant_id
       AND t.transaction_type = 'payment'
       AND t.status = 'completed'
       AND t.amount > 0
       AND COALESCE(t.gateway, '') NOT IN (
         'wallet', 'savings', 'store_credit', 'cash', 'manual', 'pay_on_delivery'
       )
  ) THEN
    INSERT INTO public.order_cancellation_side_effects (
      order_id, merchant_id, step, status, claim_token, attempts
    ) VALUES (
      p_order_id, v_order.merchant_id, 'refund', 'failed',
      extensions.gen_random_uuid(), 0
    ) ON CONFLICT (order_id, step) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.cancel_order_as_merchant(uuid, text)
  TO authenticated;
