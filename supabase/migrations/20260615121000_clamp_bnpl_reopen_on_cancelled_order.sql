-- N3: extend the reopen backstop to BNPL approval states.
--
-- prevent_cancelled_order_reopen (migration 20260615120000) only clamped
-- payment_status moving into 'paid'/'partially_paid'. A late Credit Direct BNPL
-- webhook could still advance a cancelled order's payment_status to
-- 'bnpl_approved'/'bnpl_pending' (cosmetically reopening it). Add those to the
-- clamp set. The trigger still only acts when the order is already cancelled, so
-- legitimate BNPL flows on non-cancelled orders are unaffected.
CREATE OR REPLACE FUNCTION public.prevent_cancelled_order_reopen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.shipping_status = 'cancelled' THEN
    IF NEW.shipping_status IS DISTINCT FROM 'cancelled' THEN
      NEW.shipping_status := 'cancelled';
    END IF;
    IF NEW.payment_status IN ('paid', 'partially_paid', 'bnpl_approved', 'bnpl_pending')
       AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      NEW.payment_status := OLD.payment_status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
