-- Allow legacy rows with cancelled_at set to normalize shipping_status to
-- cancelled while continuing to block every transition that would reopen them.
CREATE OR REPLACE FUNCTION public.prevent_cancelled_order_reopen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.shipping_status = 'cancelled' OR OLD.cancelled_at IS NOT NULL THEN
    IF NEW.shipping_status IS DISTINCT FROM OLD.shipping_status
      AND NEW.shipping_status IS DISTINCT FROM 'cancelled' THEN
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
