-- The snapshot migration populated assignment_customer_email for existing
-- aliases from the order's current email. Those values cannot prove the email
-- used when the Paystack assignment was created, so do not let them drive
-- delayed webhook matching. New rows continue to be captured by the insert
-- trigger with an assignment-time value.

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', true);

CREATE OR REPLACE FUNCTION public.freeze_expired_paystack_alias_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- Trusted migrations and backend repair paths may clear an untrusted
  -- historical snapshot. Authenticated callers still cannot rewrite an
  -- expired assignment's immutable fields.
  IF COALESCE(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.provider = 'paystack'
    AND COALESCE(
      OLD.expires_at,
      OLD.assigned_at + interval '90 minutes',
      OLD.created_at + interval '90 minutes'
    ) <= now() THEN
    NEW.payable_amount := OLD.payable_amount;
    NEW.assignment_customer_email := OLD.assignment_customer_email;
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.order_payment_accounts AS account
SET assignment_customer_email = NULL
WHERE account.provider = 'paystack'
  AND account.assignment_customer_email IS NOT NULL
  AND account.created_at < TIMESTAMPTZ '2026-08-25 22:30:00+00';

REVOKE ALL ON FUNCTION public.freeze_expired_paystack_alias_snapshot()
  FROM PUBLIC;
