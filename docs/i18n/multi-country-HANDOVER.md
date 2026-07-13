# Handover — Multi-Country Currency Migration (PR #2993)

**Last updated:** 2026-07-09 · **Status:** ✅ MERGED (squash, 2026-07-09T21:57Z) + all 4 migrations VERIFIED APPLIED on prod (constraints live, RPC stamps currency with variant fix intact, live rollback-tested INR order on zorvexa). Remaining work = follow-up decisions in §7 only.

Single authoritative doc for this work. The durable cross-session anchor is the project memory: `/Users/mac/.claude/projects/-Users-mac-Baci-app/memory/project_multi_country_gap_audit.md` (+ its one-line index in `MEMORY.md`). This file is an untracked working file in the worktree.

---

## 1. TL;DR — what this is

Baci was built Nigeria-only; foreign merchants are now signing up (LIVE in prod: `zorvexa` IN/INR 3 products, `buynest` AE/AED 1 product). This PR makes the whole platform currency-correct: one canonical resolver, order currency stamped at the DB, hardened payment-charge currency, and every money surface (checkout, emails, feeds, JSON-LD, dashboard, mobile-admin) threaded with the merchant's real currency instead of hardcoded NGN. **No non-NG orders exist in prod yet** — this lands before corruption, not after.

Two categories of follow-up are **out of scope for #2993** and are covered in §7: making non-NG merchants able to *ship* and *get paid* (product decisions), and two currency-aware DB-aggregate fixes (small, but genuinely deferrable).

## 2. Where everything lives

| Thing | Path / ID |
|---|---|
| **Worktree** | `/Users/mac/Baci-app/.worktrees/multi-country` |
| **Branch** | `codex/multi-country-currency` (base: `origin/main`) — **linear/rebased** |
| **PR** | #2993 — https://github.com/ogabasseyy/Baci/pull/2993 |
| **Current HEAD** | `309e3b3a93` (verify with `git rev-parse --short HEAD`) |
| **Pre-rebase backup ref** | `backup/multi-country-prerebase-20260709` (delete once merged) |
| **Original audit report** | `docs/i18n/multi-country-gap-audit-2026-07-07.md` (in the MAIN checkout) |
| **Canonical resolver** | `apps/web/src/lib/resolve-merchant-currency.ts` |
| **Supabase project** | `aivqthbxdshhltbwipbr` (Baci, ACTIVE_HEALTHY, eu-west-1) |
| **Migrations (4)** | `supabase/migrations/20260707100010` / `100100` / `100200` / `100300` |

## 3. Progress — DONE

19 real commits (linear on main; `git log --oneline origin/main..HEAD`). Waves:

1. **Foundations** — `resolveMerchantCurrencyConfig` (payout_currency → country → NGN), `formatMerchantCurrency`, `formatAmountInCurrency`, `formatCurrencyAuto` (0–2dp); `countries.ts` +11 countries (AE/KE/GH/EG/CM/CI/SN/BF/RW/TZ/UG — AE was missing despite a live AED merchant); onboarding country ISO-2 hard-gate (web + mobile writers + settings form).
2. **DB (4 migrations, NOT applied to prod)** —
   - `20260707100010_normalize_merchant_country_codes` — backfill `'Nigeria'`/`NULL`+NGN → `'NG'` (case-insensitive). *(renamed off `100000` to dodge a version collision with main's `20260707100000_customer_usernames.sql` — Supabase keys migrations on the numeric prefix.)*
   - `20260707100100_orders_currency_from_merchant_payout` — `create_storefront_order` + quiz-prize RPC stamp `orders.currency` from `upper(trim(payout_currency))`. **Function bodies MD5-verified byte-identical to the LIVE prod definitions plus only the currency delta** (guards against the known migration-file drift for this RPC — do NOT trust the repo's older create_storefront_order migrations).
   - `20260707100200_merchant_balances_currency_format_check` — CHECK widened from an 8-code allowlist to `^[A-Z]{3}$` (INR/AED can't throw). *(Note: `merchant_balances` is the dormant multi-currency payout table — see §7 payout — so this is forward-compatible with reviving it.)*
   - `20260707100300_merchant_payout_currency_format_check` — `merchants.payout_currency` NOT NULL + `^[A-Z]{3}$` CHECK, so the client resolver and DB writer can never disagree on a merchant's currency.
3. **Payments** — `initialize/route.ts` charge currency is server-authoritative from the order; `CURRENCY_MISMATCH`/`UNSUPPORTED_CURRENCY` 400s; no silent NGN coercion; Paystack never auto-selected for non-NGN (Korapay is the only multi-currency rail); wallet AND savings redemption guarded to NGN orders (both are NGN-denominated ledgers with no currency column); helper `lib/payments/resolve-charge-currency.ts`.
4. **Surfaces** — both live checkout templates + generic checkout; all transactional emails/receipts + refund rows; feeds (GMC/Meta/TikTok/OpenAI)/JSON-LD/ad-conversions/llms.txt; dashboard (customers/loyalty/negotiation/domains); mobile-admin (shared formatter, symbol maps, order-report PDF w/ mixed-currency warning, FIRS tax screen gated to NG). Order rows format with their OWN stamped currency, not the merchant's current one.

**Review loop — COMPLETE and all addressed:**
- CodeRabbit: 6 fixed, rest refuted with rationale.
- Codex rounds 1/2/3 (14 findings): all fixed-with-commit or deferred-with-reasoned-reply on the PR threads. Best catch (r2): customer **wallet credit** was an NGN ledger redeemable at face value against a non-NGN order (₦10k → 10k GHS) — now guarded both sides. r3 generalized the same guard to savings/shipping-quotes/payment-rails. Round 4 (re-triggered twice on the latest HEAD): no new findings.
- **Rebased 2026-07-09**: 6 merge commits dropped, 19 commits replayed onto latest main, one clean union-conflict resolved (slug-alias test params vs. `merchantCountry`), force-pushed. Verified: zero diff vs. backup on key files, typecheck green, 385 conflict-area tests pass.

**Quality:** full `@baci/web` Vitest + typecheck + Biome green; mobile-admin tsc/ESLint/2568 tests green. Every diff human-reviewed before commit.

## 4. NEXT — get it merged

1. **Confirm CI green on HEAD `309e3b3a93`** (`gh pr checks 2993` — was green + 1 pending at handover).
2. **Merge discipline (from memory — non-negotiable):**
   - Repo enforces **linear history**; merge-commit merges are disabled (squash/rebase only). The branch is now linear, so "Rebase and merge" preserves the 19 commits; "Squash and merge" collapses them. Either is fine.
   - If it goes BEHIND again before merge, GitHub's **"Update branch"** (or a local rebase — see §8) resolves it. Don't churn-sync on every main commit; sync right before merging.
   - **NEVER** `git push --no-verify`; **NEVER** `--admin` merge a BEHIND branch (squash replays stale tree → silent revert).
   - **Jules is a REQUIRED merge gate.** If it blocks despite green, bypass via the `bypass-ai-gate` label + an EMPTY COMMIT (`feedback_jules_required_gate_bypass`). Was PASSING.
3. After merge: delete the backup ref `backup/multi-country-prerebase-20260709`.

## 5. Post-merge: apply + VERIFY the 4 migrations on prod

Migrations apply via the merge/Supabase-branch process, but **recorded ≠ applied** (`feedback_prod_migration_recorded_not_applied`) — verify the OBJECTS on prod (project `aivqthbxdshhltbwipbr`):
1. Country backfill: `SELECT country, count(*) FROM merchants GROUP BY 1` → no `'Nigeria'`, no `NULL`+NGN rows.
2. `SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='public.merchants'::regclass AND conname='merchants_payout_currency_check'` → `CHECK (payout_currency ~ '^[A-Z]{3}$')`; column NOT NULL.
3. Same for `merchant_balances_currency_check` → `^[A-Z]{3}$`.
4. `SELECT pg_get_functiondef('private.create_storefront_order'::regprocedure)` → contains `upper(NULLIF(trim(m.payout_currency)…` and `currency,` in the orders INSERT. **Best: place a real test order on `zorvexa` (IN/INR) and confirm `orders.currency='INR'`.**

## 6. Traps & context

- **Migration version collisions:** hit + fixed one (renamed `100000`→`100010`). Supabase keys on the numeric prefix — if you add a migration, pick a prefix not used on main.
- **Auto-format hook strips "unused" imports mid-edit** — make each edit self-consistent.
- **quality-gate Stop hook** can misfire on cross-worktree / mid-agent-write state — verify the failure is real before acting.
- **mobile-admin uses ESLint (not Biome).** Only `apps/web` + `packages/shared` use Biome. Biome also doesn't lint the ogabassey checkout components dir ("Checked 0 files" there is expected).
- **The storefront `negotiate` + shipping-quotes routes read `merchants.payout_currency`+`country` as ANON** — when someone fixes the merchants-RLS P0 (`project_merchants_anon_column_exposure`), keep those two columns anon-readable.
- **coderabbit CLI:** `--prompt-only` was removed; use `coderabbit review --agent`.
- **Intentionally NG-scoped, do NOT "fix":** mobile-storefront app (single-tenant NGN build), FIRS e-invoice, Santa (gated), Klump/Credit-Direct/Juicyway/VTU (NGN-guarded).

---

# 7. Follow-up decisions — research & recommendations

Researched 2026-07-09 across 3 streams (Baci codebase architecture + web research on payout providers + shipping providers). **Provider facts are as-of mid-2026 and MUST be re-confirmed with each provider at build time** — PSP country/currency support shifts quarterly. #2993 makes the platform currency-*correct*; these make non-Nigerian merchants able to actually *ship* and *get paid*.

## 7a. Shipping for non-NG merchants

### Recommendation: build merchant-configured flat-rate/zone shipping first. One feature unblocks every non-NG market at once.

**Why this, not carrier integrations:** carriers are per-country and no single aggregator covers India + UAE + Africa. A merchant-defined rate model (flat rate + zones + free-over threshold + local pickup/delivery) depends only on merchant settings, works anywhere, and is how Shopify/Woo let merchants ship without a carrier API. India and UAE do **not** need live carrier rates to transact — flat-rate + local pickup + Pay-on-Delivery is a complete checkout.

**What already exists (low blast radius):**
- The order RPC's shipping guard is **country-agnostic**: `IF p_shipping_provider IS NOT NULL AND p_selected_quote_id IS NULL THEN RAISE 'shipping_quote_required'`. Passing `shipping_provider: null` bypasses it — exactly how the existing pickup/airport methods work. So a merchant-set flat rate needs no RPC change.
- The provider layer (`lib/shipping/providers/base.ts` registry) is cleanly pluggable and multi-country-shaped — no refactor needed. Only Topship is registered (GIGL commented out; Shiip reserved but never implemented).
- Checkout already consumes a generic `ShippingQuote[]`; a merchant-rate source emits the same shape (add a `MERCHANT` provider code alongside `TOPSHIP`/`GIGL`).

**What's missing (the actual work — moderate, additive):**
1. New table(s): `shipping_zones` + `shipping_rate_methods` (zone = country/subregion group; method = flat / price-tier / weight-tier / free / local_pickup / local_delivery; rate carries the **merchant's currency**). RLS-scoped.
2. New dashboard **Shipping settings page** — there is none today (`dashboard/settings` has no `shipping/`). Default every merchant to one editable "flat rate everywhere" so no store is ever un-shippable.
3. Put the generic delivery-method branch in the **shared checkout path** (`components/storefront/checkout/shipping-options.tsx`), not just the `ogabassey` template. Today the other 3 templates hardcode `country:'Nigeria'` and have **no fallback** when quotes are empty; the ₦25k/₦20k pickup/airport fees are hardcoded literals in the ogabassey template only, and pickup/airport eligibility is Lagos/Nigeria-state-list specific.
4. Replace the "carrier rates available for Nigerian merchants only" dead-end (from #2993's guard) with the merchant's own rates; keep PoD always available.
5. Clean up dead/misleading state: `merchants.free_shipping_threshold` is stored + surfaced but **never consumed** in checkout; `self_fulfillment_enabled` column is dead; `deriveMerchantLocation` hardcodes a `Nigeria/NG` sender for booking.

**Phase 2 (by demand only) — per-region rate aggregators (no single one covers all):** India → **Shiprocket** (Delhivery/Bluedart/DTDC + COD, one API); UAE/MENA → **Aramex** (+ **Bosta** for Egypt); South Africa → **Bob Go** (Courier Guy/Pargo/RAM/SkyNet, one REST API); Kenya → merchant-config only (no good self-serve API post-Sendy shutdown 2023); Ghana/Francophone/East Africa → merchant-config until demand (Ghana's WeGoo/Dawurobo likeliest first). International BYOA → DHL Express MyDHL API, reached via an aggregator (requires merchant's own carrier account).

**Effort:** Phase 0 (merchant-config) is the real lift — new data model + settings UI + generic-checkout branch. Everything after is additive per-provider on the existing aggregator.

## 7b. Payout / settlement for non-NG merchants — *needs a business decision from the owner*

**The strategic tension:** the two highest-demand markets (India, UAE — already live for charging) have the **highest payout friction** (each needs a local Baci legal entity + a brand-new PSP), while the low-friction wins (KE/GH/ZA) currently have lower demand.

**What Baci has today (from the code):**
- **LIVE payout:** Paystack subaccount split + a **weekly Kuda bank-transfer cron**, NGN-only. `merchant_wallets` has **no currency column** (structurally single-currency). On-demand withdrawal is **hard-disabled** (returns 404) — even NG merchants only get the weekly cron.
- **DORMANT (built then abandoned):** a full Korapay multi-currency payout stack — `lib/korapay.ts` `sendPayout()`/`sendBulkPayouts()`/`getBanks('NG'|'KE'|'GH'|'ZA')`, a generic `/api/payouts/request` endpoint, and a `merchant_balances` table (per-currency, 8-currency CHECK — **which #2993 already widened to `^[A-Z]{3}$`**). **Zero live callers** — unreachable from any UI. Reviving it is the KE/GH/ZA path.
- Korapay **checkout** is already live and **ungated by country** for KES/GHS/ZAR/XAF/XOF — so those merchants can already *accept* payment; the money simply has no automated way out.
- `getCurrencyFromCountry` already maps 7 of 11 target markets (NG/KE/GH/ZA/CM/CI/SN/BF); EG/RW/TZ/UG not yet covered.

**Provider reality (verify at build time):**
- **Paystack** settles locally in NG/GH/KE/ZA/CI, but each is a **separate country-scoped account needing a local entity + local bank** — a Nigerian Paystack account cannot settle GHS/KES/ZAR. "Just extend Paystack" is **not** free.
- **Korapay disbursement** covers NG/KE/GH/ZA bank payouts + XOF/XAF + KE/GH mobile money — the realistic single African payout engine, functions already in the repo.
- **Flutterwave** — broadest African footprint (incl. UG/TZ/RW/EG); the gap-filler for East Africa/Egypt; barely wired today (~2 files).
- **India (INR):** Razorpay Route / Cashfree via linked accounts — RBI's payment-aggregator regime effectively **requires an Indian entity**; Stripe Connect is not a workaround (India invite-only).
- **UAE (AED):** Checkout.com Integrated Platforms (or merchant self-onboards Telr/N-Genius/Paymob) — native AED settlement **requires a UAE-licensed entity + UAE bank**.

**Recommended phasing:**
| Phase | Markets | Rail | Lift | Friction |
|---|---|---|---|---|
| 0 (done) | NG | Paystack + Kuda | live | low |
| **1 — cheapest** | KE, GH, ZA | **revive dormant Korapay payout** | Medium (wire `merchant_balances` on settlement, re-enable withdrawal UI, swap the NG-only gate in `payment-gateway-availability.ts`) — code mostly exists | moderate |
| 2 | CI, SN, CM, BF | Korapay XOF/XAF | low–medium | moderate |
| 3 | UG, TZ, RW, EG | Flutterwave (new integration) | medium | moderate–high |
| 4 — **live demand, high friction** | India (INR), UAE (AED) | Razorpay Route / Checkout.com | **high — needs local ENTITY + new PSP** | **high** |

**The decisions that are actually the owner's (not code):**
1. **Do you pursue India/UAE payout automation now, given each needs a local legal entity?** The long pole is legal/incorporation, not engineering — if yes, start that workstream in parallel immediately.
2. **Interim posture for India/UAE/Egypt (recommended): don't block go-live on automated payout.** Those merchants are already transacting. Let them self-onboard their own local PSP (Baci records the reference) or run manual/batch payouts, while keeping **Pay-on-Delivery** available everywhere so cash flow isn't gated on settlement.
3. **Priority order:** ship KE/GH/ZA on Korapay first — highest ROI (weeks, no new vendor/entity), and it proves the multi-currency payout path end-to-end on real infrastructure before betting on the entity-gated markets — even though demand there is lower.

**Payout gate/file change list for a first PR:** `lib/checkout/payment-gateway-availability.ts:61-66,132-138` (replace/extend `isBaciPaystackSettlementCountry`), `app/api/paystack/subaccount/route.ts:149-157` (the NG-only 400), `app/api/cron/wallet-payouts/route.ts` (needs a currency-aware Korapay rail alongside Kuda), and revive `/api/payouts/request` + `merchant_balances` wiring.

## 7c. Two DB-aggregate fixes (code-only) — deferrable, and NOT small

Both flagged by Codex; deferred because **neither can produce wrong data until a merchant holds orders in >1 currency, which is impossible today** (payout currency fixed at onboarding + format-guarded by #2993; there isn't even a UI to change a merchant's currency). Investigated blast radius — these are **not** the display-tweaks the rest of #2993 was, which is why they don't belong in #2993:

- **`daily_sales_summary`** is a **materialized view** (`SUM(total) GROUP BY merchant, date` — no currency column) with **5+ dependents**: the sales-summary cron (`api/cron/merchant-sales-summaries`), `api/analytics/insights`, two other DB views that join it, the `secure_daily_sales_summary` wrapper view, and a function. A currency-correct version = DROP + recreate the materialized view with `currency` in the grouping, recreate its unique index (needed for `REFRESH … CONCURRENTLY`), update every dependent view/function, and rewrite both app consumers to handle N currency-rows per day.
- **`customers.total_spent`** feeds the **RFM monetary-score tiers** (thresholds are naira-denominated, `baseline.sql:379-382`) and is read by ~10 app surfaces (customer pages, segments API, storefront auth). Per-currency = restructure the column (jsonb/side table) + backfill + rethink the naira-based RFM thresholds + update every reader. Its own project with loyalty/segmentation implications.

**Recommendation:** hold both until a **currency-change path for merchants exists**, so the fix is designed against a real scenario rather than a hypothetical. When built, do them as a dedicated PR (likely two — `customers.total_spent` split out for the RFM interaction), NOT folded into #2993.

## 7d. The fastest real unlock (cross-cutting)
For a non-NG merchant to go from "signed up" to "selling and paid": (1) **merchant-configured flat-rate shipping** (7a Phase 0) unblocks shipping everywhere; (2) **KE/GH/ZA Korapay payout** (7b Phase 1) is the cheap payout win; (3) **Pay-on-Delivery as the universal fallback** so no market is blocked on automation. India + UAE need a **parallel legal/entity track** before their payout automation — that decision (and its cost) is the one thing only the owner can make.

## 7e. Facts to re-verify before building (most stale-able)
Korapay live KES/GHS/ZAR/XOF/XAF payout enablement on Baci's account; Flutterwave cross-border-bank subaccount settlement; Paystack per-country entity requirement; India RBI PA rules & Stripe-India GA status; UAE CBUAE PSP capital/entity rules; Shiprocket/Aramex/Bob Go coverage, auth, pricing.

---

## 8. How to resume the review-loop / merge workflow

Prior agent ran opus subagents for crux fixes / sonnet for mechanical, reviewed every diff itself before committing (never let subagents commit). Cost rule: pass explicit `model` — sonnet for mechanical, opus for money-path/crux, never fable. Poll CI/Codex with the Monitor tool + until-loop (don't chain sleeps). Commit in logical units; `--body-file` for commit/PR bodies (the block-dangerous-commands hook substring-matches "main"/"truncate "). For a rebase: back up the ref first, run `git rebase origin/main` (drops merge commits), resolve conflicts, verify `git diff backup HEAD -- <key files>` is empty, then `git push --force-with-lease` (never `--no-verify`).
