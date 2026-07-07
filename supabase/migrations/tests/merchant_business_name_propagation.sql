-- =============================================
-- REGRESSION TEST: merchant business_name normalization + propagation
--   Validates 20260706120000_normalize_and_propagate_merchant_business_name.sql
--
-- USAGE:
--   psql $DATABASE_URL -f supabase/migrations/tests/merchant_business_name_propagation.sql
--   (or via Supabase MCP execute_sql). Mutates inside a transaction and ROLLBACKs.
--
-- Proves:
--   1. Whitespace on business_name is trimmed/collapsed on write.
--   2. A name change propagates into page_configs (draft + published):
--        Header.storeName and HeroCarousel "Welcome to <name>" slide titles.
--   3. A customized store name (storeName <> old business_name) is left untouched.
--   4. Functions + triggers exist and grant no EXECUTE to PUBLIC/anon/authenticated.
-- =============================================

BEGIN;

DO $test$
DECLARE
  v_mid    uuid := '8f0ed783-0000-4000-8000-000000000401';
  v_mid2   uuid := '8f0ed783-0000-4000-8000-000000000402';
  v_name   text;
  v_store  text;
  v_hero   text;
  v_pub    text;
  insecure text;
  missing  text;
  base_cfg jsonb;
  custom_cfg jsonb;
  v_mid3   uuid := '8f0ed783-0000-4000-8000-000000000403';
  v_content_less jsonb;
  v_after  jsonb;
  v_updated timestamptz;
