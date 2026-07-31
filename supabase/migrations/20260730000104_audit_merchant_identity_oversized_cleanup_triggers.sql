-- Only pre-existing oversized rows use the redacted clean-up writer. New
-- oversized values remain subject to the legacy writer's payload guard.

DROP TRIGGER IF EXISTS audit_merchant_identity_cleanup_insert_v2 ON public.merchants;
DROP TRIGGER IF EXISTS audit_merchant_identity_cleanup_delete_v2 ON public.merchants;
DROP TRIGGER IF EXISTS audit_merchant_identity_cleanup_update_v2 ON public.merchants;

CREATE TRIGGER audit_merchant_identity_cleanup_delete_v2
  AFTER DELETE ON public.merchants
  FOR EACH ROW
  WHEN (NOT private.merchant_identity_audit_row_is_bounded_v2(OLD))
  EXECUTE FUNCTION private.audit_merchant_identity_oversized_cleanup_v2();

CREATE TRIGGER audit_merchant_identity_cleanup_update_v2
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
  WHEN (NOT private.merchant_identity_audit_row_is_bounded_v2(OLD))
  EXECUTE FUNCTION private.audit_merchant_identity_oversized_cleanup_v2();
