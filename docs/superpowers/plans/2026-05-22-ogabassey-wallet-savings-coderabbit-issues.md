# Ogabassey Wallet Savings CodeRabbit Issues

Generated from:

```bash
coderabbit review --agent -t uncommitted
```

Worktree: `/Users/mac/Baci-app/.worktrees/ogabassey-wallet-savings-implementation`
Branch: `codex/ogabassey-wallet-savings-implementation`
Date: 2026-05-22

Note: the earlier rereview run on 2026-05-21 raised 49 issues. When this file
was requested on 2026-05-22, CodeRabbit was rerun against the current
uncommitted diff and raised 57 issues. This file records the latest 57-issue
run, plus the manual rereview notes from the 49-issue pass.

CodeRabbit raised 57 issues on the latest uncommitted implementation diff.

## Critical

1. `apps/web/src/lib/customer-savings-auto-debit-db.ts`
   - `markSavingsAutoDebitContributionFailed` ignores the Supabase update response.
   - Fix: capture the update result, check `.error`, and throw/log with `contributionId` and failure context.

2. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Transaction status update after Paystack charge ignores Supabase update errors.
   - Fix: capture update response and fail if the transaction row cannot be updated before wallet credit/allocation continues.

3. `apps/web/src/lib/customer-savings-paystack-webhook.ts`
   - Savings webhook helper does not verify Paystack HMAC signature before wallet/savings side effects.
   - Fix: pass signature/raw body into the helper, fail closed when secret is missing, and timing-safe compare before processing.

4. `apps/web/src/app/api/orders/route.ts`
   - `finalize_store_credit_order_payment` errors are logged but the route can still return `201`.
   - Fix: abort with an error response instead of returning success when full savings/store-credit settlement fails.

5. `apps/web/src/app/api/orders/route.ts`
   - Savings redemption happens after `create_storefront_order`, so order creation and savings debit are not atomic.
   - Fix: move order creation plus savings debit into a single DB transaction/RPC or introduce a reservation/commit flow.

6. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Initial contribution idempotency key is generated inline, so retries can create a new key.
   - Fix: generate and retain one idempotency key per contribution attempt and reuse it across retries.

## Major

1. `apps/web/src/app/api/storefront/customer/wallet/route.test.ts`
   - Tests cover only success paths.
   - Fix: add 401 auth, 400 invalid merchant, and 500 DB failure tests.

2. `apps/web/src/app/api/storefront/customer/savings/goals/resume/route.test.ts`
   - Missing auth, validation, and error-path tests.
   - Fix: cover 401, 400, and 500 forwarding from `executeSavingsGoalAction`.

3. `apps/mobile-storefront/hooks/use-wallet.ts`
   - `fundingAccountResult.data` is cast without runtime validation.
   - Fix: validate with a schema/type guard before assigning `fundingAccountData`.

4. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
   - Duplicates merchant/customer lookup logic.
   - Fix: reuse `resolveMerchantAndCustomer` before `ensureCustomerWalletPaymentAccount`.

5. `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`
   - Missing indexes on FK columns used by savings events, redemptions, contributions, wallet transactions, and transactions.
   - Fix: add `CREATE INDEX IF NOT EXISTS` statements for those FK columns.

6. `apps/web/src/lib/customer-savings-auto-debit.test.ts`
   - Missing error/edge-path coverage for due savings auto-debit processing.
   - Fix: test declined authorization, missing saved method, idempotent existing contribution, skipped schedule windows, invalid amounts, and allocation RPC errors.

7. `apps/web/src/lib/customer-savings-auto-debit-db.test.ts`
   - Missing DB error tests for transaction creation and failed-contribution marking.
   - Fix: cover insert errors, no-data insert response, update payload, and update failure.

8. `apps/web/src/lib/customer-wallet-payment-accounts.ts`
   - File is over the repo modularity limit and mixes validation, Paystack, persistence, and orchestration.
   - Fix: split into validator, Paystack DVA, DB query, and orchestration modules.

9. `apps/mobile-storefront/lib/customer-savings.ts`
   - File is over the repo modularity limit because schemas live inline.
   - Fix: move savings/customer payment schemas into `schemas/customer-savings.ts` and import them.

10. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
    - Large god component mixing UI, form state, validation, API calls, and modals.
    - Fix: extract `useStartSavingsForm`, modal components, and date/time fields; keep the screen under 300 lines.

11. `apps/web/src/app/api/storefront/customer/wallet/route.ts`
    - `getSavingsBalance` and `getFundingAccount` failures can break the core wallet response.
    - Fix: isolate helper failures with `Promise.allSettled` or try/catch and default to `0`/`null`.

## Minor

1. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - `walletBalance` prop is unused.
   - Fix: remove it from props and call sites.

2. `apps/web/src/app/api/storefront/customer/savings/contributions/manual/route.test.ts`
   - Missing validation and unexpected-error tests.
   - Fix: add 400 malformed body and 500 context/error tests.

3. `apps/web/src/app/api/storefront/customer/savings/goals/goal-action-handler.test.ts`
   - Missing auth and validation tests.
   - Fix: test 401 unauthenticated and 400 missing `goalId`.

4. `apps/web/src/app/api/storefront/customer/savings/goals/pause/route.test.ts`
   - Missing forwarded 401, 400, and 500 tests.
   - Fix: assert route returns statuses from `executeSavingsGoalAction`.

5. `apps/web/src/app/api/storefront/customer/savings/goals/cancel-future-debits/route.test.ts`
   - Missing forwarded 401, 400, and 500 tests.
   - Fix: assert route returns statuses from `executeSavingsGoalAction`.

6. `apps/web/src/lib/customer-savings-paystack-webhook.ts`
   - Missing `savings_accounting_policy` currently maps to 500.
   - Fix: return 400 for bad/missing client metadata.

7. `apps/web/src/lib/customer-savings-paystack-webhook.ts`
   - `getAuthorization` casts Paystack authorization without shape validation.
   - Fix: add runtime validation and return `null` for malformed authorization data.

8. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.ts`
   - Monthly contribution math uses fixed 30-day cycles.
   - Fix: use calendar-aware month arithmetic.

9. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.ts`
   - Date addition uses UTC parsing and can produce timezone off-by-one results.
   - Fix: parse local year/month/day and format local `YYYY-MM-DD`.

10. `apps/mobile-storefront/components/wallet/savings/start-savings.styles.ts`
    - Stylesheet is over 300 lines and contains hardcoded colors.
    - Fix: split form/modal styles and use theme constants.

11. `apps/web/src/app/api/payments/webhook/route.test.ts`
    - Missing negative-path tests for wallet DVA review and savings webhook failures.
    - Fix: assert non-credit/review responses and propagated savings webhook errors.

12. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.test.tsx`
    - Test asserts implementation detail via `accessibilityState`.
    - Fix: assert user-visible disabled behavior and no selection callback instead.

## Trivial

1. `apps/mobile-storefront/hooks/use-wallet.ts`
   - Redundant provider check after filtering Paystack funding account.
   - Fix: use `fundingAccountData` directly.

2. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - Copy feedback uses modal `Alert`.
   - Fix: use the app toast/transient feedback pattern.

3. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
   - Missing unexpected server-error test.
   - Fix: mock a thrown/rejected dependency and assert 500.

4. `apps/web/src/app/api/storefront/customer/savings/goals/route.test.ts`
   - Missing POST validation and Supabase/RPC failure tests.
   - Fix: add 400 invalid body and 500 server error tests.

5. `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
   - Missing clipboard failure-path coverage.
   - Fix: mock clipboard write as false and assert failure feedback.

6. `apps/mobile-storefront/components/wallet/wallet.styles.ts`
   - Hardcoded color literals should be shared constants.
   - Fix: move wallet hero colors into the shared color module.

7. `apps/web/src/app/api/storefront/customer/savings/contributions/manual/route.ts`
   - Duplicates RPC helper logic with goal action handling.
   - Fix: extract shared RPC helpers.

8. `apps/web/src/lib/customer-savings-auto-debit-types.ts`
   - Numeric DB fields need documentation and consistent normalization.
   - Fix: add JSDoc and ensure call sites use `asSavingsNumber`.

9. `apps/web/src/lib/customer-savings-paystack-webhook.test.ts`
   - Missing downstream failure tests.
   - Fix: cover wallet credit rejection and allocation RPC errors.

10. `apps/web/src/lib/customer-savings-auto-debit-schedule.test.ts`
    - Only daily period-key branch is tested.
    - Fix: add weekly and monthly schedule tests.

11. `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`
    - Redundant wallet payment account index.
    - Fix: remove duplicate non-unique index covered by the unique composite index.

12. `apps/web/src/schemas/wallet-funding-account.ts`
    - Merchant identifier refinement is duplicated.
    - Fix: centralize the predicate/message/path helper.

13. `apps/web/src/lib/customer-savings-paystack-webhook.ts`
    - Duplicate/idempotency allocation error handling should return existing contribution.
    - Fix: detect idempotency conflict and fetch existing contribution by key.

14. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
    - `exp_year.slice(-2)` is fragile.
    - Fix: coerce/pad year before slicing.

15. `apps/web/src/schemas/orders.test.ts`
    - Missing savings-credit schema boundary tests.
    - Fix: cover missing, zero, negative, invalid UUID, and `use_savings_credit: false` combinations.

16. `apps/web/src/lib/customer-savings-auto-debit.ts`
    - Processes due goals sequentially.
    - Fix: use parallel or limited-concurrency processing.

