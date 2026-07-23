# HANDOVER — BYOK Payment Providers (PayPal lane) — READ FIRST

**Updated:** 2026-07-14 · **Branch:** `feat/payment-byok` · **PR:** [#3024](https://github.com/ogabasseyy/Baci/pull/3024) (OPEN)
**HEAD at writing:** `f160108c09` · **behind `origin/main`:** 32 commits · **migrations pending on merge:** 17

> **One-paragraph status.** The PayPal BYOK lane is code-complete and has been through **12 automated review rounds (Codex) + 2 independent Fable reviews + 1 adversarial review of the fixes themselves**. That review history found — and this branch has fixed — a large pile of real money bugs, including two P0s (a double-charge and a feature that shipped dead). **It is NOT yet ready to touch a real customer's money.** There is an open cluster of review findings from 2026-07-14 (below), a required human review of the shared-rail delta, and a sandbox end-to-end pass still outstanding. The PayPal feature gate is currently **verified closed in production**, so none of this is live. **The single most important strategic fact: PayPal does not serve the home market — see §2.**

---

## 0. If you read nothing else

1. **Do not merge-and-launch.** Merging behind the closed gate is fine (stops the drift tax); letting a real merchant take a real PayPal payment is NOT, until §6 is done.
2. **The gate is closed — verified with data, not belief** (2026-07-14): only one merchant (`ogabassey`, the owner's own store) has `paypal_enabled=true`, and it is `paypal_mode=sandbox`. Customer checkout is **live-only**, and the credentials vault table **does not exist in prod yet** (it ships in this PR's migrations). So even after merge, no money can move through PayPal until a merchant is deliberately switched to live with real credentials.
3. **There is an OPEN review-findings cluster from 2026-07-14 (§5).** Most were NOT adversarially confirmed (the verification pass hit a weekly usage limit), BUT two clusters are evident from the code and are almost certainly real: the **`refund_pending` write-only black hole** and the **reconciliation sweeper starving itself**. Triage these against current HEAD before merge.
4. **PayPal's real market is UK/US/EU, not Africa (§2).** If the goal is African merchants, the higher-value thread is **Lane 0 (Korapay)**, not PayPal.
5. **Every round of fixes in this branch has historically introduced ~1 new bug.** Assume the same of the latest fixes. Do not trust "tests pass" — they all mock Supabase, so schema/constraint bugs sail through (that is exactly how the `refunded` CHECK-constraint bug hid).

---

## 1. What this is + where the canonical plan lives

Let Baci merchants take storefront payments through **their own** payment-provider accounts, money settling directly to the merchant. This PR is **Lane 1: PayPal key-paste**.

- **THE PLAN (source of truth, read cover to cover):** `docs/payments/byok-payment-providers-plan.md`
- **The capture/reconcile design:** `docs/payments/paypal-capture-reconciliation-design.md`
- **CSP change required for the PayPal SDK:** `docs/payments/paypal-csp-required-change.md`

Lanes (from the plan): **Lane 0** = African currencies on Baci's OWN Korapay rails (KES/GHS/ZAR/XAF/XOF, keeps the 2%, no BYOK). **Lane 1** = PayPal (this PR). **Lane 2** = Stripe `rk_`. **Lane 3** = Paystack-Connect / Flutterwave / Razorpay (BD-gated, not built). Fee stance: **waive the 2% on BYOK lanes** (money settles direct to merchant), **keep 2% on platform rails**.

---

## 2. ⚠️ STRATEGIC REALITY — who can actually use PayPal BYOK (verified 2026-07-14)

This was not clear when the lane was built. It should drive the merge/launch decision.

- **PayPal is effectively send-only across most of Africa.** Only ~8 African countries can *receive and withdraw*: South Africa, Kenya, Botswana, Lesotho, Mauritius, Morocco, Mozambique, Senegal. **Nigeria cannot receive** — so the owner cannot be the pilot merchant, and NG merchants can never use this.
- **The receive-capable African currencies are not PayPal currencies.** KES and ZAR are not presentable to PayPal, so a Kenyan/South-African merchant can only use PayPal if they **price in USD**.
- **Net: PayPal BYOK realistically serves UK (GBP), US (USD), EU (EUR), CA, AU** — and those are the *safest* path through this code, because the only FX-conversion path (NGN→USD, the source of the P0 double-charge) is never reached for a native-currency merchant.
- **Consequence for launch:** the "pilot on your own store with real money" gate is **impossible** (owner is in NG). Substitute = **PayPal sandbox** end-to-end (sandbox business accounts are US-based, not country-bound). See §6.
- **The gate now enforces this** (commit `6d6383dcf8`): `paypal-merchant-countries.ts` is an explicit allow-list of receive-capable countries, applied to both launch-readiness and checkout, failing closed on unknown country; currency presentability is a separate, orthogonal check.

**Recommendation carried forward:** if the objective is *African* merchants, **Lane 0 (Korapay) is the higher-value next thread** — it already reaches KE/GH/ZA/CFA on working rails and keeps the 2%. PayPal reaches nobody in NG and earns £0/transaction (BYOK fee-waived). PayPal is worth finishing to *safe/merged-behind-gate*, then parking until it has an audience.

---

## 3. The review saga + what got fixed (chronological, so you can trust the state)

The PayPal money path went through an unusually long review loop. This matters because the **flat find-rate proved the PR is too big to review** (21k lines; [SmartBear data](https://www.propelcode.ai/blog/pr-size-impact-code-review-quality-data-study): defect detection ~28% on 1,000+-line PRs vs 87% under 100). A clean pass is a *sample that missed*, not a certificate — proven here: an earlier pass returned 0 findings and a re-run on the same commit found 4 P1s.

**Codex passes 8→11** (commits `b9eae8f68a` → `c3b9d927ac`): the recurring pattern was *fixes-of-fixes* — capture-order, `/verify`, and the create-order reconcile guard each **re-derived** "settle / block / refund / reject?" from their own slice of state, so a fix in one missed its twins. **Root-caused and fixed structurally by the settlement-funnel unification** (`cac2ba8cba`): ONE funnel — `resolvePaypalCaptureOutcome()` decides, `handlePaypalCaptureOutcome()` acts — every caller routes through it with intent `capture` (capture-order, the ONLY caller allowed to charge) or `reconcile_only` (verify, create-order, and the new cron; may NEVER charge). This drained 25 of pass-11's 39 findings at once.

**Pass 11 triage (39 findings → 25 already fixed, 2 refuted, 12 live).** The 12 live were fixed across `c3b9d927ac`; the headline ones:
- **BNPL double-charge** — resolver's settled-status set omitted `bnpl_approved`; a financed order could also be charged on PayPal. Fixed via one shared `NON_PAYABLE_PAYMENT_STATUSES` (imported by resolver + create-order + CAS so they can't drift).
- **Cancelled-checkout resurrection** — resolver keyed cancellation off `shipping_status` only, but the abandoned-order cron sets `payment_status='cancelled'` and leaves `shipping_status='pending'` (**1,018 such rows in prod**). Now read from `payment_status` too; a landed capture is refunded, not stranded.
- **PayPal shipped DEAD (#1)** — the snapshot RPC stripped `paypal_enabled` at the DB boundary, so checkout always read `undefined`. Migration `20260713150001` exposes it. (Tests missed it because they hand-build `feature_settings` and never cross the RPC.)

**Fable review #1 (money path) — found 2 things 12 Codex passes missed:**
- **P0 double-charge** (`61166024b6`) — the "already captured?" guard sat inside `if (reusablePayPalOrderId)`, and reusability is lost when the presentment drifts >$0.02. NGN presentments come from an FX rate cached 5 min, so nearly *any* retry re-priced past tolerance, skipped the guard, minted a second PayPal order, and overwrote the pointer to the first. Buyer charged twice; first capture stranded (no webhook, no cron). Fixed: every stored `gateway_reference` is checked before minting; superseded ids archived to `metadata.superseded_paypal_order_ids`.
- **P1 settle-vs-refund race** (`61166024b6`) — every CAS was on `orders` alone, so a refund lane could hand the money back while a settle lane flipped the order to paid against the refunded txn. Fixed: the writer now **claims the transaction row** (`.in('status',['pending','completed']).select('id')`) before the order CAS — a terminal txn matches nothing and settlement aborts. Also doubles as the row-count assertion the flips lacked (supabase-js returns `error:null` for a 0-row update).

**Fable review #2 (decision) + web research** converged with the code review on the ONE structural gap: **no webhook + no cron = no safety net.** PayPal BYOK has no webhook, so a capture whose local write failed was invisible forever. Built the **reconciliation sweeper** (`1069c2f365`, §4) as the fix. Both agents' launch plan also converged on: scoped human review of shared rails + a real-money pilot (blocked by §2, substitute = sandbox).

**Constraint bug caught & fixed (`1069c2f365` + migration `20260714090001`):** the terminal-marking guard wrote `status='refunded'`, but `transactions_status_check` did not permit that value. The write is best-effort, so the constraint violation was **logged and swallowed** — the refunded capture stayed settleable. *Every test passed because they mock Supabase.* This is the canonical "mocked tests can't catch schema bugs" case; keep it in mind. Constraint widened to `pending|processing|completed|failed|cancelled|refunded|refund_pending`.

**Korapay #39 (`0d6347fbc4`):** `calculatePlatformFee` hardcoded NGN, so the ₦2,050 cap was applied as a bare `2050` in KES/GHS/ZAR — a KES 500k order accrued 2,050 instead of 10,000. Now takes the order currency. **This is a live-rails bug that affected real money the day multi-country Korapay goes live — verify the fix didn't regress the NGN fee (see §5 gate-and-fees).**

---

## 4. The reconciliation sweeper (new, unreviewed money code — treat with suspicion)

- `apps/web/src/lib/payments/paypal-reconciliation-sweep.ts` + `apps/web/src/app/api/cron/paypal-reconciliation/route.ts` + `vercel.json` cron (every 10 min).
- **Purpose:** the missing safety net. Re-runs pending PayPal captures through the funnel under `reconcile_only` intent (so it **cannot charge**), healing rows whose local write failed after PayPal took the money.
- **It is autonomous, service-role, money-touching code that runs every 10 minutes.** The 2026-07-14 review flagged it heavily (§5) — its queue can starve. Do not consider it trustworthy until §5.1 is resolved.

---

## 5. ⚠️ OPEN review findings (2026-07-14) — TRIAGE BEFORE MERGE

Source: adversarial review of `d508dc50fb..9ea5c3a163` (workflow `wf_81389bc6-837`). **Honesty caveat:** the refutation/verification stage **largely failed on a weekly usage limit**, so most of these are *plausible, not confirmed*. **HEAD has since moved to `f160108c09`** (commits `82d9e0d868`, `ef9837444a`, `f160108c09` = "close … review gaps") — so **some may already be addressed. Re-check each against current HEAD.** Two clusters are evident from the code regardless and are almost certainly still real.

### 5.1 HIGH-CONFIDENCE (evident from the code, likely still live)

**A. `refund_pending` is a write-only black hole (P0/P1).** The migration adds `refund_pending` + a partial index, and `mark-paypal-transaction-refunded.ts` writes it — but **nothing re-polls it.** An accepted-but-later-FAILED PayPal refund (common in BYOK: draws on the merchant's own balance) strands the order and the buyer's money forever, and the review row says no action needed. *Fix:* add a `refund_pending` re-poll pass to the sweeper (index is already there) — `GET /v2/payments/refunds/{id}` via merchant creds → COMPLETED ⇒ `refunded`; FAILED/CANCELLED ⇒ restore to settleable + file `needsManualRefund`. Requires persisting the refund id on the transaction (currently only in review metadata).

**B. The sweeper starves itself (P1, flagged by 3 independent reviewers).** Oldest-first + `LIMIT 50`, and never-captured / abandoned `pending` rows are **never retired**, so they monopolize the cap forever and genuinely-stranded captures never get swept — the safety net silently stops working. *Fix:* give not-captured-past-grace rows a terminal state (e.g. `status='cancelled'` when the PayPal order is VOIDED/EXPIRED or the order is already cancelled) so they leave the candidate set; and/or add an attempt counter / `last_swept_at` + bound the scan window; alert when `truncated===true` instead of returning it in a 200 body nothing reads.

### 5.2 NEEDS VERIFICATION AGAINST DB/CODE (plausible, unconfirmed)

**C. `completed → refunded` never debits `merchant_balances` (P1).** The balance trigger fires only on transitions *into* `completed`, so refunded money may stay withdrawable via payouts. *BUT* — reviewer's own caveat — BYOK PayPal settles into the merchant's OWN PayPal account, so it's unclear PayPal payment rows should touch platform `merchant_balances` at all. **This needs a human decision, not just a patch.** Verify the actual trigger `update_merchant_balance()` behaviour first.

**D. `refundPaypalOrder` (customer-facing cancellation path) reads `.success` but not `.pending` (P1).** A PENDING refund is reported as a hard failure → wrong amount in the customer email, no audit row, invites a second refund (pay the buyer twice). It's also the one refund path that never calls `markPaypalTransactionRefunded`. *Fix:* thread `pending` through `PaypalRefundSplitResult` → the cancellation route; book the audit row in a non-completed state.

**E. Money-conservation on partial refunds (P1).** Refunded amount is gated on all-or-nothing success, so genuinely-refunded captures in a partial can book ZERO in the ledger. *Fix:* attribute per-capture from PayPal's returned `amount`, one audit row per COMPLETED refund, keyed by refundId.

### 5.3 P2 / follow-ups
- Five of six review-filing sites discard `refundCapturedPaypalOrder`'s `pending` flag.
- `canUsePaypalForLaunch` derives store currency from `country`, not the authoritative resolver (edge case; both fail closed).
- New `.neq('payment_status','partially_paid')` CAS guard has no matching refund branch (captured payment declined, not refunded, filed under a misleading reason).

---

## 6. LAUNCH GATES — before a real customer pays a real merchant

**Human / external (not code):**
1. **Triage §5** against current HEAD; fix 5.1 A+B at minimum; get a human ruling on 5.2 C.
2. **Scoped human review of the shared-rail delta** (~1–2k lines, NOT the 21k PR): `platform-fee.ts`, the gateway-selection / forced-gateway guards, the Korapay opt-out flip + fee-currency change, the shared branches of `/api/payments/verify` and the cancellation route, the `proxy.ts` CSP diff. **This is the only part that touches money already flowing on Paystack/Korapay today.** Half a day for one payments engineer. (Project stop-rule already triggered: "if another self-inflicted round appears, get a HUMAN review before merging money code.")
3. **PayPal CSP → `proxy.ts`** (protected file, needs owner approval) — diff in `docs/payments/paypal-csp-required-change.md`. Button can't load without it.
4. **Vercel env `PAYMENT_CREDS_ENCRYPTION_KEY`** — base64 32-byte KEK, distinct per env, `printf '%s' | vercel env add`. Vault decrypt fails closed without it.
5. **Apply all 17 migrations to the Supabase branch (in order) + regen types.** One failing migration blocks ALL deploys on this repo. Run `supabase/tests/*.sql` permission tests against the applied schema (not locally — baseline replay fails per project memory).
6. **Sandbox E2E matrix** (substitute for the impossible NG pilot): capture happy-path, abandon, cancel-before-capture, full refund, partial/mixed-tender refund, BNPL+PayPal double-tender, duplicate capture, retry-after-crash-mid-reconcile. Record results.
7. **Money-conservation property test** — randomized interleavings of capture/verify/cancel/refund asserting `sum(captured) − sum(refunded) === settled`, settled exactly once, no refund without positive proof. This is the mechanism that terminates the review loop (would have caught most of rounds 8–11). Build it before launch, not after.
8. **Reconciliation review rows must route to a human** (email/Slack), not a table nobody reads.

**Lane 0 (Korapay) gates, if that thread is picked up instead:** add KES/GHS/ZAR to `SUPPORTED_CURRENCIES`; live payout-corridor tests per market (the "sitting on a merchant's money" risk).

---

## 7. Verify current state / quick-start

```bash
cd /Users/mac/Baci-app/.worktrees/payment-byok
git log --oneline origin/main..HEAD | head            # ~54 commits
git rev-list --count HEAD..origin/main                # behind main (was 32) — MERGE MAIN before pushing
git diff --name-only origin/main...HEAD -- supabase/migrations   # 17 pending migrations

cd apps/web && rm -f tsconfig.tsbuildinfo
NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit
npx @biomejs/biome check src/lib/payments src/app/api/payments src/lib/checkout
NODE_OPTIONS=--max-old-space-size=8192 npx vitest run \
  src/lib/payments src/app/api/payments src/lib/checkout src/app/api/merchant src/app/api/cron
```

**Gate as of `f160108c09`:** payments/checkout suites green, tsc + biome clean. **Caveat that matters:** green tests mean little here — they mock Supabase, so they cannot catch the schema/constraint/real-PayPal-API bugs that have been the actual failure mode. Trust the sandbox E2E + the human review, not the unit suite.

**Prod verification snippet (gate-closed check — re-run before any merge):**
```sql
-- expect: only ogabassey, mode=sandbox; and no live credential rows
select m.slug, fs.custom_settings->>'paypal_enabled', fs.custom_settings->>'paypal_mode'
from merchant_feature_settings fs join merchants m on m.id=fs.merchant_id
where fs.custom_settings ? 'paypal_enabled';
```

---

## 8. Accepted / decided (don't re-litigate)
- **Vault RPCs do NO caller authz** (service_role-only, `auth.uid()` is NULL). The API route is the authorization boundary. Documented loudly in `merchant-credentials.ts`.
- **BYOK fee waived (0%)**, recorded as `byok_fee_accruals` rows (`fee=0, waived=true`) to keep a future fee/subscription option open. Platform rails keep 2%.
- **Settler identity is a 3-state verdict** (`this_txn|other_txn|unknown`): auto-refund requires positive proof (`other_txn`); `unknown` files a review and NEVER claws back. `unknown` is COMMON (non-PayPal tenders never stamp `paid_transaction_id`).
- **Country gate keeps ZA/KE** (PayPal pays out there) and lets the *currency* check stop them if they price in KES/ZAR — blocking by country would refuse a merchant PayPal will pay.

## 9. Worktrees
| Path | Branch | Role |
|---|---|---|
| `/Users/mac/Baci-app/.worktrees/payment-byok` | `feat/payment-byok` | THE working branch. |
| `/Users/mac/Baci-app/.worktrees/paypal-integration` | `feature/paypal-integration` | READ-ONLY prototype reference. Never edit. |

## 10. Working rules
- Subagents NEVER use `fable` for money-path code (model discipline); `opus` for crux slices. *(Note: the 2026-07-14 reviews deliberately used `fable` reviewers as an independent second opinion — that's review, not authoring.)*
- Biome not ESLint; TS strict, no `any`; colocated `.test.ts` (success + error); max 300 lines/file; Zod in `schemas/`.
- Never edit `proxy.ts` or existing migrations (append-only); commit explicit paths, never `git add -A` in a shared worktree.
- Merge `origin/main` immediately before pushing (branch drifts fast — 32 behind at writing). Pre-push hook runs typecheck + behind-base; verify with `cmd > log 2>&1; echo EXIT: $?` (piping masks exit codes).
