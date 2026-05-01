CREATE UNIQUE INDEX IF NOT EXISTS transactions_agentic_gateway_reference_unique_idx
  ON public.transactions (gateway_reference)
  WHERE gateway_reference IS NOT NULL
    AND gateway = 'paystack'
    AND (metadata->>'transaction_type') = 'agentic_checkout_payment';