17. `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
    - Duplicates order DVA alias helper logic.
    - Fix: extract shared order payment account helper.

18. `apps/web/src/lib/paystack.ts`
    - Preferred DVA bank resolution infers test mode from secret key prefix.
    - Fix: use explicit environment flag instead.

19. `apps/web/src/app/api/storefront/customer/payment-methods/route.test.ts`
    - Missing validation and exception tests.
    - Fix: cover invalid query and `listSavedPaymentMethods` throw.

20. `apps/mobile-storefront/lib/wallet-funding-account.test.ts`
    - Missing error-path tests.
    - Fix: cover non-OK HTTP, invalid JSON, and schema validation failures.

21. `apps/web/src/app/api/cron/customer-savings/charge-due/route.test.ts`
    - Missing 500 test when `chargeDueCustomerSavingsGoals` throws.
    - Fix: mock thrown error and assert 500 body.

22. `apps/mobile-storefront/lib/customer-savings.test.ts`
    - Missing coverage for resume/cancel future debit and negative fetch/validation paths.
    - Fix: add tests for those exported functions and error branches.

23. `apps/web/src/app/api/storefront/customer/savings/auto-debit/authorize/route.test.ts`
    - Missing validation and runtime failure tests.
    - Fix: cover 400 invalid body, Paystack init failure, and insert failure.

24. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
    - Insufficient-wallet detection uses fragile string checks.
    - Fix: prefer structured error codes with message fallback.

25. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.test.ts`
    - Helper tests should split combined assertions and cover edge cases.
    - Fix: add focused tests for normalization, parsing, maturity, effective contribution, and top-up calculations.

26. `apps/mobile-storefront/lib/checkout-savings.test.ts`
    - Missing checkout savings edge cases.
    - Fix: cover empty goals/items, multi-item matching, tie-breaking, and paused/completed eligibility.

27. `apps/mobile-storefront/lib/customer-savings.ts`
    - `SavingsGoalSchema` transform leaves both `savingsStatus` and `status`.
    - Fix: omit `savingsStatus` during transform.

28. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.test.tsx`
    - Interactive test queries use labels instead of roles.
    - Fix: use role-based queries for search/input/buttons.

## Manual Rereview Notes To Keep With CodeRabbit

These were verified during the rereview and should stay on the fix list even when not emitted by the latest CodeRabbit run:

1. `apps/mobile-storefront/app/checkout.tsx`
   - Stale `savingsSelection` can remain active after the eligible savings goal changes, then get dropped at submit.

2. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.tsx`
   - `savingsIsActive` should check `savingsSelection.goalId === savingsGoalId`, not only `savingsSelection.use === true`.

3. `apps/mobile-storefront/app/checkout.tsx`
   - Klump submit guard checks wallet selection but not active savings selection, even though the UI disables Klump for savings.

## CodeRabbit Rerun - 2026-05-22

Command:

```bash
coderabbit review --prompt-only -t uncommitted
```

Result: review completed with 41 findings after the first implementation pass.

### Critical

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Missing colocated test for the extracted modal coordinator.

2. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
   - Missing colocated test for product search and target/frequency fields.

3. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Missing colocated tests for exported controller helper functions.

4. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Missing colocated test for the extracted form shell and continue behavior.

5. `apps/mobile-storefront/components/wallet/savings/start-savings-modal-parts.tsx`
   - Missing colocated tests for funding option, saved payment method, and summary row pieces.

6. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Missing colocated test for transfer amount, DVA details/fallback, and CTA handlers.

7. `apps/web/src/app/api/storefront/customer/savings/shared.ts`
   - `resolveCustomerSavingsContext` creates an admin Supabase client for user-facing operations; swap to user-scoped server client.

8. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Contribution insert result is incorrectly cast to `TransactionRow`; use the actual contribution row shape.

### Major

1. `apps/web/src/app/api/storefront/customer/savings/goals/route.ts`
   - File is too long; extract savings goal route helper functions.

2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - Missing colocated tests for controller validation, funding flow, and derived calculations.

3. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Missing colocated tests for submit, insufficient-wallet, auth-card, clipboard, and navigation flows.

4. `apps/mobile-storefront/components/wallet/savings/use-start-savings-payment-methods.ts`
   - Missing colocated tests for auto-debit payment method loading and error handling.

5. `apps/mobile-storefront/lib/customer-savings-api.ts`
   - Missing tests for token retrieval, error construction, response parsing, query/body construction, and fetch integration.

6. `apps/mobile-storefront/lib/wallet-funding-account.ts`
   - Inline wallet funding account schemas should move into a reusable schema module.

7. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Processing contribution is inserted before Paystack authorization; add compensation/reconciliation or move insert after success.

8. `apps/mobile-storefront/schemas/customer-savings.test.ts`
   - Expand schema coverage and align runner imports.

9. `apps/mobile-storefront/app/checkout.tsx`
   - Savings-goal fetch failures are logged but not surfaced with retry UI.

10. `apps/web/src/app/api/orders/route.ts`
    - `create_storefront_order_with_savings` RPC call passes `p_savings_idempotency_key: null`; forward a stable key.

### Minor

1. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - Inline copy feedback never auto-clears; add timeout/ref cleanup.

2. `apps/mobile-storefront/__tests__/app/wallet/index.test.tsx`
   - Use role queries for Start Savings and Manage Cards buttons.

3. `apps/mobile-storefront/__tests__/app/checkout.test.tsx`
   - Use role queries for checkout button interactions while keeping placeholders for text inputs.

4. `apps/web/src/app/api/orders/route.test.ts`
   - Mocked `create_storefront_order_with_savings` should respect `overrides.create_storefront_order`.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - File is at the line limit; extract validation to keep margin.

2. `apps/mobile-storefront/lib/wallet-funding-account.ts`
   - Duplicate auth/fetch parsing should share the wallet API client pattern.

3. `apps/mobile-storefront/lib/customer-savings.test.ts`
   - Split the over-300-line test suite.

4. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Due-goal fetch pulls active auto-debit goals then filters in code; add DB-level due filtering if a due column exists, otherwise document as not currently implementable.

5. `apps/web/src/lib/customer-wallet-payment-accounts.ts`
   - Existing DVA branch should verify `existingAccount.status === 'active'`.

6. `supabase/migrations/20260521205531_customer_savings_order_redemptions.sql`
   - Remove customer name/email from redemption transaction metadata.

7. `supabase/migrations/20260522000244_atomic_savings_order_rpc.sql`
   - Replace `COALESCE(v_savings.success, false) IS NOT TRUE` with `v_savings.success IS NOT TRUE`.

8. `apps/mobile-storefront/schemas/customer-savings.ts`
   - Use savings status enum for `SavingsGoalSummarySchema.goalStatus`.

9. `apps/web/src/schemas/wallet-funding-account.test.ts`
   - Add invalid UUID, whitespace-only slug, and trimmed slug tests.

10. `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`
    - Add partial index for `customer_savings_goals.variant_id`.

11. `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`
    - Add comment tying transaction metadata strings to app-maintained constants/modules.

12. `apps/mobile-storefront/schemas/customer-savings.ts`
    - Use savings status enum for `SavingsGoalActionResponseSchema.goalStatus`.

13. `apps/web/src/schemas/customer-savings.ts`
    - Make manual contribution `idempotencyKey` required in the schema instead of optional-plus-superRefine.

14. `apps/web/src/schemas/customer-savings.ts`
    - Extract duplicate trim-to-undefined preprocessors.

15. `apps/web/src/lib/customer-wallet-payment-account-db.ts`
    - Add explicit `WALLET_DVA_RECEIVER_CONFLICT` for receiver-account conflicts.

16. `apps/web/src/schemas/wallet-funding-account.ts`
    - Share merchant identifier schema utilities with customer savings schemas.

17. `apps/web/src/app/api/storefront/customer/wallet/route.ts`
    - Log rejected optional wallet helper promises before defaulting.

18. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.test.tsx`
    - Add explicit error-path tests for permanent create failure / product or wallet loading failures where applicable.

19. `apps/mobile-storefront/schemas/customer-savings.ts`
    - Use savings status enum for `SavingsContributionResponseSchema.goalStatus`.


## CodeRabbit Rerun - 2026-05-22 Second Pass

Command:

```bash
coderabbit review --prompt-only -t uncommitted
```

Result: review completed with 34 findings after local fixes and validation.

### Major

1. `apps/web/src/lib/payments/paystack-dva-order-alias.ts`
   - Add colocated tests for order status, active alias windows, invalid dates, paid statuses, Supabase success/error behavior.
2. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Add compensation/reconciliation when wallet credit succeeds but savings allocation fails.
3. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
   - Add POST 401 and unexpected 500 tests.
4. `apps/mobile-storefront/lib/customer-savings.test.ts`
   - Add error-path coverage for all exported savings API client functions.
5. `apps/web/src/schemas/merchant-identifier.test.ts`
   - Add merchantId-only success coverage for both shared refinements.
6. `apps/mobile-storefront/schemas/wallet-funding-account.ts`
   - Tighten funding account strings and account number validation; expand tests.
7. `supabase/migrations/20260521131000_customer_device_savings_rpcs.sql`
   - Verify idempotent completed contribution replay checks request fingerprint before returning existing contribution.
8. `apps/web/src/app/api/storefront/customer/savings/goals/goal-action-handler.test.ts`
   - Add unexpected 500 coverage for goal action handler.
9. `apps/web/src/lib/customer-wallet-payment-accounts.ts`
   - Use `@/lib/...` aliases for local imports.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Remove explicit `accessibilityRole="text"` from TextInput fields.
2. `apps/web/src/schemas/orders.test.ts`
   - Add missing `use_savings_credit: true` without `savings_amount` rejection test.

### Trivial

1. `apps/mobile-storefront/app/wallet/savings/start.tsx`
   - Remove redundant local title override.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.test.tsx`
   - Add loading/error-state coverage.
