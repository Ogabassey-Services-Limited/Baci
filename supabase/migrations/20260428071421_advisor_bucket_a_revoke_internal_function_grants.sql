-- Revoke EXECUTE on internal SECURITY DEFINER functions from PUBLIC, anon,
-- and authenticated. Only service_role retains EXECUTE.
--
-- Background: the Supabase advisor flagged 224 functions in `public` as
-- callable by the `anon` and/or `authenticated` role through PostgREST's
-- /rest/v1/rpc/* surface. This migration cleans up the subset that has
-- ZERO legitimate REST callers — three categories, ~47 functions:
--
-- 1. Trigger functions. Postgres calls these directly when DML hits the
--    parent table; revoking REST grants does not affect trigger execution
--    (which runs as the trigger owner regardless of role).
-- 2. Cron / cleanup functions. Only invoked by /api/cron/* routes that use
--    the service-role client, never by browser sessions.
-- 3. Admin analytics + service-side wallet/settlement writes. Only invoked
--    by /api/admin/* and the payments + VTU server routes via the
--    service-role client.
--
-- Functions deliberately NOT in this list (kept anon/authenticated-callable):
--
--   * RLS helpers (`has_merchant_access`, `check_staff_permission`,
--     `is_active_staff_of`, `is_staff_of_merchant`, `get_user_access`,
--     `get_user_merchant_context`, `get_user_merchant_access`,
--     `get_merchant_id_for_user`) — RLS policies on public tables call these
--     during SELECT/INSERT, so anon-context queries need EXECUTE per
--     security-rls-performance.md.
--   * Public storefront RPCs (`create_storefront_order`, `get_order_tracking`,
--     `get_storefront_*`, `redeem_wallet_for_order`, etc.) — kept callable;
--     authorization is enforced inside each function body.
--   * Merchant-app RPCs (`get_top_products`, `get_wallet_summary`,
--     `delete_current_user`, etc.) — handled in a separate Bucket B
--     migration that revokes from anon only.

-- ─── Trigger functions (no REST exposure needed) ───────────────────────────
REVOKE EXECUTE ON FUNCTION public.populate_order_item_tax() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_order_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_blog_category_post_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_discount_code_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_jumia_orders_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_marketplace_integrations_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_merchant_balance() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_order_insurance_policies_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_order_tax_totals() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_platform_settings_timestamp() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_review_helpful_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_shipments_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_staff_members_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_customer_saved_addresses_from_order() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_variant_media_projection() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clear_product_variant_media_projection_on_disable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_staff_invite() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_negotiation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_update_customer_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_welcome_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_merchant_feature_settings() FROM PUBLIC, anon, authenticated;

-- ─── Cron / cleanup functions (service-role only) ──────────────────────────
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_notifications() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_shipping_quotes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_oauth_handoff_tickets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_push_attempts() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_push_tickets() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_rate_limit_logs(retention_interval interval) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_push_tokens() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_abandoned_orders(hours_threshold integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_due_settlements() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.invoke_cleanup_pending_transactions() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_analytics_views() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_platform_analytics_views() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_product_variant_media_projection(p_product_id uuid) FROM PUBLIC, anon, authenticated;

-- ─── Admin analytics (service-role only, called from /api/admin/*) ─────────
REVOKE EXECUTE ON FUNCTION public.get_admin_merchant_health() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_top_merchants() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_platform_growth(p_limit integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_admin_platform_daily_summary(p_start_date date, p_end_date date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_platform_analytics_summary(p_start_date date, p_end_date date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_total_sales() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_push_token_stats() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_notification_stats(p_notification_id uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_database_health() FROM PUBLIC, anon, authenticated;

-- ─── Wallet / settlement writes (service-role only) ────────────────────────
REVOKE EXECUTE ON FUNCTION public.credit_merchant_wallet(p_merchant_id uuid, p_amount numeric, p_source_type text, p_source_id uuid, p_description text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debit_merchant_wallet(p_merchant_id uuid, p_amount numeric, p_type text, p_description text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_wallet_withdrawal(p_transaction_id uuid, p_success boolean, p_transfer_reference text, p_transfer_message text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_merchant_settlement(p_merchant_id uuid, p_source_type text, p_source_id uuid, p_gateway text, p_gateway_reference text, p_gross_amount numeric, p_gateway_fee numeric, p_platform_fee numeric, p_description text) FROM PUBLIC, anon, authenticated;
