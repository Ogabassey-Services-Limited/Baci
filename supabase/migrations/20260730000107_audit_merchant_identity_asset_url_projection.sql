-- Keep auditable asset identities useful while never retaining URL credentials,
-- query values, fragments, or malformed URL text in the immutable ledger.

CREATE OR REPLACE FUNCTION private.project_merchant_identity_asset_url_for_audit_v3(
  p_value text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_parts text[];
  v_value text;
BEGIN
  IF p_value IS NULL THEN
    RETURN NULL;
  END IF;

  v_value := pg_catalog.btrim(p_value);
  IF v_value = '' THEN
    RETURN v_value;
  END IF;
  IF v_value ~ '[[:space:][:cntrl:]]' THEN
    RETURN '[redacted_url]';
  END IF;

  -- An absolute HTTP(S) URL may be safely reduced to its public origin and
  -- path. User-info, query, and fragment components are intentionally absent.
  v_parts := pg_catalog.regexp_match(
    v_value,
    '^(https?://)(?:[^/?#@]*@)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*)(?::([0-9]{1,5}))?(/[^?#]*)?(?:[?#].*)?$',
    'i'
  );
  IF v_parts IS NULL
    OR (v_parts[3] IS NOT NULL AND v_parts[3]::integer > 65535) THEN
    RETURN '[redacted_url]';
  END IF;

  RETURN v_parts[1] || v_parts[2]
    || CASE WHEN v_parts[3] IS NULL THEN '' ELSE ':' || v_parts[3] END
    || COALESCE(v_parts[4], '');
END;
$$;

ALTER FUNCTION private.project_merchant_identity_asset_url_for_audit_v3(text)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.project_merchant_identity_asset_url_for_audit_v3(text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.project_merchant_identity_exact_values_v3(
  p_merchant public.merchants
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'business_name', p_merchant.business_name,
    'country', p_merchant.country,
    'email_logo_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.email_logo_url),
    'email_sender_name', p_merchant.email_sender_name,
    'favicon_apple_touch_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.favicon_apple_touch_url),
    'favicon_png_192_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.favicon_png_192_url),
    'favicon_png_32_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.favicon_png_32_url),
    'favicon_svg_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.favicon_svg_url),
    'is_published', p_merchant.is_published,
    'legal_entity_name', p_merchant.legal_entity_name,
    'logo_url', private.project_merchant_identity_asset_url_for_audit_v3(p_merchant.logo_url),
    'site_description', p_merchant.site_description,
    'site_tagline', p_merchant.site_tagline,
    'site_title', p_merchant.site_title,
    'slug', p_merchant.slug,
    'social_media', private.project_merchant_social_media_for_audit_v1(p_merchant.social_media),
    'support_email', p_merchant.support_email,
    'support_phone', p_merchant.support_phone
  );
$$;

ALTER FUNCTION private.project_merchant_identity_exact_values_v3(public.merchants)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.project_merchant_identity_exact_values_v3(public.merchants)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.project_merchant_identity_presence_values_v3(
  p_merchant public.merchants
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'business_address', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(p_merchant.business_address), '') IS NOT NULL),
    'email', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(p_merchant.email), '') IS NOT NULL),
    'lga_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(p_merchant.lga_code), '') IS NOT NULL),
    'phone', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(p_merchant.phone), '') IS NOT NULL),
    'registered_address', pg_catalog.jsonb_build_object('present', p_merchant.registered_address IS NOT NULL AND p_merchant.registered_address <> '{}'::jsonb),
    'state_code', pg_catalog.jsonb_build_object('present', NULLIF(pg_catalog.btrim(p_merchant.state_code), '') IS NOT NULL)
  );
$$;

ALTER FUNCTION private.project_merchant_identity_presence_values_v3(public.merchants)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.project_merchant_identity_presence_values_v3(public.merchants)
  FROM PUBLIC, anon, authenticated, service_role;
