# BYOK — Merchants' Own Payment Providers for Storefront Checkout: Decision & Implementation Plan

**Status:** DRAFT — awaiting review
**Date:** 2026-07-08
**Goal:** Let merchants connect their own payment provider accounts so storefront checkouts charge customers through the merchant's account and settle directly to the merchant — unlocking online payments for merchants outside Nigeria (who currently have none) and reducing Baci's merchant-of-record exposure.

---

## 0. TL;DR — Recommended decisions

| Decision | Recommendation |
|---|---|
| Is there a universal "connect any provider" mechanism? | **No — no OpenID-equivalent exists for payments.** Every provider is its own integration. The plan mitigates this with a shared **provider-adapter interface** (one bounded module per provider: init / verify / refund / webhook-verify) on shared scaffolding (vault, settings UI, availability matrix, webhook routing) — so each new provider is days, not a re-architecture. Orchestrators (Hyperswitch etc.) were evaluated as the "universal" shortcut — see §3.1 for why not now. |
| Lanes & order | **Lane 0 (quick win): properly gate + finish the African currencies Baci's own Korapay account already supports** (KES/GHS/ZAR/XAF/XOF) — platform rails, keeps the 2%, no BYOK needed for those markets. Lane 1: PayPal key-paste (your prototype, hardened). Lane 2: Stripe **restricted-key (`rk_`) paste** — Baci has no Stripe account, and Connect requires one in a Stripe-native country (means incorporating a US/UK entity — deferred as a future option). Lane 3: Paystack Connect / Flutterwave (BD-gated), Razorpay OAuth for India when demand exists. |
| Gate to outside-Nigeria? | Availability is computed per merchant as **provider × merchant country × order currency** — no blanket NG/non-NG gate. NG merchants keep the working platform rails (Paystack subaccount split + 2% fee). |
| Platform fee under BYOK | **Waive it (0%)** on BYOK lanes — money settles directly to the merchant, Baci bears no MoR risk there, and without a Stripe platform account there's no automatic fee primitive anyway. Record `byok_fee_accruals` rows (`fee=0, waived=true`) from day one for optionality + "you saved ₦X" marketing. **Keep the 2% on platform rails** (Paystack subaccounts, Korapay incl. Lane 0) where Baci provides the rails and eats the risk. |
| Key custody | Where unavoidable (PayPal creds, Stripe `rk_` — explicitly Stripe-compliant, unlike `sk_`; later Flutterwave). Prefer provider-sanctioned delegation when offered (Razorpay OAuth, future Stripe Connect). |
| Secret storage | `private.merchant_payment_credentials` + SECURITY DEFINER RPCs + app-layer AES-256-GCM (per-environment KEK in Vercel env). The PayPal prototype's plaintext `custom_settings` storage must migrate before launch. |
| Liability shift | BYOK makes the **merchant** the merchant of record: they own disputes, chargebacks, refunds, and gateway KYC. Baci's new liability is **secret custody** (the Dukaan breach — leaked merchant Stripe/PayPal/Razorpay tokens for 2 years — is the cautionary tale). |

## 1. Current state (from full codebase audit)

### 1.1 How money flows today

- All storefront payments run on **Baci's own gateway accounts** via module-level env keys evaluated at import time: `lib/paystack.ts:21`, `lib/korapay.ts:22-23`, `lib/juicyway/client.ts:13-14`, plus a **second independent Paystack client** in `lib/agentic/paystack.ts:1` (order DVAs).
- Two settlement models already coexist:
  - **Paystack (NG only)**: charge-time split — `subaccount: merchant.paystack_subaccount_code, transaction_charge: platformFee, bearer: 'account'` ([initialize/route.ts:748-833](apps/web/src/app/api/payments/initialize/route.ts)). The subaccount is a bank-settlement reference **under Baci's own Paystack account**, not a merchant-owned account. Paystack settles the merchant share directly to their NG bank T+1.
  - **Korapay/Juicyway**: collect-then-payout — funds land in Baci's account; merchants are credited in `merchant_wallets` (`record_merchant_settlement` RPC) and paid out via payout requests/crons.
- The 2% fee (cap ₦2,050) is computed in duplicated helpers (`paystack.ts:1226-1241`, `korapay.ts:615-630`) and recorded via `create_payment_transaction` (ledger write only).
- **Non-NG merchants have no working checkout**: Paystack is hard-gated to NG (`isBaciPaystackSettlementCountry`); Korapay is nominally enabled worldwide but the storefront **hardcodes `currency: 'NGN'`** in every initialize call (`place-order.ts:707`, `checkout-page.tsx:418,480,2004,3515`), and `merchants.payout_currency` is never read in the payment path. They get Pay-on-Delivery only.

### 1.2 The PayPal prototype (`.worktrees/paypal-integration`, 5 unmerged commits)

