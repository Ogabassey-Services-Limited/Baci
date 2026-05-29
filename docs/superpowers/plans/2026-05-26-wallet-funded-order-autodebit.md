# Wallet-Funded Order Auto-Debit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task in a fresh worktree. Keep every checkbox (`- [ ]`) current as work proceeds. This is a core money movement feature, so use TDD, run CodeRabbit before each review gate, and do not open the PR until webhook replay, underfunding, overfunding, ambiguity, and settlement cases are tested.

**Goal:** Let a customer choose bank transfer at checkout, transfer to their reusable Paystack wallet DVA, have Baci credit the wallet from the Paystack webhook, and then automatically debit that wallet to complete the order without duplicate credit, duplicate debit, or manual "I've sent the money" confirmation.

**Verdict:** This is cleaner than Paystack Checkout bank-transfer per order only if it is implemented as a server-owned funding intent and idempotent finalizer. It is not cleaner if the client simply creates an order, asks the customer to fund a wallet, and later tries to guess which order should consume the wallet balance.

**Architecture:** Add an `order_wallet_funding_intents` state machine plus an `order_wallet_funding_intent_payments` ledger. Paystack DVA `charge.success` still enters through the existing webhook, but wallet-funded order transfers use a dedicated service-role finalizer instead of the generic order-DVA path. The new checkout path must not pre-redeem wallet credit at order creation; the finalizer records each Paystack reference once, credits the customer wallet once, waits until cumulative DVA funding covers the expected transfer shortfall, performs the single order wallet redemption, creates a completed wallet order-payment transaction, and then runs the existing paid-order side-effect outbox.

**Tech Stack:** Next.js 16 App Router, TypeScript, Zod, Supabase PostgreSQL/RLS/RPC, Paystack DVA/webhooks, Expo Router, React Native, TanStack Query, Vitest, Jest.

---

**Primary sources researched:**
- Paystack DVA support doc: `https://support.paystack.com/en/articles/2124866`
- Paystack DVA developer doc: `https://docs-v2.production.paystack.co/payments/dedicated-virtual-accounts/`
- Paystack webhook doc: `https://paystack.com/docs/payments/webhooks/`
- Paystack recurring charges doc: `https://paystack.com/docs/payments/recurring-charges/`
- Paystack bulk charge doc: `https://paystack.com/docs/payments/bulk-charge/`
- Paystack pricing: `https://paystack.com/pricing`
- Supabase RLS docs: `https://supabase.com/docs/guides/database/postgres/row-level-security`
- Supabase API security docs: `https://supabase.com/docs/guides/api/securing-your-api`

## Research Decisions

- Paystack DVA is a fit for wallet funding because Paystack creates a transaction and sends webhook events when a customer transfers to the dedicated account. DVA pricing is listed by Paystack as 1% capped at NGN 300 per transaction, while the wallet debit inside Baci is free.
- Paystack DVA creation requires customer name, email, phone, and express customer consent. Therefore, do not auto-create DVAs for every signup. Auto-provision only when the customer enters wallet funding, starts a bank-transfer checkout, or explicitly creates the account from the wallet screen.
- Paystack recurring debit is a different feature. For savings auto-debit, use saved reusable authorizations and `charge_authorization` or Bulk Charge. For bank-transfer checkout, "auto-debit" means Baci internally debits the wallet after DVA funding; Paystack is not pulling money from the customer's bank on a schedule.
- Webhooks can retry for up to 72 hours unless Baci returns `200 OK`, so all processing must be idempotent. Never rely on the mobile screen button as the source of truth.
- Keep the existing order-scoped DVA path as a fallback until this new wallet-funded checkout is proven. Add a separate merchant feature flag, `wallet_order_auto_debit_enabled`, so wallet DVA creation can remain enabled without forcing checkout auto-debit.
- Scope this implementation to the mobile storefront first. Existing web storefront bank-transfer checkout should remain on the current order-scoped DVA path until a later web-specific UI slice.
- Guest checkout cannot use this flow because a wallet DVA belongs to an authenticated customer. Guest customers, customers without a phone number, or customers who decline consent must fall back to the existing order-scoped DVA checkout.
- `redeem_wallet_for_order` is idempotent by `order_id`, so wallet-funded bank transfer must not submit `use_wallet_credit` during order creation. Existing wallet balance can still reduce the transfer amount, but the actual wallet debit must happen once inside `finalize_wallet_funded_order`.

## Current Repo Fit

