-- Keep the amount and customer identity advertised during each assignment
-- immutable after expiry so delayed webhooks can match historical aliases.

ALTER TABLE public.order_payment_accounts
  ADD COLUMN IF NOT EXISTS assignment_customer_email text;

UPDATE public.order_payment_accounts AS account
SET assignment_customer_email = lower(trim(orders.customer_email))
FROM public.orders AS orders
WHERE orders.id = account.order_id
  AND account.provider = 'paystack'
  AND account.assignment_customer_email IS NULL;

CREATE OR REPLACE FUNCTION public.snapshot_paystack_order_alias_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider <> 'paystack' OR NEW.assignment_customer_email IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('baci_order_payment:' || NEW.order_id::text, 0)
  );
  SELECT lower(trim(orders.customer_email))
  INTO NEW.assignment_customer_email
  FROM public.orders AS orders
  WHERE orders.id = NEW.order_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.freeze_expired_paystack_alias_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS a_snapshot_paystack_order_alias_email
  ON public.order_payment_accounts;
CREATE TRIGGER a_snapshot_paystack_order_alias_email
  BEFORE INSERT ON public.order_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.snapshot_paystack_order_alias_email();

DROP TRIGGER IF EXISTS freeze_expired_paystack_alias_snapshot
  ON public.order_payment_accounts;
CREATE TRIGGER freeze_expired_paystack_alias_snapshot
  BEFORE UPDATE OF payable_amount, assignment_customer_email
  ON public.order_payment_accounts
  FOR EACH ROW EXECUTE FUNCTION public.freeze_expired_paystack_alias_snapshot();

REVOKE ALL ON FUNCTION public.snapshot_paystack_order_alias_email() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.freeze_expired_paystack_alias_snapshot() FROM PUBLIC;