3. `apps/web/src/lib/customer-savings-auto-debit-db.ts`
   - Runtime validate inserted transaction row id.
4. `apps/web/src/app/api/cron/customer-savings/charge-due/route.ts`
   - Whitelist response shape.
5. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Extract funding amount intermediates and card authorization amount constant.
6. `apps/web/src/app/api/storefront/customer/savings/goals/route-helpers.ts`
   - Runtime validate create-goal RPC result row.
7. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.test.ts`
   - Expand controller behavior tests.
8. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Avoid state updates after unmount.
9. `apps/web/src/app/api/orders/route.ts`
   - Log savings redemption failure context.
10. `apps/web/src/lib/customer-savings-auto-debit.ts`
    - Simplify worker index capture.
11. `apps/web/src/lib/paystack.test.ts`
    - Clarify test-bank override behavior.
12. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
    - Replace text date/time fields with picker controls if available.
13. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.test.tsx`
    - Add loading/empty/edge tests if the UI supports these states.
14. `apps/web/src/schemas/merchant-identifier.ts`
    - Extract duplicate refinement logic into a shared factory.
15. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.test.tsx`
    - Avoid double assertion in controller fixture.
16. `apps/mobile-storefront/lib/checkout-savings.ts`
    - Replace double-negative amount guard.
17. `apps/mobile-storefront/lib/storefront-customer-api-client.ts`
    - Avoid unnecessary `getUser()` round trip.
18. `apps/mobile-storefront/components/wallet/savings/start-savings-modal.styles.ts`
    - Replace hardcoded modal style numbers with tokens/constants.
19. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.ts`
    - Preserve end-of-month monthly contribution semantics.
20. `apps/web/src/app/api/storefront/customer/savings/auto-debit/authorize/route.ts`
    - Return 403, not 409, when Paystack is disabled.
21. `apps/web/src/schemas/customer-savings.test.ts`
    - Add boundary/invalid-input schema coverage.

## CodeRabbit Rerun - 2026-05-24 Third Pass

Command:

```bash
coderabbit review --prompt-only -t uncommitted
```

Result: review completed with 39 findings after the second implementation pass.

### Critical

1. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Post-charge wallet credit/allocation failures must always file reconciliation and mark the contribution failed before rethrowing.

### Major

1. `apps/mobile-storefront/schemas/customer-savings.ts`
   - CodeRabbit reported missing colocated tests; `schemas/customer-savings.test.ts` exists, but expand transform fallback coverage.
2. `apps/web/src/app/api/cron/customer-savings/charge-due/route.ts`
   - CodeRabbit reported missing route tests; current `route.test.ts` already exists and should be rechecked on the next pass.
3. `supabase/migrations/20260522000244_atomic_savings_order_rpc.sql`
   - Remove anon EXECUTE grant from the SECURITY DEFINER savings order RPC.
4. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Extract card metadata formatting helpers.
5. `apps/mobile-storefront/lib/customer-savings.test.ts`
   - CodeRabbit reported missing API client error coverage; current `customer-savings.errors.test.ts` exists and should be rechecked.
6. `apps/web/src/lib/customer-savings-auto-debit-schedule.ts`
   - Monthly auto-debit goals started on the 29th-31st should run on the last day of shorter months.
7. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.test.tsx`
   - Split mocks/helpers to keep the test file under 300 lines.
8. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
   - Split fixtures/helpers to keep the test file under 300 lines.
9. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
   - Extract native date/time picker field logic into a reusable UI component.
10. `apps/web/src/lib/customer-savings-paystack-webhook.ts`
    - Replace the plain `paystackSignatureVerified` boolean with a branded verified-signature token.
11. `apps/web/src/app/api/storefront/customer/payment-methods/route.ts`
    - Return stable public error shapes with `error` and `code`.
12. `apps/web/src/lib/customer-savings-auto-debit.ts`
    - Avoid losing due goals when the first fetched rows are not yet due.
13. `apps/web/src/lib/customer-wallet-payment-account-db.ts`
    - Active DVA alias conflicts should compare against current time, not historical consent time.
14. `supabase/migrations/20260521131000_customer_device_savings_rpcs.sql`
    - Resume should clear `future_debits_cancelled_at`.

### Minor

1. `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.ts`
   - Log invalid/missing Paystack `paid_at` before falling back to the current time.
2. `apps/web/src/app/api/storefront/customer/savings/auto-debit/authorize/route.ts`
   - Keep DB `transaction_type` within the existing constraint and document the savings subtype in metadata.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Remove hardcoded Ogabassey copy from savings terms/subheading.
4. `apps/web/src/app/api/storefront/customer/savings/contributions/manual/route.ts`
   - Throw on non-finite RPC numeric fields instead of silently returning zero.
5. `apps/web/src/app/api/payments/webhook/route.test.ts`
   - Add duplicate/idempotent Paystack savings webhook regression where the transaction update returns null.

### Trivial

1. `apps/mobile-storefront/hooks/use-wallet.ts`
   - Extract `useRedeemPoints` and wallet data fetchers to keep the hook file under 300 lines.
2. `apps/web/src/app/api/storefront/customer/savings/goals/route.ts`
   - Return 400 for malformed JSON.
3. `supabase/migrations/20260521130000_customer_wallet_dva_and_device_savings_tables.sql`
   - Add customer FK indexes for savings contributions and events.
4. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Use a shared modal sheet primitive for savings modals.
5. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.test.tsx`
   - Add UI-facing assertions in addition to mock-call assertions.
6. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.tsx`
   - Rename the partial-payment compatibility variable for clarity.
7. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Use the shared modal sheet primitive.
8. `apps/web/src/lib/customer-savings-auto-debit-types.ts`
   - Type the Supabase client against the project database type.
9. `apps/web/src/lib/customer-savings-auto-debit-schedule.ts`
   - Lengthen Paystack savings auto-debit reference goal prefix to 12 hex characters.
10. `apps/web/src/schemas/merchant-identifier.test.ts`
    - Split mixed assertions and add both-id success coverage.
11. `apps/mobile-storefront/__tests__/app/checkout.test.tsx`
    - Add Arrange/Act/Assert comments around the savings checkout flows.
12. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
    - CodeRabbit reported color prop-drilling; evaluate after the next pass because extracting context may not reduce risk.
13. `apps/mobile-storefront/lib/wallet-funding-account.ts`
    - Add schema-parse context for get/create funding-account responses.

## CodeRabbit Rerun - 2026-05-24 Fourth Pass

Full command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md
```

Result: failed before review coverage because the uncommitted diff had 153 files, 3 over CodeRabbit's 150-file limit. This failure is not counted as review coverage.

Scoped web command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/web
```

Result: review completed with 13 findings.

Scoped mobile command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: rate limited before review coverage. Retry after the usage window resets.

### Major

1. `apps/web/src/app/api/payments/webhook/route.ts`
   - Guard Paystack savings webhook handling so Korapay and other non-Paystack webhooks do not invoke the Paystack-only savings handler.

### Minor

1. `apps/web/src/lib/payments/confirm-paystack-wallet-dva-top-up.test.ts`
   - Add non-unique insert-error and missing receiver-detail tests.
2. `apps/web/src/app/api/payments/webhook/route.test.ts`
   - Add Korapay regression proving savings-like metadata does not call the Paystack savings handler.

### Trivial

1. `apps/web/src/app/api/storefront/customer/payment-methods/route.ts`
   - Use a payment-methods-specific query schema name instead of the savings-goals query schema alias.
2. `apps/web/src/app/api/storefront/customer/savings/auto-debit/authorize/route.ts`
   - Log Supabase transaction insert failures with reference and merchant context.
3. `apps/web/src/app/api/cron/customer-savings/charge-due/route.test.ts`
   - Add partial-failure and zero-due-goals response coverage.
4. `apps/web/src/app/api/storefront/customer/wallet/route.test.ts`
   - Add merchant-not-found coverage.
5. `apps/web/src/schemas/merchant-identifier.test.ts`
   - Use the project path alias import.
6. `apps/web/src/lib/customer-savings-auto-debit.ts`
   - Reuse the Lagos date helper from the schedule module.
7. `apps/web/src/app/api/storefront/customer/savings/goals/goal-action-handler.ts`
   - Runtime-validate action RPC rows before reading response fields.
8. `apps/web/src/schemas/customer-savings.test.ts`
   - Expand validation boundary coverage in `customer-savings.validation.test.ts`.
9. `apps/web/src/schemas/orders.ts`
   - Simplify the savings amount superRefine check because the field schema already validates positive numbers.
10. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
    - Explicitly treat a missing feature-settings row as DVA disabled.

## CodeRabbit Rerun - 2026-05-24 Fourth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 18 findings after the rate-limit window cleared.

### Major

1. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Add Android `onRequestClose` handling to the shared modal shell.
2. `apps/mobile-storefront/components/wallet/wallet.colors.ts`
   - Rework wallet colors to avoid isolated hardcoded theme values.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/start-savings-modal-parts.tsx`
   - Use the same card masking characters as the shared card metadata helper.