- Reusable wallet DVAs already exist in `customer_wallet_payment_accounts` via `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`.
- Wallet top-up crediting is already idempotent through `credit_customer_wallet`, `creditWalletTopUp`, and the transaction `source_id` guard.
- Order wallet debiting already exists through `redeem_wallet_for_order`, but that RPC is intentionally partial. The new finalizer should reuse its ledger shape (`customer_wallet_transactions.type = 'redemption'`, `source_type = 'order_redemption'`, `source_id = order_id`) without calling the partial RPC.
- Order-scoped DVA matching already exists through `order_payment_accounts` and `confirm-paystack-dva-by-order-account.ts`.
- Wallet DVA webhook matching already exists through `confirm-paystack-wallet-dva-top-up.ts`.
- Mobile checkout currently chooses bank transfer, creates an order, calls `/api/payments/initialize` with `payment_type: 'dva'`, then pushes `/bank-transfer`.
- `finalize_wallet_order_payment` is not the correct webhook finalizer because it depends on a customer user session. The new webhook path must use a service-role-safe RPC modeled on the newer role-guarded RPCs.
- `redeem_wallet_for_order` is not an "exact amount or fail" RPC. It redeems `LEAST(current_balance, p_amount)` and then becomes idempotent by `order_id`. Therefore, the new finalizer must not call it; it must perform an exact service-role debit only after locking the wallet and proving the current balance can cover `target_order_amount`.
- `handleWalletTopUpIfNeeded` currently returns early for wallet top-ups. Wallet-funded orders must be attempted before the plain wallet-top-up branch, otherwise the transfer will be credited as a plain top-up and no order-payment transaction, paid-order email, merchant settlement, or after-response ad tracking will run.
- The existing paid-order side-effect executors are built inline in `apps/web/src/app/api/payments/webhook/route.ts`: production webhook currently runs `paid_email` and `merchant_settlement` through `applyPaidOrderSideEffects`, and schedules ad tracking with `after()`. `applyPaidOrderSideEffects` has FIRS/loyalty step names, but this slice must not invent new FIRS or loyalty integrations. Extract only the existing production behavior into a reusable runner with an explicit allocated-fee override.
- `customer_wallets` is unique on `customer_id` only, not `(customer_id, merchant_id)`. Customers are merchant-scoped in this data model, so finalizer code must lock the wallet with `WHERE customer_id = intent.customer_id AND merchant_id = intent.merchant_id FOR UPDATE`, but any wallet creation/upsert logic must keep using the existing `ON CONFLICT (customer_id)` pattern.

## File Structure

- Create via CLI: `supabase/migrations/<generated>_order_wallet_funding_intents.sql` using `pnpm supabase migration new order_wallet_funding_intents`
- Create: `supabase/migrations/tests/order_wallet_funding_intents_schema.sql`
- Create: `apps/web/src/schemas/order-wallet-funding-intent.ts`
- Create: `apps/web/src/schemas/order-wallet-funding-intent.test.ts`
- Create: `apps/web/src/lib/order-wallet-funding-intents.ts`
- Create: `apps/web/src/lib/order-wallet-funding-intents.test.ts`
- Create: `apps/web/src/lib/payments/process-wallet-funded-order-payment.ts`
- Create: `apps/web/src/lib/payments/process-wallet-funded-order-payment.test.ts`
- Create: `apps/web/src/lib/payments/run-paid-order-side-effects.ts`
- Create: `apps/web/src/lib/payments/run-paid-order-side-effects.test.ts`
- Modify if the extraction can share code cleanly: `apps/web/src/scripts/reconcile-paystack-dva-executors.ts`
- Modify if the extraction can share code cleanly: `apps/web/src/scripts/reconcile-paystack-dva-executors.test.ts`
- Modify: `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
- Modify: `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts`
- Modify: `apps/web/src/app/api/payments/webhook/route.ts`
- Modify: `apps/web/src/app/api/payments/webhook/route.test.ts`
- Create: `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/route.ts`
- Create: `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/route.test.ts`
- Create: `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/[id]/route.ts`
- Create: `apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/[id]/route.test.ts`
- Modify: `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
- Modify: `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
- Modify: `supabase/migrations/tests/customer_wallet_dva_and_device_savings_schema.sql`
- Modify: `supabase/migrations/tests/klump_payment_foundation.sql`
- Modify: `apps/mobile-storefront/hooks/useMerchantPaymentSettings.ts`
- Modify: `apps/mobile-storefront/hooks/useMerchantPaymentSettings.test.ts`
- Modify: `apps/mobile-storefront/app/checkout.tsx`
- Modify: `apps/mobile-storefront/app/bank-transfer/index.tsx`
- Modify: `apps/mobile-storefront/components/bank-transfer/BankTransferView.tsx`
- Modify: `apps/mobile-storefront/components/bank-transfer/bank-transfer.styles.ts`
- Create: `apps/mobile-storefront/lib/order-wallet-funding-intent.ts`
- Create: `apps/mobile-storefront/lib/order-wallet-funding-intent.test.ts`
- Modify: `apps/mobile-storefront/__tests__/app/checkout.test.tsx`
- Modify: `apps/mobile-storefront/__tests__/app/bank-transfer/index.test.tsx`
- Modify: `apps/mobile-storefront/components/checkout/PaymentMethodSelector.tsx`
- Modify: `apps/mobile-storefront/components/checkout/PaymentMethodSelector.test.tsx`

## Data Model

Create `public.order_wallet_funding_intents`:

- `id uuid primary key default gen_random_uuid()`
- `merchant_id uuid not null references merchants(id) on delete cascade`
- `customer_id uuid not null references customers(id) on delete cascade`
- `order_id uuid not null references orders(id) on delete cascade`
- `wallet_payment_account_id uuid not null references customer_wallet_payment_accounts(id)`
- `provider text not null default 'paystack'`
- `expected_amount numeric(12,2) not null check (expected_amount > 0)`
- `target_order_amount numeric(12,2) not null check (target_order_amount > 0)`
- `wallet_balance_snapshot numeric(12,2) not null default 0 check (wallet_balance_snapshot >= 0)`
- `funded_amount numeric(12,2) not null default 0 check (funded_amount >= 0)`
- `debited_amount numeric(12,2) not null default 0 check (debited_amount >= 0)`
- `excess_amount numeric(12,2) not null default 0 check (excess_amount >= 0)`
- `currency text not null default 'NGN' check (currency = upper(currency))`
- `status text not null` with allowed values `pending`, `underfunded`, `funded`, `processing`, `completed`, `expired`, `cancelled`, `review_required`, `failed`
- `idempotency_key text not null`
- `last_gateway_reference text null`
- `last_transaction_id uuid null references transactions(id)`
- `metadata jsonb not null default '{}'::jsonb`
- `expires_at timestamptz not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes and constraints:

