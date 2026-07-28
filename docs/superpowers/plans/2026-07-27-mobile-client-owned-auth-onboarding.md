# Mobile Client-Owned Auth Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with fresh verification at every commit.

**Goal:** Make mobile merchant signup land reliably in authenticated store setup and then the admin home, while preserving exact slug errors and eliminating the public endpoint's mixed auth/provisioning responsibilities.

**Architecture:** The Expo app creates and persists the Supabase Auth account/session directly. A new, versioned, bearer-only `POST /api/mobile/merchant-provisioning` endpoint validates bounded business data and invokes one `SECURITY INVOKER` PostgreSQL function that atomically provisions the merchant, platform subdomain, and owner staff row under RLS. One shared supported-merchant-country catalog drives the web schema and mobile onboarding picker; the SQL function pins and contract-tests the same ISO-2-to-currency mapping so callers can select neither an unsupported country nor a payout currency. The existing session plus the presence or absence of the user's merchant remain the only durable routing state. The phone sends an explicit allowlisted `X-Baci-Platform: ios|android` telemetry header; it is never identity or authorization. The old public `POST /api/mobile-onboarding` contract remains temporarily available to installed v1 builds and reuses the same transactional provisioning helper; it is retired only after a durable PostHog-plus-health compatibility gate. Deterministic home-template creation remains non-critical `after()` work through the caller-scoped client; the currently cookie-bound hero assignment is removed from mobile onboarding instead of pretending it works for bearer requests.

**Tech Stack:** Expo 57, React Native 0.86, Expo Router 57, Zustand, TanStack Query 5, Supabase Auth/JS 2.108, Next.js 16 Route Handlers, PostgreSQL/PLpgSQL, PostgREST RPC, Zod, Vitest, React Native Testing Library, Biome, Turborepo.

**Global Constraints:** Preserve the uncommitted iPhone signup UX fixes (sentence-case names, title-cased business name, country picker, conditional “Please specify,” slug behavior, and designed coming-soon page). Do not modify `proxy.ts`, existing migrations, or environment files. Do not add service-role authority, a new queue, an onboarding-state table, or a broad Expo Router migration. Do not break installed v1 clients by replacing their public request contract in place. Account creation must not depend on a Next.js response callback. Critical provisioning must be idempotent and transactionally all-or-nothing. Every bug fix gets a regression test. Keep touched source files below 300 lines. Use only pnpm/Biome and never run a Vercel cloud build.

> **Re-review receipt (2026-07-28):** Re-opened against freshly fetched `origin/main` `5b26d07938e1ac4f58679cd6110bd613a5bad0e7`, the dirty isolated branch, current RLS/migration and slug-trigger contracts, live-policy preconditions, mobile request transport, PostHog query/capture seams, release gate, social-auth paths, error transport, deferred provisioning helpers, country/currency catalogs, and both owner-staff uniqueness contracts. The only movement since Revision 3's receipt is deployment/CI/tooling commit `5b26d07`; it does not touch auth, onboarding, PostHog, or migrations. Revision 4 preserves Revision 3's architecture and closes the country/currency authority, owner-staff reconciliation, exact-arbiter, and canonical business-name/template gaps. No implementation source was changed during re-review.

### Re-review gate

| Finding | Severity | Resolution in current plan |
|---|---:|---|
| Replacing v1 in place would break installed password-bearing clients | High | Add v2 separately; retain and measure v1; make retirement a gated later task. |
| A caller-selectable root domain would create hostname authority | High | Pin `usebaci.com` in SQL and add a cross-layer drift test. |
| Domain repair could demote an existing custom/purchased primary | High | Preserve the current primary and repair the platform subdomain as secondary. |
| OTP navigation depended on asynchronous auth-listener timing | Medium | Await a typed auth-store verification action that commits the returned session before navigation. |
| Social identities can reach profile completion without complete names | Medium | Reuse required, editable first/last-name fields in authenticated setup. |
| Bearer deferred work called a cookie-scoped hero helper | Medium | Remove hero assignment from this flow; keep only caller-scoped template/page-config work. |
| Sequential SQL did not prove same-user concurrency and replay failure had no stop rule | Medium | Add a coordinated two-session harness and make both replay modes an abort gate. |
| `23505` handling by constraint name alone misses the current reserved/retired/too-long slug trigger messages | High | Diagnose both `CONSTRAINT_NAME` and exact `MESSAGE_TEXT`; map only repository-known arbiters/messages and re-raise every other uniqueness failure. |
| Direct native `signUp` had no gate for a live CAPTCHA-enabled project | Medium | Verify the target project's live bot-protection setting; block this plan if CAPTCHA is enabled until a separately approved native token flow exists. |
| A native `User-Agent` is not a reliable `ios|android` signal | Medium | Send and strictly validate `X-Baci-Platform` from the existing runtime-platform helper; keep it telemetry-only. |
| Seven days of ordinary logs did not make zero-v1 traffic independently queryable | Medium | Add a secret-free PostHog contract event, health/query helper, daily canary evidence, and a reset-on-gap retirement clock. |
| The existing shared mobile auth helper falls back to cookies, and the new body contract had no explicit size limits | Medium | Give v2 a strict bearer-only helper, test cookie-only rejection, and enforce cross-layer length/color bounds before writes. |
| Mobile exposes countries outside the web onboarding allowlist, while SQL cannot import the TypeScript currency lookup | High | Add one shared supported-merchant-country catalog, make the onboarding picker and web schema consume it, derive currency inside SQL from a pinned matching map, and fail a drift contract test if any code/currency pair diverges. |
| Owner-staff repair was described as a generic upsert despite independent `(merchant_id,email)` and `(user_id,merchant_id)` arbiters | High | Pin both exact constraint names, claim only an unowned pending/removed same-email row, update the same-user row, and fail closed rather than overwrite a different active identity. |
| The merchant trigger normalizes business names, but deferred template generation could still receive the raw spelling/whitespace | Medium | Apply `normalizeBusinessName` before RPC/deferred scheduling and prove merchant plus home config receive the identical canonical name. |

**Cycle 4 verdict:** 0 open High findings; 0 open actionable Medium findings. The plan is implementation-ready through the dual-contract Phase A exit only after Task 0's live auth-policy stop gates pass. Final v1 retirement remains intentionally blocked on its measured compatibility gate.

---

## Research Decision

### What is actually over-engineered

The desired guarantees are not over-engineered. Retry safety, exact slug conflicts, email-confirmation recovery, and cold-start routing are required. The excess complexity is confined to the current public `POST /api/mobile-onboarding` boundary, which presently owns all of these concerns in one 596-line handler:

1. Password validation and breach lookup.
2. Anonymous Supabase Auth signup.
3. Explicit-slug preflight.
4. Manual access-token handoff into a second client.
5. Merchant insert/update and collision retries.
6. Domain insertion and compensating repair.
7. Owner staff upsert.
8. Privileged home-page insertion.
9. Deferred template and hero generation.
10. A recovery flag telling the phone to sign in again.

That shape creates the observed failure class: the auth account can commit before merchant provisioning, while the phone has not persisted the server-created session. The following `signIn()` workaround is a second authentication race, not a durable solution.

### Why the selected design is the current best fit

