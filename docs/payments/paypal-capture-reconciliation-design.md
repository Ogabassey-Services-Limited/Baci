# PayPal Capture / Reconcile / Refund — Single Authoritative State Machine

Status: DESIGN (PR #3024, branch `feat/payment-byok`). Read-only phase — no source
changed by this doc.

## 1. Why this rearchitecture

Five rounds of Codex review found 30 defects because the PayPal capture decision is
smeared across **five independent decision points** that each re-derive "is this order
payable / already paid / correctly priced" from a different subset of state:

| Decision point | File | What it decides today |
|---|---|---|
| create-order completed-txn guard | `create-order/route.ts:136-202` | finalize + 409 |
| create-order reuse `already_captured` | `create-order/route.ts:385-394` | **409 only, no finalize** |
| capture-order pre-capture context | `load-paypal-capture-context.ts` | proceed / reconcileOnly / idempotent-200 |
| capture-order finalize | `finalize-paypal-capture-order.ts` | paid CAS + side effects |
| verify PayPal branch | `verify/route.ts:88-103, 259-520` | generic order-update, **no PayPal settlement** |
| cancellation refund | `order-cancellation-refund.ts` | refund `amount_paid` via PayPal only |

Each of these reads order.payment_status, transactions.status, the PayPal order status,
and the amount independently, and each patch to one exposes an adjacent hole in another.

**The fix:** every capture-outcome decision and every paid/reconcile write funnels through
**one pure resolver** (`resolvePaypalCaptureOutcome`) plus **one idempotent writer**
(`reconcilePaypalOrderToPaid`). No route re-derives the decision. Refund funnels through
one splitter (`refundPaypalOrder`) that honours the mixed-tender split.

---

## 2. Amount semantics — ONE definition, used everywhere

All amounts below are in the **order currency** unless suffixed `Presentment`.

```
orderTotal          = orders.total
walletAmountUsed    = orders.wallet_amount_used            (>= 0)
savingsAmountUsed   = Σ customer_savings_redemptions.amount for the order  (>= 0)
prepaidTender       = walletAmountUsed + savingsAmountUsed
residual(now)       = max(orderTotal - prepaidTender, 0)   ← what PayPal MUST collect
```

Two residual snapshots exist and MUST be compared:

- **`lockedResidual` = `transactions.amount`** — the order-currency residual that
  create-order computed and persisted when the PayPal order was minted
  (`persistPaypalPendingTransaction` writes `amount = residualAmount`). This is what the
  PayPal presentment was derived from and what the buyer approved.
- **`currentResidual` = `computeOrderResidualAmount(...)`** recomputed at capture/reconcile
  time — reflects any order-total change or tender change since the mint.

Presentment linkage (locked in metadata at create time, order currency ↔ PayPal currency):

```
presentmentAmount   = NGN ? round(lockedResidual / fxRate, 2) : round(lockedResidual, 2)
capturedPresentment = Σ PayPal capture.amount.value   (validatePaypalCaptureSet)
```

**The single amount contract** (`EPSILON = 0.02`, PayPal rounding tolerance):

1. **Capture integrity** — `|capturedPresentment − presentmentAmount| ≤ EPSILON`
   (already enforced by `validatePaypalCaptureSet`). Guards split/partial/FX drift.
2. **Pricing currency** — `capture.currency_code == presentmentCurrency` (enforced).
3. **Residual freshness** — compare `lockedResidual` vs `currentResidual`:
   - `currentResidual − lockedResidual > EPSILON` → **UNDERPAYMENT** (order total was
     raised, or a prepaid tender was removed, after the mint). The buyer would pay less
     than owed. → `reject_underpayment`. **Closes F-194.**
   - `lockedResidual − currentResidual > EPSILON` → **OVERPAYMENT** (order total lowered
     after mint). → `reject_overpayment` (never silently mark paid; file review). 
   - otherwise → residual is fresh, proceed.

Settlement split persisted at finalize so refund is exact:

```
paypalResidualPaid = lockedResidual              (order ccy; == what PayPal captured)
prepaidPaid        = orderTotal − lockedResidual (== prepaidTender)
amount_paid        = orderTotal                  (total collected across all tenders)
```

`amount_paid = orderTotal` stays (prepaid + residual = total by construction), but the
split `{ paypalResidualPaid, prepaidPaid }` is written to `transactions.metadata`
(`paypal_split`) so the refund path never assumes the whole `amount_paid` went to PayPal.
**Closes F-74.**

---

## 3. Explicit state-transition table

Rows enumerate **(order payment_status) × (PayPal order status) × (captured-vs-current-residual)**.
`Amt` legend: `N/A` = no capture yet (pre-capture); `UNDER`/`EXACT`/`OVER` compare the
locked/captured residual against the *current* residual per §2. `ACTION` is the single
decisive verb the funnel emits.

Actions: **MINT** mint fresh order · **REUSE** hand back approval link · **CAP+FIN** capture
then finalize · **RECON** reconcile-completed-unpaid (skip capture, persist PayPal response,
finalize) · **IDEM** already-paid idempotent 200 · **BLOCK-PE** block paid-elsewhere (+refund
if captured, +review, 409) · **REJ-UNDER** reject underpayment (+refund if captured, +review)
· **REJ-OVER** reject overpayment (+refund if captured, +review) · **FRESH** not approvable →
409 tell client to mint fresh · **CLAMP** cancelled-clamp: suppress side effects + review ·
**ROLLBACK** inventory-fail → undo paid.

### 3a. Pre-capture / capture path (order still shows unpaid at read time)

| Order PS | PayPal OS | Amt | ACTION | Notes |
|---|---|---|---|---|
| UNPAID | CREATED/APPROVED | EXACT | **CAP+FIN** | happy path |
| UNPAID | CREATED/APPROVED | UNDER | **REJ-UNDER** | order total raised post-mint (F-194) — reject *before* capture |
| UNPAID | CREATED/APPROVED | OVER  | **REJ-OVER** | order total lowered post-mint — reject before capture |
| UNPAID | COMPLETED | EXACT | **RECON** | PayPal already captured (our txn write lost) — no 2nd charge |
| UNPAID | COMPLETED | UNDER | **REJ-UNDER→REVIEW+REFUND** | captured, but now underpays → review + auto-refund captures |
| UNPAID | COMPLETED | OVER  | **REJ-OVER→REVIEW+REFUND** | captured overage → review + auto-refund |
| UNPAID | VOIDED/EXPIRED | N/A | **FRESH** | never captured → 409, client mints fresh |
| UNPAID | UNKNOWN/lookup-fail | N/A | **FRESH** | nothing indicates capture → safe to replace |

### 3b. Return-to-stale-approval while the order was settled elsewhere (F-203)

| Order PS | PayPal OS | Amt | ACTION | Notes |
|---|---|---|---|---|
| PAID | CREATED/APPROVED | N/A | **BLOCK-PE** | do NOT capture — 2nd charge. If buyer already approved this stale order and PayPal shows APPROVED, `void` it; return IDEM to client |
| PAID | COMPLETED | any | **BLOCK-PE→REVIEW+REFUND** | this stale PayPal order captured *after* the order was already paid by another tender/PayPal order → untracked double charge → file `captured_after_settlement` + auto-refund these captures, keep order paid |
| PARTIALLY_PAID | CREATED/APPROVED | N/A | **BLOCK-PE** | order not fully payable via a fresh full capture; funnel refuses |
| PARTIALLY_PAID | COMPLETED | any | **BLOCK-PE→REVIEW+REFUND** | as above |
| REFUNDED | any capturable | N/A | **BLOCK-PE** | refunded order is closed |
| REFUNDED | COMPLETED | any | **BLOCK-PE→REVIEW+REFUND** | re-captured after refund → review + refund |
| CANCELLED | any capturable | N/A | **BLOCK-PE** | create-order already rejects; defence-in-depth |
| CANCELLED | COMPLETED | any | **CLAMP** | capture landed on a cancelled order → `handlePaymentForCancelledOrder` + review, suppress side effects |

### 3c. This txn is the one that paid the order (idempotency / races)

| Order PS | txn.status | ACTION | Notes |
|---|---|---|---|
| PAID | completed (this txn) | **IDEM** | winner already ran side effects/settlement — return success |
| PAID | pending, PayPal COMPLETED, split matches | **RECON→IDEM** | CAS finds order already paid → idempotent success (no double side effects) |
| UNPAID | pending → we win CAS | **finalize** | only the CAS winner writes amount_paid + side effects |
| UNPAID | pending → we lose CAS | **IDEM/RECON** | re-read: paid ⇒ IDEM; unpaid ⇒ RECON retries |

### 3d. Finalize (post-CAS) inventory outcomes — same for every path above

| Inventory result | ACTION |
|---|---|
| confirmed | schedule side effects (notify + email w/ currency + direct settlement + fee accrual) |
| serialized-unavailable | **ROLLBACK** payment_status+amount_paid to pre-capture, file review, return 409 (**F-182 fix**) |
| transient error, rollback ok | file review, return 500 |
| transient error, rollback fails | file cleanup-failed review, return 500 |
| cancelled-clamp (row still cancelled) | **CLAMP**: `handlePaymentForCancelledOrder`, suppress side effects, 200 |

### 3e. Create-order minting (separate resolver `resolvePaypalCreateAction`, unchanged shape)

| Order PS | Stored PayPal OS | ACTION |
|---|---|---|
| UNPAID | none / matching pending CREATED/APPROVED (+approve link) | **REUSE** |
| UNPAID | pending but dead (VOIDED/expired / no approve link / presentment moved) | **MINT** (replacement request-id) |
| UNPAID | completed txn exists, OR reuse order COMPLETED | **RECON then 409** (both branches identical — see §5 F-393) |
| PAID/PART/REFUNDED/CANCELLED | any | **409 ORDER_NOT_PAYABLE** (existing `NON_PAYABLE_PAYMENT_STATUSES` + cancelled guard) |

---

## 4. Funnel contracts

Three new modules, each < 300 lines, replacing the scattered logic.

### 4a. `paypal-capture-outcome.ts` — the pure resolver (no I/O)

```ts
export interface PaypalCaptureState {
  orderPaymentStatus: string | null;   // unpaid | paid | partially_paid | refunded | cancelled
  orderShippingStatus: string | null;
  txnStatus: string;                    // pending | completed | ...
  paypalOrderStatus?: PaypalOrderStatus;// CREATED|APPROVED|COMPLETED|VOIDED|EXPIRED|UNKNOWN
  lockedResidual: number;               // transactions.amount (order ccy)
  currentResidual: number;              // computeOrderResidualAmount (order ccy)
  capturedPresentment?: number;         // set once a capture response exists
  presentmentAmount?: number;
}

export type PaypalCaptureOutcome =
  | { kind: 'capture_then_finalize' }
  | { kind: 'reconcile_completed_unpaid' }
  | { kind: 'already_paid_idempotent' }
  | { kind: 'block_paid_elsewhere';  captured: boolean }  // captured ⇒ refund+review
  | { kind: 'reject_underpayment';   captured: boolean }
  | { kind: 'reject_overpayment';    captured: boolean }
  | { kind: 'clamp_cancelled' }
  | { kind: 'create_fresh' };          // not approvable / never captured

export function resolvePaypalCaptureOutcome(s: PaypalCaptureState): PaypalCaptureOutcome;
```

Decision order (deterministic, first match wins) — this is §3 encoded:

1. `orderPaymentStatus === 'paid'` **and** this txn is the payer (txn completed / CAS
   already won) → `already_paid_idempotent`.
2. `orderPaymentStatus ∈ {paid, partially_paid, refunded}` (settled by *another* path) →
   `block_paid_elsewhere` with `captured = paypalOrderStatus === 'COMPLETED'`. **(F-203)**
3. `orderShippingStatus === 'cancelled'` and captured → `clamp_cancelled`.
4. residual freshness (§2): `currentResidual − lockedResidual > EPSILON` →
   `reject_underpayment` (`captured = COMPLETED`). **(F-194)**
   `lockedResidual − currentResidual > EPSILON` → `reject_overpayment`.
5. `paypalOrderStatus === 'COMPLETED'` → `reconcile_completed_unpaid`.
6. `paypalOrderStatus ∈ {CREATED, APPROVED}` → `capture_then_finalize`.
7. else → `create_fresh`.

Pure ⇒ exhaustively unit-testable one row per §3 cell (the exhaustiveness is the point).

### 4b. `reconcile-paypal-order.ts` — the idempotent writer (the ONLY place order→paid lives)

```ts
export async function reconcilePaypalOrderToPaid(input: {
  supabase: SupabaseClient;         // service client
  merchantId: string;
  orderId: string;
  paypalOrderId: string;
  transactionId: string;
  lockedResidual: number;           // order ccy — becomes paypalResidualPaid
  orderTotal: number;
  prepaidTender: number;            // walletAmountUsed + savingsAmountUsed
  preCaptureStatus: {               // for inventory rollback
    payment_status: string | null;
    shipping_status: string | null;
    amount_paid: number | string | null;
  };
}): Promise<NextResponse>;
```

Responsibilities (idempotent, exactly-once):

1. **CAS claim** — `UPDATE orders SET payment_status='paid', amount_paid = :orderTotal,
   shipping_status = (pending ? processing : unchanged), updated_at=now WHERE id=:orderId
   AND merchant_id=:m AND payment_status <> 'paid'` returning the full order row. Only the
   flipping request proceeds; losers re-read (paid ⇒ idempotent 200, else 500 + review).
   `amount_paid` is **set once** by the CAS winner.
2. **Persist split** — write `transactions.metadata.paypal_split = { paypalResidualPaid:
   lockedResidual, prepaidPaid: orderTotal − lockedResidual }` on `:transactionId`
   (idempotent overwrite) so the refund funnel reads an exact split. **(F-74)**
3. **Cancelled clamp** — `isOrderClampedAsCancelled(order)` ⇒ `handlePaymentForCancelledOrder`
   + suppress side effects, return success (existing F1 behaviour).
4. **Inventory** — `ensurePaidOrderInventoryConfirmed`. On failure:
   - serialized-unavailable → **roll back** payment_status+shipping_status+amount_paid to
     `preCaptureStatus`, file review, return 409. **(F-182 fix — the current 409 branch skips
     rollback so a refresh sees paid.)**
   - transient → rollback (+cleanup review on rollback failure), 500.
5. **Side effects** via `after()` → `runPaypalCaptureSideEffects` (notify + email **with
   `currency`** + `record_merchant_settlement_v2 direct_to_merchant` + fee accrual).
   Settlement is inside the scheduled effects, so **every** path that calls this funnel
   settles — including verify. **(F-101)**
6. Return `{ success, status:'success', orderNumber }`.

This subsumes `finalize-paypal-capture-order.ts`; that file becomes a thin adapter or is
deleted, and its callers call `reconcilePaypalOrderToPaid`.

For `reconcile_completed_unpaid` where **no local capture response exists yet** (create-order
`already_captured` reuse, F-393), a small helper first fetches the PayPal order
(`getOrder`), runs `validatePaypalCaptureSet`, and writes `transactions.status='completed' +
gateway_response` (guarded `.eq('status','pending')`) before calling the writer.

### 4c. `refund-paypal-order.ts` — the mixed-tender split refunder (replaces PayPal branch of `order-cancellation-refund.ts`)

```ts
export interface PaypalRefundSplitResult {
  success: boolean;
  paypalRefunded: number;      // order ccy, = paypalResidualPaid on full success
  prepaidRestored: number;     // wallet + savings returned
  totalRefunded: number;       // paypalRefunded + prepaidRestored
  paypalRefundIds: string[];
  pendingRefundIds?: string[];
  refundPending?: boolean;
  walletCreditId?: string;
  savingsRestored: boolean;
  error?: string;
}
export async function refundPaypalOrder(input: {
  supabase, merchantId, order, transaction, reason
}): Promise<PaypalRefundSplitResult>;
```

1. Read `transactions.metadata.paypal_split` → `{ paypalResidualPaid, prepaidPaid }`
   (fallback: recompute from order total + wallet_amount_used + savings if absent, so
   pre-existing orders still split correctly).
2. **PayPal leg** — `initiatePaypalOrderRefund` (unchanged: full refund per capture,
   presentment ccy) → `paypalRefunded = paypalResidualPaid` on success. An accepted but
   incomplete refund stores its PayPal refund ids and moves the payment transaction to
   `refund_pending`, which is non-settleable and safe to poll without resubmitting. The
   status transition and reconciliation-metadata merge run in one locked database RPC;
   zero affected rows are surfaced as an audit failure instead of being treated as success.
3. **Prepaid leg** — restore `walletAmountUsed` to the customer wallet through the
   order-idempotent credit RPC and atomically stamp matching
   `customer_savings_redemptions` rows reversed → `prepaidRestored`.
4. Record refund audit rows **per channel** (`transactions.transaction_type='refund'`, one
   `gateway='paypal'` for the residual, one `gateway='wallet'`/`'savings'` for the prepaid),
   each with its own amount — never one row claiming `amount_paid` refunded via PayPal.
5. For cancellation refunds that remain pending, store a prepaid-recovery marker. The refund
   sweep retries the idempotent wallet/savings restoration after PayPal completes and only
   then advances `refund_pending → refunded`; a failed prepaid retry stays recoverable.
6. Report `totalRefunded` and the split to the caller; the cancellation email/report renders
   the true split. **(Closes F-74 end-to-end.)**

The caller (`processOrderCancellationRefund`) stops reporting `amount = amount_paid` refunded
via one gateway; it reports `outcome.totalRefunded` with the split.

The guest create-order route gets merchant country from the email-bound
`get_order_payment_snapshot` RPC. It does not issue an unrestricted service-role read against
`merchants`; the snapshot exposes only the existing order payment fields plus country.

---

## 5. Per-finding resolution

| # | Finding | Closed by |
|---|---|---|
| **F-203** | `load-paypal-capture-context.ts:203` — return-to-old-approval for an already-paid/refunded order returns `proceed:true` → double charge | §4a rule 1–2 `block_paid_elsewhere` runs **before** any capture; if PayPal already COMPLETED, auto-refund + `captured_after_settlement` review. The pre-capture context no longer decides "proceed"; it feeds state to the resolver, which checks `order.payment_status ∈ {paid,partially_paid,refunded,cancelled}` for the pending-txn path (today it only checks that when `txn.status==='completed'`). |
| **F-194** | `load-paypal-capture-context.ts:194` — amount check rejects only overcharge; a raised order total lets an underpayment through | §2 residual-freshness compares `lockedResidual` vs `currentResidual`; §4a rule 4 emits `reject_underpayment` before capture (and refund+review if already captured). Replaces the one-sided `txn.amount > total` check. |
| **F-101** | `verify/route.ts:101` — PayPal completed-but-unpaid reconcile: `.neq('status','completed')` ⇒ `updatedTxn=null` ⇒ `if(updatedTxn)` skips settlement + side effects, order marked paid with no direct settlement | verify's PayPal branch delegates to `reconcilePaypalOrderToPaid` (§4b) instead of the generic order-update path. Settlement + notify + email run via `after()` on every path, gated by the CAS claim, not by `updatedTxn`. The generic `.neq/if(updatedTxn)` logic no longer governs PayPal. |
| **F-182** | `finalize-paypal-capture-order.ts:182` — serialized-inventory 409 leaves order `paid`; refresh sees paid, success though inventory unconfirmed | §4b step 4: the serialized-unavailable branch now performs the **same rollback** (payment_status + shipping_status + amount_paid → pre-capture) as the transient branch, then files review + returns 409. A refresh sees unpaid and retries cleanly. |
| **F-74** | `order-cancellation-refund.ts:74` — mixed tender: refunds only PayPal residual but reports full `amount_paid` refunded; wallet/savings stays consumed | §2 persists `paypal_split`; §4c `refundPaypalOrder` refunds the PayPal residual **and** restores wallet/savings, records per-channel audit rows, and reports the true `{paypalRefunded, prepaidRestored, totalRefunded}` split for audit + email. Accepted asynchronous refunds are terminalized only after the sweep also completes any marked prepaid recovery. |
| **F-138** | `paypal-capture-side-effects.ts:138` — confirmation email omits currency; template defaults to NGN | §4b step 5 / side-effects: `emailConfirmation` templatePayload passes `currency: order.currency ?? 'USD'` (mirrors verify/route.ts:494), and `notify()` uses `order.currency` consistently. `order.currency` is already selected in the finalize `.select`. |
| **credentials:162** | `paypal-checkout-credentials.ts:162` — mid-checkout 401 handler calls `disablePaypalFeatureFlag(merchantId)`, disabling the merchant's **entire** PayPal (all environments, all customers) on a single, possibly transient, OAuth 401 | **Classification: [P3] availability / blast-radius, orthogonal to the reconcile funnel.** Fix: keep `markMerchantCredentialInvalid` (checkout already fails closed on a null/invalid vault credential, so the credential mark alone stops charges), and **remove the global `disablePaypalFeatureFlag` from the runtime checkout 401 path** — leave feature-flag lifecycle to the settings/disconnect route (which owns it with proper auth). This mirrors the payment-credentials scope lesson: never take a global destructive action from a single runtime failure. Credential-invalidation stays outside the funnel. |
| **create-order:393** | `create-order/route.ts:393` — reuse `already_captured` branch returns 409 **without** finalizing; the completed-txn guard at :160 does finalize. Money captured at PayPal, order left unpaid + unsettled | **Classification: [P1] correctness / stuck-payment.** Fix: the `already_captured` branch routes through the **same** `reconcile_completed_unpaid` path as the completed-txn guard — fetch the PayPal order, `validatePaypalCaptureSet`, persist `gateway_response` + flip txn, call `reconcilePaypalOrderToPaid`, **then** 409. Both create-order guards become one call site (§6). |
| **payment-credentials:204** | rollback `deleteMerchantCredentials(merchantId, provider)` deletes ALL PayPal creds for the provider, not just the failed environment/roles; a transient sandbox-save failure nukes an unrelated LIVE pair | Replace the app-level two-write/rollback sequence with the service-only `replace_merchant_payment_credential_pair` RPC. It serializes a merchant/provider/environment pair under an advisory transaction lock and commits both encrypted roles or neither, so concurrent saves cannot interleave and an unrelated environment is untouched. |
| **use-paypal-return:49** | `use-paypal-return.ts:49` — `setIsProcessing(true)` before `await` re-renders; inline `getHref`/`routerPush` change identity → effect cleanup sets `active=false`, a successful capture is ignored, customer stranded on checkout | Decouple the capture effect from unstable caller callbacks: hold `getHref`, `routerPush`, `clearCart`, `clearCheckoutSession`, `setIsProcessing` in refs updated each render, and narrow the effect deps to `[merchantId]` (the flow is already single-shot via `handledRef`). The cleanup no longer runs on every parent re-render, so `active` stays true through the in-flight capture. Equivalent: track `active` in a ref keyed to true unmount, not to dependency-change cleanup. |

---

## 6. Per-call-site migration

**`load-paypal-capture-context.ts`** → becomes a pure **state loader**: fetch txn + order,
compute `currentResidual` (via `computeOrderResidualAmount`), and return
`PaypalCaptureState` (§4a) plus the scoping/mismatch guards it already does. It **stops
emitting `proceed`/`reconcileOnly`/idempotent-200 decisions** and the one-sided amount check
(:192-201) — those move into `resolvePaypalCaptureOutcome`.

**`capture-order/route.ts`** → load state → `resolvePaypalCaptureOutcome`:
- `capture_then_finalize` → call PayPal `captureOrder`, `detectPayPalResponseMode`,
  `validatePaypalCaptureSet`, persist txn→completed, then `reconcilePaypalOrderToPaid`.
- `reconcile_completed_unpaid` → (persist response if needed) → `reconcilePaypalOrderToPaid`.
- `already_paid_idempotent` → 200 success.
- `block_paid_elsewhere` (captured) → `refundPaypalOrder`/void + `captured_after_settlement`
  review → 409; (not captured) → void APPROVED + 409.
- `reject_underpayment`/`reject_overpayment` → (refund+review if captured) → 400/409.
- `clamp_cancelled` → handled inside the finalize writer.
- `create_fresh` → 409 `PAYPAL_ORDER_NOT_APPROVABLE`, client mints fresh.
The inline `updatedTransaction`/race branches (:217-289) collapse into the CAS inside the
writer.

**`create-order/route.ts`** → the completed-txn guard (:136-202) and the reuse
`already_captured` branch (:385-394) become **one** helper that runs the
`reconcile_completed_unpaid` path (fetch PayPal order, validate, persist, call
`reconcilePaypalOrderToPaid`) then returns 409 `ORDER_ALREADY_CAPTURED`. **(F-393)** The
`NON_PAYABLE_PAYMENT_STATUSES` / cancelled guards stay as the mint precondition.

**`verify/route.ts`** → in `verifyGatewayPayment`, PayPal still maps stored status →
success/pending. But when `gateway==='paypal'` and reconciliation is needed (completed txn,
order unpaid), the handler **delegates to `reconcilePaypalOrderToPaid`** and returns its
response, instead of the generic `.neq('status','completed')` update + `if(updatedTxn)` side
effects. Non-PayPal gateways keep the existing generic path. **(F-101)**

**`order-cancellation-refund.ts`** → `dispatchGatewayRefund` PayPal branch calls
`refundPaypalOrder` (§4c); `processOrderCancellationRefund` reports `totalRefunded` + split
and records per-channel audit rows. Paystack/Korapay branches unchanged. **(F-74)**

**`paypal-checkout-credentials.ts`** → remove `disablePaypalFeatureFlag` from
`markPaypalCredentialInvalid` (runtime path); keep credential-mark only. **(credentials:162)**

**`merchant/payment-credentials/route.ts`** → replace both encrypted roles through one
service-only, pair-locked database RPC; there is no app-level partial-write rollback.
**(payment-credentials:204)**

**`use-paypal-return.ts`** → refs for callbacks + narrowed deps. **(use-paypal-return:49)**

---

## 7. Risks / follow-ups

- **PayPal `void` API** for BLOCK-PE on an APPROVED-but-uncaptured stale order must exist in
  `@/lib/paypal`; if not, fall back to filing a review row (never silently proceed).
- **Wallet/savings restore** uses `credit_customer_wallet` (order-idempotent) plus the
  service-only conditional `mark_customer_savings_redemptions_reversed` RPC. Keep both
  contracts and the pending-refund recovery marker covered by migration and retry tests.
- `reconcile_completed_unpaid` fetching the PayPal order adds a live call on the create-order
  and verify reconcile paths; acceptable (cold path) but must be time-bounded.
- Backfill: pre-existing paid PayPal orders lack `paypal_split` metadata — the §4c fallback
  recompute from `wallet_amount_used` + savings keeps their refunds correct.
- The state resolver must be covered by an exhaustive table-driven test (one case per §3
  row) so future edges are added to the table, not to a route.
