-- Quiz v2 finalization: terminalize at the universal end, publish test results
-- without prizes, and transfer one pre-existing live product hold to one winner.

ALTER TABLE public.quiz_events
  ADD COLUMN IF NOT EXISTS attempts_terminalized_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalization_state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS finalization_error_code text,
  ADD COLUMN IF NOT EXISTS claim_window_seconds integer;

ALTER TABLE public.quiz_events DROP CONSTRAINT IF EXISTS quiz_events_finalization_state_check;
ALTER TABLE public.quiz_events ADD CONSTRAINT quiz_events_finalization_state_check
  CHECK (finalization_state IN ('pending', 'blocked', 'awarded', 'no_winner', 'test_published'));
ALTER TABLE public.quiz_events DROP CONSTRAINT IF EXISTS quiz_events_claim_window_check;
ALTER TABLE public.quiz_events ADD CONSTRAINT quiz_events_claim_window_check
  CHECK (claim_window_seconds IS NULL OR claim_window_seconds > 0);

ALTER TABLE public.quiz_awards
  ADD COLUMN IF NOT EXISTS award_source text,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS expired_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_awards_one_ranked_product_v2_per_event
  ON public.quiz_awards (event_id)
  WHERE award_source = 'ranked_product_v2';

CREATE TABLE IF NOT EXISTS public.quiz_prize_reservations (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL UNIQUE REFERENCES public.quiz_events(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  condition text,
  inventory_unit_id uuid REFERENCES public.variant_inventory(id) ON DELETE RESTRICT,
  inventory_kind text NOT NULL CHECK (inventory_kind IN ('unlimited', 'aggregate', 'serialized')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity = 1),
  state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved', 'transferred', 'released')),
  award_id uuid REFERENCES public.quiz_awards(id) ON DELETE RESTRICT,
  reserved_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  transferred_at timestamptz,
  released_at timestamptz,
  release_reason text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT quiz_prize_reservations_event_merchant_fkey
    FOREIGN KEY (event_id, merchant_id) REFERENCES public.quiz_events(id, merchant_id) ON DELETE RESTRICT,
  CONSTRAINT quiz_prize_reservations_serialized_pair CHECK (
    (inventory_kind = 'serialized' AND inventory_unit_id IS NOT NULL)
    OR (inventory_kind <> 'serialized' AND inventory_unit_id IS NULL)
  ),
  CONSTRAINT quiz_prize_reservations_state_fields CHECK (
    (state = 'reserved' AND transferred_at IS NULL AND released_at IS NULL AND award_id IS NULL)
    OR (state = 'transferred' AND transferred_at IS NOT NULL AND released_at IS NULL AND award_id IS NOT NULL)
    OR (state = 'released' AND released_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_quiz_prize_reservations_serialized_active
  ON public.quiz_prize_reservations (inventory_unit_id)
  WHERE inventory_unit_id IS NOT NULL AND state = 'reserved';
CREATE INDEX IF NOT EXISTS idx_quiz_prize_reservations_state
  ON public.quiz_prize_reservations (state, event_id);

ALTER TABLE public.quiz_prize_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.quiz_prize_reservations FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.quiz_reject_test_prize_v2()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_mode text;
BEGIN
  SELECT mode INTO v_mode FROM public.quiz_events WHERE id = NEW.event_id;
  IF v_mode = 'test' THEN
    RAISE EXCEPTION 'quiz_test_prize_forbidden' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quiz_prize_reservations_reject_test ON public.quiz_prize_reservations;
CREATE TRIGGER quiz_prize_reservations_reject_test
  BEFORE INSERT OR UPDATE ON public.quiz_prize_reservations
  FOR EACH ROW EXECUTE FUNCTION private.quiz_reject_test_prize_v2();
DROP TRIGGER IF EXISTS quiz_awards_reject_test_ranked_product ON public.quiz_awards;
CREATE TRIGGER quiz_awards_reject_test_ranked_product
  BEFORE INSERT OR UPDATE ON public.quiz_awards
  FOR EACH ROW WHEN (NEW.award_source = 'ranked_product_v2')
  EXECUTE FUNCTION private.quiz_reject_test_prize_v2();

CREATE OR REPLACE FUNCTION private.reserve_quiz_product_prize_v2(p_event_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.quiz_events%ROWTYPE; v_existing uuid; v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE; v_product_id uuid; v_variant_id uuid;
  v_claim_variant_id uuid; v_unit_id uuid; v_kind text; v_active_holds integer; v_stock integer;
BEGIN
  SELECT * INTO v_event FROM public.quiz_events WHERE id = p_event_id FOR UPDATE;
  IF v_event.id IS NULL OR v_event.contract_version <> 2 OR v_event.mode <> 'live' THEN
    RAISE EXCEPTION 'quiz_live_v2_event_required' USING ERRCODE = 'QZ040';
  END IF;
  SELECT id INTO v_existing FROM public.quiz_prize_reservations WHERE event_id = p_event_id FOR UPDATE;
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;
  BEGIN
    v_product_id := NULLIF(btrim(v_event.settings ->> 'prize_product_id'), '')::uuid;
    v_variant_id := NULLIF(btrim(v_event.settings ->> 'prize_variant_id'), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'quiz_prize_snapshot_invalid' USING ERRCODE = 'QZ041';
  END;
  SELECT * INTO v_product FROM public.products
  WHERE id = v_product_id AND merchant_id = v_event.merchant_id AND status = 'active' FOR UPDATE;
  IF v_product.id IS NULL THEN RAISE EXCEPTION 'quiz_prize_product_unavailable' USING ERRCODE = 'QZ042'; END IF;
  IF v_variant_id IS NOT NULL THEN
    SELECT * INTO v_variant FROM public.product_variants
    WHERE id = v_variant_id AND product_id = v_product.id AND merchant_id = v_event.merchant_id
      AND is_inventory_anchor IS NOT TRUE FOR UPDATE;
    IF v_variant.id IS NULL THEN RAISE EXCEPTION 'quiz_prize_variant_unavailable' USING ERRCODE = 'QZ043'; END IF;
    v_claim_variant_id := v_variant.id;
  ELSE
    IF v_product.has_variants IS TRUE OR v_product.variant_model = 'sku_matrix' THEN
      RAISE EXCEPTION 'quiz_prize_variant_required' USING ERRCODE = 'QZ043';
    END IF;
    PERFORM private.ensure_product_inventory_anchor_variant(v_event.merchant_id, v_product.id);
    SELECT inventory_anchor_variant_id INTO v_claim_variant_id FROM public.products WHERE id = v_product.id;
    SELECT * INTO v_variant FROM public.product_variants WHERE id = v_claim_variant_id FOR UPDATE;
  END IF;
  IF public.get_effective_inventory_tracking_policy(v_product.inventory_tracking_policy, v_variant.inventory_tracking_policy)
      IN ('serialized_strict', 'serialized_then_unlimited') THEN
    SELECT vi.id INTO v_unit_id FROM public.variant_inventory vi
    WHERE vi.merchant_id = v_event.merchant_id AND vi.variant_id = v_claim_variant_id
      AND vi.status = 'available' AND vi.order_id IS NULL AND vi.order_item_id IS NULL AND vi.sold_at IS NULL
    ORDER BY vi.created_at, vi.id LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF v_unit_id IS NULL AND public.get_effective_inventory_tracking_policy(v_product.inventory_tracking_policy, v_variant.inventory_tracking_policy) = 'serialized_strict' THEN
      RAISE EXCEPTION 'quiz_prize_stock_exhausted' USING ERRCODE = 'QZ044';
    END IF;
    v_kind := CASE WHEN v_unit_id IS NULL THEN 'unlimited' ELSE 'serialized' END;
    IF v_unit_id IS NOT NULL THEN
      UPDATE public.variant_inventory SET status = 'reserved', reserved_at = clock_timestamp(), updated_at = clock_timestamp()
      WHERE id = v_unit_id;
    END IF;
  ELSIF COALESCE(v_product.manage_stock, true) THEN
    v_kind := 'aggregate';
    v_stock := CASE WHEN v_variant_id IS NULL THEN COALESCE(v_product.stock_quantity, 0) ELSE COALESCE(v_variant.stock_quantity, 0) END;
    SELECT count(*)::integer INTO v_active_holds FROM public.quiz_prize_reservations r
    WHERE r.product_id = v_product.id AND r.variant_id IS NOT DISTINCT FROM v_variant_id AND r.state = 'reserved';
    IF v_stock - v_active_holds < 1 THEN RAISE EXCEPTION 'quiz_prize_stock_exhausted' USING ERRCODE = 'QZ044'; END IF;
  ELSE v_kind := 'unlimited'; END IF;
  INSERT INTO public.quiz_prize_reservations(event_id, merchant_id, product_id, variant_id, condition, inventory_unit_id, inventory_kind)
  VALUES (v_event.id, v_event.merchant_id, v_product.id, v_variant_id,
    NULLIF(btrim(v_event.settings ->> 'prize_condition'), ''), v_unit_id, v_kind) RETURNING id INTO v_existing;
  RETURN v_existing;
END;
$$;

CREATE OR REPLACE FUNCTION private.release_quiz_prize_reservation_v2(p_event_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_res public.quiz_prize_reservations%ROWTYPE;
  v_award public.quiz_awards%ROWTYPE;
  v_order_shipping_status text;
BEGIN
  -- Shared lifecycle lock order: event before reservation/inventory.
  PERFORM 1 FROM public.quiz_events WHERE id = p_event_id FOR UPDATE;
  SELECT * INTO v_res FROM public.quiz_prize_reservations WHERE event_id = p_event_id FOR UPDATE;
  IF v_res.id IS NULL OR v_res.state = 'released' THEN RETURN false; END IF;
  IF v_res.state = 'transferred' AND v_res.award_id IS NOT NULL THEN
    -- Event and reservation are already locked. Lock the award and order before
    -- releasing fulfillment so concurrent expiry workers cannot double-release.
    SELECT * INTO v_award FROM public.quiz_awards WHERE id = v_res.award_id FOR UPDATE;
    IF v_award.id IS NULL OR v_award.reserved_order_id IS NULL THEN
      RAISE EXCEPTION 'quiz_prize_award_missing' USING ERRCODE = 'QZ047';
    END IF;
    SELECT shipping_status INTO v_order_shipping_status FROM public.orders
    WHERE id = v_award.reserved_order_id AND merchant_id = v_res.merchant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_prize_order_missing' USING ERRCODE = 'QZ047'; END IF;
    IF v_order_shipping_status <> 'cancelled' THEN
      PERFORM private.cancel_order_and_release_inventory(v_res.merchant_id,
        v_award.reserved_order_id, 'cancelled', 'Expired quiz prize', NULL);
    END IF;
    IF v_res.inventory_kind = 'aggregate' THEN
      IF v_res.variant_id IS NULL THEN UPDATE public.products SET stock_quantity = stock_quantity + 1 WHERE id = v_res.product_id;
      ELSE UPDATE public.product_variants SET stock_quantity = stock_quantity + 1 WHERE id = v_res.variant_id; END IF;
    END IF;
  ELSIF v_res.inventory_unit_id IS NOT NULL THEN
    UPDATE public.variant_inventory SET status = 'available', order_id = NULL, order_item_id = NULL,
      reserved_at = NULL, reservation_expires_at = NULL, updated_at = clock_timestamp()
    WHERE id = v_res.inventory_unit_id AND status = 'reserved'
      AND order_id IS NULL AND order_item_id IS NULL AND sold_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_serialized_hold_lost' USING ERRCODE = 'QZ046'; END IF;
  END IF;
  UPDATE public.quiz_prize_reservations SET state = 'released', released_at = clock_timestamp(),
    release_reason = left(COALESCE(NULLIF(btrim(p_reason), ''), 'unspecified'), 64), updated_at = clock_timestamp()
  WHERE id = v_res.id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION private.quiz_ranked_candidates_v2(p_event_id uuid)
RETURNS TABLE(rank bigint, attempt_id uuid, customer_id uuid, score integer, total_time_seconds double precision)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH best AS (
    SELECT DISTINCT ON (a.customer_id) a.id, a.customer_id, a.score, a.started_at, a.submitted_at
    FROM public.quiz_attempts a
    WHERE a.event_id = p_event_id AND a.status IN ('submitted', 'scored') AND a.submitted_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.quiz_attempt_signal_flags f WHERE f.attempt_id = a.id AND f.severity = 'block')
    ORDER BY a.customer_id, a.score DESC, a.submitted_at - a.started_at, a.submitted_at, a.id
  )
  SELECT row_number() OVER (ORDER BY b.score DESC, b.submitted_at - b.started_at, b.submitted_at, b.id),
    b.id, b.customer_id, b.score, extract(epoch FROM (b.submitted_at - b.started_at))::double precision
  FROM best b;
$$;

CREATE OR REPLACE FUNCTION private.terminalize_quiz_event_attempts_v2(p_event_id uuid, p_now timestamptz)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  UPDATE public.quiz_attempts a SET status = 'submitted', submitted_at = COALESCE(a.submitted_at, p_now),
    score = COALESCE((SELECT sum(ans.score_delta)::integer FROM public.quiz_attempt_questions q
      LEFT JOIN public.quiz_attempt_answers ans ON ans.attempt_question_id = q.id WHERE q.attempt_id = a.id), 0)
  WHERE a.event_id = p_event_id AND a.status = 'started';
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_due_scheduled_quiz_events_service_v2()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_count integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.quiz_events SET status = 'active', updated_at = clock_timestamp()
  WHERE contract_version = 2 AND status = 'scheduled' AND starts_at <= clock_timestamp() AND ends_at > clock_timestamp();
  GET DIAGNOSTICS v_count = ROW_COUNT; RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_due_test_quiz_events_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event record; v_closed integer := 0; v_zero integer := 0; v_attempts integer;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOR v_event IN SELECT e.id FROM public.quiz_events e WHERE e.contract_version = 2 AND e.mode = 'test'
    AND e.status IN ('active','scheduled') AND e.ends_at <= clock_timestamp()
    ORDER BY e.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    v_attempts := private.terminalize_quiz_event_attempts_v2(v_event.id, clock_timestamp());
    IF NOT EXISTS (SELECT 1 FROM public.quiz_attempts WHERE event_id = v_event.id) THEN v_zero := v_zero + 1; END IF;
    UPDATE public.quiz_events SET status = 'completed', attempts_terminalized_at = COALESCE(attempts_terminalized_at, clock_timestamp()),
      finalization_state = 'test_published', finalization_error_code = NULL,
      award_finalized_at = COALESCE(award_finalized_at, clock_timestamp()), results_published_at = COALESCE(results_published_at, clock_timestamp()), updated_at = clock_timestamp()
    WHERE id = v_event.id;
    INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
    VALUES (v_event.id, 'quiz_v2_test_finalized', 'succeeded', jsonb_build_object('terminalizedAttempts', v_attempts));
    v_closed := v_closed + 1;
  END LOOP;
  RETURN jsonb_build_object('testClosed', v_closed, 'zeroPlayerClosed', v_zero);
END;
$$;

CREATE OR REPLACE FUNCTION public.terminalize_due_live_quiz_events_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event record; v_closed integer := 0; v_zero integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOR v_event IN SELECT e.id FROM public.quiz_events e WHERE e.contract_version = 2 AND e.mode = 'live'
    AND e.status IN ('active','scheduled') AND e.ends_at <= clock_timestamp()
    ORDER BY e.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    PERFORM private.terminalize_quiz_event_attempts_v2(v_event.id, clock_timestamp());
    IF NOT EXISTS (SELECT 1 FROM public.quiz_attempts WHERE event_id = v_event.id) THEN v_zero := v_zero + 1; END IF;
    UPDATE public.quiz_events SET attempts_terminalized_at = COALESCE(attempts_terminalized_at, clock_timestamp()),
      finalization_state = CASE WHEN finalization_state IN ('awarded','no_winner') THEN finalization_state ELSE 'pending' END,
      updated_at = clock_timestamp() WHERE id = v_event.id;
    v_closed := v_closed + 1;
  END LOOP;
  RETURN jsonb_build_object('liveTerminalized', v_closed, 'zeroPlayerClosed', v_zero);
END;
$$;

CREATE OR REPLACE FUNCTION private.transfer_quiz_prize_to_winner_v2(p_event_id uuid, p_attempt_id uuid, p_customer_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_event public.quiz_events%ROWTYPE; v_res public.quiz_prize_reservations%ROWTYPE;
  v_result jsonb; v_award_id uuid; v_order_id uuid; v_order_item_id uuid;
  v_email text; v_name text; v_phone text; v_product_name text; v_variant_name text;
  v_amount numeric; v_currency text; v_fulfillment jsonb;
BEGIN
  SELECT * INTO v_event FROM public.quiz_events WHERE id = p_event_id FOR UPDATE;
  -- Shared lifecycle lock order: event, then attempt, then reservation/award rows.
  PERFORM 1 FROM public.quiz_attempts
  WHERE id = p_attempt_id AND event_id = p_event_id AND customer_id = p_customer_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'quiz_attempt_not_found' USING ERRCODE = 'QZ004'; END IF;
  SELECT * INTO v_res FROM public.quiz_prize_reservations WHERE event_id = p_event_id FOR UPDATE;
  IF v_res.id IS NULL OR v_res.state <> 'reserved' OR v_event.claim_window_seconds IS NULL THEN
    RAISE EXCEPTION 'quiz_prize_reservation_not_ready' USING ERRCODE = 'QZ045';
  END IF;
  IF v_res.inventory_kind = 'serialized' THEN
    SELECT c.email, concat_ws(' ', c.first_name, c.last_name), c.phone
    INTO v_email, v_name, v_phone FROM public.customers c
    WHERE c.id = p_customer_id AND c.merchant_id = v_res.merchant_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_customer_not_found' USING ERRCODE = 'QZ004'; END IF;
    SELECT p.name, COALESCE(pv.price_override, p.price),
      CASE WHEN v_res.variant_id IS NULL THEN NULL ELSE public.format_order_item_variant_name(pv.attributes) END,
      COALESCE(upper(NULLIF(btrim(m.payout_currency), '')), 'NGN')
    INTO v_product_name, v_amount, v_variant_name, v_currency
    FROM public.products p JOIN public.merchants m ON m.id = p.merchant_id
    LEFT JOIN public.product_variants pv ON pv.id = v_res.variant_id
    WHERE p.id = v_res.product_id AND p.merchant_id = v_res.merchant_id AND p.status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_prize_product_unavailable' USING ERRCODE = 'QZ042'; END IF;
    -- Create fulfillment records, then atomically bind only this event's held
    -- unit. Never reopen the hold or invoke the legacy inventory selector.
    INSERT INTO public.orders(merchant_id, customer_id, customer_email, customer_name, customer_phone,
      subtotal, shipping_fee, discount_amount, tax_amount, total, currency, payment_method,
      payment_status, shipping_status, source, notes, tax_basis)
    VALUES (v_res.merchant_id, p_customer_id, COALESCE(v_email, 'quiz-prize@baci.app'),
      COALESCE(NULLIF(btrim(v_name), ''), 'Quiz Winner'), v_phone, 0, 0, 0, 0, 0, v_currency,
      'quiz_award', 'paid', 'pending', 'quiz_prize', 'Quiz prize award reservation', 'exclusive')
    RETURNING id INTO v_order_id;
    INSERT INTO public.order_items(order_id, product_id, variant_id, variant_name, name, price,
      quantity, condition, variant_attributes)
    VALUES (v_order_id, v_res.product_id, v_res.variant_id, v_variant_name, v_product_name, 0,
      1, v_res.condition, '{}'::jsonb) RETURNING id INTO v_order_item_id;
    UPDATE public.variant_inventory SET order_id = v_order_id, order_item_id = v_order_item_id,
      reservation_expires_at = NULL,
      first_reserved_at = COALESCE(first_reserved_at, reserved_at, clock_timestamp()),
      updated_at = clock_timestamp()
    WHERE id = v_res.inventory_unit_id AND merchant_id = v_res.merchant_id
      AND status = 'reserved' AND order_id IS NULL AND order_item_id IS NULL AND sold_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_serialized_hold_lost' USING ERRCODE = 'QZ046'; END IF;
    v_fulfillment := jsonb_build_object('source', 'merchant_stock', 'reservationExpiresAt', NULL,
      'inventoryUnits', jsonb_build_array(jsonb_build_object('inventoryUnitId', v_res.inventory_unit_id)),
      'missingUnitCount', 0);
    UPDATE public.order_items SET fulfillment_data = v_fulfillment WHERE id = v_order_item_id;
    UPDATE public.orders SET fulfillment_details = v_fulfillment WHERE id = v_order_id;
    INSERT INTO public.quiz_awards(amount, approved_at, attempt_id, award_type, customer_id,
      event_id, status, product_id, variant_id, condition, reserved_order_id,
      reserved_order_item_id, award_source, claim_expires_at)
    VALUES (v_amount, clock_timestamp(), p_attempt_id, 'store_credit', p_customer_id,
      p_event_id, 'approved', v_res.product_id, v_res.variant_id, v_res.condition, v_order_id,
      v_order_item_id, 'ranked_product_v2',
      clock_timestamp() + make_interval(secs => v_event.claim_window_seconds))
    RETURNING id INTO v_award_id;
    PERFORM private.sync_serialized_stock(v_res.merchant_id, v_res.product_id);
  ELSIF v_res.inventory_kind = 'aggregate' THEN
    IF v_res.variant_id IS NULL THEN
      UPDATE public.products SET stock_quantity = stock_quantity - 1 WHERE id = v_res.product_id AND stock_quantity >= 1;
    ELSE UPDATE public.product_variants SET stock_quantity = stock_quantity - 1 WHERE id = v_res.variant_id AND stock_quantity >= 1; END IF;
    IF NOT FOUND THEN RAISE EXCEPTION 'quiz_prize_stock_exhausted' USING ERRCODE = 'QZ044'; END IF;
  END IF;
  IF v_res.inventory_kind <> 'serialized' THEN
    v_result := private.create_quiz_product_prize_award_with_inventory(p_attempt_id, p_event_id, p_customer_id,
      v_res.product_id, v_res.variant_id, v_res.condition, '{}'::jsonb, NULL);
    IF COALESCE((v_result ->> 'success')::boolean, false) IS NOT TRUE THEN
      RAISE EXCEPTION 'quiz_prize_transfer_failed' USING ERRCODE = 'QZ047';
    END IF;
    v_award_id := (v_result ->> 'awardId')::uuid;
    UPDATE public.quiz_awards SET award_source = 'ranked_product_v2',
      claim_expires_at = clock_timestamp() + make_interval(secs => v_event.claim_window_seconds)
    WHERE id = v_award_id;
  END IF;
  UPDATE public.quiz_prize_reservations SET state = 'transferred', award_id = v_award_id,
    transferred_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = v_res.id;
  RETURN v_award_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_due_live_quiz_events_v2(p_production_phase boolean, p_production_approved boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event public.quiz_events%ROWTYPE; v_winner record; v_awarded integer := 0; v_none integer := 0; v_blocked integer := 0; v_failed integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  FOR v_event IN SELECT e.* FROM public.quiz_events e WHERE e.contract_version = 2 AND e.mode = 'live'
    AND e.ends_at <= clock_timestamp() AND e.attempts_terminalized_at IS NOT NULL
    AND e.finalization_state IN ('pending','blocked') AND e.results_published_at IS NULL
    ORDER BY e.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    IF p_production_phase IS NOT TRUE OR p_production_approved IS NOT TRUE OR v_event.compliance_verified IS NOT TRUE
      OR NULLIF(btrim(v_event.nlrc_permit_ref), '') IS NULL OR NULLIF(btrim(v_event.rules_version), '') IS NULL
      OR v_event.claim_window_seconds IS NULL
      OR NOT EXISTS (SELECT 1 FROM public.quiz_prize_reservations r WHERE r.event_id = v_event.id AND r.state = 'reserved') THEN
      UPDATE public.quiz_events SET finalization_state = 'blocked', finalization_error_code = 'live_award_gate_unavailable', updated_at = clock_timestamp() WHERE id = v_event.id;
      v_blocked := v_blocked + 1; CONTINUE;
    END IF;
    BEGIN
      SELECT * INTO v_winner FROM private.quiz_ranked_candidates_v2(v_event.id) ORDER BY rank LIMIT 1;
      IF v_winner.attempt_id IS NULL THEN
        PERFORM private.release_quiz_prize_reservation_v2(v_event.id, 'no_eligible_winner');
        UPDATE public.quiz_events SET status = 'completed', finalization_state = 'no_winner', finalization_error_code = NULL,
          award_finalized_at = clock_timestamp(), results_published_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = v_event.id;
        v_none := v_none + 1;
      ELSE
        PERFORM private.transfer_quiz_prize_to_winner_v2(v_event.id, v_winner.attempt_id, v_winner.customer_id);
        UPDATE public.quiz_events SET status = 'completed', finalization_state = 'awarded', finalization_error_code = NULL,
          award_finalized_at = clock_timestamp(), results_published_at = clock_timestamp(), updated_at = clock_timestamp() WHERE id = v_event.id;
        v_awarded := v_awarded + 1;
      END IF;
      INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
      VALUES (v_event.id, 'quiz_v2_live_finalized', 'succeeded', jsonb_build_object('outcome', CASE WHEN v_winner.attempt_id IS NULL THEN 'no_winner' ELSE 'awarded' END));
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.quiz_events SET finalization_state = 'blocked', finalization_error_code = 'live_award_transfer_failed',
        updated_at = clock_timestamp() WHERE id = v_event.id;
      INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
      VALUES (v_event.id, 'quiz_v2_live_finalized', 'failed', jsonb_build_object('code', 'live_award_transfer_failed'));
      v_failed := v_failed + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('awarded', v_awarded, 'noWinner', v_none, 'liveAwaitingGate', v_blocked + v_failed, 'failed', v_failed);
END;
$$;

-- Keep the legacy product closer, but prevent it from racing v2 finalization.
CREATE OR REPLACE FUNCTION public.close_due_product_quiz_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_event_id uuid; v_count integer := 0;
BEGIN
  FOR v_event_id IN SELECT e.id FROM public.quiz_events e
    WHERE e.contract_version = 1 AND e.settings ? 'prize_product_id'
      AND NULLIF(btrim(e.settings ->> 'prize_product_id'), '') IS NOT NULL
      AND NOT (e.settings ? 'ranked_prizes' OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount' OR e.settings ? 'cash_prize_amount')
      AND e.status IN ('active','scheduled') AND e.ends_at <= now() - interval '2 minutes'
      AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.event_id = e.id
        AND a.status = 'started' AND a.started_at >= now() - interval '1 hour')
    ORDER BY e.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.quiz_attempts SET status = 'expired' WHERE event_id = v_event_id
      AND status = 'started' AND started_at < now() - interval '1 hour';
    UPDATE public.quiz_events SET status = 'completed', updated_at = now()
      WHERE id = v_event_id AND status IN ('active','scheduled');
    IF FOUND THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Preserve the v1 ranked finalizer exactly, while excluding every contract-v2
-- event from its candidate and update predicates.
CREATE OR REPLACE FUNCTION public.finalize_due_quiz_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_ranked_event_id uuid; v_count integer := 0;
BEGIN
  FOR v_ranked_event_id IN
    SELECT e.id FROM public.quiz_events e
    WHERE e.contract_version = 1
      AND (
        e.award_finalized_at IS NULL
        OR (
          e.award_finalized_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.leaderboard_refresh_log stub_log
            WHERE stub_log.event_id = e.id AND stub_log.refresh_reason = 'phase1a_award_finalize_stub')
          AND NOT EXISTS (SELECT 1 FROM public.quiz_awards legacy_award WHERE legacy_award.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.leaderboard_refresh_log recovery_log
            WHERE recovery_log.event_id = e.id AND recovery_log.refresh_reason = 'cron_award_finalize_rank_winners')
        )
      )
      AND e.compliance_verified = true
      AND NULLIF(btrim(e.nlrc_permit_ref), '') IS NOT NULL
      AND e.status IN ('active','scheduled','completed')
      AND (
        e.status = 'completed'
        OR (
          e.ends_at <= now() - interval '2 minutes'
          AND NOT EXISTS (SELECT 1 FROM public.quiz_attempts a WHERE a.event_id = e.id
            AND a.status = 'started' AND a.started_at >= now() - interval '1 hour')
        )
      )
      AND (e.settings ? 'ranked_prizes' OR e.settings ? 'ranked_winner_count'
        OR e.settings ? 'grand_prize_amount' OR e.settings ? 'cash_prize_amount')
    ORDER BY e.ends_at LIMIT 100 FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.quiz_events e SET award_finalized_at = now(),
      status = CASE WHEN e.status IN ('active','scheduled') THEN 'completed' ELSE e.status END,
      updated_at = now()
    WHERE e.id = v_ranked_event_id AND e.contract_version = 1
      AND (
        e.award_finalized_at IS NULL
        OR (
          e.award_finalized_at IS NOT NULL
          AND EXISTS (SELECT 1 FROM public.leaderboard_refresh_log stub_log
            WHERE stub_log.event_id = e.id AND stub_log.refresh_reason = 'phase1a_award_finalize_stub')
          AND NOT EXISTS (SELECT 1 FROM public.quiz_awards legacy_award WHERE legacy_award.event_id = e.id)
          AND NOT EXISTS (SELECT 1 FROM public.leaderboard_refresh_log recovery_log
            WHERE recovery_log.event_id = e.id AND recovery_log.refresh_reason = 'cron_award_finalize_rank_winners')
        )
      );
    IF FOUND THEN
      PERFORM public.mint_quiz_event_ranked_awards(v_ranked_event_id);
      INSERT INTO public.leaderboard_refresh_log(event_id, refresh_reason, status, details)
      VALUES (v_ranked_event_id, 'cron_award_finalize_rank_winners', 'queued',
        jsonb_build_object('source', 'finalize_due_quiz_events'));
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_unclaimed_ranked_quiz_awards_v2()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_award record; v_expired integer := 0; v_released integer := 0;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  -- Lock events first. Award and reservation locks are acquired inside the loop.
  FOR v_award IN SELECT a.id, a.event_id FROM public.quiz_awards a
    JOIN public.quiz_events e ON e.id = a.event_id WHERE a.award_source = 'ranked_product_v2'
    AND a.status IN ('pending','approved') AND a.claim_expires_at <= clock_timestamp()
    ORDER BY a.claim_expires_at LIMIT 100 FOR UPDATE OF e SKIP LOCKED LOOP
    UPDATE public.quiz_awards SET status = 'void', expired_at = clock_timestamp()
    WHERE id = v_award.id AND status IN ('pending','approved');
    IF NOT FOUND THEN CONTINUE; END IF;
    IF private.release_quiz_prize_reservation_v2(v_award.event_id, 'claim_expired') THEN v_released := v_released + 1; END IF;
    v_expired := v_expired + 1;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'released', v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_quiz_attempt_result_v2(p_attempt_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_attempt public.quiz_attempts%ROWTYPE;
  v_event public.quiz_events%ROWTYPE;
  v_rank bigint;
  v_award public.quiz_awards%ROWTYPE;
  v_claim_metadata jsonb;
BEGIN
  SELECT a.* INTO v_attempt FROM public.quiz_attempts a JOIN public.customers c ON c.id = a.customer_id
  WHERE a.id = p_attempt_id AND c.user_id = auth.uid() AND c.deleted_at IS NULL;
  IF v_attempt.id IS NULL THEN
    RETURN jsonb_build_object('attemptId', p_attempt_id, 'availability', 'unavailable', 'reason', 'not_found');
  END IF;
  SELECT * INTO v_event FROM public.quiz_events WHERE id = v_attempt.event_id;
  IF v_event.status = 'cancelled' OR v_attempt.status = 'event_cancelled' THEN
    RETURN jsonb_build_object('attemptId', v_attempt.id, 'availability', 'unavailable', 'reason', 'event_cancelled');
  END IF;
  IF v_attempt.status = 'tester_revoked' THEN
    RETURN jsonb_build_object('attemptId', v_attempt.id, 'availability', 'unavailable', 'reason', 'tester_revoked');
  END IF;
  IF v_event.results_published_at IS NULL THEN
    RETURN jsonb_build_object('attemptId', v_attempt.id, 'availability', 'pending', 'availableAt', v_event.ends_at);
  END IF;
  SELECT c.rank INTO v_rank FROM private.quiz_ranked_candidates_v2(v_event.id) c WHERE c.attempt_id = v_attempt.id;
  IF v_rank IS NULL THEN
    RETURN jsonb_build_object('attemptId', v_attempt.id, 'availability', 'unavailable');
  END IF;
  IF v_event.mode = 'live' THEN
    SELECT * INTO v_award FROM public.quiz_awards a
    WHERE a.event_id = v_event.id AND a.attempt_id = v_attempt.id
      AND a.award_source = 'ranked_product_v2' AND a.status IN ('pending','approved')
      AND a.claim_expires_at > clock_timestamp()
    ORDER BY a.created_at LIMIT 1;
    IF v_award.id IS NOT NULL THEN
      -- Task 7 signs the public claim from only these bounded persisted values.
      v_claim_metadata := jsonb_build_object(
        'awardId', v_award.id,
        'expiresAt', v_award.claim_expires_at
      );
    END IF;
  END IF;
  RETURN jsonb_strip_nulls(jsonb_build_object('attemptId', v_attempt.id, 'availability', 'final',
    'availableAt', v_event.results_published_at, 'score', COALESCE(v_attempt.score, 0), 'rank', v_rank,
    'totalQuestions', v_event.question_count,
    'claimMetadata', v_claim_metadata));
END;
$$;

REVOKE ALL ON FUNCTION private.reserve_quiz_product_prize_v2(uuid), private.release_quiz_prize_reservation_v2(uuid,text),
  private.quiz_ranked_candidates_v2(uuid), private.terminalize_quiz_event_attempts_v2(uuid,timestamptz),
  private.transfer_quiz_prize_to_winner_v2(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_due_scheduled_quiz_events_service_v2(), public.finalize_due_test_quiz_events_v2(),
  public.terminalize_due_live_quiz_events_v2(), public.finalize_due_live_quiz_events_v2(boolean,boolean),
  public.expire_unclaimed_ranked_quiz_awards_v2() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_due_scheduled_quiz_events_service_v2(), public.finalize_due_test_quiz_events_v2(),
  public.terminalize_due_live_quiz_events_v2(), public.finalize_due_live_quiz_events_v2(boolean,boolean),
  public.expire_unclaimed_ranked_quiz_awards_v2() TO service_role;
REVOKE ALL ON FUNCTION public.get_quiz_attempt_result_v2(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_quiz_attempt_result_v2(uuid) TO authenticated, service_role;