- Unique active/non-retryable intent per order: partial unique index on `(order_id)` where `status not in ('expired', 'cancelled', 'failed')`. This blocks duplicate pending, underfunded, processing, funded, completed, and review-required intents, while still allowing a clean retry after an expired, cancelled, or failed intent.
- Unique idempotency key: `unique(idempotency_key)`
- Lookup: `(merchant_id, customer_id, status, expires_at)`
- Lookup: `(wallet_payment_account_id, status, expires_at)`
- Lookup: `(provider, last_gateway_reference)` partial where reference is not null
- Check: `target_order_amount >= debited_amount`
- Check: `target_order_amount >= expected_amount`

Amount semantics:

- `target_order_amount` is the order amount the finalizer must redeem from the wallet after funding. It is the order residual after savings, before wallet redemption.
- `expected_amount` is the DVA transfer amount the customer is asked to send. It may be lower than `target_order_amount` when the customer already had wallet balance at checkout.
- `wallet_balance_snapshot` records the wallet balance used to calculate `expected_amount`; it is only an audit/safety value and must not be trusted as current balance during finalization.
- `funded_amount` is the cumulative sum of Paystack DVA transfers attributed to this intent. It can be lower than `debited_amount` when pre-existing wallet balance covers part of the order.
- `debited_amount` is the wallet amount redeemed for the order. On completion it must equal `target_order_amount`.
- `excess_amount` is `greatest(funded_amount - expected_amount, 0)`. Do not calculate excess as `funded_amount - debited_amount`, because `debited_amount` can include pre-existing wallet balance.
- `idempotency_key` is the create-attempt key, not just the `order_id`. Return an existing non-terminal intent before inserting. If the previous intent is `expired` or `failed`, generate a fresh key such as `order-wallet-funding:<order_id>:<uuid>` so a retry is not blocked by the unique key.
- `wallet_payment_account_id` is not enough for safety by itself. Service code and the finalizer must verify the referenced `customer_wallet_payment_accounts` row has the same `merchant_id`, `customer_id`, `provider = 'paystack'`, and `status = 'active'` as the intent.

Create `public.order_wallet_funding_intent_payments`:

- `id uuid primary key default gen_random_uuid()`
- `intent_id uuid not null references order_wallet_funding_intents(id) on delete cascade`
- `transaction_id uuid not null references transactions(id) on delete restrict`
- `provider text not null default 'paystack'`
- `gateway_reference text not null`
- `amount numeric(12,2) not null check (amount > 0)`
- `gateway_fee numeric(12,2) not null default 0 check (gateway_fee >= 0)`
- `currency text not null default 'NGN' check (currency = upper(currency))`
- `paid_at timestamptz not null`
- `credited_wallet_transaction_id uuid null references customer_wallet_transactions(id)`
- `debited_wallet_transaction_id uuid null references customer_wallet_transactions(id)`
- `order_payment_transaction_id uuid null references transactions(id)`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

Payment ledger indexes and constraints:

- Unique Paystack reference: `unique(provider, gateway_reference)`
- Unique Baci transaction: `unique(transaction_id)`
- Lookup: `(intent_id, created_at)`
- Lookup: `(order_payment_transaction_id)` partial where not null
- `gateway_fee` stores the full verified Paystack fee for that single DVA transfer. The order-level allocated fee is calculated later from these rows; do not overwrite `gateway_fee` with the pro-rated amount.

Extend `public.merchant_feature_settings`:

- `wallet_order_auto_debit_enabled boolean not null default false`
- Comment: `Enables checkout bank-transfer flow that funds a customer wallet DVA and auto-debits the pending order after webhook confirmation.`

Security:

- Enable RLS.
- Grant `SELECT` to `authenticated`.
- Grant all writes only to `service_role`.
- Customer select policy must confirm the authenticated user owns the customer row.
- Do not add merchant/staff direct table policies in this slice. Admin visibility must go through service routes or a later dashboard task.
- Revoke direct `EXECUTE` on the new finalizer RPC from `PUBLIC`, `anon`, and `authenticated`; grant only to `service_role`.
- Use `SECURITY DEFINER SET search_path TO ''` and fully qualify every table/function reference with `public.` or `pg_catalog.`.

## New RPC

Create `public.finalize_wallet_funded_order(...)` as a `SECURITY DEFINER` function:

Inputs:
- `p_intent_id uuid`
- `p_gateway_reference text`
- `p_transaction_id uuid`
- `p_received_amount numeric`
- `p_gateway_fee numeric default 0`
- `p_paid_at timestamptz`
- `p_currency text default 'NGN'`

