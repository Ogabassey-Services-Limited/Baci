CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
ALTER EXTENSION unaccent SET SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.immutable_unaccent(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT extensions.unaccent(
    'extensions.unaccent',
    coalesce(search_text, '')
  );
$$;

CREATE OR REPLACE FUNCTION public.normalize_product_search_text(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.btrim(
    pg_catalog.regexp_replace(
      pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(
          pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.regexp_replace(
                pg_catalog.lower(
                  pg_catalog.regexp_replace(
                    pg_catalog.regexp_replace(
                      public.immutable_unaccent(search_text),
                      '([A-Za-z])([0-9])',
                      '\1 \2',
                      'g'
                    ),
                    '([0-9])([A-Za-z])',
                    '\1 \2',
                    'g'
                  )
                ),
                '\mpro[\s-]*max\M',
                'pro max',
                'g'
              ),
              '\mwi[\s-]*fi\M',
              'wifi',
              'g'
            ),
            '\me[\s-]*sim\M',
            'esim',
            'g'
          ),
          '\mdual[\s-]*sim\M',
          'dual sim',
          'g'
        ),
        '[^a-z0-9]+',
        ' ',
        'g'
      ),
      '\s+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.compact_product_search_text(search_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT pg_catalog.regexp_replace(
    public.normalize_product_search_text(search_text),
    '\s+',
    '',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.product_search_vector_v2(
  product_name text,
  product_brand text,
  product_category text,
  product_sku text,
  product_description text
)
RETURNS tsvector
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT
    pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_name, ''))
      ),
      'A'
    )
    || pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_sku, ''))
      ),
      'A'
    )
    || pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_brand, ''))
      ),
      'B'
    )
    || pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_category, ''))
      ),
      'B'
    )
    || pg_catalog.setweight(
      pg_catalog.to_tsvector(
        'simple',
        public.normalize_product_search_text(coalesce(product_description, ''))
      ),
      'C'
    );
$$;

DROP INDEX IF EXISTS public.products_search_name_compact_trgm;
DROP INDEX IF EXISTS public.products_search_name_normalized_trgm;
DROP INDEX IF EXISTS public.products_search_vector_v2_gin;

CREATE INDEX IF NOT EXISTS products_search_name_compact_trgm
  ON public.products
  USING gin (public.compact_product_search_text(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_name_normalized_trgm
  ON public.products
  USING gin (public.normalize_product_search_text(name) extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_search_vector_v2_gin
  ON public.products
  USING gin (public.product_search_vector_v2(name, brand, category, sku, description));

COMMENT ON FUNCTION public.immutable_unaccent(text)
  IS 'Immutable unaccent wrapper for product-search expression indexes.';

COMMENT ON FUNCTION public.normalize_product_search_text(text)
  IS 'Accent-insensitive normalization for Postgres-native product search.';
