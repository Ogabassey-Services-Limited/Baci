-- Canonical category cache-transition producer and isolated delivery lane.
INSERT INTO public.domain_event_producer_config (producer_key, enabled, shadow_only) VALUES ('storefront.cache_transition', false, false) ON CONFLICT (producer_key) DO NOTHING;
CREATE TABLE public.storefront_cache_transition_canaries (
  merchant_id uuid PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.storefront_cache_transition_obligations (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  domain_event_id uuid NOT NULL UNIQUE REFERENCES public.domain_event_ledger(domain_event_id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL,
  successor_of uuid REFERENCES public.storefront_cache_transition_obligations(id) ON DELETE RESTRICT,
  generation bigint NOT NULL DEFAULT 1 CHECK (generation > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'retry', 'delivered', 'dead_letter', 'skipped')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536),
  last_receipt jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT storefront_cache_transition_no_self_successor CHECK (successor_of IS NULL OR successor_of <> id)
);
CREATE UNIQUE INDEX storefront_cache_transition_one_pending_tail ON public.storefront_cache_transition_obligations (merchant_id, category_id) WHERE status = 'pending';
CREATE UNIQUE INDEX storefront_cache_transition_one_pending_successor ON public.storefront_cache_transition_obligations (successor_of) WHERE status = 'pending';
CREATE OR REPLACE FUNCTION private.prevent_storefront_cache_transition_successor_cycle_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.successor_of IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    WITH RECURSIVE ancestry(id, successor_of, path) AS (
      SELECT obligation.id, obligation.successor_of, ARRAY[obligation.id]
      FROM public.storefront_cache_transition_obligations AS obligation
      WHERE obligation.id = NEW.successor_of
      UNION ALL
      SELECT parent.id, parent.successor_of, ancestry.path || parent.id
      FROM public.storefront_cache_transition_obligations AS parent
      JOIN ancestry ON parent.id = ancestry.successor_of
      WHERE NOT parent.id = ANY(ancestry.path)
    )
    SELECT 1 FROM ancestry WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'storefront_cache_transition_successor_cycle' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER storefront_cache_transition_reject_successor_cycle
BEFORE INSERT OR UPDATE OF successor_of ON public.storefront_cache_transition_obligations
FOR EACH ROW EXECUTE FUNCTION private.prevent_storefront_cache_transition_successor_cycle_v1();
ALTER TABLE public.storefront_cache_transition_canaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_cache_transition_canaries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_cache_transition_obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.storefront_cache_transition_obligations FORCE ROW LEVEL SECURITY;
CREATE POLICY storefront_cache_transition_canaries_service_role_only
  ON public.storefront_cache_transition_canaries FOR ALL TO PUBLIC
  USING (COALESCE((SELECT auth.role()), '') = 'service_role')
  WITH CHECK (COALESCE((SELECT auth.role()), '') = 'service_role');
CREATE POLICY storefront_cache_transition_obligations_service_role_only
  ON public.storefront_cache_transition_obligations FOR ALL TO PUBLIC
  USING (COALESCE((SELECT auth.role()), '') = 'service_role')
  WITH CHECK (COALESCE((SELECT auth.role()), '') = 'service_role');
REVOKE ALL ON TABLE public.storefront_cache_transition_canaries,
  public.storefront_cache_transition_obligations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.storefront_cache_transition_canaries,
  public.storefront_cache_transition_obligations TO service_role;
ALTER TABLE public.event_deliveries DROP CONSTRAINT event_deliveries_destination_check;
ALTER TABLE public.event_deliveries ADD CONSTRAINT event_deliveries_destination_check CHECK (destination IN ('facebook', 'tiktok', 'snapchat', 'ga4', 'storefront_cache_transition'));
CREATE OR REPLACE FUNCTION private.ensure_storefront_cache_transition_from_category_row_v1(
  p_operation text, p_old_id uuid, p_old_merchant_id uuid, p_old_slug text, p_old_name text, p_old_is_active boolean, p_old_parent_id uuid,
  p_new_id uuid, p_new_merchant_id uuid, p_new_slug text, p_new_name text, p_new_is_active boolean, p_new_parent_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s' AS $$
DECLARE v_category_id uuid := COALESCE(p_new_id, p_old_id); v_merchant_id uuid := COALESCE(p_new_merchant_id, p_old_merchant_id);
  v_payload jsonb; v_pending public.storefront_cache_transition_obligations%ROWTYPE; v_enqueued record;
  v_obligation_id uuid := extensions.gen_random_uuid(); v_root_id uuid; v_predecessor_id uuid; v_cycle boolean;
BEGIN
  IF p_operation NOT IN ('INSERT', 'UPDATE', 'DELETE') OR v_category_id IS NULL OR v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_storefront_cache_transition_snapshot' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_merchant_id::text || ':' || v_category_id::text, 0));
  v_payload := jsonb_strip_nulls(jsonb_build_object(
    'schema_version', 1, 'operation', p_operation, 'merchant_id', v_merchant_id,
    'category_id', v_category_id, 'previous_slug', p_old_slug, 'next_slug', p_new_slug,
    'previous_name', p_old_name, 'next_name', p_new_name,
    'previous_is_active', p_old_is_active, 'next_is_active', p_new_is_active,
    'previous_parent_id', p_old_parent_id, 'next_parent_id', p_new_parent_id,
    'related_slugs', to_jsonb(ARRAY(SELECT DISTINCT slug FROM unnest(ARRAY[p_old_slug, p_new_slug]) AS slug WHERE slug IS NOT NULL))
  ));
  -- Serialize the chain root as well as the semantic key. This keeps a claimed
  -- predecessor plus exactly one pending successor under concurrent category DML.
  SELECT id INTO v_root_id FROM public.storefront_cache_transition_obligations
  WHERE merchant_id = v_merchant_id AND category_id = v_category_id
  ORDER BY created_at ASC LIMIT 1 FOR UPDATE;
  SELECT * INTO v_pending FROM public.storefront_cache_transition_obligations
  WHERE merchant_id = v_merchant_id AND category_id = v_category_id AND status = 'pending'
  ORDER BY created_at DESC FOR UPDATE;
  IF FOUND THEN
    UPDATE public.storefront_cache_transition_obligations
    SET generation = v_pending.generation + 1, payload = v_payload, updated_at = now()
    WHERE id = v_pending.id;
    RETURN v_pending.id;
  END IF;
  SELECT id INTO v_predecessor_id FROM public.storefront_cache_transition_obligations
  WHERE merchant_id = v_merchant_id AND category_id = v_category_id
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF v_predecessor_id IS NOT NULL THEN
    WITH RECURSIVE ancestry(id, successor_of, path) AS (
      SELECT obligation.id, obligation.successor_of, ARRAY[obligation.id]
      FROM public.storefront_cache_transition_obligations AS obligation
      WHERE obligation.id = v_predecessor_id
      UNION ALL
      SELECT parent.id, parent.successor_of, ancestry.path || parent.id
      FROM public.storefront_cache_transition_obligations AS parent
      JOIN ancestry ON parent.id = ancestry.successor_of
      WHERE NOT parent.id = ANY(ancestry.path)
    )
    SELECT EXISTS(SELECT 1 FROM ancestry WHERE id = v_obligation_id) INTO v_cycle;
    IF v_cycle THEN
      RAISE EXCEPTION 'storefront_cache_transition_successor_cycle' USING ERRCODE = '23514';
    END IF;
  END IF;
  SELECT * INTO v_enqueued FROM eventing.enqueue_domain_event_v1(
    'database', 'database', format('storefront.cache_transition.v1:%s:%s:%s', v_category_id, pg_current_xact_id(), md5(v_payload::text)),
    NULL, 'storefront.cache_transition.v1', 'category', v_category_id::text, v_merchant_id,
    jsonb_build_object('schema', 'public', 'table', 'categories', 'operation', p_operation),
    jsonb_build_object('obligation_id', v_obligation_id),
    jsonb_build_object('environment', 'database', 'shadow_only', false), now(),
    ARRAY['slug', 'name', 'is_active', 'parent_id']::text[], NULL, NULL
  );
  INSERT INTO public.storefront_cache_transition_obligations(id, domain_event_id, merchant_id, category_id, successor_of, payload)
  VALUES (v_obligation_id, v_enqueued.domain_event_id, v_merchant_id, v_category_id,
    v_predecessor_id, v_payload);
  RETURN v_obligation_id;
END;
$$;
CREATE OR REPLACE FUNCTION eventing.capture_category_cache_transition_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' SET statement_timeout = '5s'
AS $$
DECLARE v_enabled boolean;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.slug IS NOT DISTINCT FROM OLD.slug AND NEW.name IS NOT DISTINCT FROM OLD.name
     AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active AND NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id
     AND NEW.merchant_id IS NOT DISTINCT FROM OLD.merchant_id THEN RETURN NEW; END IF;
  SELECT config.enabled INTO v_enabled FROM public.domain_event_producer_config AS config
  WHERE config.producer_key = 'storefront.cache_transition';
  IF NOT COALESCE(v_enabled, false) OR NOT EXISTS (
    SELECT 1 FROM public.storefront_cache_transition_canaries AS canary
    WHERE canary.merchant_id = CASE WHEN TG_OP = 'DELETE' THEN OLD.merchant_id ELSE NEW.merchant_id END AND canary.enabled
  ) THEN IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM private.ensure_storefront_cache_transition_from_category_row_v1(TG_OP, OLD.id, OLD.merchant_id, OLD.slug, OLD.name, OLD.is_active, OLD.parent_id, NULL, NULL, NULL, NULL, NULL, NULL);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    PERFORM private.ensure_storefront_cache_transition_from_category_row_v1(TG_OP, OLD.id, OLD.merchant_id, OLD.slug, OLD.name, OLD.is_active, OLD.parent_id, NEW.id, NEW.merchant_id, NEW.slug, NEW.name, NEW.is_active, NEW.parent_id);
  ELSE
    PERFORM private.ensure_storefront_cache_transition_from_category_row_v1(TG_OP, NULL, NULL, NULL, NULL, NULL, NULL, NEW.id, NEW.merchant_id, NEW.slug, NEW.name, NEW.is_active, NEW.parent_id);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS zz_capture_category_cache_transition_v1 ON public.categories;
CREATE TRIGGER zz_capture_category_cache_transition_v1 AFTER INSERT OR UPDATE OR DELETE ON public.categories FOR EACH ROW EXECUTE FUNCTION eventing.capture_category_cache_transition_v1();
