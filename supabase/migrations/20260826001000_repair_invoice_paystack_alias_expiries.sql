-- Restore invoice DVA terms that were truncated by the original 90-minute
-- clamp migration. Immediate invoices use the order issue timestamp plus the
-- fourteen-day term; invoices with an explicit payment_due_date use that
-- persisted due date instead.
UPDATE public.order_payment_accounts AS account
SET expires_at = invoice_expiry.expires_at
FROM (
  SELECT
    account.id,
    CASE
      WHEN orders.payment_due_date IS NOT NULL
        THEN orders.payment_due_date::timestamptz
      ELSE COALESCE(orders.created_at, account.assigned_at, account.created_at)
        + interval '14 days'
    END AS expires_at,
    COALESCE(account.assigned_at, account.created_at) + interval '90 minutes'
      AS clamped_expiry
  FROM public.order_payment_accounts AS account
  JOIN public.orders AS orders ON orders.id = account.order_id
  WHERE account.provider = 'paystack'
    AND lower(trim(COALESCE(orders.payment_method, ''))) = 'invoice'
    AND account.expires_at IS NOT NULL
) AS invoice_expiry
WHERE account.id = invoice_expiry.id
  AND account.expires_at = invoice_expiry.clamped_expiry
  AND invoice_expiry.expires_at > invoice_expiry.clamped_expiry;
