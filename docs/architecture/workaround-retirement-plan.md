# Workaround Retirement Plan — replace edge/app-layer band-aids with source-authoritative architecture

**Status:** proposal (rev 26) · **Created:** 2026-07-11 · **Trigger:** PR #3028 (SEO shell-title fix) revealed a family of workarounds sharing one anti-pattern. · **Verification baseline:** current census artifacts revalidated at `origin/main@6758e4db3f`; live production ACL probe on 2026-07-11.

> **Rev 7** (verified vs `main`): Workstream C's "derive from the Next route manifest" was an unproven contract — added a **C0 feasibility/design gate** (semantic schema + supported source + prebuilt typed artifact + CI drift check); C and B3 are blocked on C0. **Rev 8** (verified vs `main`): (a) the authenticated cutover missed the web **storefront** public reader — `fetchMerchantBySlug` (`queries.ts:211`, via `MerchantProvider`) selects `merchants` directly, and a signed-in shopper runs as `authenticated`, so it must migrate to the snapshot RPC **before** revoking authenticated bridge columns; (b) B2's "async purge" is today fire-and-forget (`after()`, lossy) — a longer fresh TTL needs a **durable** queue, so added a **B2a durability gate**. **Rev 9:** made private merchant RPCs permission-scoped instead of exposing one all-secrets projection to every active staff member, and completed the durable worker's lease/retry/observability contract. **Rev 10:** made the grant cutover exhaustive across every runtime-role direct access (not only `MerchantProvider`), added a public-snapshot compatibility/capability gate, corrected table-level-grant revocation semantics, and aligned B1 authorization with the category mutation. **Rev 11:** expanded B2 from product-row delivery to a complete PDP dependency/outbox contract, made Cloudflare delivery failure-observable/retryable, ordered Next-cache invalidation before edge purge, and accounted for `stale-while-revalidate` in the maximum-staleness budget. **Rev 12:** removed the S2 scheduling contradiction by requiring immediate public-RPC containment or a complete capability fix before non-security work, and moved B1 category changes behind one authoritative mutation boundary so old/new slugs cannot be spoofed or lost. **Rev 13:** corrected the live PDP cache math (`300 + 86400`, not `300 + 3600`), made the TTL decision cover Vercel/Cloudflare/API directives explicitly, and made B3's generated category classification tenant-scoped and invalidatable. **Rev 14:** added an explicit S0 compatibility-risk sign-off and bounded the A1 static-parameter obligation to routes actually approved for prerendering. **Rev 15:** closed the table-vs-column ACL retirement gap: final revocation must remove both relation ACLs and every compatibility `attacl` introduced by S0. **Rev 16:** separated private plan/billing state from public storefront capabilities so S1 and D no longer prescribe incompatible data shapes, and made S2 revoke default `PUBLIC` execution as defense in depth. **Rev 17:** made the durable invalidation substrate shared by B1/B2; category/home documents already have long stale allowances, so B1 can no longer terminate in a lossy post-commit purge. **Rev 18:** synchronized the prose execution sequence with that shared-substrate dependency. **Rev 19:** aligned the compact execution summary with the detailed census-driven S0 grant and relation-plus-column S1 revocation contracts. **Rev 20:** resolved the anon-bank bridge decision with an explicit mandatory-version exit, hoisted the public-capability adapter wholly into S1, added a B0 drainer-runtime feasibility gate, split B1 into shippable best-effort and durable phases, and defined one security-to-A/B implementation gate. **Rev 21:** superseded the proposed standalone S2 containment PR with the owner-approved S2-I+S2-P bundle, aligned the headline with the final B0/A1 artifacts, and added delayed retry scheduling to the outbox contract. **Rev 23:** recorded the first delegated B1-lite decision after PR #3205. **Rev 24:** corrected its SWR math. **Rev 25:** corrected the layered headers, failure path, durable Vercel stage, and authority gate. **Rev 26:** uses the already-allowlisted Vercel tag-deletion primitive in B1-lite after immediate Next expiry; no Cloudflare credential enters the merchant route.

> **Revision history:** rev 1 partly from memory. Rev 2 corrected vs `main` + rewrote the unsafe A2 gate. Rev 3 (live-ACL): exposed RPCs, no safe A1 opener, A1≠A2a, B1 misses the mutation. Rev 4 (live-ACL): `REVOKE ALL` not `REVOKE SELECT`; don't union anon columns; retire direct reads onto the snapshot RPC; S2 guest-checkout has no owner; B3 can cache private routes. Rev 5 (live-ACL): explicit rollout waves (an immediate `REVOKE ALL` breaks shipped binaries selecting bank fields); plan-tier allowlist has **3 copies**. **Rev 6** (live-ACL): (a) column narrowing alone is insufficient — the anon **row** policy is still `USING(true)`, so the same emergency migration must set `USING (is_published = true)` or retained fields leak for unpublished merchants; (b) wave 1 **cannot apply identically to `anon` and `authenticated`** — the web dashboard's authenticated select pulls `nin/bvn/tokens` directly, so the web owner-private RPC refactor must be deployed **before** any authenticated grant change; (c) wave 3 must use **mandatory min-version enforcement** (`/api/mobile/release-policy`), not "proven adoption." All claims code-verified vs `main` except where marked *(live DB probe)*.

