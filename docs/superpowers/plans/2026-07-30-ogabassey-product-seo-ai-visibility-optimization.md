# Ogabassey Product SEO and AI Visibility Optimization Implementation Plan

> **Revision 38 — verified domain-property provider identity, current-main PDP ownership, pre-guard legacy reconciliation, grant-valid compensation, and complete writer closure on 2026-07-31.**
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve qualified Google clicks for Ogabassey product pages and measure Google generative-AI discovery directly when the dedicated Search Console report is available, using one visible, variant-safe PDP summary and a small research-backed description pilot while correctly declaring generative descriptions in Google Merchant Center and emitting an official OpenAI product snapshot only when current provider eligibility and ingestion are proven.

**Architecture:** Task 0 is a fail-fast provider and data-volume preflight. Boundary A is an Ogabassey-only storefront accuracy/duplication change, not a presumed ranking treatment. Boundary C fits the existing main-branch migration runner: C1 adds columns plus a narrow authenticated, one-use exact-byte attestation contract; every web/mobile/RPC writer dual-writes; reviewed live CAS backfill resolves evidence-confirmed legacy rows while C1 remains additive; a normal pending migration then installs a prepared stateful guard without starting an outage clock; the classified feed deploys; then one owner-authorized `SERIALIZABLE` operator transaction validates the complete current catalog and changes only rollout state to activate permanent C3 enforcement. There is no multi-merge freeze or timed write outage. Boundary B is a fixed-signature pilot of 10–20 evidence-confirmed products whose exact proposed bytes are owner-approved, always classified as `trained_algorithmic_media`, and written once in one reviewed `SERIALIZABLE` CAS transaction. Measurement keeps four evidence contracts distinct: Search results `type=web` CTR DiD, the overlapping impression-only dedicated Search Console Generative AI report, Merchant item diagnostics, and OpenAI ingestion/search-eligibility receipts. The first two overlap and are neither independent nor additive; no lane is used as a proxy for another.

**Tech stack:** Next.js 16, React 19, TypeScript, Vitest, Supabase/PostgreSQL, Google Search Console Search Analytics API, Google Merchant XML, pnpm/Turborepo.

## Revision 32 Scope Correction

Revision 32 deliberately removes the operations platform that had grown around a bounded SEO pilot. Do **not** implement:

- custom artifact sealers, input-index services, identity bundles, `O_EXCL`/fsync handoff protocols, lock directories, receipt hash chains, IPC, supervisors, daemons, leases, nonces, or crash-recovery controllers;
- the `extend56` parent/child operation state machine;
- owner-approval APIs/RPCs, credential brokers, custom database LOGIN principals, installer/invoker roles, or provider-operation wrappers;
- dynamic manifest-bound installed functions or function-install ledgers;
- recursive production-catalog/FK cloning, external-auth fixture reconstruction, or per-scenario database cloning for compensation;
- dozens of orchestration scripts that merely pass hashes between other scripts.

Use existing controls instead:

1. reviewed Git commits/PRs for source and durable evidence that belongs in the repository;
2. immutable deployment-ticket attachments for provider exports/results that should not be committed;
3. full SHA-256 values recorded in the PR or deployment ticket;
4. Supabase MCP operation IDs, exact submitted SQL SHA-256, returned rows, and fresh readback;
5. existing exact-head review, deployment authorization, Vercel prebuilt deployment, Cloudflare purge, and feed-revalidation patterns;
6. simple operator checkpoints. A failed checkpoint stops; it does not create a new lifecycle service.

This simplification must not weaken merchant scoping, migration order, provenance, fixture isolation, exact-copy approval, rollback guards, GSC completeness, control matching, or measurement thresholds.

## Global Constraints

- Planning only. Implementers may modify only files listed by their task and must recheck current `origin/main` before each PR.
- Ogabassey merchant identity comes from the existing trusted merchant/domain contract, never from an untrusted body value.
- Existing migrations are append-only. Create new timestamped migrations and register them in the current replay sources.
- Never add a user-facing service-role edge. New provenance logic runs in existing authenticated/server paths or migration/operator SQL.
- `proxy.ts`, `.env*`, and unrelated merchants are out of scope.
- Every source/hash receipt uses the full 64-character lowercase SHA-256. Paths alone are never approval.
- Owner approval means an authenticated approval comment/status in the reviewed PR and deployment ticket naming the exact artifact paths and hashes. It is an operational gate, not new product software.
- Every production PR requires exact head SHA, green required checks, fresh substantive review, resolved applicable threads, and explicit deployment authorization.
- Production deploys use the authorized prebuilt path and end with `vercel deploy --prebuilt --prod`; do not consume Vercel cloud-build minutes.
- Any touched file over 300 lines must remain a thin caller by extracting the changed logic and adding colocated tests. Do not refactor unrelated code.
- Boundary B cannot begin until Boundary C completion is approved for all description sources, including fully receipted non-generative `default` attestations.
- Search Analytics `type=web` includes generative-AI impressions but cannot isolate or attribute them. Only the dedicated Search Console Generative AI report may support a generative-AI visibility claim, and only for the exact exported property/date/page evidence available there; the two lanes overlap and are not additive.
- An OpenAI-shaped public endpoint is not evidence that OpenAI ingested or can surface a product. Only the current official Stable file-upload contract plus provider onboarding, delivery, validation, and search-eligibility receipts support that claim.

## Execution Index

| Order | Boundary / task | Depends on | Exit gate |
|---:|---|---|---|
| 0 | Task 0 — inventory, provider access, and measurement feasibility | refreshed `origin/main` | writer inventory complete; GSC volume decision; Google Generative AI report access state; OpenAI eligibility/schema/delivery decision; C1/C2/C3 PR slices defined |
| 1 | Task 1 — Boundary A | Task 0 | Ogabassey summary/duplicate tests and production verification |
| 2 | Task 2 — GSC opportunity evidence and research | Task 0 `measured_pilot_feasible` | finalized current/previous evidence; 10–20 evidence-confirmed eligible rows; exact proposed-copy artifact |
| 3 | Task 3 — C1 additive schema and initial audit/fixture seed | Task 0 | C1 migrated; audit and five inactive fixtures hash-verified |
| 4 | Task 4 — C2a dual-write and classifier shadow | Task 3 | single-product paths dual-write; classifier-versioned product-data/CDN prewarm verified |
| 5 | Task 5 — C2b writer closure, legacy CAS backfill, prepared guard, and classified-feed deployment | Task 4 | no uncovered web/mobile/RPC writer; legacy rows reconciled before guard; prepared guard and classified feed active |
| 6 | Task 6 — atomic C3 finalization and fixture cleanup | Tasks 3–5 | one state-only C3 transaction committed; fixtures deleted; Boundary C receipt complete |
| 7 | Task 7 — refreshed treatment gate, exact manifest, and SQL approval | Tasks 2 and 6 plus 56 complete finalized post-Boundary-A PT days | fresh treatment eligibility confirmed; manifest consumes exact proposed-copy bytes; owner approves manifest and SQL hashes |
| 8 | Task 8 — controls, execution, purge, and guarded compensation readiness | Task 7 | cohort approved; one CAS transaction and fresh readback complete |
| 9 | Task 9 — 14-day safety review and 28/optional-56-day measurement | Task 8 | signed DiD decision and, when required, C3-valid compensation |

No task may be silently reordered. If Task 0 returns `insufficient_volume`, Task 2 and Tasks 7–9 are explicitly skipped rather than reordered; independently justified Boundary A and Merchant-provenance Tasks 3–6 may continue from Task 0 without a measured-pilot claim. In all branches: C1 deploy/verify precedes audit/fixtures; every web/mobile/RPC writer is dual-writing before the legacy CAS backfill; the legacy CAS backfill completes while C1 is still additive and before the prepared-guard migration; the prepared guard precedes the classified-feed switch; fixture activation/deactivation precedes C3; the final C3 operator transaction changes rollout state only after exact current-catalog validation; cleanup follows C3; proposed copy exists before Task 7; controls are selected only after treatment IDs are sealed.

## Evidence and Approval Convention

There is no custom sealer. A producer may write the explicitly named `*-staging.*` output shown in a command, validates its closed schema, and prints:

```text
artifact_path=<path>
artifact_sha256=<64 lowercase hex>
byte_length=<decimal>
```

Staging bytes are not authority. Before approval or cross-process use, the operator recomputes the hash and either:

- moves the unchanged bytes to a previously absent `docs/seo/<kind>-<UTC>-<first12sha>.<ext>` path and commits them in the reviewed evidence PR; or
- attaches the unchanged bytes to the deployment ticket, whose attachment ID and full hash are recorded.

If the destination already exists, stop and choose a new UTC stamp; do not overwrite it. This is ordinary file publication, not a sealer/lock/receipt service.

Before another PR, worktree, host, or production step consumes an artifact:

- either commit the exact bytes in a reviewed evidence PR and record commit SHA + file SHA-256;
- or attach the exact bytes to the deployment ticket and record attachment ID + SHA-256.

The consumer downloads/materializes the bytes, recomputes SHA-256, validates the schema, and compares the expected full hash from the reviewed PR/ticket. A valid artifact with the wrong expected hash fails. Same-command intermediate files may be consumed immediately after direct hash/schema validation; they do not need a separate handoff protocol.

Canonical JSON rules for all new evidence are UTF-8, LF, no BOM, sorted object keys, array order defined by each schema, no insignificant whitespace, decimal integers encoded as JSON strings when they can exceed `2^53`, and no self-referential hash field. The external PR/ticket records the artifact hash.

## Minimal Implementation File Map

The bounded new toolset is:

| File | Responsibility |
|---|---|
| `apps/web/src/components/storefront/ogabassey/pdp/product-visible-summary.tsx`, `build-product-visible-summary.ts` + tests | thin summary renderer and deterministic all-offer fact/choice reduction wired through the current critical/server PDP ownership with no marketing-description input |
| `apps/web/src/scripts/check-product-description-writers.ts` + test | current-main writer inventory guard |
| `apps/web/src/scripts/product-description-cutover.ts` + test | initial audit, pre-guard exact CAS reconciliation/backfill, read-only pre-switch/final validation, fixture/readback validation |
| `apps/web/src/scripts/ogabassey-gsc-evidence.ts` + test | Search Console availability/finality requests, daily pagination, opportunity/cohort maps, aggregation, zero materialization |
| `apps/web/src/scripts/validate-openai-stable-product-snapshot.ts` + test | current official Stable flat-schema validation, variant-row identity, required/dependent fields, and deterministic snapshot checks |
| `apps/web/src/scripts/export-openai-stable-product-snapshot.ts` + test | classified full-snapshot `jsonl.gz` generation for separately authorized SFTP delivery; never owns credentials or uploads |
| `apps/web/src/scripts/ogabassey-pilot-artifacts.ts` + test | research validation, variant applicability, proposed copy, manifest, matching, forward/compensation SQL, cohort fingerprint checks |
| `apps/web/src/scripts/ogabassey-pilot-analysis.ts` + test | outcomes projection, signed DiD bootstrap, decision |
| `apps/web/src/scripts/purge-ogabassey-product-evidence.ts` + test | existing confirmed Cloudflare purge + authenticated feed revalidation + origin/public probes |
| `apps/web/src/lib/product-description-provenance.ts` + test | exact stored-byte hash, source contract, feed classification |
| `apps/web/src/schemas/product-description-provenance.ts` + test | Zod contracts shared by routes/UI/imports |
| Existing Google/OpenAI API/public feed routes, generators, and focused tests named in Task 4 | classified emission, classifier-versioned cached product data, route-specific CDN headers, no-store errors; no persisted response-body fallback; existing OpenAI routes remain explicitly legacy/internal unless the provider accepts their exact contract |

Do not add a wrapper around these scripts. Each has direct subcommands and tests for the displayed command lines. Keep each production file at or below 300 lines by moving pure types/constants into the schema file and test fixtures into test-only modules if necessary.

---

### Task 0: Prepare the exact writer inventory and cutover checklist

**Files:**

- Create: `apps/web/src/scripts/check-product-description-writers.ts`
- Create: `apps/web/src/scripts/check-product-description-writers.test.ts`
- Create evidence: `docs/seo/product-description-writer-inventory-<UTC>-<shortsha>.csv`
- Create evidence: `docs/seo/ogabassey-seo-cutover-checklist-<UTC>-<shortsha>.md`
- Ticket evidence only: Google Generative AI report access screenshot/export hashes, GSC volume-feasibility receipt, and OpenAI onboarding/schema/country/delivery receipt. Do not commit provider exports containing query or account data.

#### Step 0.1: Fail fast on measurement volume and provider access

Complete this evidence-only step before creating the Task 0 writer-checker preparation PR or any migration/product/feed implementation PR. It creates only immutable ticket attachments and no repository file.

**Search results (`type=web`) feasibility:** use read-only Search Analytics evidence for the exact 56 complete PT days that would be eligible as a preperiod. Apply the same canonical mapping, exact-model query classifier, anonymized-query limitation, pagination/cap rules, and candidate exclusions defined later in Tasks 2 and 8. Produce only a feasibility receipt, not a cohort. It records candidate counts and distributions for exact-model impressions per member and the prospective aggregate cells. Set exactly one result:

- `measured_pilot_feasible`: evidence shows at least 10 prospective treatment products and at least 10 distinct control candidates can plausibly satisfy the fixed 200-impression-per-member/window and 10,000-impression-per-cell gates without reuse;
- `insufficient_volume`: the fixed measured pilot stops before Boundary B; do not weaken thresholds after seeing volume. Boundary A and independently justified Merchant compliance may proceed, but no CTR-treatment claim is planned;
- `incomplete_evidence`: a missing/capped/non-final request or canonical ambiguity stops all measurement work until corrected.

The receipt is descriptive and cannot select final treatment/control members. Final eligibility, research, matching, and owner approval still occur in Tasks 2, 7, and 8.

**Google Generative AI report:** open the dedicated report for the exact verified Search Console domain property `sc-domain:ogabassey.com` and record one access state: `available`, `unavailable_reason_provider_undisclosed`, or `indeterminate_error`. `https://ogabassey.com/` remains the canonical storefront base URL, not the API property identifier. Google documents rollout and insufficient impressions as possible reasons for absence but does not provide a reliable UI discriminator; use a more specific reason only when explicit provider/account evidence proves it. When available, export the unfiltered property chart and Pages table for a fixed recent 28-day non-preliminary access sample and its immediately preceding 28-day comparator, excluding dotted/preliminary dates. These Task 0 files prove access and reveal suppression/volume; they are not the treatment baseline, which is refreshed immediately before execution in Task 8. Record property, PT dates, selected dimension, UI export UTC, report help-page accessed UTC, chart/table file hashes, row count, whether the 1,000-row table limit may have truncated page evidence, and a screenshot hash of the configured report. Provider exports remain immutable ticket attachments.

The report measures impressions from supported Google Search generative-AI features, currently including AI Overviews and AI Mode. Those impressions are included within the regular Performance report's Web search type, so `type=web` is not an AI-excluded lane and the two outputs are neither independent nor additive. The dedicated report does not expose CTR/click evidence and cannot replace Search Analytics. If unavailable, record `google_generative_ai_visibility=unmeasured`; Search results performance must not be relabelled as AI visibility. Lack of access does not block the SEO pilot.

**OpenAI Stable product-feed eligibility:** re-read and record the accessed date for the official Stable file-upload overview and Products reference. Obtain provider/account evidence for all of the following before authorizing an official integration PR:

1. Ogabassey is onboarded for the supported SFTP file-upload channel;
2. the store and target country are currently supported for the intended non-Ads product feed;
3. the accepted format, compression, stable remote filename/path, cadence, and validation-result channel are known;
4. every required/dependent field can be sourced truthfully, including variant-level stable `item_id`, `is_eligible_search`, `is_eligible_checkout`, `title`, plain-text `description`, 200-resolving `url`, `brand`, `image_url`, `price` with ISO currency, `availability`, `seller_name`, `seller_url`, `return_policy`, `target_countries`, and `store_country`; privacy/TOS are additionally required if checkout is enabled;
5. no nested or legacy alias is being mistaken for the Stable flat-file field.

Set exactly one result: `official_openai_feed_authorized`, `provider_or_country_unsupported`, `onboarding_missing`, or `required_data_incomplete`. Only the first permits the Stable generator/delivery work in Task 4. Any other state leaves existing OpenAI-named endpoints classified for safety but labels them `legacy_internal_not_provider_acceptance_evidence`; it must not produce a ChatGPT ingestion, discovery, or citation claim.

Official references:

- `https://support.google.com/webmasters/answer/16984139`
- `https://developers.openai.com/commerce/specs/file-upload/overview`
- `https://developers.openai.com/commerce/specs/file-upload/products`

#### Step 0.2: Inventory every description writer in a preparation PR

**Writer baseline from current main:**

| Writer | Caller / schema | Current implementation paths | Required tests |
|---|---|---|---|
| Single create/update | add/edit forms and `apps/web/src/schemas/products.ts` | `apps/web/src/app/api/products/route.ts`, `apps/web/src/app/api/products/[id]/route.ts` | existing route/schema tests plus provenance cases |
| CSV bulk import | CSV dialog → multipart route | `apps/web/src/components/products/csv-bulk-import-dialog.tsx`, `apps/web/src/app/api/products/bulk-import/route.ts` | create `csv-bulk-import-dialog.test.tsx`; modify route test |
| Bulk-update creation | review UI/context → route → processor | `apps/web/src/components/products/review-changes.tsx`, `apps/web/src/contexts/product-context.tsx`, `apps/web/src/app/api/products/bulk-update/route.ts`, `apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts` | review/context/route/processor tests |
| Bumpa products | claimed job → commit helper | `apps/web/src/lib/import-jobs/run-claimed-import-job.ts`, `apps/web/src/lib/import-commit/commit-bumpa-products.ts` | existing focused tests |
| Jumia products | dashboard action → import route | `apps/web/src/app/dashboard/products/use-products-page-actions.ts`, `apps/web/src/app/api/marketplace/jumia/products/import/route.ts` | create `use-products-page-actions.test.ts`; modify route test |
| Mobile-admin create/update | mobile save hook → public RPC → private implementation | `apps/mobile-admin/hooks/product-save.ts`, current `public.save_mobile_admin_product_with_variants`, and its private implementation | modify `apps/mobile-admin/hooks/product-save.test.ts`; add append-only RPC migration tests for source/hash, unchanged text, unattested text, and stable error mapping |

