DO $$
DECLARE
  v_definition TEXT;
  v_function REGPROCEDURE :=
    'public.create_storefront_order(uuid,text,text,jsonb,text,numeric,numeric,numeric,text,text,text,jsonb,text,text,jsonb,uuid,text,text,uuid)'::regprocedure;
  v_updated_definition TEXT;
BEGIN
  SELECT pg_get_functiondef(v_function) INTO v_definition;

  v_updated_definition := replace(
    v_definition,
    '  IF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION ''user_id_mismatch'';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION ''cannot_set_user_id_anonymously'';
  END IF;',
    '  IF public.is_agentic_checkout_context() THEN
    -- Agentic checkout is authenticated with a server-signed merchant-scoped
    -- JWT, not a customer login. Keep customers.user_id NULL so the storefront
    -- order RPC does not bind smoke/agent buyers to the merchant UUID.
    p_user_id := NULL;
  ELSIF v_user_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := v_user_id;
    ELSIF p_user_id <> v_user_id THEN
      RAISE EXCEPTION ''user_id_mismatch'';
    END IF;
  ELSIF p_user_id IS NOT NULL THEN
    RAISE EXCEPTION ''cannot_set_user_id_anonymously'';
  END IF;'
  );

  IF v_updated_definition = v_definition THEN
    RAISE EXCEPTION
      'create_storefront_order auth user block did not match expected definition';
  END IF;

  EXECUTE v_updated_definition;
END
$$;

COMMENT ON FUNCTION public.create_storefront_order(
  UUID,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  NUMERIC,
  NUMERIC,
  NUMERIC,
  TEXT,
  TEXT,
  TEXT,
  JSONB,
  TEXT,
  TEXT,
  JSONB,
  UUID,
  TEXT,
  TEXT,
  UUID
) IS
  'Creates storefront orders. Agentic checkout JWTs are merchant-scoped and must not populate customers.user_id.';