### Trivial

1. `apps/mobile-storefront/app/wallet/manage-cards.tsx`
   - Wrap the manage-cards route in `StorefrontScreenShell` if the screen itself is not already shell-wrapped.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.test.tsx`
   - Use a role-based textbox query for the contribution amount input.
3. `apps/mobile-storefront/components/ui/ModalSheet.test.tsx`
   - Add hidden-state coverage.
4. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.test.tsx`
   - Document the deterministic date/time picker mock values.
5. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
   - Extract default hour/minute constants.
6. `apps/mobile-storefront/app/wallet/savings/start.tsx`
   - Wrap the start-savings route in `StorefrontScreenShell` if the screen itself is not already shell-wrapped.
7. `apps/mobile-storefront/lib/customer-savings.test.ts`
   - Split combined add/pause and resume/cancel tests.
8. `apps/mobile-storefront/schemas/customer-savings.ts`
   - Replace provider `z.literal('paystack')` fields with a provider enum.
9. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Support optional backdrop press dismissal.
10. `apps/mobile-storefront/lib/storefront-customer-api-client.test.ts`
    - Add request body, HTTP error, and query encoding coverage where supported by the client.
11. `apps/mobile-storefront/schemas/wallet-funding-account.ts`
    - Replace provider `z.literal('paystack')` with a provider enum.
12. `apps/mobile-storefront/components/wallet/card-formatting.helpers.test.ts`
    - Add missing-card-metadata edge cases.
13. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
    - Replace the mounted-flag cancellation pattern with `AbortController` if the underlying card API supports signals.

## CodeRabbit Rerun - 2026-05-24 Fifth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 23 findings after applying the fourth-pass mobile fixes.

### Major

1. `apps/mobile-storefront/app/checkout.tsx`
   - Extract checkout savings state/orchestration into a dedicated hook.
2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Validate auto-debit has a selected saved payment method before calling `createSavingsGoal`.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/use-start-savings-payment-methods.ts`
   - Clear the payment-method loading state when switching away from auto-debit.
2. `apps/mobile-storefront/hooks/use-wallet.ts`
   - Use optional chaining before trimming `CONFIG.MERCHANT_SLUG`.
3. `apps/mobile-storefront/app/checkout.tsx`
   - Do not track cancelled checkout-savings fetch errors.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - CodeRabbit still recommends splitting the coordinator hook further; evaluate after correctness fixes.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit recommends screen-owned shell, but the route now owns `StorefrontScreenShell`; keep route ownership to avoid double shell wrapping.
3. `apps/mobile-storefront/lib/checkout-savings.ts`
   - Add a literal type for redeemable savings statuses.
4. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.test.ts`
   - Remove unsafe `as never` casts in product fixtures.
5. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.test.ts`
   - Remove unsafe `as never` casts in product fixtures.
6. `apps/mobile-storefront/lib/storefront-customer-api-client.test.ts`
   - Split malformed JSON and missing-session error tests.
7. `apps/mobile-storefront/package.json`
   - Document/justify the new native date-time-picker dependency in PR notes or checklist.
8. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Add disabled visual and accessibility state to the retry button.
9. `apps/mobile-storefront/components/wallet/savings/start-savings-modal-parts.tsx`
   - Use `withAlpha` instead of template-literal alpha hex.
10. `apps/mobile-storefront/components/ui/DateTimePickerField.test.tsx`
    - Add dismissed picker and malformed-value edge coverage.
11. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
    - Use a real error-with-code type guard for insufficient wallet errors.
12. `apps/mobile-storefront/components/wallet/savings/start-savings-screen.test-utils.tsx`
    - Parameterize product-selection helper fixtures.
13. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
    - Fail visibly on invalid formatted start dates instead of silently falling back to today.
14. `apps/mobile-storefront/components/wallet/ManageCardsScreen.test.tsx`
    - Use role query for the Fund Wallet button.
15. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
    - Replace inline empty-account text styling with a shared style.
16. `apps/mobile-storefront/app/wallet/index.tsx`
    - Track wallet funding-account creation failures in telemetry before showing the alert.
17. `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
    - Use role-based queries for interactive wallet controls.
18. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
    - Guard clipboard feedback state updates after unmount.

## CodeRabbit Rerun - 2026-05-24 Sixth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 10 findings after applying fifth-pass mobile
fixes.

### Critical

1. `apps/mobile-storefront/lib/klump-checkout.ts`
   - Import `SavingsSelection` and `WalletSelection` from
     `@/lib/wallet-payment-helpers`, not from the UI selector.
2. `apps/mobile-storefront/lib/klump-checkout.test.ts`
   - Mirror the canonical helper-layer type imports in Klump tests.

### Major

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.auto-debit.test.tsx`
   - Add card-authorization failure-path coverage.
2. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Make the loyalty redemption error response schema strict.

### Minor

1. `apps/mobile-storefront/lib/wallet-payment-helpers.test.ts`
   - Add wallet-only, unpaid-savings, and no-store-credit coverage for
     `getFullyPaidStoreCreditPaymentMethod`.

### Trivial

1. `apps/mobile-storefront/hooks/use-checkout-savings.ts`
   - Remove the unused internal `requestKey` parameter.
2. `apps/mobile-storefront/schemas/payment-gateway.test.ts`
   - Add minimal `savings_auth` route-param coverage.
3. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Replace hardcoded white button text colors with wallet color constants.
4. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit recommends screen-owned `StorefrontScreenShell`; skipped as
     invalid because the route already owns the shell, matching current wallet
     route patterns and avoiding double shell wrapping.
5. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - CodeRabbit recommends screen-owned `StorefrontScreenShell`; skipped as
     invalid for the same route-owned shell reason.

## CodeRabbit Rerun - 2026-05-24 Seventh Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 1 minute 7 seconds. The retry
completed with 13 findings after sixth-pass fixes.

### Major

1. `apps/mobile-storefront/lib/customer-savings.test.ts`
   - Add network and HTTP error-path coverage for each customer savings API
     client function.

### Minor

1. `apps/mobile-storefront/lib/wallet-payment-helpers.ts`
   - Narrow `SavingsSelection.goalId` explicitly before building order fields.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit recommends screen-owned `StorefrontScreenShell`; skipped as
     invalid because the route already owns the shell and moving it into the
     screen would double-wrap the route.
2. `apps/mobile-storefront/lib/klump-checkout.ts`
   - Rename the Klump incompatibility copy from "Device savings" to "Savings
     plan" for UX consistency.
3. `apps/mobile-storefront/app/wallet/manage-cards.tsx`
   - Remove route-local color-scheme duplication by adding an opt-in themed
     background prop to `StorefrontScreenShell`.
4. `apps/mobile-storefront/schemas/wallet-funding-account.ts`
   - Centralize the Paystack funding provider literal in a provider tuple.
5. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
   - Document why the default savings debit time is 06:20.
6. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Document the technical limitation behind disallowing upfront
     contributions during auto-debit mandate setup.
7. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - CodeRabbit recommends screen-owned `StorefrontScreenShell`; skipped as
     invalid for the same route-owned shell reason.
8. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Scope customer wallet transaction reads by `merchant_id` as well as
     `wallet_id`.
9. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Use `VTU_MIN_REDEEMABLE_POINTS` in redemption validation messages.
10. `apps/mobile-storefront/schemas/customer-savings.test.ts`
    - Add savings schema boundary, required-field, and invalid-date tests.
11. `apps/mobile-storefront/lib/wallet-funding-account.ts`
    - Add JSDoc for `getWalletFundingAccount`.

## CodeRabbit Rerun - 2026-05-24 Eighth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 2 minutes 35 seconds. The retry
completed with 12 findings after seventh-pass fixes.

### Major

1. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because `app/wallet/manage-cards.tsx` already owns the shell.
2. `apps/mobile-storefront/hooks/use-checkout-savings.ts`
   - Clear checkout savings selection when the selected goal no longer has a
     spendable balance.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because `app/wallet/savings/start.tsx` already owns the shell.
2. `apps/mobile-storefront/lib/customer-savings.ts`
   - Extract the default Paystack savings authorization amount into a named
     constant.
3. `apps/mobile-storefront/lib/wallet-funding-account.ts`
   - Add JSDoc for `createWalletFundingAccount`.
4. `apps/mobile-storefront/components/ui/DateTimePickerField.test.tsx`
   - Add explicit empty-string date/time picker cases.
5. `apps/mobile-storefront/schemas/payment-gateway.ts`
   - Comment why `savings_auth` skips order and amount validation.
6. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Relax wallet funding account number validation to numeric 10-20 digits
     and remove the redundant Paystack provider check after schema validation.
7. `apps/mobile-storefront/schemas/payment-gateway.test.ts`
   - Add invalid `returnTo` sanitization coverage for `savings_auth`.
8. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.test.ts`
   - Split navigation-flow assertions into focused tests.
9. `apps/mobile-storefront/services/orders.ts`
   - Add a short comment explaining the fully formed savings intent guard.

## CodeRabbit Rerun - 2026-05-24 Ninth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: completed with 7 findings after eighth-pass fixes.

### Major

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because `app/wallet/savings/start.tsx` already owns the shell
     and moving it into the screen would double-wrap this route.

### Minor