Behavior:
- Validate all inputs and currency.
- Reject unless `auth.role() = 'service_role'`.
- Lock the funding intent row `for update`.
- Lock the matching order row `for update`.
- Lock the Paystack funding `transactions` row by `p_transaction_id` and verify it is the same wallet top-up transfer being finalized: `gateway = 'paystack'`, `transaction_type = 'payment'`, `status = 'completed'`, `merchant_id = intent.merchant_id`, `order_id is null`, `amount = p_received_amount` within a one-kobo/0.01 tolerance, `currency = p_currency`, `gateway_reference = p_gateway_reference`, and metadata ties it to the same `customer_id` and `wallet_payment_account_id`.
- Before rejecting terminal states, look up an existing `order_wallet_funding_intent_payments` row by `(provider, gateway_reference)` or `transaction_id`. If that row already belongs to this intent, return the stored idempotent outcome even when the intent is already `completed` or `underfunded`. Duplicate Paystack webhook replay must not turn into a non-2xx error just because the first delivery completed the intent.
- Reject new processing if intent is `cancelled`, `expired`, `completed`, or not tied to the order/customer/merchant in the payment transaction. If the existing payment reference belongs to a different intent, mark review instead of debiting.
- Reject if the order is cancelled, expired, already paid, or no longer payable.
- Insert into `order_wallet_funding_intent_payments` using `(provider, gateway_reference)` and `(transaction_id)` uniqueness. If the payment row already exists for this intent, return the existing outcome without increasing `funded_amount`.
- Call existing `credit_customer_wallet` using `source_type = 'wallet_topup'` and `source_id = p_transaction_id`; its existing source-id guard prevents duplicate wallet credit.
- Store the returned customer wallet credit transaction id on the intent payment row.
- Recompute `funded_amount` from `sum(order_wallet_funding_intent_payments.amount)` for the intent. Do not trust a denormalized increment.
- If cumulative funded amount is less than expected amount, set `status = 'underfunded'`, return without debiting the order, and leave the money in the wallet.
- Recompute confirmed savings redemption for the order from `customer_savings_redemptions` before final order updates. This value is needed only for `orders.amount_paid`; it must not change `target_order_amount` after intent creation.
- If cumulative funded amount covers `expected_amount`, lock the matching `customer_wallets` row and verify `available_balance >= target_order_amount`.
- If the locked wallet balance is below `target_order_amount`, set `status = 'underfunded'`, return the remaining wallet amount needed, and do not create any wallet redemption row. This can happen if the customer spends wallet balance after intent creation but before the DVA transfer arrives.
- If the wallet balance is sufficient, perform an exact wallet redemption inside `finalize_wallet_funded_order`: update `customer_wallets.available_balance = available_balance - target_order_amount`, increment `total_redeemed`, and insert one `customer_wallet_transactions` row with the existing required ledger columns: `wallet_id`, `customer_id`, `merchant_id`, `type = 'redemption'`, `amount = target_order_amount`, `balance_after = new_available_balance`, `source_type = 'order_redemption'`, `source_id = order_id`, `status = 'completed'`, and a useful description/metadata payload.
- Before inserting the wallet redemption, check for an existing `customer_wallet_transactions` row with `source_type = 'order_redemption'`, `source_id = order_id`, `customer_id`, and `merchant_id`. If it exists with the same amount, reuse it idempotently. If it exists with a different amount, set the intent `review_required`, file `reconciliation_review`, and do not mark the order paid.
- Do not call `finalize_wallet_order_payment`; it is user-session oriented. The finalizer must update `orders.payment_status`, `orders.payment_method`, `orders.amount_paid`, `orders.wallet_amount_used`, `orders.wallet_transaction_id`, and `orders.updated_at` itself under the service-role guard. Use `payment_method = 'wallet'` when no savings redemption exists and `payment_method = 'store_credit'` when the order combines savings plus wallet. Set `amount_paid = least(order.total, confirmed_savings_redemption_amount + target_order_amount)` and `wallet_amount_used = target_order_amount`.
- Insert or reuse a completed order payment row in `transactions` with `gateway = 'wallet'`, `transaction_type = 'payment'`, `order_id = intent.order_id`, `amount = debited_amount`, `platform_fee = 0`, `merchant_amount = debited_amount`, and a deterministic full-order reference such as `WALLET-DVA-ORDER-<order_id>`. Do not truncate to the first 8 characters; this is an idempotency key and should remain collision-resistant. Include the Paystack funding references in metadata, not as the wallet transaction reference. The current `transactions` table has no gateway check constraint, and the existing wallet finalizer already uses `gateway = 'wallet'`, so do not add a transactions gateway migration for this.
- Store the debit wallet transaction id and order payment transaction id on the latest intent payment row.
- Set `debited_amount`, `excess_amount = greatest(funded_amount - expected_amount, 0)`, `status = 'completed'`, `last_gateway_reference`, and `last_transaction_id`.
- Return a typed result containing `credited_amount`, `funded_amount`, `debited_amount`, `excess_amount`, `order_paid`, `order_id`, `order_payment_transaction_id`, `wallet_credit_transaction_id`, and `wallet_debit_transaction_id`.

Critical idempotency rule:
- Replaying the same Paystack webhook must return the same business outcome without increasing `funded_amount`, wallet balance, `wallet_amount_used`, or order paid amount.

## Matching Rules

- New checkout flow must create an intent before showing account details.
- Webhook matching order:
  1. Agentic DVA path.
  2. Existing order-scoped `order_payment_accounts` path.
  3. New wallet-funded order intent path.
  4. Plain wallet DVA top-up fallback.
- For wallet-funded order matching, match by:
  - receiver account number -> `customer_wallet_payment_accounts`
  - wallet payment account -> active funding intents
  - same merchant/customer
  - not expired
  - not cancelled/completed
- Paystack `paid_at` must be on or after the intent `created_at` and before `expires_at`.
- If exactly one active intent exists for that wallet account in the valid payment window, process it.
- If multiple active intents exist, process only when one intent is unambiguously compatible with the received amount and paid time. "Compatible" means the transfer amount matches that intent's remaining expected shortfall within 0.01, or the transfer overfunds exactly one intent while all other plausible intents would remain underfunded/ambiguous. If more than one intent is compatible, or none is compatible, create/reuse the normal wallet top-up transaction, credit the wallet exactly once, file `reconciliation_review` with `issue_type = 'wallet_order_funding_ambiguous'`, mark plausible intents `review_required`, return a 2xx webhook response, and do not debit any order.
- Never debit an order when the customer has more than one plausible pending order for the same wallet DVA.
- Never debit an order after the order is cancelled, expired, or already paid.
- Never let the generic `handleWalletTopUpIfNeeded` branch process a transaction with `metadata.wallet_order_funding_intent_id`; the wallet-funded order handler must run first.

