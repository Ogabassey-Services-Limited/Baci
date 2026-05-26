# Ogabassey Wallet, Device Savings, and Paystack DVA/Auto-Debit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Use `react-native-design` before Phase 4 and Phase 5 mobile UI work. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Ogabassey customer wallet redesign, Paystack DVA wallet funding, non-withdrawable device savings, Manage Cards, and Paystack saved-authorization auto-debit path without changing unrelated Baci storefront behavior.

**Architecture:** Add append-only Supabase tables/RPCs for wallet funding accounts and device savings, then expose authenticated storefront APIs that mobile consumes. Preserve existing order-scoped DVA checkout reconciliation, add a separate customer wallet DVA matcher, and keep all savings funds in Baci ledger state until applied to a matching Ogabassey order.

**Tech Stack:** Next.js API routes in `apps/web`, Supabase PostgreSQL/RLS/RPCs, Paystack DVA/transaction/authorization APIs, Expo React Native mobile storefront, Jest/Vitest, Biome/Turborepo.

---

## Objective

Implement the Ogabassey customer wallet redesign and device savings flow in an isolated worktree from `origin/main`, using Paystack as the first payment provider:

- Replace the current generic wallet screen with a Chowdeck-inspired Ogabassey wallet using the Figma red/black direction.
- Give each eligible customer a Paystack Dedicated Virtual Account for wallet funding and manual savings funding.
- Add product-backed "device savings" goals that are non-withdrawable and usable toward Ogabassey purchases.
- Remove all withdraw/refund-to-bank actions from the customer wallet UI.
- Add a "Start Savings" flow matching the provided Figma screenshots.
- Move "Manage Cards" into its own screen.
- Support manual savings first, then Paystack recurring debit using saved Paystack authorizations behind a separate feature flag.

## Source Context

- Worktree requirement: implement from a clean isolated worktree based on `origin/main`.
- Current implementation worktree:
  - Path: `/Users/mac/Baci-app/.worktrees/ogabassey-wallet-savings-implementation`
  - Branch: `codex/ogabassey-wallet-savings-implementation`
  - Current base/head after implementation fast-forward: `origin/main` at `4650deeb47429ddcd6b25a09f5962ef3db64e7c8`
  - The worktree was fast-forwarded after creation because `origin/main` advanced while this plan was being written and reviewed.
- Do not disturb the root checkout at `/Users/mac/Baci-app`; it currently has unrelated untracked files.
- Payment evidence from the earlier production check:
  - A ₦20,000 Ogabassey wallet top-up went through Paystack Checkout with `bank_transfer`.
  - Paystack reported ₦400 in fees, so the merchant settlement was ₦19,600.
  - The implementation must stop routing bank-transfer wallet funding through regular Checkout when a DVA is available.
- Paystack documentation assumptions checked on 2026-05-21:
  - Primary sources: `https://paystack.com/pricing`, `https://paystack.com/docs/payments/dedicated-virtual-accounts/`, and `https://paystack.com/docs/payments/recurring-charges/`.
  - Dedicated Virtual Accounts create customer bank accounts and transfers to those accounts are recorded as customer transactions.
  - DVA requires a Paystack customer and customer consent for generating the bank account.
  - Paystack recurring charges can reuse a saved authorization after the first successful card payment; Direct Debit uses an authorization request flow in Nigeria.
  - Paystack subscriptions can bill automatically, but they are plan-centric. Ogabassey savings amounts and maturity dates are product/customer-specific, so use our own scheduler with `transaction/charge_authorization`, not Paystack Subscriptions.
  - Paystack pricing page currently shows normal local transaction pricing as `1.5% + ₦100`, capped, and Paystack DVA pricing as `1% capped at ₦300`. Treat the DVA pricing as the intended commercial term to verify with the live Paystack dashboard before launch.
- Design source:
  - Figma savings flow: `https://www.figma.com/design/e49f3Fl0z4vmqXjaXeHZpo/Bassey-e-commerce-store--Copy-?node-id=302-6319&p=f&t=V41qGOLyDGLOJDQf-0`
  - Wallet direction: Chowdeck-inspired wallet layout using Ogabassey red/black, not Chowdeck green.

## Current Code Reality

### Existing wallet API and ledger

- `apps/web/src/app/api/storefront/customer/wallet/route.ts`
  - Returns `balance`, `totalEarned`, `totalRedeemed`, `transactions`, and `hasWallet`.
  - Resolves the authenticated user to a `customers` row by `user_id`, then email fallback.
  - Reads `customer_wallets` and `customer_wallet_transactions`.
- `apps/web/src/app/api/storefront/customer/wallet/top-up/initialize/route.ts`
  - Creates a `transactions` row with metadata `transaction_type: wallet_topup`.
  - Initializes Paystack Checkout or Korapay Checkout.
  - Current Paystack wallet top-up path is Checkout, so bank transfers use regular Paystack transaction pricing.
- `apps/web/src/app/api/storefront/customer/wallet/top-up/confirm/route.ts`
  - Verifies the gateway reference and credits the wallet via `creditWalletTopUp`.
- `apps/web/src/lib/customer-wallet-top-up.ts`
  - Defines `WALLET_TOP_UP_TRANSACTION_TYPE = 'wallet_topup'`.
  - Calls `credit_customer_wallet`.
  - Uses the `transactions.id` as `source_id`, which protects idempotency.
- `apps/web/src/app/api/payments/webhook/route.ts`
  - Verifies Paystack and Korapay webhook signatures.
  - Verifies gateway payment server-side.
  - Handles wallet top-ups if transaction metadata contains `transaction_type: wallet_topup`.
  - Captures reusable Paystack authorizations through `upsertPaystackAuthorization`.

### Existing Paystack utilities

- `apps/web/src/lib/paystack.ts`
  - Already has:
    - `initializeTransaction`
    - `verifyTransaction`
    - `chargeAuthorization`
    - `createOrGetCustomer`
    - `createDedicatedAccount`
    - `getDedicatedAccounts`
  - Existing DVA helper defaults to `preferredBank = 'wema-bank'`; the agentic helper currently falls back to a Titan slug after Wema fails. Do not hardcode a Titan API slug from UI copy. Use a configurable preferred bank, verify the accepted slug against the live Paystack integration before launch, and display the bank name returned by Paystack.
- `apps/web/src/lib/customer-saved-payment-methods.ts`
  - Stores Paystack reusable authorization data in `customer_saved_payment_methods`.
  - Lists active saved cards.
  - Retrieves a saved method by id.
  - Upserts by `customer_id,provider,authorization_signature`.
- `apps/web/src/app/api/vtu/checkout/charge-saved-card/route.ts`
  - Existing example of charging a saved Paystack authorization.
  - Reuse its structure for savings auto-debit, but do not mix VTU transaction concepts into savings code.

### Existing mobile wallet UI

- `apps/mobile-storefront/app/wallet/index.tsx`
  - Owns wallet screen state.
  - Opens a top-up panel and routes to `/payment-gateway`.
  - Owns loyalty redemption state.
- `apps/mobile-storefront/components/wallet/WalletContent.tsx`
  - Current hero card shows "Wallet Balance".
  - Has actions "Add Funds" and disabled "Withdraw".
  - Shows loyalty card below.
  - Must be replaced with the new wallet/savings layout.
- `apps/mobile-storefront/hooks/use-wallet.ts`
  - Fetches `customer_wallets.available_balance` and `customers.loyalty_points` directly from Supabase.
  - Subscribes to `customer_wallets` and `customers` changes.
  - Must include savings data and invalidate on savings goal/contribution changes.
- `apps/mobile-storefront/lib/wallet-top-up.ts`
  - Client for Checkout-based wallet top-up.
  - Add a DVA funding-account client instead of removing this immediately; Checkout remains fallback while DVA flag is off.

### Existing checkout bank transfer behavior

- `apps/mobile-storefront/app/checkout.tsx`
  - `selectedPayment === 'bank_transfer'` initializes `/api/payments/initialize` with `gateway: 'paystack'` and `payment_type: 'dva'`.
  - It navigates to `/bank-transfer` with `initData.dva` or `initData.virtual_account`.
- `apps/web/src/app/api/payments/initialize/route.ts`
  - When `gateway === 'paystack'` and `payment_type === 'dva'`, it creates a Paystack Dedicated Virtual Account, persists it to `order_payment_accounts`, creates the payment transaction, and returns the account details.
- `apps/mobile-storefront/app/bank-transfer/index.tsx`
  - Displays bank name, account number, and account name directly. It does not send the customer into Paystack hosted Checkout for bank transfer.