Already implements the target UX: merchant pastes PayPal client ID + secret + sandbox/live mode in Settings → Payments; storefront renders a PayPal button (JS SDK v6); `create-order`/`capture-order`/`client-token` routes charge the merchant's own PayPal account; masked-on-read secret UI (`••••` sentinel preserved on save). Gaps before it can ship:

1. Credentials stored **plaintext in `merchant_feature_settings.custom_settings`** — readable via PostgREST by any active staff session (same class as the live `merchants`-table P0 and the plaintext `marketplace_integrations` tokens).
2. No webhook/dispute/refund story (synchronous capture only), no handling for partial/multiple captures (`captures[0]` only), and no reconciliation path when the PayPal capture succeeds but the DB update fails (money captured, order stuck pending).
3. Branch is ~6 weeks behind main; it also touched `proxy.ts` (CSP whitelisting for PayPal domains) — a protected file needing explicit approval on re-review.
4. **Fee/ledger bug (inverted from what you'd expect)**: create-order records a **phantom 2% platform fee** on the transaction and capture-order calls `record_merchant_settlement` with it — booking a fee Baci never collected and a settlement obligation for money that went straight to the merchant's PayPal (`process_due_settlements` would later mark it "settled" and email the merchant). Must be zeroed/forked, not left as-is.
5. **FX conversion is unsafe**: NGN orders are converted to USD via `getNgnPerUsdt()` with a **silent hardcoded `fxRate = 1300` fallback** on fetch failure — customers can be charged at an arbitrary stale rate, and the NGN ledger diverges from the merchant's USD receipt.
6. What it does right (keep): amounts computed server-side from `get_order_payment_snapshot` (never client-supplied), capture anchored to the stored **presentment** amount/currency, colocated tests on all three routes + `lib/paypal.ts`, parameterized credentials in the lib.

### 1.3 The webhook problem (highest-risk change)

Every payment webhook today verifies HMAC against **one global env secret before knowing which merchant the event belongs to** (`webhook/route.ts:292-396`), then resolves merchant via `transactions.gateway_reference` (an opaque `BAC-<nanoid>` with no merchant scoping). Per-merchant accounts invert this: the route must know **whose** secret to verify against before trusting the payload. The only attacker-non-forgeable pre-verification signal is the request URL (set at webhook-registration time). Precedent: `/api/shipping/webhooks/[provider]` is the repo's only path-scoped webhook.

Also relevant: `proxy.ts:1516-1521` CSRF-exempts webhooks via the regex `/^\/api\/payments\/[^/]+\/webhook$/` — new routes should fit that shape (e.g. `/api/payments/stripe/webhook` ✅) to avoid touching proxy.ts.

### 1.4 Other coupling points

- **Refunds** only exist for Paystack and always use **Baci's platform key** (`orders/[id]/cancelled/route.ts:114-209`) — wrong account under BYOK; needs branching by financing credential.
- **KYC** is keyed on country, not on who holds the money (`requiresNigerianKycForLaunch`): non-NG merchants already skip it (good — BYOK target segment), NG BYOK merchants would still hit it (acceptable; NG stays on platform rails anyway).
- **Onboarding readiness** pushes non-NG merchants to POD; needs a "connect a payment provider" path.
- Settings UI (`dashboard/settings/payments/page.tsx`) + mobile-admin (`payment-methods.tsx`, `payout-settings.tsx`) + both storefront checkout method selectors (web `PaymentOptionsPanel.tsx`, mobile-storefront `payment-method-selector/`) are the UI surfaces.
- **Sequencing dependency**: `codex/multi-country-currency` (in flight) normalizes merchant country + stamps order currency from `payout_currency` — this plan builds on it landing.

## 2. External facts that shape the design (adversarially verified, July 2026)

1. **Stripe:** collecting merchants' raw `sk_` secret keys is **against Stripe policy** (merchant deadline Oct 29 2024; non-compliance fee from ~June 2025). Two compliant paths exist: **restricted `rk_` keys** (a merchant-pasted key flow **is** allowed — validate the `rk_` prefix, reject `sk_`) or **Connect OAuth**. Connect would be strictly nicer (no custody, one platform webhook, `application_fee_amount` fee primitive) **but requires Baci to own a Stripe platform account, and Stripe has no native African markets** — a Nigerian-domiciled Baci can't open one without incorporating a US/UK entity. Since Baci has no Stripe account and the BYOK fee is waived anyway (no need for the fee primitive), the plan uses the **`rk_` restricted-key lane**, with Connect documented as the future upgrade if a foreign entity ever exists.
2. **Stripe has zero native African markets** — NG/GH/KE/ZA/CI are "Extended network" → routed to Paystack. Stripe lane = non-African merchants only (US, GB, CA, AU, DE, FR, JP from the 11-country onboarding list; IN/BR have Stripe caveats worth checking at build time).
3. **Paystack:** raw key custody is technically possible but contravenes its security guidance, and the **webhook URL is dashboard-only with exactly one live slot per account** — raw BYOK forces merchants to hand-paste Baci's URL and burn their only slot. Sanctioned shapes: the **subaccount/split model Baci already runs** (keyless for the merchant; extendable to Paystack's other markets **only if Baci opens in-country Paystack accounts** — GH/ZA/KE/CI, currencies incl. XOF; Egypt/Rwanda in beta), or **Paystack Connect** (real sub-merchant accounts, `X-Connect-Account` header, native cross-account `platform_share` fee — but docs live on a pilot host; availability must be confirmed with Paystack directly).
4. **Flutterwave:** widest African reach (~34 countries incl. UG/TZ/RW/MW). No delegated OAuth — merchant-own-account means Baci custodies `client_id`/`client_secret` + webhook secret hash. It also offers a credential-free platform-owned subaccount/split model (7.5% VAT applies on split fees). Defer to Phase 3.
5. **PayPal:** the industry-standard "external provider" in Shopify's model; merchant-owns-account, key-paste connection. (PayPal's multiparty/Commerce Platform exists but is enterprise-gated; key-paste is the pragmatic v1 your prototype already implements.)
6. **Fee collection when the platform never touches money:** Stripe = `application_fee_amount` (absolute integer — Baci still computes the 2%; original processing fees are never returned on refunds; pass `refund_application_fee` deliberately). Providers with no primitive (PayPal) = Shopify's model: **accrue to a ledger, bill out-of-band** — unsecured revenue requiring a mandate/subscription, which Baci doesn't have yet → 0% at launch, ledger from day one.
7. **PCI-DSS v4.0.1:** holding gateway secret keys does **not** pull card data into scope (card fields stay gateway-hosted → SAQ A territory), but it makes Baci a **service provider/TPSP** and a high-value target (Dukaan leaked merchant Stripe/PayPal/Razorpay tokens, undetected ~2 years). Separately — and **independent of BYOK** — because Baci serves checkout pages embedding gateway iframes/SDKs, requirements **6.4.3 + 11.6.1** (payment-page script inventory/integrity/tamper detection) already apply since Mar 31 2025. Flag as its own workstream.
8. **OSS precedent:** Medusa marketplaces use Stripe Connect rather than per-vendor keys; Saleor isolates credentials in external payment apps. Raw per-merchant keys in the main DB is the less-common, higher-liability path — hence: OAuth where possible, hardened custody only where unavoidable.