## Settlement and Side Effects

- The Paystack funding transaction remains a wallet top-up transaction and credits the customer wallet gross.
- The Paystack funding transaction must still be claimed/marked `transactions.status = 'completed'` with `gateway_response` before the wallet-funded finalizer credits the wallet and pays the order. Preserve the current webhook invariant where the transaction row is atomically updated before wallet-credit handling. On webhook replay, the wallet-funded handler must run in the already-completed branch before plain wallet top-up handling.
- The wallet-funded order payment transaction is a separate completed `transactions` row with `gateway = 'wallet'` and `amount = target_order_amount`.
- After `finalize_wallet_funded_order` returns `order_paid = true`, `process-wallet-funded-order-payment.ts` must fetch the paid order and run the shared paid-order side-effect runner with the wallet order-payment transaction, not the Paystack top-up transaction.
- Merchant settlement must use `p_gateway = 'paystack'`, `p_source_type = 'order'`, `p_source_id = order.id`, and `p_gateway_reference = wallet order-payment transaction.gateway_reference`. Put the Paystack reference in `p_metadata.paystack_reference`.
- In the reusable side-effect runner, name the gateway input `settlementGateway` or similar. Do not infer the settlement gateway from `transaction.gateway`, because the wallet order-payment row has `gateway = 'wallet'` while the actual external funding rail and fee allocation are Paystack.
- Preserve ad tracking as an after-response path. The runner should either accept a `scheduleAfter` callback, with the webhook passing Next.js `after`, or otherwise make the scheduling explicit and testable; do not move slow ad-platform calls back onto the webhook response path.
- Gateway fee allocation for exact payments is the verified Paystack fee. For overfunding or multiple transfers, allocate only the fee attached to funds used to satisfy `expected_amount`: for each funding payment use `payment.gateway_fee * (amount_applied_to_expected_shortfall / payment.amount)`, where `amount_applied_to_expected_shortfall` is capped by the remaining `expected_amount` before that payment. Round the final allocated fee to two decimal places and cap it at the sum of the selected payment rows' `gateway_fee`. Store the original full gateway fee and gross received amount in metadata. Do not allocate by `debited_amount / received_amount`, because `debited_amount` can include existing wallet balance that did not incur a Paystack fee.
- The side-effect runner must receive the allocated gateway fee explicitly. Do not pass the full Paystack verification response into an unchanged settlement executor that calls `extractVerifiedGatewayFeeNgn`, or the merchant settlement will deduct the whole DVA transfer fee from this order.
- Underfunded transfers must not run paid-order side effects or merchant settlement.
- Once the finalizer has credited the wallet and marked the order paid, webhook responses should stay 2xx even if an outbox side-effect step records a failed/skipped result. Paystack retries cannot safely undo/retry the money movement; replayable side-effect rows and operations review should handle that path.

## User Experience

Checkout payment label:
- Replace the bank-transfer row copy with `Bank transfer to wallet`.
- Supporting text: `Transfer to your Bassey wallet account. We apply it to this order automatically.`
- Do not present this as Paystack Checkout.
- If the customer is not signed in, has no phone number, or declines wallet DVA consent, show the legacy bank-transfer option and continue through `/api/payments/initialize` with `payment_type: 'dva'`.

Bank transfer screen:
- Show the reusable DVA account number, bank, account name, and exact amount.
- Text should say `Transfer exactly` and `We will fund your wallet and pay this order automatically.`
- Replace `I've Sent the Money` as the primary success path with passive polling:
  - Button: `Check payment status`
  - Secondary copy: `You can leave this screen. We will confirm automatically.`
- Poll the intent endpoint every 5 seconds while screen is focused, back off after 2 minutes, and stop after completion/expiry.
- On `completed`, clear cart and route to `/order-success`.
- On `underfunded`, show remaining amount and keep the same account details.
- On `review_required`, tell the customer support is reviewing the transfer and show the order number.
- If the customer already has wallet balance, the transfer amount can be the shortfall only. Example: order residual is NGN 200,000 and wallet balance is NGN 50,000, so the screen asks for NGN 150,000 and the finalizer later debits NGN 200,000 from the wallet once.

Wallet screen:
- Keep `Create account number` for the wallet page to satisfy express consent.
- During checkout, lazy-create the DVA after the customer selects the bank-transfer wallet option and consents inline.
- Do not auto-create DVAs for all users at signup.

Wallet home design guardrails from the current screenshot:
- This auto-debit plan is not a full wallet-home redesign, but if the implementation branch touches the wallet screen, fix the known regressions in the same branch: `Manage Cards` must be visible in dark mode, and `Loyalty Points` / `Loyalty Rewards` must not be duplicated as competing sections.
- Keep the wallet-home DVA creation as an explicit consent action. Checkout can lazy-create after consent, but signup must not silently create a Paystack DVA for every customer.
- Use the existing mobile design tokens and red/black palette from the Bassey phone design; do not bring Chowdeck green into the app.

## Implementation Tasks

### Task 0: Isolate Worktree and Refresh Baseline

- [x] Create a worktree from current remote main:

```bash
git fetch origin
git worktree add ../Baci-app-wallet-funded-order origin/main
cd ../Baci-app-wallet-funded-order
git switch -c codex/wallet-funded-order-autodebit
pnpm install
```

- [x] Confirm no unrelated dirty files:

```bash
git status --short --branch
```

- [x] Run the current focused baseline:

```bash
pnpm --filter @baci/web exec vitest run src/app/api/payments/webhook/route.test.ts src/app/api/storefront/customer/wallet/funding-account/route.test.ts src/app/api/storefront/customer/wallet/top-up/confirm/route.test.ts
pnpm --filter @baci/mobile-storefront test __tests__/app/checkout.test.tsx __tests__/app/bank-transfer/index.test.tsx components/checkout/PaymentMethodSelector.test.tsx
```

### Task 1: Add Schema and RPC Migration

- [x] Write failing SQL migration tests for:
  - table existence
  - child payment ledger existence
  - indexes
  - RLS enabled
  - authenticated select policy
  - service-only writes
  - service-only RPC execute
  - duplicate webhook reference does not double-count funding
  - duplicate finalizer call does not double-debit order
  - `wallet_order_auto_debit_enabled` column exists and defaults false
  - `get_storefront_payment_settings` exposes `wallet_paystack_dva_enabled` and `wallet_order_auto_debit_enabled`

- [x] Create the migration with:

```bash
pnpm supabase migration new order_wallet_funding_intents
```

- [x] Add append-only migration with `wallet_order_auto_debit_enabled`, `order_wallet_funding_intents`, `order_wallet_funding_intent_payments`, indexes, RLS, trigger, `get_storefront_payment_settings` extension, and `finalize_wallet_funded_order`.
- [x] When extending `get_storefront_payment_settings`, follow the existing migration pattern: `DROP FUNCTION IF EXISTS public.get_storefront_payment_settings(uuid);` then recreate it with the full return signature. PostgreSQL will not safely change a function return table shape with only `CREATE OR REPLACE FUNCTION`.

- [ ] Run:

```bash
pnpm supabase test db
```

Local Supabase/Docker was unavailable in this worktree (`127.0.0.1:54322` connection refused), so this remains pending until a database test runner is available.

### Task 2: Add Web Schemas

- [x] Add `orderWalletFundingIntentCreateSchema` requiring `merchantSlug`/merchant identifier and `orderId`, with optional `consent: true`. Do not require fresh consent when an active wallet DVA already exists. If the route must create a DVA during checkout, the service must require `consent: true` and reject/return a typed fallback code when it is missing. Do not require or trust a client-supplied `expectedAmount`; the server must calculate the transfer amount from the persisted order, confirmed savings redemption rows, and current wallet balance.
- [x] Add `orderWalletFundingIntentPollSchema` accepting `merchantSlug`.
- [x] Tests must cover valid creation when an active DVA already exists without fresh consent, valid creation with `consent: true` when the DVA must be created, missing consent only failing in the no-DVA creation path, unexpected client amount fields such as `expectedAmount`, `amount`, or `currency` being rejected by a strict schema, and invalid order id.
- [x] Run:

```bash
pnpm --filter @baci/web exec vitest run src/schemas/order-wallet-funding-intent.test.ts
```

### Task 3: Add Intent Service

- [x] Implement service helpers:
  - `createOrderWalletFundingIntent`
  - `getOrderWalletFundingIntent`
  - `findActiveWalletFundingIntentForTransfer`
  - `markWalletFundingIntentReviewRequired`
  - `expireStaleWalletFundingIntents`
  - `isWalletOrderAutoDebitEnabled`

- [x] Reuse `ensureCustomerWalletPaymentAccount`; do not duplicate Paystack customer/DVA creation logic.
- [x] Resolve an existing active wallet DVA first. If none exists, require checkout consent, then call `ensureCustomerWalletPaymentAccount` with the existing consent pattern; do not ask for consent again when an active account already exists.
- [x] Validate the order belongs to the authenticated customer and merchant before creating an intent.
- [x] Compute `targetOrderAmount` as the order residual after confirmed savings redemption, before wallet redemption: `order.total - coalesce(sum(customer_savings_redemptions.amount where order_id = order.id), 0)`. Do not use a client-supplied amount for this calculation.
- [x] Compute `expectedAmount` as `max(targetOrderAmount - currentWalletBalance, 0)`. If this is `0`, the mobile checkout should use the existing wallet-only flow instead of creating a funding intent.
- [x] Do not create the intent if the order already has a wallet redemption row for the same `order_id`; this prevents the new exact-debit finalizer from colliding with the existing partial wallet RPC.
- [x] Return a typed fallback error code for guest checkout, missing phone, declined consent, disabled flag, or DVA creation failure so mobile can use legacy order-scoped DVA.
- [x] If an active intent already exists for the order, return it idempotently.
- [x] If the previous intent is terminal with `expired` or `failed`, create a fresh retry intent with a new `idempotency_key`; do not reuse the old key.
- [x] Call `expireStaleWalletFundingIntents` opportunistically before creating/reusing an intent and before webhook matching for a wallet account. This slice does not need a new cron job just to mark expiry, but stale `pending`/`underfunded` intents must stop blocking retries once `expires_at < now()`.
- [x] Tests must cover happy path with existing DVA, happy path with checkout consent creating a DVA, no DVA plus missing consent returning a fallback code, confirmed savings redemption reducing `targetOrderAmount`, existing wallet balance reducing expected transfer amount, existing wallet redemption rejection, existing intent reuse, missing customer phone, guest customer, disabled wallet DVA flag, disabled auto-debit flag, wrong customer, already-paid order, expired intent, and retry after expired intent using a fresh idempotency key.

Run:

```bash
pnpm --filter @baci/web exec vitest run src/lib/order-wallet-funding-intents.test.ts
```

### Task 4: Add Customer Intent Routes

- [x] POST `/api/storefront/customer/wallet/order-funding-intents`
  - Auth first.
  - CSRF for cookie-auth web calls; mobile must use the existing Bearer-token `createStorefrontCustomerApiClient`, which already bypasses CSRF in `checkCsrfProtection`.
  - Zod validation.
  - Service-role writes only after auth and validation.
  - Returns `intent`, `expiresAt`, `amount`, and wallet DVA account details.
