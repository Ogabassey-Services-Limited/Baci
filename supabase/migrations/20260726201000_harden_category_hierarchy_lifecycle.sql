-- Close the remaining category lifecycle races without rewriting the earlier
-- migration. The trigger keeps using caller RLS and serializes only within one
-- merchant, so unrelated storefronts remain independent.

CREATE OR REPLACE FUNCTION private.enforce_category_hierarchy_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_cycle_detected boolean := false;
  v_consumed_category_id uuid;
  v_consumed_category_ids uuid[] := '{}'::uuid[];
  v_hierarchy_write boolean := false;
  v_reused_category_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_hierarchy_write := NEW.parent_id IS NOT NULL;
  ELSE
    v_hierarchy_write := NEW.is_active IS FALSE
      OR (
        NEW.parent_id IS NOT NULL
        AND (
          NEW.parent_id IS DISTINCT FROM OLD.parent_id
          OR (
            NEW.is_active IS TRUE
            AND OLD.is_active IS DISTINCT FROM TRUE
          )
        )
      );
  END IF;

  IF v_hierarchy_write THEN
    IF TG_OP = 'UPDATE' AND NEW.is_active IS FALSE THEN
      -- The row being retired is already locked before this row-level trigger
      -- runs. Lock its children before taking the merchant advisory lock so a
      -- concurrent child update can finish instead of forming this cycle:
      -- child row -> advisory lock -> parent transaction -> child row.
      PERFORM 1
      FROM public.categories AS retirement_child
      WHERE retirement_child.merchant_id = NEW.merchant_id
        AND retirement_child.parent_id = NEW.id
      ORDER BY retirement_child.id
      FOR UPDATE;
    END IF;

    -- Retirement, child attachment, and re-parenting share this lock. Whichever
    -- transaction runs second must validate against the first one's committed
    -- hierarchy instead of preserving an active child under a retired parent.
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.merchant_id::text, 0)
    );
  END IF;

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
    -- The public storefront exposes only explicitly active categories, so a
    -- proposed parent must be explicitly active and still be a root.
    PERFORM 1
    FROM public.categories AS parent
    WHERE parent.id = NEW.parent_id
      AND parent.merchant_id = NEW.merchant_id
      AND parent.is_active IS TRUE
      AND parent.parent_id IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'CATEGORY_PARENT_INVALID';
    END IF;

    -- Moving a branch below another root would create a third level. Ignore
    -- inactive or legacy NULL rows because they are not publicly visible.
    PERFORM 1
    FROM public.categories AS child
    WHERE child.merchant_id = NEW.merchant_id
      AND child.parent_id = NEW.id
      AND child.is_active IS TRUE
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'CATEGORY_DEPTH_EXCEEDED';
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

  -- A marked update is POST tombstone reuse even when the caller deliberately
  -- recreates the category inactive. Consume the marker and old relationships
  -- now so a later ordinary PATCH cannot delete relationships added afterward.
  IF TG_OP = 'UPDATE'
     AND COALESCE(NEW.metadata, '{}'::jsonb)
       @> '{"_baci_reused_tombstone": true}'::jsonb
  THEN
    NEW.seo_heading := NULL;
    NEW.seo_description := NULL;
    NEW.seo_features := NULL;
    NEW.seo_faq := NULL;

    v_consumed_category_ids := pg_catalog.array_append(
      v_consumed_category_ids,
      NEW.id
    );

    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
      - '_baci_reused_tombstone';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    SELECT id
    INTO v_reused_category_id
    FROM public.categories
    WHERE merchant_id = NEW.merchant_id
      AND slug = NEW.slug
      AND id IS DISTINCT FROM NEW.id
      AND is_active IS FALSE
    FOR UPDATE;

    IF v_reused_category_id IS NOT NULL THEN
      v_consumed_category_ids := pg_catalog.array_append(
        v_consumed_category_ids,
        v_reused_category_id
      );
    END IF;
  END IF;

  FOREACH v_consumed_category_id IN ARRAY v_consumed_category_ids
  LOOP
    UPDATE public.products
    SET
      category_id = NULL,
      category = NULL
    WHERE category_id = v_consumed_category_id
      AND merchant_id = NEW.merchant_id;

    DELETE FROM public.product_categories
    WHERE category_id = v_consumed_category_id;

    UPDATE public.categories
    SET
      parent_id = NULL,
      updated_at = pg_catalog.now()
    WHERE merchant_id = NEW.merchant_id
      AND parent_id = v_consumed_category_id;

    UPDATE public.discount_codes
    SET
      category_ids = COALESCE(category_ids, '[]'::jsonb)
        - v_consumed_category_id::text,
      is_active = CASE
        WHEN pg_catalog.jsonb_array_length(
          COALESCE(category_ids, '[]'::jsonb)
            - v_consumed_category_id::text
        ) = 0 THEN false
        ELSE is_active
      END
    WHERE merchant_id = NEW.merchant_id
      AND applies_to = 'specific_categories'
      AND pg_catalog.jsonb_typeof(
        COALESCE(category_ids, '[]'::jsonb)
      ) = 'array'
      AND COALESCE(category_ids, '[]'::jsonb)
        ? v_consumed_category_id::text;

    IF v_consumed_category_id IS DISTINCT FROM NEW.id THEN
      DELETE FROM public.categories
      WHERE id = v_consumed_category_id
        AND merchant_id = NEW.merchant_id;
    END IF;
  END LOOP;

  IF TG_OP = 'UPDATE' AND NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.products
    SET category = NEW.name
    WHERE category_id = NEW.id
      AND merchant_id = NEW.merchant_id;
  END IF;

  RETURN NEW;
END;
$$;

-- PostgreSQL executes same-kind triggers alphabetically. This trigger runs
-- after update_products_updated_at and restores freshness only when the legacy
-- category label is the sole business-field change. Category reassignment and
-- every other product edit still advance updated_at normally.
CREATE OR REPLACE FUNCTION private.preserve_product_category_label_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.category IS DISTINCT FROM OLD.category
     AND (
       pg_catalog.to_jsonb(NEW) - 'category' - 'updated_at'
     ) = (
       pg_catalog.to_jsonb(OLD) - 'category' - 'updated_at'
     )
  THEN
    NEW.updated_at := OLD.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_preserve_product_category_label_updated_at
  ON public.products;
CREATE TRIGGER zz_preserve_product_category_label_updated_at
BEFORE UPDATE OF category
ON public.products
FOR EACH ROW
EXECUTE FUNCTION private.preserve_product_category_label_updated_at();

REVOKE ALL ON FUNCTION private.enforce_category_hierarchy_before_write()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.preserve_product_category_label_updated_at()
  FROM PUBLIC, anon, authenticated;
