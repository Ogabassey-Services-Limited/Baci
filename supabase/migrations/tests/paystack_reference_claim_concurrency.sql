-- REGRESSION TEST: Paystack reference claims are serialized across paths.
--
-- This test uses two independent PostgreSQL sessions. Run it after applying
-- all migrations with:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v DATABASE_URL="$DATABASE_URL" \
--     -f supabase/migrations/tests/paystack_reference_claim_concurrency.sql
--
-- The manual reconciliation RPC and create_payment_transaction race for the
-- same provider reference but different orders. Exactly one transaction can
-- claim the reference; the other path must fail with its reuse guard.

\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS dblink;

SELECT dblink_connect('paystack_manual_claim', :'DATABASE_URL');
SELECT dblink_connect('paystack_gateway_claim', :'DATABASE_URL');

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-4000-8000-00000000f101';
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000f102';
  v_review_id uuid := '00000000-0000-4000-8000-00000000f103';
  v_manual_order_id uuid := '00000000-0000-4000-8000-00000000f104';
  v_gateway_order_id uuid := '00000000-0000-4000-8000-00000000f105';
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'paystack-claim-test@example.com', 'test',
    now(), now(), now(), '{}'::jsonb, '{}'::jsonb
  );

  INSERT INTO public.merchants (id, user_id, email, business_name, slug)
  VALUES (
    v_merchant_id, v_user_id, 'paystack-claim-merchant@example.com',
    'Paystack Claim Test', 'paystack-claim-test'
  );

  INSERT INTO public.orders (
    id, merchant_id, order_number, customer_name, customer_email,
    payment_status, subtotal, total, currency, source, recorded_by_user_id
  ) VALUES
    (
      v_manual_order_id, v_merchant_id, 'ORD-PAYSTACK-CLAIM-MANUAL',
      'Paystack Claim Customer', 'paystack-claim-customer@example.com',
      'unpaid', 1000, 1000, 'NGN', 'manual', v_user_id
    ),
    (
      v_gateway_order_id, v_merchant_id, 'ORD-PAYSTACK-CLAIM-GATEWAY',
      'Paystack Claim Customer', 'paystack-claim-customer@example.com',
      'unpaid', 1000, 1000, 'NGN', 'manual', v_user_id
    );

  INSERT INTO public.reconciliation_review (
    id, issue_type, paystack_ref, order_id, reason, candidates
  ) VALUES (
    v_review_id, 'payment_match_zero_candidates',
    'paystack-concurrency-reference', v_manual_order_id,
    'Concurrency regression fixture', '[]'::jsonb
  );
END;
$$;

SELECT dblink_exec(
  'paystack_manual_claim',
  $$SET request.jwt.claim.role = 'service_role'$$
);
SELECT dblink_exec(
  'paystack_gateway_claim',
  $$SET request.jwt.claim.role = 'service_role'$$
);

SELECT dblink_send_query(
  'paystack_manual_claim',
  $$BEGIN;
    SELECT public.reconcile_paystack_unmatched_partial_payment(
      '00000000-0000-4000-8000-00000000f103'::uuid,
      '00000000-0000-4000-8000-00000000f104'::uuid,
      '00000000-0000-4000-8000-00000000f102'::uuid,
      'paystack-concurrency-reference', 100::numeric, 'NGN',
      'paystack-claim-customer@example.com', 'Paystack Claim Customer',
      0::numeric, 0::numeric, 100::numeric, '{}'::jsonb,
      '00000000-0000-4000-8000-00000000f101'::uuid, 'concurrency_test'
    );
    COMMIT;$$
);

SELECT dblink_send_query(
  'paystack_gateway_claim',
  $$BEGIN;
    SELECT public.create_payment_transaction(
      '00000000-0000-4000-8000-00000000f102'::uuid,
      '00000000-0000-4000-8000-00000000f105'::uuid,
      100::numeric, 'NGN', 'paystack',
      'paystack-concurrency-reference', 0::numeric, 100::numeric,
      'paystack-claim-customer@example.com', 'Paystack Claim Customer',
      NULL, '{}'::jsonb
    );
    COMMIT;$$
);

DO $$
DECLARE
  v_manual_succeeded boolean := false;
  v_gateway_succeeded boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM dblink_get_result('paystack_manual_claim') AS result(value text);
    v_manual_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    PERFORM dblink_exec('paystack_manual_claim', 'ROLLBACK');
  END;

  BEGIN
    PERFORM * FROM dblink_get_result('paystack_gateway_claim') AS result(value text);
    v_gateway_succeeded := true;
  EXCEPTION WHEN OTHERS THEN
    PERFORM dblink_exec('paystack_gateway_claim', 'ROLLBACK');
  END;

  IF v_manual_succeeded = v_gateway_succeeded THEN
    RAISE EXCEPTION
      'expected exactly one Paystack claim to succeed (manual=%, gateway=%)',
      v_manual_succeeded, v_gateway_succeeded;
  END IF;
END;
$$;

SELECT dblink_disconnect('paystack_manual_claim');
SELECT dblink_disconnect('paystack_gateway_claim');

DO $$
DECLARE
  v_transaction_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_transaction_ids
  FROM public.transactions
  WHERE gateway_reference = 'paystack-concurrency-reference';

  DELETE FROM public.merchant_settlements
   WHERE gateway_reference = 'paystack-concurrency-reference';
  DELETE FROM public.audit_logs
   WHERE resource_id = ANY (SELECT unnest(v_transaction_ids)::text);
  DELETE FROM public.transactions
   WHERE gateway_reference = 'paystack-concurrency-reference';
  DELETE FROM public.reconciliation_review
   WHERE id = '00000000-0000-4000-8000-00000000f103';
  DELETE FROM public.orders
   WHERE id IN (
     '00000000-0000-4000-8000-00000000f104',
     '00000000-0000-4000-8000-00000000f105'
   );
  DELETE FROM public.merchants
   WHERE id = '00000000-0000-4000-8000-00000000f102';
  DELETE FROM auth.users
   WHERE id = '00000000-0000-4000-8000-00000000f101';
END;
$$;