## 3. The lanes

| | Lane 0: African currencies on platform rails | Lane 1: PayPal (key-paste) | Lane 2: Stripe restricted-key (`rk_`) paste | Lane 3: Africa/India expansion |
|---|---|---|---|---|
| Who | KE/GH/ZA + XAF/XOF markets — currencies **Baci's own Korapay account already supports** | Non-African intl. merchants + anyone with a PayPal business account | Merchants in Stripe-native countries (US/GB/CA/AU/DE/FR/JP…) | GH/ZA/KE/CI (Paystack Connect), wider Africa (Flutterwave), India (Razorpay OAuth) |
| Connection | None — platform rails, properly country/currency-gated | Paste client ID + secret (prototype exists) | Paste an `rk_` restricted key (reject `sk_`); Baci registers a webhook endpoint on the merchant's account via API | Provider-sanctioned models; BD-gated |
| Custody | None | Yes — encrypted vault | Yes — encrypted vault (`rk_` is scoped + revocable) | Razorpay OAuth = token, not keys |
| Baci fee | **2% kept** (Baci is MoR, collect-then-payout) | 0% (waived) + accrual ledger | 0% (waived) + accrual ledger | Native split primitives where platform-railed |
| Disputes/KYC | Baci (as today) | Merchant | Merchant | Depends on path |
| Webhooks | Existing platform webhook | Not needed v1 (synchronous capture) | Per-merchant endpoint secret in vault → URL-token webhook route | Per provider |
| Timing | **Phase 1 (quick win)** | Phase 2 | Phase 3 | Phase 4 (BD conversations) |

**Future upgrade path:** if Baci ever incorporates a US/UK entity, Stripe **Connect Standard** replaces the `rk_` lane — OAuth (no custody), one platform webhook, and `application_fee_amount` gives back a fee lever. Documented, not scheduled.

### 3.1 Why not a universal connector / orchestrator (evaluated July 2026)

There is **no open standard** for gateway integration (W3C Payment Request standardizes browser UX, not gateway APIs; ISO 20022 is bank messaging). The industry's answers:

