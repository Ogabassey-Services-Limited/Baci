-- Formalize sku_matrix products, keep legacy parent fields projected from the
-- default variant, and block product_offers from becoming a competing truth
-- source for migrated products.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS variant_model TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS migration_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS default_variant_id UUID,
  ADD COLUMN IF NOT EXISTS available_conditions TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS min_variant_price NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS max_variant_price NUMERIC(10, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_variant_model_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_variant_model_check
      CHECK (variant_model IN ('legacy', 'sku_matrix'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_migration_status_check'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_migration_status_check
      CHECK (migration_status IN ('pending', 'needs_review', 'migrated'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_default_variant_id_fkey'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_default_variant_id_fkey
      FOREIGN KEY (default_variant_id)
      REFERENCES public.product_variants(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_products_variant_model
  ON public.products(variant_model);

CREATE INDEX IF NOT EXISTS idx_products_default_variant_id
  ON public.products(default_variant_id);

CREATE INDEX IF NOT EXISTS idx_products_available_conditions
  ON public.products USING GIN (available_conditions);

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS variant_key TEXT;

CREATE OR REPLACE FUNCTION public.normalize_variant_axis_value(p_value TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT NULLIF(
    lower(regexp_replace(trim(COALESCE(p_value, '')), '[\s-]+', '_', 'g')),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.build_product_variant_key(
  p_condition TEXT,
  p_attributes JSONB
)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'condition',
    public.normalize_variant_axis_value(p_condition),
    'attributes',
    COALESCE(
      (
        SELECT jsonb_object_agg(
                 lower(attrs.key),
                 lower(regexp_replace(trim(attrs.value), '\s+', ' ', 'g'))
                 ORDER BY lower(attrs.key)
               )
        FROM jsonb_each_text(COALESCE(p_attributes, '{}'::jsonb)) AS attrs(key, value)
        WHERE trim(attrs.value) <> ''
      ),
      '{}'::jsonb
    )
  )::TEXT;
$$;

UPDATE public.product_variants AS pv
SET variant_key = public.build_product_variant_key(pv.condition, pv.attributes)
WHERE pv.variant_key IS DISTINCT FROM public.build_product_variant_key(
  pv.condition,
  pv.attributes
);

CREATE OR REPLACE FUNCTION public.set_product_variant_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.variant_key := public.build_product_variant_key(
    NEW.condition,
    NEW.attributes
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_product_variant_key ON public.product_variants;
CREATE TRIGGER set_product_variant_key
  BEFORE INSERT OR UPDATE OF condition, attributes
  ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_product_variant_key();

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_product_id_variant_key
  ON public.product_variants(product_id, variant_key);

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_product_projection(
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_default_variant public.product_variants%ROWTYPE;
  v_available_conditions TEXT[];
  v_min_variant_price NUMERIC(10, 2);
  v_max_variant_price NUMERIC(10, 2);
BEGIN
  IF p_product_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_product_id::TEXT, 0)
  );

  SELECT *
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_product.variant_model <> 'sku_matrix' THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        available_conditions = '{}'::TEXT[],
        min_variant_price = NULL,
        max_variant_price = NULL
    WHERE id = p_product_id;
    RETURN;
  END IF;

  SELECT ARRAY_AGG(condition_value ORDER BY condition_rank, condition_value)
  INTO v_available_conditions
  FROM (
    SELECT DISTINCT
      public.normalize_variant_axis_value(
        COALESCE(pv.condition, v_product.condition, 'new')
      ) AS condition_value,
      CASE public.normalize_variant_axis_value(
        COALESCE(pv.condition, v_product.condition, 'new')
      )
        WHEN 'new' THEN 1
        WHEN 'open_box' THEN 2
        WHEN 'refurbished' THEN 3
        WHEN 'used' THEN 4
        ELSE 5
      END AS condition_rank
    FROM public.product_variants AS pv
    WHERE pv.product_id = p_product_id
  ) AS condition_rows
  WHERE condition_value IS NOT NULL;

  SELECT
    MIN(COALESCE(pv.price_override, v_product.price)),
    MAX(COALESCE(pv.price_override, v_product.price))
  INTO v_min_variant_price, v_max_variant_price
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id;

  SELECT pv.*
  INTO v_default_variant
  FROM public.product_variants AS pv
  WHERE pv.product_id = p_product_id
  ORDER BY
    CASE
      WHEN COALESCE(v_product.manage_stock, TRUE) = FALSE THEN 0
      WHEN COALESCE(pv.stock_quantity, 0) > 0 THEN 0
      ELSE 1
    END,
    CASE public.normalize_variant_axis_value(
      COALESCE(pv.condition, v_product.condition, 'new')
    )
      WHEN 'new' THEN 1
      WHEN 'open_box' THEN 2
      WHEN 'refurbished' THEN 3
      WHEN 'used' THEN 4
      ELSE 5
    END,
    COALESCE(pv.price_override, v_product.price),
    pv.created_at,
    pv.id
  LIMIT 1;

  IF v_default_variant.id IS NULL THEN
    UPDATE public.products
    SET default_variant_id = NULL,
        has_condition_offers = FALSE,
        available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
        min_variant_price = v_min_variant_price,
        max_variant_price = v_max_variant_price
    WHERE id = p_product_id;
    RETURN;
  END IF;

  UPDATE public.products
  SET default_variant_id = v_default_variant.id,
      price = COALESCE(v_default_variant.price_override, v_product.price),
      stock_quantity = COALESCE(v_default_variant.stock_quantity, v_product.stock_quantity),
      stock = COALESCE(v_default_variant.stock_quantity, v_product.stock),
      condition = COALESCE(
        public.normalize_variant_axis_value(v_default_variant.condition),
        public.normalize_variant_axis_value(v_product.condition),
        'new'
      ),
      has_condition_offers = FALSE,
      available_conditions = COALESCE(v_available_conditions, '{}'::TEXT[]),
      min_variant_price = v_min_variant_price,
      max_variant_price = v_max_variant_price
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_products(
  p_product_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  FOREACH v_product_id IN ARRAY p_product_ids LOOP
    IF v_product_id IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM public.rebuild_sku_matrix_product_projection(v_product_id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_products_after_variant_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM inserted_rows
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_products_after_variant_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM (
        SELECT product_id FROM inserted_rows
        UNION
        SELECT product_id FROM deleted_rows
      ) AS touched
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_products_after_variant_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT DISTINCT product_id
      FROM deleted_rows
      WHERE product_id IS NOT NULL
    )
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS rebuild_sku_matrix_products_after_variant_insert
  ON public.product_variants;
CREATE TRIGGER rebuild_sku_matrix_products_after_variant_insert
  AFTER INSERT ON public.product_variants
  REFERENCING NEW TABLE AS inserted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.rebuild_sku_matrix_products_after_variant_insert();

DROP TRIGGER IF EXISTS rebuild_sku_matrix_products_after_variant_update
  ON public.product_variants;
CREATE TRIGGER rebuild_sku_matrix_products_after_variant_update
  AFTER UPDATE ON public.product_variants
  REFERENCING NEW TABLE AS inserted_rows OLD TABLE AS deleted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.rebuild_sku_matrix_products_after_variant_update();

DROP TRIGGER IF EXISTS rebuild_sku_matrix_products_after_variant_delete
  ON public.product_variants;
CREATE TRIGGER rebuild_sku_matrix_products_after_variant_delete
  AFTER DELETE ON public.product_variants
  REFERENCING OLD TABLE AS deleted_rows
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.rebuild_sku_matrix_products_after_variant_delete();

CREATE OR REPLACE FUNCTION public.rebuild_sku_matrix_product_after_product_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM public.rebuild_sku_matrix_product_projection(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rebuild_sku_matrix_product_after_product_update
  ON public.products;
CREATE TRIGGER rebuild_sku_matrix_product_after_product_update
  AFTER UPDATE OF variant_model, manage_stock
  ON public.products
  FOR EACH ROW
  WHEN (NEW.variant_model = 'sku_matrix' OR OLD.variant_model = 'sku_matrix')
  EXECUTE FUNCTION public.rebuild_sku_matrix_product_after_product_update();

CREATE OR REPLACE FUNCTION public.prevent_sku_matrix_product_offer_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.variant_model = 'sku_matrix'
     AND COALESCE(OLD.variant_model, 'legacy') <> 'sku_matrix'
     AND EXISTS (
       SELECT 1
       FROM public.product_offers AS po
       WHERE po.product_id = NEW.id
     ) THEN
    RAISE EXCEPTION
      USING ERRCODE = 'check_violation',
            MESSAGE = 'sku_matrix products cannot be enabled while product_offers rows still exist';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_sku_matrix_product_offer_overlap
  ON public.products;
CREATE TRIGGER prevent_sku_matrix_product_offer_overlap
  BEFORE UPDATE OF variant_model
  ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_sku_matrix_product_offer_overlap();

CREATE OR REPLACE FUNCTION public.block_product_offers_for_sku_matrix()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_variant_model TEXT;
BEGIN
  SELECT p.variant_model
  INTO v_variant_model
  FROM public.products AS p
  WHERE p.id = NEW.product_id;

  IF v_variant_model = 'sku_matrix' THEN
    RAISE EXCEPTION
      USING ERRCODE = 'check_violation',
            MESSAGE = 'product_offers are not allowed for sku_matrix products';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_product_offers_for_sku_matrix
  ON public.product_offers;
CREATE TRIGGER block_product_offers_for_sku_matrix
  BEFORE INSERT OR UPDATE
  ON public.product_offers
  FOR EACH ROW
  EXECUTE FUNCTION public.block_product_offers_for_sku_matrix();

UPDATE public.products AS p
SET variant_model = 'sku_matrix',
    migration_status = 'migrated'
WHERE EXISTS (
  SELECT 1
  FROM public.product_variants AS pv
  WHERE pv.product_id = p.id
    AND pv.condition IS NOT NULL
);

DO $$
BEGIN
  PERFORM public.rebuild_sku_matrix_products(
    ARRAY(
      SELECT id
      FROM public.products
      WHERE variant_model = 'sku_matrix'
    )
  );
END;
$$;
