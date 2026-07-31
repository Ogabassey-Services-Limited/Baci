-- Runtime regression contract for 20260731190000_atomic_blog_post_product_links.sql.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f \
--   supabase/migrations/tests/atomic_blog_post_product_links.sql

BEGIN;

CREATE OR REPLACE FUNCTION public.test_atomic_blog_link_insert_failure()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'forced_blog_link_insert_failure';
END;
$$;

DO $test$
DECLARE
  v_merchant_id uuid := '01ac0000-0000-4000-8000-000000000001';
  v_other_merchant_id uuid := '01ac0000-0000-4000-8000-000000000002';
  v_owner_id uuid := '01ac0000-0000-4000-8000-000000000003';
  v_other_owner_id uuid := '01ac0000-0000-4000-8000-000000000004';
  v_staff_id uuid := '01ac0000-0000-4000-8000-000000000005';
  v_post_id uuid;
  v_other_post_id uuid := '01ac0000-0000-4000-8000-000000000006';
  v_product_ids uuid[];
  v_other_product_id uuid := '01ac0000-0000-4000-8000-000000000007';
  v_title text;
  v_link_count integer;
BEGIN
  IF has_function_privilege('anon',
      'public.mutate_merchant_blog_post_with_product_links(uuid,uuid,jsonb,uuid[])',
      'EXECUTE')
    OR has_function_privilege('service_role',
      'public.mutate_merchant_blog_post_with_product_links(uuid,uuid,jsonb,uuid[])',
      'EXECUTE')
    OR NOT has_function_privilege('authenticated',
      'public.mutate_merchant_blog_post_with_product_links(uuid,uuid,jsonb,uuid[])',
      'EXECUTE') THEN
    RAISE EXCEPTION 'atomic blog product-link RPC grants are incorrect';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
  VALUES
    (v_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'atomic-blog-owner@example.com', 'test', now(), now(), now(), '{}', '{}'),
    (v_other_owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'atomic-blog-other@example.com', 'test', now(), now(), now(), '{}', '{}'),
    (v_staff_id, '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', 'atomic-blog-staff@example.com', 'test', now(), now(), now(), '{}', '{}');
  ALTER TABLE public.merchants DISABLE TRIGGER USER;
  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES
    (v_merchant_id, v_owner_id, 'atomic-blog-merchant@example.com', 'Atomic Blog', 'atomic-blog'),
    (v_other_merchant_id, v_other_owner_id, 'atomic-blog-other-merchant@example.com', 'Other Atomic Blog', 'other-atomic-blog');
  ALTER TABLE public.merchants ENABLE TRIGGER USER;
  ALTER TABLE public.staff_members DISABLE TRIGGER USER;
  INSERT INTO public.staff_members (merchant_id, user_id, email, name, role, permissions, status)
  VALUES (v_merchant_id, v_staff_id, 'atomic-blog-staff@example.com', 'Atomic Staff',
    'sales_rep', '{"marketing":{"create":true}}', 'active');
  ALTER TABLE public.staff_members ENABLE TRIGGER USER;
  SELECT array_agg(gen_random_uuid()) INTO v_product_ids FROM generate_series(1, 21);
  ALTER TABLE public.products DISABLE TRIGGER USER;
  INSERT INTO public.products (id, merchant_id, name, price, manage_stock, status)
  SELECT id, v_merchant_id, 'Atomic product', 1, false, 'active'
  FROM unnest(v_product_ids) AS products(id);
  INSERT INTO public.products (id, merchant_id, name, price, manage_stock, status)
  VALUES (v_other_product_id, v_other_merchant_id, 'Foreign product', 1, false, 'active');
  ALTER TABLE public.products ENABLE TRIGGER USER;
  ALTER TABLE public.blog_posts DISABLE TRIGGER USER;
  INSERT INTO public.blog_posts (id, merchant_id, title, slug, content, author_name)
  VALUES (v_other_post_id, v_other_merchant_id, 'Foreign post', 'foreign-post', 'Foreign', 'Other owner');
  ALTER TABLE public.blog_posts ENABLE TRIGGER USER;

  SET LOCAL ROLE anon;
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      NULL, v_merchant_id, '{}'::jsonb, NULL);
    RAISE EXCEPTION 'anon unexpectedly executed atomic blog product-link RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  RESET ROLE;

  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  SET LOCAL ROLE authenticated;
  SELECT id INTO v_post_id FROM public.mutate_merchant_blog_post_with_product_links(
    NULL, v_merchant_id,
    jsonb_build_object('title', 'Initial', 'slug', 'atomic-post', 'content', 'Initial', 'author_name', 'Staff'),
    ARRAY[v_product_ids[1]]);
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      v_post_id, v_merchant_id, jsonb_build_object('title', 'Denied'), NULL);
    RAISE EXCEPTION 'create-only staff unexpectedly updated an atomic blog post';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'merchant_marketing_edit_permission_required' THEN RAISE; END IF;
  END;
  RESET ROLE;

  UPDATE public.staff_members SET permissions = '{"marketing":{"create":true,"edit":true}}'
  WHERE merchant_id = v_merchant_id AND user_id = v_staff_id;
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      v_other_post_id, v_merchant_id, jsonb_build_object('title', 'Cross tenant'), NULL);
    RAISE EXCEPTION 'staff updated a foreign merchant post';
  EXCEPTION WHEN no_data_found THEN
    IF SQLERRM <> 'blog_post_not_found' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      v_post_id, v_merchant_id, jsonb_build_object('title', 'Foreign product'), ARRAY[v_other_product_id]);
    RAISE EXCEPTION 'staff embedded a foreign merchant product';
  EXCEPTION WHEN no_data_found THEN
    IF SQLERRM <> 'embedded_product_not_found_or_not_owned' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      v_post_id, v_merchant_id, jsonb_build_object('title', 'Too many'), v_product_ids);
    RAISE EXCEPTION 'atomic blog product-link RPC accepted 21 products';
  EXCEPTION WHEN invalid_parameter_value THEN
    IF SQLERRM <> 'too_many_embedded_product_ids' THEN RAISE; END IF;
  END;
  PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
    v_post_id, v_merchant_id, jsonb_build_object('title', 'Preserved'), NULL);
  RESET ROLE;
  SELECT count(*) INTO v_link_count FROM public.blog_post_products WHERE blog_post_id = v_post_id;
  IF v_link_count <> 1 THEN RAISE EXCEPTION 'null embedded products did not preserve links'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
    v_post_id, v_merchant_id, jsonb_build_object('title', 'Cleared'), ARRAY[]::uuid[]);
  RESET ROLE;
  SELECT count(*) INTO v_link_count FROM public.blog_post_products WHERE blog_post_id = v_post_id;
  IF v_link_count <> 0 THEN RAISE EXCEPTION 'empty embedded products did not clear links'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  SET LOCAL ROLE authenticated;
  PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
    v_post_id, v_merchant_id, jsonb_build_object('title', 'Before rollback'), ARRAY[v_product_ids[1]]);
  RESET ROLE;
  EXECUTE 'CREATE TRIGGER test_atomic_blog_link_failure BEFORE INSERT ON public.blog_post_products FOR EACH ROW EXECUTE FUNCTION public.test_atomic_blog_link_insert_failure()';
  PERFORM set_config('request.jwt.claim.sub', v_staff_id::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN
    PERFORM id FROM public.mutate_merchant_blog_post_with_product_links(
      v_post_id, v_merchant_id, jsonb_build_object('title', 'Must rollback'), ARRAY[v_product_ids[1]]);
    RAISE EXCEPTION 'forced atomic link failure did not fail the RPC';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'forced_blog_link_insert_failure' THEN RAISE; END IF;
  END;
  RESET ROLE;
  SELECT title INTO v_title FROM public.blog_posts WHERE id = v_post_id;
  SELECT count(*) INTO v_link_count FROM public.blog_post_products WHERE blog_post_id = v_post_id;
  IF v_title <> 'Before rollback' OR v_link_count <> 1 THEN
    RAISE EXCEPTION 'atomic blog product-link RPC left a partial post or link mutation';
  END IF;
END;
$test$ LANGUAGE plpgsql;

ROLLBACK;
