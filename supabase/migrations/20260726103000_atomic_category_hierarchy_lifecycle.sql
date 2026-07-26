-- Keep category hierarchy and tombstone lifecycle changes atomic.
--
-- These triggers run as the authenticated caller (SECURITY INVOKER), so the
-- existing owner-only categories/products/product_categories/discount_codes
-- RLS policies remain the authority. The merchant-scoped advisory lock
-- serializes competing hierarchy writes without introducing a privileged
-- application client.

CREATE OR REPLACE FUNCTION private.enforce_category_hierarchy_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cycle_detected boolean := false;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(NEW.merchant_id::text, 0)
  );

  IF NEW.parent_id IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
       OR (
         NEW.is_active IS TRUE
         AND OLD.is_active IS DISTINCT FROM TRUE
       )
     )
  THEN
    PERFORM 1
    FROM public.categories AS parent
    WHERE parent.id = NEW.parent_id
      AND parent.merchant_id = NEW.merchant_id
      AND parent.is_active IS TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'CATEGORY_PARENT_INVALID';
    END IF;

    WITH RECURSIVE ancestors AS (
      SELECT
        category.id,
        category.parent_id,
        ARRAY[category.id]::uuid[] AS visited,
        1 AS depth,
        false AS existing_cycle
      FROM public.categories AS category
      WHERE category.id = NEW.parent_id
        AND category.merchant_id = NEW.merchant_id

      UNION ALL

      SELECT
        category.id,
        category.parent_id,
        ancestors.visited || category.id,
        ancestors.depth + 1,
        category.id = ANY(ancestors.visited)
      FROM ancestors
      JOIN public.categories AS category
        ON category.id = ancestors.parent_id
       AND category.merchant_id = NEW.merchant_id
      WHERE ancestors.depth < 32
        AND NOT ancestors.existing_cycle
    )
    SELECT EXISTS (
      SELECT 1
      FROM ancestors
      WHERE id = NEW.id
         OR existing_cycle
         OR (depth = 32 AND parent_id IS NOT NULL)
    )
    INTO v_cycle_detected;

    IF v_cycle_detected THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CATEGORY_PARENT_CYCLE';
    END IF;
  END IF;

  -- Reusing a retired row must not republish its former SEO copy or retain
  -- product memberships from its previous meaning.
  IF TG_OP = 'UPDATE'
     AND NEW.is_active IS TRUE
     AND OLD.is_active IS DISTINCT FROM TRUE
  THEN
    NEW.seo_heading := NULL;
    NEW.seo_description := NULL;
    NEW.seo_features := NULL;
    NEW.seo_faq := NULL;

    UPDATE public.products
    SET category_id = NULL
    WHERE category_id = NEW.id
      AND merchant_id = NEW.merchant_id;

    DELETE FROM public.product_categories
    WHERE category_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION private.apply_category_lifecycle_after_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  -- Preserve the old public path as an inactive tombstone. Without a row, the
  -- storefront's legacy text fallback can revive the renamed URL.
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    INSERT INTO public.categories (
      merchant_id,
      name,
      slug,
      description,
      parent_id,
      image_url,
      display_order,
      is_active,
      seo_heading,
      seo_description,
      seo_features,
      seo_faq,
      metadata,
      created_at,
      updated_at
    )
    VALUES (
      OLD.merchant_id,
      OLD.name,
      OLD.slug,
      NULL,
      NULL,
      NULL,
      0,
      false,
      NULL,
      NULL,
      NULL,
      NULL,
      '{}'::jsonb,
      pg_catalog.now(),
      COALESCE(NEW.updated_at, pg_catalog.now())
    )
    ON CONFLICT (merchant_id, slug) DO NOTHING;
  END IF;

  -- Promotion is part of the same statement transaction as retirement. Any
  -- failure rolls the parent update back instead of leaving active children
  -- hidden beneath an inactive parent.
  IF (OLD.is_active IS TRUE AND NEW.is_active IS DISTINCT FROM TRUE)
     OR (OLD.is_active IS NULL AND NEW.is_active IS FALSE)
  THEN
    UPDATE public.categories
    SET
      parent_id = NULL,
      updated_at = COALESCE(NEW.updated_at, pg_catalog.now())
    WHERE merchant_id = NEW.merchant_id
      AND parent_id = NEW.id;

    -- A retired category UUID must not remain a live discount target. Remove
    -- only this target so multi-category discounts keep working, and disable a
    -- discount when the removal leaves it with no category scope.
    UPDATE public.discount_codes
    SET
      category_ids = COALESCE(category_ids, '[]'::jsonb) - NEW.id::text,
      is_active = CASE
        WHEN pg_catalog.jsonb_array_length(
          COALESCE(category_ids, '[]'::jsonb) - NEW.id::text
        ) = 0 THEN false
        ELSE is_active
      END
    WHERE merchant_id = NEW.merchant_id
      AND applies_to = 'specific_categories'
      AND pg_catalog.jsonb_typeof(
        COALESCE(category_ids, '[]'::jsonb)
      ) = 'array'
      AND COALESCE(category_ids, '[]'::jsonb) ? NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS categories_hierarchy_before_write
  ON public.categories;
CREATE TRIGGER categories_hierarchy_before_write
BEFORE INSERT OR UPDATE OF parent_id, is_active
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION private.enforce_category_hierarchy_before_write();

DROP TRIGGER IF EXISTS categories_lifecycle_after_update
  ON public.categories;
CREATE TRIGGER categories_lifecycle_after_update
AFTER UPDATE OF slug, is_active
ON public.categories
FOR EACH ROW
EXECUTE FUNCTION private.apply_category_lifecycle_after_update();

REVOKE ALL ON FUNCTION private.enforce_category_hierarchy_before_write()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.apply_category_lifecycle_after_update()
  FROM PUBLIC, anon, authenticated;