- **Payment orchestrators** abstract N providers behind one API + one normalized webhook. **Hyperswitch** (Juspay, Apache-2.0, self-hostable, free) is the credible one for us: true multi-tenant per-merchant connector credentials (platform can transact on a sub-merchant's profile without reading their creds) and "Universal Webhooks". **Why not now:** (a) its connector matrix is weakest exactly in our core markets — **no Flutterwave, no Cashfree, and only a narrow EFT-style Paystack connector** (verified in source, July 2026) — we'd be writing Rust connectors, which defeats the purpose; (b) self-hosting is a real always-on Rust+Postgres+Redis service — doesn't fit Vercel serverless, new ops burden; (c) it becomes a third party in the money path. Commercial orchestrators (Spreedly ~$2k+/mo, Primer 0.2–0.6%/txn, Corefy $250k/mo floor, Gr4vy per-merchant instances, IXOPAY 12-mo contracts) are priced for one big merchant with many PSPs, not thousands of small merchants with one PSP each — and none carry Paystack/Flutterwave directly. **Revisit Hyperswitch if its African/Indian connectors mature.**
- **Shopify's actual answer** was to invert the burden: a Payments Apps platform where *gateways* build and maintain the integration (approved partners, revenue share, 50+ stores/$1M+ processed to be listed). Only viable at ecosystem scale — not replicable by Baci today.
- **Our answer: a `PaymentProviderAdapter` interface** — each provider is one bounded module implementing `initializeCheckout / verifyPayment / refund / verifyWebhook / validateCredentials`, registered in the availability matrix (provider × country × currency). The vault, settings UI, forced-gateway guard, verify route branching, and webhook-token routing are shared. Per-provider cost after the first two lanes ≈ days. So "build for each country" is really "one adapter per *provider*", and a handful of providers cover most of the world: PayPal (~200 countries) + Stripe `rk_` (~45 countries) + Paystack/Flutterwave (Africa) + Razorpay (India).
- **India example** (asked explicitly): the right connect there is **Razorpay's OAuth partner model** — the merchant authorizes Baci with a scoped, revocable token; no key custody at all. Stripe India has been invite-only since May 2024; PayPal India is export/cross-border-only (~4.4% + GST). India also carries RBI constraints (PA-CB licensing for cross-border collection, 2018 payment-data localization) that make "Baci in the fund flow" legally heavy — Razorpay-as-licensed-PA holding funds and data is the safe posture. Build when Indian merchant demand exists.

### 3.2 Which methods does a customer see? (merchant country gates rails; customer geo only ranks them)

Three countries are in play and control different things: the **merchant's country** determines which rails exist on the store (settlement reality — where money can land); the **customer's country** determines which instruments they can physically use; the **order currency** is the merchant's (`payout_currency`). The checkout rule:

```
methods shown = rails(merchant.country, order.currency)   ← hard gate (the availability matrix)
ordered by      customer geo (x-vercel-ip-country)         ← soft signal: rank/feature only, never hide
```

- A method appears only if it can accept the customer's instrument AND settle to the merchant. Local methods (M-Pesa, NGN bank transfer/USSD) therefore appear exactly when merchant market = customer market. **Cross-border customers are served by cross-border instruments — international card + PayPal** — not by stitching local rails across currencies.
- Worked example: **Nigerian merchant, Kenyan customer** → do NOT show Kora-KES/M-Pesa (KES collections cannot reach the merchant's NGN settlement unless Baci runs FX — licensing + spread risk; not our business). Show international card (customer's bank does the FX) + PayPal if connected. **Kenyan merchant, Kenyan customer** → M-Pesa (Lane 0).
- Customer geo signal: `x-vercel-ip-country` is already consumed in `lib/geo-privacy.ts` — reuse it to order/feature methods (foreign IP on a NG store → card/PayPal first). Geo-IP mis-detects (VPNs, travel), so it must never remove a method from the merchant's matrix.
- **True cross-currency presentment** ("Kenyan pays M-Pesa in KES, Nigerian merchant receives NGN") is a provider feature, not a Baci feature: Flutterwave natively collects in ~150 presentment currencies and settles converted into the merchant's currency. If checkout analytics show real cross-border local-method demand, that is the concrete trigger for the Phase 4 Flutterwave lane. Out of scope until then.

## 4. Implementation plan

### Phase 0 — Foundations (prerequisites)

1. **Land `codex/multi-country-currency`** (order currency from `payout_currency`, ISO-2 country normalization), then fix the storefront checkout to stop hardcoding `currency: 'NGN'` (send merchant currency; keep the Zod default as NGN fallback for legacy).
2. **Credential vault** (shared foundation; mirrors the proven quiz-secret pattern):
   - Migration: `private.merchant_payment_credentials` — `id, merchant_id FK, provider check ('paypal','stripe','flutterwave','paystack',...), credential_role check ('client_id','secret_key','webhook_secret','connect_account_id','public_key'), environment check ('test','live'), ciphertext, iv, auth_tag, kek_version, is_active, last_validated_at, last_validation_error, disabled_at, disabled_reason, created_at, updated_at`, `UNIQUE(merchant_id, provider, credential_role, environment)`; `REVOKE ALL` from PUBLIC/anon/authenticated at schema+table level; RLS on as belt-and-braces.
   - **Access only via `public.*` SECURITY DEFINER RPCs** (supabase-js — even the admin client — cannot `.from()` a non-exposed schema): `set_merchant_payment_credential` (re-checks `check_staff_permission(auth.uid(), merchant_id, 'settings','edit')` internally), `get_merchant_payment_credential_ciphertext` (EXECUTE granted to service_role only), `get_merchant_payment_public_config` (public-safe: returns only `client_id`/`public_key`/`connect_account_id` roles), `mark_merchant_payment_credential_invalid`, `delete_merchant_payment_credential`. All `SET search_path = ''`.
   - Crypto: `apps/web/src/lib/crypto/secret-box.ts` — AES-256-GCM via `node:crypto`, random 96-bit IV, KEK from new env `PAYMENT_CREDS_ENCRYPTION_KEY` (base64 32 bytes, **distinct per environment**), `kek_version` for rotation (dual-key read window). Add to `env.ts` Zod schema + `turbo.json` `tasks.build.env` + Vercel envs (`printf '%s' | vercel env add`).
   - Write-only API semantics: GET returns configured/last4/mode/status only; the plaintext never returns to any client. Never log it; PostHog denylist; mobile apps never receive it.
3. **Gateway-client refactor groundwork**: parameterize credentials in the gateway libs that BYOK touches — new functions take a credentials argument; existing platform-key call sites keep working via a default (`getPlatformPaystackCreds()` etc.). Start with the PayPal lib (already parameterized ✅) and the refund path.
4. **Fee config**: extract the **three** duplicated 2% fee helpers (`paystack.ts:1226`, `korapay.ts:615` — which honors a `PLATFORM_FEE_PERCENTAGE` env override the others don't — and credit-direct's) into one `lib/payments/platform-fee.ts`, reconciling the env-override divergence, with per-currency config (the ₦2,050 cap is NGN-specific; define caps or percentage-only for USD/EUR/GBP — see Open Questions).
5. **Regenerate Supabase TypeScript types** after the vault migration + RPCs land (project rule: regen types before merge; the RPC return shapes are consumed in TS).
6. **Harden the client-forced gateway param**: `initialize/route.ts:1084-1087` accepts any `data.gateway` that's merely in `PAYMENT_GATEWAYS` — before any new gateway is added, forced selection must be validated against the merchant's actual availability (connected + enabled + currency), not list membership.

### Phase 1 — African currencies on existing platform rails (parallel quick win, no BYOK)

Baci's own Korapay account already supports **NGN/KES/GHS/ZAR/XAF/XOF** — but that support is dead weight today: there is **no country gate** on Korapay availability (`korapay_enabled` defaults on worldwide) while the storefront hardcodes `currency: 'NGN'`, so a Kenyan merchant's "available" checkout would charge in Naira. Fixing the gating turns existing infrastructure into new markets while **keeping the 2% fee** (platform rails, Baci is MoR):

1. **Availability matrix**: Korapay available iff merchant country is in the Korapay-supported set AND the order currency is in `KORAPAY_CHECKOUT_CURRENCIES` — replacing today's ungated default-on. This is the country gating the whole plan standardizes on: `provider × merchant country × order currency`.
2. Storefront checkout sends the merchant's order currency (builds on `multi-country-currency`). **Discovered during Wave 1:** the initialize route's Zod `SUPPORTED_CURRENCIES` whitelist only admits NGN/USD/GBP/EUR — KES/GHS/ZAR coerce to NGN before gateway selection, so each Lane 0 market additionally requires its currency added to that schema (deliberately fail-closed until then).
3. **Verify payout corridors live before launch**: `sendPayout` to KES/GHS/ZAR bank accounts has never been exercised in production (research gap flagged); test with small real disbursements per market and gate each currency fail-closed until verified. Note the weekly auto-payout cron uses **Kuda** (NGN rail) — non-NGN merchant wallets must route through Korapay disbursement only.
4. **Onboarding**: add the newly-servable countries to `lib/countries.ts` (GH and KE aren't even selectable today), gated on verified corridors.
5. Fee: 2% applies as today, using Phase 0.4's per-currency fee config (the ₦2,050 cap needs KES/GHS/ZAR equivalents or percentage-only).
6. **Kenya (and momo markets generally) are M-Pesa-first — this shapes both the rail choice and the checkout UX** (verified July 2026): M-Pesa processes >90% of Kenyan mobile-money transactions (~40M MAU, 82% adult penetration); cards are ~28% of online purchases. All three candidate rails support Kenya M-Pesa collections, differently: **Korapay** — hosted checkout *and* direct API (initiate → OTP → STK push → PIN), Kenya momo requires manual per-account enablement, KES payouts to M-Pesa supported; **Payaza** — API-only (single-step STK via `SAFKEN`, no hosted momo checkout); **Paystack** — live and self-serve but only for Kenya-registered businesses (i.e. relevant to Connect/BYOK, not to Baci's platform rails). **v1 recommendation: Korapay hosted checkout** — it's already an integrated rail, and the hosted page absorbs the STK-push complexity, so Kenya v1 is mostly Lane 0's gating + currency work plus a momo-enablement request to Korapay. **Native STK push in Baci's checkout is a v2 conversion upgrade** and requires an async payment UX the current redirect-centric checkout lacks: pending-first order state, "check your phone, enter your M-Pesa PIN" screen, ~60s user timeout with cancel (code 1032) / timeout (1037) handling, webhook-first confirmation plus a reconciliation sweep for stuck pendings (the existing DVA bank-transfer pending flow is the structural precedent). Label the method "M-Pesa" (not "mobile money") in the Kenyan method selector.
7. **Rail choice — Korapay vs Payaza bake-off (evaluated July 2026)**: Payaza is a credible second/alternative rail for exactly this lane — same collect-then-payout architecture, **broader documented mobile-money corridors** (M-Pesa/Airtel Kenya, Vodacom/Tigo/Halopesa Tanzania, MTN/Airtel Uganda, MTN/Orange/Wave XOF/XAF, plus ZAR EFT), one account with per-currency references for both collections and ~9 payout corridors, strong counterparty signals (4-agency Nigerian national-scale investment-grade ratings, early commercial-paper redemptions), modern docs + HMAC-SHA512 webhooks + pre-KYB sandbox. **Constraints to design around**: (a) **no split/fee primitive** — subaccounts are internal-ledger-only and using them for external merchants violates Payaza's compliance terms, so it's collect-then-payout like Korapay, never a Paystack-split replacement; (b) non-NGN collections are enablement-gated per rail ("available upon request") — rollout timing depends on Payaza ops; (c) collection webhooks are **dashboard-level only** (no per-call `notification_url` on non-card rails) → route events by `transaction_reference`, and its **15-char reference cap breaks our current `BAC-`+nanoid(12) = 16-char refs** — a Payaza adapter needs a shorter reference scheme; (d) per-currency funded balances (not one pooled balance) → treasury/FX per corridor; (e) no idempotency-key header (DIY via reference); (f) settlement timing undocumented — get it in writing per corridor; (g) strategic note: Payaza is launching **ShopAza**, an e-commerce platform competing with Baci's core product. **Decision gates for the bake-off**: written per-corridor rate card (a public per-country card exists — Nigeria domestic capped ₦2,000 — but payout-corridor fees need a quote), non-NGN enablement confirmation, written settlement timing, and Korapay's live payout-corridor test results (item 3) — pick per-market winners; the availability matrix + adapter interface make dual rails cheap to run.

### Phase 2 — PayPal lane: productionize the prototype

1. Rebase `paypal-integration` onto main; re-review the proxy.ts CSP change explicitly (protected file).
2. **Migrate secret storage** from `custom_settings` plaintext → the Phase 0 vault (`provider='paypal'`, roles `client_id` + `secret_key`, `environment` from the mode toggle), with a one-time migration for existing rows. **Non-secret config stays in `merchant_feature_settings`** (`paypal_enabled`, `paypal_mode`; drop `paypal_fx_rate` per item 5). Redact-on-read stays.
3. **Validate-on-save**: mint an OAuth token with the pasted creds against the selected mode's endpoint (sandbox vs live); store `last_validated_at`/error. Enforce mode at checkout the way Klump does — trust the **provider response's** live/sandbox indicator, hard-reject mode mismatches (never process a sandbox payment as real).
4. **Amount anchoring** (already largely correct in the prototype — keep): amounts server-computed from the order snapshot; capture verified against the stored **presentment** amount/currency (`metadata.paypal_presentment_*`) — NOT against `transactions.amount`, which is in the order currency and differs whenever FX applies. Add multi/partial-capture handling (validate the full capture set, not `captures[0]`) and a reconciliation path for capture-succeeded-but-DB-failed (money captured, order pending → reconciliation-review row, mirroring the existing `fileInventoryConfirmationFailureReview` idiom).
5. **FX policy — hard prerequisite**: remove the hardcoded `fxRate = 1300` fallback (fail closed: if no fresh rate, PayPal is unavailable for that checkout). **v1 recommendation: only offer PayPal when the order currency is natively PayPal-supported** (post multi-country-currency, non-NG merchants' orders are in their own currency — USD/GBP/EUR/CAD etc. — so no conversion needed); treat NGN→USD conversion as a separate, explicitly-designed workstream if ever wanted.
6. **Ledger semantics — fix the phantom fee**: `create_payment_transaction` with `gateway='paypal'`, `p_platform_fee=0` (the prototype currently books a 2% fee Baci never collected), plus a new `byok_fee_accruals` row (merchant_id, order_id, fee_amount, currency, status='accrued') for future billing. Fork `record_merchant_settlement` with `settlement_type='direct_to_merchant'` (**no wallet/upcoming-balance credit, and `process_due_settlements` must skip these rows** — otherwise merchants get "settlement incoming" emails for money they already have). The fork lands **before** the PayPal flag flips on.
7. **Refunds**: cancellation route branches on gateway — PayPal refunds call the PayPal Refund API **with the merchant's stored creds**.
8. **Checkout + availability**: `isPaypalCheckoutAvailable(merchant)` = enabled + validated live credential + order currency natively PayPal-supported; wire into `PaymentOptionsPanel` (web; prototype has this), `payment-method-selector` (mobile-storefront — PayPal approval via web redirect at v1), and the forced-gateway guard (Phase 0.6). Extend `/api/payments/verify` (the storefront success-page confirmation path, currently paystack/korapay-only → "Unsupported gateway") with a PayPal branch.
9. **Settings UI**: web page exists in the prototype; **mobile-admin needs a connect/enable screen as a Phase 1 deliverable** — and because secrets move to the private schema, mobile-admin must go through the new API/RPC, not its current direct `merchant_feature_settings` table reads.
10. **Onboarding**: `getLaunchPaymentRequirement` for non-NG merchants becomes "connect PayPal (or another provider) or enable Pay-on-Delivery".
11. Feature-flag per merchant; pilot with 2–3 international merchants.

### Phase 3 — Stripe restricted-key (`rk_`) lane

Baci has **no Stripe account**, and Stripe Connect requires a platform account in a Stripe-native country (i.e. incorporating a US/UK entity — a deferred business option, see §3). The compliant no-account path is merchant-pasted **restricted keys**:

1. **Connection**: merchant creates a restricted key in their Stripe dashboard (guided walkthrough listing the exact scopes: Checkout Sessions write, PaymentIntents read/write, Refunds write, Webhook Endpoints write); Baci **rejects anything not prefixed `rk_`** (collecting `sk_` violates Stripe policy). Store in the vault; validate-on-save with a scoped read call; detect test vs live from the key's responses (provider-response-authoritative idiom).
2. **Webhook provisioning**: on save, Baci programmatically registers a webhook endpoint **on the merchant's own Stripe account** via their `rk_` key, pointing at `/api/payments/stripe/webhook?t=<per-merchant token>` (fits the existing CSRF-exempt regex — no proxy.ts change; verified against `proxy.ts:1517`). Each endpoint mints its own signing secret → stored in the vault (`credential_role='webhook_secret'`). The route resolves the URL token → merchant → secret **before** trusting the payload (the plan's per-merchant webhook design, first exercised here).
3. **Charges**: Stripe Checkout Session created with the merchant's `rk_` key — redirect flow, matching the existing `authorization_url` pattern. Money settles to the merchant's Stripe balance; fee waived (accrual row only).
4. **Confirmation**: webhook-driven (`checkout.session.completed`), idempotent replay handling (conditional `status <> 'completed'` CAS update); extend `/api/payments/verify` with a Stripe branch — today it returns "Unsupported gateway" for anything but paystack/korapay.
5. **Refunds**: merchant's `rk_` key (Refunds scope).
6. Settings UI: paste + validate + status badge + disconnect (delete key from vault; deregister the webhook endpoint). Handle key revocation mid-flight: a 401 from Stripe marks the credential invalid (`mark_merchant_payment_credential_invalid`) so availability drops immediately.

### Phase 4 — African + Indian expansion (BD-gated, demand-driven)

1. **Talk to Paystack** about Connect (pilot): if available for Baci, it's the clean card-payments path for GH/ZA/KE/CI with native `platform_share` (Lane 0's Korapay rails may already cover these markets for local methods — Connect adds Paystack's card coverage + a second rail). Fallback: Baci in-country Paystack accounts (legal-entity decision) extending the keyless subaccount model.
2. **Evaluate Flutterwave** for the rest of Africa (UG/TZ/RW…): platform-owned subaccount/split (credential-free, Baci stays MoR, 7.5% VAT on split fees) vs merchant-own-account custody (vault-ready if chosen). Note: not in Hyperswitch either — it's a hand-built adapter whichever way.
3. **India, when demand exists**: **Razorpay OAuth partner model** (scoped revocable token, no key custody, Razorpay as the licensed PA holds funds/data — avoids RBI PA-CB licensing and data-localization exposure for Baci). One adapter behind the same interface.
4. Extend `lib/countries.ts` in step with whichever providers actually land.

### Phase 5 — Fee accruals stay data-only (fee waived)

BYOK-lane fees are waived; `byok_fee_accruals` rows (`fee=0, waived=true`) are recorded for optionality and "you saved ₦X in fees" merchant messaging. If policy ever changes, billing needs a mandate/subscription rail (RevenueCat↔plan_tier sync) — out of scope here. Platform-rail fees (NG + Lane 0) are untouched.

### Testing & safety (per repo policy)

- Colocated tests: crypto round-trip/tamper/wrong-KEK; RPC permission denials (anon/authenticated/staff-without-permission); PayPal — **audit and extend the prototype's existing suites** (create-order/capture-order/client-token/lib all have tests) with the currently-missing cases: FX-unavailable fail-closed, presentment-anchor mismatch, multi/partial captures, settlement-fork semantics, sandbox-on-live reject; Stripe webhook (bad signature, unknown account, amount anchor, idempotent replay, deauthorized account); refund branching by gateway; forced-gateway rejection when merchant lacks the gateway; response-never-contains-secret assertions.
- Migration replay on a Supabase preview branch before merge (hand-build prod-like state first; no migration-breaking keywords in SQL comments).
- Webhook routes are money paths: fail-closed on missing/invalid credentials everywhere; no silent fallback to platform keys.
- CodeRabbit + full quality gate before each phase ships.

## 5. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Credential store breach (Dukaan-class) | High | private schema + RPC-only access + AES-256-GCM + per-env KEK + write-only API + audit fields; prefer OAuth lanes (Stripe) over custody wherever possible |
| Webhook spoofing under per-merchant accounts | High | Stripe lane: single platform Connect secret (no per-merchant secrets). PayPal v1: no webhooks (synchronous capture + server verify). Any future raw-key webhook lane: unguessable URL token → resolve credential → verify, never parse-then-trust |
| Sandbox-mode payments treated as real | High | Provider-response-is-authoritative mode check; hard-reject mismatches (Klump idiom) |
| Fee revenue loss on PayPal lane | Medium | Accrual ledger from day one; Stripe lane keeps 2% natively; explicit decision below |
| Refund issued from wrong account | Medium | Refund path keyed by financing credential (Phase 2.7 / 3.5); tests |
| Phantom fee/settlement records from the prototype | High | Phase 2.6 zeroes the fee, forks `record_merchant_settlement`, and gates the launch on it; audit any rows already written by prototype testing |
| FX misprice on PayPal lane | High | Fail-closed FX (no hardcoded fallback); v1 restricted to natively-supported order currencies |
| Capture succeeded but DB write failed | Medium | Reconciliation-review row + alerting (Phase 2.4); idempotent re-capture check |
| Unverified Korapay payout corridors (Lane 0) | High | Live small-value payout test per currency before enabling that market; fail-closed per-currency gates (Phase 1.3) |
| Paystack Connect not actually available | Medium | Phase 3 is BD-gated; fallback paths identified (in-country accounts / Flutterwave) |
| PCI v4 script-integrity (6.4.3/11.6.1) on checkout pages | Medium | Independent workstream — applies **already today**, not created by BYOK; scope separately |
| `marketplace_integrations` plaintext tokens readable by staff sessions | High (pre-existing) | Separate fix: move Jumia tokens into the new vault or revoke column grants — ship regardless of BYOK |
| proxy.ts CSP change in PayPal branch | Medium | Explicit re-review at rebase (protected file) |

## 6. Open questions for review

1. **Confirm the fee stance**: 0% waived on BYOK lanes (accrual rows only), 2% kept on platform rails (NG + Lane 0). *(Recommended in §0 following your steer; confirming it's final.)*
2. **Fee shape for non-NGN platform-rail currencies (Lane 0)**: flat 2% uncapped, or per-currency caps (the ₦2,050 cap ≈ KES 175 / $1.35 — recommend percentage-only outside NGN).
3. **Lane order**: plan proposes Lane 0 (African currencies on Korapay rails) in parallel with the PayPal hardening, then Stripe `rk_`. Reorder if e.g. international demand outweighs African-market demand.
4. **Should NG merchants get BYOK lanes too** (e.g. a NG merchant with a PayPal account for international customers)? Caution: an NG merchant's orders are NGN, which is exactly the case that needs the FX conversion this plan defers (Phase 2.5) — so v1 recommendation is **no for NG merchants** (platform rails only); revisit alongside an explicit FX workstream or per-order multi-currency pricing.
5. **Pilot cohorts**: which international merchants for PayPal, and which KE/GH/ZA merchants for Lane 0?
6. **Lane 0 rail**: Korapay-only, Payaza-only, or per-market winner from the bake-off (Phase 1.6)? Recommend running both diligence tracks in parallel and deciding per corridor on rate + verified settlement.
7. The **AI-keys BYOK doc** (`docs/ai/byok-gemini-keys-plan.md`) — delete or keep as backlog? (Superseded by the #2978 provider-chain direction.)
