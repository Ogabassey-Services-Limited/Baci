BEGIN;

DO $$
DECLARE
  v_normalized_plain text;
  v_normalized_accent text;
  v_normalized_uppercase_model text;
  v_unaccent_schema text;
  v_function_exists boolean;
  v_has_blank_search_path boolean;
BEGIN
  SELECT n.nspname
    INTO v_unaccent_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'unaccent';

  IF v_unaccent_schema IS DISTINCT FROM 'extensions' THEN
    RAISE EXCEPTION 'unaccent extension must live in extensions schema, found %',
      COALESCE(v_unaccent_schema, '<missing>');
  END IF;

  SELECT public.normalize_product_search_text('ṣamṣung') INTO v_normalized_accent;
  SELECT public.normalize_product_search_text('samsung') INTO v_normalized_plain;

  IF v_normalized_accent <> v_normalized_plain THEN
    RAISE EXCEPTION 'accented and unaccented search terms should normalize equally: % <> %',
      v_normalized_accent,
      v_normalized_plain;
  END IF;

  SELECT public.normalize_product_search_text('IPHONE12') INTO v_normalized_uppercase_model;

  IF v_normalized_uppercase_model <> 'iphone 12' THEN
    RAISE EXCEPTION 'uppercase model names should split letters and numbers before lowercasing: %',
      v_normalized_uppercase_model;
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = 'normalize_product_search_text'
        AND pg_get_function_identity_arguments(p.oid) = 'search_text text'
    )
    INTO v_function_exists;

  IF NOT v_function_exists THEN
    RAISE EXCEPTION 'normalize_product_search_text(search_text text) must exist';
  END IF;

  SELECT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN LATERAL pg_options_to_table(COALESCE(p.proconfig, ARRAY[]::text[]))
      WHERE n.nspname = 'public'
        AND p.proname = 'normalize_product_search_text'
        AND pg_get_function_identity_arguments(p.oid) = 'search_text text'
        AND option_name = 'search_path'
        AND pg_catalog.replace(option_value, '"', '') = ''
    )
    INTO v_has_blank_search_path;

  IF v_has_blank_search_path IS NOT TRUE THEN
    RAISE EXCEPTION 'normalize_product_search_text must pin a blank search_path';
  END IF;
END $$;

ROLLBACK;
