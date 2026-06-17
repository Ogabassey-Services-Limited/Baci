-- PR-B server V4 follow-up: atomic merchant settings/social_media merge.
--
-- The API route previously read merchants.social_media, merged in Node.js, then
-- wrote the whole object back. Two concurrent partial requests could lose one
-- another's handles. Keep RFC 7386-style object merge semantics, but do the
-- read/merge/write in one UPDATE statement inside Postgres. Mixed social_media
-- plus tax/settings writes also stay all-or-nothing in the same UPDATE.

DROP FUNCTION IF EXISTS public.update_merchant_social_media(uuid, jsonb, boolean);

CREATE OR REPLACE FUNCTION public.update_merchant_social_media(
  p_merchant_id uuid,
  p_social_media jsonb DEFAULT '{}'::jsonb,
  p_clear boolean DEFAULT false,
  p_settings jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_social_media jsonb;
  v_vat_registration_status text;
  v_tax_identification_number text;
  v_legal_entity_name text;
  v_registered_address jsonb;
  v_state_code character varying(10);
  v_updated_at timestamp with time zone;
  v_should_update_social boolean := p_clear OR p_social_media <> '{}'::jsonb;
  v_should_update_settings boolean := p_settings <> '{}'::jsonb;
BEGIN
  IF p_merchant_id IS NULL THEN
    RAISE EXCEPTION 'merchant_id_required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE((SELECT auth.role()), '') <> 'service_role'
    AND NOT public.check_staff_permission(
      (SELECT auth.uid()),
      p_merchant_id,
      'settings',
      'edit'
    ) THEN
    RAISE EXCEPTION 'insufficient_privilege' USING ERRCODE = '42501';
  END IF;

  IF p_social_media IS NULL OR pg_catalog.jsonb_typeof(p_social_media) <> 'object' THEN
    RAISE EXCEPTION 'invalid_social_media_payload' USING ERRCODE = '22023';
  END IF;

  IF p_settings IS NULL OR pg_catalog.jsonb_typeof(p_settings) <> 'object' THEN
    RAISE EXCEPTION 'invalid_settings_payload' USING ERRCODE = '22023';
  END IF;

  IF NOT v_should_update_social AND NOT v_should_update_settings THEN
    RAISE EXCEPTION 'no_changes_provided' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_social_media) AS social_key(key)
     WHERE social_key.key NOT IN (
       'twitter',
       'facebook',
       'instagram',
       'tiktok',
       'youtube',
       'pinterest',
       'linkedin',
       'snapchat'
     )
  ) THEN
    RAISE EXCEPTION 'invalid_social_media_key' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_each(p_social_media) AS social_entry(key, value)
     WHERE pg_catalog.jsonb_typeof(social_entry.value) NOT IN ('string', 'null')
        OR (
          pg_catalog.jsonb_typeof(social_entry.value) = 'string'
          AND pg_catalog.length(pg_catalog.btrim(social_entry.value #>> '{}')) > 255
        )
  ) THEN
    RAISE EXCEPTION 'invalid_social_media_value' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM pg_catalog.jsonb_object_keys(p_settings) AS setting_key(key)
     WHERE setting_key.key NOT IN (
       'vat_registration_status',
       'tax_identification_number',
       'legal_entity_name',
       'registered_address',
       'state_code'
     )
  ) THEN
    RAISE EXCEPTION 'invalid_settings_key' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'vat_registration_status'
    AND (
      pg_catalog.jsonb_typeof(p_settings -> 'vat_registration_status') <> 'string'
      OR (p_settings ->> 'vat_registration_status') NOT IN (
        'not_registered',
        'registered',
        'exempt',
        'pending'
      )
    ) THEN
    RAISE EXCEPTION 'invalid_vat_registration_status' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'tax_identification_number'
    AND (
      pg_catalog.jsonb_typeof(p_settings -> 'tax_identification_number') NOT IN ('string', 'null')
      OR (
        pg_catalog.jsonb_typeof(p_settings -> 'tax_identification_number') = 'string'
        AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'tax_identification_number')) > 32
      )
    ) THEN
    RAISE EXCEPTION 'invalid_tax_identification_number' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'legal_entity_name'
    AND (
      pg_catalog.jsonb_typeof(p_settings -> 'legal_entity_name') NOT IN ('string', 'null')
      OR (
        pg_catalog.jsonb_typeof(p_settings -> 'legal_entity_name') = 'string'
        AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'legal_entity_name')) > 255
      )
    ) THEN
    RAISE EXCEPTION 'invalid_legal_entity_name' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'state_code'
    AND (
      pg_catalog.jsonb_typeof(p_settings -> 'state_code') NOT IN ('string', 'null')
      OR (
        pg_catalog.jsonb_typeof(p_settings -> 'state_code') = 'string'
        AND pg_catalog.length(pg_catalog.btrim(p_settings ->> 'state_code')) > 10
      )
    ) THEN
    RAISE EXCEPTION 'invalid_state_code' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'registered_address'
    AND pg_catalog.jsonb_typeof(p_settings -> 'registered_address') NOT IN ('object', 'null') THEN
    RAISE EXCEPTION 'invalid_registered_address' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'registered_address'
    AND pg_catalog.jsonb_typeof(p_settings -> 'registered_address') = 'object'
    AND EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_object_keys(p_settings -> 'registered_address') AS address_key(key)
       WHERE address_key.key NOT IN ('street', 'city', 'state', 'postal_code', 'country')
    ) THEN
    RAISE EXCEPTION 'invalid_registered_address_key' USING ERRCODE = '22023';
  END IF;

  IF p_settings ? 'registered_address'
    AND pg_catalog.jsonb_typeof(p_settings -> 'registered_address') = 'object'
    AND EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_each(p_settings -> 'registered_address') AS address_entry(key, value)
       WHERE pg_catalog.jsonb_typeof(address_entry.value) NOT IN ('string', 'null')
          OR (
            pg_catalog.jsonb_typeof(address_entry.value) = 'string'
            AND pg_catalog.length(pg_catalog.btrim(address_entry.value #>> '{}')) >
              CASE address_entry.key
                WHEN 'postal_code' THEN 32
                WHEN 'country' THEN 100
                ELSE 255
              END
          )
    ) THEN
    RAISE EXCEPTION 'invalid_registered_address_value' USING ERRCODE = '22023';
  END IF;

  UPDATE public.merchants AS m
     SET social_media = CASE
           WHEN v_should_update_social THEN (
             SELECT COALESCE(
                      pg_catalog.jsonb_object_agg(
                        social_entry.key,
                        pg_catalog.to_jsonb(
                          pg_catalog.btrim(social_entry.value #>> '{}')
                        )
                      ),
                      '{}'::jsonb
                    )
               FROM pg_catalog.jsonb_each(
                      (CASE
                         WHEN p_clear THEN '{}'::jsonb
                         ELSE COALESCE(m.social_media, '{}'::jsonb)
                       END) || p_social_media
                    ) AS social_entry(key, value)
              WHERE social_entry.key IN (
                      'twitter',
                      'facebook',
                      'instagram',
                      'tiktok',
                      'youtube',
                      'pinterest',
                      'linkedin',
                      'snapchat'
                    )
                AND pg_catalog.jsonb_typeof(social_entry.value) = 'string'
                AND pg_catalog.btrim(social_entry.value #>> '{}') <> ''
           )
           ELSE m.social_media
         END,
         vat_registration_status = CASE
           WHEN p_settings ? 'vat_registration_status'
             THEN p_settings ->> 'vat_registration_status'
           ELSE m.vat_registration_status
         END,
         tax_identification_number = CASE
           WHEN p_settings ? 'tax_identification_number'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'tax_identification_number'), '')
           ELSE m.tax_identification_number
         END,
         legal_entity_name = CASE
           WHEN p_settings ? 'legal_entity_name'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'legal_entity_name'), '')
           ELSE m.legal_entity_name
         END,
         registered_address = CASE
           WHEN p_settings ? 'registered_address'
             THEN CASE
               WHEN p_settings -> 'registered_address' = 'null'::jsonb THEN NULL
               ELSE p_settings -> 'registered_address'
             END
           ELSE m.registered_address
         END,
         state_code = CASE
           WHEN p_settings ? 'state_code'
             THEN NULLIF(pg_catalog.btrim(p_settings ->> 'state_code'), '')
           ELSE m.state_code
         END,
         updated_at = pg_catalog.now()
   WHERE m.id = p_merchant_id
   RETURNING
     m.id,
     m.social_media,
     m.vat_registration_status,
     m.tax_identification_number,
     m.legal_entity_name,
     m.registered_address,
     m.state_code,
     m.updated_at
   INTO
     v_id,
     v_social_media,
     v_vat_registration_status,
     v_tax_identification_number,
     v_legal_entity_name,
     v_registered_address,
     v_state_code,
     v_updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'merchant_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'id', v_id,
    'social_media', v_social_media,
    'vat_registration_status', v_vat_registration_status,
    'tax_identification_number', v_tax_identification_number,
    'legal_entity_name', v_legal_entity_name,
    'registered_address', v_registered_address,
    'state_code', v_state_code,
    'updated_at', v_updated_at
  );
END;
$$;

ALTER FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) TO service_role;

COMMENT ON FUNCTION public.update_merchant_social_media(uuid, jsonb, boolean, jsonb) IS
  'Atomically updates merchant settings and merges/clears social_media for /api/merchant/settings, returning only the public settings projection.';