- Supabase's current React Native guidance has the native client call `auth.signUp`, persist the returned session, use `processLock`, and refresh while the app is active. Baci's client already has the required persistence and refresh lifecycle, so registration should use that established primitive rather than creating an auth session inside Next.js. See [Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native) and [`signUp`](https://supabase.com/docs/reference/javascript/auth-signup).
- Supabase documents that email-confirmation settings determine whether `signUp` returns a session. The existing `needsEmailConfirmation` result and OTP screen therefore remain first-class paths; they are not treated as failures.
- Supabase's CAPTCHA guidance requires a frontend challenge token in `signUp({ options: { captchaToken } })` when CAPTCHA protection is enabled. Local `supabase/config.toml` currently says `enabled = false`, but that is not proof of the target project's live Dashboard policy. Native signup therefore has an explicit live-policy stop gate; the refactor neither silently disables bot protection nor invents an unsupported hidden token. See [Supabase CAPTCHA protection](https://supabase.com/docs/guides/auth/auth-captcha).
- Supabase recommends `SECURITY INVOKER` for database functions by default. PostgREST executes each RPC request in a transaction, so a raised error rolls back merchant, domain, and staff writes together. See [Supabase Database Functions](https://supabase.com/docs/guides/database/functions) and [PostgREST Transactions](https://postgrest.org/en/stable/references/transactions.html).
- TanStack Query mutation functions continue independently of component-local callbacks, but per-call callbacks may not run after unmount. Critical session creation therefore belongs in the awaited auth store action, and route recovery belongs in durable auth/merchant state. See [TanStack Query Mutations](https://tanstack.com/query/latest/docs/framework/react/guides/mutations).
- Next.js `after()` is appropriate only for non-critical work that can fail without invalidating the response. Merchant, domain, and owner membership therefore move into the transaction; deterministic template/page-config decoration may remain deferred. Cookie-bound hero assignment is removed from this path. See [Next.js `after`](https://nextjs.org/docs/app/api-reference/functions/after).
- The live database already has RLS on `merchants`, a unique `merchants.user_id`, unique owner staff membership, owner-scoped domain policies, page-config owner policies, and unique `(merchant_id, page_slug)`. These are enough for an invoker RPC and idempotent home-page upsert. No new service-role edge is justified.
- The existing auth layout already implements the correct recovery rule: authenticated user without merchant → `complete-profile`; authenticated user with merchant → admin tabs. A separate onboarding status table would duplicate and risk drifting from the real state.
- Installed admin builds still post password-bearing v1 payloads to `/api/mobile-onboarding`. A new authenticated app can call the current route's completion path, but an auth-only replacement would make old builds return 401. A separate v2 route therefore ships first; route-level traffic, not the in-app update modal alone, gates v1 retirement because the current update prompt intentionally defers on `/register`, `/verify`, and `/complete-profile`.
- The existing v1 route infers `ios|android` from `User-Agent` and defaults every unrecognized native string to Android. React Native's transport does not guarantee the synthetic iPhone user-agent used by route tests. V2 therefore sends `X-Baci-Platform` from the existing `getRuntimePlatform()` helper and accepts only `ios|android`; the value is telemetry, never authorization. V1 keeps its legacy behavior during compatibility.
- The mobile-wide `apps/mobile-admin/constants/countries.ts` currently contains substantially more countries than the web onboarding `COUNTRIES` catalog, so the phone can offer selections that `mobileOnboardingSchema` rejects. That broader list also serves store settings, phone entry, and display formatting; it is not evidence that Baci supports merchant onboarding or payouts in every listed market. Create `MERCHANT_COUNTRIES` in `@baci/shared` from the current web-supported onboarding catalog, make web onboarding and the mobile merchant-setup picker consume it, and leave the broader mobile settings list intact. The SQL migration pins the same ISO-2-to-ISO-4217 pairs and a source contract test compares them exactly. The RPC accepts no payout-currency parameter and rejects unsupported countries instead of falling back to USD.
- The repository already has immediate server-side PostHog capture and authenticated HogQL query helpers. Contract-retirement evidence should reuse those bounded seams: a secret-free `mobile_onboarding_contract_invoked` event, a daily telemetry canary/health query, and retained gap logs. A seven-day clock is valid only while ingest, query, canary, and deployment coverage are continuously healthy; a gap resets the clock.
- `DEFAULT_ROOT_DOMAIN` is currently the stable public constant `usebaci.com`, while the database has no caller-readable authoritative root-domain setting. The provisioning migration therefore owns a pinned `usebaci.com` constant and a cross-layer drift test against `apps/web/src/lib/default-root-domain.ts`; the RPC accepts no caller-selected hostname.
- `domains_one_primary_per_merchant_idx` and the primary-domain trigger mean a repair must not blindly insert another primary row. New merchants receive a primary platform subdomain; retries preserve an existing custom/purchased primary and create a missing platform subdomain as secondary.
- `assignHeroImagesToMerchant()` constructs its own cookie-scoped server client. A mobile bearer request supplies no auth cookie, so calling it from `after()` cannot reliably update the new merchant. This refactor removes that call from onboarding; hero assignment can move to a separately authorized job later if it becomes a measured product requirement.

### Deliberately rejected additions

| Addition | Decision | Reason |
|---|---|---|
| New `onboarding_sessions` table/state machine | Reject | Supabase session + merchant existence already encode every critical state needed for routing and retry. |
| PGMQ queue for this refactor | Reject | Template/page-config work is non-critical today, and hero assignment is outside this bearer flow. Introduce durable jobs later only if measured failures require delivery guarantees. |
| Full migration to `Stack.Protected` | Reject | It does not fix the auth/provisioning boundary and would widen the regression surface. Existing layout redirects can remain. |
| New password-preflight API | Reject | It would keep transporting the password through Baci's server. Use Supabase Auth's native password policy and leaked-password protection. |
| `SECURITY DEFINER` provisioning function | Reject | It bypasses RLS and creates authority the authenticated owner does not need. |
| Service-role page-config write | Remove | Existing authenticated page-config INSERT policy and unique key support a caller-scoped upsert. |
| In-place replacement of `/api/mobile-onboarding` | Reject | It would break installed builds. Ship a new authenticated endpoint and retire v1 behind observed traffic/owner approval. |
| Caller-supplied platform root domain | Reject | The RPC is directly executable by authenticated users; platform hostname construction must not be selected by the request. |
| Caller-supplied payout currency or the broad mobile settings-country list as implicit onboarding policy | Reject | Currency is money-setting state and merchant-country support is a product contract. The RPC derives currency from the reviewed supported catalog; UI convenience data confers no backend support. |
| Bearer onboarding calling cookie-bound hero assignment | Reject | It has no mobile auth cookie and is non-critical; remove it from this flow rather than widen authority. |

---

## Target Contracts

### Mobile state machine

```text
register account
  ├─ account exists ───────────────> sign-in action
  ├─ confirmation required ────────> verify OTP ──> complete-profile
  └─ session returned ─────────────> complete-profile

complete-profile
  ├─ slug_unavailable ─────────────> stay on form; edit Store Link
  ├─ retryable failure ────────────> stay authenticated; retry safely
  └─ merchant returned ────────────> invalidate ['merchant'] ──> admin tabs

cold start while authenticated
  ├─ no merchant ──────────────────> complete-profile
  └─ merchant exists ──────────────> admin tabs
```

### Authenticated v2 HTTP request

`POST /api/mobile/merchant-provisioning` accepts only store/profile data:

```ts
interface MobileMerchantProvisioningInput {
  firstName: string;
  lastName: string;
  phone?: string;
  businessName: string;
  businessType: string;
  otherBusinessType?: string;
  country: string;
  slug?: string;
  slugIsCustom: boolean;
  logoUrl?: string;
  brandColors?: {
    primary: string;
    background: string;
    accent: string;
  };
}
```

The Zod object is strict: it rejects `email`, `password`, `confirmPassword`, `userId`, `merchantId`, `signupSource`, `rootDomain`, `payoutCurrency`, and every other unknown property; none may reach SQL. The body and RPC enforce the same documented bounds: names `1..100`, business name `2..200`, business-type values `1..100`, conditional Other text `2..100`, sanitized optional phone at most 32 characters, country from shared `MERCHANT_COUNTRIES`, explicit slug `3..63`, optional URL at most 2,048 characters, and each required brand color as a valid bounded CSS color value (at most 64 characters) through the existing brand-color parser. `businessName` is canonicalized with `normalizeBusinessName` before both RPC invocation and deferred template generation. Boundary and source-contract tests lock Zod, mobile options, SQL country/currency pairs, and SQL bounds together. The endpoint requires a syntactically valid `Authorization: Bearer <token>` before reading cookies or JSON, validates it with `supabase.auth.getUser()`, rejects cookie-only authentication, validates the body, and accepts only `X-Baci-Platform: ios|android`. The platform header becomes `p_signup_source`, but it is untrusted telemetry and never participates in authorization. The route then calls one RPC, schedules only non-critical work after RPC success, and returns:

```ts
type MobileMerchantProvisioningResponse =
  | {
      success: true;
      merchant: { id: string; slug: string };
      created: boolean;
    }
  | {
      error: string;
      code:
        | 'unauthorized'
        | 'invalid_input'
        | 'identity_incomplete'
        | 'slug_unavailable'
        | 'provisioning_failed';
    };
```

### Transactional RPC

Create the versioned function `public.provision_mobile_merchant_v2(...) RETURNS TABLE (merchant_id uuid, merchant_slug text, created boolean)` with these invariants:

- `SECURITY INVOKER` with `SET search_path = ''`.
- `REVOKE ALL ... FROM PUBLIC, anon`; `GRANT EXECUTE ... TO authenticated` only.
- Obtain the owner from `auth.uid()` and email from the authenticated JWT. Accept neither as parameters.
- Reject a missing authenticated identity or email before any write. Use stable `PT422` for an authenticated identity that cannot supply the merchant email; the route maps it to `identity_incomplete` without accepting an email override.
- Accept only an ISO-2 country in shared `MERCHANT_COUNTRIES`. Pin the identical reviewed ISO-2-to-ISO-4217 mapping in the migration, derive `merchants.payout_currency` inside the function, and reject unsupported countries with `PT400`. Accept no country name, fallback currency, or caller-selected payout-currency parameter. A source contract test must fail if the shared catalog, web adapter, or SQL mapping diverges.
- Own `usebaci.com` as a migration-pinned platform-root constant and construct `<slug>.usebaci.com` internally. Accept no root/domain/hostname parameter. Add a source contract test that fails if this constant drifts from `DEFAULT_ROOT_DOMAIN`.
- Normalize and validate every bounded input again inside the directly executable RPC; route validation is ergonomics, not the database trust boundary. Validate the explicit slug through the repository's database truth, including DNS length, reserved values, active merchants, and retired aliases.
- On an untouched/automatic slug, perform bounded, DNS-safe write attempts until one succeeds. Never expose a hidden row/alias lookup as authority.
- If a merchant already exists for `auth.uid()`, preserve every established non-empty slug, update allowed profile fields, and repair missing domain/staff rows.
- Concurrent calls for the same user converge on the same merchant via the unique `merchants.user_id` constraint.
- For a newly inserted merchant, create exactly one active primary platform subdomain and exactly one active owner staff record in the same transaction.
- Reconcile the owner profile against both exact staff arbiters: `staff_members_user_id_merchant_id_key` and `staff_members_merchant_id_email_key`. Update the row already owned by `auth.uid()`; otherwise claim a canonical-email row only when it has no `user_id` and is `pending` or `removed`, clearing invitation fields and activating it as the owner. If that email belongs to a different non-null identity, fail closed and roll back; never overwrite or promote it. Concurrent same-user attempts must converge through the same rules.
- For an existing/retried merchant, preserve a custom or purchased primary domain. Repair a missing `<established-slug>.usebaci.com` row as active and make it primary only when the merchant has no primary domain; otherwise keep it secondary. Never let the existing primary-domain trigger demote a merchant's chosen custom domain during repair.
- Accept a server-validated `p_signup_source` from the explicit platform header, limited to `ios|android`; never accept it in the public JSON body and never use it for authorization.
- For caught `unique_violation`, read both `CONSTRAINT_NAME` and `MESSAGE_TEXT` with `GET STACKED DIAGNOSTICS`. Recognize only the exact current merchant-user, merchant-slug, normalized-domain, primary-domain, `staff_members_merchant_id_email_key`, and `staff_members_user_id_merchant_id_key` arbiters plus the trigger messages `slug_too_long`, `slug_is_reserved`, and `slug_is_retired_alias`; re-raise every other `23505`. Map reserved, retired, or live explicit-slug collisions to stable `PT409`. Treat explicit format/length failures as stable `PT400`/`invalid_input`; automatic candidates remain bounded and retryable. A foreign owner-staff identity collision is a provisioning failure, never a slug or account-exists error. Because a mapped error leaves the function, the entire PostgREST transaction rolls back.
- Unexpected failures propagate as errors; do not catch-and-continue critical writes.
- Return only merchant id, merchant slug, and whether this invocation created the merchant.

### Versioned compatibility contract

- `/api/mobile-onboarding` remains v1 while installed builds use server-owned signup. It may create an auth account, but after it has a caller-scoped session it invokes the same `provision_mobile_merchant_v2` helper rather than duplicating merchant/domain/staff writes.
- `/api/mobile/merchant-provisioning` is v2 and always rejects missing bearer auth before reading JSON.
- Both routes use caller-scoped page-config upsert and neither route constructs an admin/service-role client.
- Structured logs and a PostHog event distinguish `contract: 'v1_legacy'` from `contract: 'v2_authenticated'` without logging email, password, token, business data, phone, slug, or raw body. Capture is best-effort and never fails signup; a capture failure is a telemetry-gap warning that invalidates the retirement window.
- V1 retirement is a later, explicit task after the v2 native build is live and either the PostHog health/query contract proves zero v1 attempts for seven consecutive complete days with every daily canary present and no capture/deployment/query gap, or the owner approves a hard cutoff. The existing update modal is supporting evidence, not the sole gate, because old code defers it on auth routes.

---

## Task 0: Rebase the Work Safely and Verify External Auth Policy

**Files:**

- Preserve: all currently modified/untracked files in `/Users/mac/Baci-app/.worktrees/mobile-admin-registration-fields-recovered`
- Inspect: `apps/mobile-admin/lib/supabase.ts`
- Inspect: `apps/mobile-admin/lib/auth/sign-up-with-password.ts`
- Inspect: `apps/mobile-admin/components/auth/register/*`
- Inspect: `apps/web/src/app/api/mobile-onboarding/*`
- Inspect: `apps/mobile-admin/components/updates/mobile-update-route-safety.ts`
- Inspect: `apps/web/src/app/api/mobile/release-policy/route.ts`
- Inspect: `supabase/config.toml` (local reference only; not live-project evidence)
- Inspect: `apps/web/src/lib/posthog/server.ts`
- Inspect: `apps/web/src/lib/posthog/web-vitals-health.ts`
- Inspect: `supabase/migrations/*`

- [ ] Record the current branch, commit, dirty paths, and latest remote main. At the Revision 4 receipt, the branch is `codex/mobile-admin-registration-fields` at `22c19343a2228bc47ab82f803f9ca5f10c6310d3`, the working tree contains the approved signup/coming-soon changes, and freshly fetched `origin/main` is `5b26d07938e1ac4f58679cd6110bd613a5bad0e7` while this checkout is behind it. Fetch again immediately before rebasing; do not assume this receipt remains current.
- [ ] Create a patch/commit boundary for only the approved current UX fixes before rebasing; do not stash, clean, reset, or discard any path.
- [ ] Fetch and rebase onto the then-current `origin/main`. Re-open the current mobile-onboarding route and migration tail after the rebase because production migrations were already ahead of the original sparse base during research.
- [ ] Confirm in the Supabase Dashboard that Auth password strength matches Baci's UI rules and leaked-password protection is enabled. This is a stop gate: if leaked-password protection is unavailable or disabled, obtain owner approval to enable it before deleting Baci's server-side `checkPasswordBreach` call. Do not create a password-preflight endpoint as a workaround.
- [ ] Confirm the target project's live CAPTCHA/bot-protection setting in the Supabase Dashboard. Local `supabase/config.toml` currently disables CAPTCHA, but is not live evidence. If CAPTCHA is enabled, stop this plan before native account creation and produce a separately reviewed native challenge/token design that supplies `options.captchaToken`; do not disable the live control or ship tokenless `signUp` to make the refactor pass.
- [ ] Confirm email-confirmation behavior in the target project. Record whether new accounts return a session or require the existing OTP path; both paths remain supported.
- [ ] Confirm production PostHog ingest plus server query credentials are healthy and the scheduled `/api/cron/web-vitals-health` run is executing daily. If the project cannot durably query contract events or retain telemetry-gap deployment logs for at least the retirement window, Phase A may still ship but Task 7 remains blocked unless the owner explicitly approves a hard cutoff.
- [ ] Record the currently live iOS/Android admin builds and the release-policy configuration. Establish a baseline count for legacy `/api/mobile-onboarding` signup requests before changing either route; do not infer zero legacy use from the update gate because auth routes deliberately defer its modal.
- [ ] Run the existing focused baseline tests before refactoring:

```bash
pnpm --filter baci-mobile-admin exec vitest run \
  __tests__/auth/register.test.tsx \
  components/auth/register/RegisterAccountStep.test.tsx \
  components/auth/register/RegisterBusinessStep.test.tsx \
  hooks/useRegistration.test.tsx

pnpm --filter @baci/web exec vitest run \
  src/app/api/mobile-onboarding/route.test.ts \
  src/app/api/mobile-onboarding/route-failure-paths.test.ts \
  src/app/api/mobile-onboarding/run-deferred-onboarding-provisioning.test.ts
```

- [ ] Commit only the preserved pre-refactor UX baseline if it is not already committed:

```bash
git add \
  apps/mobile-admin/__tests__/auth/register.test.tsx \
  apps/mobile-admin/__tests__/auth/register-screen-test-harness.tsx \
  apps/mobile-admin/__tests__/admin-route-layout.test.tsx \
  apps/mobile-admin/__tests__/root-route-layout.test.tsx \
  apps/mobile-admin/app/\(admin\)/_layout.test.tsx \
  apps/mobile-admin/app/\(auth\)/register.tsx \
  apps/mobile-admin/app/_layout.test.tsx \
  apps/mobile-admin/components/auth/register/RegisterAccountStep.tsx \
  apps/mobile-admin/components/auth/register/RegisterAccountStep.test.tsx \
  apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx \
  apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx \
  apps/mobile-admin/components/auth/register/register.styles.ts \
  apps/mobile-admin/hooks/useRegistration.ts \
  apps/mobile-admin/hooks/useRegistration.test.tsx \
  apps/mobile-admin/scripts/expo-router-app-tree.test.ts \
  apps/web/src/app/api/mobile-onboarding/route.ts \
  apps/web/src/app/api/mobile-onboarding/route.test.ts \
  apps/web/src/app/api/mobile-onboarding/route-failure-paths.test.ts \
  apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.ts \
  apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.test.ts \
  apps/web/src/components/storefront/store-not-published.tsx \
  apps/web/src/components/storefront/store-not-published.module.css \
  apps/web/src/components/storefront/store-not-published.test.tsx
git commit -m "fix: stabilize mobile registration ux and launch recovery"
```

## Task 1: Add the Atomic Owner-Scoped Provisioning RPC

**Files:**

- Create: `packages/shared/src/constants/merchant-countries.ts`
- Create: `packages/shared/src/constants/merchant-countries.test.ts`
- Modify: `packages/shared/src/constants/index.ts`
- Modify: `apps/web/src/lib/countries.ts`
- Modify: `apps/web/src/lib/countries.test.ts`
- Create: `supabase/migrations/*_provision_mobile_merchant_v2.sql` using the generated path from `pnpm exec supabase migration new provision_mobile_merchant_v2`
- Create: `supabase/migrations/tests/provision_mobile_merchant_v2.sql`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/expected-pending-sources.test-support.ts`
- Modify: `apps/web/src/types/supabase.ts` only through the repository's approved type-generation flow after replay succeeds
- Test: `apps/web/src/lib/mobile-merchant-provisioning-migration.test.ts`
- Test: `apps/web/src/lib/mobile-merchant-country-contract.test.ts`
- Test: `apps/web/src/lib/mobile-root-domain-contract.test.ts`
- Extend: `apps/web/src/lib/merchant-signup-policy-health-migration.test.ts`
- Create: `apps/web/tools/db/run-mobile-merchant-provisioning-concurrency.ts`
- Create: `apps/web/tools/db/run-mobile-merchant-provisioning-concurrency.test.ts`
- Replace the health function only inside the new append-only provisioning migration; never edit `20260726110000_add_merchant_signup_policy_health_rpc.sql`

- [ ] Create `MERCHANT_COUNTRIES` in `@baci/shared` from the current web-supported onboarding catalog, with unique uppercase ISO-2 codes, valid ISO-4217 currencies, and stable display metadata. Make `apps/web/src/lib/countries.ts` a compatibility adapter over that catalog so existing web imports retain their behavior. Do not replace or broaden `apps/mobile-admin/constants/countries.ts`: that wider list also serves phone entry, store settings, and formatting and is not merchant-onboarding policy.
- [ ] Write `apps/web/src/lib/mobile-merchant-provisioning-migration.test.ts` first. It must read the generated migration and fail until the SQL contains the versioned function name, invoker mode, empty search path, authenticated-only grant, `auth.uid()` identity, stable `PT400`/`PT409`, the exact cross-layer input bounds, diagnostics for both constraint name and message text, bounded auto-slug loop, pinned platform root, pinned supported-country/currency mapping, custom-primary preservation, explicit owner-staff reconciliation, and merchant/domain/staff writes.
- [ ] Write `apps/web/src/lib/mobile-merchant-country-contract.test.ts` first. It must parse the country/currency mapping declared by the migration and compare it exactly with shared `MERCHANT_COUNTRIES`, then prove the web compatibility adapter exposes the same supported codes. A supported-country change must update the shared catalog and SQL trust boundary together in one reviewed change; a caller may never supply payout currency.
- [ ] Write `apps/web/src/lib/mobile-root-domain-contract.test.ts` first. It must compare the root-domain literal declared by the migration with `DEFAULT_ROOT_DOMAIN`; a platform-domain change must update both contracts in one reviewed change.
- [ ] Extend the policy-health migration contract so production health verifies the RPC exists with `prosecdef = false`, is executable by `authenticated`, is not executable by `anon`/`PUBLIC`, and the required merchant/domain/staff policies still exist. Add the health-RPC change in a new append-only migration.
- [ ] Generate, then implement, the provisioning migration. The same new migration uses `CREATE OR REPLACE FUNCTION public.get_merchant_signup_policy_health()` to append the new invariants while preserving its current bounded `anon` execution contract used by the CRON_SECRET-protected route. Keep normalization in SQL aligned with the existing `generate_slug` and reserved/alias constraints; do not clone a shorter TypeScript-only reserved list. Normalize the ISO-2 country, reject every code outside the pinned catalog with `PT400`, and derive payout currency from that catalog with no USD fallback or `p_payout_currency` argument.
- [ ] Structure the function so a caught unique violation rolls back its inner block before deciding whether it was a concurrent same-user retry or a true slug conflict. A same-user race re-selects and repairs the now-existing merchant; an explicit foreign slug collision raises `PT409`; an automatic collision advances to the next bounded candidate.
- [ ] Inspect both `CONSTRAINT_NAME` and `MESSAGE_TEXT` with `GET STACKED DIAGNOSTICS` inside every caught `unique_violation`. Handle only the exact named `merchants_user_id_key`, `idx_merchants_slug`, `domains_active_normalized_domain_uidx`, `domains_one_primary_per_merchant_idx`, `staff_members_merchant_id_email_key`, and `staff_members_user_id_merchant_id_key`, plus the exact trigger messages `slug_too_long`, `slug_is_reserved`, and `slug_is_retired_alias`. Re-raise every unrelated `23505` so schema drift, an invitation-token collision, a foreign active staff identity, or a future constraint cannot be misreported as a slug conflict.
- [ ] Ensure retries do not rename an established merchant. Updating first/last-name-derived staff fields, phone, business data, logo, brand colors, country, and payout currency is allowed; rewriting a non-empty merchant slug is not.
- [ ] Reconcile the owner staff row without a blind upsert. Update the same `(auth.uid(), merchant_id)` row when present. Otherwise, a canonical-email row may be claimed only if `user_id IS NULL` and status is `pending` or `removed`; clear its invitation token/expiry, set `accepted_at`, and activate it as `admin`. A same-email row owned by a different non-null user is an integrity failure that rolls back the transaction. Coordinate both unique arbiters so concurrent same-user calls converge without overwriting another identity.
- [ ] Implement domain creation with the active normalized-domain unique index and primary-domain partial unique index as the arbiters. A new merchant gets the platform subdomain as primary. An existing merchant with a custom/purchased primary keeps it; a missing platform subdomain is inserted as secondary. Do not invoke the trigger in a way that demotes the established primary.
- [ ] Write the guarded SQL suite in `supabase/migrations/tests/provision_mobile_merchant_v2.sql`. Run every non-concurrency case in a transaction with `ON_ERROR_STOP` and rollback fixtures:

  - first authenticated call creates one merchant, one matching active primary domain, and one active admin/owner staff row;
  - the same call repeated returns the same merchant and keeps cardinality at one;
  - an explicit slug already owned or retired by another merchant returns `PT409` and leaves zero new critical rows for the caller;
  - an explicit reserved slug and a live-slug unique-index collision each return `PT409`, while explicit invalid format or over-63 length returns `PT400`; all map to public codes without exposing trigger/constraint details;
  - an automatic candidate hitting `slug_too_long`, `slug_is_reserved`, a live merchant, or a retired alias advances through the bounded generator instead of returning account-exists or a generic provisioning error;
  - an automatic collision receives a suffixed resolvable slug;
  - an established slug is unchanged on profile retry;
  - a missing legacy domain or owner staff record is repaired;
  - a merchant with a custom/purchased primary keeps that primary while a missing platform subdomain is repaired as secondary;
  - an RPC caller cannot choose the root domain, full domain, signup owner, email, merchant id, role, or publication status;
  - an authenticated JWT without an email returns `PT422` before any write;
  - every shared supported country persists its exact mapped payout currency, an unsupported country returns `PT400` before any write, and the function exposes no payout-currency argument;
  - anon execution is denied;
  - one authenticated user cannot provision or mutate another user's merchant;
  - a forced dependent-row failure rolls back the merchant insert;
  - each named arbiter has a semantic test: an explicit platform-domain collision maps to `PT409`, while same-user merchant/primary-domain/owner-staff races converge or repair; a pending/removed same-email row with no user is safely claimed, a same-email row owned by another user fails closed, an unrelated invitation-token collision re-raises, and none is mislabeled as account-exists;
  - `p_signup_source` rejects every value outside `ios|android` and never participates in authorization.

- [ ] Write the two-session concurrency harness instead of claiming concurrency from two sequential calls in one SQL transaction. Use two direct PostgreSQL sessions with `SET LOCAL ROLE authenticated` and isolated request-JWT claims for the same test identity. Session A invokes the function and holds its transaction open; session B invokes it and blocks on the unique arbiter; the harness commits A, then proves B returns the same merchant without `PT409` and cardinalities remain one. Use process/marker coordination, not timing sleeps.

- [ ] Run the migration contract and guarded PostgreSQL test against a disposable/local database with the full current migration history:

```bash
pnpm --filter @baci/shared exec vitest run \
  src/constants/merchant-countries.test.ts

pnpm --filter @baci/web exec vitest run \
  src/lib/countries.test.ts \
  src/lib/mobile-merchant-provisioning-migration.test.ts \
  src/lib/mobile-merchant-country-contract.test.ts \
  src/lib/mobile-root-domain-contract.test.ts \
  src/lib/merchant-signup-policy-health-migration.test.ts \
  tools/db/run-mobile-merchant-provisioning-concurrency.test.ts \
  tools/db/supabase-history-replay-sources.test.ts \
  tools/db/supabase-history-replay-manifest.test.ts

psql "$LOCAL_DATABASE_URL" -X -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/provision_mobile_merchant_v2.sql

LOCAL_DATABASE_URL="$LOCAL_DATABASE_URL" \
  pnpm --filter @baci/web exec tsx \
  tools/db/run-mobile-merchant-provisioning-concurrency.ts
```

- [ ] Update both replay registries with the exact new migration hashes, run both replay modes, and regenerate checked-in types only after replay succeeds:

```bash
pnpm --filter @baci/web db:replay:chronological
pnpm --filter @baci/web db:replay:production-effect
```

- [ ] Treat replay/type generation as an abort gate. If either replay fails on historical SQL, preserve the evidence and stop; do not edit an existing migration, accept broad generated-type drift, or continue to endpoint work without explicit authorization.

- [ ] Run Supabase security/performance advisors after applying the migration to the validation database. Resolve new function-grant, RLS, mutable-search-path, or missing-index findings before continuing.
- [ ] Commit:

```bash
git add \
  packages/shared/src/constants/merchant-countries.ts \
  packages/shared/src/constants/merchant-countries.test.ts \
  packages/shared/src/constants/index.ts \
  apps/web/src/lib/countries.ts \
  apps/web/src/lib/countries.test.ts \
  supabase/migrations/<generated>_provision_mobile_merchant_v2.sql \
  supabase/migrations/tests/provision_mobile_merchant_v2.sql \
  apps/web/tools/db/supabase-history-replay-sources.ts \
  apps/web/tools/db/expected-pending-sources.test-support.ts \
  apps/web/tools/db/run-mobile-merchant-provisioning-concurrency.ts \
  apps/web/tools/db/run-mobile-merchant-provisioning-concurrency.test.ts \
  apps/web/src/lib/mobile-merchant-provisioning-migration.test.ts \
  apps/web/src/lib/mobile-merchant-country-contract.test.ts \
  apps/web/src/lib/mobile-root-domain-contract.test.ts \
  apps/web/src/lib/merchant-signup-policy-health-migration.test.ts \
  apps/web/src/types/supabase.ts
git commit -m "feat: provision mobile merchants atomically"
```

## Task 2: Add v2 Without Breaking the Installed v1 Contract

**Files:**

- Create: `apps/web/src/schemas/mobile-merchant-provisioning.ts`
- Create: `apps/web/src/schemas/mobile-merchant-provisioning.test.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/route.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/route.test.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/get-mobile-bearer-user.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/get-mobile-bearer-user.test.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/provision-authenticated-merchant.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/provision-authenticated-merchant.test.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/run-deferred-merchant-provisioning.ts`
- Create: `apps/web/src/app/api/mobile/merchant-provisioning/run-deferred-merchant-provisioning.test.ts`
- Create: `apps/web/src/app/api/mobile-onboarding/legacy-mobile-signup.ts`
- Create: `apps/web/src/app/api/mobile-onboarding/legacy-mobile-signup.test.ts`
- Create: `apps/web/src/lib/posthog/mobile-onboarding-contract-telemetry.ts`
- Create: `apps/web/src/lib/posthog/mobile-onboarding-contract-telemetry.test.ts`
- Modify: `apps/web/src/app/api/mobile-onboarding/route.ts`
- Modify: `apps/web/src/app/api/mobile-onboarding/route.test.ts`
- Modify: `apps/web/src/app/api/mobile-onboarding/route-failure-paths.test.ts`
- Delete after callers migrate: `apps/web/src/app/api/mobile-onboarding/run-deferred-onboarding-provisioning.ts`
- Delete after callers migrate: `apps/web/src/app/api/mobile-onboarding/run-deferred-onboarding-provisioning.test.ts`
- Delete after usages reach zero: `apps/web/src/app/api/mobile-onboarding/provision-merchant-domain.ts`
- Delete after usages reach zero: `apps/web/src/app/api/mobile-onboarding/provision-merchant-domain.test.ts`
- Delete after usages reach zero: `apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.ts`
- Delete after usages reach zero: `apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.test.ts`

- [ ] Write v2 route regressions first. They must prove:

  - a missing/invalid bearer token returns `{ code: 'unauthorized' }` with 401 before `req.json()` or Zod parsing, and a valid web cookie without a bearer token is still 401;
  - valid auth plus invalid store data returns `{ code: 'invalid_input' }` with 400;
  - the strict schema rejects `password`, `confirmPassword`, `email`, `userId`, `merchantId`, `rootDomain`, `signupSource`, and arbitrary unknown keys rather than silently stripping them;
  - the strict schema also rejects `payoutCurrency`; every shared supported country reaches RPC by canonical ISO-2 code, while a country present only in the broad mobile settings list fails before RPC;
  - every lower and upper input boundary passes, every over-limit value fails before RPC, and brand colors are bounded values accepted by the existing parser rather than raw JSON text;
  - a missing, repeated, mixed-case, comma-joined, `web`, or otherwise invalid `X-Baci-Platform` returns `invalid_input`; exact `ios` and `android` each call `provision_mobile_merchant_v2` once as `p_signup_source` with profile/store fields and no caller-selected identity/domain fields;
  - `PT422` maps to `{ code: 'identity_incomplete' }` with 422;
  - `PT409` maps to `{ code: 'slug_unavailable' }` with 409;
  - `PT400` maps to `{ code: 'invalid_input' }` with 400 without exposing SQL text;
  - unexpected RPC errors return `{ code: 'provisioning_failed' }` with 500 and keep Postgres code/stage in structured server logs without request secrets;
  - the route never calls `auth.signUp`, `checkPasswordBreach`, `createAdminClient`, direct merchant/domain/staff mutations, or slug preflight;
  - successful response includes only the merchant result and `created` flag, not session tokens.

- [ ] Extract the Zod contract into `mobile-merchant-provisioning.ts` with `.strict()`. Model `brandColors` as an object instead of a JSON string. Enforce the Target Contract's exact size bounds, refine `otherBusinessType` only when `businessType === 'other'`, validate country through shared `MERCHANT_COUNTRIES`, reuse the existing brand-color parser, and apply the exact existing `normalizeBusinessName` helper before any downstream use. Keep the SQL migration, supported-country map, and schema boundary tests locked to the same values.
- [ ] Implement `get-mobile-bearer-user.ts` as a route-specific strict helper: require exactly one non-empty `Bearer` credential, construct a no-persistence Supabase client with that token, and verify with `auth.getUser()`. Do not reuse `getAuthenticatedUser()` unchanged because that helper deliberately falls back to web cookies. The v2 route authenticates first, parses/validates second, validates exact `X-Baci-Platform: ios|android`, calls the typed helper, schedules deferred template work, and returns the stable response below 300 lines. Bearer requests already bypass the existing proxy's origin-CSRF check; do not modify `proxy.ts`.
- [ ] Make `provision-authenticated-merchant.ts` the one web adapter for `provision_mobile_merchant_v2`. Both v1 and v2 pass a caller-scoped client and a verified user; the adapter never accepts a user id, email, domain, or role from JSON.
- [ ] Preserve `/api/mobile-onboarding` as v1. Extract only its anonymous Supabase signup, breach check, email-confirmation result, explicit-slug preflight, and session/client handoff into `legacy-mobile-signup.ts`; keep focused compatibility tests for old password-bearing payloads. Once v1 has a scoped user session, route all merchant/domain/staff work through the shared v2 adapter and delete the old direct-write/collision/domain-repair branches.
- [ ] Add `mobile-onboarding-contract-telemetry.ts` around the existing `captureServerEvent`. V1 schedules one best-effort `mobile_onboarding_contract_invoked` event at public route entry; v2 authenticates first as required for a protected route, then schedules exactly one event before header/body validation or provisioning. Include only `contract: 'v1_legacy'|'v2_authenticated'` and the repository's existing release/deployment context. Never include email, password, token, business data, phone, slug, request headers, or raw body. A capture returning `false` emits the stable structured warning `mobile_onboarding_contract_telemetry_gap`; it never changes the signup response. Tests prove v1 invalid/account-exists attempts and authenticated v2 invalid attempts are counted, unauthorized v2 calls perform no work beyond auth, success and failure do not double-count, and neither event nor log shapes contain forbidden fields.
- [ ] Change deferred home creation for both routes from `createAdminClient().from('page_configs').insert(...)` to the same authenticated client and an idempotent upsert on `merchant_id,page_slug`. Both v1 and v2 must pass the already-normalized business name to the RPC adapter and deferred generator. Add a regression with leading, trailing, and repeated whitespace proving `merchants.business_name`, generated header/store name, and generated hero title use the same canonical value. Preserve the designed unpublished/coming-soon page as the safe visible fallback when template generation fails.
- [ ] Remove domain repair from deferred work because domain creation is now transactional. Remove `assignHeroImagesToMerchant` from this flow because it creates a cookie-scoped client that has no mobile bearer identity. Deferred onboarding now performs only idempotent template generation/page-config upsert; hero assignment is explicitly outside this refactor.
- [ ] Keep v1 password breach checking until v1 retirement. The Supabase leaked-password Dashboard gate protects v2 native signup; do not weaken either path during coexistence.
- [ ] Run focused tests:

```bash
pnpm --filter @baci/web exec vitest run \
  src/schemas/mobile-merchant-provisioning.test.ts \
  src/app/api/mobile/merchant-provisioning/route.test.ts \
  src/app/api/mobile/merchant-provisioning/get-mobile-bearer-user.test.ts \
  src/app/api/mobile/merchant-provisioning/provision-authenticated-merchant.test.ts \
  src/app/api/mobile/merchant-provisioning/run-deferred-merchant-provisioning.test.ts \
  src/app/api/mobile-onboarding/legacy-mobile-signup.test.ts \
  src/app/api/mobile-onboarding/route.test.ts \
  src/app/api/mobile-onboarding/route-failure-paths.test.ts \
  src/lib/posthog/mobile-onboarding-contract-telemetry.test.ts
```

- [ ] Commit:

```bash
git add \
  apps/web/src/app/api/mobile/merchant-provisioning/route.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/route.test.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/get-mobile-bearer-user.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/get-mobile-bearer-user.test.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/provision-authenticated-merchant.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/provision-authenticated-merchant.test.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/run-deferred-merchant-provisioning.ts \
  apps/web/src/app/api/mobile/merchant-provisioning/run-deferred-merchant-provisioning.test.ts \
  apps/web/src/app/api/mobile-onboarding/legacy-mobile-signup.ts \
  apps/web/src/app/api/mobile-onboarding/legacy-mobile-signup.test.ts \
  apps/web/src/app/api/mobile-onboarding/route.ts \
  apps/web/src/app/api/mobile-onboarding/route.test.ts \
  apps/web/src/app/api/mobile-onboarding/route-failure-paths.test.ts \
  apps/web/src/app/api/mobile-onboarding/run-deferred-onboarding-provisioning.ts \
  apps/web/src/app/api/mobile-onboarding/run-deferred-onboarding-provisioning.test.ts \
  apps/web/src/app/api/mobile-onboarding/provision-merchant-domain.ts \
  apps/web/src/app/api/mobile-onboarding/provision-merchant-domain.test.ts \
  apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.ts \
  apps/web/src/app/api/mobile-onboarding/build-numbered-slug-candidate.test.ts \
  apps/web/src/lib/posthog/mobile-onboarding-contract-telemetry.ts \
  apps/web/src/lib/posthog/mobile-onboarding-contract-telemetry.test.ts \
  apps/web/src/schemas/mobile-merchant-provisioning.ts \
  apps/web/src/schemas/mobile-merchant-provisioning.test.ts
git commit -m "feat: add authenticated mobile merchant provisioning v2"
```

## Task 3: Make Registration Create the Native Session Exactly Once

**Files:**

- Modify: `apps/mobile-admin/app/(auth)/register.tsx`
- Modify: `apps/mobile-admin/__tests__/auth/register.test.tsx`
- Modify: `apps/mobile-admin/__tests__/auth/register-screen-test-harness.tsx`
- Modify: `apps/mobile-admin/lib/auth/sign-up-with-password.ts`
- Modify: `apps/mobile-admin/lib/auth/sign-up-with-password.test.ts`
- Modify: `apps/mobile-admin/stores/auth-store.ts`
- Modify: `apps/mobile-admin/stores/auth-store.test.ts`
- Modify: `apps/mobile-admin/hooks/useAuth.ts`
- Modify: `apps/mobile-admin/app/(auth)/staff-signup.tsx` only if required to preserve its account-only call signature
- Modify: `apps/mobile-admin/app/(auth)/staff-signup.test.tsx` only if its call signature changes
- Preserve: `apps/mobile-admin/components/auth/register/RegisterAccountStep.tsx`
- Preserve: `apps/mobile-admin/components/auth/register/RegisterAccountStep.test.tsx`

- [ ] Write registration regressions first:

  - tapping Next with valid account fields calls `useAuth().signUp({ email, password, firstName, lastName, fullName })` exactly once;
  - auth metadata contains sentence-cased `first_name`, `last_name`, and `full_name` so authenticated store setup does not need to reconstruct names from an untrusted email;
  - it does not call `/api/mobile-onboarding` or `/api/mobile/merchant-provisioning` and never performs `signIn` after successful signup;
  - a returned session routes to `/(auth)/complete-profile`;
  - confirmation required routes to `/(auth)/verify?email=...`;
  - an existing account displays a sign-in action and does not claim the store URL caused the conflict;
  - a rate-limit/connectivity/auth error stays on the account screen with the specific auth message;
  - unmount immediately after the awaited signup cannot erase the session committed by the auth store;
  - a prior user's persisted `['merchant', priorUserId]` cache is cleared before the signup action resolves, so the new identity cannot flash or inherit the old admin route;
  - first and last names retain the approved sentence-case editing behavior and iOS AutoFill semantics.

- [ ] Do not begin native `signUp` implementation unless Task 0 recorded CAPTCHA disabled for the target project or a separately approved native CAPTCHA/token design has been incorporated into this plan. A tokenless test double is not evidence that production signup will work.
- [ ] Simplify `register.tsx` to the account stage only and keep it below 300 lines. The business stage becomes the authenticated `complete-profile` route, so no password is retained or copied into business-form state.
- [ ] Update the account-only helper's misleading comment: direct Supabase signup is the shared account primitive for merchant and staff registration; only the caller decides whether authenticated merchant provisioning follows. Preserve the invariant that no `auth.users` trigger auto-creates a merchant.
- [ ] Preserve the helper's typed outcomes (`accountExists`, `needsEmailConfirmation`, and error), anti-enumeration handling, Zustand session commit, auth telemetry, and the single global auth listener. Make the user-store reset callback explicitly async and await it before the signup action resolves; add a regression around the actual persisted TanStack/MMKV cache rather than only mocking navigation.
- [ ] Keep staff signup account-only. Updating the shared auth signature must not cause `staff-signup.tsx` to call either merchant-provisioning endpoint or create an owned merchant before invite acceptance.
- [ ] Do not change the existing Supabase client persistence/refresh configuration; it already matches current React Native guidance (`persistSession`, `autoRefreshToken`, `processLock`, foreground refresh lifecycle).
- [ ] Run focused tests:

```bash
pnpm --filter baci-mobile-admin exec vitest run \
  __tests__/auth/register.test.tsx \
  components/auth/register/RegisterAccountStep.test.tsx \
  lib/auth/sign-up-with-password.test.ts \
  stores/auth-store.test.ts \
  app/\(auth\)/staff-signup.test.tsx
```

- [ ] Commit:

```bash
git add apps/mobile-admin/app/\(auth\)/register.tsx \
  apps/mobile-admin/__tests__/auth/register.test.tsx \
  apps/mobile-admin/__tests__/auth/register-screen-test-harness.tsx \
  apps/mobile-admin/lib/auth/sign-up-with-password.ts \
  apps/mobile-admin/lib/auth/sign-up-with-password.test.ts \
  apps/mobile-admin/stores/auth-store.ts \
  apps/mobile-admin/stores/auth-store.test.ts \
  apps/mobile-admin/hooks/useAuth.ts
git commit -m "refactor: let mobile own signup sessions"
```

## Task 4: Consolidate Authenticated Store Setup

**Files:**

- Create: `apps/mobile-admin/hooks/useMerchantProvisioning.ts`
- Create: `apps/mobile-admin/hooks/useMerchantProvisioning.test.tsx`
- Reuse: `apps/mobile-admin/config/runtime-platform.ts`
- Modify if needed for a typed header helper: `apps/mobile-admin/config/runtime-platform.test.ts`
- Delete after callers migrate: `apps/mobile-admin/hooks/useRegistration.ts`
- Delete after callers migrate: `apps/mobile-admin/hooks/useRegistration.test.tsx`
- Create: `apps/mobile-admin/lib/merchant-provisioning-error.ts`
- Create: `apps/mobile-admin/lib/merchant-provisioning-error.test.ts`
- Modify: `apps/mobile-admin/app/(auth)/complete-profile.tsx`
- Modify: `apps/mobile-admin/app/(auth)/complete-profile.test.tsx`
- Delete after moving unique assertions: `apps/mobile-admin/__tests__/auth/complete-profile.test.tsx`
- Create: `apps/mobile-admin/components/auth/register/MerchantSetupForm.tsx`
- Create: `apps/mobile-admin/components/auth/register/MerchantSetupForm.test.tsx`
- Create: `apps/mobile-admin/components/auth/register/PersonNameFields.tsx`
- Create: `apps/mobile-admin/components/auth/register/PersonNameFields.test.tsx`
- Modify: `apps/mobile-admin/components/auth/register/RegisterAccountStep.tsx`
- Modify: `apps/mobile-admin/components/auth/register/RegisterAccountStep.test.tsx`
- Reuse/Modify: `apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx`
- Reuse/Modify: `apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx`
- Reuse/Modify: `apps/mobile-admin/components/auth/register/register.styles.ts`

- [ ] Write hook tests first. The mutation must:

  - send an authenticated request to `/api/mobile/merchant-provisioning` and never call the v1 endpoint;
  - exclude email, password, confirmPassword, user id, merchant id, signup source, and root/domain fields;
  - set exactly one `X-Baci-Platform` header from `getRuntimePlatform()` and reject any runtime other than `ios|android` locally before making the request; do not add `Platform.OS` directly in the hook;
  - send `brandColors` as an object;
  - parse the stable server code from `NetworkError.data` through `merchant-provisioning-error.ts`, preserving `slug_unavailable`, `identity_incomplete`, and retryable/general failures without classifying any of them as account-exists;
  - use `retry: false` because the explicit screen action and idempotent RPC own retry semantics;
  - invalidate and await the exact current-user cache key `queryClient.invalidateQueries({ queryKey: ['merchant', user.id], refetchType: 'active' })` after success.

- [ ] Extract reusable `PersonNameFields` from `RegisterAccountStep` and use the same sentence-case, iOS AutoFill, accessibility, validation, and first/last-name contract in authenticated setup. This is required for Google/Apple users whose metadata is missing or partial; do not assume every no-merchant identity came through password registration.
- [ ] Extract form state/validation into `MerchantSetupForm.tsx` so `complete-profile.tsx` falls below 300 lines. Do not create a second business visual implementation: reuse `RegisterBusinessStep` for business name, business type, “Please specify,” country picker, Store Link, logo, and brand colors.
- [ ] Preserve the approved display rules: business name title-cases each word while editing; “Please specify” appears above Country/Region only when Other is selected; country uses the searchable/list picker; custom slug stays exact and auto slug remains a de-dupable preference. The merchant-setup picker must render shared `MERCHANT_COUNTRIES`, not the broader `apps/mobile-admin/constants/countries.ts`, and its tests must prove every visible choice is accepted by the v2 contract with the same ISO-2 code/currency pair. Keep the broader list for existing store-settings, phone, and display consumers.
- [ ] Prefill first/last name and logo from authenticated metadata (`first_name`/`last_name`, then `full_name`/`name` fallback), but keep name fields editable and required. Email may be displayed read-only for context, but it is not API form state and is never submitted. An authenticated identity with no JWT email surfaces `identity_incomplete` and a sign-out/re-auth action; never accept a body email override.
- [ ] Submit with `await provisionMerchant.mutateAsync(payload)`. On `slug_unavailable`, remain on the form and focus/identify Store Link. On `identity_incomplete`, remain authenticated long enough to show the explicit re-auth action. On other failures, stay on the form with the stable server message. On success, await invalidation/refetch of the exact active user-scoped merchant query before `router.replace('/(admin)/(tabs)')`; test that replacement occurs after the invalidation promise resolves, not merely after it is scheduled. The auth layout remains the durable fallback if that refetch later fails.
- [ ] Test password signup metadata, Google/Apple identity with complete metadata, social identity with missing names, authenticated identity with missing email, successful store creation, exact slug conflict, transient retry, Other-field ordering, country selection, title-casing, exact cache refetch, and forbidden-payload exclusion.
- [ ] Run focused tests:

```bash
pnpm --filter baci-mobile-admin exec vitest run \
  hooks/useMerchantProvisioning.test.tsx \
  config/runtime-platform.test.ts \
  lib/merchant-provisioning-error.test.ts \
  app/\(auth\)/complete-profile.test.tsx \
  components/auth/register/PersonNameFields.test.tsx \
  components/auth/register/MerchantSetupForm.test.tsx \
  components/auth/register/RegisterAccountStep.test.tsx \
  components/auth/register/RegisterBusinessStep.test.tsx
```

- [ ] Commit:

```bash
git add \
  apps/mobile-admin/hooks/useMerchantProvisioning.ts \
  apps/mobile-admin/hooks/useMerchantProvisioning.test.tsx \
  apps/mobile-admin/config/runtime-platform.ts \
  apps/mobile-admin/config/runtime-platform.test.ts \
  apps/mobile-admin/hooks/useRegistration.ts \
  apps/mobile-admin/hooks/useRegistration.test.tsx \
  apps/mobile-admin/lib/merchant-provisioning-error.ts \
  apps/mobile-admin/lib/merchant-provisioning-error.test.ts \
  apps/mobile-admin/app/\(auth\)/complete-profile.tsx \
  apps/mobile-admin/app/\(auth\)/complete-profile.test.tsx \
  apps/mobile-admin/__tests__/auth/complete-profile.test.tsx \
  apps/mobile-admin/components/auth/register/MerchantSetupForm.tsx \
  apps/mobile-admin/components/auth/register/MerchantSetupForm.test.tsx \
  apps/mobile-admin/components/auth/register/PersonNameFields.tsx \
  apps/mobile-admin/components/auth/register/PersonNameFields.test.tsx \
  apps/mobile-admin/components/auth/register/RegisterAccountStep.tsx \
  apps/mobile-admin/components/auth/register/RegisterAccountStep.test.tsx \
  apps/mobile-admin/components/auth/register/RegisterBusinessStep.tsx \
  apps/mobile-admin/components/auth/register/RegisterBusinessStep.test.tsx \
  apps/mobile-admin/components/auth/register/register.styles.ts
git commit -m "refactor: consolidate authenticated merchant setup"
```

## Task 5: Make Verification and Cold-Start Routing Explicit

**Files:**

- Modify: `apps/mobile-admin/app/(auth)/verify.tsx`
- Modify: `apps/mobile-admin/app/(auth)/verify.test.tsx`
- Modify: `apps/mobile-admin/app/(auth)/_layout.tsx`
- Modify: `apps/mobile-admin/__tests__/auth/_layout.test.tsx`
- Modify: `apps/mobile-admin/stores/auth-store.ts`
- Modify: `apps/mobile-admin/stores/auth-store.test.ts`
- Create: `apps/mobile-admin/lib/auth/verify-signup-otp.ts`
- Create: `apps/mobile-admin/lib/auth/verify-signup-otp.test.ts`
- Modify if needed: `apps/mobile-admin/scripts/expo-router-app-tree.test.ts`

- [ ] Write verification regressions first:

  - successful signup OTP returns an authenticated Supabase session, commits that exact session/user to the auth store, awaits the cross-user cache reset when the identity changes, and only then replaces the route with `/(auth)/complete-profile`;
  - an ostensibly successful response without both session and user is treated as verification incomplete and does not navigate;
  - the success button says “Continue setup,” not “Enter Dashboard” before a merchant exists;
  - invalid and expired OTPs remain on verification with actionable messages;
  - resend remains signup-scoped and rate-limit safe.

- [ ] Extract `verify-signup-otp.ts` and expose it through one `verifySignupOtp` auth-store action. Call Supabase with `type: 'signup'` only, validate the returned session/user, commit them with the same awaited reset semantics as password/social sign-in, and return a typed result to the screen. Do not fall back to the generic `email` OTP type or rely on listener timing; the one global listener remains an idempotent synchronizer for later auth events.
- [ ] Replace `router.dismissAll()` with `router.replace('/(auth)/complete-profile')` only after the awaited `verifySignupOtp` action succeeds. The auth layout remains the cold-start fallback, not the only immediate navigation mechanism.
- [ ] Add layout regressions for all durable states using the user-scoped merchant key: signed out → auth stack; authenticated/no merchant → complete-profile; authenticated/merchant → admin tabs; merchant query failure → retryable error state; verification and complete-profile are not prematurely redirected; Google/Apple user without a merchant → complete-profile; pending staff invite still resumes after auth completion. Assert that stale cache data from a different user id cannot select admin tabs.
- [ ] Keep the existing route tree. Do not introduce a full `Stack.Protected` conversion in this refactor.
- [ ] Run focused tests:

```bash
pnpm --filter baci-mobile-admin exec vitest run \
  app/\(auth\)/verify.test.tsx \
  __tests__/auth/_layout.test.tsx \
  lib/auth/verify-signup-otp.test.ts \
  stores/auth-store.test.ts \
  scripts/expo-router-app-tree.test.ts
```

- [ ] Commit:

```bash
git add apps/mobile-admin/app/\(auth\)/verify.tsx \
  apps/mobile-admin/app/\(auth\)/verify.test.tsx \
  apps/mobile-admin/app/\(auth\)/_layout.tsx \
  apps/mobile-admin/__tests__/auth/_layout.test.tsx \
  apps/mobile-admin/stores/auth-store.ts \
  apps/mobile-admin/stores/auth-store.test.ts \
  apps/mobile-admin/lib/auth/verify-signup-otp.ts \
  apps/mobile-admin/lib/auth/verify-signup-otp.test.ts \
  apps/mobile-admin/scripts/expo-router-app-tree.test.ts
git commit -m "fix: resume merchant setup after email verification"
```

## Task 6: Ship the Dual-Contract Cutover and Validate End to End

**Files:**

- Modify: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-log.ts`
- Modify: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-log.test.ts`
- Modify: `apps/web/src/app/api/cron/merchant-signup-health/route.ts`
- Modify: `apps/web/src/app/api/cron/merchant-signup-health/route.test.ts`
- Create: `apps/web/src/lib/posthog/mobile-onboarding-contract-health-query.ts`
- Create: `apps/web/src/lib/posthog/mobile-onboarding-contract-health.ts`
- Create: `apps/web/src/lib/posthog/mobile-onboarding-contract-health.test.ts`
- Create: `apps/web/src/schemas/mobile-onboarding-contract-health.ts`
- Create: `apps/web/src/schemas/mobile-onboarding-contract-health.test.ts`
- Modify: `apps/web/src/app/api/cron/web-vitals-health/route.ts`
- Modify: `apps/web/src/app/api/cron/web-vitals-health/route.test.ts`
- Modify: `apps/mobile-admin/components/updates/mobile-update-check.test.ts`
- Preserve and validate: `apps/web/src/components/storefront/store-not-published.tsx`
- Preserve and validate: `apps/web/src/components/storefront/store-not-published.module.css`
- Preserve and validate: `apps/web/src/components/storefront/store-not-published.test.tsx`

- [ ] Preserve the complete v1 response contract, including its account-created recovery fields, while installed builds remain supported. The new mobile build must contain no v1 recovery branch, but the server may not delete or reinterpret those fields during Phase A.
- [ ] Keep structured health logging for RPC/RLS deployment faults. Update the cron health assertion to include the new v2 RPC contract and required grants, not just the merchant INSERT/RETURNING policy. Preserve the current CRON_SECRET route plus `anon` health-RPC grant; do not widen the provisioning RPC grant.
- [ ] Add a bounded HogQL query/helper for both `mobile_onboarding_contract_invoked` and `mobile_onboarding_contract_telemetry_canary`, grouped by UTC calendar day and contract/event for the last eight complete days. Parse the response with a dedicated strict Zod schema. Reuse the scheduled, CRON_SECRET-protected `/api/cron/web-vitals-health` run to query this contract health and then emit one canary through the same server capture path. Preserve the existing web-vitals result while returning/logging the onboarding result separately; a missing query credential, non-2xx/malformed response, missing daily canary, capture failure, or deployment gap is `unavailable`, never evidence of zero traffic.
- [ ] Persist each daily health result in the existing retained operational log/release evidence, with stable tags for `checked`, `legacy_detected`, and `telemetry_gap`; no user or business identifiers are allowed. Before starting the seven-day clock, record one controlled v1 and one v2 smoke invocation and prove both appear in the query. The clock starts on the next complete UTC day, counts only seven contiguous complete days with the expected canary and healthy query/deployment coverage, and resets to zero on any v1 attempt or telemetry gap.
- [ ] Verify the coming-soon page remains independent of AI generation and renders the approved design for an unpublished newly created merchant.
- [ ] Prove deployment ordering in a validation environment: apply the append-only migration first; deploy the dual-route web server second; exercise both the old v1 payload and the new authenticated v2 payload; only then distribute/install the new iOS build. If v1 compatibility or v2 health fails, stop before the native rollout.
- [ ] Run the Task 6 telemetry/health regressions, all focused suites from Tasks 1–5, then the mandatory repository gates:

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/posthog/mobile-onboarding-contract-health.test.ts \
  src/schemas/mobile-onboarding-contract-health.test.ts \
  src/app/api/cron/web-vitals-health/route.test.ts \
  src/app/api/cron/merchant-signup-health/route.test.ts \
  src/app/api/mobile-onboarding/onboarding-failure-log.test.ts

pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --agent -t uncommitted
```

- [ ] Fix every applicable critical/high CodeRabbit finding and rerun affected tests plus the three broad gates. Do not claim a green suite from focused tests alone.
- [ ] With explicit approval for the target backend and test identities, test on the physical iPhone over Wi-Fi using the repository's mobile-admin Metro/dev-client path already established for this session. Do not open a simulator. Stream Metro and server logs, record the app build plus backend SHA, and execute this deterministic E2E matrix:

  1. New email, session returned: account → business setup → admin home without a login screen.
  2. New email, confirmation required: account → OTP → business setup → admin home.
  3. Existing email: specific account-exists/sign-in action; no store-link message.
  4. Explicit taken slug such as the known test collision: remain on business setup with “store URL unavailable”; no duplicate/partial merchant.
  5. Automatic taken slug: receive a suffixed URL and reach admin home.
  6. Kill the app after account creation but before business setup: reopen directly on complete-profile.
  7. Kill the app after provisioning response but before navigation: reopen directly in admin.
  8. Repeat Launch Store: stay authenticated; no redirect to merchant login.
  9. Load the new unpublished storefront URL: approved coming-soon page renders.
  10. Google/Apple authenticated user with missing name metadata: editable first/last-name fields appear and provisioning completes without accepting a body email.
  11. Create a merchant in a supported non-default market such as Ghana: the picker submits `GH`, provisioning stores `country = 'GH'` and `payout_currency = 'GHS'`, and no client field can override that currency.

- [ ] Query the approved validation database after the controlled test identities and prove one merchant, one active primary domain, one platform-subdomain row, and one owner staff row per completed tester; no partial rows for the explicit slug-conflict tester. Prove each test merchant's country has the exact server-derived payout currency, and prove the non-default-country case explicitly. For a merchant with an existing custom primary, prove the platform subdomain is secondary. Delete only newly created, explicitly recorded test fixtures after separate owner confirmation; never delete Claire or broadly match on “test.”
- [ ] Release the new native build only after the exact web/database head passes the gates. Record v1 versus v2 contract counts from the secret-free PostHog query and store the query interval/status with the release evidence. The mobile minimum-build policy may support adoption but cannot substitute for the route-traffic gate because its prompt is deferred on auth routes.
- [ ] Commit only verification-driven source/test changes that were not already committed; inspect `git diff --name-only` and stage exact paths instead of broad directories.

## Task 7: Retire v1 Only After the Compatibility Gate

**Files (conditional; do not touch during initial v2 implementation):**

- Delete: `apps/web/src/app/api/mobile-onboarding/route.ts` and its route-only tests/helpers after all non-route callers are checked
- Delete if then unused: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-response.ts`
- Delete if then unused: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-response.test.ts`
- Delete if then unused: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-log.ts`
- Delete if then unused: `apps/web/src/app/api/mobile-onboarding/onboarding-failure-log.test.ts`
- Preserve: `apps/web/src/lib/password-breach.ts` and `apps/web/src/lib/password-breach.test.ts` because web signup and security settings still use them
- Modify: route inventories, contract tests, and documentation that explicitly list v1

- [ ] Start this task only when the v2 native build is confirmed live and secret-free server telemetry shows zero successful or attempted v1 signup calls for seven consecutive full days, or the owner explicitly approves a hard cutoff with the affected installed-build evidence recorded. A minimum-build setting alone does not satisfy this gate.
- [ ] For the measured path, attach the seven daily query results and canary/gap status to the retirement record. Any missing day, non-`ok` query status, missing canary, `mobile_onboarding_contract_telemetry_gap`, deploy interval without the instrumented route, or v1 count greater than zero resets the contiguous window; ordinary application logs or a zero-result query without those health proofs are insufficient.
- [ ] Re-run a repository-wide reference search before each deletion. Remove the v1 route's `checkPasswordBreach` import/call, but preserve the shared password-breach utility and tests because web signup and security settings still call it.
- [ ] Delete `/api/mobile-onboarding` and its route-only recovery contract atomically. The v2 route remains bearer-only and must not absorb password, anonymous signup, or account-exists behavior.
- [ ] Add a negative contract test proving the retired v1 path is absent/404 and the v2 schema still rejects password/email/identity/domain fields.
- [ ] Re-run focused tests, chronological and production-effect replay checks, full lint/typecheck/test, and CodeRabbit on the exact retirement head.
- [ ] Repeat the physical-iPhone new-account, confirmation-required, explicit-slug-conflict, cold-start, Launch Store, and coming-soon flows against the retirement deployment before declaring the refactor complete.
- [ ] Commit exact retirement paths only after all gates pass:

```bash
git add <exact paths verified by git diff --name-only>
git commit -m "refactor: retire legacy mobile onboarding v1"
```

---

## Phase A Exit Criteria (v2 Live, v1 Preserved)

- The new phone build calls Supabase Auth directly and persists the new session; its v2 web route never receives a password or creates an auth user.
- The target project's live CAPTCHA, password, leaked-password, and email-confirmation policies were recorded; native `signUp` did not proceed past a CAPTCHA-enabled stop gate without an approved token flow.
- There is no post-registration `signIn()` call.
- Merchant, domain, and owner staff provisioning succeed or roll back together under authenticated RLS.
- Owner-staff repair converges on the authenticated user's row, may claim only an unowned pending/removed same-email record, and never overwrites a different active identity.
- Repeating provisioning is safe and returns the same established merchant.
- Slug collisions produce `slug_unavailable`; account-exists errors come only from Supabase Auth and are never inferred from a provisioning failure.
- Email-confirmed users continue to business setup, not a dashboard/login dead end.
- Cold starts recover solely from authenticated session plus merchant existence.
- A new merchant gets a primary `<slug>.usebaci.com`; repair preserves an existing custom/purchased primary and adds the platform subdomain as secondary.
- Password and social-auth users with missing/partial metadata can complete explicit first/last-name fields without submitting identity or domain authority in the body.
- V2 is strict bearer-only, rejects cookie-only requests, validates bounded input at both HTTP and RPC boundaries, and receives `ios|android` only through the explicit telemetry header.
- Mobile merchant setup and web validation use the same supported-country catalog; SQL rejects catalog drift/unsupported codes and derives the exact payout currency without a caller override or USD fallback.
- The v2 route and complete-profile screen are each below 300 lines; duplicated business forms are removed.
- The old v1 payload remains compatible during native adoption, and secret-free queryable contract telemetry distinguishes v1 from v2 while health gaps prevent a false retirement signal.
- No new service-role edge, queue, onboarding table, proxy change, or broad routing rewrite is introduced.
- Chronological and production-effect migration replay, guarded PostgreSQL tests, focused app/API tests, full lint/typecheck/test, CodeRabbit, and physical-iPhone E2E all pass on the exact final head.

## Final Refactor Completion Criteria (After Task 7)

- The measured compatibility gate or documented owner hard-cutoff approval is satisfied before v1 deletion.
- No live mobile signup route accepts a password or creates an auth user; only Supabase Auth owns new-account creation.
- Obsolete v1 account-created recovery fields, server password-breach path, and route-only helpers are removed only when repository-wide usage is zero.
- The v2 transactional, routing, root-domain, country/currency, owner-staff identity, custom-primary, social-profile, error-code, replay, concurrency, health, and physical-iPhone guarantees remain green on the exact retirement head.
