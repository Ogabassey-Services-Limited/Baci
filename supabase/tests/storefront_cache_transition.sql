-- Category cache-transition producer, lifecycle, coalescing, and delivery regression.
BEGIN;
DO $$
DECLARE
  v_actor uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a601';
  v_disabled_actor uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a609';
  v_merchant uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a602';
  v_disabled_merchant uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a604';
  v_category uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a603';
  v_child uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a605';
  v_disabled_category uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a606';
  v_canary_disabled_category uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a607';
  v_rollback_category uuid := '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a608';
  v_event record; v_successor record; v_claim record; v_replayed_claim record;
  v_count bigint; v_finished boolean; v_replayed integer; v_ordered boolean; v_stale_token uuid;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO auth.users(id) VALUES(v_actor),(v_disabled_actor);
  INSERT INTO public.merchants(id,email,user_id) VALUES
    (v_merchant,'cache-transition@example.invalid',v_actor),
    (v_disabled_merchant,'cache-transition-disabled@example.invalid',v_disabled_actor);
  -- Disabled producers and non-canaries must leave no event, queue, obligation, or delivery.
  INSERT INTO public.categories(id,merchant_id,name,slug,is_active)
  VALUES(v_disabled_category,v_merchant,'Disabled producer','disabled-producer',true);
  IF EXISTS (SELECT 1 FROM public.domain_event_ledger WHERE subject_id=v_disabled_category::text) THEN
    RAISE EXCEPTION 'disabled cache producer emitted an event';
  END IF;
  UPDATE public.domain_event_producer_config
  SET enabled=true,shadow_only=false WHERE producer_key='storefront.cache_transition';
  INSERT INTO public.categories(id,merchant_id,name,slug,is_active)
  VALUES(v_canary_disabled_category,v_disabled_merchant,'Disabled canary','disabled-canary',true);
  IF EXISTS (SELECT 1 FROM public.domain_event_ledger WHERE subject_id=v_canary_disabled_category::text) THEN
    RAISE EXCEPTION 'non-canary merchant emitted an event';
  END IF;
  INSERT INTO public.storefront_cache_transition_canaries(merchant_id,enabled) VALUES(v_merchant,true);

  -- A subtransaction rollback must remove the producer's ledger/queue/obligation atomically.
  BEGIN
    INSERT INTO public.categories(id,merchant_id,name,slug,is_active)
    VALUES(v_rollback_category,v_merchant,'Rollback','rollback',true);
    RAISE EXCEPTION 'force category rollback';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.domain_event_ledger WHERE subject_id=v_rollback_category::text)
    OR EXISTS (SELECT 1 FROM public.storefront_cache_transition_obligations WHERE category_id=v_rollback_category) THEN
    RAISE EXCEPTION 'rolled-back category DML leaked a cache transition';
  END IF;
  -- Direct SQL INSERT/UPDATE/rename/deactivate/reactivate/delete are the producer surface.
  INSERT INTO public.categories(id,merchant_id,name,slug,is_active)
  VALUES(v_category,v_merchant,'Before','before',true);
  SELECT ledger.* INTO v_event FROM public.domain_event_ledger AS ledger
  WHERE ledger.event_name='storefront.cache_transition.v1' AND ledger.subject_id=v_category::text;
  IF v_event.queue_message_id IS NULL OR NOT EXISTS(
    SELECT 1 FROM public.storefront_cache_transition_obligations WHERE domain_event_id=v_event.domain_event_id
  ) THEN RAISE EXCEPTION 'enabled category INSERT did not atomically enqueue its obligation'; END IF;
  IF v_event.envelope->'data' IS DISTINCT FROM jsonb_build_object(
    'obligation_id', (SELECT id FROM public.storefront_cache_transition_obligations WHERE domain_event_id=v_event.domain_event_id)
  ) THEN RAISE EXCEPTION 'cache event envelope must carry only obligation_id'; END IF;
  SELECT count(*) INTO v_count FROM public.domain_event_ledger WHERE event_name='storefront.cache_transition.v1' AND subject_id=v_category::text;
  UPDATE public.categories SET name='Before' WHERE id=v_category;
  IF (SELECT count(*) FROM public.domain_event_ledger WHERE event_name='storefront.cache_transition.v1' AND subject_id=v_category::text) <> v_count THEN
    RAISE EXCEPTION 'no-op category UPDATE emitted a cache transition';
  END IF;
  UPDATE public.categories SET name='After' WHERE id=v_category;
  IF (SELECT generation FROM public.storefront_cache_transition_obligations WHERE domain_event_id=v_event.domain_event_id) <> 2 THEN
    RAISE EXCEPTION 'pre-claim update did not coalesce into the pending transition';
  END IF;
  UPDATE public.categories SET slug='after' WHERE id=v_category;
  IF NOT EXISTS (
    SELECT 1 FROM public.categories WHERE merchant_id=v_merchant AND slug='before' AND is_active=false
  ) OR NOT EXISTS (
    SELECT 1 FROM public.storefront_cache_transition_obligations AS obligation
    JOIN public.domain_event_ledger AS ledger ON ledger.domain_event_id=obligation.domain_event_id
    WHERE ledger.event_name='storefront.cache_transition.v1' AND obligation.payload->>'operation'='INSERT'
  ) THEN RAISE EXCEPTION 'rename did not retain and capture the lifecycle tombstone'; END IF;
  INSERT INTO public.categories(id,merchant_id,name,slug,parent_id,is_active)
  VALUES(v_child,v_merchant,'Child','child',v_category,true);
  UPDATE public.categories SET is_active=false WHERE id=v_category;
  IF (SELECT parent_id FROM public.categories WHERE id=v_child) IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.storefront_cache_transition_obligations WHERE category_id=v_child) THEN
    RAISE EXCEPTION 'deactivation did not capture child promotion final state';
  END IF;
  UPDATE public.categories SET is_active=true WHERE id=v_category;

  -- PostgreSQL executes same-timing triggers lexically, so capture observes lifecycle side effects.
  SELECT lifecycle.tgname < capture.tgname INTO v_ordered
  FROM pg_trigger AS lifecycle CROSS JOIN pg_trigger AS capture
  WHERE lifecycle.tgrelid='public.categories'::regclass AND capture.tgrelid='public.categories'::regclass
    AND lifecycle.tgname='categories_lifecycle_after_update'
    AND capture.tgname='zz_capture_category_cache_transition_v1';
  IF v_ordered IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'cache capture trigger must follow category lifecycle trigger lexically';
  END IF;

  IF NOT public.route_storefront_cache_transition_v1(v_event.queue_message_id,v_event.domain_event_id,'sql-cache-router') THEN
    RAISE EXCEPTION 'specialized route failed';
  END IF;
  SELECT * INTO v_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)
  WHERE domain_event_id=v_event.domain_event_id;
  IF v_claim.obligation_id IS NULL OR v_claim.generation <> 5 THEN
    RAISE EXCEPTION 'specialized claim did not materialize the current generation';
  END IF;
  BEGIN
    PERFORM public.finish_event_delivery_v1(v_claim.id,v_claim.claim_token,'delivered');
    RAISE EXCEPTION 'generic finisher unexpectedly settled a cache delivery';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  IF (SELECT status FROM public.event_deliveries WHERE id=v_claim.id) <> 'claimed'
    OR (SELECT status FROM public.storefront_cache_transition_obligations WHERE id=v_claim.obligation_id) <> 'claimed' THEN
    RAISE EXCEPTION 'generic finisher split cache delivery from obligation';
  END IF;
  UPDATE public.categories SET name='Claimed parent changed' WHERE id=v_category;
  SELECT ledger.domain_event_id, ledger.queue_message_id, obligation.id AS obligation_id,
    obligation.generation, obligation.payload
  INTO v_successor FROM public.storefront_cache_transition_obligations AS obligation
  JOIN public.domain_event_ledger AS ledger ON ledger.domain_event_id=obligation.domain_event_id
  WHERE obligation.successor_of=v_claim.obligation_id AND obligation.status='pending';
  -- The event is in normal PGMQ ingress; route it before exercising the delivery claim gate.
  IF v_successor.obligation_id IS NULL
    OR NOT public.route_storefront_cache_transition_v1(v_successor.queue_message_id,v_successor.domain_event_id,'sql-cache-router') THEN
    RAISE EXCEPTION 'post-claim update did not create and route a pending successor';
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)) THEN
    RAISE EXCEPTION 'successor was claimable before predecessor terminal settlement';
  END IF;
  BEGIN
    INSERT INTO public.storefront_cache_transition_obligations(
      domain_event_id,merchant_id,category_id,successor_of,payload
    ) VALUES((SELECT domain_event_id FROM public.storefront_cache_transition_obligations WHERE category_id=v_child LIMIT 1),v_merchant,v_category,v_claim.obligation_id,'{}'::jsonb);
    RAISE EXCEPTION 'second pending successor unexpectedly succeeded';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.storefront_cache_transition_obligations
    SET successor_of=v_successor.obligation_id WHERE id=v_claim.obligation_id;
    RAISE EXCEPTION 'successor cycle unexpectedly succeeded';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  SELECT public.finish_storefront_cache_transition_delivery_v1(
    v_claim.id,v_claim.claim_token,v_claim.obligation_id,v_claim.generation,
    '{"stage":"parent"}'::jsonb,'delivered',NULL,NULL,NULL,200
  ) INTO v_finished;
  IF v_finished IS DISTINCT FROM true THEN RAISE EXCEPTION 'parent terminal finish failed'; END IF;
  IF public.finish_storefront_cache_transition_delivery_v1(
    v_claim.id,v_claim.claim_token,v_claim.obligation_id,v_claim.generation,
    '{"stage":"stale"}'::jsonb,'delivered',NULL,NULL,NULL,200
  ) THEN RAISE EXCEPTION 'stale parent finish wrote after terminal settlement'; END IF;

  SELECT * INTO v_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)
  WHERE domain_event_id=v_successor.domain_event_id;
  IF v_claim.obligation_id IS DISTINCT FROM v_successor.obligation_id THEN
    RAISE EXCEPTION 'successor was not claimable after predecessor terminal settlement';
  END IF;
  IF public.finish_storefront_cache_transition_delivery_v1(
    v_claim.id,v_claim.claim_token,v_claim.obligation_id,v_claim.generation-1,
    '{"stage":"stale-generation"}'::jsonb,'delivered',NULL,NULL,NULL,200
  ) THEN RAISE EXCEPTION 'stale generation finish succeeded'; END IF;
  PERFORM public.finish_storefront_cache_transition_delivery_v1(
    v_claim.id,v_claim.claim_token,v_claim.obligation_id,v_claim.generation,
    '{"stage":"retry"}'::jsonb,'retry',now(), 'timeout','retry whole barrier',504
  );
  SELECT * INTO v_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)
  WHERE domain_event_id=v_successor.domain_event_id;
  v_stale_token := v_claim.claim_token;
  UPDATE public.event_deliveries SET claimed_at=now()-interval '2 minutes' WHERE id=v_claim.id;
  SELECT * INTO v_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker-reclaim',90,60)
  WHERE domain_event_id=v_successor.domain_event_id;
  IF v_claim.claim_token IS NULL OR v_claim.claim_token=v_stale_token
    OR (SELECT status FROM public.storefront_cache_transition_obligations WHERE id=v_claim.obligation_id) <> 'claimed' THEN
    RAISE EXCEPTION 'expired cache claim did not atomically reclaim its obligation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.event_delivery_attempts
    WHERE delivery_id=v_claim.id AND error_code='lease_expired') THEN
    RAISE EXCEPTION 'expired cache claim did not preserve lease audit parity';
  END IF;
  PERFORM public.finish_storefront_cache_transition_delivery_v1(
    v_claim.id,v_claim.claim_token,v_claim.obligation_id,v_claim.generation,
    '{"stage":"dead-letter"}'::jsonb,'dead_letter',NULL,'timeout','dead-letter barrier',504
  );
  IF (SELECT last_receipt FROM public.storefront_cache_transition_obligations WHERE id=v_claim.obligation_id)
      <> '{"stage":"dead-letter"}'::jsonb
    OR (SELECT payload ? 'last_receipt' FROM public.storefront_cache_transition_obligations WHERE id=v_claim.obligation_id) THEN
    RAISE EXCEPTION 'receipt must persist in its dedicated column and never enter payload';
  END IF;
  SELECT public.replay_event_deliveries_batch_v1(ARRAY[v_claim.id],v_actor,'Replay cache dead letter') INTO v_replayed;
  IF v_replayed <> 1
    OR (SELECT status FROM public.storefront_cache_transition_obligations WHERE id=v_claim.obligation_id) <> 'retry'
    OR NOT EXISTS (SELECT 1 FROM public.event_delivery_replays WHERE delivery_id=v_claim.id AND replay_number=1) THEN
    RAISE EXCEPTION 'batch replay did not atomically make cache work claimable with audit';
  END IF;
  SELECT * INTO v_replayed_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)
  WHERE id=v_claim.id;
  IF v_replayed_claim.claim_token IS NULL THEN RAISE EXCEPTION 'replayed cache dead letter was not claimable'; END IF;
  UPDATE public.event_deliveries
  SET status='delivery_unknown',claim_token=NULL,claimed_at=NULL,claimed_by=NULL
  WHERE id=v_replayed_claim.id;
  SELECT public.replay_event_delivery_v1(v_replayed_claim.id,v_actor,'Replay cache unknown delivery') INTO v_finished;
  IF v_finished IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'delivery_unknown replay did not reset its delivery';
  END IF;
  IF (SELECT status FROM public.storefront_cache_transition_obligations WHERE id=v_replayed_claim.obligation_id) <> 'retry' THEN
    RAISE EXCEPTION 'delivery_unknown replay did not reset its claimed cache obligation';
  END IF;
  SELECT * INTO v_replayed_claim FROM public.claim_storefront_cache_transition_deliveries_v1(1,'sql-cache-worker',90,60)
  WHERE id=v_claim.id;
  PERFORM public.finish_storefront_cache_transition_delivery_v1(
    v_replayed_claim.id,v_replayed_claim.claim_token,v_replayed_claim.obligation_id,v_replayed_claim.generation,
    '{"stage":"replayed-delivered"}'::jsonb,'delivered',NULL,NULL,NULL,200
  );

  IF NOT has_function_privilege('service_role','public.route_storefront_cache_transition_v1(bigint,uuid,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.route_storefront_cache_transition_v1(bigint,uuid,text)','EXECUTE')
    OR has_function_privilege('anon','private.route_domain_event_generic_v1(bigint,uuid,text[],boolean,text[])','EXECUTE')
    OR to_regprocedure('private.dead_letter_ingress_event_generic_v1(bigint,uuid,jsonb,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'cache wrappers or private generic aliases have incorrect ACLs';
  END IF;

  DELETE FROM public.categories WHERE id=v_category;
  IF NOT EXISTS (SELECT 1 FROM public.storefront_cache_transition_obligations WHERE category_id=v_category) THEN
    RAISE EXCEPTION 'DELETE did not emit a category cache transition';
  END IF;
END;
$$;
ROLLBACK;