> **Discovery artifacts (read-only census + research, 2026-07-11, `docs/architecture/discovery/`):** `web-merchants-census.md`, `mobile-storefront-merchants-census.md`, `mobile-admin-merchants-census.md` (S0/S1 inputs), `B0-drainer-runtime-brief.md`, `C0-route-classification-brief.md`, `A1-route-decision-matrix.md`. Headline outputs: B0 → transactional outbox + best-effort immediate web drain + durable VPS cron sweep through a `CRON_SECRET`-gated Next route (**no new signed listener**); C0 → hybrid route-group-default + co-located `route-class-overrides.ts` generator; A1 → **0 immediate GO**, **1 blocked conditional GO** (global compare hub, after its active-category metadata fallback is removed or made param-only), **5 NO-GO** (category compare hub, flat PDP, category listing, products index, search).

## The unifying principle

A band-aid at the edge or in app code stands in for the real boundary/source of truth. #3028 is the template — it replaced Cloudflare bot-UA sniffing with the correct move (bake the title into the prerendered PPR shell so every client gets it from the shared cache at zero origin cost).

> Make the origin's cache headers, the database, a generated semantic route-classification artifact, and DB-level **role grants** authoritative — and delete the parallel edge/app-layer lists, UA sniffing, and hardcoded allowlists that drift from them.

Ordered by (stakes × inverse-effort). The security items are one queue and come first.

---

## Security lane (implementation first; design-only A1/C0/B0 may proceed while the S2-I+S2-P bundle and S0/S1 advance)

### S0 — `merchants` anon containment bridge + mandatory-version retirement