1. `apps/mobile-storefront/lib/wallet-payment-helpers.ts`
   - Trim and reuse the savings goal id when building order fields.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/start-savings.styles.ts`
   - Move semantic selected-product and error text colors out of static styles
     and into theme-aware call sites.
2. `apps/mobile-storefront/components/wallet/savings/start-savings-modal.styles.ts`
   - Move modal close text color out of static styles and into theme-aware call
     sites.
3. `apps/mobile-storefront/components/wallet/savings/start-savings-modal-parts.test.tsx`
   - Add inactive saved-card and empty metadata coverage.
4. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Document why insufficient-wallet detection falls back to message matching.
5. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.test.tsx`
   - Split the 648-line selector test into checkout, wallet, and savings test
     files under the 300-line modularity rule.

## CodeRabbit Rerun - 2026-05-24 Tenth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 6 minutes 55 seconds. The retry
completed with 19 findings after ninth-pass fixes.

### Major

1. `apps/mobile-storefront/app/checkout.tsx`
   - Replace hardcoded retry-card warning colors with themed colors.

### Trivial / Minor

1. `apps/mobile-storefront/lib/vtu-checkout.ts`
   - Replace the single-value saved-card provider enum with a direct literal.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because `app/wallet/savings/start.tsx` already owns the shell.
3. `apps/mobile-storefront/components/wallet/savings/start-savings-modal-parts.tsx`
   - Replace saved-card checkmark `testID` with accessible label semantics and
     update tests.
4. `apps/mobile-storefront/app/wallet/savings/start.tsx`
   - Add explicit Expo Router stack title options for the start-savings route.
5. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Clarify and harden backdrop/request-close behavior and reduce duplicate
     conditional rendering.
6. `apps/mobile-storefront/components/ui/ModalSheet.test.tsx`
   - Avoid `UNSAFE_getByType` in modal tests.
7. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
   - Add picker accessibility labels and avoid silently preselecting today from
     invalid parsed date values.
8. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
   - Remove redundant `accessibilityRole` from amount `TextInput`.
9. `apps/mobile-storefront/lib/customer-savings.errors.test.ts`
   - Assert malformed response schema validation errors specifically.
10. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.test.tsx`
    - Assert the terms toggle receives and uses the function updater.
11. `apps/mobile-storefront/components/payment-gateway/use-payment-gateway-controller.test.ts`
    - Add savings-card authorization error/cancel coverage.
12. `apps/mobile-storefront/components/storefront/StorefrontScreenShell.test.tsx`
    - Add dark-theme shell background coverage.
13. `apps/mobile-storefront/app/wallet/index.tsx`
    - Log when wallet balances fall back because API fields are missing.
14. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
    - Replace hardcoded white hero colors with wallet color constants.
15. `apps/mobile-storefront/hooks/use-redeem-points.ts`
    - Extract pure redemption validation/snapshot helpers to keep the hook under
      the modularity guideline.

## CodeRabbit Rerun - 2026-05-24 Eleventh Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 19 seconds. The retry completed with
11 findings after tenth-pass fixes.

### Major

1. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Make `onRequestClose` the canonical system-dismiss callback and call
     backdrop logic only for actual backdrop taps.

### Minor

1. `apps/mobile-storefront/hooks/loyalty-redemption-utils.ts`
   - Make redemption balance snapshot keys unambiguous when ids contain colons.
2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Keep plan creation success visible when a follow-up `refetch` fails.

### Trivial

1. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Track multiple-wallet-owner data integrity issues through analytics.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because `app/wallet/savings/start.tsx` owns the route shell.
3. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
   - Simplify time parser fallback logic.
4. `apps/mobile-storefront/app/wallet/index.tsx`
   - Consolidate wallet balance fallback warnings.
5. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.test.ts`
   - Add failed-success-payload coverage for savings goal creation.
6. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.test.ts`
   - Add controller edge/error-state coverage.
7. `apps/mobile-storefront/components/wallet/savings/use-start-savings-payment-methods.test.ts`
   - Add empty-card, stale-selected-card, and unmount-during-load coverage.
8. `apps/mobile-storefront/schemas/customer-savings.ts`
   - Verify whether the backend still returns legacy `savingsStatus` before
     changing the mobile schema transform.

## CodeRabbit Rerun - 2026-05-24 Twelfth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 4 minutes 28 seconds. The retry
completed with 7 findings after eleventh-pass fixes.

### Major

1. `apps/mobile-storefront/app/checkout.tsx`
   - Extract savings retry UI into a focused component. The suggested full
     payment-submission hook split is a broad checkout rewrite and is deferred
     because it would destabilize unrelated checkout behavior in this core
     wallet/savings PR.

### Minor

1. `apps/mobile-storefront/lib/storefront-customer-api-client.test.ts`
   - Make malformed error-response JSON mock semantically consistent.
2. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Return an empty wallet when no customer or user identifier is available.
3. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - CodeRabbit recommends removing `accessible={false}` from the content
     wrapper; skipped because React Native uses that prop to keep the wrapper
     from becoming one unlabeled accessibility element while children remain
     reachable.

### Trivial

1. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
   - Validate parsed time ranges before passing them to the native picker.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - CodeRabbit again recommends screen-owned `StorefrontScreenShell`; skipped
     as invalid because the route owns the shell.
3. `apps/mobile-storefront/app/wallet/index.tsx`
   - CodeRabbit recommends replacing route-local `Alert.alert` calls with
     shared status modals; skipped because there is no shared wallet status
     modal primitive in the repo and Alert is the existing pattern here.

## CodeRabbit Rerun - 2026-05-24 Thirteenth Pass Mobile Scope

Command:

```bash
coderabbit review --prompt-only -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: completed with 18 findings after twelfth-pass fixes.

### Major

1. `apps/mobile-storefront/__tests__/app/checkout.test.tsx`
   - Add checkout coverage for the fully paid store-credit success branch.
2. `apps/mobile-storefront/app/checkout.tsx`
   - CodeRabbit recommends extracting the whole submit/payment orchestration
     into a new hook; skipped as too broad and risky for this core wallet
     feature PR because it rewrites unrelated checkout behavior.

### Minor / Trivial

1. `apps/mobile-storefront/hooks/loyalty-redemption-utils.ts`
   - Add explicit return types.
2. `apps/mobile-storefront/components/checkout/CheckoutSavingsRetryCard.tsx`
   - Move retry color branching into a helper and broaden tests.
3. `apps/mobile-storefront/lib/wallet-funding-account.ts`
   - Add merchant identifier precedence JSDoc.
4. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.test.ts`
   - Add source-mode initial-contribution reset coverage.
5. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - Document wallet-balance fallback priority.
6. `apps/mobile-storefront/components/wallet/card-formatting.helpers.ts`
   - Document expiry part normalization.
7. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
   - Replace max suggestions magic number with a constant.
8. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Share duplicated savings input style helper.
9. `apps/mobile-storefront/app/wallet/index.tsx`
   - Harden wallet balance fallback validation. The `showQuickSave` finding is
     invalid because it is passed into `WalletContent`.
10. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
    - Repeated route-shell finding skipped as invalid.
11. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
    - Add abort handling for retry/refresh card loads.
12. `apps/mobile-storefront/__tests__/app/wallet/index.test.tsx`
    - Loosen fallback logger assertions.
13. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
    - Document wallet funding amount calculation.

## CodeRabbit Rerun - 2026-05-24 Fourteenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 12 minutes 47 seconds, second retry
for 5 minutes 44 seconds, then the review completed with 11 findings after
thirteenth-pass fixes.

### Major

1. `apps/mobile-storefront/app/checkout.tsx`
   - Use gated live wallet/savings selections when calculating Klump disabled
     reasons, both in the payment picker and the submit guard.
2. `apps/mobile-storefront/__tests__/app/route-shell-safety.test.ts`
   - Fail fast when a route shell exemption has no route module index entry
     instead of letting optional chaining hide it.

### Minor / Trivial

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Repeated route-shell finding skipped as invalid because
     `app/wallet/savings/start.tsx` owns `StorefrontScreenShell`, and the shared
     shell currently has no pull-to-refresh API.
2. `apps/mobile-storefront/hooks/loyalty-redemption-utils.ts`
   - Replace JSON-stringified snapshot keys with deterministic escaped string
     keys.
3. `apps/mobile-storefront/components/checkout/CheckoutSavingsRetryCard.test.tsx`
   - Consolidate redundant dark/accessibility tests and add handler-throws
     coverage.
4. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Expose initial-contribution choices as radio controls with selected state.
5. `apps/mobile-storefront/services/orders.ts`
   - Trim `savings_goal_id` at the service schema boundary before UUID parsing.
6. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Split styles into a co-located style module to keep the screen under the
     300-line guideline.
7. `apps/mobile-storefront/components/wallet/ManageCardsScreen.test.tsx`
   - Document why the refresh-control handler is invoked directly in tests.

## CodeRabbit Rerun - 2026-05-24 Fifteenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 12 minutes 9 seconds, then the
review completed with 11 findings after fourteenth-pass fixes.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Replace Paystack-specific authorization progress copy with generic card
     authorization copy.
2. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Remove `accessible={false}` from the dismissable sheet content wrapper.
3. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Replace the `event.stopPropagation()` touch guard with a responder claim
     on the sheet content and add a regression test.
4. `apps/mobile-storefront/__tests__/app/checkout.component-mocks.test-utils.tsx`
   - Add a mock savings deselection control and checkout coverage for the
     turn-off path.

### Trivial

1. `apps/mobile-storefront/lib/customer-savings.ts`
   - Document that the default savings authorization amount is in kobo.
2. `apps/mobile-storefront/lib/storefront-customer-api-client.ts`
   - Remove a redundant `API_URL` alias and use `EXPO_PUBLIC_API_URL`
     directly.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/savings/start.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no scroll/refresh API.
4. `apps/mobile-storefront/hooks/use-checkout-savings.ts`
   - Reuse the precomputed checkout savings goal when callers pass the current
     cart item reference, and document snapshot semantics.
5. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/manage-cards.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no footer/refresh API.
6. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Remove the render-assigned `startCardsLoadRef` indirection and call the
     load starter directly.
7. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - Remove `targetAmount` from the preselection effect dependencies.

## CodeRabbit Rerun - 2026-05-24 Sixteenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: first retry was rate-limited for 2 minutes, then the review completed
with 13 findings after fifteenth-pass fixes.

### Critical

1. `apps/mobile-storefront/lib/checkout-savings.ts`
   - Export and directly test checkout savings helper predicates, including
     product/variant matching, redeemable status filtering, highest-balance
     selection, empty inputs, zero/negative balances, and non-redeemable
     statuses.

### Major

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/savings/start.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no scroll/refresh API.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Repeated missing-test-file finding skipped as stale because
     `StartSavingsModals.test.tsx` and `StartSavingsTransferModal.test.tsx`
     already cover preview, funding, transfer, success, disabled, loading, and
     error states.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Show `Authorizing card...` on the funding continue button while card
     authorization is in progress.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Align fallback copy with the wallet funding screen terminology.
3. `apps/mobile-storefront/components/ui/ModalSheet.test.tsx`
   - Replace implementation-level responder assertions with a behavioral test
     that pressing sheet content does not dismiss the modal.

### Trivial

1. `apps/mobile-storefront/components/navigation/RootStackScreens.tsx`
   - Add `slide_from_right` animation to the new wallet manage-cards and start
     savings stack entries.
2. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - Replace the local funding-account interface with the canonical schema
     type.
3. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.wallet.test.tsx`
   - Make the color-scheme mock mutable so tests can exercise light and dark
     modes.