- [x] GET `/api/storefront/customer/wallet/order-funding-intents/[id]`
  - Auth first.
  - Customer-scoped lookup.
  - Returns `status`, `fundedAmount`, `debitedAmount`, `remainingAmount`, `orderPaid`, and `orderId`.
  - Opportunistically expires the customer's stale intents before returning the poll result, so the UI can show `expired` without waiting for a background job.
- [x] Tests must cover 401, CSRF failure, validation failure, feature disabled, success, and scoped poll.

Run:

```bash
pnpm --filter @baci/web exec vitest run src/app/api/storefront/customer/wallet/order-funding-intents/route.test.ts src/app/api/storefront/customer/wallet/order-funding-intents/[id]/route.test.ts
```

### Task 5: Wire Paystack Wallet DVA Webhook to the Finalizer

- [x] Add `process-wallet-funded-order-payment.ts` and call it before plain wallet top-up handling. It must:
  - detects active wallet-funded order intents after wallet DVA account match
  - inserts/reuses the Paystack `transactions` row as today
  - runs only after the Paystack funding transaction has been claimed/marked completed, or performs that same atomic `status != 'completed'` update itself before finalization
  - calls `finalize_wallet_funded_order` for unambiguous intent matches
  - fetches the paid order and wallet order-payment transaction after finalization
  - runs the extracted paid-order side-effect runner for paid orders, using the wallet order-payment transaction and an explicit allocated Paystack fee
  - returns `review` on ambiguity only after creating/reusing the normal wallet top-up transaction, crediting the wallet, filing reconciliation review, and choosing a 2xx webhook response so Paystack does not keep retrying a successfully credited transfer
  - falls back to plain wallet top-up when no active intent exists
- [x] Extract current webhook paid-order side-effect construction into `apps/web/src/lib/payments/run-paid-order-side-effects.ts`; the standard webhook and wallet-funded order handler must both call it. It must take `supabase`, `order`, `transaction`, `settlementGateway`, `gatewayResponse`, `externalGatewayReference`, `actor`, optional `allocatedGatewayFeeNgn`, and an explicit/testable ad-tracking scheduler such as `scheduleAfter`.
- [x] The runner must build/fetch the same rich order and merchant data the current webhook needs for the confirmation email and ad conversion: order items, customer email/name/phone, shipping address, merchant slug/business/support email/email sender name, TIN, and RC number. Do not run the shared side-effect path with a minimal order row that makes emails incomplete.
- [x] Keep each new helper under the repo's 300-line file guideline. Split email executor, settlement executor, and ad-tracking scheduler helpers if the shared runner grows too large.
- [x] If the shared runner replaces duplicated manual-reconcile executor logic, update `apps/web/src/scripts/reconcile-paystack-dva-executors.ts` and its tests in the same task; if not, leave the script untouched and document why to avoid accidental behavior drift.
- [x] Preserve the existing active order alias conflict guard.
- [x] Wire the handler in both webhook paths: the fresh claim path after `updatedTxn` succeeds and the replay path where `updatedTxn` is empty because the transaction is already completed. In both paths it must run before `handleWalletTopUpIfNeeded`.
- [x] Do not return non-2xx for successfully credited but underfunded transfers.
- [x] Do not return non-2xx after `finalize_wallet_funded_order` returns `order_paid = true`; side-effect runner failures must be logged/reviewable without causing Paystack to replay money movement.
- [x] Tests must cover:
  - no intent -> wallet top-up only
  - one intent, exact amount -> credit, debit, finalize order
  - duplicate webhook -> no duplicate credit/debit
  - duplicate webhook after intent is already `completed` -> same idempotent result, no non-2xx retry
  - transaction metadata/customer/account mismatch -> no wallet debit, review/error path, no paid order
  - underfund -> credit only, status `underfunded`, no order debit
  - expected funding covered but current wallet balance below `target_order_amount` -> no wallet redemption row, status `underfunded`
  - later top-up after that low-balance underfunded state -> completes the order exactly once
  - overfund -> debit order amount, leave excess in wallet
  - multiple partial transfers with gateway fees -> allocated fee uses only the portion applied to `expected_amount`
  - savings plus wallet-funded transfer -> `orders.amount_paid` equals savings plus wallet debit, `orders.wallet_amount_used` equals the wallet debit, and `payment_method` is `store_credit`
  - cancelled/paid order -> credit only, review/fallback, no debit
  - multiple plausible intents -> review row, no order debit
  - paid order side effects run against the wallet order-payment transaction, not the Paystack top-up transaction
  - merchant settlement uses the debited order amount and allocated Paystack fee, not the overfunded gross transfer amount

Run:

```bash
pnpm --filter @baci/web exec vitest run src/lib/payments/run-paid-order-side-effects.test.ts src/lib/payments/process-wallet-funded-order-payment.test.ts src/app/api/payments/webhook/route.test.ts
```

### Task 6: Update Mobile Checkout