- [ ] Search current main for `.insert`, `.update`, `.upsert`, RPC, and SQL paths that can write `public.products.description`. Include AI flows such as `apps/web/src/ai/flows/generate-product-descriptions.ts` and any route/caller that persists their output. The checker must fail for a new unlisted writer or a missing inventoried path.
- [ ] Record exact path, caller, operation, description input contract, whether the path can attest source, source used when unattested, prepared-guard/C3 error behavior, test path, and file SHA-256. The CSV header is:

```text
inventory_version,path,caller_or_route,operation,description_input_contract,can_attest_source,unattested_source,guard_error_contract,test_path,file_sha256
```

- [ ] Freeze the cutover PR sequence and owners. C1, C2a, web/mobile/RPC C2b closure, reviewed pre-guard legacy CAS backfill, prepared-guard migration, read-only pre-switch verification, classified-feed deployment, state-only C3 finalization, and cleanup must be separately reviewable in that order. The current `.github/workflows/deploy.yml` auto-applies every pending migration on `main`; therefore no migration may start a timer or require an operator pause before the next pending migration.
- [ ] Record official Merchant provenance requirements and the current Search Analytics API page accessed date. Merchant authority includes `https://support.google.com/merchants/answer/14743464` for AI-generated product data and `https://support.google.com/merchants/answer/9218260` for product details. The GSC authority is `https://developers.google.com/webmaster-tools/v1/searchanalytics/query`; it states that `first_incomplete_date` appears only for `dataState=all`, date-grouped requests whose requested range contains incomplete data.

Verify:

```bash
pnpm --filter @baci/web exec vitest run src/scripts/check-product-description-writers.test.ts
pnpm --filter @baci/web exec tsx src/scripts/check-product-description-writers.ts \
  --output ../../docs/seo/product-description-writer-inventory-staging.csv
shasum -a 256 docs/seo/product-description-writer-inventory-staging.csv
```

Expected: every current description writer appears exactly once; no path is inferred from stale documentation; no production mutation occurs.

---

### Task 1: Boundary A — one visible Ogabassey summary, no duplicate excerpt

**Current-main ownership (verified at the implementation base SHA):**

- The production PDP route is `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`; the retired `pages/product-details-page*` path is not an implementation target.
- `server-primary-details.tsx` owns the server-rendered overview/specification region, `deferred-detail-island.tsx` owns the deferred interactive details shell, and `critical-shell.tsx` owns the initial critical Ogabassey product information.
- The route-level visually hidden description article is the duplicate owner to remove. The sanitized full description remains owned exactly once by the deferred details region and must still be present in server HTML.

**Files:**

- Create: `apps/web/src/components/storefront/ogabassey/pdp/build-product-visible-summary.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/build-product-visible-summary.test.ts`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/product-visible-summary.tsx`
- Create: `apps/web/src/components/storefront/ogabassey/pdp/product-visible-summary.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/critical-product.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/critical-product.test.ts`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/critical-shell.test.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/server-primary-details.tsx`
- Modify: `apps/web/src/components/storefront/ogabassey/pdp/server-primary-details.test.tsx`
- Modify only as needed to preserve the single full-description owner: `apps/web/src/components/storefront/ogabassey/pdp/deferred-detail-island.tsx` and its colocated test.
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.tsx`
- Modify: `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx`

- [ ] Write the failing tests first against the current route/server ownership: they must prove the summary is missing and the route-level hidden description duplicates the details owner before production code changes. Capture that RED command/output in the task report.
- [ ] Keep the route and existing critical components thin. `build-product-visible-summary.ts` owns deterministic fact reduction; `product-visible-summary.tsx` only renders a precomputed result. Extract rather than adding substantial logic to any current file over 300 lines.
- [ ] Render one deterministic plain-text summary near the primary product information. It may consume only normalized product identity (`brand`, canonical product/model name) plus structured facts from every selectable active variant/offer. It must never read, summarize, sanitize, truncate, or otherwise derive copy from the stored marketing `description`.
- [ ] Define `selectable active variant/offer` as every non-deleted active variant/offer exposed by the existing selectors; if there are no variants, use the one active parent offer. Include an attribute or condition as a shared fact only when every such offer has the same non-empty normalized value. Missing, conflicting, uncertain, or alias-ambiguous values are omitted.
- [ ] A varying axis may appear only as an exhaustive choice set containing the value from every selectable active offer. Emit at most three axes in fixed priority `storage`, `ram`, `connectivity`, `colour`, `condition`; sort normalized values deterministically and phrase them as choices, for example `Available choices: Storage 128 GB or 256 GB; Colour Black or Blue.` Never imply a varying value applies to all offers. Omit an axis if any offer lacks a value or if normalization conflicts.
- [ ] If product identity is absent or no safe shared/complete-choice fact remains, omit the summary. Selection changes do not rewrite the summary into a variant-specific claim; selected-offer detail remains owned by the existing selectors/purchase panel.
- [ ] Remove the route-level visually hidden duplicate description. Preserve exactly one full sanitized description in the deferred details region and prove that it remains in initial server-rendered HTML.
- [ ] Keep both the summary and the one full-description owner in the initial server-rendered HTML. The details region may be visually deferred/collapsed, but the copy must not depend on a client fetch, interaction, hydration, or crawler-specific branch. Add no new `'use client'` boundary or description-bearing JSON-only fallback.
- [ ] Scope behavior to the Ogabassey storefront. Other storefronts, JSON-LD, metadata, and feed descriptions are unchanged.
- [ ] Test one summary, no route-level duplicate excerpt, source-HTML presence before hydration, full description still present only in the details region, marketing-description non-use (including HTML/long copy), parent-only identity, shared facts, mixed storage/RAM/connectivity/colour/condition, exhaustive-choice wording and three-axis cap, missing/conflicting attributes, inactive/nonselectable variants, selection stability, mobile/desktop layout ownership, and non-Ogabassey parity.

Verify:

```bash
pnpm --filter @baci/web exec vitest run \
  src/components/storefront/ogabassey/pdp/build-product-visible-summary.test.ts \
  src/components/storefront/ogabassey/pdp/product-visible-summary.test.tsx \
  src/components/storefront/ogabassey/pdp/critical-product.test.ts \
  src/components/storefront/ogabassey/pdp/critical-shell.test.tsx \
  src/components/storefront/ogabassey/pdp/server-primary-details.test.tsx \
  src/components/storefront/ogabassey/pdp/deferred-detail-island.test.tsx \
  'src/app/(storefront)/[slug]/(catalog)/(pdp)/[category]/[productSlug]/page.test.tsx'
```

Production gate: no-JavaScript source HTML and normal-browser verification on representative parent-only and mixed-variant PDPs show one visible summary and one full-description owner without layout or purchase regressions. Compare the exact-head candidate against its parent on the same throttling/profile with five-run median lab measurements: stop for >10% LCP regression, >0.02 absolute CLS regression, or >2 KiB gzip growth in the route's initial client JS attributable to this change. These are regression guardrails, not a Core Web Vitals improvement claim; field CWV is monitored separately and not inferred from the lab probe.

---

### Task 2: Freeze GSC opportunity evidence, variant-safe research, and exact proposed copy

**Files:**

- Create: `apps/web/src/scripts/ogabassey-gsc-evidence.ts`
- Create: `apps/web/src/scripts/ogabassey-gsc-evidence.test.ts`
- Create: `apps/web/src/scripts/ogabassey-pilot-artifacts.ts`
- Create: `apps/web/src/scripts/ogabassey-pilot-artifacts.test.ts`
- Create evidence: current/previous GSC raw JSONL, request receipts, opportunity product map, opportunity CSV, research JSON, variant snapshot JSON, eligibility CSV, and proposed-copy JSON.

#### Step 2.1: Pin the Search Analytics API contract

All opportunity, control-preperiod, day-28, and day-56 extraction uses:

- property `sc-domain:ogabassey.com`, as returned by the authenticated Search Console Sites resource; canonical page URLs remain under `https://ogabassey.com/`;
- endpoint `POST https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query`;
- OAuth scope `webmasters.readonly`;
- `type=web`;
- PT (`America/Los_Angeles`) inclusive dates;
- `aggregationType=auto` whenever page is grouped or filtered, as required by the current API guidance; availability probes use `byProperty`; every page request fails closed unless `responseAggregationType=byPage`;
- `rowLimit=25000`, `startRow=0,25000,...` until a successful terminal response with zero rows, except that a full second page triggers the fail-closed provider-cap rule below and aborts without treating a later empty page as completeness;
- raw provider responses and one request receipt per request/page;
- `query_population=api_exposed_non_anonymized_rows`, because anonymized queries and Search Console internal row limits prevent a claim of full query-universe coverage.

Every window first makes an unfiltered `dataState=all`, `dimensions=["date"]`, `aggregationType=byProperty` availability request from `window_start` through `availability_probe_end`, where `availability_probe_end >= window_end` and normally reaches the latest PT date the operator is testing. Its closed receipt fields are:

```text
schema_version,property,type,window_start_pt,window_end_pt,availability_probe_end_pt,
data_state,dimensions,
aggregation_type,first_incomplete_date,completeness_mode,request_sha256,
response_sha256,requested_days,received_date_rows,checked_at_utc
```

`first_incomplete_date` is nullable and has exactly two valid interpretations:

1. `completeness_mode=boundary_present`: `first_incomplete_date` is a valid PT date within `[window_start, availability_probe_end]`, and `window_end < first_incomplete_date`.
2. `completeness_mode=no_incomplete_points_in_requested_range`: the field is absent/null. Do **not** derive `finalized_through_date`, subtract a day from null, or invent any boundary. Completeness is established only by the required per-day `dataState=final` requests and their terminal-pagination receipts.

Regardless of availability outcome, fetch each requested day separately with `dataState=final`. Opportunity discovery uses dimensions `["page","query"]`. Control and cohort measurement use one exact canonical-page filter per product/day with dimensions `["page","query"]`. Each daily receipt records date, canonical request bytes/hash, all page response hashes, ordered `startRow` values, `page_row_counts`, terminal-empty-page hash, `total_returned_rows`, `provider_row_cap_hit`, and response aggregation type.

Closed daily receipt fields:

```text
daily_receipt_version,period_role,date_pt,product_id_or_all,canonical_page_filter,
data_state,dimensions,requested_aggregation_type,response_aggregation_type,row_limit,start_rows[],page_row_counts[],
request_sha256,response_sha256s[],terminal_empty_page_sha256,total_returned_rows,
provider_row_cap_hit,usable,row_sha256
```

`terminal_empty_page_sha256` is non-null for every usable day and may be null only when the second page itself proves `provider_row_cap_hit=true`; capped receipts remain evidence of rejection, never source data.

The daily provider-cap rule is fail-closed and applies identically to opportunity current/previous, the Task 8 control preperiod, day 28, and day 56:

- request `startRow=0` with `rowLimit=25000`;
- if it returns 25,000 rows, request `startRow=25000`;
- if that second page also returns 25,000 rows, set `provider_row_cap_hit=true` and reject the entire day immediately, even if a later `startRow=50000` request would be empty;
- a day with exactly 49,999 total rows (25,000 + 24,999) plus a successful terminal empty page at `startRow=50000` is usable;
- any `total_returned_rows >= 50000`, full second page, inconsistent page count, missing terminal empty page, or attempted override is unusable. Do not aggregate, zero-materialize, match, analyze, or extend from a capped day.

Missing daily request, a non-final request, missing terminal empty page, repeated/conflicting page, `provider_row_cap_hit=true`, or mismatched aggregation aborts the containing artifact.

The API omits days and members with no rows. After every required daily request and terminal page is present, materialize a deterministic row with `clicks=0`, `impressions=0`, `position=null`, and `row_origin=materialized_zero` for every in-scope mapped product-day absent from the returned rows (all mapped products for opportunity evidence; exact treatment/control members for cohort periods). Do not treat a legitimate zero-row product-day as incomplete. Reject only missing request/pagination evidence or a row conflict. Tests cover:

- `first_incomplete_date` present with end before/equal/after boundary;
- metadata absent and explicitly null;
- no attempt to derive `finalized_through_date` from null;
- complete zero-row day;
- missing day request;
- missing terminal page;
- 25,000 + 24,999 rows with terminal empty page 50,000 passes;
- a full second 25,000-row page and every total `>=50,000` fail even with a later empty page;
- cap failure in opportunity, controls, day 28, and day 56 propagates to artifact rejection;
- PT/UTC daylight-saving boundaries;
- values above `2^53`;
- anonymized-query limitation present in every period receipt.

#### Step 2.2: Freeze the opportunity map and current/previous aggregation

Build a merchant-scoped `opportunity_product_map` from the current eligible Ogabassey catalog and verified canonical product routes:

```text
map_version,merchant_id,product_id,canonical_page_url,slug,primary_category_slug,
route_status,primary_category_valid,row_sha256
```

Require one-to-one `canonical_page_url ↔ product_id`, status 200, expected merchant, canonical category, and no redirect ambiguity. The same opportunity-map hash is used for the adjacent current/previous opportunity pair only. Unmapped or multiply mapped pages are excluded with a reason; they are never guessed by slug. This map may include eligible catalog products that never enter the pilot and is not the measurement authority after cohort selection.

Use one frozen adjacent pair: 28 finalized PT days `current`, immediately preceded by 28 finalized PT days `previous`. Source rows include `period_role=current|previous`. Aggregate deterministically per product:

```text
source_version,period_role,exported_at_utc,date,product_id,canonical_page_url,
query,clicks,impressions,position,row_origin,opportunity_product_map_sha256,
request_receipt_sha256,row_sha256
```

- dedupe identical `(date,page,normalized_query)` rows; conflicting duplicates abort;
- sum clicks and impressions as integers;
- `ctr = clicks / impressions`, null at zero impressions;
- impression-weighted position = `Σ(position × impressions) / Σ(impressions)`, null at zero impressions;
- exact-model share and transactional-query share use frozen regex classifiers and explicit impression denominators;
- broad-head share uses the frozen query token/count rule;
- current metrics come only from current rows; comparator/delta metrics come only from previous rows;
- sort by `product_id`; round decimal outputs to six places, half-up.

Preliminary pilot eligibility uses current data only:

- canonical route/category valid;
- current impression-weighted position `<=15.000000`;
- enough current exact-model evidence to research;
- no family/cannibalization conflict detectable from catalog/map/query evidence;
- description change is potentially material, not metadata/spec/canonical-only.

Deterministic opportunity bands:

- position: `[1,3]=1`, `(3,5]=2`, `(5,10]=3`, `(10,15]=4`;
- current exact-model impressions: `1–199=1`, `200–499=2`, `500–999=3`, `>=1000=4`;
- current transactional-query impression share: `[0,0.10)=0`, `[0.10,0.25)=1`, `[0.25,0.50)=2`, `[0.50,1]=3`.

`opportunity_score = 100 × position_band + 10 × exact_impression_band + transactional_share_band`. Missing/zero-impression position, missing exact-model denominator, invalid route/category, or a value outside the closed bands makes the row evidence-only with an explicit reason. Rank preliminarily eligible rows by score descending, current exact-model impressions descending, current position ascending, product ID ascending. Rows above position 15 remain in the general opportunity queue as evidence-only and cannot slot-fill into the measured pilot. Previous-only metrics remain comparators and never affect eligibility/rank.

#### Step 2.3: Seal complete product/variant/condition evidence

For each preliminarily eligible product, capture a merchant-scoped, current catalog snapshot containing:

- parent product ID/name/brand/category/current description hash/source/hash/condition/condition detail;
- **every** associated non-deleted variant, including active/inactive status, SKU, price, availability/stock semantics, and complete attribute map;
- normalized storage, RAM, connectivity/network, colour, model, and condition values from both structured columns and variant attributes;
- key specs, canonical category, feed primary image, and source timestamps;
- exact source receipts for manufacturer/retailer/manual evidence used in claims.

Also inventory genuinely first-party Ogabassey evidence when it exists: named inspector/reviewer, inspection/test UTC, inspected condition, included accessories, original image/video asset IDs and hashes, observed device behavior, locally tested network compatibility, written warranty/support terms, and documented Nigeria delivery/repair/swap facts. Each observation needs an internal receipt or approved public source that identifies the product or exact variant. Absence is valid and is recorded as `first_party_evidence_status=none`; it must never be filled with generic locality language or an invented test.

Sort variants by UUID and attributes by normalized key. Record `complete_variant_count`, `variant_ids_sha256`, `attribute_schema_sha256`, and missing/conflicting fields. If a product has no variants, represent one explicit parent-only applicability unit.

Every claim has:

```text
claim_id,claim_text,claim_text_sha256,evidence_refs[],applicability_mode,
applicable_variant_ids[],applicable_conditions[],axes[],status
```

Rules:

- `applicability_mode=all_variants` is valid only when evidence proves the claim for the complete captured variant/condition set.
- Otherwise `applicability_mode=enumerated_variants` must enumerate the **complete** set of matching captured variant IDs, and the proposed sentence must explicitly scope the claim to those variant attributes/conditions.
- A shared product description may not state an unqualified variant-specific fact.
- Partial sets, an uncaptured variant, ambiguous attribute aliases, conflicting evidence, or a missing attribute needed by a claim fail eligibility.
- Manual review cannot waive missing evidence. `manual-review` is ineligible until resolved and reclassified `high|medium`.
- Manufacturer specifications establish product facts but are not first-party Ogabassey experience. A proposed description should include one or more useful Ogabassey-specific facts only when the corresponding first-party receipts exist; otherwise it stays neutral and verified rather than pretending to be hands-on.
- A neutral row is still eligible only if the proposed copy adds a receipted, decision-useful synthesis for the exact listing—such as a clear variant/condition distinction, compatibility limitation, included/not-included distinction, or model-intent answer—rather than merely reordering a manufacturer spec sheet. If neither verified first-party value nor a supportable listing-specific synthesis exists, classify it `commodity_rewrite` and skip it.
- Claims such as “tested,” “inspected,” “works on Nigerian networks,” “includes,” “same-day,” “warranty,” “repair,” or “swap” are forbidden without exact product/variant applicability and a current Ogabassey receipt.

Golden tests cover storage, RAM, connectivity, colour, new/used/refurbished condition, condition detail, parent-only products, missing attributes, conflicting aliases, inactive variants, all-variant claims, exhaustively enumerated scoped claims, and rejection of partial/ambiguous applicability.

#### Step 2.4: Confirm eligibility and produce exact proposed bytes

Research in preliminary rank order. Record every source URL/document ID, retrieval UTC, immutable excerpt/screenshot hash, claim binding, volatility class, and disposition. `static_model_spec` evidence must be re-fetched successfully within seven days of final execution; `merchant_policy|included_accessory|condition|availability|delivery|warranty|repair|swap` evidence requires fresh merchant/source readback within 24 hours. A provider-stated expiry overrides only by being shorter. Rows may downgrade to `spec_only`, `metadata_only`, `canonical_only`, `commodity_rewrite`, `insufficient_evidence`, `variant_ambiguous`, or `manual_review`. Fill a vacated slot from the next preliminary rank; do not conduct unrecorded research. Stop with `insufficient-eligibility` if fewer than 10 rows are confirmed; otherwise write and hash exactly 10–20.

