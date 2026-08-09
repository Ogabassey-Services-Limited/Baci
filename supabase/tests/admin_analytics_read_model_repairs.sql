-- REGRESSION TEST: platform-admin analytics read-model repairs.
--
-- Run in an isolated PostgreSQL database:
--   psql -X -v ON_ERROR_STOP=1 -f supabase/tests/admin_analytics_read_model_repairs.sql

BEGIN;

CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA private;

CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT '00000000-0000-0000-0000-000000000001'::uuid;
$$;
CREATE FUNCTION private.has_platform_admin_permission_v1(uuid, text)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT TRUE; $$;

CREATE TABLE public.merchants (
  id uuid PRIMARY KEY, slug text, business_name text, email text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), payout_currency text
);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY, merchant_id uuid, total numeric, currency text,
  payment_status text, created_at timestamptz
);
CREATE TABLE public.merchant_settlements (
  id uuid PRIMARY KEY, merchant_id uuid, status text, net_amount numeric,
  gateway text, created_at timestamptz
);
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY, merchant_id uuid, amount numeric, currency text,
  transaction_type text, status text, gateway text, created_at timestamptz
);
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY, merchant_id uuid, amount numeric, currency text,
  status text, created_at timestamptz
);
CREATE TABLE public.merchant_wallets (
  merchant_id uuid PRIMARY KEY, available_balance numeric, pending_balance numeric,
  upcoming_balance numeric
);
CREATE TABLE public.reconciliation_review (
  id uuid PRIMARY KEY, merchant_id uuid, issue_type text, resolved_at timestamptz,
  created_at timestamptz
);
CREATE TABLE public.email_send_attempts (
  id uuid PRIMARY KEY, merchant_id uuid, provider text, email_type text,
  provider_error_code text, attempt_count integer, status text,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.push_notification_attempts (status text);
CREATE TABLE public.order_notification_outbox (status text, locked_at timestamptz);
CREATE TABLE public.shipment_tracking_notification_outbox (status text, locked_at timestamptz);

CREATE FUNCTION public.get_admin_merchant_360(uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'moneyCurrency', 'NGN',
    'readiness', jsonb_build_object(
      'hasStorefrontSlug', TRUE, 'isPublished', TRUE,
      'paymentConfigured', TRUE, 'shippingConfigured', TRUE,
      'storefrontReady', FALSE
    ),
    'domain', jsonb_build_object('verifiedAt', NULL, 'status', 'pending', 'sslStatus', 'pending')
  );
$$;
CREATE FUNCTION public.get_admin_system_health_v1() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('health', jsonb_build_array(jsonb_build_object(
    'check_name', 'Notification delivery', 'status', 'warning',
    'message', 'Legacy status', 'details', '{}'::jsonb
  )));
$$;
CREATE FUNCTION public.get_admin_operations_v1(text, integer, integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'summary', jsonb_build_object('notifications', 0),
    'notifications', jsonb_build_object('email', '[]'::jsonb)
  );
$$;
-- Minimal delegates required to replay the production v2 error-code projection
-- migration. The test exercises get_admin_operations_v2; these other v2
-- readers only satisfy the migration's ACL and wrapper dependencies.
CREATE FUNCTION public.list_event_pipeline_ingress_failures_admin_v2(
  integer, integer, text, uuid, timestamptz, timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('items', '[]'::jsonb);
$$;
CREATE FUNCTION public.list_event_pipeline_deliveries_admin_v2(
  text, integer, integer, text, text, uuid, timestamptz, timestamptz
) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('items', '[]'::jsonb);
$$;
CREATE FUNCTION public.get_event_pipeline_operations_admin_v2()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('heartbeats', '[]'::jsonb);
$$;
CREATE FUNCTION public.write_platform_audit_event_v1(text, text, text, text[], jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$ BEGIN END; $$;

INSERT INTO public.merchants (id, slug, business_name, email, payout_currency)
VALUES
  ('00000000-0000-0000-0000-000000000010', 'first', 'First merchant', 'first@example.test', 'NGN'),
  ('00000000-0000-0000-0000-000000000011', 'second', 'Second merchant', 'second@example.test', 'NGN');
INSERT INTO public.orders (id, merchant_id, total, currency, payment_status, created_at)
VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000010', 100, 'NGN', 'paid', clock_timestamp()),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000011', 200, 'NGN', 'paid', clock_timestamp());
INSERT INTO public.merchant_settlements (id, merchant_id, status, net_amount, gateway, created_at)
VALUES ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000010', 'pending', 95, 'paystack', clock_timestamp());
INSERT INTO public.email_send_attempts (
  id, merchant_id, provider, email_type, attempt_count, status, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000010',
  'zeptomail', 'order_confirmation', 1, 'failed',
  clock_timestamp() - interval '2 days', clock_timestamp() - interval '2 days'
);

\ir ../migrations/20260809154414_repair_admin_analytics_read_models.sql
\ir ../migrations/20260809154415_repair_admin_merchant_360_readiness.sql
\ir ../migrations/20260809154416_repair_admin_reconciliation_currencyless_activity.sql
\ir ../migrations/20260809154417_repair_admin_system_health_email_freshness.sql
\ir ../migrations/20260809154917_repair_admin_operations_stale_email_attempts.sql
\ir ../migrations/20260805151570_harden_admin_error_code_projections.sql

-- The production v2 projection migration commits its own transaction.
BEGIN;

DO $$
DECLARE
  v_directory_id uuid;
  v_detail jsonb;
  v_reconciliation jsonb;
  v_health jsonb;
BEGIN
  SELECT merchant_id INTO v_directory_id
  FROM public.get_admin_merchant_health_v2(50, 0, NULL, NULL, 'gmv')
  LIMIT 1;
  IF v_directory_id <> '00000000-0000-0000-0000-000000000011'::uuid THEN
    RAISE EXCEPTION 'merchant directory did not sort by the CTE total_gmv output';
  END IF;

  v_detail := public.get_admin_merchant_360_v2('00000000-0000-0000-0000-000000000010');
  IF v_detail #>> '{readiness,storefrontReady}' <> 'true' THEN
    RAISE EXCEPTION 'Merchant 360 still requires a custom domain for storefront readiness';
  END IF;

  v_reconciliation := public.get_admin_reconciliation_v3('30d', 'NGN', NULL, 'all', 'all', NULL, NULL, 50);
  IF v_reconciliation #>> '{metrics,platformSettlements,pendingCount}' <> '1'
    OR v_reconciliation #>> '{items,0,lane}' <> 'platform_settlement'
    OR v_reconciliation #> '{items,0,amount}' <> 'null'::jsonb
    OR v_reconciliation #> '{items,0,currency}' <> 'null'::jsonb THEN
    RAISE EXCEPTION 'currency-less settlement activity was hidden or relabeled as money';
  END IF;

  v_health := public.get_admin_system_health_v1();
  IF v_health #>> '{health,0,status}' <> 'healthy' THEN
    RAISE EXCEPTION 'historical failed email still degrades system health';
  END IF;

  INSERT INTO public.email_send_attempts (
    id, merchant_id, provider, email_type, attempt_count, status, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000010',
    'zeptomail', 'order_confirmation', 1, 'pending',
    clock_timestamp() - interval '20 minutes', clock_timestamp() - interval '20 minutes'
  );
  INSERT INTO public.email_send_attempts (
    id, merchant_id, provider, email_type, attempt_count, status, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000010',
    'zeptomail', 'order_confirmation', 1, 'pending', clock_timestamp(), clock_timestamp()
  );
  v_health := public.get_admin_system_health_v1();
  IF v_health #>> '{health,0,status}' <> 'warning' THEN
    RAISE EXCEPTION 'stale pending email does not degrade system health';
  END IF;
  v_health := public.get_admin_operations_v2('notifications', 25, 0);
  IF v_health #>> '{summary,notifications}' <> '1'
    OR v_health #>> '{notifications,email,0,id}' <> '00000000-0000-0000-0000-000000000041'
    OR v_health #>> '{notifications,email,0,status}' <> 'stale' THEN
    RAISE EXCEPTION 'stale pending email is absent from operations incidents';
  END IF;
  IF v_health::text LIKE '%00000000-0000-0000-0000-000000000042%' THEN
    RAISE EXCEPTION 'fresh pending email incorrectly appears in operations incidents';
  END IF;
END;
$$;

ROLLBACK;
