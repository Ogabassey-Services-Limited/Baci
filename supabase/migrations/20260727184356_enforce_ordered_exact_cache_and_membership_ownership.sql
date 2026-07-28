-- Keep broad targets claimable first so rollout-scale exact work cannot starve
-- the outer purge. Once an exact Next/Vercel purge succeeds, enqueue a later
-- broad purge; an already-claimed broad row is protected by generation fencing.
CREATE OR REPLACE FUNCTION public.finish_cache_invalidation(
  p_merchant_id uuid,
  p_target_kind text,
  p_target_id text,
  p_generation bigint,
  p_claim_token uuid,
  p_succeeded boolean,
  p_error_code text DEFAULT NULL,
  p_retry_after_seconds integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_updated_merchant_id uuid;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.cache_invalidation_outbox AS outbox
  SET status = CASE
        WHEN outbox.generation > p_generation THEN 'pending'
        WHEN p_succeeded THEN 'completed'
        WHEN outbox.attempts >= outbox.max_attempts THEN 'dead_letter'
        ELSE 'failed'
      END,
      attempts = CASE
        WHEN outbox.generation > p_generation OR p_succeeded THEN 0
        ELSE outbox.attempts
      END,
      next_attempt_at = CASE
        WHEN outbox.generation > p_generation THEN pg_catalog.now()
        WHEN p_succeeded OR outbox.attempts >= outbox.max_attempts
          THEN outbox.next_attempt_at
        ELSE pg_catalog.now() + pg_catalog.make_interval(
          secs => greatest(
            least(
              900,
              (15 * pg_catalog.power(
                2,
                greatest(outbox.attempts - 1, 0)
              ))::integer
            ),
            least(
              3600,
              greatest(
                coalesce(p_retry_after_seconds, 0),
                0
              )
            )
          )
        )
      END,
      last_error_code = CASE
        WHEN outbox.generation > p_generation OR p_succeeded THEN NULL
        WHEN coalesce(p_error_code, '') ~ '^[a-z0-9_]{1,100}$'
          THEN p_error_code
        ELSE 'unknown_failure'
      END,
      completed_generation = CASE
        WHEN p_succeeded THEN p_generation
        ELSE outbox.completed_generation
      END,
      completed_at = CASE
        WHEN p_succeeded THEN pg_catalog.now()
        ELSE outbox.completed_at
      END,
      claim_token = NULL,
      claimed_by = NULL,
      claimed_at = NULL,
      updated_at = pg_catalog.now()
  WHERE outbox.merchant_id = p_merchant_id
    AND outbox.target_kind = p_target_kind
    AND outbox.target_id = p_target_id
    AND outbox.status = 'claimed'
    AND outbox.claimed_generation = p_generation
    AND outbox.claim_token = p_claim_token
  RETURNING outbox.merchant_id INTO v_updated_merchant_id;

  IF v_updated_merchant_id IS NOT NULL
    AND p_succeeded
    AND p_target_kind = 'storefront_product'
  THEN
    PERFORM public.enqueue_storefront_cache_targets(v_updated_merchant_id);
  END IF;

  RETURN v_updated_merchant_id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.finish_cache_invalidation(
  uuid, text, text, bigint, uuid, boolean, text, integer
) FROM PUBLIC, anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.finish_cache_invalidation(
  uuid, text, text, bigint, uuid, boolean, text, integer
) TO service_role;

-- Parent owner changes and join-table writes must see one serial membership
-- boundary. This statement lock runs before PostgreSQL locks a parent row,
-- avoiding the product-first/category-first row-lock inversion in join writes.
CREATE FUNCTION public.lock_product_category_memberships_for_owner_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  LOCK TABLE public.product_categories IN SHARE ROW EXCLUSIVE MODE;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION
  public.lock_product_category_memberships_for_owner_reassignment()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.guard_product_category_owner_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.merchant_id IS NOT DISTINCT FROM NEW.merchant_id THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'products' AND EXISTS (
    SELECT 1
    FROM public.product_categories AS membership
    JOIN public.categories AS category ON category.id = membership.category_id
    WHERE membership.product_id = OLD.id
      AND category.merchant_id IS DISTINCT FROM NEW.merchant_id
  ) THEN
    RAISE EXCEPTION
      'product owner reassignment would create a cross-tenant category membership'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'categories' AND EXISTS (
    SELECT 1
    FROM public.product_categories AS membership
    JOIN public.products AS product ON product.id = membership.product_id
    WHERE membership.category_id = OLD.id
      AND product.merchant_id IS DISTINCT FROM NEW.merchant_id
  ) THEN
    RAISE EXCEPTION
      'category owner reassignment would create a cross-tenant product membership'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_product_category_owner_reassignment()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS products_lock_category_memberships_before_owner_update
  ON public.products;
CREATE TRIGGER products_lock_category_memberships_before_owner_update
BEFORE UPDATE OF merchant_id ON public.products
FOR EACH STATEMENT
EXECUTE FUNCTION
  public.lock_product_category_memberships_for_owner_reassignment();

DROP TRIGGER IF EXISTS products_guard_category_memberships_before_owner_update
  ON public.products;
CREATE TRIGGER products_guard_category_memberships_before_owner_update
BEFORE UPDATE OF merchant_id ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.guard_product_category_owner_reassignment();

DROP TRIGGER IF EXISTS categories_lock_product_memberships_before_owner_update
  ON public.categories;
CREATE TRIGGER categories_lock_product_memberships_before_owner_update
BEFORE UPDATE OF merchant_id ON public.categories
FOR EACH STATEMENT
EXECUTE FUNCTION
  public.lock_product_category_memberships_for_owner_reassignment();

DROP TRIGGER IF EXISTS categories_guard_product_memberships_before_owner_update
  ON public.categories;
CREATE TRIGGER categories_guard_product_memberships_before_owner_update
BEFORE UPDATE OF merchant_id ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.guard_product_category_owner_reassignment();
