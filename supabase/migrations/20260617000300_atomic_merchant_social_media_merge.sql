-- PR-B server V4 follow-up: atomic social_media merge/clear for merchant settings.
--
-- The API route previously read merchants.social_media, merged in Node.js, then
-- wrote the whole object back. Two concurrent partial requests could lose one
-- another's handles. Keep RFC 7386-style object merge semantics, but do the
-- read/merge/write in one UPDATE statement inside Postgres.

CREATE OR REPLACE FUNCTION public.update_merchant_social_media(
  p_merchant_id uuid,
  p_social_media jsonb DEFAULT '{}'::jsonb,
  p_clear boolean DEFAULT false
)
RETURNS public.merchants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_merchant public.merchants;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_merchant_access(p_merchant_id) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_social_media IS NULL OR pg_catalog.jsonb_typeof(p_social_media) <> 'object' THEN
    RAISE EXCEPTION 'invalid_social_media_payload' USING ERRCODE = '22023';
  END IF;

  UPDATE public.merchants AS m
     SET social_media = (
           SELECT COALESCE(pg_catalog.jsonb_object_agg(key, value), '{}'::jsonb)
             FROM pg_catalog.jsonb_each_text(
                    (CASE
                       WHEN p_clear THEN '{}'::jsonb
                       ELSE COALESCE(m.social_media, '{}'::jsonb)
                     END) || p_social_media
                  ) AS merged(key, value)
            WHERE pg_catalog.btrim(value) <> ''
         ),
         updated_at = pg_catalog.now()
   WHERE m.id = p_merchant_id
   RETURNING m.* INTO v_merchant;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_merchant;
END;
$$;

ALTER FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) TO service_role;

COMMENT ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean) IS
  'Atomically merges or clears merchant social_media for /api/merchant/settings, preserving absent keys without Node-side read-modify-write races.';