- `apps/web/src/lib/payments/confirm-paystack-dva-by-order-account.ts`
  - The webhook matcher already matches paid Paystack DVA transfers back to `order_payment_accounts`.

Conclusion: product checkout bank transfer is already DVA-based. This plan must preserve that behavior. The new wallet DVA is a customer/merchant funding account for wallet and savings; do not replace existing order DVA reconciliation with the wallet DVA unless a separate future plan redesigns checkout settlement.

### Wallet DVA during checkout

If a customer funds their customer wallet DVA while checking out, the first operation is always wallet credit:

1. Paystack webhook verifies the transfer.
2. The wallet DVA matcher credits the customer's wallet once using the verified Paystack reference and the wallet transaction idempotency guard.
3. Checkout only debits that wallet balance if there is an explicit wallet checkout intent for the order.

Do not silently treat every wallet DVA transfer as payment for the most recent cart. A customer DVA is reusable, so matching by customer, amount, or "latest checkout" can misapply funds.

Allowed checkout models:

- Default safe model: credit wallet, refresh wallet balance, and require the customer to tap `Pay with wallet` or resubmit checkout. The existing `redeem_wallet_for_order` and `finalize_wallet_order_payment` path then debits the wallet once by `order_id`.
- Optional future model: create a `pending_wallet_checkout_intents` table keyed by `order_id`, `customer_id`, `merchant_id`, amount, and expiry. When the wallet DVA webhook credits funds, a server worker may apply funds to that pending order only if the amount and unexpired intent match exactly. The worker must call the same wallet redemption RPC and must be idempotent by `order_id`.

Never both mark the order paid from the DVA webhook and also credit the wallet for the same Paystack reference. Pick one ledger path. For customer wallet DVA funding, the ledger path is `Paystack transfer -> wallet credit -> wallet debit to order`.

## Product Decisions

### Wallet balances

- Top hero label: `Total Balance`.
- Top hero amount: `earningsBalance + savingsBalance`.
- Bottom summary row:
  - Left: `Earnings`
    - Use customer wallet `available_balance`.
    - This covers cashback, wallet top-ups, refunds, and other spendable store credit.
  - Right: `Savings`
    - Sum reserved savings for goals in `active`, `paused`, and `completed`.
    - A customer action labelled cancel must mean "cancel future debits", not "remove existing reserved funds". Funded goals whose future debits are cancelled stay `paused` and remain in savings balance until applied to an Ogabassey order.
    - Exclude only zero-funded `cancelled` goals and closed/spent goals.
- Under summary row:
  - `Loyalty Points`
  - Show points and redeem affordance if existing redemption remains enabled.

### Terminology

- Use `Savings`, `Device savings`, `Start Savings`, `Quick save`, and `Add to savings`.
- Do not use `Withdraw`, `Refund to bank`, `Cash out`, or `Payout` in customer wallet UI.
- Do not use `Interest 0%`.
- Replace Figma's `initial deposit` wording with `initial contribution`.
- Replace Figma's debit consent copy with:
  - Manual mode: "I understand savings are reserved for my selected Ogabassey purchase and cannot be withdrawn to a bank account."
  - Auto-debit mode: "I authorize Ogabassey to charge my selected Paystack payment method on this schedule until I pause, cancel future debits, or complete the target."
- The Figma "5% breaking fee" must be treated as a configurable policy and only shown if business/legal confirms it. If enabled, copy must say the fee applies only when ending the plan early, not as a withdrawal feature.

### Payment routing

- Primary funding path: Paystack DVA per customer and merchant.
- Fallback funding path: existing Paystack/Korapay Checkout top-up, guarded by feature flags.
- Manual savings contributions:
  - First consume available wallet earnings if the customer has enough balance.
  - If balance is insufficient, show the customer's DVA instructions to fund the wallet, then let the customer allocate funds to the savings goal after the webhook credits the wallet.
- Auto-debit:
  - Use existing saved Paystack authorization rows.
  - Scheduler charges due contributions using `chargeAuthorization`.
  - Do not use Paystack Subscriptions for savings because plans vary by selected product, daily/weekly/monthly contribution amount, start date, maturity date, pauses, and target amount.

### Compliance boundary

- This is a store-credit device savings plan, not a regulated deposit account.
- Funds are not withdrawable.
- Funds are reserved toward Ogabassey purchases.
- Pausing/cancelling stops future scheduled debits; it does not release funds to bank.
- Releasing saved funds happens only into an Ogabassey order/payment flow.
- All consent timestamps must be stored server-side.

## Feature Flags

Add or reuse feature flags through the existing merchant feature settings path:

- `wallet_paystack_dva_enabled`
  - Enables customer DVA creation and display.
- `customer_device_savings_enabled`
  - Enables savings UI, APIs, and savings balance in wallet.
- `customer_device_savings_auto_debit_enabled`
  - Enables Paystack saved-card auto-debit.
- `customer_device_savings_break_fee_enabled`
  - Enables early-end fee copy and policy calculation.

If the repo does not currently support arbitrary merchant feature flags, add explicit nullable boolean columns to `merchant_feature_settings` in the same append-only migration. Default all new flags to `false` except in local test fixtures.

## Data Model

Create append-only migrations. Do not edit existing migration files.

### Migration 1

File: `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`

Add table `customer_wallet_payment_accounts`:

```sql
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
```

