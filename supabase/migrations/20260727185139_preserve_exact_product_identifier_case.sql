-- Exact product cache tags are case-sensitive. Trim identifiers for safety,
-- validate through a case-folded projection, and preserve original case in all
-- exact duties so case-only renames invalidate both cache keys.
CREATE OR REPLACE FUNCTION public.enqueue_storefront_product_cache_target(
  p_merchant_id uuid,
  p_product_identifier text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target text := pg_catalog.btrim(p_product_identifier);
  v_validation_target text := pg_catalog.lower(v_target);
BEGIN
  IF p_merchant_id IS NULL
    OR v_target IS NULL
    OR pg_catalog.length(v_target) NOT BETWEEN 1 AND 253
    OR v_validation_target
      !~ '^[a-z0-9](?:[a-z0-9-]{0,251}[a-z0-9])?$'
  THEN
    RETURN;
  END IF;

  INSERT INTO public.cache_invalidation_outbox AS outbox (
    merchant_id,
    target_kind,
    target_id,
    related_identifiers,
    product_slugs
  ) VALUES (
    p_merchant_id,
    'storefront_product',
    v_target,
    '{}',
    ARRAY[v_target]
  )
  ON CONFLICT (merchant_id, target_kind, target_id) DO UPDATE
  SET generation = outbox.generation + 1,
      related_identifiers = '{}',
      product_slugs = excluded.product_slugs,
      status = CASE WHEN outbox.status = 'claimed' THEN 'claimed' ELSE 'pending' END,
      attempts = CASE WHEN outbox.status = 'claimed' THEN outbox.attempts ELSE 0 END,
      next_attempt_at = CASE
        WHEN outbox.status = 'claimed' THEN outbox.next_attempt_at
        ELSE pg_catalog.now()
      END,
      last_error_code = CASE
        WHEN outbox.status = 'claimed' THEN outbox.last_error_code
        ELSE NULL
      END,
      updated_at = pg_catalog.now();
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_product_cache_target(uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_cache_invalidation_target(
  p_merchant_id uuid,
  p_target_kind text,
  p_target_id text,
  p_related_identifiers text[] DEFAULT '{}',
  p_product_slugs text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_target_id text := pg_catalog.lower(pg_catalog.btrim(p_target_id));
  v_related_identifiers text[];
  v_product_slugs text[];
BEGIN
  IF p_merchant_id IS NULL
    OR p_target_kind NOT IN ('storefront_slug', 'storefront_hostname')
    OR v_target_id IS NULL
    OR pg_catalog.length(v_target_id) NOT BETWEEN 1 AND 253
  THEN
    RETURN;
  END IF;
  IF p_target_kind = 'storefront_slug'
    AND v_target_id !~ '^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$'
  THEN
    RETURN;
  END IF;
  IF p_target_kind = 'storefront_hostname'
    AND v_target_id
      !~ '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  THEN
    RETURN;
  END IF;

  SELECT coalesce(pg_catalog.array_agg(value ORDER BY value), '{}')
  INTO v_related_identifiers
  FROM (
    SELECT v_target_id AS value
    UNION ALL
    SELECT normalized.value
    FROM (
      SELECT DISTINCT pg_catalog.lower(pg_catalog.btrim(candidate)) AS value
      FROM pg_catalog.unnest(coalesce(p_related_identifiers, '{}')) AS candidate
      WHERE candidate IS NOT NULL
        AND pg_catalog.length(pg_catalog.btrim(candidate)) BETWEEN 1 AND 253
        AND pg_catalog.lower(pg_catalog.btrim(candidate)) <> v_target_id
      ORDER BY value
      LIMIT 39
    ) AS normalized
  ) AS preserved;

  SELECT coalesce(pg_catalog.array_agg(value ORDER BY value), '{}')
  INTO v_product_slugs
  FROM (
    SELECT DISTINCT pg_catalog.btrim(candidate) AS value
    FROM pg_catalog.unnest(coalesce(p_product_slugs, '{}')) AS candidate
    WHERE candidate IS NOT NULL
      AND pg_catalog.length(pg_catalog.btrim(candidate)) BETWEEN 1 AND 253
      AND pg_catalog.lower(pg_catalog.btrim(candidate))
        ~ '^[a-z0-9](?:[a-z0-9-]{0,251}[a-z0-9])?$'
    ORDER BY value
    LIMIT 100
  ) AS normalized;

  INSERT INTO public.cache_invalidation_outbox AS outbox (
    merchant_id,
    target_kind,
    target_id,
    related_identifiers,
    product_slugs
  ) VALUES (
    p_merchant_id,
    p_target_kind,
    v_target_id,
    v_related_identifiers,
    v_product_slugs
  )
  ON CONFLICT (merchant_id, target_kind, target_id) DO UPDATE
  SET generation = outbox.generation + 1,
      related_identifiers = excluded.related_identifiers,
      product_slugs = CASE
        WHEN outbox.status = 'completed' THEN excluded.product_slugs
        ELSE (
          SELECT coalesce(pg_catalog.array_agg(value ORDER BY value), '{}')
          FROM (
            SELECT DISTINCT value
            FROM pg_catalog.unnest(
              outbox.product_slugs || excluded.product_slugs
            ) AS value
            ORDER BY value
            LIMIT 100
          ) AS combined
        )
      END,
      status = CASE WHEN outbox.status = 'claimed' THEN 'claimed' ELSE 'pending' END,
      attempts = CASE WHEN outbox.status = 'claimed' THEN outbox.attempts ELSE 0 END,
      next_attempt_at = CASE
        WHEN outbox.status = 'claimed' THEN outbox.next_attempt_at
        ELSE pg_catalog.now()
      END,
      last_error_code = CASE
        WHEN outbox.status = 'claimed' THEN outbox.last_error_code
        ELSE NULL
      END,
      updated_at = pg_catalog.now();
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_cache_invalidation_target(
  uuid, text, text, text[], text[]
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enqueue_storefront_cache_targets(
  p_merchant_id uuid,
  p_additional_slug text DEFAULT NULL,
  p_additional_hostname text DEFAULT NULL,
  p_product_slugs text[] DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug text;
  v_target text;
BEGIN
  SELECT merchant.slug INTO v_slug
  FROM public.merchants AS merchant
  WHERE merchant.id = p_merchant_id;
  IF v_slug IS NULL THEN
    RETURN;
  END IF;

  FOR v_target IN
    SELECT DISTINCT candidate
    FROM (
      SELECT v_slug AS candidate
      UNION ALL SELECT p_additional_slug
      UNION ALL
      SELECT alias.old_slug
      FROM public.merchant_slug_aliases AS alias
      WHERE alias.merchant_id = p_merchant_id
    ) AS targets
    WHERE candidate IS NOT NULL
  LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id,
      'storefront_slug',
      v_target,
      ARRAY[v_slug, p_additional_slug, v_target],
      p_product_slugs
    );
  END LOOP;

  FOR v_target IN
    SELECT DISTINCT candidate
    FROM (
      SELECT domain_row.domain AS candidate
      FROM public.domains AS domain_row
      WHERE domain_row.merchant_id = p_merchant_id
        AND domain_row.status = 'active'
        AND domain_row.verified_at IS NOT NULL
      UNION ALL SELECT p_additional_hostname
    ) AS targets
    WHERE candidate IS NOT NULL
  LOOP
    PERFORM public.enqueue_cache_invalidation_target(
      p_merchant_id,
      'storefront_hostname',
      v_target,
      ARRAY[v_slug, p_additional_slug, v_target],
      p_product_slugs
    );
  END LOOP;

  FOR v_target IN
    SELECT DISTINCT pg_catalog.btrim(candidate)
    FROM pg_catalog.unnest(coalesce(p_product_slugs, '{}')) AS candidate
    WHERE candidate IS NOT NULL
  LOOP
    PERFORM public.enqueue_storefront_product_cache_target(
      p_merchant_id,
      v_target
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_storefront_cache_targets(
  uuid, text, text, text[]
) FROM PUBLIC, anon, authenticated, service_role;