- **Boundary is the DB grant, not the app.** One public-looking projection is an **inline column list inside `getCachedMerchantById`** (`cached-data.ts:1188`) — *not* a constant and not a security boundary; anon can currently select any column directly. **⚠️ Corrected by the S0/S1 census (2026-07-11): `getCachedMerchantById` is NO LONGER unused** — the repairs work added two anon-runtime callers (`lib/repair-notifications.ts:176`, `lib/repairs/notify-repair-status-change.ts:94`) that read its projection (incl. `paystack_subaccount_code`). So it must be **inventoried as a live anon read** and either migrated to the snapshot RPC or its needed columns kept in the S0-A grant — do not treat it as removable. Full inventory: `docs/architecture/discovery/web-merchants-census.md`.
- **⚠️ `REVOKE ALL`, not `REVOKE SELECT` (rev-4 catch).** Live anon holds more than SELECT — `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` are all granted table-wide; RLS does not make those a sound boundary. Fix is `REVOKE ALL ON TABLE public.merchants FROM anon;` then a **minimal column-level `GRANT SELECT (<cols>)`** only. Live currently has no column ACLs (`pg_attribute.attacl` is empty), but S0 will create them; later `REVOKE ALL ON TABLE` does **not** remove column grants, so the retirement migration must explicitly revoke every compatibility column privilege too. (S1 applies the same table + column ACL discipline to `authenticated`.)
- **⚠️ Also tighten the anon ROW policy, in the SAME emergency migration (rev-6 catch — column narrowing is not enough).** The anon `SELECT` policy is still `USING (true)`, so every column wave 1 *retains* for compatibility (incl. bank/contact fields) is readable for **unpublished/draft** merchants too, not just live storefronts. Replace it with **`USING (is_published = true)`** (`merchants.is_published` exists, baseline `:8899`); unpublished/coming-soon identity must come through `resolve_storefront_public_snapshot_v2` (which already minimizes that case). Tests: (a) published rows still readable by the oldest-build raw query; (b) unpublished rows **not** readable via direct table REST; (c) the snapshot RPC still returns its bounded coming-soon identity.
- **⚠️ Classify per call site by RUNTIME ROLE and per column — do NOT mechanically union (rev-4 catch).** "Union of every anon-key read" (rev-3) conflates the *key* with the *role*: a publishable/anon key uses the **`authenticated`** role after login ([Supabase API-keys](https://supabase.com/docs/guides/getting-started/api-keys)). E.g. `auth-store-initialize.ts` can run under a **restored authenticated session**; `useMerchantReceiptInfo` (`use-receipts.ts:~253`) selects **bank-account fields** and isn't auth-gated. The inventory must record `anon` / `authenticated` / `both` **per call site**, then classify each column **public / owner-only / removable**. The **destination** is no anon bank/receipt fields. Because a shipped storefront binary may still query them as anon, an S0-A compatibility grant may retain only matrix-proven bank/contact fields temporarily; that is a time-bounded residual exposure, not the destination or completion state.
- **Retirement path (the real fix, not the emergency grant):** the newly landed **`resolve_storefront_public_snapshot_v2`** is the intended **bounded public read model** (SECURITY DEFINER, returns only a curated projection). The emergency column grant is a bridge for shipped binaries; the destination is: **inventory and migrate every public read that can execute as `anon` or `authenticated` — browser, native, Server Component, Route Handler, server action, metadata/OG, sitemap/feed, and background path — onto the snapshot or a narrower purpose-built RPC → mandatory minimum-version enforcement → explicitly revoke both relation-level privileges and every S0 column-level compatibility grant.** A grep for `.from('merchants')` is only candidate discovery; the checked-in census must trace each client factory and actual runtime role. Otherwise S0 just creates another permanently-mirrored allowlist — the exact anti-pattern this plan exists to kill.

> **⚠️ Shipped-binary cutover — explicit rollout waves (rev-5/6). An immediate `REVOKE ALL + minimal grant` breaks current binaries** (PostgREST fails the whole query if **any** selected column is denied): mobile-storefront `use-receipts.ts` and mobile-admin `payout-settings.tsx:55` select bank fields; **the web dashboard's authenticated `DASHBOARD_MERCHANT_SELECT` (`hooks/merchant/queries.ts:49`) selects `nin, bvn, *_access_token, ga4_api_secret, stripe_customer_id, bank_account_number`** directly. So wave 1 **cannot apply identically to `anon` and `authenticated`** (rev-6). Two separate tracks:
>
> **Anon track (two explicit phases; S0 is not complete after the bridge):**
> 1. **S0-A compatibility bridge:** freeze a checked-in matrix: oldest supported app version → call site → actual runtime role → exact selected columns → published/unpublished behavior. Security/product owners sign the grant list and the compatibility break that legacy clients lose draft/unpublished identity. Then set `USING (is_published = true)`, `REVOKE ALL`, and grant only that exact projection. Always omit BVN, NIN, access/CAPI tokens, API secrets, FIRS/encrypted credentials, and every unproven column. If the matrix proves an old receipt build needs bank/contact fields as anon, they may remain **only** in this bridge with a named owner, removal app version, deadline, and regression test.
> 2. **S0-B mandatory-version exit:** migrate receipt/bank reads to an authorization-scoped server boundary that returns only the fields required for that order/receipt — authenticated customer/merchant ownership where available, or an unguessable order/receipt capability for guest checkout; never a merchant-id-wide public bank lookup. Ship mobile-storefront/admin releases; then set `/api/mobile/release-policy` to block every older build and prove `MobileUpdateController` runs before **guest and authenticated** affected Supabase queries. Only then revoke the bridge's bank/contact column ACLs. Raw old-build queries must fail, current guest/authenticated receipts must render, and S0 is complete only when no bank field remains selectable by anon.
>
> **Authenticated track (order matters — storefront, dashboard, API, and server-rendered paths break otherwise):**
> 3. **Produce a checked-in direct-access census and deploy the web refactors** (hot-deployable, no client release) — this **precedes any authenticated grant change**. For every web/native `.from('merchants')` candidate, record client factory, runtime role(s), operation, exact columns, owner/staff/public authorization, and replacement; include Server Components, Route Handlers, server actions, metadata/OG, sitemap/feed, cron/background, onboarding, and client hooks. The cutover gate is **zero unclassified anon/authenticated direct accesses**, not merely fixing the known `MerchantProvider` queries. Known high-risk blockers include:
>    - **Dashboard private read** (`DASHBOARD_MERCHANT_SELECT`) → permission-scoped private RPCs. Do **not** replace it with one broad "owner/staff" snapshot: today `fetchDashboardMerchant` loads the full merchant projection for any active staff member *before* resolving effective permissions. Owners may receive the owner projection; staff projections must be split by purpose and guarded with `check_staff_permission` (for example payout/bank → whichever of `settings:view` or `settings:edit` that call actually requires, analytics configuration → the appropriate settings/marketing permission, KYC identity → owner-only unless an explicit role is approved). Raw provider tokens and secrets should remain server-side and return only configured/status booleans unless a client editing flow demonstrably requires the value.
>    - **⚠️ Storefront PUBLIC read** (`fetchMerchantBySlug` → `PUBLIC_MERCHANT_SELECT`, `hooks/merchant/queries.ts:211`, called by `MerchantProvider` at `merchant-provider.tsx:46,252` incl. the reload path, plus the primary-domain follow-up `queries.ts:335`) → `resolve_storefront_public_snapshot_v2`. **A signed-in shopper's browser runs as `authenticated`, so revoking authenticated privileges before migrating this breaks storefront loading.** Test storefront load as **signed-out and signed-in** before revocation.
>    - **S1-CAP — single owner for public capability compatibility (must deploy before `fetchMerchantBySlug` switches):** the RPC is not shape-equivalent to `PUBLIC_MERCHANT_SELECT`. Build one schema-validated adapter; map `resolution_status/custom_domain/feature_settings` plus typed `price_negotiation_enabled` and `paystack_subaccount_configured`; inventory every omitted-field consumer; migrate `CartSidebar`, cart page, and checkout page to the derived negotiation capability; and keep the orders API authoritative by re-deriving entitlement server-side. Move every other omitted field to an explicit public capability or private RPC. **Do not widen the public snapshot with raw plan, bank, sheet, or operational fields for compatibility.** Contract tests cover published, unpublished, not-found, free/paid/invalid/null plan states, guest, signed-in shopper, and server-side order enforcement. This work belongs only to S1; D owns cleanup after it.
>    - **All authenticated web DML:** migrate direct writes before revocation, including `MerchantProvider.updateMerchant` and every onboarding/settings/action/API path found by the census. Use permission-scoped mutation RPCs or authenticated Route Handlers; do not assume only mobile writes depend on table DML.
> 4. **Ship** mobile-admin + mobile-storefront versions that read via the public snapshot plus permission-scoped private RPCs, and write via scoped mutation RPCs/Route Handlers rather than direct table DML. Coordinate this release with S0-B where possible.
> 5. **Apply the same mandatory minimum-version gate used by S0-B** and prove it runs before every affected guest/authenticated query.
> 6. **Then perform an atomic authenticated least-privilege reset:** `REVOKE ALL ON TABLE public.merchants FROM authenticated`, explicitly revoke any column-level privileges found in `pg_attribute.attacl`, then re-grant only residual operation/columns proven necessary by the census (target: none for direct table access). Clean matching row policies and direct-table DML.
> 7. **Test each wave with raw queries from the oldest blocked and current supported builds, under guest and authenticated sessions.**

- **Verify by phase:** after S0-A, matrix-approved bridge queries from the oldest supported build succeed for published merchants while blocked secrets fail and unpublished direct reads return nothing. After S0-B, release policy blocks those old builds before affected queries, raw anon bank selects fail, and current web/mobile receipt, checkout, invoice, and trust flows pass.

### S1 — `merchants` authenticated containment + `SECURITY DEFINER` RPC audit (security lane; coordinate with S0-B)

- **Classify by runtime role.** Live prod has an open `authenticated` predicate for every non-platform-admin row (baseline `:13816`) + table-wide grants ⇒ any logged-in user reads any other merchant's secrets. Least-privilege pass as in S0.
- **⚠️ Live RPC state has moved — updated per fresh probe (rev-4):** column grants do not constrain `SECURITY DEFINER` functions, so audit them, but the state is now:
  - `resolve_storefront_cached_merchant(text)` — **`service_role` only** (the drift is now **reconciled**). Action: keep an **ACL-regression assertion** (a test that asserts it stays service_role-only), not a re-fix.
  - `resolve_storefront_public_snapshot_v2(text)` — **intentionally executable by `anon`, `authenticated`, `service_role`**. This is where `paystack_subaccount_configured` + the negotiation flag actually live (rev-3 wrongly attributed them to the broad resolver). **Focus the projection audit here** — confirm the curated JSON leaks nothing sensitive, since this is the one public-callable definer function.
  - `set_credit_direct_session(p_order_id uuid, p_email text, p_merchant_id uuid, p_session_id text, p_signed_amount numeric)` — **5 args** (rev-4 abbreviated it), still executable by **all three roles** → handled in S2.
- **⚠️ No service-role client for the dashboard read.** Moving dashboard own-row reads to the service-role admin client **violates the repo rule** and bypasses RLS. Use **permission-scoped private RPCs**, narrowly row-scoped RLS where direct access is deliberately retained, or a `merchant_private` split.
- **Private-RPC contract:** every new private read/write RPC must authenticate `auth.uid()`, scope to one merchant, distinguish owner from staff, enforce the exact resource/action permission for each projection or mutation, use `SECURITY DEFINER SET search_path TO ''` with fully-qualified objects, and explicitly revoke default execute grants before granting only the required role. Add negative tests for unrelated users, inactive staff, and active staff lacking each permission; no RPC may return the former `DASHBOARD_MERCHANT_SELECT` wholesale to all active staff.

### S2 — Credit-Direct BNPL: contain now; require a guest-safe capability before re-enable (rev-4/12)

- **Verified:** `set_credit_direct_session(p_order_id uuid, p_email text, p_merchant_id uuid, p_session_id text, p_signed_amount numeric)` is `SECURITY DEFINER` (`migration 20260706171500`), executable by all three roles; caller controls **order id, email, merchant id, session id, and amount**; writes `payment_method`, `payment_status='bnpl_pending'`, notes. A clamp is insufficient — an attacker can still **overwrite the active session** or **force `bnpl_pending`**.
- **⚠️ "Ownership check" is not implementable here.** `credit-direct/sign/route.ts:78` is a **deliberately unauthenticated guest-checkout** path — it calls the RPC via `createClient(cookieStore)`, which for a guest runs as **anon** (no `auth.uid()` owner to validate). Revoking anon execution breaks guests; keeping it leaves session-replacement callable. **Server-derived amount alone does not protect `p_session_id`.**
- **S2-I — drafted containment leg; never ship standalone:** a fresh live probe finds **one enabled merchant**, so this is a deliberate provider outage and requires payment/operations owner approval plus a support/merchant communication plan. Fold this migration and its verification into the S2-P permanent-capability PR per the owner decision below. In one DB migration transaction, set every enabled `credit_direct_enabled` flag false and `REVOKE EXECUTE ON FUNCTION public.set_credit_direct_session(uuid,text,uuid,text,numeric) FROM PUBLIC, anon, authenticated`. The deployment runbook then invalidates feature/public-snapshot/storefront caches and confirms the checkout option disappears; stale UI is still fail-closed because the sign route/RPC cannot initialize a new session. Feature-flag-only containment is insufficient because the RPC itself does not check the flag. Verify the sign route is closed, direct PostgREST calls fail for anon/authenticated, service-role/webhook reconciliation for already-started sessions remains safe, and no rollback/re-enable is permitted without S2-P.
- **S2-P — permanent design required only before Credit Direct is re-enabled:** implement either a **guest-safe, single-use checkout capability** — an unguessable server-issued token stored hashed and atomically consumed, bound to `{order, merchant, server-derived amount, expiry, session}` — or a narrow **server-only mutation boundary** explicitly approved under repo policy (the sign route is the only caller and public execute remains revoked). The database locks the order, derives amount/merchant/email, validates current payability and feature enablement, prevents active-session replacement except through an explicit retry transition, uses `SET search_path TO ''` with qualified objects, and records replay-safe audit state. Tests cover guessed/replayed/expired/cross-order capabilities, concurrent attempts, cancelled/already-paid orders, retry/supersession, and webhook reconciliation.

**OWNER DECISION (2026-07-11): hold S2-I and ship it bundled with S2-P** (do not apply the standalone containment now). S2-I migration + verification are drafted on branch `security/s2i-disable-credit-direct` (`supabase/migrations/20260711174128_...sql`), ready to fold into the S2-P PR. Accepted residual until that bundle ships: `set_credit_direct_session` stays anon/authenticated-callable, so an attacker can grief `ogabassey`'s BNPL sessions (overwrite active session / force `bnpl_pending`) — but *amount* tampering is already neutralized webhook-side (#2962) and only `ogabassey` is enabled, so this is single-tenant griefing, not a money hole. Consequence for the A/B gate below: "Credit Direct contained" is now satisfied only when the S2-I+S2-P bundle ships (not earlier), so the non-security implementation gate depends on that bundle.

**One A/B implementation gate:** A1/C0/B0 **design and investigation only** may run in parallel with S0/S1. No non-security A/B/D implementation PR may merge until (a) S0-B has removed anon bank/contact bridge ACLs, (b) S1 has completed the authenticated ACL/RPC cutover, and (c) Credit Direct remains disabled with public execution revoked or S2-P has shipped. S2-P is not otherwise a blocker while the provider stays disabled.

---

## Workstream A — Finish the metadata architecture (the direct sibling of #3028)

### A1 — Per-route decision matrix (there is NO safe implementation opener; design may run in parallel with the security lane)

**Corrected inventory: 6 catalog routes in this retirement scope** (the blog family already has a static-tenant `searchParams`-free carve-out — `(blog)/blog/page.tsx:12-38`). **Every one of the 6 uses request-time behavior in `generateMetadata` that must have an explicit replacement before it can be made shell-resolvable** — none is a free quick win. For any route approved for prerendering, add a bounded `generateStaticParams` contract sourced from the same static-tenant/catalog authority as the existing nested PDP implementation; define parameter cardinality/build-time limits and preserve a deliberate dynamic fallback. Routes explicitly kept dynamic (likely search and the flat redirect PDP) do **not** add static params merely to satisfy this inventory.

| Route | Request-time behavior to preserve | Replacement decision (unresolved) |
|---|---|---|
| `[category]/compare` | Calls **`notFound()` inside `generateMetadata`** (verified, `page.tsx:132`, with a comment at `:125` on the exact blocking-vs-streaming-200 trade-off) so empty hubs return a **real 404 before the body commits 200** | A static shell commits 200 first → empty hubs soft-404. Needs edge-level existence check or stays dynamic. |
| flat PDP `products/[productSlug]` | Body issues a real **308** variant-cleanup/legacy redirect; metadata awaits `searchParams` for the noindex safety-net | Static shell commits 200 → 308 degrades to soft meta-refresh. Likely **exclude from A1** (redirect route, ~0 title value). |
| `[category]` | Per-page titles, self-referencing **paginated canonical**, `getIndexableRobotsMetadata(searchParams)` noindex for facets (`page.tsx:~171`) | Page/facet are request-time; no cached source supplies them. Choose: rel-canonical-to-root, path-segment pagination, or stay dynamic. |
| `products` (index) | Page-specific title, canonical, bounds check, filtered-page robots — all from `searchParams` | Same pagination/facet decision as `[category]`. |
| `compare` (global hub) | Noindexes query variants; sometimes delegates to category metadata | Needs an explicit canonical/robots rule without `searchParams`. |
| `search` | Title + canonical derived from `q`; also `await headers()` in metadata | Query-derived metadata can't be prerendered; likely **stays dynamic + noindex** (already noindex). |

Next.js confirms runtime `searchParams` **defer** metadata and that a streamed error **cannot change an already-committed 200** ([generateMetadata](https://nextjs.org/docs/app/api-reference/functions/generate-metadata), [streaming/loading](https://nextjs.org/docs/app/api-reference/file-conventions/loading)). **A1 = fill this matrix first**; code only the routes whose lost behavior has a signed-off replacement.

### A2 — Retire the edge apparatus (⚠️ NOT unlocked by A1 — rev-3 catch)

- **A1 changes metadata only.** Nothing in A1 makes streamed **listing/grid body** content fully rendered for non-JS crawlers (it streams as Flight chunks). The apparatus — `getStorefrontForwardedBotUserAgent` (`config/storefront-metadata-cache-bots.ts:~95`, applied in `buildProxyRequestHeaders`, `proxy.ts:~166`) — exists to give those bots a **full blocking body render** instead of the raw `application/x-nextjs-pre-render` envelope (its comment cites the 2026-07-07 "4,404 compare pages couldn't be crawled" incident). So:
- **A2a — delete cache-bucket partitioning** (`STOREFRONT_METADATA_CACHE_BUCKET_HEADER`, `__baci_metadata_cache_bucket`, `setStorefrontMetadataCacheBucketSearchParam` + 3 call sites `proxy.ts:3770/4055/4345`, bucket Vary token, strip in `product-page-resolution.ts:73`). **Gate: a full-body bot-rendering/cache strategy exists** — not merely A1. Keep `rsc, next-router-*` Vary tokens.
- **A2b — retire `htmlLimitedBots` + the UA annotation + the hand-mirrored built-in bot lists** (`NEXT_BUILTIN_*_BOT_USER_AGENT_REGEX`). **Global blast radius:** `htmlLimitedBots` also governs `(platform)` routes and non-enumerated tenants that have **no shell**. Decide explicitly (likely **keep the annotation permanently** and document it) — do not shrink the regex first.
- **⚠️ A2a/A2b verification — test BOTH cache-priming orders (rev-3):** `purge → human MISS → bot HIT` **and** `purge → bot MISS → human HIT`; assert `CF-Cache-Status`, `Age`, `Vary`, content-type, **head, and body** each time. Sequential-UA curls without controlling which client primes the shared key miss the exact regression A2a risks.

### A3 — RSC pre-render envelope: Vercel escalation (parallel/external). Keep `bypass_nextjs_rsc_prefetch_requests` until Vercel explains why the envelope egresses on a canonical URL with a cacheable 200.

---

## Workstream B — Cloudflare purge coverage & TTL

> Product + blog purge remain best-effort fire-and-forget legacy paths. B1-lite deliberately does not copy that credential-bearing pattern into a new merchant route; durability, category edge eviction, and any TTL expansion remain gated on B0.

### B0 — Complete the adopted durable-invalidation ADR exit checklist

**Verified current hosting state (`origin/main@cff335b0fd`):** `vercel.json` has one daily observability cron (`/api/cron/web-vitals-health`, `0 4 * * *`) but no queue drainer; no migration installs `cron.schedule()`; Vercel Functions are request-scoped; and the existing `payment_side_effects` precedent is claimed/drained inline by payment processing with manual reconciliation, not by a general lease worker. Its claim-token, stale-takeover, attempts, and service-role-only ACL pattern is reusable, but its table is order-specific (`order_id`/`transaction_id` FKs + fixed payment-step enum), so direct table reuse is not assumed.

`docs/architecture/adr/B0-durable-cache-invalidation-substrate.md` already adopts the VPS cron →
`CRON_SECRET`-gated web-route runtime. Do not repeat runtime selection. Complete its sign-off and
prototype checklist, amended to prove three ordered stages: Next tag/path invalidation, confirmed
Vercel CDN tag deletion for the exact affected storefront documents, then strict Cloudflare purge.

**Privileged-edge gate:** the proposed drainer claims service-role-only outbox RPCs and reaches CDN
credentials from a new cron Route Handler. No existing temporary authority exception transfers to
that route. Before implementation, obtain explicit owner/security approval for the exact route,
RPCs, credential imports, and boundary-manifest change. This plan does not authorize widening
`manifest.authority.*`. Detached `after()`/`void` execution remains non-durable. Until B0 exits,
no durable-worker estimate or TTL increase is schedulable.

### B1 — Category mutation reaches Next invalidation now, then joins the durable substrate

- Editing `revalidateCategories` (`lib/cache-revalidation.ts:167`, currently `revalidateTag` only) is necessary but **not sufficient**: mobile-admin `hooks/useProducts.ts:242` inserts directly into `categories` and only invalidates React Query; it never invokes web revalidation.
- **Authorization contract first:** category INSERT RLS is owner-only, while `/api/cache/revalidate` requires `settings:edit`. Choose one category-management permission (owner-only or an explicit `products` action) and enforce it identically at mutation/revalidation boundaries. Do not grant `settings:edit` merely to make purge work.
- **B1-lite (independent of B0, strict improvement):** route mobile category create/rename/deactivate/delete through a narrow authenticated Route Handler using the shared Bearer-token client; authenticate first, validate with Zod, derive merchant identity server-side, reject cross-merchant ids, capture authoritative old/new slugs, execute the mutation, and call `revalidateCategories`. Keep current cache directives unchanged. Test owner success, denied staff, rollback, old+new slug invalidation, and assert that the category route's import graph cannot reach credential authority. Do **not** add Cloudflare credentials to the handler or widen `manifest.authority.*`; strict edge eviction belongs in B1-durable.

  **STATUS — mutation boundary shipped; edge-freshness acceptance remains open (PR #3205).** The premise was verified accurate: mobile-admin
  `hooks/useProducts.ts:242` did insert straight into `categories` and only called
  `queryClient.invalidateQueries(['categories'])`, so category creation never reached web
  revalidation or the edge. What shipped:
  - `POST /api/merchant/categories` + `PATCH`/`DELETE /api/merchant/categories/[id]`, on the
    shared Bearer-capable client (`getAuthenticatedUser`, which also serves web cookies).
    CSRF is already Bearer-exempt (`lib/csrf.ts:147`).
  - **Permission contract resolved: owner-only.** `categories_merchant_insert/update/delete`
    are RLS-scoped to `merchants.user_id = auth.uid()` with no staff branch, so owner-only is
    the only option needing no RLS widening and unable to diverge from the DB. Widening to a
    `products` action later means changing `isCategoryManager` AND the three policies together.
  - `revalidateCategories()` hard-expires navigation/home/category tags and **both** the old and
    new slug on a rename; product-derived category data is hard-expired too. #3207 then awaits
    Vercel deletion of the tenant `ps:`/`ph:` response tags already carried by storefront HTML.
    The graph reaches no `env.ts` credential authority. Cache directives are unchanged.
  - **No Cloudflare purge shipped.** Canonical category documents use layered storefront-document
    headers: Vercel 300/86400 and downstream Cloudflare 3600/86400/86400. Cloudflare reported
    `DYNAMIC`, but Vercel reported `HIT` for a browser request. A retained browser object may be
    served stale during the full SWR allowance; if tag revalidation fails after commit, the origin
    also falls back to its natural Next cache window. No applicable already-allowlisted category
    Cloudflare credential surface was found. The lower-level Vercel primitive is compatible and
    is now used; `/api/cache/revalidate` still has a different `settings:edit` contract, and no
    durable cron/drainer exists yet.
  - Mobile `createCategory` migrated off the direct insert onto the handler.

  **Decision correction (rev 26):** both delegated falsifiers occurred. #3207 uses the compatible
  Vercel primitive now; it does not widen credential authority. Prioritize B0/B1-durable ahead of
  unrelated D cleanup for transactional intent, retries, and Cloudflare coverage.

  **Residual:** only *create* had a caller. `PATCH`/`DELETE` exist but are so far unused —
  rename/deactivate/delete have no UI in any app. Production shows the table is edited
  out-of-band (67 rows / 6 merchants, 65 updated in 90 days) and **nothing in the repo writes
  it apart from the mobile create path**, so those direct edits remain invisible to the cache
  until they move onto this API. B1-durable must close that producer gap.
- **B1-durable (blocked on B0):** use a database trigger for semantic invalidation intent, or make migration plus enforcement of every out-of-band writer an acceptance prerequisite; an RPC-only design cannot claim durable coverage while direct SQL/dashboard edits remain. The B0 drainer hard-expires Next category/navigation/home data, then confirms Vercel deletion of the exact category-dependent HTML tags (use the existing tenant publication tags or add and test a dedicated category response tag), then obtains strict Cloudflare acknowledgement. It may not mark completion if any stage fails. Test no-intent-on-rollback, direct/out-of-band edits, tag-expiry failure, stale-origin refill prevention, Vercel deletion failure, lease recovery, replay, tombstones, and dead-letter recovery.

### B2 — Complete PDP durable coverage before changing any cache directive

Cache-tag/prefix purge are **CF Enterprise-only** (this zone is non-Enterprise, 30-URL batches, `lib/cloudflare-purge.ts:~19`). Current PDP HTML is `cacheable-self-healing`: Vercel receives `max-age=300, stale-while-revalidate=86400`; Cloudflare receives `max-age=300, stale-while-revalidate=86400, stale-if-error=86400`. Raising Cloudflare freshness to `3600` while retaining the 86,400-second stale directives permits roughly 25 hours of stale serving after a dropped purge/origin failure. Define a maximum-staleness budget, then set `Vercel-CDN-Cache-Control`, downstream `CDN-Cache-Control`, and in-scope product API `STOREFRONT_CACHE` directives deliberately.

After B0 selects/proves the runtime, B2 must:

1. Census every PDP-rendered dependency and producer: products, variants/media/attributes, category joins/slugs, inventory/price/status, approved reviews/ratings, merchant currency/settings/capabilities, bulk/import, checkout-stock, and agentic mutations.
2. Write semantic intents in the same transaction as each mutation, capturing merchant/product ids, generation, and old/new paths; never accept absolute URLs from clients. Add reconciliation for any uncovered legacy path and keep current directives until coverage is complete.
3. Resolve active hostnames server-side at delivery; retain old+new host/path data for rename/domain moves. Use generation-aware idempotency so a completed purge never suppresses a later mutation of the same path.
4. Hard-expire relevant Next tags/paths first, confirm Vercel deletion for the affected Data/Runtime/CDN response tags second, then purge Cloudflare. Persist/repeat all three stages safely so an outer-edge MISS cannot refill from a stale inner layer.
5. Replace `purgeCloudflareUrls(): Promise<void>` as the acknowledgement primitive with a strict internal result that treats missing config, timeouts, non-2xx, HTTP `200` + `success:false`, partial failures, and `429/Retry-After` as retryable. Keep the fail-open wrapper only for legacy callers.
6. Implement the B0-selected lease/claim, batching, backoff, attempts, dead-letter, RLS/service-only completion, queue-age/error/latency metrics, and alerts inside the chosen freshness budget.
7. Test transaction rollback, dependency changes, concurrent claims, crashes between each of the Next/Vercel/Cloudflare stages, stale-origin refill prevention, Vercel deletion failure, replay, later-generation re-enqueue, partial/429 failures, old+new paths, delete tombstones, domain rename, bulk load, and dead-letter replay.
8. Raise TTL/directives only after staging/production telemetry proves the SLO, every producer is covered, and reconciliation/dead-letter operations work. Then update the stale comments in `config/storefront-cache.ts` and `storefront-cdn-cache-control.ts`.

### B3 — Derive the 27-segment "cache-everything" category allowlist from the DB — but subtract reserved routes first (rev-4 catch)

- Deriving `cacheableCategorySegments` (`config/storefront-cache.ts:20`, single hardcoded merchant) directly from `categories.is_active` is **unsafe**: a merchant can have an active category slug like `receipts`, `my-account`, or `order-success` that collides with a **private single-segment route**, making the proxy classify it cacheable → private-page cache exposure.
- **B3 must subtract every reserved first segment and test collision cases.** It must consume the **full typed route-classification artifact produced by C0/C** (not only the private-route view): private, public-no-store, redirect-only, and public-cacheable app-route names are all unavailable as dynamic category roots. B3 is therefore blocked on C0/C, not independent (rev-3 mislabeled it so).
- **Tenant scope is part of the cache key:** generate/lookup category segments per canonical merchant id/slug and active hostname set; never use a global union across merchants. A category active for merchant A must not make the same path cacheable for merchant B. Define invalidation/versioning for category create/rename/deactivate/delete and merchant slug/domain changes; B1 must trigger it.
- ⚠️ Still not a live `proxy.ts` hot-path DB call — use a versioned build-time artifact only for static tenants or an authenticated internal, edge-cached lookup keyed by canonical tenant identity. Unknown/stale/error states fail closed to no-store.

---

## Workstream C — Proxy route classification from a generated artifact (L, owner-gated; BLOCKED on C0)

`proxy.ts` treats any 2-segment `/{category}/{x}` as a PDP unless `x` is in one of several hand-maintained Sets (`RESERVED_STOREFRONT_SEGMENTS`, `NESTED_PRODUCT_SUBROUTE_EXCLUSIONS`, `CATEGORY_LISTING_HUB_SEGMENTS`, `NON_CACHEABLE_STOREFRONT_FIRST_SEGMENTS` — `proxy.ts:732`) kept in sync **by hand** with the route tree; bit **3× in one week**.

**⚠️ "Derive from the Next route manifest" is not a proven source (rev-6 catch).** Verified: the repo has **no manifest consumer or prebuild generator**, `proxy.ts` imports no generated route artifact, Next exposes **no documented API** for importing its app-route manifests into proxy (which is compiled separately and runs **before** filesystem route matching), and a route manifest describes route **shapes**, not cache-authorization intent (public-cacheable / public-no-store / private).

### C0 — feasibility/design gate (must resolve before C or B3 is scheduled)
1. Define the **semantic classification schema** (public-cacheable / public-no-store / private), machine-readable.
2. Choose a **supported source** — likely route-group conventions + explicit **colocated route metadata**, processed by a **prebuild generator** (not a runtime `.next` manifest read).
3. Emit a **static typed artifact** that `proxy.ts` imports.
4. **Fail CI** when the generated artifact diverges from the route tree.
5. Test **every private-route collision** before B3 may consume it.

Until C0 is answered, **C and B3 stay blocked**, not scheduled. (If C0 picks a prebuild route-tree generator over a Next manifest, rename C accordingly.) Protected file → owner approval.

---

## Workstream D — Config-as-code quick wins (S; DB/env should own it)

| Item | Band-aid | Proper fix (rev-3 corrected) | File |
|---|---|---|---|
| **Plan-tier fallback cleanup** (after S1-CAP; 3 slug copies) | `premiumSlugs = ['ogabassey','demo-premium']`, `LEGACY_NEGOTIATION_SLUGS`, and the snapshot function's SQL slug fallback | S1-CAP already owns the typed public capability adapter and the three storefront callers. D only **backfills/verifies `merchants.plan_tier`**, removes the `.tsx` hook fallback + stale `@ts-expect-error`s, removes `LEGACY_NEGOTIATION_SLUGS`, and adds an append-only migration replacing the snapshot function without its SQL slug fallback. Dashboard/private code may consume authorized plan state; public code continues consuming only derived capabilities. Update fallback-specific tests. | `use-merchant-features.tsx:~71`, `feature-flags.ts:208`, snapshot migration |
| **AI copilot tenant** | Ogabassey UUID hardcoded in **4** files (`ai/chat-tool-handlers.ts:22`, `ai/chat-order-cancel*`, `app/api/chat/santa/route.ts`, `.../santa/product/route.ts`) | resolve via existing `BACI_AGENTIC_MERCHANT_SLUG` env + slug lookup (`env.ts:199`) | (4 files) |
| **Currency defaults** | resolver already threaded (`resolveMerchantCurrencyConfig` in `ogabassey-pdp-semantic-sections.tsx:108`, `load-price-band-page.ts:200`) | replace remaining **NGN default params** in nested PDP `page.tsx:140,155,319` with the resolver value | nested PDP `page.tsx` |

*(BNPL moved to the security queue as S2 — it is not a config quick win.)*

---

## Deferred — proper fix known, blocked on a cost/vendor lever

AI billing enable (~$0.10/M) · Supabase compute bump · Reanimated #9866 · Jumia IdP (never re-add a runtime throw) · feature stubs (wallet withdraw 404, VTU loyalty 410, hero-image canned prompts) · **CF cache-tag/prefix purge (Enterprise)**. Out-of-scope siblings: `(platform)/blog/[slug]` lacks `generateStaticParams` (same disease, platform scope) · the `NEXT_BUILTIN_*` bot-list mirrors · `lib/csrf.ts:114` HMAC-bind TODO.

---

## Execution order (rev-20)

```
SECURITY IMPLEMENTATION LANE (S0/S1 and the bundled S2 work may coordinate/parallelize):
  S0-A checked-in anon compatibility matrix + published-row policy + exact time-bounded bridge columns
    → S0-B receipt/bank server boundary + mobile releases + mandatory gate before guest/auth queries
    → remove anon bank/contact column ACLs (S0 complete)
  S1 checked-in all-runtime direct-access census
    → S1-CAP typed snapshot adapter + 3 negotiation callers + server-side order enforcement
    → dashboard/private RPCs + all web DML/API/server readers
    → coordinated mobile releases/min-version gate
    → clean authenticated relation + column ACLs/policies (S1 complete)
  S2-I + S2-P ship as one owner-approved bundle: disable/revoke and install the guest-safe permanent
    boundary atomically; do not ship S2-I alone and do not re-enable before the permanent path passes.

PARALLEL DESIGN/INVESTIGATION ONLY while the security lane is open (no non-security implementation merge yet):
  B0 drainer-runtime ADR + timed crash/recovery prototype
  A1 decision matrix; C0 semantic-route feasibility; A3 vendor escalation

NON-SECURITY IMPLEMENTATION GATE opens only when S0-B and S1 are complete AND either (a) Credit
Direct remains disabled with public execution revoked, or (b) the bundled S2-I + S2-P permanent
capability is complete:
  B1-lite mutation boundary first: authenticated Route Handler → Next tags (partial in #3205)
  B0 exit checklist + owner/security privileged-edge approval → B1-durable three-stage bound
    (Next → Vercel → Cloudflare) → B2 producer coverage/telemetry
    → only then change PDP fresh/SWR directives
  D cleanup/filler PRs after the B1-durable edge bound
  C after C0/owner approval → B3 tenant-scoped classification after C
  A route implementation only for signed-off A1 decisions; A2 still requires full-body bot strategy
```

**Security sequencing:** honor the 2026-07-11 owner decision: S2-I never ships alone; fold its disable/revoke migration and regression proof into the S2-P permanent-capability PR. **A1 design may run alongside S0/S1 and the S2 bundle; A1 code may not merge until the single non-security implementation gate opens.** B1-lite is the first shippable cache improvement after that gate and does not wait for B0. Durable B1/B2 remain blocked on B0; B3 remains blocked on C0/C.

## Verification standard (every edge/metadata item)

Deploy → purge affected URLs → for **both** priming orders (human-first and bot-first) fetch with browser + SiteAuditBot + Googlebot → assert `CF-Cache-Status`, `Age`, `Vary`, content-type, `<head>` (one `<title>`, correct canonical/robots), **and body content present** (no Suspense-fallback-only shell, no `x-nextjs-pre-render`). Watch Semrush's next crawl before deleting any edge rule. For DB grants: test direct REST and **RPC endpoints** as anon, unrelated authenticated user, owner, permitted staff, denied staff, and service role; reconcile live `pg_class.relacl`, `pg_attribute.attacl`, policies, and function ACLs — never trust migration text alone.
