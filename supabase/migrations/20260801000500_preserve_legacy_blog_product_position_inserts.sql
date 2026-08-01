-- Preserve compatibility with trusted publishers that insert explicit blog
-- product links directly and predate the ordered-position contract.

CREATE SEQUENCE IF NOT EXISTS public.blog_post_product_legacy_position_seq
  AS integer
  MINVALUE 1;

-- Start after every existing position. A global monotonic fallback is enough:
-- positions are compared only within a blog post, while canonical writers keep
-- supplying their explicit 1-based order.
SELECT pg_catalog.setval(
  'public.blog_post_product_legacy_position_seq'::pg_catalog.regclass,
  COALESCE(
    (SELECT pg_catalog.max(position) FROM public.blog_post_products),
    0
  ) + 1,
  false
);

ALTER SEQUENCE public.blog_post_product_legacy_position_seq
  OWNED BY public.blog_post_products.position;

CREATE OR REPLACE FUNCTION public.assign_legacy_blog_product_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_candidate integer;
BEGIN
  IF NEW.position IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Legacy writes are low-volume. Serializing only this compatibility path
  -- keeps omitted-position batches and concurrent publishers collision-free;
  -- canonical writes provide position and return before taking this lock.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('blog_post_product_legacy_position', 0)
  );

  v_candidate := pg_catalog.nextval(
    'public.blog_post_product_legacy_position_seq'::pg_catalog.regclass
  )::integer;

  SELECT GREATEST(
    v_candidate,
    COALESCE(pg_catalog.max(position), 0) + 1
  )
  INTO NEW.position
  FROM public.blog_post_products
  WHERE blog_post_id = NEW.blog_post_id;

  IF NEW.position > v_candidate THEN
    PERFORM pg_catalog.setval(
      'public.blog_post_product_legacy_position_seq'::pg_catalog.regclass,
      NEW.position,
      true
    );
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.assign_legacy_blog_product_position() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.assign_legacy_blog_product_position()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS assign_legacy_blog_product_position
  ON public.blog_post_products;

CREATE TRIGGER assign_legacy_blog_product_position
  BEFORE INSERT ON public.blog_post_products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_legacy_blog_product_position();

-- Supabase's historical default privileges may grant broad access to new
-- public sequences. Only the non-callable trigger function should operate it.
REVOKE ALL ON SEQUENCE public.blog_post_product_legacy_position_seq
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON SEQUENCE public.blog_post_product_legacy_position_seq IS
  'Compatibility-only position source for trusted legacy blog product link inserts that omit position.';

COMMENT ON FUNCTION public.assign_legacy_blog_product_position() IS
  'Assigns a collision-free positive position only when a trusted legacy blog product link insert omits one.';
