-- Customer wallet Paystack DVA accounts and non-withdrawable device savings.
-- This migration is append-only and intentionally does not alter existing
-- order-scoped DVA checkout reconciliation.

CREATE TABLE IF NOT EXISTS public.customer_wallet_payment_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'paystack',
  provider_customer_code text NOT NULL,
  provider_subaccount_code text NOT NULL,
  provider_account_id text,
  account_number text NOT NULL,
  account_name text NOT NULL,
  bank_name text NOT NULL,
  bank_slug text,
  currency text NOT NULL DEFAULT 'NGN',
  status text NOT NULL DEFAULT 'active',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  consented_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_wallet_payment_accounts_provider_check
    CHECK (provider = 'paystack'),
  CONSTRAINT customer_wallet_payment_accounts_status_check
    CHECK (status = ANY (ARRAY['active','disabled','pending_review']::text[])),
  CONSTRAINT customer_wallet_payment_accounts_account_number_check
    CHECK (account_number ~ '^[0-9]{10}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_customer_provider
  ON public.customer_wallet_payment_accounts (merchant_id, customer_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_provider_account
  ON public.customer_wallet_payment_accounts (provider, account_number);

CREATE TABLE IF NOT EXISTS public.customer_savings_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE RESTRICT,
  title text NOT NULL,
  product_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_amount numeric(12,2) NOT NULL,
  current_amount numeric(12,2) NOT NULL DEFAULT 0,
  initial_contribution_amount numeric(12,2) NOT NULL DEFAULT 0,
  contribution_amount numeric(12,2) NOT NULL,
  contribution_frequency text NOT NULL,
  preferred_debit_time time,
  start_date date NOT NULL,
  maturity_date date NOT NULL,
  source_mode text NOT NULL,
  saved_payment_method_id uuid REFERENCES public.customer_saved_payment_methods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  break_fee_percent numeric(5,2) NOT NULL DEFAULT 0,
  terms_accepted_at timestamptz NOT NULL,
  non_withdrawable_accepted_at timestamptz NOT NULL,
  auto_debit_authorized_at timestamptz,
  early_end_fee_accepted_at timestamptz,
  completed_at timestamptz,
  future_debits_cancelled_at timestamptz,
  cancelled_at timestamptz,
  spent_at timestamptz,
  applied_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_savings_goals_amounts_check CHECK (
    target_amount > 0
    AND current_amount >= 0
    AND current_amount <= target_amount
    AND initial_contribution_amount >= 0
    AND contribution_amount > 0
  ),
  CONSTRAINT customer_savings_goals_frequency_check
    CHECK (contribution_frequency = ANY (ARRAY['daily','weekly','monthly']::text[])),
  CONSTRAINT customer_savings_goals_source_mode_check
    CHECK (source_mode = ANY (ARRAY['manual','auto_debit']::text[])),
  CONSTRAINT customer_savings_goals_status_check
    CHECK (status = ANY (ARRAY['active','paused','completed','cancelled','spent']::text[])),
  CONSTRAINT customer_savings_goals_dates_check CHECK (maturity_date >= start_date),
  CONSTRAINT customer_savings_goals_auto_debit_consent_check CHECK (
    source_mode <> 'auto_debit'
    OR (saved_payment_method_id IS NOT NULL AND auto_debit_authorized_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_customer_status
  ON public.customer_savings_goals (merchant_id, customer_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_product
  ON public.customer_savings_goals (merchant_id, product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_variant
  ON public.customer_savings_goals (variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_saved_payment_method
  ON public.customer_savings_goals (saved_payment_method_id)
  WHERE saved_payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_applied_order
  ON public.customer_savings_goals (applied_order_id)
  WHERE applied_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_due_autodebit
  ON public.customer_savings_goals (status, source_mode, start_date, preferred_debit_time)
  WHERE source_mode = 'auto_debit';

CREATE TABLE IF NOT EXISTS public.customer_savings_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.customer_savings_goals(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  wallet_transaction_id uuid REFERENCES public.customer_wallet_transactions(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  saved_payment_method_id uuid REFERENCES public.customer_saved_payment_methods(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL,
  source_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz,
  processed_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_savings_contributions_amount_check CHECK (amount > 0),
  CONSTRAINT customer_savings_contributions_source_type_check
    CHECK (source_type = ANY (ARRAY['wallet','paystack_authorization','manual_adjustment']::text[])),
  CONSTRAINT customer_savings_contributions_status_check
    CHECK (status = ANY (ARRAY['pending','processing','completed','failed','cancelled']::text[]))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_savings_contributions_idempotency
  ON public.customer_savings_contributions (merchant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_goal_created
  ON public.customer_savings_contributions (goal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_customer
  ON public.customer_savings_contributions (merchant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_wallet_transaction
  ON public.customer_savings_contributions (wallet_transaction_id)
  WHERE wallet_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_transaction
  ON public.customer_savings_contributions (transaction_id)
  WHERE transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_saved_payment_method
  ON public.customer_savings_contributions (saved_payment_method_id)
  WHERE saved_payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_due
  ON public.customer_savings_contributions (status, scheduled_for)
  WHERE status = 'pending' AND source_type = 'paystack_authorization';

CREATE TABLE IF NOT EXISTS public.customer_savings_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.customer_savings_goals(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_savings_redemptions_amount_check CHECK (amount > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_savings_redemptions_order
  ON public.customer_savings_redemptions (order_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_savings_redemptions_idempotency
  ON public.customer_savings_redemptions (merchant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_customer_savings_redemptions_goal
  ON public.customer_savings_redemptions (goal_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_redemptions_customer
  ON public.customer_savings_redemptions (merchant_id, customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.customer_savings_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.customer_savings_goals(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_type text NOT NULL DEFAULT 'customer',
  actor_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_savings_events_actor_type_check
    CHECK (actor_type = ANY (ARRAY['customer','system','merchant_staff']::text[]))
);

CREATE INDEX IF NOT EXISTS idx_customer_savings_events_goal
  ON public.customer_savings_events (goal_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_events_customer
  ON public.customer_savings_events (merchant_id, customer_id);

-- Keep these metadata transaction_type values in sync with
-- apps/web/src/lib/customer-savings-paystack-webhook.ts,
-- apps/web/src/lib/customer-savings-auto-debit.ts, and
-- apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts.
CREATE UNIQUE INDEX IF NOT EXISTS transactions_wallet_savings_gateway_reference_unique_idx
  ON public.transactions (gateway, gateway_reference)
  WHERE gateway_reference IS NOT NULL
    AND gateway IN ('paystack', 'korapay')
    AND (
      metadata->>'transaction_type' = ANY (
        ARRAY[
          'wallet_topup'::text,
          'savings_authorization'::text,
          'savings_auto_debit'::text
        ]
      )
    );

ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS wallet_paystack_dva_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_auto_debit_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_break_fee_enabled boolean DEFAULT false;

COMMENT ON TABLE public.customer_wallet_payment_accounts IS
  'Customer-specific Paystack dedicated virtual accounts for reusable wallet funding per merchant.';

COMMENT ON TABLE public.customer_savings_goals IS
  'Non-withdrawable customer device savings reserved toward merchant purchases.';

COMMENT ON TABLE public.customer_savings_contributions IS
  'Ledger of wallet and Paystack authorization contributions into customer savings goals.';

COMMENT ON TABLE public.customer_savings_redemptions IS
  'Idempotent application of reserved savings to orders.';

COMMENT ON TABLE public.customer_savings_events IS
  'Audit trail for customer savings goal lifecycle and contribution events.';

COMMENT ON COLUMN public.merchant_feature_settings.wallet_paystack_dva_enabled IS
  'Enables customer Paystack dedicated virtual account creation and display for wallet funding.';

COMMENT ON COLUMN public.merchant_feature_settings.customer_device_savings_enabled IS
  'Enables non-withdrawable customer device savings wallet features.';

COMMENT ON COLUMN public.merchant_feature_settings.customer_device_savings_auto_debit_enabled IS
  'Enables scheduled Paystack saved-authorization charges for customer device savings.';

COMMENT ON COLUMN public.merchant_feature_settings.customer_device_savings_break_fee_enabled IS
  'Enables configured early-end fee copy and calculation for customer device savings.';

DROP TRIGGER IF EXISTS customer_wallet_payment_accounts_updated_at
  ON public.customer_wallet_payment_accounts;
CREATE TRIGGER customer_wallet_payment_accounts_updated_at
  BEFORE UPDATE ON public.customer_wallet_payment_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_savings_goals_updated_at
  ON public.customer_savings_goals;
CREATE TRIGGER customer_savings_goals_updated_at
  BEFORE UPDATE ON public.customer_savings_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS customer_savings_contributions_updated_at
  ON public.customer_savings_contributions;
CREATE TRIGGER customer_savings_contributions_updated_at
  BEFORE UPDATE ON public.customer_savings_contributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.customer_wallet_payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_savings_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_savings_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_savings_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.customer_wallet_payment_accounts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_savings_goals FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_savings_contributions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_savings_redemptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.customer_savings_events FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.customer_wallet_payment_accounts TO authenticated;
GRANT SELECT ON TABLE public.customer_savings_goals TO authenticated;
GRANT SELECT ON TABLE public.customer_savings_contributions TO authenticated;
GRANT SELECT ON TABLE public.customer_savings_redemptions TO authenticated;
GRANT SELECT ON TABLE public.customer_savings_events TO authenticated;

GRANT ALL ON TABLE public.customer_wallet_payment_accounts TO service_role;
GRANT ALL ON TABLE public.customer_savings_goals TO service_role;
GRANT ALL ON TABLE public.customer_savings_contributions TO service_role;
GRANT ALL ON TABLE public.customer_savings_redemptions TO service_role;
GRANT ALL ON TABLE public.customer_savings_events TO service_role;

DROP POLICY IF EXISTS customer_wallet_payment_accounts_customer_select
  ON public.customer_wallet_payment_accounts;
CREATE POLICY customer_wallet_payment_accounts_customer_select
  ON public.customer_wallet_payment_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_wallet_payment_accounts.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = customer_wallet_payment_accounts.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_goals_customer_select
  ON public.customer_savings_goals;
CREATE POLICY customer_savings_goals_customer_select
  ON public.customer_savings_goals
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_goals.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = customer_savings_goals.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_contributions_customer_select
  ON public.customer_savings_contributions;
CREATE POLICY customer_savings_contributions_customer_select
  ON public.customer_savings_contributions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_contributions.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = customer_savings_contributions.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_redemptions_customer_select
  ON public.customer_savings_redemptions;
CREATE POLICY customer_savings_redemptions_customer_select
  ON public.customer_savings_redemptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_redemptions.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = customer_savings_redemptions.merchant_id
    )
  );

DROP POLICY IF EXISTS customer_savings_events_customer_select
  ON public.customer_savings_events;
CREATE POLICY customer_savings_events_customer_select
  ON public.customer_savings_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = customer_savings_events.customer_id
        AND c.user_id = auth.uid()
        AND c.merchant_id = customer_savings_events.merchant_id
    )
  );
