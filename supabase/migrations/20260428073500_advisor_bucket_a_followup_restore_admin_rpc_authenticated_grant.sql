-- Bucket A follow-up: restore `authenticated` EXECUTE on admin RPCs that
-- are called via the SSR Supabase client (carries user JWT, runs as the
-- `authenticated` role).
--
-- The original Bucket A migration revoked `authenticated` from these
-- functions assuming all admin routes used the service-role client.
-- They don't — `apps/web/src/app/api/admin/analytics/route.ts` and
-- `apps/web/src/app/api/admin/merchants/route.ts` both use
-- `createClient(cookieStore)` from `@/lib/supabase/server`, so the
-- requesting role is `authenticated`. The revoke broke them; this
-- migration walks back the revoke for those four functions.
--
-- Each restored function has an internal `is_platform_admin` /
-- `has_role admin` / `RAISE not authorized` check inside its body
-- (verified via `pg_get_functiondef` grep), so callers without admin
-- privileges still get rejected — defense in depth holds.
--
-- `check_database_health` is deliberately NOT restored: it has no
-- internal admin check. `apps/web/src/app/api/admin/db-health/route.ts`
-- is updated in the same PR to call it via the admin (service-role)
-- client instead, which preserves the role-grant lockdown.

GRANT EXECUTE ON FUNCTION public.get_admin_merchant_health()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_top_merchants()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_growth(p_limit integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_daily_summary(
  p_start_date date,
  p_end_date date
) TO authenticated;