- [x] Extend `PaymentSettings` and `get_storefront_payment_settings` consumption with `wallet_paystack_dva_enabled` and `wallet_order_auto_debit_enabled`. Normalize missing/older-RPC fields to `false` in `useMerchantPaymentSettings` instead of blindly casting the RPC row, so staged app/database deploys cannot accidentally enable the new path or crash on absent fields.
- [x] Behind `paystack_enabled && wallet_paystack_dva_enabled && wallet_order_auto_debit_enabled`, change bank transfer submit path:
  - create order as today
  - do not send `use_wallet_credit` or `wallet_amount` in the order creation payload for this bank-transfer-to-wallet path
  - if the customer has no wallet DVA yet, present an inline consent checkbox or bottom sheet before calling the intent endpoint; if the customer declines, use the legacy order-scoped DVA fallback
  - call new wallet funding intent endpoint with `apps/mobile-storefront/lib/storefront-customer-api-client.ts` instead of `/api/payments/initialize` with `payment_type: 'dva'`; send only `merchantSlug`/merchant identifier, `orderId`, and consent fields
  - route to `/bank-transfer` with `intentId`, DVA details, the server-returned transfer amount, order id, tracking token
- [x] Keep existing Paystack order-DVA initialize as fallback when the feature flags are disabled, the customer is a guest, consent is declined, phone is missing, or intent creation fails with a non-recoverable DVA setup error.
- [x] Tests must prove the app sends authenticated eligible customers to the wallet-funded transfer screen, does not call Paystack Checkout bank-transfer initialize in the new path, asks for consent only when the account has to be created, and falls back to legacy DVA for guest/ineligible/declined-consent cases.

Run:

```bash
pnpm --filter @baci/mobile-storefront test __tests__/app/checkout.test.tsx
```

### Task 7: Update Bank Transfer Screen Polling

- [x] Accept both legacy params and new `intentId` params during rollout.
- [x] For `intentId`, poll the intent endpoint.
- [x] Clear cart only when poll returns `completed`, not when the user taps a button.
- [x] Replace "one-time account" copy for wallet-funded order with reusable wallet DVA copy.
- [x] Add underfunded/review/expired UI states.
- [x] Tests must cover completed navigation, underfunded display, review display, legacy params still rendering, and dark-mode contrast.

Run:

```bash
pnpm --filter @baci/mobile-storefront test __tests__/app/bank-transfer/index.test.tsx components/bank-transfer/BankTransferView.test.tsx
```

### Task 8: Update Payment Selector Copy and Compatibility

- [x] Change bank transfer copy only when the new feature flag is enabled.
- [x] In wallet-funded bank-transfer mode, do not render the existing partial wallet-credit toggle as an independent payment source. Render wallet balance as informational copy because the finalizer will perform one wallet redemption after funding.
- [x] Keep the existing partial wallet-credit row compatible with legacy Paystack/Korapay/order-scoped bank transfer fallback.
- [x] Ensure full wallet coverage still suppresses gateway rows as today.
- [x] Tests must cover new label, fallback old label, wallet balance informational copy in wallet-funded bank-transfer mode, and legacy wallet + bank transfer compatibility.

Run:

```bash
pnpm --filter @baci/mobile-storefront test components/checkout/PaymentMethodSelector.test.tsx components/checkout/PaymentMethodSelector.wallet.test.tsx
```

### Task 9: Reconciliation and Operations

- [x] Add a reconciliation query or script for intents stuck in:
  - `underfunded` past expiry
  - `processing` longer than 10 minutes
  - `review_required`
  - `funded` but not completed
- [x] Add logs with `intentId`, `orderId`, `customerId`, `merchantId`, and `gatewayReference`.
- [x] Document the SQL query for operations in `docs/superpowers/reviews/2026-05-26-wallet-funded-order-ops.md`. Do not add dashboard UI in this slice.

### Task 10: Review Gates

- [ ] Run CodeRabbit on uncommitted changes after Tasks 1-5:

```bash
coderabbit review --prompt-only -t uncommitted > docs/superpowers/reviews/2026-05-26-wallet-funded-order-coderabbit-phase1.md
```

- [ ] Fix every genuine critical/high/medium issue. Fix low issues when they are real maintainability or money-flow improvements.
- [ ] Run CodeRabbit again after mobile Tasks 6-8 and save output:

```bash
coderabbit review --prompt-only -t uncommitted > docs/superpowers/reviews/2026-05-26-wallet-funded-order-coderabbit-phase2.md
```

- [ ] Run the full gate:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

- [ ] Run final CodeRabbit before commit:

```bash
coderabbit review --prompt-only -t uncommitted > docs/superpowers/reviews/2026-05-26-wallet-funded-order-coderabbit-final.md
```

### Task 11: PR and Post-PR Loop

- [ ] Rebase from latest `origin/main`.
- [ ] Re-run focused tests if rebase changed payment, wallet, order, or mobile checkout files.
- [ ] Commit only related files.
- [ ] Push branch.
- [ ] Open PR with:
  - architecture summary
  - migration summary
  - Paystack webhook idempotency evidence
  - test evidence
  - CodeRabbit output file links
  - rollout flag notes
- [ ] Monitor GitHub Actions, CodeRabbit PR comments, and review threads.
- [ ] Fix comments/checks in the same branch until the PR is clean and mergeable.

## Acceptance Criteria

- A customer can choose bank transfer, see their wallet DVA, transfer exactly the requested amount, and land on order success after webhook confirmation without touching Paystack Checkout.
- Wallet DVA top-ups with no pending order still credit the wallet exactly as today.
- Duplicate Paystack webhooks do not duplicate wallet credits, wallet debits, order paid amounts, side effects, or emails.
- Underfunded transfers stay as wallet balance and do not silently mark the order paid.
- Overfunded transfers pay the order and leave the excess in wallet balance.
- Ambiguous transfers never auto-debit an order.
- Existing order-scoped DVA checkout remains available behind fallback until the new feature is proven.
- All new routes validate with Zod, check auth first, use CSRF for mutations, and avoid `select('*')`.
- New tables have RLS, service-only writes, and targeted migration tests.
- Mobile dark mode remains legible on the bank transfer and payment selector screens.
