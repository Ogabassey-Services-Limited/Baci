# HANDOVER — BYOK Payment Providers Implementation

**Written:** 2026-07-08 · **Updated:** 2026-07-08 (Wave 2 closure pass) · **For:** the next agent/engineer continuing this work
**Status at handover:** Wave 1 + Wave 2 (PayPal lane) **code-complete, twice adversarially reviewed (incl. an independent verification of the gap-closure commit), low-severity polish applied (`232c721e66`: 400 PAYPAL_UNSUPPORTED_CURRENCY vs 503 FX outage, mode-mismatch captures now file reconciliation reviews, dead isSandboxMismatch removed, non-paypal fee-passthrough regression test). 19 commits, gate green. PUSHED as PR #3024 (https://github.com/ogabasseyy/Baci/pull/3024) on 2026-07-10 after merging origin/main twice (incl. #2993 multi-country currency — guard composition documented in the PR body). CSP applied to proxy.ts (own commit); Vercel PAYMENT_CREDS_ENCRYPTION_KEY set per environment. Remaining: PR review loop + merge-time migration apply/type regen + PayPal pilot.**

> ✅ **Wave 2 closure pass completed:** the prior top-of-queue gaps are closed. `apps/web/src/app/api/merchant/payment-credentials/route.test.ts` now covers unauthenticated, permission-denied, CSRF, rate-limit, invalid provider credentials, save, write-only GET, DELETE, and no-secret-in-response behavior. The Wave 2 adversarial review over `git diff 66b794a188..HEAD` found and fixed four issues: unsupported non-NGN PayPal currencies now fail closed before order creation, capture mode detection rejects `unknown`, PayPal capture uses a stable `PayPal-Request-Id`, and direct-to-merchant verify reconciliation forces `p_platform_fee=0` even for stale prototype rows. It also scrubbed legacy PayPal credential keys from generic feature-settings responses/writes.

---

## 1. What this project is

Let Baci merchants take storefront payments through **their own** payment-provider accounts (money settles directly to the merchant), primarily to unlock online payments for merchants **outside Nigeria** who have none today. Full decisions, rationale, and phased plan:

- **THE PLAN (read this first, cover to cover):**
  `docs/payments/byok-payment-providers-plan.md`
  (identical copy also at the main checkout `/Users/mac/Baci-app/docs/payments/byok-payment-providers-plan.md`)

