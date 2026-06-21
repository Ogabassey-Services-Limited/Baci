# Passwordless Sign-In — Implementation Plan

> **Status:** Draft for review · **Created:** 2026-06-20 · **Rev 6:** 2026-06-21 (5th review pass — `verified_at` predicate reversed after prod data check) · **Owner:** _unassigned_
> **Scope:** Unify and harden passwordless auth across (a) the Ogabassey customer storefront (web + native) and (b) the Baci merchant/admin surfaces (web + mobile-admin).
> **Source:** Multi-agent audit + 2026 best-practice research (adversarially verified). Verdicts below are constrained to what verified; claims that verified as `mixed`/`uncertain` are flagged inline and must be confirmed before they become load-bearing.
>
> **⚠️ Branch note (read before any Phase 0 work):** The deployed `send-auth-email` v20 source (`index.ts` **+** `auth-email-template.ts`) lives in the repo on **`origin/main`** (PR #2638) and matches production. It is **absent from the stale `codex/posthog-observability` branch**, which only has the old single-file `index.ts`. **All edge-function work must be based on `origin/main`** (or a branch off it), never this branch — otherwise a redeploy erases the deployed Ogabassey template. See Phase 0, step 0.

---

## 1. Problem statement

Auth-email branding for merchants (e.g. Ogabassey) is broken end-to-end, and the customer auth surface is fragmented across two code paths with uneven security. Two concrete defects plus an architectural split:

1. **Native conveys no merchant context.** `apps/mobile-storefront/stores/auth-store-credentials.ts` calls `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })` with **no `emailRedirectTo`**. The `send-auth-email` hook resolves the merchant only from `redirect_to`/`site_url`, so native auth emails can never be branded and always fall back to Baci.
2. **Phantom `custom_domain` column.** The deployed `send-auth-email` edge function (`fetchMerchantBranding`) `select('… custom_domain …')` from `merchants` — a column that **does not exist** (custom domains are normalized into `public.domains`). PostgREST rejects the whole `select`, the error is swallowed, and **every** merchant — even web, which *does* pass context — silently falls back to `BACI_BRANDING`. So branding is dead on all channels right now. On `origin/main` the same direct-query bug also remains in the **google** and **apple** OAuth routes; the `send-code`/`verify-code`/`session` routes were already migrated to the `getMerchantByIdentifier` helper (which sources `custom_domain` safely from `public.domains`). The deployed edge fn is the still-live break. (An earlier draft of this plan listed `send-code`/`verify-code`/`session` as broken — that was read off a stale branch; see §9 Step 1.)
3. **Split + uneven enforcement.** Web storefront goes through a hardened server route (`/api/storefront/auth/send-code`); native calls the SDK directly. Merchant/admin uses password-first with a non-durable in-memory limiter. There is no captcha and no MFA/passkeys anywhere.

A fully-built, deployed **Ogabassey-branded** email design already exists (`renderOgabasseyEmailHtml` in `send-auth-email/auth-email-template.ts`) but is unreachable behind defects 1–2.

## 2. Goals / non-goals

**Goals**
- One hardened server endpoint pair for OTP send/verify, reused by web storefront, native storefront, and merchant admin.
- Correct per-merchant branding on every channel.
- Defense-in-depth: per-account + per-IP rate limiting, verify-attempt lockout, captcha, enumeration-safe responses.
- Phishing-resistant auth (passkeys) for the money-handling admin.
- Auth posture (OTP expiry, redirect allowlist) version-controlled, not dashboard-only.

**Non-goals (for now)**
- Per-merchant custom **From** domains (CNAME delegation). Keep one aligned platform sending domain; brand via display name + body.
- Migrating off Supabase Auth.
- SMS OTP.

## 3. Threat model — the two surfaces are not the same

| | Ogabassey storefront (customer) | Baci admin (merchant) |
|---|---|---|
| What's at risk | Customer PII, order history | **Real money**, payouts, store config, other people's customers |
| Acceptable primary factor | Email 6-digit OTP | **Phishing-resistant** (passkey); OTP is convenience-grade only |
| Why | Low blast radius; OTP keeps native users in-app | Email/SMS OTP is **not** phishing-resistant — AiTM kits relay codes in real time |

**Design rule:** different surfaces get different primary factors. Do **not** ship the same OTP-everywhere model to admin.

## 4. Target architecture

A single server pair — `POST /api/storefront/auth/send-code` and `POST /api/storefront/auth/verify-code` — that **all clients call** (web fetch, native fetch, and a merchant variant/`audience` param). Native stops calling `signInWithOtp`/`verifyOtp` directly; the SDK is used only to *hold* the session after the server verifies.

```
client (web | native | admin)
   │  POST { email, merchantSlug|host, captchaToken?, audience }
   ▼
send-code route ──► Zod validate
                ──► merchant lookup + is_published gate (slug, else domains table)
                ──► rate limit (per-account AND per-IP) + burst cap
                ──► captcha above threshold
                ──► signInWithOtp(emailRedirectTo=<per-merchant>, data.pending_merchant_id)
                ──► uniform "if an account exists, a code was sent" (200)
verify-code route ─► attempt-lockout check ─► verifyOtp ─► upsert_customer_on_auth ─► session
```

This is the single enforcement point for all of §5. It also makes branding correct everywhere because the server always sets a per-merchant `emailRedirectTo`.

**Shared merchant/domain resolver — already exists; reuse it.** On `origin/main` the canonical helper is **`getMerchantByIdentifier`** in `apps/web/src/lib/cached-data.ts`. It does slug lookup on `merchants` (via `MERCHANT_PUBLIC_SELECT`, which does **not** include the phantom `custom_domain` column), and resolves a host against `public.domains`, attaching `custom_domain` from the matched `domains.domain` value. `send-code`, `verify-code`, and `session` routes **already call it**; its returned `merchant.custom_domain` is a safe property read, not a `merchants` column. So the work is **not** "introduce a resolver" — it's "route the last 3 stragglers through the existing one and mirror it in the Deno edge fn."

**Domain predicate (match the existing helper, NOT the RLS text).** The operative routing predicate in `getCachedMerchantByDomain` is: normalize `host` (lowercase), then `domains.domain = host AND status = 'active' → merchant_id`. It runs via the **service-role** client (`getServiceRoleSupabaseClient()`, [cached-data.ts:869](../../apps/web/src/lib/cached-data.ts)) — deliberately bypassing RLS so unpublished "Coming Soon" stores still resolve — and it **does not filter `verified_at`**. There is **no `status = 'verified'`** value.

⚠️ **Do NOT "tighten" this to `verified_at IS NOT NULL`** (this reverses the Rev-4 predicate and rejects a reviewer suggestion — with data). Prod check on `public.domains`: of **72** `status='active'` rows, **70 have `verified_at IS NULL`** (only 2 verified). Adding that filter to the helper or the edge fn would break custom-domain **routing and branded email for ~97% of merchants**. The app's real "domain is live" signal is `status='active'`; `verified_at` is largely unpopulated. The **edge fn must mirror `status='active'` (service role)** — same as the helper — so its branding lookup matches what actually routes. Build `emailRedirectTo`/branding host from the resolved canonical `slug`/`custom_domain`, never the raw request string.

> **Data/RLS divergence — separate cleanup, NOT Phase 0.** `domains_select_policy` requires `status='active' AND verified_at IS NOT NULL` for public/anon reads, but 70/72 active domains are unverified — so anon clients can't read them and all routing leans on the service-role bypass. A side effect: a merely-`active` (unverified) domain can drive routing/branding — a latent domain-takeover surface. Fix it properly on its own track (backfill `verified_at` on activation, gate activation on verification, or relax the RLS policy to match reality). Do **not** paper over it by adding a `verified_at` filter in Phase 0 — that breaks live merchants.

## 5. Method decisions

| Surface | Primary | Fallback / bootstrap | Notes |
|---|---|---|---|
| Storefront web + native | **Email 6-digit OTP** | Magic link (web), Google/Apple OAuth | OTP avoids PKCE same-device binding on native; passkeys offered as **post-login enrollment** later, not primary |
| Baci admin / merchant | **Passkeys (WebAuthn)** once validated | Email OTP **interim**; hardware key + recovery codes long-term | Once passkeys enrolled, **demote OTP to recovery-only** — a standing OTP fallback undoes passkey phishing-resistance |

## 6. Security controls (added at the shared endpoint)

- **Rate limiting:** per-account **and** per-IP (today: IP-only on web, none on native), burst cap ~3 sends/identifier/60s, exponential backoff. Move the **merchant** limiter off in-memory (`apps/web/src/lib/ensure-action-rate-limit.ts`) to the durable Upstash store used by storefront (`apps/web/src/lib/rate-limit.ts`); cold starts currently reset it, so it is not a real brute-force defense.
- **Verify-attempt lockout:** cap failed *verifies* (e.g. lock after ~10 failures / 24h); count **only error responses** so legitimate users aren't throttled.
- **Lockout/limiter storage — Upstash is the Phase 1 path.** Do **not** reuse `public.email_send_attempts` (outbound-email telemetry; `deny_public_access` RLS for `anon`/`authenticated`). Use **Upstash Redis** — already wired for storefront IP limits — as the durable, cold-start-safe store for both the per-account send limiter and the verify-failure ledger. **Do not** add a Postgres lockout table reachable from the unauthenticated OTP path via a broadly-callable RPC: the send path is effectively `anon`, so an `anon`-callable `SECURITY DEFINER` function is a privilege-escalation surface (Supabase guidance: keep `SECURITY DEFINER` out of exposed schemas). A DB-backed ledger is permissible **only** as a separately security-reviewed design — table in a **private (non-PostgREST-exposed) schema**, `SET search_path = ''` (locked), explicit `REVOKE ALL … FROM anon, authenticated`, writes only through a server-side connection, and **no public RPC**. Default to Upstash; treat the DB option as out-of-scope unless that review happens.
- **Captcha:** wire Turnstile/hCaptcha, accept `options.captchaToken`, trigger above a per-IP/per-account send threshold. This is the only documented mitigation for Supabase's browser-console enumeration vector.
- **Enumeration-safe responses:** uniform body + status + timing — "if an account exists, a code was sent." (Today `send-code` leaks *merchant* existence via 404/403; acceptable for public store discovery, but switch to a uniform 200 if hiding store state is desired.)
- **OTP length/expiry:** keep 6 digits (email codes). Supabase's **default email-OTP expiry is 1 hour**; tightening it (proposed **2–5 min**) is a real behavior change that can break slow real-world sign-ins — it belongs in the tested config rollout (Phase 1), **not** Phase 0. Phase 0 only *captures* the current dashboard values into `supabase/config.toml` `[auth]` verbatim (today the file holds only the edge-function setting), so posture is auditable without changing behavior.
- **`shouldCreateUser`:** keep `true` on storefront (sidesteps the open enumeration leak of `false`); pair with captcha + limits. Use `false` for the merchant login path (accounts are provisioned via onboarding).

## 7. Branding end-to-end

- Every send call passes `merchantSlug`/host → server derives per-merchant `emailRedirectTo` + `pending_merchant_id` → hook `extractMerchantLookup` resolves the merchant → branded template renders.
- Send from **one** aligned platform subdomain (e.g. `auth.usebaci.com`) with SPF/DKIM/DMARC; brand each merchant by **display name** ("Ogabassey via Baci") + body theme, **not** the From domain. Putting a merchant domain in From while signing with the platform key fails DMARC and reads as spoofing.
- **Hard dependency:** Phase 0 must land first — branding is inert until the phantom-column bug is fixed.

## 8. Recovery / fallback

- **Storefront:** email OTP is itself the recovery rail; magic link + OAuth as alternates. Low threat model → passkeys-alongside-OTP is fine.
- **Admin:** require **≥2 registered authenticators** (platform passkey + roaming hardware key) and issue **one-time recovery codes at enrollment**. No single email-OTP recovery for money-handling accounts; reserve a manual, identity-proofed path for "lost everything." Supabase does not prescribe a passkey recovery flow — **we must design it.**

---

## 9. Phased rollout

### Phase 0 — Fix branding bugs + make config auditable (no behavior change)
**Goal:** branding works on web/mobile-web immediately; native unblocked. **Must not erase the deployed template.**

**Step 0 — Source-of-truth safety (do this first):**
- Branch Phase 0 off **`origin/main`**, which already contains the deployed v20 source (`index.ts` + `auth-email-template.ts`). Do **not** start from `codex/posthog-observability` (it lacks `auth-email-template.ts` and would regress on redeploy).
- Before touching anything, **verify repo == deployed**: diff `origin/main`'s `send-auth-email/*` against deployed v20 (`supabase functions download send-auth-email`, or the MCP `get_edge_function` dump already captured). If there is any drift (a prod hotfix not in main), **recover the deployed files into the repo and commit them first**, then patch. Never redeploy until repo source is confirmed to match (or supersede) prod.

**Step 1 — Remove the phantom column from the 3 remaining broken callers (verified against `origin/main`).** Only these still issue direct `merchants.select(… custom_domain …)` / `.eq('custom_domain', …)` queries:
  - `apps/web/supabase/functions/send-auth-email/index.ts` (`fetchMerchantBranding`) — **then redeploy** (deployed v20 is broken). The Deno edge fn **can't import** `getMerchantByIdentifier`; mirror its slug→`merchants` + host→`domains` logic inline using the **`status='active'` (no `verified_at`)** predicate so it matches what actually routes (see §4 — do **not** add `verified_at`).
  - `apps/web/src/app/api/storefront/auth/google/route.ts` — replace the direct select + `.eq('custom_domain')` with a `getMerchantByIdentifier(merchantSlug)` call (same pattern as `send-code`).
  - `apps/web/src/app/api/storefront/auth/apple/route.ts` — same as google.
  - **Do NOT touch** `send-code`, `verify-code`, `session` — on `origin/main` they already use `getMerchantByIdentifier` and are correct. (My earlier inventory listed them from the stale `codex/posthog-observability` checkout; that was wrong.)

**Step 2 — `emailRedirectTo` from the resolved merchant — already done for `send-code`.** On `origin/main`, `send-code`'s `resolveOtpRedirectUrl` already builds from the resolved `merchant.slug`/`custom_domain` and validates the request origin (no raw-string doubled host). This step therefore applies **only** to (a) the native stopgap below and (b) the edge fn's mirrored logic: build the redirect/branding host from the resolved canonical slug, never the raw input.

**Step 3 — Native conveys merchant context** (stopgap until Phase 2): in `apps/mobile-storefront/stores/auth-store-credentials.ts`, pass `options.emailRedirectTo = https://<CONFIG.MERCHANT_SLUG>.usebaci.com/account/verify` + `options.data.pending_merchant_id`.

**Step 4 — Audit & document `[auth]` config (read-only; no push).** **Read** the hosted Auth config (OTP expiry, redirect allowlist, mailer limits) from the **Dashboard / Management API** — that is the source of truth for the hosted project; `supabase/config.toml` is local/self-hosted config and currently holds only the edge-function block. **Write** the current values into `config.toml` `[auth]` **as documentation/local parity only**. **Do NOT run `supabase config push`** in Phase 0 (and ideally not at all here): the CLI has no `config pull`/dry-run, so a push would overwrite hosted settings from a partial local file and could clobber redirect URLs / expiry. Only ever push after proving a **no-op diff** against the readback. Phase 0 changes nothing on the hosted project; it just makes posture auditable.

**Acceptance:** Ogabassey OTP email renders `renderOgabasseyEmailHtml` (black header, red "SECURE SIGN IN" pill, "Open Ogabassey") on web **and** native; `fetchMerchantBranding` logs "Using merchant branding: Ogabassey"; deployed `auth-email-template.ts` is intact in the repo and unchanged by the deploy.
**Tests:** unit test forbidding **`merchants.select(… custom_domain …)`** and **`.eq('custom_domain', …)`** in the 3 fixed callers (a legitimate `merchant.custom_domain` *property read* from `getMerchantByIdentifier`/cached output is fine — don't flag those); test that google/apple resolve a merchant by slug **and** by `status='active'` domain via the helper; edge-fn test asserting its mirrored query filters `status='active'` **only** (a guard test that it does **not** add `verified_at`, which would drop ~70 live domains); regression test asserting branding resolves for slug `ogabassey`; mobile test asserting `signInWithOtp` is called with `emailRedirectTo`.
**Deploy/manual:** confirm repo == deployed (Step 0) → redeploy `send-auth-email` → smoke-test a real Ogabassey sign-in on web + native; confirm `https://*.usebaci.com/**` (and any active custom domains) are in Supabase **Auth → Redirect URLs**; confirm OTP expiry in dashboard.
**Rollback:** redeploy the captured v20 bundle (kept from Step 0) — restores prior (broken-but-stable) behavior without data loss.

### Phase 1 — Harden the existing storefront/web endpoint
- **Rate-limit ownership:** per-IP limits for these routes **already exist** in `apps/web/src/lib/rate-limit.ts` and are enforced in `apps/web/src/proxy.ts`. The missing **per-account/email** limiter and the **verify-failure lockout ledger** require the validated request body, so they **cannot live in proxy** — put them in the route/shared verify helper (and the durable store), keeping `proxy.ts` changes minimal/none. (`proxy.ts` is a protected file — any edit needs explicit approval.)
- Wire Turnstile + `captchaToken`: `send-code/route.ts`, `verify-code/route.ts`, `apps/web/src/schemas/auth.ts`.
- Move merchant Server-Action limiter to Upstash: `apps/web/src/lib/ensure-action-rate-limit.ts`.
- Close enumeration leaks: `apps/web/src/app/actions/auth.ts` (`loginAction`), `apps/web/src/app/(platform)/onboarding/actions.ts`.
- **Config tightening (separate, tested rollout):** propose OTP expiry **2–5 min** (default is 1h) and review the redirect allowlist. Stage in a preview project, sign in end-to-end (web + native), confirm no legit-user breakage, then apply **via the Dashboard / Management API** (not a blind `supabase config push`). This is the behavior-change deferred out of Phase 0.

**Acceptance:** automated abuse test — >3 sends/60s/identifier and >N failed verifies are blocked durably across cold starts; captcha challenge fires above threshold; identical responses for existing vs non-existing accounts.

### Phase 2 — Consolidate native + add merchant passwordless login
- **Session-handoff contract (decide before building).** `verify-code/route.ts` currently returns `session: { access_token, expires_at }` — **no `refresh_token`** — but native `supabase.auth.setSession()` requires `{ access_token, refresh_token }` (see `apps/mobile-storefront/stores/auth-store-oauth.ts`, which reads both from the OAuth callback). Pick one and spec it:
  - **(a) Return the full session** (`access_token` + `refresh_token` + `expires_in/expires_at`) on the **native/`audience=native`** response; native stores it in secure storage (SecureStore/MMKV) and calls `setSession`. Web keeps relying on the SSR cookie session (don't ship a refresh token to the browser body — it stays httpOnly-cookie based).
  - **(b)** A separate one-time server-to-client exchange (short-lived nonce → session) if returning the refresh token in the body is deemed too sensitive.
  - Recommendation: **(a)**, gated by `audience`, since native already handles raw tokens for OAuth.
- Native storefront: replace direct SDK OTP in `apps/mobile-storefront/stores/auth-store-credentials.ts` (+ `components/auth/useLoginScreenController.ts`, `LoginOtpStep.tsx`) with `fetch` to the shared endpoint; consume the session per the chosen contract; add a 60s resend cooldown and iOS `textContentType="oneTimeCode"` autofill on the code input.
- Merchant `/login` passwordless: add an email-OTP/magic-link option in `apps/web/src/components/login-form.tsx` with `shouldCreateUser:false` and a **dashboard** (not `/onboarding`) `emailRedirectTo`; reuse the verify pattern from `apps/web/src/components/auth/verify-form.tsx`. Generalize `sendMagicLink` in `onboarding/actions.ts` (it hardcodes `shouldCreateUser:true` + `/onboarding`).
- Confirm CSRF coverage for merchant auth Server Actions (they sit outside the `proxy.ts` `/api` origin check).

**Acceptance:** native and web exercise the identical server path (one integration suite covers both); merchant can sign in with an emailed code end-to-end.

### Phase 3 — Passkeys / MFA (admin first, then storefront enrollment)
- Add Supabase WebAuthn/passkeys to merchant admin: `apps/web` login + `apps/mobile-admin`. **Replace** the orphaned, dead OTP screen `apps/mobile-admin/app/(auth)/verify.tsx` (fragile `signup→email` type guess) — do not revive it.
- Require ≥2 authenticators + recovery codes for admin; demote email OTP to recovery-only once passkeys enrolled.
- Storefront: one-tap passkey enrollment after a successful OTP login (`apps/mobile-storefront` + storefront web).
- Behind a feature flag; pin `@supabase/supabase-js >= 2.105.0`.

**Acceptance:** admin can register + sign in with a passkey on web and mobile-admin; recovery-code flow verified; OTP no longer a standing admin factor.

---

## 10. Open questions / risks (confirm before they become load-bearing)

1. **Supabase passkeys are Beta/experimental with a ~5-allowed-origins RP limit** *(verified high)* — this **collides with the per-merchant subdomain/custom-domain model**. Discoverable passkeys are origin-scoped, so a passkey on one merchant origin won't work on another. **Biggest unknown.** Admin (single origin) is safe; validate hard before any storefront passkey work. Gate behind a flag; APIs may change without notice.
2. **Do NOT switch the native client to PKCE.** `apps/mobile-storefront/lib/supabase.ts` deliberately sets `flowType: 'implicit'` (with `detectSessionInUrl:false`) because the PKCE `code_verifier` is lost under the `expo-web-browser` flow — implicit is the officially-recommended RN setting. Phase 2 server-verifies OTP and uses `setSession`, so **no client PKCE is needed**; leave `flowType` as-is. If PKCE on native is ever desired, it requires its own spike (verifier persistence across the browser redirect), never an inline plan instruction. Web (SSR cookie client) stays PKCE.
3. **NIST email-OTP timing rules are mixed** *(verified mixed)* — email is **not** a NIST out-of-band channel, so the 10-min OOB rule doesn't strictly apply; treat email OTP as low-assurance/convenience, which is *why* admin needs passkeys. 6 digits is the floor, not "20 bits."
4. **Passkey adoption percentages from research were partly fabricated** — the *direction* (phishing-resistant, faster, higher success) is solid; **do not cite specific conversion stats**. WebAuthn L3 is a Candidate Recommendation (ship-able), not a full Rec — cite accurately.
5. **Dashboard-only settings** (OTP expiry, redirect allowlist, mailer rate limits) are not in the repo — confirm each in the Supabase dashboard and move into `config.toml` where possible.
6. **`proxy.ts` is a protected file** — Phase 1's limiter wiring must be additive and explicitly approved before editing.
7. **Edge-function source-of-truth drift** — deployed v20's files exist on `origin/main` but **not** on the current `codex/posthog-observability` branch. A redeploy from the wrong base would erase the deployed Ogabassey template. Phase 0 step 0 (verify repo == deployed, base off main) is mandatory, not optional.
8. **Resolver duplication** — the Deno edge function cannot import the Next.js `getMerchantByIdentifier` helper (`apps/web/src/lib/cached-data.ts`); it must mirror the slug→`merchants` + host→`domains` logic inline using the **same `status='active'` (no `verified_at`)** predicate the helper uses, so branding matches routing. Both run under service role and bypass RLS — that's intentional; do **not** "fix" it by adding `verified_at` (70/72 prod active domains are unverified — see §4). Keep the two in sync (shared fixtures for the resolution table).
9. **`domains` verification model is inconsistent (separate track)** — `status='active'` is the de-facto live signal while `verified_at` is mostly NULL and the RLS policy demands it. Routing therefore depends entirely on the service-role bypass, and unverified-but-active domains can drive branding. Needs a real fix (backfill / activation gate / RLS alignment) outside this plan; flagged so nobody "tightens the query" and takes down 70 storefronts.

## 11. References (verified)

- Supabase passwordless email — https://supabase.com/docs/guides/auth/auth-email-passwordless
- `shouldCreateUser:false` enumeration leak — https://github.com/supabase/auth/issues/1955
- Supabase CAPTCHA — https://supabase.com/docs/guides/auth/auth-captcha
- Passkeys vs OTP (phishing resistance) — https://www.iddataweb.com/passkeys-vs-otp-2025/ · https://workos.com/blog/passkeys-stop-ai-phishing-mfa-fallbacks
- Rate-limit bypass patterns — https://hacktricks.wiki/en/pentesting-web/rate-limit-bypass.html
- DMARC/sender alignment — https://support.google.com/a/answer/81126
