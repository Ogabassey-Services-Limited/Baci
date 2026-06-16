-- Harden helper RPCs that do not need anonymous Data API execution.
--
-- Public storefront, checkout, tracking, newsletter, and staff-invite RPCs are
-- intentionally left unchanged in this migration.

CREATE OR REPLACE FUNCTION public.get_active_banners(
  p_merchant_id uuid
) RETURNS TABLE(
  id uuid,
  notification_id uuid,
  title text,
  message text,
  notification_type text,
  priority text,
  action_url text,
  action_label text,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    mn.id,
    n.id AS notification_id,
    n.title,
    n.message,
    n.notification_type,
    n.priority,
    n.action_url,
    n.action_label,
    mn.created_at
  FROM public.merchant_notifications AS mn
  JOIN public.notifications AS n ON n.id = mn.notification_id
  WHERE (
      COALESCE(auth.role(), '') = 'service_role'
      OR public.has_merchant_access(p_merchant_id)
    )
    AND mn.merchant_id = p_merchant_id
    AND mn.banner_dismissed_at IS NULL
    AND mn.dismissed_at IS NULL
    AND n.channels ? 'banner'
    AND (n.expires_at IS NULL OR n.expires_at > pg_catalog.now())
  ORDER BY
    CASE n.priority
      WHEN 'urgent' THEN 1
      WHEN 'high' THEN 2
      WHEN 'normal' THEN 3
      WHEN 'low' THEN 4
    END,
    mn.created_at DESC;
$$;

COMMENT ON FUNCTION public.get_active_banners(uuid) IS
  'Returns active merchant banners for the service role or callers with merchant access.';

REVOKE EXECUTE ON FUNCTION public.get_active_banners(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_banners(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.increment_hero_image_usage(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_hero_image_usage(uuid)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.upsert_customer_saved_address_from_order(
  uuid,
  text,
  text,
  jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_customer_saved_address_from_order(
  uuid,
  text,
  text,
  jsonb
) TO service_role;
