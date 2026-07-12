-- Legacy/imported cancellations can have cancelled_at set while their shipping
-- status is still pending. Preserve both status fields when a late payment
-- attempts to reopen any order carrying either cancellation signal.
CREATE OR REPLACE FUNCTION public.prevent_cancelled_order_reopen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.shipping_status = 'cancelled' OR OLD.cancelled_at IS NOT NULL THEN
    IF NEW.shipping_status IS DISTINCT FROM OLD.shipping_status THEN
      NEW.shipping_status := OLD.shipping_status;
    END IF;

    IF NEW.payment_status IN (
      'paid',
      'partially_paid',
      'bnpl_approved',
      'bnpl_pending'
    ) AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      NEW.payment_status := OLD.payment_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