Indexes and uniqueness:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_customer_provider
  ON public.customer_wallet_payment_accounts (merchant_id, customer_id, provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_provider_account
  ON public.customer_wallet_payment_accounts (provider, account_number);

CREATE INDEX IF NOT EXISTS idx_customer_wallet_payment_accounts_merchant_customer
  ON public.customer_wallet_payment_accounts (merchant_id, customer_id);
```

Add table `customer_savings_goals`:

```sql
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
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_customer_status
  ON public.customer_savings_goals (merchant_id, customer_id, status);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_product
  ON public.customer_savings_goals (merchant_id, product_id, variant_id);

CREATE INDEX IF NOT EXISTS idx_customer_savings_goals_due_autodebit
  ON public.customer_savings_goals (status, source_mode, start_date, preferred_debit_time)
  WHERE source_mode = 'auto_debit';
```

Add table `customer_savings_contributions`:

```sql
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
```

Indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_savings_contributions_idempotency
  ON public.customer_savings_contributions (merchant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_goal_created
  ON public.customer_savings_contributions (goal_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_savings_contributions_due
  ON public.customer_savings_contributions (status, scheduled_for)
  WHERE status = 'pending' AND source_type = 'paystack_authorization';
```

Add table `customer_savings_redemptions` for applying reserved savings to orders:

```sql
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

CREATE INDEX IF NOT EXISTS idx_customer_savings_redemptions_customer
  ON public.customer_savings_redemptions (merchant_id, customer_id, created_at DESC);
```

Add narrow Paystack/Korapay reference uniqueness for wallet and savings references:

```sql
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
```

Reason: the existing repo has `transactions_order_gateway_reference_key` on `(order_id, gateway_reference)`, plus narrow agentic and Klump indexes. That does not make `gateway_reference` globally unique for wallet top-ups with `order_id = null`, because PostgreSQL unique indexes allow multiple `NULL` values in the indexed key. Wallet DVA and savings references need their own narrow uniqueness guard.

Add table `customer_savings_events` for audit history:

```sql
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
```

RLS:

- Enable RLS on all five new tables.
- Customer SELECT policy must only allow rows where:
  - `customers.id = table.customer_id`
  - `customers.user_id = auth.uid()`
  - `customers.merchant_id = table.merchant_id`
- Customer INSERT/UPDATE/DELETE should not be granted directly for these tables. Mutations must go through server APIs/RPCs.
- Merchant staff SELECT can follow the existing merchant staff policy style only if needed by dashboard later. The mobile implementation does not require merchant dashboard access.
- Service role keeps full access.

Triggers:

- Add `updated_at` trigger to all mutable tables using existing `public.update_updated_at_column()`.

Feature settings:

```sql
ALTER TABLE public.merchant_feature_settings
  ADD COLUMN IF NOT EXISTS wallet_paystack_dva_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_auto_debit_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_device_savings_break_fee_enabled boolean DEFAULT false;
```

### Migration 2

File: `supabase/migrations/20260521131000_customer_device_savings_rpcs.sql`

Add `public.create_customer_savings_goal(...)`:

- Security definer.
- Validate `p_customer_id`, `p_merchant_id`, `p_product_id`, `p_variant_id`.
- If caller is not `service_role`, require `auth.uid()` and require the customer row to belong to that auth user.
- Verify product belongs to merchant and is active/visible enough for customer purchase.
- If variant is passed, verify variant belongs to product and merchant.
- Validate amounts:
  - `target_amount > 0`
  - `contribution_amount > 0`
  - `initial_contribution_amount >= 0`
  - `initial_contribution_amount <= target_amount`
- Validate start/maturity dates.
- Validate all required consent timestamps are present.
- For `source_mode = 'auto_debit'`, verify saved payment method:
  - belongs to same merchant/customer,
  - provider is Paystack,
  - `is_active = true`,
  - `reusable = true`.
- Insert goal.
- Insert `customer_savings_events` event `goal_created`.
- If `source_mode = 'manual'` and `initial_contribution_amount > 0`, call the wallet allocation RPC below inside the same transaction.
- If `source_mode = 'auto_debit'` and `initial_contribution_amount > 0`, do not silently require wallet balance. The API route must create the goal and immediately charge the selected saved Paystack authorization through the same auto-debit contribution processor using idempotency key `savings:<goalId>:initial`. If that charge cannot be completed or left in a recoverable `processing` state, return a typed failure and leave the goal paused with `future_debits_cancelled_at` unset and an event explaining that the initial auto-debit failed.

Add `public.allocate_customer_savings_contribution(...)`:

Signature:

```sql
CREATE OR REPLACE FUNCTION public.allocate_customer_savings_contribution(
  p_goal_id uuid,
  p_customer_id uuid,
  p_merchant_id uuid,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_idempotency_key text,
  p_description text DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  goal_current_amount numeric,
  wallet_balance numeric,
  contribution_id uuid,
  wallet_transaction_id uuid,
  goal_status text
)
```

Behavior:

- Reject non-positive amounts.
- Reject missing idempotency key.
- Require customer/merchant ownership.
- If caller is not service role, require `customers.user_id = auth.uid()`.
- Take advisory lock on `customer_savings_contribution:` plus `p_idempotency_key`.
- `p_source_id` is required for `source_type = 'paystack_authorization'` and may be null for `source_type = 'wallet'`; manual wallet contributions dedupe by `(merchant_id, idempotency_key)` and request fingerprint, not by an external payment source id.
- If a contribution exists for `(merchant_id, idempotency_key)`:
  - If `status = 'completed'`, return its current state without mutating balances.
  - If `status IN ('pending','processing')`, `source_type = 'paystack_authorization'`, and `transaction_id` matches `p_source_id`, claim that existing row and continue the wallet debit/allocation flow, updating the same contribution row to `completed`.
  - If the existing row has a different source/fingerprint or a terminal failed/cancelled state, raise a duplicate-idempotency conflict instead of mutating balances.
- Lock the goal row `FOR UPDATE`.
- Reject goal status not in `active` or `paused` for manual allocation. For auto-debit scheduler, only process active goals.
- Reject `p_amount > (target_amount - current_amount)` for manual customer contributions. For scheduled auto-debit, calculate the charge amount before calling the RPC as `least(contribution_amount, target_amount - current_amount)` so the final charge does not overshoot the goal.
- Lock `customer_wallets` row `FOR UPDATE`.
- Require `available_balance >= p_amount`.
- Debit wallet:
  - Update `customer_wallets.available_balance = available_balance - p_amount`.
  - Update `customer_wallets.total_redeemed = total_redeemed + p_amount` only if the existing wallet accounting treats reserved savings as a wallet debit. If product wants earnings and savings to both count toward total balance, do not increment `total_redeemed`; instead add a dedicated `reserved_balance` column in a separate migration. The preferred implementation is to debit available wallet and represent savings through `customer_savings_goals.current_amount`.
- Insert `customer_wallet_transactions`:
  - `type = 'redemption'` for consistency with `redeem_wallet_for_order` and `redeem_vtu_wallet_payment`.
  - `source_type = 'device_savings_contribution'`
  - `source_id = contribution_id`
  - description `Device savings contribution`
- Insert `customer_savings_contributions` with `status = 'completed'`, or update the claimed processing contribution row to `completed`.
- Increment `customer_savings_goals.current_amount`.
- If current amount reaches target, set goal `status = 'completed'`, `completed_at = now()`, and insert `goal_completed` event.
- Insert contribution event.
- Return balances and ids.

Implementation detail: generate `v_contribution_id := gen_random_uuid()` before inserting either ledger row. Use that id as both `customer_savings_contributions.id` and `customer_wallet_transactions.source_id`. Do not insert the wallet ledger first with an unknown contribution id.

Add `public.cancel_customer_savings_goal_future_debits(...)`:

- This pauses/cancels future scheduled debits only.
- Does not move funds back to wallet.
- If the goal has `current_amount > 0`, sets status to `paused`, stores `future_debits_cancelled_at`, and keeps the reserved amount in `savingsBalance`.
- If the goal has `current_amount = 0`, it may set status to `cancelled` and store `cancelled_at` because there are no reserved funds to display or apply to an order.
- Inserts event `future_debits_cancelled`.

Add `public.pause_customer_savings_goal(...)` and `public.resume_customer_savings_goal(...)`:

- Pause/resume only changes future scheduled charges.
- Does not release funds.
- Inserts `goal_paused` and `goal_resumed` events.

Grant:

- Revoke from `PUBLIC`, `anon`.
- Grant customer-safe RPCs to `authenticated` only when they enforce `customers.user_id = auth.uid()`.
- Grant service operations to `service_role`.

## Backend Implementation

### Paystack helper additions

Update `apps/web/src/lib/paystack.ts`.

Add schemas and typed helpers for:

- `fetchPaystackCustomer(customerCodeOrEmail)`
  - Uses Paystack Fetch Customer endpoint.
  - Parses `dedicated_account` when present.
- `createDedicatedAccountForWallet(input)`
  - Wraps existing `createDedicatedAccount`.
  - Accepts `preferredBank`, default from env/config.
  - Accepts `subaccount` and passes the merchant Paystack subaccount to Paystack. Wallet DVA funding must settle under the merchant's configured Paystack subaccount just like existing wallet Checkout top-ups.
  - Uses `test-bank` when `PAYSTACK_SECRET_KEY` starts with `sk_test_`.
  - Returns normalized:

```ts
interface WalletDedicatedAccount {
  providerAccountId: string | null;
  providerCustomerCode: string;
  providerSubaccountCode: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankSlug: string | null;
  currency: 'NGN';
}
```

- `extractPaystackReceiverAccountNumber(payload)`
  - Reuse or wrap the existing `getPaystackDvaReceiverAccountNumber` behavior from agentic code.
  - Must handle Paystack DVA webhook fields:
    - `data.receiver_account_number`
    - `data.dedicated_account.account_number`
    - any currently supported helper field.

Tests:

- `apps/web/src/lib/paystack.test.ts`
  - DVA account normalizer accepts the current Paystack DVA response regardless of returned bank slug.
  - Test key uses `test-bank`.
  - Invalid account response returns typed failure.

### Wallet DVA service

Create `apps/web/src/lib/customer-wallet-payment-accounts.ts`.

Exports:

- `resolveCustomerWalletPaymentAccount({ supabase, merchantId, customerId })`
- `ensureCustomerWalletPaymentAccount({ supabase, merchant, customer, consentedAt })`
- `findCustomerWalletPaymentAccountByReceiver({ supabase, receiverAccountNumber })`
- `normalizeWalletPaymentAccount(row)`

Implementation requirements:

- Never use `select('*')`.
- Idempotency:
  - First look for an active local row by `(merchant_id, customer_id, provider = 'paystack')`.
  - If local row exists, return it.
  - Require `merchant.paystack_subaccount_code` to be present and valid. If missing, return `GATEWAY_NOT_CONFIGURED`; do not create a platform-level DVA that bypasses merchant settlement.
  - If absent, create or get Paystack customer using a helper whose duplicate-email path is tested. Do not assume the existing `createOrGetCustomer` name means it fetches on duplicates unless the implementation proves that behavior.
  - Check Paystack customer `dedicated_account` or `getDedicatedAccounts(customerCode)` before creating a new DVA, but only reuse an existing DVA if the Paystack response proves it belongs to the same merchant subaccount. If the response cannot prove subaccount ownership, create/assign through the merchant subaccount or return a typed conflict instead of storing a cross-merchant account.
  - Before persisting the returned account number as a wallet funding account, check `order_payment_accounts` joined to `orders` for the same Paystack account number with an active order-payment window. Use the same window contract as `paystack-dva-multi-key-match`: active until `LEAST(COALESCE(expires_at, created_at + interval '90 minutes'), created_at + interval '90 minutes')`, and only for `orders.payment_status IN ('unpaid','pending')`.
  - If it aliases an active order DVA, do not store it as a wallet account yet; return a typed recoverable conflict so the UI can keep Checkout fallback or ask the customer to retry after the order DVA expires.
  - Do not allow the same live receiver account number to mean both "pay this order" and "fund wallet". Historical expired `order_payment_accounts` rows are fine because the order-DVA matcher already clamps by its expiry window.
  - Insert local row with `provider_subaccount_code = merchant.paystack_subaccount_code` and the unique constraint.
  - On unique conflict, re-read and return the winner.
- Store customer consent timestamp.
- Do not create a DVA without a customer phone. If phone is missing, return a 400 with a UI-safe message telling the customer to add phone number.

Tests:

- Existing account returns without Paystack call.
- Missing phone fails before Paystack call.
- Paystack customer with existing DVA stores and returns account.
- Missing or invalid Paystack subaccount returns `GATEWAY_NOT_CONFIGURED` before DVA creation.
- Existing Paystack DVA without same-subaccount proof is not stored as a wallet funding account.
- Paystack customer with an existing active order DVA using the same account returns a recoverable alias conflict and does not store a wallet account.
- Concurrent conflict re-reads and returns existing row.
- Paystack failure returns typed error.

### Funding account API

Create `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`.

`GET`:

- Auth first using `authenticateApiRequest(request)`.
- Validate query with new schema:
  - `merchantSlug` optional string.
  - `merchantId` optional UUID.
  - Require one of them.
- Resolve merchant with `resolveWalletTopUpMerchant`.
- Resolve customer with `resolveVtuCustomer`.
- Return existing `customer_wallet_payment_accounts` row if present.
- If not present, return `{ account: null, requiresConsent: true }`.

`POST`:

- Auth first.
- CSRF validation.
- Zod body:
  - `merchantSlug`
  - `merchantId`
  - `consent: true`
- Resolve merchant and customer.
- Check `wallet_paystack_dva_enabled` for merchant.
- Call `ensureCustomerWalletPaymentAccount`.
- Return normalized account.

Response shape:

```ts
{
  account: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    provider: 'paystack';
  } | null;
  requiresConsent: boolean;
}
```

Tests:

- 401 unauthenticated.
- 403 failed CSRF for `POST`.
- 400 missing merchant id/slug.
- 404 missing merchant.
- 404 missing customer.
- 409 feature flag disabled.
- 400 missing phone.
- 200 existing account.
- 200 newly created account.

### Wallet top-up routing change

Keep `apps/web/src/app/api/storefront/customer/wallet/top-up/initialize/route.ts` for Checkout fallback.

Change mobile UI behavior:

- When DVA flag is enabled and the customer has a funding account, "Add Money" shows DVA transfer instructions, not Paystack Checkout.
- When DVA is disabled or account creation fails with a recoverable reason, existing Checkout top-up remains accessible as "Pay with card/checkout" behind a secondary action.

Do not remove the existing Checkout flow in this change because it is still needed to capture first Paystack card authorization for auto-debit and as fallback.

### Paystack webhook DVA wallet match

Update `apps/web/src/app/api/payments/webhook/route.ts` in the Paystack branch after order DVA matching and before generic transaction lookup fails.

Add handler `handleCustomerWalletDvaIfNeeded`.

Matching rules:

1. Extract receiver account number from webhook payload.
2. If no receiver account number, continue existing flow.
3. Look up `customer_wallet_payment_accounts` by `(provider = 'paystack', account_number = receiverAccountNumber, status = 'active')`.
4. If no account, continue existing flow.
5. Before wallet-crediting, verify the same receiver account is not tied to an active `order_payment_accounts` row for the Paystack `paid_at` timestamp, using the same 90-minute clamp as `paystack-dva-multi-key-match` and `orders.payment_status IN ('unpaid','pending')`. If it is active, file/log a reconciliation review and do not wallet-credit automatically; an active order DVA takes precedence over wallet funding because the payment may belong to that order.
6. Verify:
   - Paystack verification status is `success`.
   - Amount is positive.
   - Currency is NGN.
7. Create a `transactions` row if no row exists for `gateway_reference`.
   - `merchant_id` from account.
   - `order_id = null`.
   - `transaction_type = 'payment'`.
   - `amount = verifiedAmount.amount`.
   - `currency = 'NGN'`.
   - `status = 'completed'`.
   - `gateway = 'paystack'`.
   - `gateway_reference = reference`.
   - `gateway_response = gatewayResponse`.
   - `platform_fee = 0`.
   - `merchant_amount = 0`.
   - `metadata.transaction_type = 'wallet_topup'`.
   - `metadata.customer_id = account.customer_id`.
   - `metadata.payment_account_id = account.id`.
   - `metadata.paystack_channel = gatewayResponse.channel`.
8. Call `creditWalletTopUp` using the created/existing transaction id.
9. Return 200 with `message: 'Wallet DVA top-up credited'`.

Idempotency:

- Add `transactions_wallet_savings_gateway_reference_unique_idx` before this webhook work lands; do not rely on existing `(order_id, gateway_reference)` uniqueness for wallet/savings rows where `order_id` is null. Use insert-first with conflict-safe read or query first inside an advisory lock, then call `creditWalletTopUp`.
- `creditWalletTopUp` already guards by `source_id = transaction.id`.
- Webhook retries must not double-credit the wallet.

Tests:

- Paystack DVA webhook credits wallet by receiver account number when no pending transaction exists.
- Paystack DVA webhook retry returns success without second wallet credit.
- Receiver account with an active unexpired order DVA is not wallet-credited.
- Unknown receiver account falls through to existing order/transaction flow.
- Amount/currency mismatch returns error.
- Missing receiver account does not block existing Paystack Checkout top-up.

### Wallet API response expansion

Update `apps/web/src/app/api/storefront/customer/wallet/route.ts`.

First change its auth boundary:

- Replace the cookie-only `cookies()` + `createClient(cookieStore)` auth flow with `authenticateApiRequest(request)`.
- Keep cookie auth working for web customers.
- Add Bearer-token support for the mobile app, matching the existing wallet top-up and VTU routes.
- Use the scoped auth client for safe reads where RLS supports the query; only use admin/service helpers after auth when the route needs backend-only aggregate reads.

Return:

```ts
{
  balance: number;
  totalEarned: number;
  totalRedeemed: number;
  savingsBalance: number;
  totalBalance: number;
  loyaltyPoints: number;
  activeSavingsGoals: Array<{
    id: string;
    title: string;
    productName: string;
    productImageUrl: string | null;
    targetAmount: number;
    currentAmount: number;
    progressPercent: number;
    maturityDate: string;
    contributionAmount: number;
    contributionFrequency: 'daily' | 'weekly' | 'monthly';
    status: 'active' | 'paused' | 'completed';
  }>;
  fundingAccount: {
    accountName: string;
    accountNumber: string;
    bankName: string;
  } | null;
  transactions: WalletTransaction[];
  hasWallet: boolean;
}
```

Rules:

- `savingsBalance` is the sum of `current_amount` for goals in `active`, `paused`, and `completed`; this includes funded goals whose future auto-debits were cancelled and then moved to `paused`.
- Exclude goals in `spent` and `cancelled`; spent goals were already applied to an order and must not remain in wallet totals.
- `totalBalance = wallet.available_balance + savingsBalance`.
- Fetch loyalty points from `customers.loyalty_points`.
- Do not select every column.
- Preserve existing fields for backward compatibility.

Tests:

- Existing no-wallet response remains usable.
- Wallet with no savings returns `savingsBalance = 0`.
- Wallet with active/paused/completed savings returns correct totals.
- Funded future-debits-cancelled goals remain visible as paused savings and stay in `savingsBalance`.
- Zero-funded cancelled goals are excluded.
- Spent/applied goals are excluded from `savingsBalance`.

### Savings schemas

Create `apps/web/src/schemas/customer-savings.ts`.

Schemas:

- `customerSavingsFrequencySchema`
- `customerSavingsSourceModeSchema`
- `createCustomerSavingsGoalSchema`
- `manualSavingsContributionSchema`
- `customerSavingsGoalParamsSchema`
- `customerSavingsActionSchema`
- `savingsAutoDebitAuthorizeSchema`

Validation:

- Product id UUID required.
- Variant id optional UUID.
- Target amount min ₦1.
- Contribution amount min ₦100.
- Initial contribution min ₦0.
- Frequency: daily, weekly, monthly.
- Preferred debit time `HH:mm`.
- Start date cannot be more than 1 day in the past.
- Maturity date must not be earlier than start date.
- Required consent booleans must be true.
- Source mode `auto_debit` requires saved payment method id.

Tests:

- Valid daily manual goal.
- Valid monthly auto-debit goal.
- Reject missing consent.
- Reject maturity before start date.
- Reject auto-debit without saved card.
- Reject invalid preferred time.

### Savings API routes

Create routes:

- `apps/web/src/app/api/storefront/customer/savings/goals/route.ts`
- `apps/web/src/app/api/storefront/customer/savings/goals/[goalId]/contributions/route.ts`
- `apps/web/src/app/api/storefront/customer/savings/goals/[goalId]/pause/route.ts`
- `apps/web/src/app/api/storefront/customer/savings/goals/[goalId]/resume/route.ts`
- `apps/web/src/app/api/storefront/customer/savings/goals/[goalId]/cancel/route.ts`
- `apps/web/src/app/api/storefront/customer/savings/auto-debit/authorize/route.ts`

Common route rules:

- Auth first.
- Validate CSRF for all non-GET routes.
- Resolve merchant by slug/id.
- Resolve customer by authenticated user and merchant.
- Check `customer_device_savings_enabled`.
- Service role may be used only after auth and validation because the mutations need backend-only RPC access.
- Never trust client customer id.
- Every DB query must be scoped by merchant id and customer id.

`GET /goals`:

- Return active, paused, completed goals with contribution summary.
- Include product snapshots from `product_snapshot`; do not join full product if snapshot exists.

`POST /goals`:

- Validate body.
- Fetch product/variant price server-side; reject if client target amount is below current product payable amount unless business explicitly allows custom higher target.
- Build `product_snapshot`:
  - product id
  - variant id
  - name
  - image url
  - price
  - condition/variant attributes if available
- Call `create_customer_savings_goal`.
- Return created goal and any initial contribution result.

`POST /[goalId]/contributions`:

- Manual quick-save/add-to-savings only.
- Body amount.
- Require a client-supplied `Idempotency-Key` header containing a UUID, matching the wallet-only VTU pattern.
- Normalize the key to lowercase before storing/comparing.
- Store a request fingerprint containing `goalId`, `merchantId`, resolved `customerId`, and amount. Reuse with the same fingerprint returns the previous result; reuse with a different fingerprint returns 409.
- Do not generate a fresh idempotency key server-side for this route. A server-generated key changes on retry and will not dedupe a repeated tap or network retry.
- Call `allocate_customer_savings_contribution` with `source_type = 'wallet'`.
- Return updated wallet and goal balances.

`POST /pause`, `POST /resume`, `POST /cancel`:

- Use RPCs.
- Cancel means stop future debits, not refund and not hide existing reserved funds. Funded goals become paused with `future_debits_cancelled_at`; zero-funded goals may become cancelled.
- Return updated status.

`POST /auto-debit/authorize`:

- Use existing Paystack Checkout initialization to capture a reusable authorization if the customer has no saved card.
- Metadata:
  - `transaction_type = 'savings_authorization'`
  - `customer_id`
  - `merchant_slug`
  - `purpose = 'device_savings_auto_debit'`
- Amount should be the Paystack minimum tokenization amount or the first contribution if the user is starting immediately.
- If using a tokenization-only charge, immediately account for that money by either applying it as the initial savings contribution or crediting equivalent wallet value. Do not leave the authorization charge as unexplained revenue.
- On webhook/verify success, existing `upsertPaystackAuthorization` stores the authorization.
- Return authorization URL.

Tests:

- Each route covers 401, 403 CSRF, validation failure, missing merchant/customer, feature disabled, and success.
- Goal creation rejects cross-merchant product.
- Contribution rejects insufficient wallet balance.
- Cancel does not credit wallet.

### Auto-debit scheduler

Create `apps/web/src/app/api/cron/customer-savings/charge-due/route.ts`.

Rules:

- Protected by existing cron secret pattern. If no pattern exists, use `Authorization: Bearer ${CRON_SECRET}` and fail closed when missing.
- Select due active auto-debit goals:
  - `status = 'active'`
  - `source_mode = 'auto_debit'`
  - `current_amount < target_amount`
  - scheduled date/time due in Lagos time.
- Process in small batches, e.g. 50.
- For each goal:
  - Take an advisory lock by goal id and due period.
  - Create `transactions` row with reference `SVG-...`.
  - Create or reuse a `customer_savings_contributions` row with `status = 'processing'`, `source_type = 'paystack_authorization'`, `transaction_id = transactions.id`, and idempotency key `savings:<goalId>:<periodDate>`.
    - This row is the charge attempt and future completed contribution.
    - Do not create a separate second contribution row with the same idempotency key after Paystack succeeds.
    - The allocation RPC must claim/update this processing row instead of treating it as a completed duplicate.
  - Charge Paystack saved authorization using `chargeAuthorization`.
  - If Paystack returns `success`, mark transaction completed and apply contribution:
    - Use one accounting model for all savings funding: Paystack charge credits the customer wallet first, then the savings allocation debits wallet into the goal.
    - Call `creditWalletTopUp` with the Paystack `transactions.id`. If needed, extend that helper with an optional description/metadata field, but keep the wallet-credit source type as `wallet_topup` so the existing idempotency guard still applies.
    - Then call `allocate_customer_savings_contribution` with `source_type = 'paystack_authorization'`, `p_source_id = transactions.id`, and idempotency key `savings:<goalId>:<periodDate>`.
    - The allocator must update the existing processing contribution row to completed, attach the wallet transaction id, and increment goal progress.
    - This creates two customer wallet ledger entries for auto-debit: one Paystack wallet credit and one savings allocation debit. That is intentional so manual and auto-debit savings share the same accounting path.
  - If Paystack returns `pending`, leave contribution processing and rely on webhook/status reconciliation.
  - If failed, mark contribution failed and store reason.
- Emit logs per goal with sanitized ids.

Tests:

- No cron secret returns 401.
- No due goals returns 200 with zero processed.
- Successful charge creates transaction, wallet credit, savings contribution, and goal progress once.
- Retry with same period idempotency does not double charge.
- Processing contribution row is updated to completed on success; no duplicate contribution row is inserted for the same period key.
- Failed charge records failure and leaves goal active.
- Paused, zero-funded cancelled, and completed goals are skipped.
- Spent goals are skipped.

### Paystack webhook for savings charges

Update `apps/web/src/app/api/payments/webhook/route.ts`.

When a Paystack transaction has metadata `transaction_type = 'savings_auto_debit'` or `savings_authorization`:

- `savings_authorization`:
  - Upsert the saved Paystack authorization.
  - If metadata says the authorization charge should become an initial contribution, process it through the same wallet pass-through and `allocate_customer_savings_contribution` path using the metadata goal id and idempotency key.
  - If metadata says the authorization charge should become wallet value, credit the wallet exactly once with the Paystack transaction id.
  - If metadata contains neither policy, treat that as a server bug and return a typed failure; do not keep a real Paystack authorization charge as unexplained revenue.
- `savings_auto_debit`:
  - Verify goal id, contribution id, customer id, merchant id from metadata.
  - Verify amount/currency.
  - Mark transaction completed.
  - Apply the same wallet pass-through model as the cron route exactly once: credit wallet with the Paystack transaction id, then allocate that wallet balance into the savings goal with the contribution idempotency key.
  - If a processing contribution row already exists for that idempotency key, the allocator must claim/update it to `completed`; if cron already completed it, the webhook must return success without a second wallet debit or second contribution row.

Tests:

- Authorization webhook always stores the reusable method before applying the declared accounting policy.
- Authorization webhook that carries `apply_as_initial_contribution` stores the reusable method and creates exactly one initial savings contribution.
- Authorization webhook that carries `credit_wallet` stores the reusable method and credits wallet once.
- Authorization webhook without an accounting policy fails closed.
- Auto-debit webhook completes pending contribution.
- Retry does not double-apply.
- Cross-merchant metadata mismatch returns 400.

## Mobile Implementation

### React Native design requirements

Before implementing the mobile wallet, Manage Cards, or Start Savings screens, load and follow `react-native-design`.

Apply these constraints throughout Phase 4 and Phase 5:

- Use React Native `StyleSheet` patterns consistent with existing `apps/mobile-storefront` files.
- Keep wallet hero, summary row, segmented controls, action buttons, DVA pill, cards, and progress sections stable across small and large screens.
- Avoid using `Pressable` as the outer sizing primitive for equal-width cards or action buttons. Put width, border, background, and row spacing on a parent `View`, make the child `Pressable` fill it with `flex: 1`, and put icon/text in an inner row.
- Use Expo Router navigation patterns already present in `apps/mobile-storefront/app/wallet/index.tsx`.
- Add `accessibilityLabel`, `accessibilityRole`, and selected/disabled accessibility state for icon buttons, segmented controls, progress bars, DVA copy, Manage Cards, Quick Save, and Start Savings.
- Add screenshot-based/manual visual QA for the wallet, Manage Cards, Start Savings, preview sheet, transfer instruction, and success states on at least one small and one large mobile viewport. Confirm text does not overlap, truncate important account/payment values, or resize cards/buttons during loading, empty, disabled, selected, and funded states.
- Do not introduce manual `React.memo`, `useCallback`, or `useMemo`; React Compiler owns memoization for this repo.

### API clients

Create:

- `apps/mobile-storefront/lib/wallet-api.ts`
- `apps/mobile-storefront/lib/wallet-funding-account.ts`
- `apps/mobile-storefront/lib/customer-savings.ts`
- `apps/mobile-storefront/lib/saved-payment-methods.ts`

Do not couple wallet card management to `apps/mobile-storefront/lib/vtu-checkout.ts`. That file already has `listSavedVtuCards()` for the VTU checkout flow, but the wallet Manage Cards screen should call a neutral customer payment-methods route so savings does not inherit VTU naming, schemas, or bill-payment assumptions.

`wallet-api.ts`:

- `getCustomerWallet({ merchantId, merchantSlug })`
- Calls `GET /api/storefront/customer/wallet`.
- Prefer `merchantSlug` from `CONFIG.MERCHANT_SLUG`; include `merchantId` only if the API supports it after this plan's backend update.
- Zod-parse the web API's camelCase response (`savingsBalance`, `totalBalance`, `loyaltyPoints`, `fundingAccount`, `activeSavingsGoals`).
- Normalize the parsed response into the mobile hook's existing snake_case wallet shape (`savings_balance`, `total_balance`, `loyalty_points`, `funding_account`, `active_savings_goals`) at the client boundary. Do not make `WalletContent` depend on mixed response casing.
- Preserve backward compatibility with the current wallet API by defaulting missing new fields to `0`, `null`, or `[]`.

`wallet-funding-account.ts`:

- `getWalletFundingAccount({ merchantId, merchantSlug })`
- `createWalletFundingAccount({ merchantId, merchantSlug, consent: true })`
- Uses `EXPO_PUBLIC_API_URL`, Supabase access token, and `fetchWithTimeout`.
- Zod-parse responses.

`customer-savings.ts`:

- `listSavingsGoals`
- `createSavingsGoal`
- `addSavingsContribution`
- `pauseSavingsGoal`
- `resumeSavingsGoal`
- `cancelSavingsGoalFutureDebits`
- `initializeSavingsAuthorization`
- Zod-parse all responses.

Tests:

- `wallet-api.ts` maps camelCase API fields into snake_case mobile state.
- `wallet-api.ts` accepts the existing legacy wallet response and supplies safe defaults for new savings fields.
- Success and error response parsing.
- Auth missing error.
- Merchant slug fallback.
- Timeout propagates useful error.

### Hook changes

Update `apps/mobile-storefront/hooks/use-wallet.ts`.

Change `WalletData`:

```ts
interface WalletData {
  balance: number;
  savings_balance: number;
  total_balance: number;
  loyalty_points: number;
  funding_account: WalletFundingAccount | null;
  active_savings_goals: SavingsGoalSummary[];
}
```

Fetch path:

- Prefer `wallet-api.ts` and the web API `GET /api/storefront/customer/wallet` for wallet aggregate data because savings and funding account are server-derived.
- Keep direct Supabase fallback only if the API is unreachable and only for existing balance/points.
- Pass `CONFIG.MERCHANT_SLUG` as the primary merchant identifier because the current wallet API requires the `merchant` query parameter. If the backend route is expanded to accept `merchantId`, keep slug as a fallback so stale bundled merchant ids do not break wallet loading.

Realtime:

- Keep `customer_wallets` and `customers`.
- Add `customer_savings_goals` changes filtered by `customer_id`.
- Add `customer_savings_contributions` changes filtered by `customer_id`.

Create hooks:

- `useWalletFundingAccount`
- `useCreateWalletFundingAccount`
- `useSavingsGoals`
- `useCreateSavingsGoal`
- `useAddSavingsContribution`
- `useSavingsGoalActions`

Invalidate:

- On DVA creation, invalidate wallet query.
- On savings contribution, invalidate wallet query and savings goals query.
- On goal status change, invalidate both.

Tests:

- API response casing is normalized before it reaches `WalletData`.
- Wallet query includes savings totals.
- Savings changes invalidate wallet query.
- API fallback does not crash.

### Wallet screen redesign

Update:

- `apps/mobile-storefront/app/wallet/index.tsx`
- `apps/mobile-storefront/components/wallet/WalletContent.tsx`
- `apps/mobile-storefront/components/wallet/wallet.styles.ts`
- `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
- `apps/mobile-storefront/__tests__/app/wallet/index.test.tsx`
- `apps/mobile-storefront/__tests__/app/(tabs)/wallet.test.tsx`

Layout:

1. Header
   - Back arrow for stack presentation.
   - Title `Wallet`.
   - Right action `Add Money` with plus icon.
2. Hero
   - Black patterned background inspired by Figma.
   - Use Ogabassey red accents, not Chowdeck green.
   - Avoid a one-note red theme: black base, white text, red primary buttons, light neutral content cards.
   - Segmented pill at top: `Earnings` and `Savings`.
   - Top amount:
     - Earnings tab: available wallet balance.
     - Savings tab: savings balance.
     - Small `Total Balance - NGN` label can show total under/above.
   - DVA pill:
     - Render dynamic account text from `fundingAccount`, e.g. `{bankName} | {accountNumber}`. Do not hardcode any bank name or sample account number from the screenshot.
     - Copy icon button.
     - If no DVA, show `Create account number` button.
   - Summary row below hero:
     - Left `Earnings`
     - Right `Savings`
   - Loyalty points row/card under summary.
3. Primary actions
   - `Start Savings`
   - `Quick Save` only if there is an active savings goal.
   - `Manage Cards` navigates to new screen.
   - No withdraw button.
4. Utility chips
   - Keep Airtime/Data/TV/Power if already used in wallet, but they must not crowd primary actions.
5. Savings progress
   - If active goal exists, show progress card:
     - product image/name
     - current amount / target
     - percent
     - maturity date
     - caption based on progress.
   - Captions:
     - `1-24%`: `Great start`
     - `25-49%`: `Building momentum`
     - `50-74%`: `Halfway there`
     - `75-98%`: `Almost there`
     - `99%`: `Final stretch`
     - `100%`: `Target met`
   - Completed goal shows modal/card:
     - `Congratulations, you met your target`
     - Button `View order details` or `Use savings at checkout` depending on order existence.
6. Transaction history
   - Include wallet top-ups, savings contributions, loyalty redemptions.
   - Savings contributions should be visibly tagged.

Accessibility:

- Every icon button needs `accessibilityLabel`.
- DVA copy button announces copied account number.
- Segmented control uses selected accessibility state.
- Progress bar exposes percent.
- No color-only indicators.

Tests:

- No withdraw button exists.
- Renders Earnings/Savings/Loyalty Points.
- DVA copy action copies account number.
- Start Savings navigates to savings flow.
- Manage Cards navigates to manage cards screen.
- Quick Save hidden when no active goal.
- Quick Save shown when active goal exists.
- Progress captions change by percent.
- Text does not rely on test IDs where role/text assertions work.

### Manage Cards screen

Create:

- `apps/mobile-storefront/app/wallet/manage-cards.tsx`
- `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
- `apps/mobile-storefront/components/wallet/ManageCardsScreen.test.tsx`
- `apps/mobile-storefront/__tests__/app/wallet/manage-cards.test.tsx`

Behavior:

- Fetch saved Paystack cards from existing saved-card API or a new customer payment methods API.
- Show card brand/bank, last4, expiry.
- Allow setting default if API exists; otherwise display default from existing data and defer mutation.
- Allow removing/deactivating card only if route/API is implemented. If no backend exists, do not show delete button.
- Include `Add card` button:
  - Starts Paystack authorization flow through `POST /api/storefront/customer/savings/auto-debit/authorize`.
  - Routes to `/payment-gateway`.
- Empty state:
  - `No saved cards`
  - `Add a card to enable automatic savings.`

No regulation issue:

- This screen manages payment instruments only.
- It must not imply cards can withdraw funds.

### Start Savings flow

Create route group:

- `apps/mobile-storefront/app/wallet/savings/start.tsx`
- `apps/mobile-storefront/app/wallet/savings/[goalId].tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsStartScreen.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsProductStep.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsScheduleStep.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsContributionStep.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsFundingStep.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsPreviewSheet.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsPaymentMethodSheet.tsx`
- `apps/mobile-storefront/components/wallet/savings/SavingsSuccessSheet.tsx`
- `apps/mobile-storefront/components/wallet/savings/savings.styles.ts`

Flow matching Figma screenshots:

1. Product selection
   - Search input: `What are you saving for?`
   - Product result cards.
   - If opened from a product page, preselect product and variant.
   - Target amount is server-derived from product/variant price. Customer can increase target, not lower it below payable amount.
2. Frequency
   - Segmented round controls: Daily, Weekly, Monthly.
3. Preferred time
   - Time picker/dropdown.
   - Required only for auto-debit.
   - Manual mode still stores reminder time if user chooses one.
4. Start date
   - Date picker/dropdown.
   - Cannot be before today except timezone grace handled by server.
5. Contribution amount
   - Currency input.
   - Show projected maturity date or duration.
   - Validate contribution can reach target.
6. Initial contribution
   - Yes/No.
   - If yes, amount input defaults to first contribution.
   - Rename from Figma `deposit` to `initial contribution`.
7. Source of funds
   - Cards:
     - `Manual`
       - Customer manually moves wallet funds into savings.
       - If wallet balance is insufficient, show DVA funding instructions.
     - `Auto debit`
       - Requires saved Paystack card/authorization.
       - If no saved card, button becomes `Add card`.
8. Consent toggles
   - Non-withdrawable purchase credit acknowledgement.
   - Auto-debit authorization acknowledgement only in auto-debit mode.
   - Early-end fee acknowledgement only if flag is enabled.
9. Preview sheet
   - Product image/name.
   - Total payable.
   - Maturity date.
   - Initial contribution.
   - Saving duration.
   - Contribution schedule.
   - Source mode.
   - No `Interest 0%` row.
10. Payment method sheet
   - Manual mode:
     - `Use wallet balance`
     - `Fund wallet by bank transfer`
     - `Pay with card/checkout` fallback.
   - Auto-debit mode:
     - Saved Paystack cards.
     - Add card.
11. Transfer instruction screen
   - Show customer DVA when bank transfer is chosen:
     - amount needed
     - account number
     - bank name
     - account name
     - copy button
   - Do not create a new account per savings goal.
12. Success sheet
   - `Savings plan created successfully`
   - Returns to wallet and highlights new savings goal.

Tests:

- Product preselection works from params.
- Manual flow creates goal with required consent.
- Auto-debit flow requires saved card and consent.
- Preview sheet does not render `Interest`.
- Preview sheet renders `initial contribution`.
- Transfer instruction uses wallet DVA account.
- Success navigates back to wallet.

### Product entry points

Add `Start savings` entry from product details only where appropriate:

- Ogabassey product detail screen in mobile storefront if present.
- Product card should not get a savings CTA unless design already supports secondary actions.

Route params to `/wallet/savings/start`:

- `productId`
- `variantId`

Server must still validate product and variant.

## Web Storefront Implementation

Update `apps/web/src/components/storefront/ogabassey/pages/wallet.tsx` and tests if the web Ogabassey wallet is customer-facing.

Minimum web parity:

- Remove withdraw/refund-to-bank affordances.
- Show DVA funding account.
- Show Earnings/Savings/Loyalty Points.
- Show Start Savings.
- Link to savings start flow if web flow exists; otherwise show mobile-first notice only if the product currently treats mobile as primary.

Do not add a landing page. The wallet route should remain a functional wallet screen.

## Order/Checkout Use of Savings

Add this only after savings goal creation and manual contributions are stable.

Goal:

- Let customer apply active, paused, or completed savings funds to the selected product order.

Backend:

- Add RPC `redeem_savings_for_order`.
- It should mirror `redeem_wallet_for_order` but debit `customer_savings_goals.current_amount` instead of wallet balance.
- It must:
  - Verify product/variant on order matches goal product/variant.
  - Accept only goals in `active`, `paused`, or `completed`.
  - Require `current_amount > 0` and reject `p_amount > current_amount`.
  - Be idempotent by order id. This branch supports one selected savings goal per order, so a second savings goal for the same order must return the existing redemption if it is the same request fingerprint or fail with a conflict if it differs.
  - Insert `customer_savings_redemptions` keyed by `order_id` and `idempotency_key`.
  - Store `metadata.request_fingerprint` with `orderId`, `goalId`, `merchantId`, `customerId`, and `amount` so order-id and idempotency-key replays can distinguish exact retries from conflicting second savings attempts.
  - Insert `customer_savings_events` event `savings_applied_to_order`.
  - Reduce `customer_savings_goals.current_amount` by the applied amount.
  - If the application exhausts the goal balance, set `status = 'spent'`, `spent_at = now()`, and `applied_order_id = order_id`.
  - If a completed goal is partially applied and still has `current_amount > 0` but no longer meets `target_amount`, set `status = 'paused'` and insert `savings_partially_applied_to_order` so the wallet does not keep showing a below-target goal as completed.
  - Do not insert negative rows into `customer_savings_contributions`; redemptions belong in `customer_savings_redemptions`.

Checkout:

- Extend order payload with `savings_goal_id` and `savings_amount`.
- Use savings before wallet earnings if customer chooses the savings goal for that product.
- Do not let savings be applied to unrelated products.
- Do not copy the current wallet redemption route's non-fatal behavior for explicit savings use. If the customer selected a savings goal and `redeem_savings_for_order` fails, return a 400/409 response and do not initialize a gateway payment with an incorrect residual amount.

Mobile order service contract:

- Update `apps/mobile-storefront/services/orders.ts` because its Zod schema and payload builder currently strip unknown checkout fields.
- Add optional fields to `CreateOrderRequestSchema`:
  - `use_savings_credit: z.boolean().optional()`
  - `savings_goal_id: z.string().uuid().optional()`
  - `savings_amount: z.number().positive().optional()`
- Forward savings fields only when `use_savings_credit === true`, `savings_goal_id` is a UUID, and `savings_amount > 0`, mirroring the wallet payload guard.
- Extend `OrderResponseSchema` with optional `savings: { goalId: string; amountUsed: number; redemptionId: string | null } | null` if the API returns redemption details.
- Add `apps/mobile-storefront/services/orders.test.ts` coverage proving savings fields are forwarded when complete, stripped when incomplete, and validation rejects negative `savings_amount`.
- Update `apps/mobile-storefront/app/checkout.tsx` to combine selected savings and wallet amounts before payment initialization. Payment gateway amount must come from server `amountDueToGateway`, never from client recomputation.

Web order route contract:

- Update `apps/web/src/app/api/orders/route.ts` to parse `use_savings_credit`, `savings_goal_id`, and `savings_amount`.
- Apply savings before wallet redemption so product-reserved funds are consumed first for the matching product.
- Return a `savings` block alongside the existing `wallet` block, and calculate `amountDueToGateway = orderTotal - savingsAmountUsed - walletAmountUsed`.
- Add route tests for full savings coverage, partial savings plus wallet, rejected cross-product savings, and explicit savings failure returning 400/409 without gateway initialization.

Tests:

- Matching product can apply savings.
- Different product rejected.
- Repeat order finalization does not double debit.
- Cancelled goal cannot be applied.
- Spent goal cannot be applied again.
- A different savings goal cannot be applied to an order that already has a savings redemption.
- Partial application of a completed goal moves the remaining goal back to `paused` instead of leaving it as target-met.
- Applied savings are removed from `savingsBalance`.

## Cost and Routing Notes

- For bank-transfer wallet/savings funding, prefer DVA because the current Checkout `bank_transfer` fee produced ₦400 on ₦20,000.
- If ALAT remains `0.5% capped at ₦500`, ALAT is cheaper than Paystack DVA for transfers below ₦60,000, equal around ₦60,000, and Paystack DVA is cheaper above ₦60,000 if DVA remains `1% capped at ₦300`.
- This plan still uses Paystack first because the requested implementation is with Paystack and current code already has Paystack DVA, webhook, saved-card, and authorization primitives.
- Add provider abstraction in service names where cheap:
  - Database columns use `provider`.
  - API response says `provider: 'paystack'`.
  - Do not overbuild ALAT integration in this branch.

## Implementation Order

### Phase 0: Worktree and baseline

- [x] Use the isolated worktree:

```bash
cd /Users/mac/Baci-app/.worktrees/ogabassey-wallet-savings-plan
git status --short
git branch --show-current
```

Current implementation worktree:

```bash
cd /Users/mac/Baci-app/.worktrees/ogabassey-wallet-savings-implementation
git status --short
git branch --show-current
```

- [x] Confirm base:

```bash
git merge-base --is-ancestor origin/main HEAD
```

- [x] If the base check fails because `origin/main` moved, run `git fetch origin main` and fast-forward or rebase this branch before implementation. Do not start feature code from a stale base.

- [x] Do not run `vercel build`.

### Phase 1: Database contracts

- [x] Write migration 1 tables, indexes, RLS, feature flags.
- [x] Write migration 2 RPCs.
- [x] Add migration tests under `supabase/migrations/tests/`:
   - DVA account uniqueness.
   - Savings goal RLS.
   - Manual contribution idempotency.
   - Insufficient wallet balance rejection.
   - Completed goal transition.
- [ ] Run the repo's Supabase migration test path if available. Current blocker: local Supabase/Postgres is unavailable because Docker is not running and `npx supabase db lint --local` cannot connect to `127.0.0.1:54322`.

### Phase 2: Backend Paystack DVA funding

- [x] Add Paystack helper tests.
- [x] Add wallet payment-account service and tests.
- [x] Add funding-account API and tests.
- [x] Add DVA webhook wallet credit path and tests.
- [x] Expand wallet API response and tests.

### Phase 3: Backend savings APIs

- [x] Add schemas and schema tests.
- [x] Add savings goals routes and tests.
- [x] Add manual contribution route and tests.
- [x] Add pause/resume/cancel routes and tests.
- [x] Add saved-card authorization route for savings and tests.

### Phase 4: Mobile wallet redesign

- [x] Load `react-native-design` and apply its layout, navigation, accessibility, and Pressable sizing guidance before changing wallet UI files.
- [x] Add mobile clients and tests.
- [x] Update `use-wallet` and tests.
- [x] Replace wallet UI with Ogabassey red/black design and tests.
- [x] Add Manage Cards screen and tests.
- [x] Confirm no withdraw string or withdraw accessibility label remains in mobile wallet.
- [ ] Capture/review small and large mobile screenshots for wallet, Manage Cards, funded/empty states, DVA pill copy, and summary cards; fix any overlap, truncation, or layout shift before proceeding.

### Phase 5: Start Savings flow

- [x] Continue applying `react-native-design` for the multi-step savings flow, preview sheet, payment method sheet, transfer instruction screen, and success sheet.
- [x] Add savings route screens and component tests.
- [x] Wire product preselection.
- [x] Wire manual goal creation and initial contribution.
- [x] Wire DVA transfer instructions.
- [x] Wire success state back to wallet.
- [ ] Capture/review small and large mobile screenshots for each Start Savings step, preview sheet, payment method sheet, transfer instruction screen, and success sheet.

### Phase 6: Auto-debit

- [x] Add cron route and tests.
- [x] Add auto-debit webhook handling and tests.
- [x] Add mobile saved-card selection and authorization flow.
- [x] Keep `customer_device_savings_auto_debit_enabled = false` until manual flow passes QA.

### Phase 7: Checkout application

- [x] Add savings-to-order RPC and tests.
- [x] Add checkout payload support and tests.
- [x] Add mobile checkout UI only for matching product/variant savings goals.
- [x] Run the broader focused checkout/savings test batch after the final wiring pass.

## Verification Commands

Run focused tests as each slice lands:

```bash
pnpm --filter @baci/web test apps/web/src/lib/customer-wallet-payment-accounts.test.ts
pnpm --filter @baci/web test apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts
pnpm --filter @baci/web test apps/web/src/app/api/payments/webhook/route.test.ts
pnpm --filter @baci/web test apps/web/src/schemas/customer-savings.test.ts
pnpm --filter @baci/mobile-storefront test WalletContent.test.tsx
pnpm --filter @baci/mobile-storefront test __tests__/app/wallet/index.test.tsx
```

Before PR:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --prompt-only -t uncommitted
```

For this plan, the mobile UI work is in `apps/mobile-storefront`, not `apps/mobile-admin`. Run the storefront package gates:

```bash
pnpm --filter @baci/mobile-storefront lint
pnpm --filter @baci/mobile-storefront typecheck
pnpm --filter @baci/mobile-storefront test
```

Implementation note: `coderabbit review --agent -t uncommitted` was attempted during implementation and retried after the local verification batch. CodeRabbit returned `rate_limit` both times; the latest retry asked to wait about 15 minutes. Do not mark CodeRabbit as passed until it returns a clean result.

Only run the `apps/mobile-admin` Android emulator commands from `AGENTS.md` if the implementation unexpectedly touches `apps/mobile-admin`. Do not run admin emulator QA for a storefront-only wallet change.

## Manual QA Script

1. Sign in as an Ogabassey customer.
2. Open Wallet.
3. Verify:
   - Header is red/black, not green.
   - There is no withdraw button.
   - Earnings, Savings, and Loyalty Points are visible.
4. Tap Add Money.
5. Create or view Paystack DVA.
6. Copy account number.
7. Simulate Paystack DVA webhook for account number.
8. Confirm wallet earnings balance increases once.
8a. While an order DVA is still within its active 90-minute payment window, simulate a transfer to the same receiver account and confirm it is not silently credited to wallet if it conflicts with the order DVA.
9. Tap Start Savings.
10. Select iPhone/product.
11. Choose Daily.
12. Choose preferred time.
13. Choose start date.
14. Enter contribution amount.
15. Select initial contribution.
16. Select Manual funding.
17. Accept non-withdrawable purchase-credit consent.
18. Preview plan.
19. Create plan.
20. Confirm savings goal appears on wallet with progress.
21. Tap Quick Save.
22. Add contribution from wallet balance.
23. Confirm earnings decreases and savings increases while total balance stays mathematically correct.
24. Add saved card.
25. Enable auto-debit only after feature flag is on.
26. Run one due auto-debit in test mode.
27. Confirm one contribution is applied.
28. Retry same cron period.
29. Confirm no duplicate charge/contribution.
30. Complete target.
31. Confirm target-met state appears.

## Risk Controls

- Do not create one DVA per savings goal. It creates reconciliation noise and increases account limits. Use one customer DVA per merchant.
- Do not match DVA wallet credits by customer email or amount alone. Match by receiver account number and verified Paystack reference.
- Do not let one live receiver account number mean both active order payment and wallet funding. Active order DVA windows take precedence; wallet funding can use the account only after the order DVA window is expired or clearly not applicable.
- Do not trust client-selected customer id or product price.
- Do not use `auth.uid()` as `customer_id`. Resolve the `customers` row first.
- Do not credit wallet before gateway verification succeeds.
- Do not double-credit on webhook plus confirm route retries.
- Do not make funds withdrawable.
- Do not expose service-role Supabase clients in mobile or browser bundles.
- Do not use `select('*')`.
- Do not modify existing migrations.
- Do not modify `apps/web/src/proxy.ts`.
- Do not add `React.memo`, `useCallback`, or `useMemo`.
- Do not add ESLint config; the repo uses Biome.

## Acceptance Criteria

- Each Ogabassey customer can create/view one Paystack DVA for wallet funding.
- Paystack DVA transfer webhook credits customer wallet exactly once.
- Active order DVA aliasing cannot accidentally credit wallet or mark an unrelated order paid.
- Wallet screen shows Earnings, Savings, Loyalty Points, DVA, Start Savings, Manage Cards, and no Withdraw button.
- Savings flow matches the Figma behavior with corrected compliant wording.
- Manual savings goal can be created for a product.
- Manual contribution moves spendable wallet balance into savings balance.
- Cancelling future debits does not remove funded savings from `savingsBalance`.
- Applying savings to an order moves exhausted goals to `spent` and removes them from `savingsBalance`.
- Completed savings goal shows target-met UI.
- Manage Cards is a separate screen.
- Paystack saved authorization can be captured.
- Auto-debit charges due contributions only when the auto-debit flag is enabled.
- Auto-debit retries are idempotent and do not create duplicate contribution rows for one period key.
- All protected API routes authenticate first and validate with Zod.
- RLS protects all new savings and DVA tables.
- Focused tests, lint, typecheck, and full test suite pass before PR.
