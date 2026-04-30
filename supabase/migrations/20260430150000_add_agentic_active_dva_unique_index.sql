CREATE UNIQUE INDEX IF NOT EXISTS checkout_sessions_agentic_active_dva_unique_idx
  ON public.checkout_sessions (merchant_id, virtual_account_number)
  WHERE virtual_account_number IS NOT NULL
    AND status IN ('pending', 'processing')
    AND (metadata -> 'agentic' ->> 'payment_state') IN (
      'payment_account_ready',
      'order_finalizing',
      'payment_pending'
    );