For every confirmed row, generate one exact proposed-copy record:

```json
{
  "schema_version": 1,
  "product_id": "uuid",
  "merchant_id": "uuid",
  "treatment_signature": "description-provenance-only-v1",
  "source_type": "trained_algorithmic_media",
  "description_utf8_base64": "...",
  "description_byte_length": "123",
  "description_sha256": "64hex",
  "variant_snapshot_sha256": "64hex",
  "claim_ids": ["..."],
  "claim_bindings_sha256": "64hex",
  "first_party_evidence_status": "verified|none",
  "first_party_evidence_refs": ["..."],
  "first_party_evidence_sha256": "64hex",
  "applicability_status": "complete",
  "research_confidence": "high"
}
```

For this pilot, `source_type` must be exactly `trained_algorithmic_media`. Terra/Codex or any other generative system drafts or materially transforms every proposed pilot description, and later human review does not change that provenance. The pilot has no `default` branch and must never request or consume a default-attestation grant for forward treatment writes. `default` remains available only to independent manual writers under the C1 grant contract outside this pilot. The base64 decodes to the exact UTF-8 bytes Task 7 will write; no Unicode normalization, trimming, HTML conversion, templating, or regeneration is allowed downstream. `description_sha256` is over those decoded bytes. Reject invalid UTF-8, NUL, unsafe markup, any non-trained pilot source, unsupported claims, or source misclassification.

Each proposed-copy record additionally binds `first_party_evidence_status`, sorted `first_party_evidence_refs`, and `first_party_evidence_sha256`. The description must answer the shopper's model/variant/condition intent directly, avoid boilerplate and unsupported superlatives, and add original Ogabassey value only where those bound receipts support it. Neutral factual synthesis is allowed but must pass the listing-specific decision-usefulness rule; generic research-source/spec paraphrase is `commodity_rewrite`, not treatment copy, and is never labelled original experience.

The proposed-copy artifact is a canonical JSON array sorted by final eligible rank then product ID. It binds the variant snapshot and claim/evidence hashes. Owner approval of research cannot replace evidence or applicability validation.

Verify:

```bash
GSC_TOKEN="${GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN:?set readonly Search Console token}"
pnpm --filter @baci/web exec vitest run \
  src/scripts/ogabassey-gsc-evidence.test.ts \
  src/scripts/ogabassey-pilot-artifacts.test.ts
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-gsc-evidence.ts opportunity \
  --property sc-domain:ogabassey.com \
  --oauth-token-env GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN \
  --output-dir ../../docs/seo
OPPORTUNITY_PATH="${OPPORTUNITY_PATH:?set exact reviewed opportunity path}"
OPPORTUNITY_SHA256="${OPPORTUNITY_SHA256:?set expected opportunity SHA-256}"
RESEARCH_PATH="${RESEARCH_PATH:?set exact reviewed research path}"
RESEARCH_SHA256="${RESEARCH_SHA256:?set expected research SHA-256}"
VARIANT_SNAPSHOT_PATH="${VARIANT_SNAPSHOT_PATH:?set exact reviewed variant snapshot path}"
VARIANT_SNAPSHOT_SHA256="${VARIANT_SNAPSHOT_SHA256:?set expected variant snapshot SHA-256}"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts proposed-copy \
  --opportunity "$OPPORTUNITY_PATH" \
  --opportunity-sha256 "$OPPORTUNITY_SHA256" \
  --research "$RESEARCH_PATH" \
  --research-sha256 "$RESEARCH_SHA256" \
  --variant-snapshot "$VARIANT_SNAPSHOT_PATH" \
  --variant-snapshot-sha256 "$VARIANT_SNAPSHOT_SHA256" \
  --output ../../docs/seo/ogabassey-proposed-copy-staging.json
shasum -a 256 docs/seo/ogabassey-proposed-copy-staging.json
```

The PR/ticket records each full input/output hash. Tests invoke the command with concrete fixture paths.

---

### Task 3: Boundary C1 — additive schema, initial audit, and inactive fixtures

**Files:**

- Create: `supabase/migrations/<timestamp>_add_product_description_provenance.sql`
- Create: `supabase/migrations/tests/product_description_provenance_c1.sql`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.test.ts`
- Modify generated type: `apps/web/src/types/supabase.ts`
- Create: `apps/web/src/scripts/product-description-cutover.ts`
- Create: `apps/web/src/scripts/product-description-cutover.test.ts`
- Create evidence: historical provenance audit/backfill proposal and fixture manifest.

#### Step 3.1: Apply additive C1

Add to `public.products`:

- `description_digital_source_type text NULL`, constrained when non-null to `unknown|default|trained_algorithmic_media`;
- `description_provenance_sha256 text NULL`, constrained when non-null to 64 lowercase hex.

The same additive migration creates a private one-use attestation-grant table and one narrowly scoped authenticated public RPC for requesting a grant. The function resolves `auth.uid()` to the product's merchant (or verifies active merchant/staff authority for a caller-generated new product UUID), rejects body-selected/unowned merchants, and binds the grant to actor, merchant, product ID, operation ID, expected old description/source/hash, exact proposed UTF-8 hash, `full_replacement`, purpose, and a short fixed expiry. Platform-admin status alone confers no merchant authority, including when one account also has a merchant role. Direct table access is denied; revoke default/anonymous execute, grant only authenticated execution, use a fixed `search_path`, and return no sensitive cross-tenant data. Duplicate operation IDs are idempotent only for byte-identical bindings. This is provenance evidence for an existing product write, not an owner-approval service or a generic privileged write edge.

Do not backfill, set defaults, mark product columns `NOT NULL`, change feed output, or reject legacy rows in C1. Existing rows therefore remain grandfathered `NULL/NULL`. Add column comments and register the new append-only migration in both current replay registries. Do not change existing product RLS/grants; the new private grant table/RPC follows least privilege. Apply C1 to the disposable migration-test database, then regenerate the checked-in public types with the repository-pinned CLI rather than hand-editing them:

```bash
BACI_MIGRATION_TEST_DATABASE_URL="${BACI_MIGRATION_TEST_DATABASE_URL:?set disposable migration-test URL}"
pnpm exec supabase gen types typescript \
  --db-url "$BACI_MIGRATION_TEST_DATABASE_URL" \
  --schema public > apps/web/src/types/supabase.ts
git diff -- apps/web/src/types/supabase.ts
```

The diff must contain the two provenance fields in `products.Row`, `products.Insert`, and `products.Update` plus only other schema changes already represented by reviewed pending migrations. Unexpected generated drift stops C1 review.

Migration tests prove:

- old rows remain byte-identical with nullable provenance;
- valid sources/hashes are accepted;
- malformed source/hash rejected;
- C1 can apply to the current production-old replay fixture;
- no existing product RLS/grant changes and no description mutation;
- cross-merchant, platform-admin-without-merchant-role, missing-auth, mismatched-old-triple, changed-binding replay, and expired-grant requests fail; a dual-role account succeeds only through its explicit merchant/staff authority, and same-binding operation replay is idempotent.

#### Step 3.2: Run the initial historical audit after C1

The initial audit is evidence, not the final cutover snapshot. Inventory every historical AI/import path and classify every existing non-empty description:

- `confirmed_ai`;
- `confirmed_non_ai`;
- `possibly_ai_unresolved`;
- `no_description`.

Each row records product/merchant ID, exact current description SHA-256, current source/hash, evidence refs, classification reason, and observed `updated_at`. Style, owner preference, or lack of an AI marker is not evidence.

Prepare but do not yet execute exact-ID/current-hash same-text reclassification:

- confirmed AI → `trained_algorithmic_media` + exact current hash;
- evidence-confirmed non-generative → `default` + exact current hash;
- unresolved → `unknown` with exact hash only if the runtime contract needs a post-C1 unknown state; it remains feed-ineligible.

This proposal will be recomputed against the fresh pre-guard snapshot after writer closure and again for read-only pre-switch/final-C3 validation. The initial audit alone never authorizes backfill because rows may change before the exact pre-guard CAS reconciliation.

Run the tested direct producer:

```bash
OGABASSEY_MERCHANT_ID="${OGABASSEY_MERCHANT_ID:?set verified Ogabassey merchant UUID}"
WRITER_INVENTORY_PATH="${WRITER_INVENTORY_PATH:?set reviewed writer inventory path}"
WRITER_INVENTORY_SHA256="${WRITER_INVENTORY_SHA256:?set expected writer inventory SHA-256}"
pnpm --filter @baci/web exec vitest run src/scripts/product-description-cutover.test.ts
pnpm --filter @baci/web exec tsx src/scripts/product-description-cutover.ts audit \
  --database-url-env BACI_MIGRATION_DATABASE_URL \
  --merchant-id "$OGABASSEY_MERCHANT_ID" \
  --writer-inventory "$WRITER_INVENTORY_PATH" \
  --writer-inventory-sha256 "$WRITER_INVENTORY_SHA256" \
  --output ../../docs/seo/product-description-initial-audit-staging.json
```

#### Step 3.3: Seed five dedicated inactive fixtures

After C1 production verification, use reviewed SQL through Supabase MCP to seed five Ogabassey-only synthetic products, all inactive/draft:

1. grandfathered non-empty description with `NULL/NULL`;
2. post-C1 `unknown` with exact valid hash;
3. `default` with exact valid hash;
4. `trained_algorithmic_media` with exact valid hash;
5. trusted source with a deliberately stale/mismatched hash, representable before C3.

Every fixture has identical valid non-provenance feed prerequisites:

- exact verified Ogabassey merchant;
- canonical same-merchant primary category and route-valid slug;
- valid positive price;
- explicit GMC-valid condition and availability;
- one verified `product_feed_images` primary image with same supported test asset;
- deterministic fixture tag/run ID in synthetic-identifying fields;
- no orders, carts, transactions, reviews, or unrelated relations.

The fixture manifest records exact product and relation IDs, before/expected states, provenance triple, feed prerequisites, creation operation ID, SQL hash, returned IDs, and fresh readback. It also records the only permitted lifecycle order:

```text
inactive seed → classified-feed verification → ordered activation →
ordered deactivation → C3 → relation/product deletion → post-delete probes
```

Never recreate impossible grandfathered `NULL` provenance after text changes or after C3. Any real row, merchant mismatch, relation not in the manifest, or unexpected dependency aborts lifecycle SQL.

After the operator submits the reviewed fixture SQL, validate the exact provider result/readback:

```bash
OGABASSEY_MERCHANT_ID="${OGABASSEY_MERCHANT_ID:?set verified Ogabassey merchant UUID}"
FIXTURE_PROVIDER_RESULT="${FIXTURE_PROVIDER_RESULT:?set exact Supabase MCP result attachment}"
FIXTURE_PROVIDER_RESULT_SHA256="${FIXTURE_PROVIDER_RESULT_SHA256:?set expected provider result SHA-256}"
pnpm --filter @baci/web exec tsx src/scripts/product-description-cutover.ts verify-fixture-seed \
  --merchant-id "$OGABASSEY_MERCHANT_ID" \
  --provider-result "$FIXTURE_PROVIDER_RESULT" \
  --provider-result-sha256 "$FIXTURE_PROVIDER_RESULT_SHA256" \
  --output ../../docs/seo/product-description-fixture-manifest-staging.json
```

Verify:

```bash
BACI_MIGRATION_TEST_DATABASE_URL="${BACI_MIGRATION_TEST_DATABASE_URL:?set disposable migration-test URL}"
pnpm --filter @baci/web exec vitest run \
  tools/db/supabase-history-replay-sources.test.ts
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c1.sql
```

Production gate: C1 migration receipt, exact initial-audit hash, fixture SQL hash/provider operation/returned IDs, and fixture readback hash are in the deployment ticket.

---

### Task 4: Boundary C2a — provenance dual-write and classified-feed shadow

**Files:**

- Create: `apps/web/src/lib/product-description-provenance.ts`
- Create: `apps/web/src/lib/product-description-provenance.test.ts`
- Create: `apps/web/src/schemas/product-description-provenance.ts`
- Create: `apps/web/src/schemas/product-description-provenance.test.ts`
- Create: `apps/web/src/app/dashboard/products/add/use-product-description-provenance.ts`
- Create: `apps/web/src/app/dashboard/products/add/use-product-description-provenance.test.ts`
- Modify: `apps/web/src/schemas/products.ts` and tests.
- Modify: `apps/web/src/app/api/products/route.ts` and test.
- Modify: `apps/web/src/app/api/products/[id]/route.ts` and test.
- Modify: `apps/web/src/app/dashboard/products/add/add-product-form.tsx`
- Modify: `apps/web/src/app/dashboard/products/add/add-product-form.test.tsx`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.ts`, `apps/web/src/app/api/feed/google-merchant/build-product-detail-xml.ts`, `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`, `apps/web/src/app/api/feed/google-merchant/route.ts`, and colocated tests.
- Modify: `apps/web/src/app/feeds/google-merchant.xml/route.ts`, `route.test.ts`, and `route.integration.test.ts`.
- Modify: `apps/web/src/app/api/feed/openai/feed-data.ts`, `apps/web/src/app/api/feed/openai/current-feed-generator.ts`, `apps/web/src/app/api/feed/openai/legacy-feed-generator.ts`, `apps/web/src/app/api/feed/openai/route.ts`, and colocated tests.
- Modify: `apps/web/src/app/feeds/openai-feed-response.ts` and test.
- Modify: `apps/web/src/app/feeds/openai.jsonl/route.ts` and test.
- Modify: `apps/web/src/app/feeds/agent-products.jsonl/route.ts` and test.
- Create only when Task 0 is `official_openai_feed_authorized`: `apps/web/src/scripts/validate-openai-stable-product-snapshot.ts` and colocated test.
- Create only when Task 0 is `official_openai_feed_authorized`: `apps/web/src/scripts/export-openai-stable-product-snapshot.ts` and colocated test.

#### Step 4.1: Define one stored-byte provenance contract

```ts
type ProductDescriptionSource =
  | 'unknown'
  | 'default'
  | 'trained_algorithmic_media';
```

- Hash the exact UTF-8 bytes of the sanitized string actually stored, after the existing sanitizer but without additional trimming/normalization.
- Empty description stores `unknown/NULL`.
- `default` means attested non-generative text, not a generic fallback. A trusted manual path may set it only after the authenticated operator attests that the complete submitted bytes were independently authored without generative assistance and obtains the C1 one-use grant bound to the exact operation/product/old triple/new-byte hash. Record the grant ID and existing audit-log event ID in the operation receipt.
- `trained_algorithmic_media` is sticky: if generative output contributed to the current description, later trimming, rewriting, fact correction, or human review remains trained. Internal AI flows set it automatically and cannot offer a `default` override.
- A prior trained or unknown description can become `default` only after complete replacement with independently authored bytes plus a one-use grant marked `full_replacement=true`. Any trained edit without that grant preserves `trained_algorithmic_media`; any unknown edit without new evidence remains `unknown`.
- Pasted/imported/third-party text without reliable provenance is `unknown` + exact hash. A UI selector or request string alone is not trusted source evidence; authenticated import attestation must bind the exact file/row bytes and source choice in the operation receipt.
- New or changed non-empty text therefore resolves server-side to `default|trained_algorithmic_media|unknown`; server code computes the hash and ignores/rejects client hashes. Every new/changed `default`, including `default` → edited `default`, carries a matching unconsumed grant; unchanged default text needs no new grant.
- Unchanged text with no new evidence preserves the exact existing source/hash, including grandfathered `NULL/NULL`.
- Third-party text without reliable source attestation stores `unknown` + exact hash and is feed-ineligible.
- Tests prove AI → edited remains trained, AI → fully replaced without attestation remains trained, AI → fully replaced with trusted non-generative attestation becomes default, unknown → ordinary selector remains unknown, and exact internal AI output is always trained.

Deploy C2a first on single create/update and AI-generated single-product paths. In this phase the schema is still additive and no blanket database freeze exists.

#### Step 4.2: Implement one server-side feed classifier in shadow mode

Classifier outcomes:

```text
ordinary_default
structured_ai
excluded_unknown
excluded_hash_mismatch
empty
```

Classification recomputes the exact stored-description hash:

- `default` + exact hash → ordinary default;
- `trained_algorithmic_media` + exact hash → structured AI;
- `unknown`, `NULL`, missing hash, or trusted-source mismatch → excluded;
- empty text follows the feed's existing required-field behavior but cannot synthesize a fallback from name/metadata for an excluded item.

Modify:

- Google: `apps/web/src/app/api/feed/google-merchant/feed-data.ts`, `build-product-detail-xml.ts`, `feed-builder.ts`, API route, public XML route, and focused tests.
- OpenAI: `apps/web/src/app/api/feed/openai/feed-data.ts`, current/legacy generators, API route, `apps/web/src/app/feeds/openai-feed-response.ts`, public `/feeds/openai.jsonl`, public `/feeds/agent-products.jsonl`, and focused tests.

Google emission:

- `ordinary_default` → `<g:description>`;
- `structured_ai` → only `<g:structured_description>` containing `digital_source_type=trained_algorithmic_media` and content;
- excluded → omit the entire product item.

Existing OpenAI-named route emission uses whole-item exclusion for safety and backward compatibility:

- valid default/AI → existing plain description shape;
- unknown/mismatch/grandfathered → omit the whole item from direct and public current/legacy outputs;
- no generator or cache may reintroduce an excluded description.
- these route shapes are explicitly `legacy_internal_not_provider_acceptance_evidence`; their URL, HTTP 200, or field names do not establish ChatGPT ingestion or eligibility.

Only when Task 0 is `official_openai_feed_authorized`, add the separate Stable snapshot generator and validator named in the file map. It emits a full snapshot with one flat record per sellable variant/offer, not one ambiguous parent row. The row uses the current official Stable field names and dependencies, including:

- lower-case `is_eligible_search`; set `true` only for classified, eligible, purchasable-on-site rows intended for search;
- lower-case `is_eligible_checkout`; default `false` unless a separately reviewed OpenAI checkout integration and all dependent seller policy fields are active;
- stable variant-unique alphanumeric `item_id` of at most 100 characters; derive a documented immutable mapping from product/variant identity, store/test that mapping, and never derive it from mutable title, price, stock, or position;
- plain scalar `title`, `description`, `url`, `brand`, `image_url`, `price`, `availability`, `seller_name`, `seller_url`, `return_policy`, `target_countries`, and `store_country` using current Stable validation rules;
- `group_id`, `listing_has_variations`, and `variant_dict` for real variant families where supported, without deprecated custom-variant aliases;
- no `id`, `link`, `image_link`, `enable_search`, nested `{plain: ...}` description, nested media object, or repository-specific field in the provider snapshot unless the then-current official Stable reference explicitly permits it.