4. `apps/mobile-storefront/components/wallet/ManageCardsScreen.test.tsx`
   - Use `screen` queries and keep a documented `getByTestId` only for the
     ScrollView refresh-control seam.
5. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/manage-cards.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no footer/refresh API.
6. `apps/mobile-storefront/components/checkout/CheckoutSavingsRetryCard.tsx`
   - Derive retry-card chrome from the theme colors instead of hardcoded
     palette values.
7. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Make the auto-debit initial-contribution validation provider-aware while
     preserving Paystack as the current default.

## CodeRabbit Rerun - 2026-05-24 Seventeenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 6 findings after sixteenth-pass fixes. Focused
regression suite after accepted fixes: 7 suites passed, 64 tests passed.

### Minor

1. `apps/mobile-storefront/app/checkout.tsx`
   - Extract duplicated store-credit-compatible payment checks into a shared
     helper so submit and Klump gating cannot drift.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/savings/start.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no scroll/refresh API.
3. `apps/mobile-storefront/components/wallet/ManageCardsScreen.styles.ts`
   - Convert static manage-card styles into a theme-aware factory so card
     management controls use the active storefront palette.

### Trivial

1. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/manage-cards.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no footer/refresh API.
2. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Require an explicit `paymentProvider` in savings form validation instead
     of silently defaulting inside the utility.
3. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Reuse the exported redeemable savings statuses instead of duplicating the
     active/paused/completed status list.

## CodeRabbit Rerun - 2026-05-24 Eighteenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: two retries were rate-limited, then the review completed with 14
findings after seventeenth-pass fixes. Focused regression suite after accepted
fixes: 7 suites passed, 94 tests passed.

### Critical

1. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Repeated backdrop/content nesting finding skipped as stale because the
     current implementation already renders the backdrop `Pressable` and sheet
     content as siblings inside the backdrop container.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Explicitly catch and log rejected funding-continue promises from the
     button handler.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Explicitly catch and log rejected card-authorization promises from the
     button handler.
3. `apps/mobile-storefront/hooks/use-wallet.test.ts`
   - Replace the direct `fetchWalletData` no-owner test with a public
     `useWallet` idle-query assertion that also verifies no table calls.

### Trivial

1. `apps/mobile-storefront/hooks/loyalty-redemption-utils.test.ts`
   - Add negative, fractional, `NaN`, infinite, and unsafe-integer redemption
     validation cases.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsProductFields.tsx`
   - Move savings frequencies into the shared helpers module and reuse the
     exported constant.
3. `apps/mobile-storefront/components/wallet/ManageCardsScreen.styles.ts`
   - Replace hardcoded manage-card spacing and line-height literals with design
     tokens.
4. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Document that insufficient cached points skip only the optimistic
     decrement while the RPC still validates.
5. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Throw on unsuccessful create responses so the submit path uses the same
     catch/finally cleanup.
6. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Extract synchronous submit-input validation before toggling
     `isSubmitting`.
7. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Simplify funding-account consent to depend on whether a valid Paystack
     funding account exists, matching the API contract.
8. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.ts`
   - Return `null` for invalid maturity start dates instead of silently
     defaulting to today.
9. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Extract a single card-loading helper for initial load, refresh, abort, and
     cleanup behavior.
10. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
    - Clipboard hook extraction skipped as not a good fit: the logic has one
      use site and extracting it would add a one-off hook plus required test
      surface without reducing cross-component complexity.
11. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
    - Proactive same-pattern fix: explicitly catch and log rejected copy/retry
      promises from transfer-modal actions. Focused modal regression suite:
      2 suites passed, 13 tests passed.

## CodeRabbit Rerun - 2026-05-24 Nineteenth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: multiple retries were rate-limited, then the review completed with 11
findings after eighteenth-pass fixes. Focused regression suite after accepted
fixes: 9 suites passed, 128 tests passed.

### Major

1. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Add colocated `wallet-data.test.ts` coverage for empty owners, customer
     ambiguity telemetry, query errors, invalid funding accounts, transaction
     normalization, savings balance math, and funding-account consent.
2. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Add colocated `use-redeem-points.test.ts` direct hook coverage for auth,
     invalid points, rollback on RPC failure, and reusable pending redemption
     behavior. Broader redemption coverage remains in `use-wallet.test.ts`.
3. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Expand the existing colocated submit-hook tests for API failure,
     authorization failure, missing/copy-failed funding account handling, and
     minimum wallet funding amount behavior.
4. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid because
     `app/wallet/manage-cards.tsx` already owns `StorefrontScreenShell`, and
     the shared shell has no footer/refresh API.
5. `apps/mobile-storefront/app/checkout.tsx`
   - Large `useCheckoutStoreCreditSubmission` extraction skipped for this PR:
     the small compatibility helper is already extracted and covered, while the
     suggested service would be broad checkout refactoring outside the wallet
     savings implementation risk budget.

### Minor

1. `apps/mobile-storefront/app/wallet/index.tsx`
   - Scope wallet balance warning dedupe keys by merchant and owner so one
     customer's warning does not suppress another customer's warning.

### Trivial

1. `apps/mobile-storefront/hooks/wallet-query.test.ts`
   - Add owner-id and transaction-key validation plus runtime frozen-key
     assertions.
2. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Make `backdropStyle` and `cardStyle` optional with default container/card
     styles.
3. `apps/mobile-storefront/components/wallet/savings/start-savings.helpers.ts`
   - Return `null` for invalid target/contribution maturity inputs and use a
     direct last-day-of-month check.
4. `apps/mobile-storefront/lib/checkout-savings.ts`
   - Add the explicit boolean return type to `goalMatchesCartItem`.

## CodeRabbit Rerun - 2026-05-24 Twentieth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 9 findings after nineteenth-pass fixes. Focused
regression suite after accepted fixes: 6 suites passed, 73 tests passed.

### Major

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Surface user-facing fallback alerts if rejected funding-continue or card
     authorization promises escape the controller.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Surface user-facing fallback alerts for rejected copy/retry promises and
     add a disabled `Copying...` state around the copy action.
3. `apps/mobile-storefront/app/wallet/index.tsx`
   - Move wallet balance contract warning emission out of render and into a
     scoped `useEffect`.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Add explicit copy loading/disabled behavior for the async funding-account
     copy action.

### Trivial

1. `apps/mobile-storefront/services/orders.ts`
   - Add a documented mobile safety cap for `savings_amount` and schema
     coverage for over-cap payload rejection.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.test.tsx`
   - Stop invoking the terms setter callback directly in the test; assert the
     public setter call and continue action instead.
3. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Export `ModalSheetProps`.
4. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Split runtime and type-only imports for savings submit dependencies.

## CodeRabbit Rerun - 2026-05-24 Twenty-First Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 9 findings after twentieth-pass fixes. Focused
regression suite after accepted fixes: 6 suites passed, 72 tests passed.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/start-savings.types.ts`
   - Replace the broad `Colors` union with the explicit color shape required by
     savings form helpers and components.

### Trivial

1. `apps/mobile-storefront/components/wallet/WalletContent.test.tsx`
   - Add an inline explanation for the post-unmount clipboard microtask flush.
2. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - Extract the wallet hero into `WalletHeroSection` with colocated component
     coverage while preserving funding-account copy feedback and create-account
     behavior.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Consolidate duplicate console/error alert fallback handling into a shared
     helper.
4. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Clarify why idempotency keys are generated only for manual initial
     contribution requests and are not overwritten on retries.
5. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid: the route already
     uses `StorefrontScreenShell`, while the shell component exposes only a
     safe-area container and still has no title, refresh-control, scroll, error,
     loading, footer, or bottom-action API required by `ManageCardsScreen`.
6. `apps/mobile-storefront/hooks/use-wallet.ts`
   - Debounce realtime savings-goal/contribution invalidations and clear the
     pending debounce timer on unmount.
7. `apps/mobile-storefront/lib/storefront-customer-api-client.ts`
   - Add a short-lived access-token cache that honors Supabase session expiry
     and refreshes inside a safety window.
8. `apps/mobile-storefront/package.json`
   - Keep `jest --runInBand` as the current stability path after reproducing a
     mobile Jest worker `SIGSEGV` under Turbo's default package test run.
     Follow-up is tracked here: investigate shared-resource isolation
     (`AsyncStorage`, native/file-system mocks, and Expo module worker safety)
     and remove `--runInBand` once the parallel worker crash is root-caused.

## CodeRabbit Rerun - 2026-05-24 Twenty-Second Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 12 findings after twenty-first-pass fixes.
Focused regression suite after accepted fixes: 6 suites passed, 60 tests
passed.

### Major

1. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid: the route already
     owns `StorefrontScreenShell`, and the shared shell still lacks the scroll,
     refresh, loading/error, footer, and bottom-action APIs required by
     `ManageCardsScreen`.
2. `apps/mobile-storefront/components/wallet/WalletHeroSection.tsx`
   - Remove the non-interactive balance tab row so the hero does not present
     fake segmented-control behavior.
3. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Keep `ModalSheet` mounted and pass `visible` to the React Native `Modal`
     so modal transitions can own show/hide animation.
4. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Stale finding skipped: `StartSavingsTransferModal.test.tsx` exists and
     covers rendering, copy/retry behavior, fallback alerts, disabled copy
     state, funding-account fallback, and wallet-funding action.
5. `apps/mobile-storefront/lib/customer-savings.ts`
   - Mark goal-status wrapper exports as `async` and explicitly `await`
     `mutateGoalStatus`.
6. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Stale finding skipped: `hooks/use-redeem-points.test.ts` exists and
     covers auth, validation, optimistic updates, rollback, pending id reuse,
     RPC paths, and query invalidation.
7. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Stale finding skipped: `use-start-savings-submit.test.ts` exists and
     covers validation, manual/auto-debit submit, idempotency, wallet funding,
     authorization, clipboard, and alert paths.
8. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Stale finding skipped: `wallet-data.test.ts` exists and covers empty
     owners, customer ambiguity, query errors, normalization, funding-account
     validation, transaction filtering, and computed balances.

### Minor

1. `apps/mobile-storefront/components/wallet/WalletHeroSection.tsx`
   - Trigger shared success haptic feedback after successful funding-account
     copy, gated behind the mounted check.

### Trivial

1. `apps/mobile-storefront/components/wallet/WalletHeroSection.tsx`
   - `isMountedRef` removal skipped as unsafe for this code path because the
     clipboard promise can resolve after unmount; the colocated tests pin that
     no post-unmount state update is emitted.
2. `apps/mobile-storefront/lib/storefront-customer-api-client.ts`
   - Move the access-token cache into the client factory closure so separate
     client instances do not share token state.
3. `apps/mobile-storefront/lib/checkout-savings.ts`
   - Type the redeemable status set as accepting the full savings status union
     and remove the unsafe cast in the type guard.

## CodeRabbit Rerun - 2026-05-24 Twenty-Third Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 17 findings after twenty-second-pass fixes.
Focused regression suite after accepted fixes: 11 suites passed, 70 tests
passed. Mobile lint, mobile typecheck, and `git diff --check` passed.

### Critical

1. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Stale finding skipped: the backdrop `Pressable` is already a sibling of
     sheet content, not a wrapper, and the content is rendered after the
     absolute-fill backdrop control so sheet actions remain interactive.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Stale finding skipped: `StartSavingsTransferModal.test.tsx` already
     covers visible/hidden behavior, funding-account details and fallback,
     copy/retry buttons, disabled copy state, and fallback alerts.

### Major

1. `apps/mobile-storefront/hooks/use-redeem-points.ts`
   - Stale finding skipped: `use-redeem-points.test.ts` already covers auth,
     validation, optimistic update, rollback, RPC failure/schema validation,
     reusable pending ids, cleanup, and query invalidation.
2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Stale finding skipped: `use-start-savings-submit.test.ts` already covers
     savings creation, idempotency, insufficient-wallet transfer modal,
     authorization redirect, clipboard, funding-screen routing, and alerts.
3. `apps/mobile-storefront/hooks/wallet-data.ts`
   - Stale finding skipped: `wallet-data.test.ts` already covers successful
     normalization plus missing/ambiguous customer, query failures, invalid
     rows, funding-account validation, and computed wallet balances.

### Minor

1. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Tighten insufficient-wallet fallback matching to a word-boundary regex
     while keeping backend error-code matching authoritative.
2. `apps/mobile-storefront/package.json`
   - Keep `jest --runInBand` as the package test path because Turbo parallel
     workers reproduced a mobile Jest worker `SIGSEGV`. Follow-up remains to
     root-cause Expo/native mock worker isolation before removing it.

### Trivial

1. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid: the route already
     wraps the screen with `StorefrontScreenShell`, and the shell still lacks
     the scroll, refresh-control, footer, and bottom-action APIs required by
     `ManageCardsScreen`.
2. `apps/mobile-storefront/components/ui/ModalSheet.tsx`
   - Pass `onRequestClose` directly to React Native `Modal` and remove the
     redundant wrapper function.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Convert retry handling to an `async`/`try`/`catch` path for parity with
     copy handling and shared fallback alerts.
4. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Replace the Paystack-specific inline check with provider capabilities for
     auto-debit initial contributions.
5. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.wallet.test.tsx`
   - Replace wallet-row label queries with role-based checkbox/radio queries.
6. `apps/mobile-storefront/components/wallet/WalletHeroSection.tsx`
   - Extract reusable mount-safe clipboard copy feedback into
     `useCopyToClipboard` with colocated hook coverage.
7. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.tsx`
   - Replace the inline `'savings'` fallback with a caller-overridable
     `savingsFallbackTitle` prop and regression coverage.
8. `apps/mobile-storefront/components/wallet/WalletContent.tsx`
   - Extract the primary actions into `WalletActionsRow` with colocated
     component coverage.
9. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Route savings submit alerts through `showAppAlert`, which centralizes
     native alert dispatch and haptic feedback.
10. `apps/mobile-storefront/components/ui/DateTimePickerField.tsx`
    - Document the `parseTimeValue` fallback contract for malformed `HH:MM`
      input.

## CodeRabbit Rerun - 2026-05-24 Twenty-Fourth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: review completed with 18 findings after twenty-third-pass fixes.
Focused regression suite after accepted fixes: 14 suites passed, 125 tests
passed. Mobile lint, mobile typecheck, and `git diff --check` passed after the
follow-up type fix.

### Critical

1. `apps/mobile-storefront/components/wallet/wallet.styles.ts`
   - Finding skipped as invalid: `walletHeroStyles` is a plain object exported
     with `as const`, not a `StyleSheet.create` result or numeric style id, so
     spreading it into the wallet `StyleSheet.create` call does not spread
     opaque native style ids.

### Major

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Finding skipped as invalid/stale for the current route tree:
     `app/wallet/savings/start.tsx` already wraps `StartSavingsScreen` with
     `StorefrontScreenShell`; adding another shell inside the component would
     nest safe-area containers, and the shared shell still exposes no scroll or
     refresh-control API.
2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - Add mutable re-entrancy guards for savings creation and card authorization
     so duplicate taps cannot submit duplicate async requests.

### Minor

1. `apps/mobile-storefront/components/checkout/PaymentMethodSelector.tsx`
   - Require a truthy `savingsGoalId` before considering the current savings
     selection active.
2. `apps/mobile-storefront/hooks/use-copy-to-clipboard.ts`
   - Remove redundant timeout-ref nulling inside the timeout callback while
     leaving central timer cleanup in `clearFeedbackTimer`.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Hide the copy-account action when no funding account exists, preventing a
     dead interaction in the empty state.

