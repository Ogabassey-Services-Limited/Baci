-- Preserve concurrent client/session evidence without allowing a stale order
-- snapshot to replace the transaction reference accepted from the provider.
CREATE OR REPLACE FUNCTION public.preserve_credit_direct_payment_audit_notes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $$
DECLARE
  v_old_notes jsonb := '{}'::jsonb;
  v_new_notes jsonb := '{}'::jsonb;
  v_merged_notes jsonb := '{}'::jsonb;
  v_key text;
  v_old_session text;
  v_new_session text;
  v_is_verified_webhook_write boolean := false;
BEGIN
  BEGIN
    v_new_notes := COALESCE(NULLIF(trim(NEW.notes), ''), '{}')::jsonb;
    IF jsonb_typeof(v_new_notes) <> 'object' THEN
      v_new_notes := '{}'::jsonb;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_new_notes := '{}'::jsonb;
  END;

  v_is_verified_webhook_write :=
    auth.role() IS NOT DISTINCT FROM 'service_role'
    AND (v_new_notes->>'creditDirectVerifiedWebhookWrite')
      IS NOT DISTINCT FROM 'true';

  -- The marker describes only the current write. Strip it on every path so
  -- it can never become persisted provenance for a later maintenance update.
  IF v_new_notes ? 'creditDirectVerifiedWebhookWrite' THEN
    v_new_notes := v_new_notes - 'creditDirectVerifiedWebhookWrite';
    NEW.notes := v_new_notes::text;
  END IF;

  IF NEW.notes IS NOT DISTINCT FROM OLD.notes
     OR OLD.payment_method IS DISTINCT FROM 'credit_direct'
     OR NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_old_notes := COALESCE(NULLIF(trim(OLD.notes), ''), '{}')::jsonb;
    IF jsonb_typeof(v_old_notes) <> 'object' THEN
      v_old_notes := '{}'::jsonb;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_old_notes := '{}'::jsonb;
  END;

  -- Only a signature-verified webhook write may enforce session provenance or
  -- preserve provider-owned audit fields. The remaining tuple ensures the
  -- marked write is a provider-confirmation update, not another webhook event.
  IF NOT v_is_verified_webhook_write
     OR v_new_notes->>'creditDirectClientCompletionStatus'
          IS DISTINCT FROM 'provider_confirmed'
     OR NULLIF(v_new_notes->>'creditDirectProviderConfirmedAt', '') IS NULL
     OR NULLIF(
          COALESCE(
            v_new_notes->>'creditDirectTransactionId',
            v_new_notes->>'credit_directTransactionId'
          ),
          ''
        ) IS NULL THEN
    RETURN NEW;
  END IF;

  -- A re-sign that commits after the webhook read invalidates that stale
  -- paid flip. Failing the update makes the provider retry; the next request
  -- re-reads the new active session and follows the stale-reference path.
  v_old_session := NULLIF(v_old_notes->>'creditDirectSessionId', '');
  v_new_session := NULLIF(v_new_notes->>'creditDirectSessionId', '');
  IF NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND v_old_session IS NOT NULL
     AND v_old_session IS DISTINCT FROM v_new_session THEN
    RAISE EXCEPTION 'stale_credit_direct_session';
  END IF;

  -- Retain unrelated fields added after the webhook read, but discard both
  -- legacy transaction-reference aliases from OLD before overlaying the
  -- provider-confirmed values from this verified delivery.
  v_merged_notes :=
    (
      v_old_notes
      - 'creditDirectTransactionId'
      - 'credit_directTransactionId'
    ) || v_new_notes;

  -- These values describe the latest signed/client attempt. OLD is the
  -- row-locked database value, so it wins over the webhook's stale snapshot.
  FOREACH v_key IN ARRAY ARRAY[
    'creditDirectSessionId',
    'creditDirectSignedAmount',
    'creditDirectSignedAt',
    'creditDirectSupersededReferences',
    'creditDirectClientCompletedReference',
    'creditDirectClientCompletedTransactionId',
    'creditDirectClientCompletedSessionId',
    'creditDirectClientCompletedAt'
  ] LOOP
    IF v_old_notes ? v_key THEN
      v_merged_notes := jsonb_set(
        v_merged_notes,
        ARRAY[v_key],
        v_old_notes->v_key,
        true
      );
    END IF;
  END LOOP;

  -- Provider confirmation is monotonic: no later stale notes write may
  -- downgrade it to awaiting confirmation.
  IF v_old_notes->>'creditDirectClientCompletionStatus' = 'provider_confirmed'
     OR v_new_notes->>'creditDirectClientCompletionStatus' = 'provider_confirmed' THEN
    v_merged_notes := jsonb_set(
      v_merged_notes,
      ARRAY['creditDirectClientCompletionStatus'],
      to_jsonb('provider_confirmed'::text),
      true
    );
  ELSIF v_old_notes ? 'creditDirectClientCompletionStatus' THEN
    v_merged_notes := jsonb_set(
      v_merged_notes,
      ARRAY['creditDirectClientCompletionStatus'],
      v_old_notes->'creditDirectClientCompletionStatus',
      true
    );
  END IF;

  NEW.notes := v_merged_notes::text;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.preserve_credit_direct_payment_audit_notes()
  FROM PUBLIC, anon, authenticated, service_role;