Generate deterministic UTF-8 `jsonl.gz` because it is an officially supported upload format. Validate decompressed rows before compression, reject duplicate `item_id`, missing/dependent fields, non-200 product URLs, invalid image/price/availability values, unclassified descriptions, unsupported country values, parent/variant ambiguity, and unstable row order. The application generates bytes only; a separately authorized operator/VPS job owns SFTP credentials and pushes the same stable remote filename at least daily. Never expose SFTP credentials to a route, browser bundle, log, artifact, or repository.

Begin with the provider-recommended sample of about 100 valid rows. Production authorization requires the provider's sample-ingestion receipt with accepted/rejected row counts and reasons. Full-catalog activation requires a subsequent clean full-snapshot receipt. Record the local uncompressed/compressed hashes, row/ID-set hashes, remote stable filename, upload UTC, provider job/receipt ID, accepted/rejected counts, and search-eligibility state. `accepted` and `is_eligible_search=true` establish feed eligibility only; they do not prove that ChatGPT cited, displayed, or converted from the description.

Implement the official Stable generator/delivery as its own reviewable PR after the classifier/provenance contract is green; do not bundle SFTP operations into the C1/C2 migration PRs. If provider authorization is unavailable, skip this PR without blocking Google Merchant provenance work.

The six tested surfaces are:

1. Google API;
2. public `/feeds/google-merchant.xml`;
3. OpenAI API plain `format=current`;
4. OpenAI API gzip `format=jsonl` (the real `gzipSync` branch);
5. public `/feeds/openai.jsonl`;
6. public `/feeds/agent-products.jsonl`.

When authorized, separately test the Stable uncompressed snapshot and real gzip round trip against exact official-field fixtures. It is not a seventh public/CDN surface and is never substituted into the six-surface cache/failover gate.

C2a initially runs classifier **shadow comparison**: produce classified candidate IDs/body hash out of band while serving existing responses. Log/receipt only counts and ID-set hashes, never descriptions. Differences are reconciled against the initial audit.

#### Step 4.3: Prepare classifier-versioned product data and candidate probes

Current main has Next `use cache` product-data functions plus per-request feed generation; it does **not** expose a readable, hash-verifiable prior response body to application code. Do not add feed-body persistence, a cache service, or an application “last-known-good body” retrieval path.

Instead:

- include the classifier version in the existing Google/OpenAI cached-product-data key/tag contract so pre-classifier product data cannot be reused after the switch;
- make every successful classified feed response expose the reviewed classifier version in a response header and use route-specific CDN headers `public, s-maxage=300, stale-while-revalidate=1800`; errors are always `Cache-Control: no-store`;
- prepare the exact authenticated revalidation and confirmed Cloudflare purge calls that Task 5 will run immediately after alias activation;
- probe all six surfaces on the exact-head candidate environment using the trusted tenant-host test mechanism already used by the feed integration suite; do not claim this prewarms the production custom-domain CDN;
- record the externally observed candidate body hash, included/excluded ID-set hashes, classifier header/SHA, candidate deployment SHA, cache headers, request UTC, and probe result in the ticket. Those hashes verify the candidate responses only; application code cannot retrieve that body after a later origin failure.

Task 5 performs the real production purge, prewarm, and origin/public verification after the classifier-enforcing alias switch. During a later origin failure, the existing CDN may serve its already-classified response only within the declared 30-minute stale window. An uncached/direct request or an expired/missing CDN entry reaches the origin and receives no-store `503`; the application never fabricates or retrieves a prior body.

Verify:

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/product-description-provenance.test.ts \
  src/schemas/product-description-provenance.test.ts \
  src/app/dashboard/products/add/use-product-description-provenance.test.ts \
  src/app/dashboard/products/add/add-product-form.test.tsx \
  src/app/api/products/route.test.ts \
  src/app/api/products/[id]/route.test.ts \
  src/app/api/feed/google-merchant/feed-data.test.ts \
  src/app/api/feed/google-merchant/build-product-detail-xml.test.ts \
  src/app/api/feed/google-merchant/feed-builder.test.ts \
  src/app/api/feed/openai/feed-data.test.ts \
  src/app/api/feed/openai/current-feed-generator.test.ts \
  src/app/api/feed/openai/legacy-feed-generator.test.ts \
  src/app/api/feed/openai/route.test.ts \
  src/app/feeds/google-merchant.xml/route.test.ts \
  src/app/feeds/google-merchant.xml/route.integration.test.ts \
  src/app/feeds/openai-feed-response.test.ts \
  src/app/feeds/openai.jsonl/route.test.ts \
  src/app/feeds/agent-products.jsonl/route.test.ts
# Run only when Task 0 authorized the official Stable integration PR:
pnpm --filter @baci/web exec vitest run \
  src/scripts/validate-openai-stable-product-snapshot.test.ts \
  src/scripts/export-openai-stable-product-snapshot.test.ts
```

Tests cover all five fixtures, exact Google XML shape, exact legacy/internal OpenAI plain/gzip/public inclusion sets, the conditional official Stable flat schema and gzip round trip, per-variant stable identity, required/dependent fields, classifier-versioned product-data keys, exact classified success/cache headers, no-store error responses, no application body-cache retrieval branch, `503`/`Retry-After` with no empty-`200` response, no excluded-item leakage, and unchanged non-Ogabassey behavior. Production probes, not unit tests, verify CDN `Age`/cache-status and stale delivery; provider receipts, not tests or public URLs, verify Stable ingestion.

---

### Task 5: Boundary C2b — close every writer, prepare the guard, and activate classified feeds

**Files:**

- Create: `apps/web/src/components/products/use-csv-bulk-import.ts` and test.
- Create: `apps/web/src/components/products/bulk-product-description-source-choice.tsx` and test.
- Create: `apps/web/src/lib/import-jobs/commit-claimed-product-import.ts` and test.
- Create: `apps/web/src/lib/jumia/import-jumia-products.ts` and test.
- Modify: `apps/web/src/components/products/csv-bulk-import-dialog.tsx`
- Create: `apps/web/src/components/products/csv-bulk-import-dialog.test.tsx`
- Modify: `apps/web/src/app/api/products/bulk-import/route.ts` and test.
- Modify: `apps/web/src/components/products/review-changes.tsx` and tests.
- Modify: `apps/web/src/contexts/product-context.tsx` and tests.
- Modify: `apps/web/src/app/api/products/bulk-update/route.ts`, `apps/web/src/app/api/products/bulk-update/bulk-update-change-processing.ts`, and tests.
- Modify: `apps/web/src/lib/import-jobs/run-claimed-import-job.ts` and focused tests.
- Modify: `apps/web/src/lib/import-commit/commit-bumpa-products.ts` and test.
- Modify: `apps/web/src/app/api/marketplace/jumia/products/import/route.ts` and test.
- Modify: `apps/web/src/app/dashboard/products/use-products-page-actions.ts`
- Create: `apps/web/src/app/dashboard/products/use-products-page-actions.test.ts`
- Modify: `apps/mobile-admin/hooks/product-save.ts`
- Modify: `apps/mobile-admin/hooks/product-save.test.ts`
- Create append-only migration: `supabase/migrations/<timestamp>_add_mobile_admin_product_description_provenance.sql`
- Create append-only migration for a later separately merged deployment, after all writers are deployed and the C1 legacy CAS backfill is complete: `supabase/migrations/<timestamp>_prepare_product_description_provenance_guard.sql`
- Create/extend: `supabase/migrations/tests/product_description_provenance_c2.sql`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.ts`
- Modify: `apps/web/tools/db/supabase-history-replay-sources.test.ts`
- Extend disposable migration tests to cover the replaced `public.save_mobile_admin_product_with_variants` and its private implementation without editing any existing migration.

#### Step 5.1: Close source contracts

Exact CSV header:

```text
name,description,description_digital_source_type,price,stock_quantity,category,sku,status
```

Blank source is accepted only for blank descriptions or third-party unclassified import, where the server stores `unknown` + exact hash. Reject misspelled/extra headers and invalid source values before any row writes. Manual CSV/review UI provides an accessible source selector plus authenticated attestation language; before a `default` row write, its trusted server path requests the C1 grant bound to upload hash, row bytes, generated/stable product ID, expected old triple, and operation ID. `default` is rejected without a matching grant. AI enrichment automatically and irreversibly selects `trained_algorithmic_media` for those generated bytes and cannot request a default grant.

Bulk-update payloads carry source evidence with description changes. Description-unchanged operations preserve the pair exactly. A changed prior-trained description without a trusted full-replacement attestation inherits `trained_algorithmic_media`; changed prior-unknown text remains `unknown` without new trusted evidence; other changed unattested text becomes `unknown`. No caller can promote text to `default` through a bare enum value.

Bumpa and Jumia descriptions are `unknown` unless their API response contains a reviewed, explicit source attestation. Do not infer `default` from marketplace origin. `run-claimed-import-job.ts` delegates commits to `commit-claimed-product-import.ts`; the Jumia route delegates transformation/write logic to `import-jumia-products.ts`.

Mobile-admin sends description source evidence and, for manual default authorship, the exact attestation fields inside the existing validated product payload. The append-only RPC replacement preserves the current signature, authorization, merchant limit, inventory and variant semantics while computing the exact stored-description hash in trusted SQL and atomically creating/consuming the bound grant and writing description/source/hash. Already-installed clients that omit the new evidence remain compatible: changed non-empty text is conservatively `unknown` + exact hash, never `default`. It maps prepared-guard/C3 SQLSTATE failures to the same stable retryable product-save error used by web writers. Tests cover new and legacy-client create/update, unchanged description, trained sticky edits, trusted full replacement, unattested text, duplicate/limit behavior, and prove no legacy overload remains callable.

#### Step 5.2: Obey the Boy Scout extraction rule

- `csv-bulk-import-dialog.tsx` is over 300 lines: move upload/validation/provenance state to `use-csv-bulk-import.ts`.
- `review-changes.tsx` is over 300 lines: move source-choice rendering/validation to `bulk-product-description-source-choice.tsx`.
- `run-claimed-import-job.ts` is over 300 lines: move the touched write path to `commit-claimed-product-import.ts`.
- Jumia import route is over 300 lines: move transformation/write logic to `import-jumia-products.ts`; route remains auth/validation/response glue.
- If another touched current-main file is over 300 lines at implementation time, extract only the touched provenance logic with a colocated test.

#### Step 5.3: Prove no writer remains

Run the Task 0 checker against the exact C2b head. Every path must:

- store source + exact hash atomically with changed description;
- preserve the pair when text is unchanged;
- preserve sticky trained/unknown semantics and reject a bare `default` promotion;
- map the prepared-guard/C3 SQLSTATE to stable validation output;
- expose a visible corrective error to its caller;
- have success, unknown-source, AI-source, trusted-default attestation, sticky-edit, unchanged-text, and guard tests.

The stable provenance error is:

```json
{"error":"Product description source evidence is required","code":"PRODUCT_DESCRIPTION_PROVENANCE_REQUIRED"}
```

Verify:

```bash
pnpm --filter @baci/web exec vitest run \
  src/components/products/csv-bulk-import-dialog.test.tsx \
  src/components/products/use-csv-bulk-import.test.ts \
  src/components/products/review-changes.test.tsx \
  src/components/products/bulk-product-description-source-choice.test.tsx \
  src/app/api/products/bulk-import/route.test.ts \
  src/app/api/products/bulk-update/route.test.ts \
  src/app/api/products/bulk-update/bulk-update-change-processing.test.ts \
  src/lib/import-jobs/commit-claimed-product-import.test.ts \
  src/lib/import-jobs/run-claimed-import-job.test.ts \
  src/lib/import-commit/commit-bumpa-products.test.ts \
  src/lib/jumia/import-jumia-products.test.ts \
  src/app/api/marketplace/jumia/products/import/route.test.ts \
  src/app/dashboard/products/use-products-page-actions.test.ts \
  src/scripts/check-product-description-writers.test.ts
pnpm --filter baci-mobile-admin exec vitest run hooks/product-save.test.ts
```

#### Step 5.4: Close writers, reconcile legacy rows under C1, then install the prepared guard and deploy classified feeds

The writer-closure/mobile-RPC migration PR, the reviewed legacy-backfill operator artifact, and the prepared-guard migration PR are separate gates. Never include the prepared migration in the same merge as a writer it depends on: the main workflow applies pending SQL before deploying that merge's application bytes. First deploy the web closure, apply/read back the backwards-compatible mobile RPC replacement, release/verify the new mobile path while old clients remain safe, and prove every writer is dual-writing in production.

While C1 is still additive and before the prepared guard is merged, run `product-description-cutover.ts reconcile --phase pre-guard-backfill` against a fresh explicit-column snapshot. Reuse initial-audit evidence only for rows whose exact description bytes/hash still match. Use C2a/C2b source/hash receipts for later writes. Classify every other changed row only from reviewed evidence; unresolved non-empty descriptions receive conservative `unknown` plus their exact stored-byte hash. Historical evidence-confirmed non-generative descriptions may receive `default` plus their exact current hash during this bounded grandfathering backfill only because the prepared guard is not yet active; record the exact ID/evidence set and operation receipt. No pilot copy enters this backfill, and no trained row may be downgraded.

Generate same-text `SERIALIZABLE` CAS backfill SQL, submit it once through Supabase MCP, and fresh-read every affected row. The transaction must update only exact expected legacy triples, return the exact expected IDs, and record reconciliation/backfill hashes in the deployment ticket. If a concurrent write causes CAS failure, take a new snapshot and regenerate; never weaken a predicate. This historical backfill is not a runtime exception or a reusable default-writing path.

```bash
OGABASSEY_MERCHANT_ID="${OGABASSEY_MERCHANT_ID:?set verified Ogabassey merchant UUID}"
INITIAL_AUDIT_PATH="${INITIAL_AUDIT_PATH:?set reviewed initial audit path}"
INITIAL_AUDIT_SHA256="${INITIAL_AUDIT_SHA256:?set expected initial audit SHA-256}"
pnpm --filter @baci/web exec tsx src/scripts/product-description-cutover.ts reconcile \
  --phase pre-guard-backfill \
  --database-url-env BACI_MIGRATION_DATABASE_URL \
  --merchant-id "$OGABASSEY_MERCHANT_ID" \
  --initial-audit "$INITIAL_AUDIT_PATH" \
  --initial-audit-sha256 "$INITIAL_AUDIT_SHA256" \
  --json-output ../../docs/seo/product-description-pre-guard-staging.json \
  --sql-output ../../docs/seo/product-description-pre-guard-backfill-staging.sql
```

Only after writer-closure and legacy-backfill receipts pass may the separately reviewed prepared-guard migration merge. The existing main workflow applies it as an ordinary pending migration; no dependent application deployment is required for it to be safe. It creates `private.product_description_rollout_state` in `C2_PREPARED`, installs the permanent trigger/function in prepared mode, and starts no timer or write freeze. Prepared mode may still tolerate a byte-identical grandfathered `NULL/NULL` row only if an unexpected row escaped reconciliation, but its installation preflight reports and fails for any real non-empty null/stale source/hash row in the verified Ogabassey scope. It requires every new/changed non-empty description to carry a valid exact source/hash, enforces trained/unknown-source stickiness, and atomically consumes a matching unexpired C1 grant for every new/changed runtime `default` value. A trained/unknown → default grant additionally requires `full_replacement=true` and exact expected-old bindings. Other merchants remain C1-compatible.

After the prepared guard is active, run a read-only `product-description-cutover.ts reconcile --phase pre-switch` verification snapshot. It must produce zero mutation SQL for the already reconciled catalog and must exactly match the pre-guard receipts plus documented subsequent dual-writer changes. Any remaining mutation candidate stops the feed switch and is resolved through an ordinary evidence-bearing writer or, for an independently authored runtime `default`, a fresh one-use C1 grant; the prepared guard is never bypassed.

Do not activate classified feeds until:

- confirmed AI/default and unresolved exact ID sets reconcile;
- every expected legitimate-default ID remains included or has a documented evidence-backed state change;
- all current writers are dual-writing, so subsequent description changes cannot recreate the audit race;
- classifier-versioned cached product data plus all six origin/public candidate responses and cache headers pass.

Before the switch, identify and probe an exact classifier-enforcing rollback deployment that is schema-compatible with C1, prepared mode, and C3; shadow-only or pre-classifier builds are never rollback candidates. Then deploy the already-reviewed exact-head build that changes the shared feed classifier from shadow comparison to enforcement. Production alias/deployment activation is the atomic feed switch; no application route reads private rollout tables and no feature-control RPC is added. Immediately invalidate unclassified product-data/CDN keys, purge Cloudflare, prewarm all six exact production URLs, and verify origin plus public/CDN responses. Task 6 starts only while this classified deployment, the rollback candidate, the prepared guard, and all six production probes are healthy; probe receipts must be less than 10 minutes old at Task 6 start.

Production gate: representative direct, CSV, bulk-update, Bumpa/claimed-job, Jumia, and mobile-admin RPC writes have source/hash readback; prepared-guard and sticky-source tests pass; pre-switch reconciliation/provider/readback hashes are attached; classified feeds have no unexpected valid-default loss and no AI-as-ordinary output. Request/observe the next Google Merchant fetch or reprocessing cycle and attach the account/data-source/item-status receipt when available; provider processing lag is recorded, never treated as a successful diagnostic.

---

### Task 6: Atomically activate C3 and clean up fixtures

**Files:**

- Modify/extend: `supabase/migrations/tests/product_description_provenance_c2.sql`
- Create: `supabase/migrations/tests/product_description_provenance_c3.sql`
- Create: `apps/web/src/scripts/purge-ogabassey-product-evidence.ts`
- Create: `apps/web/src/scripts/purge-ogabassey-product-evidence.test.ts`
- Create evidence: final catalog-validation artifact, state-only C3 SQL/receipt, fixture lifecycle receipts, and Boundary C completion receipt.

Task 6 creates no pending production migration. The prepared-guard schema/trigger/function already arrived through the normal Task 5 migration and the current main-branch automatic migration runner. Task 6 uses reviewed DML against that installed contract; it does not create/replace schema objects, pause a workflow, or depend on another merge.

#### Step 6.1: Preconditions — no timed outage

Do not generate or submit C3 finalization unless all are true:

- the exact prepared-guard migration version is recorded in production and fresh readback shows `state=C2_PREPARED`;
- every web, mobile-admin, public/private RPC, import, bulk and AI description writer in the exact inventory dual-writes and passes production readback;
- the latest CAS reconciliation/backfill receipt covers every current Ogabassey product and no unresolved non-empty row has `NULL/NULL`;
- every source/hash triple is exact; `unknown` rows are allowed only as whole-item feed exclusions;
- the exact classified-feed deployment and its classifier-enforcing rollback deployment are healthy on all six surfaces;
- all pre-classifier cache keys are invalidated;
- C3 state-transition SQL and compensation/incident procedures are reviewed and owner-authorized.

There is no write freeze, 15-minute deadline, compatibility branch, or deployment race. Normal writes continue through the prepared guard. A concurrent catalog change causes exact finalization validation to fail closed and be regenerated later.

#### Step 6.2: Complete fixture activation/deactivation before finalization

With the classified deployment and prepared guard active, run reviewed per-fixture activation SQL one fixture at a time in manifest order. Each result/readback proves one affected fixture ID, exact before/after state, unchanged provenance triple, and no real/nonfixture mutation. Probe all six surfaces after each activation.

Repeat one-at-a-time deactivation in the same order. Build signed aggregates only after all five pass. Before C3, fresh-read all fixture rows and require:

| Fixture | Google | OpenAI/direct/public |
|---|---|---|
| grandfathered `NULL/NULL` | whole item excluded | whole item excluded |
| `unknown` + valid hash | excluded | excluded |
| `default` + valid hash | ordinary description | included plain description |
| trained AI + valid hash | structured description only | included plain description |
| trusted + stale hash | excluded | excluded |

The grandfathered fixture remains the only deliberate non-empty `NULL/NULL` row at this stage and is explicitly resolved by the final CAS preparation before C3. Activation/deactivation evidence never authorizes a real product mutation.

#### Step 6.3: Build a complete final catalog-validation artifact

Immediately before C3, run `product-description-cutover.ts reconcile --phase final-c3` against a fresh explicit-column snapshot ordered by product ID. It consumes the latest pre-switch receipt, prepared-guard migration identity, writer inventory, fixture manifest/deactivation aggregate, classifier deployment identity, and expected valid/excluded ID sets.

The artifact contains every current Ogabassey product:

```text
schema_version,merchant_id,product_id,description_bytes_sha256,
description_digital_source_type,description_provenance_sha256,updated_at,
active,status,feed_classification,is_fixture,row_sha256
```

It fails unless:

- product IDs are unique and the full merchant row count is known;
- every non-empty real description has `default|trained_algorithmic_media|unknown` plus its exact stored-byte hash;
- `default` rows bind trusted non-generative evidence; trained rows were never downgraded without a reviewed one-use attestation;
- empty descriptions are `unknown/NULL`;
- no stale hash or unexpected grandfathered real row remains;
- expected included/excluded feed ID sets match classified origin/public probes;
- all outstanding Ogabassey default-attestation grants are consumed, expired, or explicitly revoked;
- the five fixtures match their manifest and are inactive.

If legitimate writes occur after the snapshot, do not freeze writers. Generate final same-text CAS repair SQL for only the changed eligible rows, submit it through Supabase MCP, fresh-read, and regenerate the entire artifact. No partial artifact or manual waiver may reach C3.

#### Step 6.4: Submit one state-only C3 transaction

Generate deterministic SQL bound to the final artifact's full SHA-256. Submit those unchanged bytes once through the owner-authorized Supabase MCP operation. The `SERIALIZABLE` transaction:

1. locks the singleton rollout-state row;
2. requires `state=C2_PREPARED`, exact merchant, migration version, writer-inventory hash, final-reconciliation hash, classifier deployment/rollback identities, and fixture aggregate hash;
3. locks every current Ogabassey product row in UUID order;
4. requires exact row count, product IDs, description bytes hashes, source/hash triples, `updated_at`, active/status and fixture flags from the final artifact;
5. recomputes each stored-description SHA-256 in PostgreSQL and rejects any mismatch;
6. requires no unresolved non-empty `NULL/NULL` row and no active unconsumed Ogabassey attestation grant; expired/consumed rows remain immutable audit evidence;
7. updates only the singleton state and activation metadata from `C2_PREPARED` to `C3_ACTIVE`;
8. returns the exact state row and catalog aggregate hash.

It does not update a product, install DDL, create a function/trigger, or depend on application deployment during the transaction. Any concurrent change, missing/extra row, hash/source drift, wrong deployment identity, or ambiguous MCP result rolls back the state change. On ambiguous transport, query state and catalog readback before any retry.

In `C3_ACTIVE`, the already-installed trigger enforces:

- empty description → `unknown/NULL`;
- new/changed non-empty description → exact valid source/hash;
- trained source is sticky through ordinary edits;
- every new/changed `default` atomically consumes an exact one-use attestation grant; trained/unknown → `default` additionally requires a reviewed full-replacement grant;
- no non-empty grandfathered `NULL/NULL` row;
- direct authenticated, service-role, mobile RPC and import writes obey the same contract;
- unrelated merchants retain the explicitly tested C1-compatible branch until separately migrated.

Disposable migration tests apply C1, the mobile RPC replacement and prepared-guard migration in the same filename order as `.github/scripts/apply-pending-migrations.sh`; prove that none starts a timer; then test C2-prepared and C3-active behavior, concurrent finalization/write races, sticky AI provenance, direct SQL/service-role enforcement, exact state-only mutation, and replay from the production-old fixture.

#### Step 6.5: Verify feeds, delete fixtures, and close Boundary C

After C3 readback:

1. invalidate classifier-versioned product-data and CDN entries through existing authenticated revalidation and confirmed Cloudflare purge helpers;
2. probe all six origin/public surfaces and require exact expected included/excluded ID sets, classifier header, deployment SHA and cache headers;
3. submit guarded fixture cleanup SQL through Supabase MCP, deleting exact manifest relation IDs then product IDs only after C3;
4. rerun all six probes and prove no fixture marker/ID remains;
5. verify representative web, mobile-admin, import and direct-RPC writes still satisfy C3;
6. seal the Boundary C completion receipt.

On origin failure, only the existing classified CDN response may serve within its declared stale window. Missing/expired classified output returns no-store `503` with `Retry-After: 60`; never fabricate an empty `200`. Rollback is limited to the exact classifier-enforcing deployment already proven compatible with C1/C2/C3. Database state remains C3-active during application rollback.

Boundary C completion records C1/mobile/prepared-guard migration versions, generated-types hash, writer inventory, initial/pre-switch/final reconciliation hashes, CAS operation IDs/readback, classifier/cache/probe receipts, state-only C3 SQL hash/result, fixture lifecycle/cleanup evidence, and exact production deployment identities.

Verify:

```bash
pnpm --filter @baci/web exec vitest run \
  src/scripts/product-description-cutover.test.ts \
  src/scripts/purge-ogabassey-product-evidence.test.ts \
  tools/db/supabase-history-replay-sources.test.ts
pnpm --filter baci-mobile-admin exec vitest run hooks/product-save.test.ts
BACI_MIGRATION_TEST_DATABASE_URL="${BACI_MIGRATION_TEST_DATABASE_URL:?set disposable migration-test URL}"
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c2.sql
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c3.sql
```

---

### Task 7: Refresh treatment eligibility, consume exact proposed copy, and approve manifest + forward SQL

**Files:**

- Modify: `apps/web/src/scripts/ogabassey-pilot-artifacts.ts`
- Modify: `apps/web/src/scripts/ogabassey-pilot-artifacts.test.ts`
- Modify: `apps/web/src/scripts/ogabassey-gsc-evidence.ts` and test.
- Create evidence: refreshed post-Boundary-A treatment-eligibility/preperiod receipt, versioned manifest JSON, exact forward SQL, validation report, owner approval record.

Task 7 consumes the Task 2 proposed-copy artifact by exact path and full hash. It may not accept free-form descriptions, regenerate copy, normalize Unicode, trim text, change source, or reconstruct claims.

Before building the manifest, let `boundary_a_day_1` be the first complete PT day strictly after verified Boundary A production activation and wait until 56 complete finalized PT days beginning at or after that date exist. Re-run the Task 2 request/completeness/cap/canonical contract for the exact intended pre-56 window ending immediately before the proposed forward date. Seal both all-56 and final-28 projections. Recompute every proposed treatment member's exact-model impressions, weighted position, transactional share, fixed eligibility bands, and route status. Every member must still pass treatment eligibility and the 200-impression floor in both candidate measurement windows, each treatment aggregate window must reach 10,000 impressions, and the deterministic eligible set/rank must still yield the same proposed treatment IDs. Otherwise return to Task 2, regenerate the exact proposed-copy artifact where needed, and obtain fresh evidence approval; no stale member or post-hoc substitute enters the manifest. Seal this refreshed receipt and its raw/request hashes for Task 8 reuse.

#### Step 7.1: Build the closed manifest

Manifest closed schema:

```text
schema_version,manifest_id,merchant_id,treatment_signature,
boundary_c_completion_path,boundary_c_completion_sha256,
opportunity_path,opportunity_sha256,research_path,research_sha256,
variant_snapshot_path,variant_snapshot_sha256,
proposed_copy_path,proposed_copy_sha256,product_count,products[]
```

Each product:

```text
pilot_rank,product_id,canonical_page_url,old_description_sha256,
old_source,old_provenance_hash,proposed_description_utf8_base64,
proposed_description_byte_length,proposed_description_sha256,
proposed_source,claim_bindings_sha256,applicability_status,
variant_ids_sha256,compensation_description_utf8_base64,
compensation_description_sha256,compensation_source,
compensation_provenance_sha256
```

Validation:

- exactly the final confirmed 10–20 eligible IDs and ranks;
- one fixed `description-provenance-only-v1` signature;
- every product has `applicability_status=complete`;
- proposed bytes/hash/source equal Task 2 byte-for-byte and `proposed_source=trained_algorithmic_media` for every pilot row;
- all claim IDs resolve to evidence and complete applicability;
- no metadata, title, category, spec, price, availability, variant, image, or canonical change;
- fresh current description/source/hash still equal the expected old triple;
- fresh complete variant IDs, normalized attributes, and product/variant conditions still hash exactly to the proposed-copy variant snapshot;
- every row has the same verified Boundary C completion.

Compensation target is precomputed:

- if old source/hash is C3-valid, restore exact old bytes/source/hash. Task 8 derives `requires_default_grant` exactly when the closed manifest's `compensation_source == 'default'`; no redundant Boolean is stored, and the short-lived grant is intentionally created only if compensation is authorized;
- for grandfathered/unknown legacy text, restore semantic old description bytes with `unknown` + exact current-description hash, never impossible post-C3 `NULL` provenance;
- use a trusted source only when the reviewed historical evidence supports it. The manifest is not itself a default grant and no forward or compensation SQL may bypass C3 grant consumption.

#### Step 7.2: Generate deterministic forward SQL

The generator decodes the proposed base64 to exact UTF-8 inside SQL and verifies decoded byte length/hash before writing. SQL is deterministic for the manifest bytes and:

1. `BEGIN ISOLATION LEVEL SERIALIZABLE`;
2. verifies exact Ogabassey merchant and `C3_ACTIVE`;
3. locks products by UUID ascending;
4. checks exact old description/source/hash CAS for every row;
5. checks protected fields and relation-set hashes named in the manifest;
6. updates only description, source, provenance hash, and normal `updated_at`;
7. returns exact ordered IDs and new triples;
8. verifies returned ID set equals manifest IDs;
9. commits.

Any missing/extra product, ownership drift, changed old triple, protected-field drift, applicability/hash mismatch, or returned-ID mismatch aborts the whole transaction.

Generate to a new timestamped filename and compute full SHA-256. A regeneration produces a different filename/hash and requires fresh approval; it does not silently supersede approved SQL.

#### Step 7.3: Owner approval

The owner reviews:

- exact manifest path/hash;
- exact proposed-copy path/hash;
- every proposed rendered description and source;
- variant/condition applicability report;
- exact SQL path/hash and validation report;
- compensation targets;
- Boundary C completion path/hash.

Record approval in the reviewed PR and deployment ticket. Approval is invalid if any named hash changes. Treatment IDs are fixed only by this approval.

Verify:

```bash
MANIFEST_INPUTS="${MANIFEST_INPUTS:?set reviewed JSON containing exact paths and hashes}"
pnpm --filter @baci/web exec vitest run src/scripts/ogabassey-pilot-artifacts.test.ts
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts manifest \
  --inputs "$MANIFEST_INPUTS" \
  --manifest-output ../../docs/seo/ogabassey-product-write-manifest-staging.json \
  --sql-output ../../docs/seo/ogabassey-product-write-staging.sql
shasum -a 256 \
  docs/seo/ogabassey-product-write-manifest-staging.json \
  docs/seo/ogabassey-product-write-staging.sql
```

Tests pin exact UTF-8/base64 decoding, non-ASCII bytes, claim/applicability binding, trained-only pilot source, 9/10/20/21 counts, stale old triple, C3-invalid compensation target, `requires_default_grant` derivation if and only if `compensation_source == 'default'`, protected-field CAS, SQL determinism, and no proposed-copy mutation.

---

### Task 8: Build deterministic controls, execute once, and preserve C3-valid recovery

**Files:**

- Modify: `apps/web/src/scripts/ogabassey-gsc-evidence.ts` and test.
- Modify: `apps/web/src/scripts/ogabassey-pilot-artifacts.ts` and test.
- Use: `apps/web/src/scripts/purge-ogabassey-product-evidence.ts` and test.
- Create evidence: control preperiod raw/receipts with fixed 28/56-day baseline projections, candidate snapshot, cohort-only canonical map, cohort JSON, cohort approval, Generative AI and Merchant item-status baselines when measurable, forward cohort-fingerprint/provider/readback/purge completion, and compensation artifacts only if needed.

#### Step 8.1: Freeze post-A/pre-B control evidence

Do not mix the Boundary A rollout into the description pilot's preperiod. Consume the exact Task 7 refreshed treatment/preperiod receipt by full hash, verify its proposed forward PT date is still usable, and reuse its complete finalized daily responses rather than issuing a second inconsistent treatment extraction. At one cutoff, capture/derive:

1. the exact 56 complete finalized PT days ending on the PT day immediately before the declared forward-execution date, all on or after `boundary_a_day_1`;
2. a current merchant catalog/route/feed-availability candidate snapshot;
3. family/parent/brand/model/canonical-page relationships;
4. query-overlap/cannibalization evidence.

Use the Task 2 GSC contract. `first_incomplete_date` is optional:

- present → cutoff/window end must be before it;
- absent → record `no_incomplete_points_in_requested_range`; do not derive a boundary;
- in both cases, every day has a separate `dataState=final` request and terminal-pagination receipt.

Every additional control daily extraction also obeys the Task 2 provider-cap rule; any full second 25,000-row page or total `>=50,000` rejects the entire control/preperiod artifact. Task 8 verifies the reused Task 7 treatment rows/hashes, manifest IDs, dates, and eligibility result exactly. If the intended forward date slips so the sealed interval is no longer the immediately preceding 56 complete PT days, return to Task 7 and regenerate approval rather than rolling the window silently.

The preperiod artifact seals two non-overridable baseline projections from the same daily rows:

```text
forward_execution_date_pt,pre56_start_pt,pre56_end_pt,pre56_date_list_sha256,
pre56_source_sha256,pre56_projection_sha256,pre28_start_pt,pre28_end_pt,
pre28_date_list_sha256,pre28_source_sha256,pre28_projection_sha256
```

`pre56` is all 56 ordered complete PT days. `pre28` is exactly the final 28 ordered days of `pre56`; it cannot be a separately selected slice. The forward SQL captures `forward_cutoff_database_utc=clock_timestamp()` immediately before its first mutation; that timestamp must translate to `forward_execution_date_pt`. Do not schedule within 10 minutes of PT midnight. If the database-time preflight is on another PT date, do not submit; regenerate the preperiod/candidate/cohort artifacts and obtain fresh cohort approval before writing. If the returned cutoff unexpectedly differs despite preflight, measurement is invalid and the incident/compensation decision runs from the forward receipt.

For treatment/control candidate projection, materialize zero rows for a product-day only after its exact page-filtered finalized request completed with terminal empty pagination. Missing requests/pages abort; sparse zero-row days do not.

Product-level projection:

- one row per product;
- sum clicks/impressions;
- CTR null at zero impressions;
- impression-weighted position null at zero impressions;
- exact-model, transactional, and broad-head shares use the same frozen classifiers/denominators as Task 2;
- current position domain for both treatment and controls is `<=15.000000`;
- sort by product ID and record projection/classifier/same-cutoff candidate-snapshot hashes.

Matched-field authority is fixed:

| Matching field | Sole source |
|---|---|
| primary category segment, route/feed validity, parent ID, brand/model family | same-cutoff merchant catalog/route/feed snapshot |
| position, impressions, CTR, exact-model share | 56-day finalized GSC product projection |
| canonical page | same-cutoff candidate snapshot, verified against the Task 2 route contract |
| query overlap/cannibalization | same 56-day page/query rows using the frozen normalizer/classifier |
| prior intervention | manifest/history receipt cutoff |

No current live query or post-treatment value may replace a hash-approved matching field.

#### Step 8.2: Match controls one-to-one with preperiod data only

Exclude:

- treatment IDs;
- same parent product;
- same normalized model family when it could cannibalize;
- canonical-page/query overlap above the frozen threshold;
- route/category/feed invalidity;
- missing required matching metrics;
- prior description intervention during the preperiod.

Exact bins/calipers:

- same primary category segment;
- same position band: `[1,3]`, `(3,5]`, `(5,10]`, `(10,15]`;
- absolute mean-position distance `<=2.000000`;
- absolute log1p(impressions) distance `<=0.75`;
- absolute preperiod CTR distance `<=0.050000`;
- exact-model impression share distance `<=0.20`.

Stable algorithm:

1. treatments in final pilot rank, then product ID;
2. eligible controls not already used;
3. distance = sum of normalized position, log-impression, CTR, and exact-share distances;
4. smallest distance;
5. ties by higher impressions, then product ID;
6. no replacement.

Record all candidates, exclusions, distance components, selected control, and unmatched reason. Record candidate/cohort full hashes and matcher version. Require at least 10 complete pairs; if an approved treatment is unmatched, stop rather than silently changing treatment. Changing treatment IDs requires a new manifest/proposed-copy/SQL approval. A matcher-only correction with unchanged treatments requires fresh cohort approval but not regenerated SQL.

After matching and before cohort approval, the same command creates a sealed `cohort_canonical_map` containing **exactly** the selected treatment and control IDs and no others. Its closed rows are:

```text
map_version,merchant_id,pair_id,cohort_role,product_id,canonical_page_url,
route_status,canonical_target,checked_at_utc,row_sha256
```

Require `member_count=2 × pair_count`, unique product IDs, unique canonical URLs, exact ordered membership equality with the cohort, status 200, and canonical target equal to `canonical_page_url`. The map header binds the manifest hash, candidate-snapshot hash, and ordered-membership hash; the cohort binds the resulting full cohort-map SHA-256. The Task 2 opportunity map is not reused as the measurement map. Unrelated catalog rows and later unrelated product additions are outside this cohort map and cannot invalidate it.

The owner approves both the cohort hash and cohort-map hash and confirms:

```text
ordered cohort pilot IDs == ordered manifest product IDs
cohort canonical-map IDs == treatment IDs ∪ control IDs
```

Direct commands:

```bash
MANIFEST_PATH="${MANIFEST_PATH:?set approved manifest path}"
MANIFEST_SHA256="${MANIFEST_SHA256:?set approved manifest SHA-256}"
GSC_TOKEN="${GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN:?set readonly Search Console token}"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-gsc-evidence.ts controls \
  --property sc-domain:ogabassey.com \
  --oauth-token-env GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN \
  --manifest "$MANIFEST_PATH" \
  --manifest-sha256 "$MANIFEST_SHA256" \
  --preperiod-output ../../docs/seo/ogabassey-control-preperiod-staging.json \
  --snapshot-output ../../docs/seo/ogabassey-control-candidates-staging.json \
  --family-output ../../docs/seo/ogabassey-control-families-staging.json
CONTROL_PREPERIOD_SHA256="$(shasum -a 256 docs/seo/ogabassey-control-preperiod-staging.json | awk '{print $1}')"
CONTROL_SNAPSHOT_SHA256="$(shasum -a 256 docs/seo/ogabassey-control-candidates-staging.json | awk '{print $1}')"
CONTROL_FAMILY_SHA256="$(shasum -a 256 docs/seo/ogabassey-control-families-staging.json | awk '{print $1}')"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts match-controls \
  --manifest "$MANIFEST_PATH" \
  --manifest-sha256 "$MANIFEST_SHA256" \
  --preperiod ../../docs/seo/ogabassey-control-preperiod-staging.json \
  --preperiod-sha256 "$CONTROL_PREPERIOD_SHA256" \
  --snapshot ../../docs/seo/ogabassey-control-candidates-staging.json \
  --snapshot-sha256 "$CONTROL_SNAPSHOT_SHA256" \
  --families ../../docs/seo/ogabassey-control-families-staging.json \
  --families-sha256 "$CONTROL_FAMILY_SHA256" \
  --cohort-map-output ../../docs/seo/ogabassey-cohort-canonical-map-staging.json \
  --output ../../docs/seo/ogabassey-control-cohort-staging.json
```

The first command validates and prints full output hashes; the recomputation above must match before the second command. The second validates and prints both cohort and cohort-map hashes. Crossing a PR/worktree/host boundary between commands requires committing/attaching the outputs first.

#### Step 8.3: Execute the unchanged SQL once

Immediately before submission:

- recompute manifest, proposed-copy, SQL, cohort, cohort-map, Task 8 preperiod, and Boundary C hashes;
- re-fetch every bound evidence source under its fixed volatility window, rebuild the evidence/applicability/proposed-copy artifacts, and require byte-for-byte equality with the owner-approved manifest; any changed, expired, unavailable, or contradictory evidence stops and returns to Task 7 for regeneration and fresh approval;
- verify the actual database/PT date matches the sealed `forward_execution_date_pt` and the 56-day interval ends on the immediately preceding complete PT day;
- fresh-read and hash every treatment **and control** old triple, `updated_at`, active/status/canonical fields, and complete variant/attribute/condition applicability snapshot; this is the immediate pre-execution cohort check;
- confirm C3 active and no fixture remains;
- confirm exact pilot/cohort equality;
- confirm deployment ticket approval is current.

If the dedicated Google Generative AI report is available, capture both possible treatment baselines before submitting SQL: the exact immediately preceding 28 complete, non-dotted PT days and all exact immediately preceding 56 complete, non-dotted PT days. For each, export the unfiltered property chart plus Pages table, then make one exact canonical-URL-filtered export per cohort member so the filtered chart is explicitly URL-aggregated rather than property-aggregated. Save every configuration screenshot and immutable chart/table hash; bind the cohort-map hash and record suppression/truncation. If the report is no longer available or an exact prewindow cannot be exported, mark that window `google_generative_ai_visibility=unmeasured`; this secondary-lane failure does not alter the preregistered Search results `type=web` execution decision and must not be replaced by a proxy.

Also capture the pre-forward Google Merchant item-status baseline for every exact cohort offer/item ID after the classified feed has been processed. Record account/data-source IDs, fetch/processing UTC and status, item ID, product/variant ID mapping, country/language, approval/disapproval/pending state, issue codes, and export/API response hash. A still-processing or unmapped item blocks only Merchant-diagnostic comparison; it is never converted to approved. Existing unrelated item issues are retained as baseline facts. Merchant diagnostics are a feed-health/compliance lane, not evidence of organic ranking, generative-AI visibility, clicks, or citations.

Submit the exact Task 7 approved SQL bytes once through Supabase MCP. The one `SERIALIZABLE` catalog-write transaction remains treatment-only: it locks treatment rows in deterministic ID order, CAS-verifies the approved pre-write values, mutates only treatment descriptions, and returns exact treatment post-forward fields plus its database cutoff timestamp. Controls are never written. Record provider operation ID/status, submitted SQL SHA-256, database transaction result/cutoff timestamp, ordered returned IDs, and fresh explicit-column readback. If MCP outcome is ambiguous, query readback before retry; never submit a second mutation without proving the first did not commit.

Immediately after commit, fresh-read every treatment/control product and complete variant/applicability snapshot again. Require exact equality with the immediate pre-execution cohort check, except for the approved treatment description/source/hash and corresponding treatment `updated_at` returned by the forward transaction. Any control change, variant/condition/applicability change, status/canonical change, unexpected treatment-field change, or row timestamp after the cutoff that is not the approved treatment mutation invalidates execution evidence and stops measurement.

Immediately seal one forward cohort-fingerprint artifact for **every** treatment and control member:

```text
schema_version,forward_cutoff_database_utc,forward_execution_date_pt,manifest_sha256,
cohort_sha256,cohort_canonical_map_sha256,task8_preperiod_sha256,
product_id,pair_id,cohort_role,description_bytes_sha256,
description_digital_source_type,description_provenance_sha256,product_updated_at,
variant_condition_applicability_snapshot_sha256,active,status,canonical_page_url,
member_fingerprint_sha256
```

The applicability snapshot includes the full ordered selectable/nonselectable variant set, complete attribute maps, offer conditions/details, and their active/deleted/availability flags. Fresh route probes supply canonical status; immediate database readback must equal the transaction return. Any mismatch stops before measurement. Sort members by pair/role/product ID and require exact equality with cohort-map membership. The fingerprint artifact and full SHA-256 are part of the forward completion receipt.

Build an affected-ID JSON from returned IDs, then run:

```bash
AFFECTED_IDS="${AFFECTED_IDS:?set exact reviewed affected-ID JSON}"
AFFECTED_IDS_SHA256="${AFFECTED_IDS_SHA256:?set expected affected-ID SHA-256}"
FORWARD_RECEIPT="${FORWARD_RECEIPT:?set exact Supabase operation/readback receipt}"
FORWARD_RECEIPT_SHA256="${FORWARD_RECEIPT_SHA256:?set expected forward receipt SHA-256}"
OGABASSEY_ORIGIN_BASE_URL="${OGABASSEY_ORIGIN_BASE_URL:?set verified origin URL}"
OGABASSEY_PUBLIC_BASE_URL="${OGABASSEY_PUBLIC_BASE_URL:?set verified public URL}"
pnpm --filter @baci/web exec tsx src/scripts/purge-ogabassey-product-evidence.ts \
  --operation forward \
  --affected-ids "$AFFECTED_IDS" \
  --affected-ids-sha256 "$AFFECTED_IDS_SHA256" \
  --operation-receipt "$FORWARD_RECEIPT" \
  --operation-receipt-sha256 "$FORWARD_RECEIPT_SHA256" \
  --origin-base-url "$OGABASSEY_ORIGIN_BASE_URL" \
  --public-base-url "$OGABASSEY_PUBLIC_BASE_URL" \
  --output ../../docs/seo/ogabassey-forward-purge-staging.json
```

The script uses the existing URL builder, awaits `purgeCloudflareUrlsConfirmed`, calls authenticated feed revalidation, and performs fresh-origin/public PDP plus six-surface feed probes. It validates merchant and exact returned IDs. The normal fire-and-forget helper remains unchanged. Measurement cannot start until purge/probe completion is successful.

#### Step 8.4: Generate compensation only after a real need

Do not install a function or clone the production catalog. The forward manifest already contains reviewed C3-valid compensation targets and the generator has migration-test coverage before forward approval.

If safety/performance requires compensation:

1. capture fresh explicit-column readback for exact manifest IDs, current triples, ownership, protected fields, and directly protected relation hashes;
2. run `ogabassey-pilot-artifacts.ts compensation` with manifest + forward receipt + fresh readback;
3. generator requires current rows equal the exact successful forward state and emits a deterministic compensation intent plus SQL template. For every target whose restored source is `default`, the intent binds exact product/merchant/operation IDs, current trained triple, complete restored UTF-8 bytes/hash, `full_replacement=true`, purpose `pilot_compensation`, and the expected one-use grant slot; trained/unknown restores require no default grant;
4. obtain fresh, short-lived incident approval in the deployment ticket naming the forward receipt, readback, compensation intent/template hashes, exact default targets, incident ID, approver, approval UTC, and expiry;
5. only after that approval, the trusted operator path requests one C1 grant per exact `default` target. Bind the returned grant IDs/receipts into the final deterministic `SERIALIZABLE` compensation SQL and recompute its hash. A missing, mismatched, expired, already-consumed, or unapproved grant fails closed; never substitute `default` without a grant or downgrade a historically default target merely to make compensation pass;
6. run the final exact SQL in the disposable migration-test database populated with representative target rows and matching one-use grants; test success, atomic grant consumption, and zero-mutation failures for wrong merchant, missing/extra ID, intervening triple edit, protected-field drift, relation drift, returned-ID mismatch, absent/mismatched/expired/replayed grant, and any C3-invalid target;
7. obtain final execution approval naming the bound grant receipt hashes, final SQL hash, test report, incident ID, approver, approval UTC, and expiry. Before submission, reverify all hashes, current database time before every grant/approval expiry, and fresh production CAS readback;
8. submit exact SQL once through Supabase MCP and run the same affected-ID purge/revalidation/probes with `--operation compensation`.

Forward approval revocation does not block an independently approved incident compensation. Any CAS failure leaves current data untouched and the incident open.

Verify:

```bash
pnpm --filter @baci/web exec vitest run \
  src/scripts/ogabassey-gsc-evidence.test.ts \
  src/scripts/ogabassey-pilot-artifacts.test.ts \
  src/scripts/purge-ogabassey-product-evidence.test.ts
```

Tests cover deterministic matching/no replacement, every caliper boundary, family/cannibalization exclusion, unmatched reasons, manifest/cohort equality, cohort-map exact membership/URL uniqueness, rejection of missing/extra/redirected cohort routes, tolerance of unrelated catalog additions, exact 56-day interval and final-28 derivation, execution-date slip rejection, provider-cap propagation, pre/post cohort fingerprint equality with only the approved treatment mutation allowed, SQL CAS/returned IDs, ambiguous provider outcome readback, purge failure, C3-valid trained/unknown compensation, exact one-use grant binding and atomic consumption for restored `default`, and all zero-mutation compensation failures.

---

### Task 9: Measure Search CTR, provider-specific AI visibility, and Merchant feed health without proxy claims

**Files:**

- Modify: `apps/web/src/scripts/ogabassey-gsc-evidence.ts`
- Modify: `apps/web/src/scripts/ogabassey-gsc-evidence.test.ts`
- Create: `apps/web/src/scripts/ogabassey-pilot-analysis.ts`
- Create: `apps/web/src/scripts/ogabassey-pilot-analysis.test.ts`
- Create evidence: day-14 and pre-extraction/pre-analysis cohort-integrity receipts, day-28 raw/request receipts/outcomes/analysis; optional day-56 integrity/extraction evidence; dedicated Google Generative AI chart/Pages exports and configuration screenshots when available; exact-cohort Merchant item-status follow-up and diff; owner decision.

#### Cohort-integrity checkpoint contract

Use the existing `ogabassey-pilot-artifacts.ts cohort-fingerprint` mode; do not create a monitor or state service. It consumes the sealed forward fingerprint, cohort, cohort map, exact database connection environment, and fresh route probes. Allowed `--phase` values are exactly `day14|day28-pre-extraction|day28-pre-analysis|day56-pre-extraction|day56-pre-analysis`.

Each closed receipt records phase, database/probe UTCs, forward-fingerprint/cohort/cohort-map hashes, ordered member count, expected and actual aggregate fingerprint hashes, and per-member exact fields/diffs. It recomputes description bytes hash, source/hash, product `updated_at`, full variant/attribute/condition applicability snapshot hash, active/status, and canonical URL for every treatment and control. Exact equality to the forward fingerprint is required. A missing/extra member or any drift invalidates measurement and stops; unrelated products are neither queried nor compared.

```bash
PHASE="${PHASE:?set one allowed cohort-integrity phase}"
BACI_MIGRATION_DATABASE_URL="${BACI_MIGRATION_DATABASE_URL:?set read-capable migration database URL}"
FORWARD_FINGERPRINT_PATH="${FORWARD_FINGERPRINT_PATH:?set sealed forward cohort-fingerprint path}"
FORWARD_FINGERPRINT_SHA256="${FORWARD_FINGERPRINT_SHA256:?set expected forward fingerprint SHA-256}"
COHORT_PATH="${COHORT_PATH:?set reviewed cohort path}"
COHORT_SHA256="${COHORT_SHA256:?set expected cohort SHA-256}"
COHORT_MAP_PATH="${COHORT_MAP_PATH:?set reviewed cohort map path}"
COHORT_MAP_SHA256="${COHORT_MAP_SHA256:?set expected cohort-map SHA-256}"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts cohort-fingerprint \
  --phase "$PHASE" \
  --database-url-env BACI_MIGRATION_DATABASE_URL \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --cohort "$COHORT_PATH" \
  --cohort-sha256 "$COHORT_SHA256" \
  --cohort-map "$COHORT_MAP_PATH" \
  --cohort-map-sha256 "$COHORT_MAP_SHA256" \
  --output "../../docs/seo/ogabassey-${PHASE}-cohort-integrity-staging.json"
```

Tests invoke the displayed command with each allowed phase, reject any other phase, and cover treatment/control description, source, provenance hash, `updated_at`, storage/RAM/connectivity/colour/condition, variant add/remove/activation, product status/active, and canonical drift. They prove unrelated product additions/changes do not alter the receipt.

#### Step 9.1: Run the 14-day safety review

Verify indexability, canonical selection, rendered summary, exact proposed copy, variant/condition claim accuracy, Product structured data, Google/OpenAI feed provenance, Merchant warnings, query cannibalization, add-to-cart/purchase behavior, and purge freshness.

Run and seal the `day14` cohort-integrity checkpoint first. Any drift is an explicit contamination stop: report safety impact separately, but do not continue to outcome measurement or claim treatment effect.

Immediate compensation/fix triggers:

- factual or variant-applicability corruption;
- hidden/duplicate copy;
- canonical/noindex regression;
- invalid Product data;
- material classified-feed loss;
- broken purchase behavior.

Conversion is descriptive only and is not a retain/revert statistic. If reported, assign each purchase exactly once to the latest eligible same-product session before purchase within the declared window; require `converted_sessions <= eligible_sessions` and prevent cross-product/double attribution.

#### Step 9.2: Capture day 1–28 outcomes

Post day 1 is the first complete PT day strictly after the forward completion database timestamp. Before any daily request, load the exact approved Task 8 cohort map by path and full SHA-256, then make fresh route probes for every member. Require status 200, the same canonical URL/target, and the expected merchant; any cohort route or canonical drift stops extraction, while unrelated catalog additions/changes are ignored.

Run and seal `day28-pre-extraction` immediately before the first API request. Every daily request obeys the provider-cap contract; a full second page or total `>=50,000` stops the complete day-28 extraction.

For each cohort product and each of the 28 days:

- make an exact canonical-page-filtered `dataState=final` Search Analytics request;
- paginate to terminal empty response;
- retain raw response and request/page receipts;
- verify the same cohort-map and query-classifier hashes as Task 8.

Also make the range availability probe with `dataState=all`, grouped by date:

- when `first_incomplete_date` is present, day 28 must be earlier;
- when absent/null, record `no_incomplete_points_in_requested_range` and rely on the per-day final receipts;
- never derive `finalized_through_date` from null.

After complete requests, materialize zeros for absent product-days. A cohort member with 28 valid zero-row daily requests has complete evidence with zero impressions; it later fails the statistical impression floor, not extraction completeness. Missing request/terminal page fails extraction.

Outcome row:

```text
pair_id,product_id,cohort_role,window_role,window_days,period_start,period_end,
exact_model_clicks,exact_model_impressions,exact_model_ctr,
impression_weighted_position,materialized_zero_days,cohort_canonical_map_sha256,
query_classifier_sha256,cohort_sha256,task8_preperiod_sha256,
baseline_start_pt,baseline_end_pt,baseline_date_list_sha256,baseline_source_sha256,
baseline_projection_sha256,
forward_cutoff_database_utc,forward_fingerprint_sha256,day14_integrity_sha256,
pre_extraction_integrity_sha256,evidence_sha256
```

For `day28`, pre rows are only the sealed Task 8 `pre28` projection: the exact final 28 complete PT days immediately before the forward-execution date. For `extend56`, pre rows are only Task 8 `pre56`: all exact 56 complete PT days immediately before that date. Bind their start/end dates, ordered date-list hash, source hash, and projection hash. Post windows contain exactly 28 or 56 complete PT days respectively. Reject a leading/middle 28-day slice, a recomputed alternative, an unequal interval, a gap/overlap, or any date/projection hash mismatch.

Post rows come only from post API evidence. Require one pilot/control pre/post row per pair, exact cohort IDs, and stable cohort-map/classifier. Each outcome row binds the forward fingerprint, day-14 check, and its immediately preceding extraction check. Run and seal `day28-pre-analysis` after outcomes are built and immediately before analysis; the analysis artifact binds that fresh check plus all outcome identities. Any mapped member drift stops; a nonmember catalog or route change is irrelevant.