### Trivial

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsForm.tsx`
   - Use radio semantics for mutually exclusive source-of-funds choices and add
     a parent `radiogroup`.
2. `apps/mobile-storefront/components/wallet/WalletActionsRow.tsx`
   - Use the passed theme color for primary/quick-save icons instead of the
     wallet hardcoded white token.
3. `apps/mobile-storefront/lib/customer-savings-api.ts`
   - Lazily create and cache the customer savings API client instead of
     instantiating it at module load.
4. `apps/mobile-storefront/hooks/use-copy-to-clipboard.ts`
   - Accept caller-provided success/failure feedback messages.
5. `apps/mobile-storefront/components/ui/ModalSheet.test.tsx`
   - Simplify the content-press test to a single role lookup.
6. `apps/mobile-storefront/hooks/wallet-query.ts`
   - Make the wallet funding-account provider type extensible, and move wallet
     UI props to a display account type so UI components do not require the
     Paystack-only schema literal.
7. `apps/mobile-storefront/components/payment-gateway/use-payment-gateway-controller.ts`
   - Wait for savings card authorization confirmation before marking the
     payment-gateway flow successful, and keep still-processing confirmations
     retryable.
8. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - Replace the hardcoded default debit time with a named constant tied to the
     Figma savings flow default.
9. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Repeated shell replacement finding skipped as invalid: the route already
     wraps the screen with `StorefrontScreenShell`, and the shell still lacks
     the screen-level scroll/refresh/footer APIs required for this component.
10. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
    - Extract repeated async fallback alert handling into a shared helper.
11. `apps/mobile-storefront/app/checkout.tsx`
    - Extract store-credit payment compatibility into a shared helper and use
      the same rule in checkout and the payment selector.
12. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
    - Use the canonical wallet top-up minimum constant instead of a local
      duplicate.

## CodeRabbit Attempt - 2026-05-24 Partial Timed-Out Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: CodeRabbit returned partial findings and then timed out, so this does
not count as a completed review pass. Valid partial findings were still applied
and will be included in the next completed rerun. Focused verification after
these fixes passed: 13 suites, 137 tests; mobile lint, mobile typecheck, and
`git diff --check` passed after a small type correction.

### Applied From Partial Output

1. `apps/mobile-storefront/lib/store-credit-compatible-payment.ts`
   - Document the store-credit settlement rule and give its inputs strict
     checkout literal types; add runtime-edge rejection tests.
2. `apps/mobile-storefront/components/wallet/savings/StartSavingsTransferModal.tsx`
   - Use the shared `showAppAlert` helper for fallback errors.
3. `apps/mobile-storefront/components/wallet/savings/StartSavingsModals.tsx`
   - Route rejected modal actions through the structured app logger instead of
     raw `console.error`.

### Skipped From Partial Output

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Repeated shell replacement finding remains invalid: the route already
     wraps this component with `StorefrontScreenShell`, while the shell has no
     scroll or refresh-control slot.

## CodeRabbit Rerun - 2026-05-25 Twenty-Fifth Pass Mobile Scope

Command:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/mobile-storefront
```

Result: CodeRabbit completed with 10 findings after the partial timed-out
attempt. Focused verification after accepted fixes passed: 10 suites, 125
tests; mobile lint, mobile typecheck, and `git diff --check` passed.

### Applied

1. `apps/mobile-storefront/components/wallet/savings/StartSavingsScreen.tsx`
   - Document that the route already supplies `StorefrontScreenShell` and that
     the inner view owns pull-to-refresh because the shared shell exposes no
     scroll or refresh API.
2. `apps/mobile-storefront/components/wallet/savings/use-start-savings-controller.ts`
   - Keep the controller under the 300-line modularity limit.
3. `apps/mobile-storefront/hooks/use-wallet.ts`
   - Use a stable disabled query key without merchant data when wallet queries
     cannot run.
4. `apps/mobile-storefront/components/wallet/ManageCardsScreen.tsx`
   - Document the existing route shell ownership and inner refresh/footer
     responsibility rather than incorrectly nesting another shell.
5. `apps/mobile-storefront/lib/wallet-funding-account.test.ts`
   - Narrow the captured request options and body at runtime before parsing
     the JSON request payload.
6. `apps/mobile-storefront/schemas/wallet-funding-account.test.ts`
   - Cover account-number minimum and maximum length boundaries.
7. `apps/mobile-storefront/components/wallet/savings/start-savings-controller.utils.ts`
   - Document why automatic debit is restricted to known provider
     capabilities.
8. `apps/mobile-storefront/lib/customer-savings.ts`
   - Make savings authorization polling abortable so retries and unmounts
     cancel pending checks without leaking work; the controller now aborts
     on retry or unmount and cancellation behavior is covered by tests.

### Skipped As Already Covered Or Deliberate

1. `apps/mobile-storefront/components/wallet/savings/use-start-savings-submit.ts`
   - The missing-test finding is stale: the colocated test suite exists and
     covers duplicate-submit and duplicate-authorization guards.
2. `apps/mobile-storefront/package.json`
   - Retain `--runInBand`: parallel Jest execution under Turbo already
     reproduced a worker `SIGSEGV` in this app, so serial execution is a
     deliberate stability constraint pending root-cause work.

## CodeRabbit Attempts - 2026-05-25 Web And Whole-Branch Scope Blocked

Commands:

```bash
coderabbit review --agent -t uncommitted -c AGENTS.md
coderabbit review --agent -t uncommitted -c AGENTS.md --dir apps/web
```

Results:

1. The whole-branch command was rejected because the uncommitted feature
   change contains 192 files, exceeding CodeRabbit's 150-file limit.
2. The scoped web command was attempted again after the branch was narrowed
   for review, but returned `rate_limit`: the Ogabassey organization has run
   out of usage credits. CodeRabbit reported a retry wait of 10 minutes and
   56 seconds and directed billing changes to the usage subscription page.

Neither attempt counts as current CodeRabbit coverage. Stored findings from
earlier completed mobile passes were inspected only as an audit trail; most
were already addressed in the current worktree.

### Local Correctness Hardening While Review Is Blocked

1. Savings authorization confirmation is now tied to the exact
   `SAV-AUTH-*` transaction, saved authorization signature, and wallet ledger
   credit, preventing an older saved card from falsely completing a new
   authorization attempt.
2. Pending savings authorization transactions are now created before Paystack
   initialization, with an explicit failed transition when initialization
   fails, preventing an immediate webhook from arriving before local state.
3. Customer-facing savings feature and wallet DVA feature reads now use scoped
   security-definer RPCs rather than broad privileged reads; the DVA provider
   persistence step remains server-only because accepting customer-supplied
   receiver account data would let a customer claim another DVA.
4. Auto-debit goal selection now pages through a stable ordered result set
   until it finds a due batch or exhausts candidates, so non-due earlier rows
   cannot starve due savings debits indefinitely.
5. New savings and wallet mutation routes reject malformed JSON as
   `400 MALFORMED_JSON`, and unexpected provider/database failures return
   stable public errors while server logs retain diagnostic detail.
6. New large production TypeScript modules were decomposed so each changed
   feature implementation file remains below the repository's 300-line rule.
7. Newly added test suites were decomposed by endpoint behavior and payment
   responsibility so every new TypeScript or TSX file is below 300 lines.

### Verification After Local Hardening

```bash
pnpm --filter @baci/web exec vitest run src/lib/customer-savings-auto-debit.test.ts src/lib/customer-savings-auto-debit-db.test.ts src/lib/customer-savings-paystack-webhook.test.ts src/lib/customer-savings-paystack-authorization.test.ts src/app/api/storefront/customer/wallet/funding-account/route.test.ts src/app/api/storefront/customer/savings/shared.test.ts src/app/api/storefront/customer/savings/auto-debit/authorize/route.test.ts src/app/api/storefront/customer/savings/auto-debit/confirm/route.test.ts src/app/api/storefront/customer/savings/goals/route.test.ts src/app/api/storefront/customer/savings/goals/route-helpers.test.ts src/app/api/storefront/customer/savings/contributions/manual/route.test.ts src/app/api/storefront/customer/savings/goals/goal-action-handler.test.ts src/schemas/customer-savings.test.ts src/schemas/customer-savings.validation.test.ts
pnpm --filter @baci/web typecheck
pnpm --filter @baci/web lint
git diff --check
```

Result before the final modularity splits: the focused web suite passed with
14 test files and 126 tests; web typecheck, web Biome lint, and diff whitespace
verification passed. After splitting oversized test suites, the expanded web
focused run passed with 21 test files and 137 tests, and the affected mobile
focused run passed with 5 test suites and 60 tests.

## CodeRabbit Attempt - 2026-05-25 Final Rebased Mobile Scope

Command:

```bash
coderabbit review --agent -t committed -c AGENTS.md --dir apps/mobile-storefront
```

Result: failed before review coverage. CodeRabbit authenticated successfully
as `ogabasseyy`, attributed the repository to org `ogabasseyy`, then returned
`rate_limit` because the organization has run out of usage credits. CodeRabbit
reported a retry wait of 11 minutes and 55 seconds and directed billing changes
to the usage subscription page.

This attempt does not count as current CodeRabbit coverage. The final local
tree still includes the previously addressed CodeRabbit findings and the
current blocker is external account quota, not a local review failure.

## CodeRabbit Attempt - 2026-05-25 Wallet API Scope After PR Security Fix

Command:

```bash
coderabbit review --agent -t committed -c AGENTS.md --dir apps/web/src/app/api/storefront/customer/wallet
```

Results:

1. First retry failed with `rate_limit`: CodeRabbit reported that the
   organization has run out of usage credits, with a 27-second wait window.
2. Second retry completed for the wallet API scope and raised 3 trivial
   findings.

Findings and disposition:

1. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.ts`
   should log contextual `merchantId`, `customerId`, and error detail before
   rethrowing the wallet DVA feature-flag RPC failure. Disposition: implemented.
2. `apps/web/src/app/api/storefront/customer/wallet/funding-account/route.test.ts`
   should cover GET and POST 404 paths for missing merchant and missing
   customer. Disposition: implemented.
3. `apps/web/src/app/api/storefront/customer/wallet/route.test.ts` should cover
   the customer email fallback path and background `user_id` linking. Disposition:
   implemented.
