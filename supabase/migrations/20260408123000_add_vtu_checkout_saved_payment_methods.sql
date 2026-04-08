-- Add support for VTU checkout processing states and saved customer payment methods

ALTER TABLE public.vtu_transactions
  DROP CONSTRAINT IF EXISTS vtu_transactions_status_check;

ALTER TABLE public.vtu_transactions
  ADD CONSTRAINT vtu_transactions_status_check
  CHECK (status IN ('pending', 'processing', 'successful', 'failed'));

CREATE TABLE IF NOT EXISTS public.customer_saved_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('paystack')),
  provider_customer_email TEXT NOT NULL,
  authorization_code TEXT NOT NULL,
  authorization_signature TEXT NOT NULL,
  authorization_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  brand TEXT,
  bank TEXT,
  card_type TEXT,
  last4 TEXT,
  exp_month TEXT,
  exp_year TEXT,
  country_code TEXT,
  reusable BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  disabled_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, provider, authorization_signature)
);

CREATE INDEX IF NOT EXISTS idx_customer_saved_payment_methods_customer
  ON public.customer_saved_payment_methods(customer_id, is_active, is_default);

CREATE INDEX IF NOT EXISTS idx_customer_saved_payment_methods_merchant
  ON public.customer_saved_payment_methods(merchant_id);

ALTER TABLE public.customer_saved_payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can view their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can view their own saved payment methods"
  ON public.customer_saved_payment_methods FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = auth.uid()
    )
    OR merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can insert their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can insert their own saved payment methods"
  ON public.customer_saved_payment_methods FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = auth.uid()
    )
    OR merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can update their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can update their own saved payment methods"
  ON public.customer_saved_payment_methods FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = auth.uid()
    )
    OR merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Customers can delete their own saved payment methods"
  ON public.customer_saved_payment_methods;
CREATE POLICY "Customers can delete their own saved payment methods"
  ON public.customer_saved_payment_methods FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers
      WHERE customers.id = customer_saved_payment_methods.customer_id
        AND customers.user_id = auth.uid()
    )
    OR merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trigger_customer_saved_payment_methods_updated_at
  ON public.customer_saved_payment_methods;
CREATE TRIGGER trigger_customer_saved_payment_methods_updated_at
  BEFORE UPDATE ON public.customer_saved_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.customer_saved_payment_methods IS
  'Reusable customer payment authorizations captured from supported gateways.';

-- Index for customer VTU history queries
CREATE INDEX IF NOT EXISTS idx_vtu_transactions_customer_history
  ON public.vtu_transactions(merchant_id, customer_id, created_at DESC);
