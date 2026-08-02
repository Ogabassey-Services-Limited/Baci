-- Parent tenant reassignment must not invalidate an existing product/category
-- edge, and must serialize behind concurrent membership writes before row lock.
BEGIN;
CREATE EXTENSION IF NOT EXISTS dblink;
SELECT set_config('request.jwt.claim.role', 'service_role', true);

DO $$
DECLARE
  v_first_merchant uuid := 'f1100000-0000-4000-8000-000000000001';
  v_second_merchant uuid := 'f1100000-0000-4000-8000-000000000002';
  v_product uuid := 'f1200000-0000-4000-8000-000000000001';
  v_category uuid := 'f1300000-0000-4000-8000-000000000001';
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug) VALUES
    (v_first_merchant, 'round7-owner-one@example.com', 'Round Seven Owner One',
      'round-seven-owner-one'),
    (v_second_merchant, 'round7-owner-two@example.com', 'Round Seven Owner Two',
      'round-seven-owner-two');
  INSERT INTO public.products (id, merchant_id, name, slug, status)
  VALUES (v_product, v_first_merchant, 'Owner Guard Product',
    'owner-guard-product', 'active');
  INSERT INTO public.categories (id, merchant_id, name, slug, is_active)
  VALUES (v_category, v_first_merchant, 'Owner Guard Category',
    'owner-guard-category', true);
  INSERT INTO public.product_categories (product_id, category_id)
  VALUES (v_product, v_category);

  BEGIN
    UPDATE public.products
    SET merchant_id = v_second_merchant
    WHERE id = v_product;
    RAISE EXCEPTION
      'product owner reassignment must reject existing cross-tenant memberships';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    UPDATE public.categories
    SET merchant_id = v_second_merchant
    WHERE id = v_category;
    RAISE EXCEPTION
      'category owner reassignment must reject existing cross-tenant memberships';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  PERFORM public.dblink_connect(
    'round7_membership_writer',
    'host=/var/run/postgresql dbname=postgres user=postgres'
  );
  PERFORM public.dblink_exec('round7_membership_writer', 'BEGIN');
  PERFORM public.dblink_exec(
    'round7_membership_writer',
    'LOCK TABLE public.product_categories IN ROW EXCLUSIVE MODE'
  );
  PERFORM set_config('lock_timeout', '100ms', true);

  BEGIN
    UPDATE public.products
    SET merchant_id = v_second_merchant
    WHERE id = v_product;
    RAISE EXCEPTION
      'product owner reassignment must wait for concurrent membership writes';
  EXCEPTION
    WHEN lock_not_available THEN NULL;
  END;

  BEGIN
    UPDATE public.categories
    SET merchant_id = v_second_merchant
    WHERE id = v_category;
    RAISE EXCEPTION
      'category owner reassignment must wait for concurrent membership writes';
  EXCEPTION
    WHEN lock_not_available THEN NULL;
  END;

  PERFORM set_config('lock_timeout', '0', true);
  PERFORM public.dblink_exec('round7_membership_writer', 'ROLLBACK');
  PERFORM public.dblink_disconnect('round7_membership_writer');
END;
$$;

ROLLBACK;
