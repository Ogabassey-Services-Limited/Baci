-- Regression contract for 20260731190000_atomic_blog_post_product_links.sql.
-- Usage: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f \
--   supabase/migrations/tests/atomic_blog_post_product_links.sql

BEGIN READ ONLY;

DO $$
DECLARE
  function_definition text;
  function_is_definer boolean;
BEGIN
  SELECT pg_get_functiondef(oid), prosecdef
  INTO function_definition, function_is_definer
  FROM pg_proc
  WHERE oid =
    'public.mutate_merchant_blog_post_with_product_links(uuid,uuid,jsonb,uuid[])'::regprocedure;

  IF function_definition IS NULL OR function_is_definer IS NOT TRUE THEN
    RAISE EXCEPTION 'atomic blog product-link RPC must exist as SECURITY DEFINER';
  END IF;

  IF function_definition !~ 'marketing'', ''create'''
    OR function_definition !~ 'marketing'', ''edit'''
    OR function_definition !~ 'too_many_embedded_product_ids'
    OR function_definition !~ 'blog_post_not_found'
    OR function_definition !~ 'embedded_product_not_found_or_not_owned'
  THEN
    RAISE EXCEPTION 'atomic blog product-link RPC lost its permission or stable-error contract';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.mutate_merchant_blog_post_with_product_links(uuid,uuid,jsonb,uuid[])',
    'EXECUTE'
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'authenticated must retain execute on atomic blog product-link RPC';
  END IF;
END;
$$ LANGUAGE plpgsql;

ROLLBACK;