The plan is the source of truth. It contains: the 3-lanes decision (Lane 0 African currencies on Baci's Korapay rails / Lane 1 PayPal key-paste / Lane 2 Stripe `rk_` / Lane 3 Paystack-Connect+Flutterwave+Razorpay), the fee stance (**waive 2% on BYOK lanes, keep 2% on platform rails**), storage design (`private` schema + SECURITY DEFINER RPCs + AES-256-GCM), the merchant-country-gates-rails / customer-geo-only-ranks rule (§3.2), the Payaza vs Korapay bake-off (§Phase 1.6/7), M-Pesa/Kenya notes, and per-provider ToS findings.

**Superseded sibling doc:** `docs/ai/byok-gemini-keys-plan.md` is an EARLIER, DIFFERENT feature (merchants supplying their own Gemini AI keys). It was mooted by PR #2978 (Cerebras/Gemma multi-provider copilot chain, already merged to main). Open question for the user: delete it or keep as backlog. Do NOT confuse the two docs.

---

## 2. Worktrees (exact paths)

| Path | Branch | Role |
|---|---|---|
| `/Users/mac/Baci-app/.worktrees/payment-byok` | `feat/payment-byok` | **THE working branch — all implementation lives here.** Branched from `origin/main` @ `f0115846b1` (2026-07-08). |
| `/Users/mac/Baci-app/.worktrees/paypal-integration` | `feature/paypal-integration` | **READ-ONLY reference.** The original PayPal prototype (5 commits, ~6 weeks stale). Wave 2 ports from it. NEVER commit or edit here. |
| `/Users/mac/Baci-app` (main checkout) | `codex/posthog-observability` | Unrelated session branch. The plan doc + AI-keys doc live here too, but no BYOK payment code. Leave alone. |

**PR #3024 is OPEN** (pushed 2026-07-10 after user approval). Watch the review gates (CodeRabbit/Codex/Jules) there.

---

## 3. Progress — what's DONE and reviewed (Wave 1, all committed)

Branch `feat/payment-byok`, commits vs `origin/main` (oldest first):

| Commit | What | Model | Status |
|---|---|---|---|
| `5b2a65d5c9` | plan doc | — | ✅ |
| `2a799df418` | `lib/crypto/secret-box.ts` — AES-256-GCM (server-only, versioned KEK, tamper tests) + `env.ts` + `turbo.json` wiring | sonnet | ✅ reviewed clean |
| `6f2a3d76f5` | `lib/payments/platform-fee.ts` — consolidated the **3** duplicated 2%-fee helpers (found a 3rd IEEE-754 divergence in credit-direct), bit-for-bit parity oracle tests | opus | ✅ reviewed clean |
| `475d5d3192` | country-gate Korapay availability (`isKorapayCheckoutAvailable(merchant, country?, currency?)`, null country = NG) | opus | ✅ |
| `8ac5476ba1` | harden client-forced `data.gateway` in initialize route → `isForcedGatewayAvailable` guard, fail-closed | opus | ✅ |
| `188f636b30` | **vault**: migration `20260708093415_merchant_payment_credentials.sql` (`private.merchant_payment_credentials` + 6 SECURITY DEFINER RPCs, `byok_fee_accruals`) + `lib/payments/merchant-credentials.ts` wrapper | sonnet (recovered) | ✅ reviewed clean |
| `9ddd520fd0` | close the auto-select gating gap (the one MEDIUM review finding) — country-gate Korapay inside `selectGateway` + downstream guard | opus | ✅ |
| `415a32e26b` | doc: record `SUPPORTED_CURRENCIES` whitelist as a Lane-0 launch gate | — | ✅ |
| `66b794a188` | SQL permission-assertion test `supabase/tests/merchant_payment_credentials_permissions.sql` + authz doc comments on the vault wrapper | sonnet | ✅ |

**Wave 1 final gate (verified by me):** `pnpm turbo lint/typecheck --filter=@baci/web` clean; **746 scoped tests passed** across crypto/payments/checkout/initialize/korapay/paystack/credit-direct/seo-utils/env.

**Wave 1 adversarial review verdict:** no high-severity defects. Money-path parity bit-for-bit, RPCs correctly `REVOKE`-then-`GRANT service_role`, RLS on `byok_fee_accruals` joins via `merchants.user_id` (not the classic mistake), secret-box server-only + never logs key material, migration replay-safe. All findings resolved or accepted (see §6).

---

## 4. Wave 2 (PayPal lane) — FINISHED, REVIEWED, AND TESTED

Workflow `wdp9mamg6` (run `wf_ce809e80-821`) completed: **5 agents succeeded, 4 dropped** (`credentials-api` connection loss; `checkout-wiring`, `gate:quality`, `review:adversarial` all hit the session limit at 19:10 Africa/Lagos). The dropped work was closed in the follow-up pass: the credentials API route now has colocated route tests, and Wave 2 received a direct adversarial review with fixes.

**Wave 2 commits (all LANDED, newest first):**
- `b8d54110fc` feat(checkout): paypal payment option gated by vault-backed availability *(checkout-wiring — it committed before its report dropped; includes `lib/paypal-checkout-client.ts`, `checkout/hooks/use-paypal-return.ts`, PaymentStep/PaymentOptionsPanel/checkout-page/place-order wiring, storefront features exposure of the paypal availability boolean)*
- `5c3b09503d` feat(payments): paypal verify branch + provider-aware launch requirement
- `9f681254dd` feat(dashboard): paypal connection card on payments settings (write-only)
- `a25c1ff316` feat(payments): paypal checkout routes on the vault (fee-waived, fail-closed FX, presentment anchoring, full-capture validation, capture-ok/DB-fail reconciliation → migration `20260708150000_paypal_capture_persist_reconciliation_issue.sql`)
- `460bbd661f` feat(db): direct-to-merchant settlement type — migration `20260708140644_byok_direct_settlements.sql` + test. **Design note: it added a NEW function `record_merchant_settlement_v2(... , p_settlement_type)` rather than overloading `record_merchant_settlement`** (avoids the PGRST203 ambiguity prior migrations fought); `'direct_to_merchant'` writes an informational `status='direct'` row with NO wallet credit and excluded from the settlement-notification cron. The PayPal capture route (`a25c1ff316`) is its caller.
- `deba1fcb9e` feat(payments): paypal client library (`lib/paypal/*` split — auth/orders/refunds/currency/endpoints/mode-guard/types, each tested)
- `<recovered>` feat(payments): merchant payment credentials API — **the credentials-api orphan, committed by hand.** Route enforces the authz boundary (auth → `settings:edit` → CSRF → rate limit → PayPal validate-on-save). Schema + schema-test committed.

**Gate I ran in place of the session-limited gate agent (all green):**
- `pnpm turbo lint --filter=@baci/web` → 1 successful, only the pre-existing `chunk-recovery-notice.tsx` warning (untouched by branch).
- `pnpm turbo typecheck --filter=@baci/web` → clean (56s, no stale cache).
- `pnpm exec vitest run` across `lib/paypal lib/payments lib/checkout lib/crypto app/api/payments app/api/merchant/payment-credentials schemas/merchant-payment-credentials.test.ts checkout/*` → **1424 tests / 115 files passed.**

**Wave 2 closure fixes from the adversarial review:**
- `resolvePaypalPresentment()` now rejects unsupported non-NGN currencies instead of forwarding them to PayPal; the storefront availability gate and server create-order boundary now agree.
- PayPal capture mode enforcement now rejects `unknown` response mode, not only positive sandbox/live mismatches.
- PayPal capture requests now send a stable `PayPal-Request-Id` (`capture-${paypal_order_id}`) for idempotency.
- `/api/payments/verify` now forces `p_platform_fee=0` for direct-to-merchant PayPal reconciliation, even if a stale/prototype transaction row contains a phantom fee.
- Generic merchant feature-settings responses/writes scrub legacy PayPal credential keys (`paypal_client_id`, `paypal_secret_key`, etc.) so prototype-era plaintext keys cannot leak through the settings API.
- The credentials API route was modularized below 300 lines and has colocated route/helper tests.

---

## 5. LAUNCH GATES (blockers before any of this can go live) — carry these forward

These are NOT code — they need human action / external steps. Track them:

1. **Vercel env `PAYMENT_CREDS_ENCRYPTION_KEY`** — base64 32-byte KEK, **distinct per environment** (prod/preview/dev). Set via `printf '%s' | vercel env add` (never echo). Vault decrypt fails closed without it. Registered in `env.ts` + `turbo.json` already; just needs the actual value set.
2. **PayPal CSP change to `proxy.ts`** — the PayPal JS SDK needs script/connect/frame CSP whitelist entries. `proxy.ts` is a **protected file requiring explicit user approval** — do NOT edit it in a workflow. The checkout-wiring agent was instructed to write the exact required diff into `docs/payments/paypal-csp-required-change.md` (a launch-gate doc) instead. The PayPal button cannot load in production until a human applies that diff. Reference commit in the prototype: `git -C /Users/mac/Baci-app/.worktrees/paypal-integration show d109422fd2`.
3. **`SUPPORTED_CURRENCIES` whitelist** (in the initialize route's Zod schema) only admits NGN/USD/GBP/EUR — **KES/GHS/ZAR coerce to NGN before gateway selection**, so each Lane-0 African market needs its currency added there before real merchants can transact. Deliberately fail-closed today.
4. **Migrations must be applied to the Supabase branch** (not run locally — the repo's convention; local baseline replay fails per project memory) **and TypeScript types regenerated** after apply. Three new migrations: `20260708093415`, `20260708140644`, `20260708150000` (last one untracked at handover). SQL permission tests in `supabase/tests/*.sql` are run against the applied branch via Supabase MCP `execute_sql` or `psql`, not locally.
5. **Lane-0 payout-corridor live tests** — Korapay (and/or Payaza) non-NGN payouts (KES/GHS/ZAR) have never been exercised in production; small real disbursements per corridor required before enabling each market (plan Phase 1.3). This is the "sitting on a merchant's money" failure mode — highest priority of the Lane-0 gates.

---

## 6. Accepted / deferred items (don't re-litigate; these were decided)

- **Vault RPCs do NO caller authorization** (they're `service_role`-only; `auth.uid()` is NULL there). Authorization lives ENTIRELY in the calling API route. The wrapper `lib/payments/merchant-credentials.ts` carries loud doc comments saying so. The `/api/merchant/payment-credentials` route IS the authorization boundary — it gates on `hasPermission('settings','edit')` + CSRF for writes, and its route tests now cover the boundary.
- **Korapay availability flipped opt-in→opt-out** (`=== false` gate) to match the DB default `korapay_enabled: true`. Intended, tested.
- **Error-code casing split**: forced-path guard uses lowercase `gateway_unavailable`; auto-select downstream guard uses uppercase `GATEWAY_UNAVAILABLE`. Each matches its layer's local convention. Normalize only if a client starts string-matching.
- **KE+NGN rejection surfaces a Paystack-flavored `GATEWAY_NOT_CONFIGURED`** (the NGN fallback chain terminates in paystack), not a Korapay-specific message. Fail-closed and correct; imperfect copy.
- **AI-keys BYOK doc** (`docs/ai/byok-gemini-keys-plan.md`) superseded — pending user decision (delete vs backlog).
- Flagged for a **separate** cleanup (outside this branch): `apps/web/src/lib/get-product-seo-link-inventory.ts` may have a silently-broken `supabase-js` `.rpc<T>()` generic misuse masked by stale tsbuildinfo (the recovery agent hit and avoided the same bug).

---

## 7. Working rules (project + this effort's conventions)

- **Model discipline (hard rule):** subagents NEVER use `fable`. `sonnet` for mechanical slices, `opus` for money-path / crux slices. (Project memory: `feedback_subagent_model_cost`.)
- Repo: pnpm + Turborepo, **Biome not ESLint**, TS strict (no `any`), colocated `.test.ts` for every source file (success AND error paths), max 300 lines/file, Zod schemas in `apps/web/src/schemas/`.
- **Never** edit `proxy.ts` (protected), never edit existing files in `supabase/migrations/` (append-only), never `git add -A` (agents commit explicit paths only — parallel agents share the worktree).
- Auto-format hook + a **Stop-hook quality gate** run on the main session; the Stop hook lints the whole worktree, so it false-positives on background agents' uncommitted in-flight files (a Wave-2 schema test tripped it — resolved with a scoped `biome check --write` on that one file). Don't panic-fix files a live agent owns; scoped-format or wait for its commit.
- Verify scoped, not full-suite: `pnpm turbo lint/typecheck --filter=@baci/web`, `pnpm exec vitest run <paths>`. Delete `apps/web/tsconfig.tsbuildinfo` before typecheck (stale cache masks errors). Known-flaky pre-existing test files to ignore: `ucp`, `feed-openai`, `imei-check`, `agent-native-commerce`.
- **Disk is tight: ~10Gi free / 98% used.** `df -h /Users/mac` before big operations; ENOSPC masquerades as unrelated test failures. `.worktrees/` is the usual disk hog.

---

## 8. What comes AFTER Wave 2 (roadmap, per the plan)

Wave 2 finishes the **PayPal lane** (plan Phase 2). Not yet started, in rough priority order:
1. **Lane 0 finish** (plan Phase 1): storefront sends real order currency (needs `codex/multi-country-currency` to land first — it's a separate in-flight branch normalizing country + order currency), add KES/GHS/ZAR to `SUPPORTED_CURRENCIES`, Korapay-vs-Payaza bake-off + live payout tests, M-Pesa (Korapay hosted checkout is the v1 path; native STK push is a v2 conversion upgrade needing async pending-order UX).
2. **Stripe `rk_` lane** (plan Phase 3) — restricted-key paste, per-merchant webhook endpoint + secret in the vault, `/api/payments/stripe/webhook` (fits the CSRF-exempt regex, no proxy.ts change).
3. **Expansion** (plan Phase 4, BD-gated) — Paystack Connect / Flutterwave / Razorpay-OAuth-for-India.

**Recommended PR strategy:** land the Wave-1 foundations as a self-contained PR first (zero user-visible behavior change beyond fail-closed gating), stack PayPal (Wave 2) on top. Get the user's go before pushing — nothing has been pushed.

---

## 9. Quick-start commands for the next agent

```bash
# Where the work is
cd /Users/mac/Baci-app/.worktrees/payment-byok
git log --oneline origin/main..HEAD      # 16 commits (Wave 1 + Wave 2, all committed)
git status --short                        # should be clean apart from this doc

# Read the plan + this doc
$EDITOR docs/payments/byok-payment-providers-plan.md
$EDITOR docs/payments/HANDOVER-byok-payments.md

# Verify current state (from apps/web)
cd apps/web && rm -f tsconfig.tsbuildinfo
pnpm turbo lint --filter=@baci/web && pnpm turbo typecheck --filter=@baci/web
pnpm exec vitest run src/lib/paypal src/lib/payments src/lib/checkout src/lib/crypto \
  src/app/api/payments src/app/api/merchant/payment-credentials

# Reference prototype (read-only)
git -C /Users/mac/Baci-app/.worktrees/paypal-integration log --oneline -6
```
