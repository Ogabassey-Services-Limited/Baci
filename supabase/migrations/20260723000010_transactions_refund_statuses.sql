-- Allow a transaction to record that its money was given back.
--
-- `transactions_status_check` permitted only
-- ('pending','processing','completed','failed','cancelled'). There was no way to
-- say "this capture was refunded" — so the guard that makes a refunded PayPal
-- capture non-settleable (`markPaypalTransactionRefunded`, which writes
-- status='refunded') violated the CHECK constraint, and because that write is
-- best-effort by design the failure was logged and swallowed. The row stayed
-- `completed`, a later retry could pick the same PayPal order back up, see it
-- COMPLETED at PayPal, and settle the order against money we had already returned.
-- The unit tests never caught it because they mock Supabase.
--
-- Two new terminal-ish states, both deliberately OUTSIDE the ('pending','completed')
-- set that `loadPaypalCaptureContext` admits, so neither can be settled against:
--
--   refunded        — PayPal confirmed the refund COMPLETED. The money is back.
--   refund_pending  — PayPal ACCEPTED the refund but has not completed it. In BYOK
--                     this is common: the refund draws on the merchant's own PayPal
--                     balance, so an unfunded balance leaves it in flight. It is not
--                     a success (the buyer does not have the money yet) and NOT a
--                     failure (issuing a second refund would pay them twice). It
--                     needs re-polling, and it needs to be queryable to be re-polled.

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'pending'::text,
        'processing'::text,
        'completed'::text,
        'failed'::text,
        'cancelled'::text,
        'refunded'::text,
        'refund_pending'::text
      ]
    )
  ) NOT VALID;

ALTER TABLE public.transactions
  VALIDATE CONSTRAINT transactions_status_check;

COMMENT ON CONSTRAINT transactions_status_check ON public.transactions IS
  'Includes refunded/refund_pending so a returned capture is non-settleable. refund_pending means PayPal accepted the refund but has not completed it — re-poll, never re-refund.';
