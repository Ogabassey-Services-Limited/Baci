-- Route the legacy exact-value writer only when every possible identity
-- projection fits the immutable ledger's per-payload bound.

CREATE OR REPLACE FUNCTION private.merchant_identity_audit_row_is_bounded_v2(
  p_merchant public.merchants
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_catalog.octet_length(
    pg_catalog.jsonb_build_object(
      'exact', pg_catalog.jsonb_build_object(
        'business_name', p_merchant.business_name,
        'country', p_merchant.country,
        'email_logo_url', p_merchant.email_logo_url,
        'email_sender_name', p_merchant.email_sender_name,
        'favicon_apple_touch_url', p_merchant.favicon_apple_touch_url,
        'favicon_png_192_url', p_merchant.favicon_png_192_url,
        'favicon_png_32_url', p_merchant.favicon_png_32_url,
        'favicon_svg_url', p_merchant.favicon_svg_url,
        'is_published', p_merchant.is_published,
        'legal_entity_name', p_merchant.legal_entity_name,
        'logo_url', p_merchant.logo_url,
        'site_description', p_merchant.site_description,
        'site_tagline', p_merchant.site_tagline,
        'site_title', p_merchant.site_title,
        'slug', p_merchant.slug,
        'support_email', p_merchant.support_email,
        'support_phone', p_merchant.support_phone
      ),
      'presence', pg_catalog.jsonb_build_object(
        'business_address', pg_catalog.jsonb_build_object(
          'present', NULLIF(pg_catalog.btrim(p_merchant.business_address), '') IS NOT NULL
        ),
        'email', pg_catalog.jsonb_build_object(
          'present', NULLIF(pg_catalog.btrim(p_merchant.email), '') IS NOT NULL
        ),
        'lga_code', pg_catalog.jsonb_build_object(
          'present', NULLIF(pg_catalog.btrim(p_merchant.lga_code), '') IS NOT NULL
        ),
        'phone', pg_catalog.jsonb_build_object(
          'present', NULLIF(pg_catalog.btrim(p_merchant.phone), '') IS NOT NULL
        ),
        'registered_address', pg_catalog.jsonb_build_object(
          'present', p_merchant.registered_address IS NOT NULL
            AND p_merchant.registered_address <> '{}'::jsonb
        ),
        'state_code', pg_catalog.jsonb_build_object(
          'present', NULLIF(pg_catalog.btrim(p_merchant.state_code), '') IS NOT NULL
        )
      ),
      'social_media',
      private.project_merchant_social_media_for_audit_v1(p_merchant.social_media)
    )::text
  ) <= 16384;
$$;

ALTER FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION private.merchant_identity_audit_row_is_bounded_v2(public.merchants)
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS audit_merchant_identity_change_v1 ON public.merchants;
DROP TRIGGER IF EXISTS audit_merchant_identity_legacy_insert_v2 ON public.merchants;
DROP TRIGGER IF EXISTS audit_merchant_identity_legacy_delete_v2 ON public.merchants;
DROP TRIGGER IF EXISTS audit_merchant_identity_legacy_update_v2 ON public.merchants;

CREATE TRIGGER audit_merchant_identity_legacy_insert_v2
  AFTER INSERT ON public.merchants
  FOR EACH ROW
  EXECUTE FUNCTION private.audit_merchant_identity_change_v1();

CREATE TRIGGER audit_merchant_identity_legacy_delete_v2
  AFTER DELETE ON public.merchants
  FOR EACH ROW
  WHEN (private.merchant_identity_audit_row_is_bounded_v2(OLD))
  EXECUTE FUNCTION private.audit_merchant_identity_change_v1();

CREATE TRIGGER audit_merchant_identity_legacy_update_v2
  AFTER UPDATE OF
    business_name,
    country,
    email_logo_url,
    email_sender_name,
    favicon_apple_touch_url,
    favicon_png_192_url,
    favicon_png_32_url,
    favicon_svg_url,
    is_published,
    legal_entity_name,
    logo_url,
    site_description,
    site_tagline,
    site_title,
    slug,
    social_media,
    support_email,
    support_phone,
    business_address,
    email,
    lga_code,
    phone,
    registered_address,
    state_code
  ON public.merchants
  FOR EACH ROW
  WHEN (
    private.merchant_identity_audit_row_is_bounded_v2(OLD)
    AND NOT (
      private.merchant_identity_audit_row_is_bounded_v2(NEW)
      AND OLD.social_media IS DISTINCT FROM NEW.social_media
      AND private.project_merchant_social_media_for_audit_v1(OLD.social_media)
        IS NOT DISTINCT FROM private.project_merchant_social_media_for_audit_v1(NEW.social_media)
    )
  )
  EXECUTE FUNCTION private.audit_merchant_identity_change_v1();