The producer has exactly two closed branches: `day28` and `extend56`. `day28` rejects a day-28 analysis input; `extend56` requires the exact insufficient day-28 artifact/hash and rejects any other status or prior extension. Neither branch accepts an arbitrary caller-selected window.

#### Step 9.3: Apply fixed data minimums and optional extension

Day 28 is data-sufficient only when:

- at least 10 complete matched pairs remain;
- every treatment/control member has at least 200 exact-model impressions in each pre/post window;
- each aggregate cell (`pilot-pre`, `pilot-post`, `control-pre`, `control-post`) has at least 10,000 exact-model impressions.

A below-floor member excludes the entire pair with a reason. Zero-impression CTR/position remains null, never zero-filled for analysis.

If and only if the hash-approved day-28 analysis is `insufficient-data`, the owner may approve one extension in the existing deployment ticket. The approval names the day-28 artifact/hash, cohort/hash, Task 8 preperiod/hash, cohort-map/hash, classifier/hash, requested days 29–56, and `extension_count=1`.

There is no extension state machine. One designated operator:

1. verifies no prior extension attachment/decision exists for the exact cohort and forward receipt;
2. runs the finality probe without extracting rows; once finality passes, runs and seals a fresh `day56-pre-extraction` checkpoint;
3. runs the `extend56` branch with `--day28-analysis` and expected full hashes, fetching only days 29–56 and never replacing days 1–28;
4. applies the same provider-cap/optional-boundary/per-day-final/pagination/zero-materialization rules and freshly probes every exact cohort-map route before extraction;
5. combines the two immutable post segments with the exact sealed Task 8 `pre56` projection, then runs and seals `day56-pre-analysis` immediately before analysis;
6. analysis consumes both day-56 checks and the forward fingerprint; attach exact bytes/hashes and mark the ticket extension consumed.

An early probe with a present boundary at/before day 56 or incomplete daily-final request returns `waiting-finality` and performs no outcomes/analysis. The same operator retries later under the same ticket approval. An absent `first_incomplete_date` is valid only with all 28 per-day final requests and terminal receipts. A second completed extraction or `extension_count>1` is rejected by artifact validation and ticket review.

Displayed commands:

```bash
COHORT_PATH="${COHORT_PATH:?set reviewed cohort path}"
COHORT_SHA256="${COHORT_SHA256:?set expected cohort SHA-256}"
COHORT_MAP_PATH="${COHORT_MAP_PATH:?set reviewed cohort canonical-map path}"
COHORT_MAP_SHA256="${COHORT_MAP_SHA256:?set expected cohort canonical-map SHA-256}"
TASK8_PREPERIOD_PATH="${TASK8_PREPERIOD_PATH:?set reviewed Task 8 preperiod path}"
TASK8_PREPERIOD_SHA256="${TASK8_PREPERIOD_SHA256:?set expected Task 8 preperiod SHA-256}"
BACI_MIGRATION_DATABASE_URL="${BACI_MIGRATION_DATABASE_URL:?set read-capable migration database URL}"
FORWARD_FINGERPRINT_PATH="${FORWARD_FINGERPRINT_PATH:?set sealed forward fingerprint path}"
FORWARD_FINGERPRINT_SHA256="${FORWARD_FINGERPRINT_SHA256:?set expected forward fingerprint SHA-256}"
DAY14_INTEGRITY_PATH="${DAY14_INTEGRITY_PATH:?set sealed day-14 integrity path}"
DAY14_INTEGRITY_SHA256="${DAY14_INTEGRITY_SHA256:?set expected day-14 integrity SHA-256}"
PRE_EXTRACTION_INTEGRITY_PATH="${PRE_EXTRACTION_INTEGRITY_PATH:?set sealed day28-pre-extraction path}"
PRE_EXTRACTION_INTEGRITY_SHA256="${PRE_EXTRACTION_INTEGRITY_SHA256:?set expected day28-pre-extraction SHA-256}"
GSC_TOKEN="${GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN:?set readonly Search Console token}"
pnpm --filter @baci/web exec vitest run \
  src/scripts/ogabassey-gsc-evidence.test.ts \
  src/scripts/ogabassey-pilot-analysis.test.ts
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-gsc-evidence.ts day28 \
  --property sc-domain:ogabassey.com \
  --oauth-token-env GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN \
  --cohort "$COHORT_PATH" \
  --cohort-sha256 "$COHORT_SHA256" \
  --cohort-map "$COHORT_MAP_PATH" \
  --cohort-map-sha256 "$COHORT_MAP_SHA256" \
  --task8-preperiod "$TASK8_PREPERIOD_PATH" \
  --task8-preperiod-sha256 "$TASK8_PREPERIOD_SHA256" \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --day14-integrity "$DAY14_INTEGRITY_PATH" \
  --day14-integrity-sha256 "$DAY14_INTEGRITY_SHA256" \
  --pre-extraction-integrity "$PRE_EXTRACTION_INTEGRITY_PATH" \
  --pre-extraction-integrity-sha256 "$PRE_EXTRACTION_INTEGRITY_SHA256" \
  --output-dir ../../docs/seo \
  --outcomes-output ../../docs/seo/ogabassey-pilot-outcomes-day28-staging.csv
DAY28_OUTCOMES_SHA256="$(shasum -a 256 docs/seo/ogabassey-pilot-outcomes-day28-staging.csv | awk '{print $1}')"
PRE_ANALYSIS_INTEGRITY_PATH="../../docs/seo/ogabassey-day28-pre-analysis-cohort-integrity-staging.json"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts cohort-fingerprint \
  --phase day28-pre-analysis \
  --database-url-env BACI_MIGRATION_DATABASE_URL \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --cohort "$COHORT_PATH" \
  --cohort-sha256 "$COHORT_SHA256" \
  --cohort-map "$COHORT_MAP_PATH" \
  --cohort-map-sha256 "$COHORT_MAP_SHA256" \
  --output "$PRE_ANALYSIS_INTEGRITY_PATH"
PRE_ANALYSIS_INTEGRITY_SHA256="$(shasum -a 256 docs/seo/ogabassey-day28-pre-analysis-cohort-integrity-staging.json | awk '{print $1}')"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-analysis.ts \
  --outcomes ../../docs/seo/ogabassey-pilot-outcomes-day28-staging.csv \
  --outcomes-sha256 "$DAY28_OUTCOMES_SHA256" \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --pre-analysis-integrity "$PRE_ANALYSIS_INTEGRITY_PATH" \
  --pre-analysis-integrity-sha256 "$PRE_ANALYSIS_INTEGRITY_SHA256" \
  --output ../../docs/seo/ogabassey-pilot-analysis-day28-staging.json
```

Extension command, only after the ticket approval:

```bash
DAY28_ANALYSIS_PATH="${DAY28_ANALYSIS_PATH:?set reviewed insufficient day-28 analysis path}"
DAY28_ANALYSIS_SHA256="${DAY28_ANALYSIS_SHA256:?set expected full day-28 analysis SHA-256}"
COHORT_PATH="${COHORT_PATH:?set reviewed cohort path}"
COHORT_SHA256="${COHORT_SHA256:?set expected cohort SHA-256}"
COHORT_MAP_PATH="${COHORT_MAP_PATH:?set reviewed cohort canonical-map path}"
COHORT_MAP_SHA256="${COHORT_MAP_SHA256:?set expected cohort canonical-map SHA-256}"
TASK8_PREPERIOD_PATH="${TASK8_PREPERIOD_PATH:?set reviewed Task 8 preperiod path}"
TASK8_PREPERIOD_SHA256="${TASK8_PREPERIOD_SHA256:?set expected Task 8 preperiod SHA-256}"
BACI_MIGRATION_DATABASE_URL="${BACI_MIGRATION_DATABASE_URL:?set read-capable migration database URL}"
FORWARD_FINGERPRINT_PATH="${FORWARD_FINGERPRINT_PATH:?set sealed forward fingerprint path}"
FORWARD_FINGERPRINT_SHA256="${FORWARD_FINGERPRINT_SHA256:?set expected forward fingerprint SHA-256}"
DAY14_INTEGRITY_PATH="${DAY14_INTEGRITY_PATH:?set sealed day-14 integrity path}"
DAY14_INTEGRITY_SHA256="${DAY14_INTEGRITY_SHA256:?set expected day-14 integrity SHA-256}"
PRE_EXTRACTION_INTEGRITY_PATH="${PRE_EXTRACTION_INTEGRITY_PATH:?set sealed day56-pre-extraction path}"
PRE_EXTRACTION_INTEGRITY_SHA256="${PRE_EXTRACTION_INTEGRITY_SHA256:?set expected day56-pre-extraction SHA-256}"
GSC_TOKEN="${GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN:?set readonly Search Console token}"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-gsc-evidence.ts extend56 \
  --property sc-domain:ogabassey.com \
  --oauth-token-env GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN \
  --day28-analysis "$DAY28_ANALYSIS_PATH" \
  --expected-day28-sha256 "$DAY28_ANALYSIS_SHA256" \
  --cohort "$COHORT_PATH" \
  --cohort-sha256 "$COHORT_SHA256" \
  --cohort-map "$COHORT_MAP_PATH" \
  --cohort-map-sha256 "$COHORT_MAP_SHA256" \
  --task8-preperiod "$TASK8_PREPERIOD_PATH" \
  --task8-preperiod-sha256 "$TASK8_PREPERIOD_SHA256" \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --day14-integrity "$DAY14_INTEGRITY_PATH" \
  --day14-integrity-sha256 "$DAY14_INTEGRITY_SHA256" \
  --pre-extraction-integrity "$PRE_EXTRACTION_INTEGRITY_PATH" \
  --pre-extraction-integrity-sha256 "$PRE_EXTRACTION_INTEGRITY_SHA256" \
  --output-dir ../../docs/seo \
  --outcomes-output ../../docs/seo/ogabassey-pilot-outcomes-day56-staging.csv
DAY56_OUTCOMES_SHA256="$(shasum -a 256 docs/seo/ogabassey-pilot-outcomes-day56-staging.csv | awk '{print $1}')"
PRE_ANALYSIS_INTEGRITY_PATH="../../docs/seo/ogabassey-day56-pre-analysis-cohort-integrity-staging.json"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-artifacts.ts cohort-fingerprint \
  --phase day56-pre-analysis \
  --database-url-env BACI_MIGRATION_DATABASE_URL \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --cohort "$COHORT_PATH" \
  --cohort-sha256 "$COHORT_SHA256" \
  --cohort-map "$COHORT_MAP_PATH" \
  --cohort-map-sha256 "$COHORT_MAP_SHA256" \
  --output "$PRE_ANALYSIS_INTEGRITY_PATH"
PRE_ANALYSIS_INTEGRITY_SHA256="$(shasum -a 256 docs/seo/ogabassey-day56-pre-analysis-cohort-integrity-staging.json | awk '{print $1}')"
pnpm --filter @baci/web exec tsx src/scripts/ogabassey-pilot-analysis.ts \
  --outcomes ../../docs/seo/ogabassey-pilot-outcomes-day56-staging.csv \
  --outcomes-sha256 "$DAY56_OUTCOMES_SHA256" \
  --forward-fingerprint "$FORWARD_FINGERPRINT_PATH" \
  --forward-fingerprint-sha256 "$FORWARD_FINGERPRINT_SHA256" \
  --pre-analysis-integrity "$PRE_ANALYSIS_INTEGRITY_PATH" \
  --pre-analysis-integrity-sha256 "$PRE_ANALYSIS_INTEGRITY_SHA256" \
  --output ../../docs/seo/ogabassey-pilot-analysis-day56-staging.json
```

#### Step 9.4: Calculate signed pair-level difference-in-differences

For each eligible pair:

```text
did_pp = 100 * (
  (pilot_post_clicks / pilot_post_impressions
   - pilot_pre_clicks / pilot_pre_impressions)
  -
  (control_post_clicks / control_post_impressions
   - control_pre_clicks / control_pre_impressions)
)
```

Point estimate: arithmetic mean of signed pair effects. Never use absolute effects.

Bootstrap:

- unit: matched pair;
- resamples: 10,000;
- PRNG: `mulberry32`;
- seed: `20260730`;
- weighting: one equal vote per pair;
- interval: 2.5th/97.5th percentiles of signed mean distribution.

Decision fixed before outcomes:

- technical safety failure → compensate/fix immediately;
- `minimum_acceptable_did_pp=0.00`;
- wholly negative interval (`upper_95_did_pp < 0.00`) → performance compensation;
- retain only if all data floors pass, point estimate is positive, `lower_95_did_pp >= 0.00`, and no safety failure;
- sufficient data but interval spanning zero → `inconclusive`, no success claim, compensate because retain gate failed;
- insufficient after the one 56-day extension → no retain and compensate;
- conclusions apply only to `description-provenance-only-v1`, not metadata/spec/canonical interventions;
- do not claim causation beyond the matched-pair design.

Tests pin positive/negative signed effects, 9/10 pairs, 199/200 impressions, 9,999/10,000 aggregate impressions, zero rows versus missing daily requests, absent/present `first_incomplete_date`, 49,999-row acceptance and 50,000-row rejection in every branch, exact final-28/all-56 baseline dates and projection hashes, one extension, classifier/cohort-map/cohort drift, every member-fingerprint drift field at every checkpoint, cohort-only route probes, unrelated-catalog-addition tolerance, deterministic seed/bytes, equal pair weighting, and every decision branch.

#### Step 9.5: Measure Google generative-AI visibility as a separate secondary lane

If Task 0 recorded `available` and Task 8 captured a valid baseline, export the dedicated Search Console Generative AI report again for the exact post day-1–28 PT dates using the same unfiltered property configuration and the same one-exact-canonical-URL-filter-per-cohort-member configuration set. Attach unchanged chart/table exports and configuration screenshots to the ticket and record full hashes. Compare against the exact immediately preceding 28-day Task 8 baseline; Task 0 access-sample exports remain descriptive only. If the Search results `type=web` experiment validly extends, repeat once for exact post days 1–56 and compare only with the sealed Task 8 56-day baseline.

Validate:

- the report is the dedicated Generative AI report, not the ordinary Search results report;
- property, dates, dimension, and export configuration are exact;
- page URLs are canonicalized only through the sealed cohort map and never guessed by slug;
- unfiltered chart totals are property-aggregated, each exact-URL-filtered chart is URL-aggregated, and the Pages table is page-aggregated; artifact metadata names the scope and no cross-scope equality is required;
- values exported as `~` or `-` are retained as provider-suppressed display state plus the exported numeric zero, not interpreted as a proven absence;
- the 1,000-row table limit and any other visible truncation are recorded; a cohort URL absent from a potentially truncated table is `not_observed`, never materialized as zero;
- no click, CTR, query, citation, answer text, or conversion field is invented because this report exposes impression visibility, not those outcomes.

Numerical cohort totals, per-page deltas, or treatment-control comparisons are allowed only when every required exact-URL artifact in both compared windows has an unsuppressed numeric value and no configuration/truncation defect. Any `~`, `-`, missing exact-URL export, or ambiguous scope makes that entire comparison `unmeasurable`; the provider-exported numeric zero is never substituted for suppressed truth. For complete unsuppressed evidence, report total generative-AI impressions by role/window, count of pages with observed impressions, per-page impression change, and the separately labelled unfiltered property-chart change. A signed treatment-versus-control change is exploratory only; it is not the preregistered Search results `type=web` CTR DiD and cannot drive retain/compensate decisions.

If Task 0 or the follow-up check is `unavailable_reason_provider_undisclosed` or `indeterminate_error`, record `google_generative_ai_visibility=unmeasured` with the access/configuration receipt. Do not substitute Search Analytics, rank trackers, manual prompts, referral traffic, Merchant diagnostics, or OpenAI receipts.

OpenAI has a separate evidence boundary: a clean provider ingestion receipt and `is_eligible_search=true` prove only accepted feed rows declared search-eligible. They do not prove indexing, surfacing, citation, or conversion. Unless OpenAI supplies an official impression/click/citation report for the exact feed and period, record `openai_product_visibility=eligibility_only_unmeasured`; manual ChatGPT prompts are anecdotal QA and never an outcome metric.

#### Step 9.6: Compare Merchant item diagnostics without turning them into visibility claims

After the first fully processed Merchant fetch covering post days 1–28, export/query the same exact cohort offer/item IDs with the same account/data-source/country/language mapping used in Task 8. Bind the feed body hash and provider processing UTC. Diff approval state and issue-code sets against baseline, separately for treatment and control, and report new/resolved/unchanged diagnostics plus unmapped/pending IDs. If the provider has not processed a feed covering the window, mark `merchant_diagnostics=unmeasurable_processing_lag`; do not reuse an older receipt.

Any new provenance, description, landing-page, price, availability, image, or policy issue is a technical safety signal to investigate under the existing compensation rule. Approval or issue resolution proves only Merchant feed acceptance/health. It does not prove impressions, ranking, Google generative-AI appearance, OpenAI surfacing, citation, or conversion. No diagnostic count participates in the Search results CTR DiD or the exploratory Generative AI comparison.

---

## Release and Verification Gates

