-- Regression coverage for the Credit Direct notes-preservation trigger.
-- Run after migrations:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/credit_direct_payment_audit_notes.sql

BEGIN;

DO $$
DECLARE
  v_merchant_id uuid := '00000000-0000-4000-8000-00000000cd01';
  v_merge_order_id uuid := '00000000-0000-4000-8000-00000000cd11';
  v_mismatch_order_id uuid := '00000000-0000-4000-8000-00000000cd12';
  v_missing_order_id uuid := '00000000-0000-4000-8000-00000000cd13';
  v_manual_order_id uuid := '00000000-0000-4000-8000-00000000cd14';
  v_notes jsonb;
BEGIN
  INSERT INTO public.merchants (id, email, business_name, slug)
  VALUES (
    v_merchant_id,
    'credit-direct-audit-trigger@example.com',
    'Credit Direct Audit Trigger Test',
    'credit-direct-audit-trigger-test'
  );

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- Successful overlap: the row already contains completion evidence that
  -- was absent from the webhook's earlier snapshot.
  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_email,
    customer_name,
    payment_status,
    payment_method,
    total,
    notes
  ) VALUES (
    v_merge_order_id,
    v_merchant_id,
    'ORD-CD-AUDIT-MERGE',
    'merge@example.com',
    'Merge Test',
    'bnpl_pending',
    'credit_direct',
    240447.87,
    jsonb_build_object(
      'creditDirectSessionId', 'session_current',
      'creditDirectSignedAmount', 240447.87,
      'creditDirectTransactionId', 'txn_old_attempt',
      'credit_directTransactionId', 'txn_old_legacy_alias',
      'creditDirectClientCompletedTransactionId', 'txn_client_completed',
      'creditDirectClientCompletedSessionId', 'session_current',
      'creditDirectClientCompletedAt', '2026-07-18T10:00:00.000Z',
      'creditDirectClientCompletionStatus', 'awaiting_provider_confirmation',
      'concurrentAudit', 'keep-me'
    )::text
  );

  UPDATE public.orders
  SET payment_status = 'paid',
      amount_paid = 240447.87,
      notes = jsonb_build_object(
        'creditDirectSessionId', 'session_current',
        'creditDirectVerifiedWebhookWrite', true,
        'creditDirectClientCompletionStatus', 'provider_confirmed',
        'creditDirectProviderConfirmedAt', '2026-07-18T10:01:00.000Z',
        'creditDirectTransactionId', 'txn_provider_confirmed',
        'merchantPaidAt', '2026-07-18T10:01:00.000Z'
      )::text
  WHERE id = v_merge_order_id;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_merge_order_id;

  IF v_notes->>'creditDirectClientCompletedTransactionId'
       IS DISTINCT FROM 'txn_client_completed'
     OR v_notes->>'creditDirectClientCompletedSessionId'
       IS DISTINCT FROM 'session_current'
     OR v_notes->>'concurrentAudit' IS DISTINCT FROM 'keep-me'
     OR v_notes->>'creditDirectClientCompletionStatus'
       IS DISTINCT FROM 'provider_confirmed'
     OR v_notes->>'creditDirectProviderConfirmedAt'
       IS DISTINCT FROM '2026-07-18T10:01:00.000Z'
     OR v_notes->>'creditDirectTransactionId'
       IS DISTINCT FROM 'txn_provider_confirmed'
     OR v_notes ? 'credit_directTransactionId'
     OR v_notes ? 'creditDirectVerifiedWebhookWrite' THEN
    RAISE EXCEPTION 'overlapping Credit Direct notes were not merged safely: %', v_notes;
  END IF;

  -- A later service-role maintenance write may retain provider fields, but it
  -- cannot inherit the stripped one-write marker and must bypass preservation.
  UPDATE public.orders
  SET notes = jsonb_build_object(
    'creditDirectClientCompletionStatus', 'provider_confirmed',
    'creditDirectProviderConfirmedAt', '2026-07-18T10:01:00.000Z',
    'creditDirectTransactionId', 'txn_provider_confirmed',
    'serviceMaintenance', 'replace-notes'
  )::text
  WHERE id = v_merge_order_id;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_merge_order_id;

  IF v_notes->>'serviceMaintenance' IS DISTINCT FROM 'replace-notes'
     OR v_notes ? 'creditDirectClientCompletedTransactionId' THEN
    RAISE EXCEPTION 'service-role maintenance was treated as a webhook: %', v_notes;
  END IF;

  -- Paid-to-pending reset: a deliberate new attempt must not have the old
  -- completion evidence restored by the paid-only preservation trigger.
  UPDATE public.orders
  SET payment_status = 'bnpl_pending',
      notes = '{"creditDirectSessionId":"session_retry"}'
  WHERE id = v_merge_order_id;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_merge_order_id;

  IF v_notes->>'creditDirectSessionId' IS DISTINCT FROM 'session_retry'
     OR v_notes ? 'creditDirectClientCompletedTransactionId' THEN
    RAISE EXCEPTION 'paid-to-pending reset restored stale evidence: %', v_notes;
  END IF;

  INSERT INTO public.orders (
    id,
    merchant_id,
    order_number,
    customer_email,
    customer_name,
    payment_status,
    payment_method,
    total,
    notes
  ) VALUES
    (
      v_mismatch_order_id,
      v_merchant_id,
      'ORD-CD-AUDIT-MISMATCH',
      'mismatch@example.com',
      'Mismatch Test',
      'bnpl_pending',
      'credit_direct',
      100,
      '{"creditDirectSessionId":"session_current"}'
    ),
    (
      v_missing_order_id,
      v_merchant_id,
      'ORD-CD-AUDIT-MISSING',
      'missing@example.com',
      'Missing Test',
      'bnpl_pending',
      'credit_direct',
      100,
      '{"creditDirectSessionId":"session_current"}'
    ),
    (
      v_manual_order_id,
      v_merchant_id,
      'ORD-CD-AUDIT-MANUAL',
      'manual@example.com',
      'Manual Test',
      'bnpl_pending',
      'credit_direct',
      100,
      '{"creditDirectSessionId":"session_current"}'
    );

  -- An authenticated merchant can legitimately mark a Credit Direct order
  -- paid. Even if its payload contains the transient marker, the authenticated
  -- role cannot enter provider preservation and the marker must not persist.
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  UPDATE public.orders
  SET payment_status = 'paid',
      notes = jsonb_build_object(
        'creditDirectVerifiedWebhookWrite', true,
        'manualMerchantNote', 'Merchant verified transfer manually'
      )::text
  WHERE id = v_manual_order_id;

  SELECT notes::jsonb INTO v_notes
  FROM public.orders
  WHERE id = v_manual_order_id;

  IF (SELECT payment_status FROM public.orders WHERE id = v_manual_order_id)
       IS DISTINCT FROM 'paid'
     OR v_notes->>'manualMerchantNote'
       IS DISTINCT FROM 'Merchant verified transfer manually'
     OR v_notes ? 'creditDirectVerifiedWebhookWrite' THEN
    RAISE EXCEPTION 'merchant paid-status edit was altered or rejected';
  END IF;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- A webhook built from an older signed session must fail the paid flip.
  BEGIN
    UPDATE public.orders
    SET payment_status = 'paid',
        notes = jsonb_build_object(
          'creditDirectSessionId', 'session_stale',
          'creditDirectVerifiedWebhookWrite', true,
          'creditDirectClientCompletionStatus', 'provider_confirmed',
          'creditDirectProviderConfirmedAt', '2026-07-18T10:02:00.000Z',
          'creditDirectTransactionId', 'txn_stale'
        )::text
    WHERE id = v_mismatch_order_id;
    RAISE EXCEPTION 'expected mismatched session update to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%stale_credit_direct_session%' THEN
      RAISE;
    END IF;
  END;

  -- Omitting the incoming session is also stale; the merge must not silently
  -- restore OLD and allow the paid transition.
  BEGIN
    UPDATE public.orders
    SET payment_status = 'paid',
        notes = jsonb_build_object(
          'creditDirectVerifiedWebhookWrite', true,
          'creditDirectClientCompletionStatus', 'provider_confirmed',
          'creditDirectProviderConfirmedAt', '2026-07-18T10:03:00.000Z',
          'creditDirectTransactionId', 'txn_missing_session'
        )::text
    WHERE id = v_missing_order_id;
    RAISE EXCEPTION 'expected missing session update to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%stale_credit_direct_session%' THEN
      RAISE;
    END IF;
  END;
END;
$$;

ROLLBACK;