BEGIN
  -- ---------- object existence ----------
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.normalize_merchant_business_name()'::regprocedure) THEN
    RAISE EXCEPTION 'normalize_merchant_business_name() missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.propagate_merchant_business_name()'::regprocedure) THEN
    RAISE EXCEPTION 'propagate_merchant_business_name() missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.rewrite_config_business_name(jsonb,text,text)'::regprocedure) THEN
    RAISE EXCEPTION 'rewrite_config_business_name() missing';
  END IF;

  FOR missing IN
    SELECT t FROM (VALUES
      ('aa_normalize_merchant_business_name'),
      ('propagate_merchant_business_name')
    ) AS x(t)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = x.t AND tgrelid = 'public.merchants'::regclass AND NOT tgisinternal
    )
  LOOP
    RAISE EXCEPTION 'trigger missing: %', missing;
  END LOOP;

  -- ---------- trigger helpers must not be publicly executable ----------
  SELECT f INTO insecure FROM (VALUES
    ('public.normalize_merchant_business_name()'),
    ('public.propagate_merchant_business_name()'),
    ('public.rewrite_config_business_name(jsonb,text,text)')
  ) AS x(f)
  WHERE has_function_privilege('PUBLIC', x.f, 'EXECUTE')
     OR has_function_privilege('anon', x.f, 'EXECUTE')
     OR has_function_privilege('authenticated', x.f, 'EXECUTE')
  LIMIT 1;
  IF insecure IS NOT NULL THEN
    RAISE EXCEPTION 'trigger helper % must not grant EXECUTE to PUBLIC/anon/authenticated', insecure;
  END IF;

  base_cfg := jsonb_build_object(
    'root', jsonb_build_object('props', jsonb_build_object('title', 'Home')),
    'content', jsonb_build_array(
      jsonb_build_object('type', 'Header',
        'props', jsonb_build_object('storeName', 'Yodhashop', 'showSearch', true)),
      jsonb_build_object('type', 'HeroCarousel',
        'props', jsonb_build_object('slides', jsonb_build_array(
          jsonb_build_object('title', 'Welcome to Yodhashop', 'subtitle', 'Keep me'),
          jsonb_build_object('title', 'New Arrivals', 'subtitle', 'Keep me too')
        )))
    )
  );

  -- ================= TEST 1: whitespace normalization =================
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_mid, 'name-prop@example.com', '  Yodha   shop  ', 'name-prop-fixture');

  SELECT business_name INTO v_name FROM public.merchants WHERE id = v_mid;
  IF v_name <> 'Yodha shop' THEN
    RAISE EXCEPTION 'normalization failed on INSERT: got "%%" (expected "Yodha shop")', v_name;
  END IF;

  -- Reset to the baked name and attach a config for the propagation tests.
  UPDATE public.merchants SET business_name = 'Yodhashop' WHERE id = v_mid;
  INSERT INTO public.page_configs (merchant_id, page_slug, page_name, draft_config, published_config, is_published, updated_at)
  VALUES (v_mid, 'home', 'Home', base_cfg, base_cfg, true, TIMESTAMPTZ '2020-01-01T00:00:00Z');

  -- ================= TEST 2: propagation on rename =================
  UPDATE public.merchants SET business_name = '  Zorvexa  ' WHERE id = v_mid;  -- also exercises trim

  SELECT business_name INTO v_name FROM public.merchants WHERE id = v_mid;
  IF v_name <> 'Zorvexa' THEN
    RAISE EXCEPTION 'normalization failed on UPDATE: got "%%"', v_name;
  END IF;

  SELECT
    (SELECT e->'props'->>'storeName' FROM jsonb_array_elements(draft_config->'content') e WHERE e->>'type'='Header'),
    (SELECT s->>'title' FROM jsonb_array_elements(draft_config->'content') e, jsonb_array_elements(e->'props'->'slides') s WHERE e->>'type'='HeroCarousel' LIMIT 1),
    (SELECT e->'props'->>'storeName' FROM jsonb_array_elements(published_config->'content') e WHERE e->>'type'='Header')
  INTO v_store, v_hero, v_pub
  FROM public.page_configs WHERE merchant_id = v_mid AND page_slug = 'home';

  IF v_store <> 'Zorvexa' THEN
    RAISE EXCEPTION 'draft Header.storeName not propagated: got "%%"', v_store;
  END IF;
  IF v_hero <> 'Welcome to Zorvexa' THEN
    RAISE EXCEPTION 'draft hero title not propagated: got "%%"', v_hero;
  END IF;
  IF v_pub <> 'Zorvexa' THEN
    RAISE EXCEPTION 'published Header.storeName not propagated: got "%%"', v_pub;
  END IF;

  -- The second slide title (not "Welcome to <name>") must be preserved.
  IF NOT EXISTS (
    SELECT 1 FROM public.page_configs,
      LATERAL jsonb_array_elements(draft_config->'content') e,
      LATERAL jsonb_array_elements(e->'props'->'slides') s
    WHERE merchant_id = v_mid AND e->>'type'='HeroCarousel' AND s->>'title' = 'New Arrivals'
  ) THEN
    RAISE EXCEPTION 'non-name slide title was clobbered';
  END IF;

  -- The propagation must bump updated_at (the builder's optimistic-concurrency
  -- token) so a stale builder save cannot silently overwrite the rewrite.
  SELECT updated_at INTO v_updated
  FROM public.page_configs WHERE merchant_id = v_mid AND page_slug = 'home';
  IF v_updated <= TIMESTAMPTZ '2021-01-01T00:00:00Z' THEN
    RAISE EXCEPTION 'propagation did not bump page_configs.updated_at (still %%)', v_updated;
  END IF;

  -- ================= TEST 3: customized store name is preserved =================
  custom_cfg := jsonb_set(base_cfg, '{content,0,props,storeName}', to_jsonb('My Custom Brand'::text));
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_mid2, 'name-prop2@example.com', 'Yodhashop', 'name-prop-fixture-2');
  INSERT INTO public.page_configs (merchant_id, page_slug, page_name, draft_config, published_config, is_published)
  VALUES (v_mid2, 'home', 'Home', custom_cfg, custom_cfg, true);

  UPDATE public.merchants SET business_name = 'Zorvexa' WHERE id = v_mid2;

  SELECT (SELECT e->'props'->>'storeName' FROM jsonb_array_elements(draft_config->'content') e WHERE e->>'type'='Header')
  INTO v_store FROM public.page_configs WHERE merchant_id = v_mid2 AND page_slug = 'home';

  IF v_store <> 'My Custom Brand' THEN
    RAISE EXCEPTION 'customized storeName must NOT change on rename: got "%%"', v_store;
  END IF;

  -- ================= TEST 4: a content-less config survives a rename unchanged =================
  -- Regression for the NULL-wipe bug: a page config with no top-level `content`
  -- array must be left exactly as-is, never wiped to NULL by a strict jsonb_set.
  v_content_less := jsonb_build_object(
    'root', jsonb_build_object('props', jsonb_build_object('title', 'Home'))
  );
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (v_mid3, 'name-prop3@example.com', 'Yodhashop', 'name-prop-fixture-3');
  INSERT INTO public.page_configs (merchant_id, page_slug, page_name, draft_config, published_config, is_published)
  VALUES (v_mid3, 'home', 'Home', v_content_less, v_content_less, true);

  UPDATE public.merchants SET business_name = 'Zorvexa' WHERE id = v_mid3;

  SELECT draft_config INTO v_after
  FROM public.page_configs WHERE merchant_id = v_mid3 AND page_slug = 'home';
  IF v_after IS NULL THEN
    RAISE EXCEPTION 'content-less draft_config was wiped to NULL on rename';
  END IF;
  IF v_after IS DISTINCT FROM v_content_less THEN
    RAISE EXCEPTION 'content-less draft_config was altered on rename: %%', v_after;
  END IF;

  RAISE NOTICE 'merchant_business_name_propagation: ALL ASSERTIONS PASSED';
END;
$test$;

ROLLBACK;