For each implementation PR:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
coderabbit review --agent -t uncommitted
git diff --check
git status --short
```

Before every production transition record:

1. reviewed PR exact head SHA;
2. fresh review result and resolved applicable threads;
3. green required checks;
4. explicit owner deployment authorization;
5. merge SHA and ancestry;
6. migration version/provider operation where applicable;
7. production deployment ID and exact ready SHA;
8. focused production probes;
9. evidence commit or ticket attachment ID and full SHA-256.

Migration rehearsals use only the disposable migration-test database:

```bash
BACI_MIGRATION_TEST_DATABASE_URL="${BACI_MIGRATION_TEST_DATABASE_URL:?set disposable migration-test URL}"
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c1.sql
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c2.sql
psql "$BACI_MIGRATION_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/product_description_provenance_c3.sql
pnpm --filter @baci/web exec vitest run tools/db/supabase-history-replay-sources.test.ts
```

Production SQL is submitted only through the owner-authorized Supabase MCP operation using exact reviewed bytes. Application/database implementation is outside this planning revision.

## Goal-Backward Acceptance Criteria

### Provider and feasibility preflight

- Before implementation, Task 0 records the exact GSC volume result, dedicated Google Generative AI report access state, and OpenAI Stable onboarding/country/schema/delivery result.
- `insufficient_volume` or `incomplete_evidence` cannot enter the measured Boundary B pilot or be repaired by lowering preregistered floors.
- Unavailable Google Generative AI reporting is explicitly `unmeasured`, never inferred from ordinary Search Analytics.
- An official OpenAI integration is implemented only after `official_openai_feed_authorized`; existing OpenAI-named public/API routes are not provider acceptance evidence.

### Boundary A

- Ogabassey PDPs render one deterministic visible summary from product identity and only all-offer common facts or at most three explicitly exhaustive choice axes; stored marketing description is not an input.
- Missing/conflicting/partial variant or condition facts are omitted, and mixed-offer tests prove no variant-specific fact is presented as universal.
- The summary and the full sanitized marketing description are present in initial server HTML; the full description remains owned only by the deferred details region and neither depends on hydration or interaction.
- Same-profile five-run median candidate/parent checks stay within the fixed LCP, CLS, and initial-JS regression guardrails; no lab result is relabelled as field CWV.
- No other merchant/storefront changes.

### Research and proposed copy

- Current/previous GSC evidence is one frozen adjacent pair with `period_role`.
- The API's nullable `first_incomplete_date` has exactly the two defined outcomes; no null-derived finalized date exists.
- Every requested day is proven by `dataState=final` request and terminal pagination.
- A daily full second 25,000-row page or total `>=50,000` sets `provider_row_cap_hit` and rejects opportunity, control, day-28, or day-56 evidence even when page 50,000 is empty; exactly 49,999 plus terminal empty passes.
- Legitimate sparse product-days become deterministic zero rows only after complete request evidence.
- The Task 2 opportunity map is unique and shared only by current/previous opportunity evidence.
- Task 8 seals a cohort-only canonical map containing exactly treatment/control IDs; Task 9 binds it and freshly probes only those routes, so cohort drift stops while unrelated catalog additions do not.
- Preliminary and final treatment position is `<=15.000000`.
- Final pilot count is exactly 10–20; below 10 stops.
- Every claim resolves to source evidence and complete variant/condition applicability.
- First-party Ogabassey observations are separately receipted and bound; unsupported “tested,” “inspected,” local-network, accessories, warranty, delivery, repair, or swap claims are forbidden.
- Rows without first-party observations still require a supportable listing-specific decision synthesis; generic spec-sheet paraphrase is rejected as `commodity_rewrite`.
- Missing storage/RAM/connectivity/colour/condition evidence fails any claim that needs it.
- Proposed-copy artifact contains exact UTF-8 bytes/base64, source, product ID, claim bindings, variant snapshot hash, byte length, and description hash.
- Task 7 writes exactly those bytes and binds their artifact hash into manifest and approval.
- Every bound source is revalidated under the fixed seven-day static-spec or 24-hour volatile-merchant window immediately before execution; any evidence or proposed-byte drift requires regeneration and fresh Task 7 approval.

### Boundary C

- C1 is additive and precedes initial audit and fixture seed.
- Five inactive fixtures cover grandfathered null, unknown-valid-hash, default, trained AI, and stale trusted hash with identical valid feed prerequisites.
- C2a/C2b dual-write every current web, mobile-admin, RPC, import, bulk, and AI writer before the prepared guard is applied.
- Classified feed shadow, classifier-versioned Next product-data caching, and prewarmed origin/public CDN responses are verified before cutover; no application-readable feed-body snapshot is invented.
- Evidence-confirmed historical legacy rows are reconciled with same-text CAS under additive C1 only after writer closure and before the prepared guard; unresolved text becomes `unknown`, no trained row is downgraded, and the historical path cannot be reused at runtime.
- The ordinary main-branch migration runner installs the prepared stateful guard only after writer closure and legacy-backfill readback; that migration starts no timer and requires no deployment pause.
- Prepared mode permits only byte-identical grandfathered `NULL/NULL` descriptions while requiring valid provenance for every new or changed non-empty description, preserving trained/unknown stickiness, and consuming a bound one-use grant for every new/changed `default`.
- Live pre-switch and final-C3 CAS reconciliation cover every current row, explicitly report every post-audit change, and prove no expected legitimate-default row is unexpectedly lost.
- Unknown/mismatch rows are whole-item excluded from Google/OpenAI outputs.
- Generative Google descriptions use `structured_description` with `trained_algorithmic_media`; default descriptions remain ordinary.
- The six feed surfaces remain classified while normal catalog writes continue through the prepared guard.
- Feed behavior is active classified generation plus existing CDN stale delivery under the reviewed 30-minute stale window; if no classified response is available, origin returns no-store `503` with `Retry-After` and never retrieves/fabricates a prior body or emits empty `200` inventory.
- Task 5 names and preflights an exact classifier-enforcing rollback SHA compatible with `structured_description`, provenance columns, prepared/C3 states, and classifier-versioned caches. Pre-C2 current, shadow-only, and other pre-classifier rollback is forbidden; unavailable safe rollback leaves `503` and the incident path active.
- The fail-safe never restores an unclassified cache or serves generative text as ordinary.
- Fixture order is seed → activation → deactivation → C3 → cleanup/deletion/probes.
- One owner-authorized `SERIALIZABLE` state-only transaction locks and validates the exact complete Ogabassey catalog, then changes `C2_PREPARED` to `C3_ACTIVE`; any concurrent drift rolls back and requires a regenerated artifact.
- Boundary C completion includes exact migration, audit/reconciliation, backfill, feed, fixture, cleanup, and production receipts.
- Existing OpenAI routes remain labelled legacy/internal. When authorized, the separate Stable `jsonl.gz` snapshot uses flat official fields, one stable item per variant/offer, deterministic full-snapshot bytes, and provider sample/full ingestion receipts.

### Boundary B and measurement

- Boundary B always consumes Boundary C completion.
- One fixed-signature manifest binds exact proposed-copy and applicability hashes.
- Owner approves exact manifest and forward SQL hashes before controls.
- Controls use only preperiod data, exact bins/calipers, stable order, deterministic distance/tie-break, family/cannibalization exclusions, and no replacement.
- Cohort treatment IDs equal manifest IDs exactly and at least 10 pairs exist.
- Before manifest approval, treatment eligibility and both 28/56-day preperiod floors are recomputed from the exact post-Boundary-A finalized window that Task 8 reuses; stale treatment IDs force Task 2/7 regeneration.
- Forward execution is one `SERIALIZABLE` merchant-scoped CAS transaction with exact returned IDs/readback.
- Forward completion seals every treatment/control member fingerprint across description/source/hash, `updated_at`, full variant/condition applicability, active/status, and canonical URL.
- Forward and compensation complete only after awaited Cloudflare purge, authenticated feed revalidation, and fresh origin/public probes.
- Compensation is generated from fresh post-forward readback, C3-valid targets, exact CAS guards, disposable migration-test rehearsal, and fresh incident approval; every restored `default` target additionally consumes a fresh incident-approved exact one-use grant bound into the final SQL, and no production-catalog clone or installed function exists.
- Measurement uses signed pair-level CTR DiD, fixed bootstrap unit/seed/weighting, at least 10 pairs, 200 impressions per member/window, and 10,000 impressions per aggregate cell/window.
- Day-28 pre is exactly the final 28 complete PT days of the sealed Task 8 56-day preperiod immediately before forward execution; day-56 pre is all exact 56 days. Dates/date-list/source/projection hashes are bound and alternate or unequal slices fail.
- Every Task 8 preperiod date is on or after the first complete PT day following Boundary A production activation, so the PDP-summary intervention cannot enter only part of the description pilot baseline.
- Day 14, day-28 pre-extraction/pre-analysis, and every day-56 pre-extraction/pre-analysis checkpoint must match all treatment/control forward fingerprints; any member drift invalidates measurement while unrelated products are ignored.
- Only one owner-approved 56-day extension is allowed after a hash-approved insufficient day-28 result.
- Day 56 uses the same optional-boundary, finalized-daily-request, pagination, sparse-zero, cohort-map, fresh cohort-route probe, classifier, and cohort contract.
- Insufficient or inconclusive evidence cannot justify retention; aggregate results do not justify another treatment signature.
- The dedicated Google Generative AI report is a separate descriptive secondary lane with immutable chart/Pages exports, explicit suppression/truncation handling, and no invented clicks, CTR, queries, citations, or conversions.
- Merchant baseline/follow-up diagnostics use the exact cohort offer/item mapping and processed-feed receipts; pending/unmapped items remain unmeasurable, and approval/issue changes are reported only as feed health, never visibility or ranking.
- OpenAI acceptance/search eligibility proves feed eligibility only. Without an official provider outcome report, OpenAI visibility remains `eligibility_only_unmeasured`.

## Internal Contradiction and Executability Scan

Before implementation authorization, re-run this checklist against current main:

### Order and migration safety

- Provider/data-volume preflight → Boundary A/evidence → C1 → initial audit/fixtures → C2a dual-write/shadow → C2b web/mobile/RPC closure → live legacy CAS reconciliation/backfill under additive C1 → prepared guard → read-only pre-switch reconciliation → classified deployment → activation/deactivation → final catalog validation → state-only C3 → cleanup → Boundary C completion → manifest/SQL → controls → execute → measure.
- No audit or fixture seed precedes C1.
- No pending migration starts an outage timer or assumes the automatic main-branch migration runner can pause between migration application and deployment.
- The prepared guard is not installed until every writer dual-writes, the evidence-backed legacy CAS backfill completes under additive C1, and exact production readback passes; C3 is state-only and fails closed on any current-catalog drift while normal writes continue.
- No C3 or cleanup precedes fixture deactivation.
- No Boundary B artifact is approved before proposed-copy and Boundary C completion hashes exist.

### GSC correctness

- The Search Analytics `type=web` lane and dedicated Generative AI report contract remain separately reported but explicitly overlap; they are neither independent nor additive and neither metric set is renamed or substituted for the other.
- Generative AI exports bind exact property, PT dates, Pages dimension, configuration screenshot, chart/table hashes, preliminary-date exclusion, suppression state, and 1,000-row-limit state.
- Every schema and branch allows `first_incomplete_date` to be present or absent/null.
- Present means `window_end < boundary`.
- Absent/null means only “no incomplete points in the requested range” for that availability response; it never creates a derived finalized-through date.
- Per-day `dataState=final` requests and terminal empty pagination exist for every requested day in current, previous, controls, day 28, and day 56.
- Every daily receipt carries page counts, total rows, and `provider_row_cap_hit`; 25,000 + 25,000 is unusable regardless of a later empty page, while 25,000 + 24,999 + terminal empty is usable.
- Missing day/page is failure; a successful zero-row day is materialized as zero for mapped members.
- PT dates, `type=web`, property, query classifier, and anonymized-query limitation are unchanged across periods; current/previous bind the opportunity map, while control/post measurement binds the exact cohort map after selection.

### Research/applicability/copy

- Opportunity ranking does not use future/post-treatment data.
- Preliminary research order and deterministic slot fill are recorded.
- `manual-review` is ineligible.
- Variant snapshot includes all current associated variants, attributes, condition, and completeness hashes.
- Every claim is all-variant or exhaustively enumerated and explicitly scoped.
- Proposed description contains no ambiguous variant/condition claim.
- First-party Ogabassey claims have exact product/variant receipts; neutral researched copy does not impersonate hands-on experience.
- Boundary A summary logic never consumes marketing description and emits only common all-offer facts or complete choice sets under the fixed three-axis cap.
- Manifest bytes/source/hash equal proposed-copy bytes/source/hash exactly.

### Provenance and feed cutover

- Writer checker maps direct, CSV, bulk update, Bumpa/claimed job, Jumia, mobile-admin, public/private RPC, import, and AI persistence paths and their callers/tests.
- Every changed description atomically stores source/hash; third-party unattested text remains unknown.
- Generative/unknown provenance is sticky through ordinary edits; every new/changed `default` requires a bound one-use non-generative authorship grant, and trained/unknown can become `default` only through an exact reviewed full-replacement grant.
- Pre-guard backfill and final snapshots include all post-initial-audit changes; every mutation uses fresh exact hashes and CAS guards, never stale initial-audit hashes. The post-guard pre-switch reconciliation is read-only and must yield zero mutation candidates.
- Prepared guard state and C3 state are exercised through append-only migrations and state-only DML in disposable history replay; the generated Supabase type file is refreshed from the migrated schema.
- Expected legitimate-default ID sets reconcile before feed switch.
- Google/OpenAI direct/public routes share one classifier; old cache keys cannot leak.
- Existing OpenAI route contracts are not called official. The Stable snapshot is conditional on onboarding/country support, uses exact current flat fields, produces one stable row per offer, and is validated before gzip/SFTP delivery.
- No SFTP credential enters source, route, artifact, client bundle, or log; provider sample and full-catalog receipts are required before any ingestion claim.
- Feed recovery uses existing classified product-data/CDN caching only; application code has no stored-body fallback. Missing classified response yields no-store `503`, and the 60-second incident threshold blocks C3/pilot until recovery.
- Rollback is limited to the exact preflighted classifier-enforcing SHA; no pre-C2 current, shadow-only, or other pre-classifier deployment can restore AI text as ordinary description.
- Trigger covers INSERT and updates of description/source/hash, has fixed search path, and denies direct execution.
- Service-role bypass of RLS does not bypass the trigger.

### Fixtures, rollback, and execution

- All five fixtures have the same category/price/availability/image prerequisites.
- Each fixture mutation returns exactly one fixture ID and proves no real/nonfixture mutation.
- Cleanup guards exact IDs/tag/merchant/dependencies and runs only after C3.
- Forward/compensation SQL locks sorted IDs, checks ownership/current triple/protected hashes, and verifies returned ID equality.
- Immediate pre/post forward checks seal all cohort fingerprints, and every measurement checkpoint compares every treatment/control member field to that baseline while ignoring nonmembers.
- Grandfathered compensation uses old semantic bytes + conservative `unknown` exact hash, never impossible null provenance; restoring a historical `default` consumes a fresh incident-approved exact one-use grant in the same transaction.
- No custom approval service, artifact control plane, extension state machine, daemon, custom DB login, dynamic installed function, or recursive production clone remains.
- Opportunity and cohort canonical maps have distinct scopes; only exact cohort-route drift blocks measurement, not unrelated catalog growth.

### Commands, paths, and evidence transfer

- Every displayed `pnpm --filter @baci/web` command uses repository-root invocation and `../../docs/seo/...` for package-relative paths.
- Every displayed command has a test using concrete fixture paths.
- Every required environment variable uses `${NAME:?message}` before use.
- Evidence crossing a PR/worktree/host is a reviewed Git file or immutable ticket attachment with full SHA-256.
- No consumer trusts a path, short hash, shell history, or an artifact whose expected full hash was not approved.
- Large touched callers remain thin through the named extraction files.
- Final handoff distinguishes planned, committed, merged, migrated, deployed, executed, and measured.

## Revision Record and Status

- **Revision 31:** Recorded convergence for the prior control-plane-heavy plan at SHA-256 `b8774d44ab551c2fe05ca6151c254694509a7af907c0a88998cf5b994ae27eae`.
- **Revision 32:** Corrected optional Search Analytics `first_incomplete_date` handling and sparse-row completeness; added exact proposed-copy bytes and exhaustive variant/condition applicability; closed the initial-audit/final-freeze race with a locked frozen reconciliation; replaced prolonged feed holds with dual-write/shadow verification, a brief bounded write freeze, classified feed switch, and safe cache fallback; removed custom artifact/extension/credential/clone machinery; reduced implementation to a bounded direct script set and ordinary Git/ticket/Supabase receipts.
- **Revision 33:** Removed the unsafe empty-`200` feed fallback in favor of live classified output, bounded-staleness hash-verified classified cache, then incident-blocking `503`; replaced contradictory long-deadline/freeze-extension language with one immutable 15-minute database deadline and compatibility transition; split the opportunity map from the exact cohort-only measurement map so unrelated catalog growth cannot invalidate the pilot.
- **Revision 34:** Made the 50,000-row Search Analytics cap fail closed; constrained rollback to a preflighted classifier-enforcing SHA; replaced marketing-description summaries with deterministic all-offer facts/choice sets; fixed day-28/day-56 preperiod slices; aligned fallback with existing Next product-data/CDN caching and no application body snapshot; and added treatment/control fingerprints with mandatory contamination checks.
- **Revision 35:** Added a fail-fast GSC volume gate; made the dedicated Search Console Generative AI report the only Google AI-visibility outcome source; separated its impression-only, suppression/truncation-aware exports from ordinary Web Search CTR DiD; replaced assumed OpenAI compatibility with conditional official Stable flat-file, variant-row, SFTP, and provider-receipt requirements; labelled existing OpenAI routes legacy/internal; and required receipted first-party Ogabassey observations instead of invented local expertise.
- **Revision 36:** Replaced the deployment-incompatible timed freeze with a normal prepared-guard migration, live CAS reconciliation, classified deployment, and one state-only `SERIALIZABLE` C3 transaction; added the mobile-admin/RPC writer, DB-enforced exact-byte default attestations, and generated Supabase type/replay obligations; made generative provenance non-launderable; corrected Search Analytics/Generative AI overlap, aggregation, suppression, Merchant diagnostics, and OpenAI eligibility claims; added server-HTML/CWV regression gates, rejected commodity rewrites, refreshed volatile evidence, isolated Boundary A from the full 56-day pilot baseline, revalidated treatment eligibility before manifest approval, and completed the focused feed-test map.
- **Revision 37:** Rebased Boundary A onto the current `pdp/critical-shell` and server-details ownership, made strict RED-before-GREEN tests explicit, moved historical legacy CAS reconciliation ahead of the prepared guard, removed the impossible pilot `default` branch, and required a fresh incident-approved one-use grant for any compensation that restores `default` bytes.
- **Revision 38:** Replaced the assumed URL-prefix Search Console property with the authenticated Sites-resource identity `sc-domain:ogabassey.com` while preserving `https://ogabassey.com/` as the canonical page base URL.
- **Current status:** **Sol preflight blockers are resolved; Revision 38 needs only a scoped provider-identity re-review before Task 0 implementation.** This remains implementation-authorized but gate-controlled: no production code, migration, deploy, or product mutation begins until that check is clean, and later deployment/data-write gates still require their exact owner approvals.

## Execution Handoff

Revision 38 carries the owner's implementation authorization, but not migration/deployment/catalog-write authorization. Continue Task 0 from the refreshed `origin/main` isolated worktree only after scoped Sol preflight approval; preserve the dirty root. Treat every later owner approval and provider receipt as specific to the exact hashes named in the reviewed PR/ticket. Stop on any path drift, source ambiguity, missing variant evidence, GSC request gap/cap, infeasible measurement volume, mistaken Google AI-report identity, OpenAI provider/country/onboarding ambiguity, unexpected default-feed loss, unsafe rollback identity, prepared-guard mismatch, fixture mismatch, cohort fingerprint drift, CAS failure, or provider-result ambiguity. Do not recreate any machinery explicitly removed by the scope correction without a separate owner-approved scope change.
