# OgaBassey Home Critical Viewport V4 — Normative Architecture Contract And Phase-Plan Index

> **For architecture reviewers and phase planners:** This file is the normative cross-phase contract, not a directly executable task list. Do **not** run `superpowers:executing-plans` or `superpowers:subagent-driven-development` against this large cross-phase document. Before each real PR, create and approve the dedicated phase plan named in **Required Phase Plans** below; only that smaller plan may carry the normal agentic-worker header and be executed task-by-task. Checkboxes here track contract coverage and release gates, not one linear implementation order.

**Goal:** Cut OgaBassey home mobile lab LCP from the directional `6001 ms` result to `<= 3500 ms`, with a stretch target below `2500 ms`, without trading away publication, tenant, SEO, accessibility, or adjacent-route correctness.

**Primary outcome contract:** This is a Core Web Vitals performance program, not a cache-control-plane project with performance as an optional side effect. The architecture is successful only when the exact-release controlled mobile-home cohort proves the absolute LCP target (`median` and stability upper `<=3500 ms`) while the frozen safety, SEO, CLS, INP, FCP, and adjacent-route guardrails remain green. Shipping queues, snapshots, purges, markers, or permanent HTML is enabling work—not the outcome. A safe `>=10%` relative gain above the absolute target may be retained as a diagnostic intermediate, but it is explicitly `RETAINED_H2_INCOMPLETE`, does not complete the home objective, and cannot unlock category implementation. A gain below `10%`, or evidence that late Hero discovery does not own at least `2500 ms` of recoverable availability, stops this architecture and routes effort to the measured LCP owner rather than accumulating fractional tweaks.

**Architecture:** First prove that late Hero discovery owns the recoverable time. Then use one coherent committed static-shell snapshot with two top-level invalidation classes: transactionally enqueued safety transitions for publication/routing identity, and rate-bounded content reconciliation with two output scopes. The one home generation is exposed through a narrow early LCP/shared-shell projection and a separate deferred semantic/crawlable-link projection. One pre-render document adapter validates both; therefore the bounded deferred-view transfer/parse/digest is an explicit document-admission/TTFB dependency, while graph/link construction remains worker-only and deferred HTML bytes remain after the Hero in document order. H1 closes the completed Cloudflare home object first: it renders one committed request-gated Hero generation, renders shared chrome/semantic/crawlable anchors only from the same immutable snapshot, and moves the visible below-fold feed plus personalized widgets to no-store client surfaces. H2 then moves that same already-coherent early projection into permanent initial HTML and replaces the inventory-bearing Product/Offer graph subset with a canonical non-inventory graph while retaining the small generation-owned crawlable link projection. While permanent output is publicly active, a changed composite home-critical fingerprint purges exact home documents and a changed shared-shell fingerprint purges all merchant documents through kind-scoped host/path duties and canaries home/category/PDP/blog. While shell 1 is deliberately degraded with no live or awaiting promotion, changed home and/or shared fingerprints only advance the private committed snapshot because neither permanent output is rendered; the next higher-epoch promotion owns the eventual all-document transition. One existing #3077 VPS event-delivery worker process is the sole executor for both reconciliation and provider delivery; there is no second HTTP drainer, cache-only service, or schedule. Database triggers mark candidate inputs dirty; they do not pretend to reproduce the TypeScript builders. A TTL-only design is a recorded alternative, not an implicit shortcut; it is allowed only if the owner explicitly accepts an end-to-end stale-HTML SLO and a controlled cache/LCP pilot passes.

**Tech Stack:** Next.js 16 Cache Components, React 19 Server Components, TypeScript, PostgreSQL/Supabase RPCs and triggers, the #3077 PGMQ/delivery ledger plus continuous VPS worker and recovery sweep, Vercel cache tags, Cloudflare cache APIs, Vitest, Supabase SQL tests, Puppeteer/Chrome traces, PSI, and PostHog web-vitals attribution.

## Global Constraints

- Reuse `/Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home`; do not create another worktree.
- Treat `apps/web/src/proxy.ts` as protected. H1/H2 cannot pass without explicit owner approval for exactly three scoped changes: a dedicated response tag on cacheable anonymous home documents, a dedicated shared-shell response tag on every cacheable anonymous storefront document, and the authenticated Vercel purge-actuator path exemption. No cache-claim/drain logic belongs in proxy.
- Use Server Components by default, preserve tenant binding, and keep service-role access out of public storefront reads.
- Use append-only migrations, explicit projections, Zod boundaries, one primary export per new source file, a 300-line source-file ceiling, and colocated tests.
- Never run `vercel build` or a cloud-building deploy command. Local Next build proof and the existing prebuilt deployment flow are the only allowed paths.
- Never overlap PSI, DebugBear, or browser automation. One exact-SHA measurement lane owns rollout evidence.
- Every PR below must be independently green and reversible. Do not combine control-plane work, the visible Hero move, category work, or a carousel rewrite.
- Honor the requested CodeRabbit `--prompt-only` mode when the installed CLI exposes it. The current installed CLI does not, so every gate uses an explicit help-probed compatibility fallback to its supported `--agent` mode rather than failing or silently skipping review.

> **Rereview status (2026-07-13):** Upgraded after a second architecture review against current source, live OgaBassey cache headers, current Cloudflare limits, current open PRs, and the post-PR-3082 measurements. The previous V3 over-applied hostname purge, did not put the cheaper bounded-staleness alternative on the record, and conflated a database dependency signal with proof that rendered Hero bytes changed. This V4 is not permission to begin rendering changes: Gate 0, the ADR decision, the #3060 substrate reconciliation, and protected-proxy approval all precede H2.

> **Fourth-review upgrade (2026-07-13):** The execution contract now binds measurements to the promoted deployment run/attempt/marker, treats boot-free pagehide vitals as first-class exact-release evidence, makes merged #3114 ancestry plus clean replay a real H1 gate, replaces the unsound latest-generation publish waiter with immutable mutation receipts and honest mixed-deploy-safe `200/202/409/503` semantics, makes publication eligibility an atomic database invariant rather than a route-only check, defines one pending work/event identity instead of enqueueing orphanable messages during coalescing, fences both #3077 ingress and delivery on an exact installed worker release, moves Vercel tag deletion behind a narrow Vercel-resident actuator, mechanically verifies renderer-contract source coverage, defines separate-namespace reader-first Edge Config activation and safe Edge-first rollback, rejects the unsound parallel-slot route, and requires one render-scoped route/metadata resolver before the mandatory non-parallel `[slug]` layout split and ordinary home-child critical prefix.

> **Fifth-review upgrade (2026-07-13):** The contract now removes the phantom `merchants.custom_domain` trigger, treats distributed Edge digest/item reads—not management REST—as propagation proof, batches each Edge visibility boundary atomically under bounded hashed keys and a measured store/write budget, physically parks staged bootstrap deliveries without lease or retry inflation, keeps post-finalizer `disabled + final_disable_transition_id` mutations fenced, gives every v1 no-op UUID its own immutable receipt alias, preserves H1 root-home inventory freshness until H2 removes Product/Offer availability bytes, adds a route-wide non-shopping shared-shell marker, permits only the proved `shared_shell -> home_content` coverage relation, names a required operational alert channel, records origin-fill percentiles as diagnostics, and makes H0/H0R/H1/H2 home-mobile sample count, prewarm order, CDN-cache-state evidence, and dispersion symmetric.

> **Sixth-review upgrade (2026-07-14):** The contract now gives H2 a real two-boundary activation: renderer reconciliation may build and park a compatible shell-1 snapshot while public rendering is degraded, but only the atomic `promote-render` CAS exposes permanent bytes and releases one staged shared-shell purge/canary event. A forward shell-1→shell-0 rollback creates a separate all-document `shared_shell_cleanup` target and is incomplete until home/category/PDP/blog prove the H2 shared marker absent. Root-home purge ownership fails closed on unresolved control state, Edge records repeat the typed identity kind, safety and shared-shell canary cardinalities are unambiguous, and H0R→H1—not a multi-PR H0→H1 gap—is the causal control-plane measurement.

> **Seventh-review historical note (superseded):** At that review #3077 appeared wholly unapplied, so the contract proposed retimestamping it before merge. The Tenth-review live evidence supersedes that instruction: #3077 is merged and applied, and only append-only post-merge recovery is legal. The remaining parked-stage, typed-client, shared-runtime, and nested-route CLS decisions from that review still apply.

> **Eighth-review upgrade (2026-07-14):** The contract now records linked-ledger drift as a hard blocker, makes dependency/history-repair PRs exact-head gates, requires #3077 type regeneration/touched-tree modularity, and gives tools/workers a P0-created CI typecheck. Focused SQL suites use fail-fast `psql`, every H1 slice has a cumulative gate, and one Cloudflare budget runtime has web/root/VPS parity. Renderer activation distinguishes readiness from terminality, restores receipts on requeue, and handles late enrollment.

> **Ninth-review upgrade (2026-07-14):** The contract now refreshes live main/open-PR heads, derives #3077's exact migration inventory through `20260714000400`, and makes the #3024 and #3098 timestamp collisions explicit pre-H1 history gates rather than route/cron footnotes. Renderer sweeps now have a checked `release_activation | merchant_enrollment` owner union, so late merchant enrollment uses the same locked status interface without impersonating a fleet activation. Bootstrap release names the only reachable provider phase exactly: parked `routing_staged` is unclaimable, the finalizer atomically resumes it as `pending`, and only that claimable phase may dead-letter/requeue.

> **Tenth-review upgrade (2026-07-14):** Live main overtook the prior dependency plan: #3077 merged as `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8`, and deployment run `29318477334` successfully applied its migration chain before the Vercel build. The contract therefore replaces every impossible pre-merge retimestamp instruction with an append-only post-merge recovery gate. It also rejects empirical p99 as a stale-fill correctness fence; adds bootstrap restage, forward-shell rollback, routing-activation replay, failed-enable drain, and direct-publication-writer closure; moves causal/absolute lab ownership from unconditioned PSI to one header-proven controlled browser campaign; gives H0/H0R an initial-document measurement fingerprint; treats MAD as a stability heuristic rather than confidence; uses field-INP noninferiority; permits bounded infrastructure-only campaign resumption; and requires separate reviewer-sized plans for P0/H0-RUNNER/H0/H1A/H1B/H1C1/H1C2/H1D1/H1D2/H2.

> **Eleventh-review upgrade (2026-07-14):** The contract now makes the controlled-measurement machine an owned hard prerequisite (`H0-RUNNER`) instead of an undeclared property of hosted CI; freezes create-only raw artifact identity and retention; adds a post-activation `ROLLED_BACK_REROUTED` terminal outcome; makes expired global-child recovery an explicit constrained `leased -> pending` CAS under the Edge writer fence; represents non-Oga reassignment with a generic product-free tenant-routing proof; requires one exact canonical URL per routed target; and makes shell-1 home-content and forward-cleanup proofs carry the shared-parent/marker-absence facts they actually claim. These close the last measurement, state-machine, and canary-proof contradictions found by the final independent rereview.

> **Twelfth-review upgrade (2026-07-14):** The measurement ledger is now executable rather than aspirational: H0-RUNNER owns the active immutable-tag ruleset and a read-only runner-auditor GitHub App; H0 pins the supported programmatic artifact client; every request envelope is uploaded and read back before its start ref and before network I/O; raw results are uploaded and read back before terminal refs; the campaign-wide retry ceiling stays below the supported artifact limit; and crash tests cover every boundary. The terminal outcomes now disallow a hidden TTL acceptance under `STOPPED_REROUTED` and require the exact-parent H2 campaign for both passing and retained-but-incomplete H2. Live main and moving PR heads were refreshed once more at handoff.

> **Thirteenth-review upgrade (2026-07-14):** The rollout campaign is now an explicit serial reusable-workflow DAG rather than one artifact-heavy job: one control/pre-canary job, twenty-one controlled slot jobs, one controlled post-canary job, twenty-one PSI slot jobs, and one finalizer all share the same run id and sole attested runner. No job can exceed the pinned artifact client's ten-artifact ceiling; a measurement-bearing job proves that the one API-listed eligible runner is the currently busy job host before every request. The content state machine now makes degraded home/shared marker fields null, treats every stable degraded shell-1 home/shared data change as snapshot-only, carries only an already-degraded inherited duty, and makes any safety obligation that absorbs cleanup retain the four-document marker-absence proof.

> **Fourteenth-review upgrade (2026-07-14):** Fingerprint ownership is now total at the metadata boundary: page-owned home metadata belongs to the home-only fingerprint contract, while parent/base metadata remains in `sharedShellFingerprint`. The Fifteenth-review split refines that home-only owner to `homeLcpFingerprint`, with `homeCriticalFingerprint` reserved for the versioned LCP+semantic composite. The home measurement marker exists only for explicitly marker-bearing published/ready states; suppressed, unavailable, unbound, draining, and disabled branches deliberately omit it and cannot enter a campaign. A degraded marker is control-plane evidence, not permission to satisfy H2's permanent-state campaign. Moving #3109/#3112 heads were refreshed again at handoff.

> **Fifteenth-review historical intermediate (2026-07-14; extended by the Seventeenth/Eighteenth complete-document contract):** H1 no longer asks a fingerprint-free generation RPC or a content-null degraded snapshot to prove request-owned bytes. One immutable home generation now commits `homeLcpFingerprint`, `homeSemanticFingerprint`, and their versioned composite `homeCriticalFingerprint`. The existing generation-checked public snapshot is the small early view used by the request-gated H1 Hero/measurement marker and the permanent H2 critical prefix; a second generation-checked semantic view owns the complete current home semantic graph. One document-level adapter validates both views and their composite before a marker-bearing render begins, then emits the Hero/resource hint first and the semantic graph later in document order. Runtime canaries recompute both component digests from actual HTML before completing a home transition. H2 uses a dedicated canonical builder to reconstruct the non-product identity, WebSite, category/navigation, trust, topical, and blog graph without the inventory-bearing homepage collection `mainEntity`, product significant links, Product/Offer nodes, or availability. It does not recursively delete every `CollectionPage`, because category/navigation CollectionPage nodes are non-product semantics. This closes the marker/Hero/JSON-LD split-generation and partial-cache races while keeping semantic construction at worker time. A single combined public SQL payload remains rejected to preserve narrow grants/cache keys, but the request admission adapter must validate both narrow views; a live request-time rebuild remains forbidden.

> **Sixteenth-review historical intermediate (2026-07-14; extended by the Seventeenth/Eighteenth complete-document contract):** The two-view contract is now total and executable. H1 snapshots the full graph actually emitted by `ogabassey-home-dynamic-content.tsx`; H2 preserves its non-product SEO value instead of silently deleting Organization/LocalBusiness/WebSite/navigation/trust/blog semantics. A semantic projection failure occurs at document admission before any Hero/marker response byte can render; no correctness claim depends on post-flush React error behavior. The public disabled response is byte-stable across the private finalizer UUID clear, phase inventories are exact, shell-0 metadata consumes the same early generation as its Hero, resource hints come from a pure projection shared by worker/render/canary, `renderHero=false` performs zero slide construction, and touched critical CSS is split below the repository limit before H2. The bounded semantic admission cost is measured and capped explicitly so correctness does not quietly consume the intended LCP gain.

> **Seventeenth-review upgrade (2026-07-14):** Live `CF-Cache-Status:HIT` evidence proved that “request-scoped” server content is still part of Cloudflare's completed cached HTML/RSC object: the current object contains below-fold product names/prices/images, featured links, mobile navigation, and footer bytes. The contract therefore makes whole-document byte closure an H1C2 prerequisite, before control activation or measurement: shared chrome comes from a fingerprinted projection; a bounded fingerprinted link projection preserves crawlability; and the visible product feed plus personalized widgets move to separately tested no-store client surfaces with reserved geometry. H2 reuses that closure and removes Product/Offer/stock/price/image graph bytes before making the Hero permanent. A raw-object mutation test must prove that no mutable unowned byte remains in either shell's cacheable document. The same review makes the semantic-admission receipt a create-only, retrievable, exact-snapshot-bound artifact rather than an unproducible local timing claim.

> **Eighteenth-review upgrade (2026-07-14):** The contract now names the exact immutable shared-shell schema and assigns every current navbar/footer/theme/widget byte either to that projection, to renderer-manifest-owned constants, or to a no-store client island. It gives the public home feed a concrete anon RPC, host/identifier binding, projection, cursor, and cache-failure contract; makes route-wide safety/shared proof independent of the home semantic RPC; replaces shell-1-only provider assertions with one versioned `shared_shell` proof for shells 0 and 1; gives immutable safety proofs a revision key and locked current pointer; splits the rollout DAG into bounded reusable coordinators; defines phase-discriminated field queries and a reproducible comparator; and removes the last obsolete “nonvisual H1” and request-continuation clauses. These are implementation-contract corrections, not added scope after performance success: they close paths that would otherwise let a cache-safe but still slow or internally contradictory rollout pass.

> **Nineteenth-review upgrade (2026-07-14):** Implementation preflight caught a live dependency transition after the prior freeze: #3098 merged as `19d03df8544270eaac9ee072f30f2294cd2024b6`, and its database job applied the four repaired unique migrations while its full deployment was still running. Primary deployment logs also resolved `20260713160000` to the #3114 anonymous-column restoration, not the historical colliding payment blob. The contract now freezes P0's target-base merge without circular invalidation, absorbs merged #3098 as replayed history rather than reimplemented scope, limits P0 modularity repair to #3077-created/P0-modified files instead of unrelated historical storefront debt, treats #3024 as pre-H1 rather than P0 code scope, and makes discovery drift stop before any conditional repair placeholder.

> **Twentieth-review upgrade (2026-07-14):** The implementation freeze caught one more live base transition: #3099 merged as `1ba7562b640b418e47fd38a4a2449cfec82ea960` after the Nineteenth review, adding the already-reviewed order-notification migrations `20260713123000_preserve_repeat_order_notification_cycles.sql` and `20260713123100_scope_manual_order_notifications_to_cycle.sql`. P0 now treats those immutable files as current-base replay inputs, not CWV scope, and may freeze only after the exact deployment/database state for this new base is recorded. Any subsequent main advance invalidates the P0 discovery receipt before implementation edits.

> **Twenty-first-review upgrade (2026-07-14):** A real isolated reset disproved the remaining literal-reset assumption. Untouched current history fails first on invalid PostgreSQL syntax in applied `20260525140048_quiz_authoritative_answer_scoring.sql` (source SHA-256 `2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41`), then—after a temporary syntax correction—on migration-pipeline-incompatible `CONCURRENTLY`, and then on the duplicate `20260615120000` ledger key. P0 must never edit those applied files to manufacture a green reset. It now owns a hash-bound disposable replay runner: bootstrap only the known-good prefix with Supabase, apply subsequent immutable SQL bodies one file at a time through `psql` so legitimate top-level concurrent-index statements remain legal, substitute the separately checked syntax-correction fixture only for the exact bad hash, and assign replay-only ledger identities to duplicate filenames without changing their SQL bytes. The raw `supabase db reset` failure becomes historical evidence; chronological replay and deterministic production-effect replay with evidence-backed exceptional splices must converge with each other and a fresh read-only production effect snapshot. The same discovery proved production-only `20260629154903_add_order_fulfillment_timestamps` left `orders.shipped_at` and `orders.delivered_at` absent from a chronological current-tree replay, so P0 requires one append-only idempotent repair after the frozen tail.

> **Twenty-second-review upgrade (2026-07-14):** Implementation-boundary review found that the original seventeen bare-client paths did not include the complete direct database-bearing delivery closure. P0 now freezes narrow identity and conversion-enrichment projections separately from the legitimate service-role-only provider-configuration projection; types the central service factory; extracts the pure merchant entitlement predicate; decomposes analytics configuration into type/merge/fetch/configured-check units; splits provider delivery into network-only modules plus one pure configured fanout; and makes the durable worker reuse its single already-loaded immutable configuration instead of opening a hidden second service client/read. The boundary guard, exactly-once configuration-load regression, touched-tree modularity gate, and generated-function signatures now cover that closure explicitly without expanding P0 into unrelated callers of the shared service factory.

> **Twenty-third-review upgrade (2026-07-15):** Final execution review expanded the generated boundary from the sixteen directly runtime-called RPCs—fifteen TypeScript call sites plus one MJS retention cleanup—to all nineteen final public #3077 functions, including two SQL-internal helpers and the service-role-only queue-metrics function, and prevented an implicit service-role widening regression. Public untrusted Facebook/GA4/Snapchat/TikTok endpoints retain their caller-supplied RLS client and can never fall back to service role; `/api/analytics/ads` remains in its existing authenticated class. The two pre-existing legacy conversion/event fanout routes are the only reviewed Next route importers of an explicit trusted-server wrapper and, within the frozen closure, the only routes permitted to construct the branded service client for that wrapper. They must first prove independently verified tenant context, pass the resolved merchant identity as a separate argument, never infer credential selection from the event/raw body id, perform zero service-role I/O on absent/unverified/mismatched context, and P0 may not add another importer. Durable delivery uses its already-supplied branded service client and immutable config directly. The configured fanout is DB-free and plain-Node compatible, the Next-only trusted wrapper is isolated behind `server-only`, and a static client-graph test excludes credential modules. Production-effect proof is no longer inferred from version-sorted linked output; P0 freezes canonical exceptional-entry provenance with primary run/job/log ordinals and hashes before replay approval.

> **Twenty-fourth-review upgrade (2026-07-15):** The implementation freeze advanced again after #3116 and #3119 merged. Neither commit added a migration at that historical freeze; both commits are nevertheless part of the exact P0 base. Merged #3116 satisfies the remote-cache-handler dependency while leaving its oversized config surface as explicit H1 touched-tree debt, and merged #3119 becomes the SEO/social-identity baseline that every later controlled home cohort must preserve. The Twenty-sixth review below supersedes that freeze's tail and repair timestamp. P0 still changes no storefront rendering, cache behavior, SEO output, or proxy code.

> **Twenty-fifth-review upgrade (2026-07-15):** The final provenance bind rejected an unsupported claim: primary database-job logs prove every exceptional mapping and the complete 26-file #3077 group, but they do not prove a total historical order for every linked row. P0 therefore freezes `production-effect-provenance.json`, not a fictitious application-order ledger. Its deterministic second replay starts from current-tree chronological order, applies only evidence-backed duplicate/supersession/late-bundle constraints, and compares the resulting final effect hash against both chronological replay and a fresh read-only production snapshot. The receipt labels failed-after-apply jobs honestly and binds later successful already-applied corroboration. This proves the deployable final database contract without claiming unavailable historical byte/order fidelity.

> **Twenty-sixth-review upgrade (2026-07-15):** Merged #3117, #3121, and #3120 advanced the immutable tree to `424` files / `422` unique versions and the linked ledger to `439` rows with tail `20260714225500`; the append-only fulfillment repair is therefore reallocated to the first free successor `20260714225501`. #3120's first deployment run stopped on the exact historical `20260604132853` name mismatch before applying its migration. Merged #3122 permits only that proven same-version/same-effect alias; run `29417244012`, database job `87358367070`, then applied `20260714220000_quiz_event_lifecycle_followup` exactly once and reported `1 applied, 423 skipped`. The alias is a separate deploy-repair receipt, never an effect-history exceptional record. Schema-v4 provenance now binds base `9e3d1b14b1931a5e441fc23f0e5417c188056e47`, `24` primary evidence sources, and `31` exceptional records. Run `29417244012` path-filtered its deploy job to `skipped`, so the latest proven application release remains `769c1645348d20f719e424423c9d3bedbc5985d0` / run `29380448299`. That honest split does not block local P0 recovery because the only changed frozen P0 paths are CI configuration and a SQL regression test; it does block production-coherence claims, P0 activation, H0 measurement, and final production handoff until an exact-current-main application deployment succeeds.

## Document Role And Required Phase Plans

This contract deliberately spans measurement, database safety, routing, worker operations, publication ACLs, cache providers, and the visible home render. That breadth is useful for cross-phase invariants but is too large for one implementation context or one reviewer gate. The thematic sections below remain the single source of truth for interfaces and invariants; they do **not** override PR ordering.

Before implementation of a phase begins, derive a self-contained plan from the then-current contract and repository into the exact path below. Each derived plan must use the `superpowers:writing-plans` structure: exact files, exact interfaces consumed/produced, red/green TDD steps, exact commands and expected outcomes, one independently reviewable deliverable per task, and no `TBD`, forward reference, or cross-phase file. A phase plan is invalid if a newer contract hash or base merge changes one of its inputs; regenerate and rereview it rather than editing around drift during execution.

| Phase | Required executable plan | May begin only after |
| --- | --- | --- |
| `P0` | `docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md` | approved derived P0 plan plus CLI/Docker/auth preflight; P0 itself owns the main merge and ledger exports |
| `H0-RUNNER` | `docs/superpowers/plans/2026-07-14-ogabassey-cwv-measurement-runner.md` | P0 recovery exact-head gate green; owner-approved persistent-runner host and GitHub administration authority available |
| `H0` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-measurement.md` | P0 recovery exact-head gate and H0-RUNNER availability/attestation gate green |
| `H0-MEASURE` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-rollout.md` | deployed exact H0 SHA and coherent release canaries |
| `H0.5` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-5-cache-contract.md` | valid H0 attribution and hard cache-safety decision evidence |
| `H0.75` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-75-layout-spike.md` | accepted H0.5 ADR |
| `H1A` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1a-data-control.md` | green disposable migration replay and accepted spike |
| `H1B` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1b-routing-readers.md` | merged H1A exact head |
| `H1C1` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1c1-worker-operations.md` | merged H1B exact head |
| `H1C2` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1c2-protected-cache-boundary.md` | merged H1C1 and recorded proxy approval |
| `H1D1` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1d1-publication-cutover.md` | merged H1C2 exact head |
| `H1D2` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h1d2-publication-acl-readiness.md` | proven H1D1 fleet drain; leaves every control final-disabled+null |
| `H0R-H1-MEASURE` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0r-h1-rollout.md` | merged H1D2 exact head with controls initially disabled |
| `H2` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h2-critical-shell.md` | valid same-SHA H0R/H1 gate and H1 exact parent |
| `H2-ROLLOUT` | `docs/superpowers/plans/2026-07-14-ogabassey-home-h2-rollout-decision.md` | merged/deployed exact-parent H2; H1 remains publicly active and H2 is not yet promoted |
| `FIELD` | `docs/superpowers/plans/2026-07-14-ogabassey-home-field-confirmation.md` | absolute controlled-lab pass plus frozen eligible windows |

No executor may implement any normative section directly. The phase index is binding; a derived plan that mixes two rows is rejected even when all tests pass.

Every derived phase plan begins with:

> **Normative contract:** `docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md`
>
> **Frozen inputs:** `CONTRACT_SHA256=<64 lowercase hex>`, `BASE_SHA=<40 lowercase hex>`, `PHASE=<exact phase id>`.
>
> Before first edit and before push, fail unless contract SHA-256 and base ancestry equal these inputs. A contract edit, base merge, dependency-head change, or phase-boundary change requires regeneration and rereview. Consume only listed interfaces and modify only the explicit phase inventory; a later-phase file is a hard failure.

For `P0` only, `BASE_SHA` is the exact target `origin/main` commit that the
approved phase plan must merge as its first implementation task. Planning and
read-only evidence capture may occur while the worktree is behind that commit.
Immediately before the first source, migration, or configuration edit, P0 must
fetch, prove `origin/main == BASE_SHA`, merge it normally, prove `BASE_SHA` is an
ancestor of `HEAD`, and repeat the frozen preflight. That one planned merge does
not invalidate the P0 plan. A different target SHA, an additional base merge, a
contract edit, or a changed dependency/evidence input does invalidate it and
requires regeneration and rereview.

## Outcome

Cut OgaBassey home mobile lab LCP from the directional `6001 ms` PSI result to `<= 3500 ms` in the final accepted H1-or-H2 visible release, with a stretch target below `2500 ms`, while preserving:

- publication and tenant isolation;
- apex, `www`, custom-domain, subdomain, and `/ogabassey` routing;
- one semantic H1, crawlable product links, canonical metadata, and WebPage JSON-LD;
- CLS, INP, keyboard, reduced-motion, and pause-control behavior;
- category and PDP performance.

This is deliberately a **large-gain plan**. A safe result above `3500 ms` may be retained only under the relative-improvement decision matrix below; it does not complete the home work and never unlocks category implementation.

## Rereview Verdict

The previous plan was **not implementation-ready** for four reasons:

1. It inferred that late Hero DOM owned roughly `2.5 s` without an LCP subpart trace.
2. It treated sequential Next → Vercel → Cloudflare invalidation as an atomic publication transaction. It is not; an in-flight stale renderer can finish after a purge.
3. It assembled publication state and Hero products from separate cache generations, then proposed making that mixed result permanent HTML.
4. It prescribed a native carousel rewrite even though mobile TBT is only `38 ms` and no evidence assigns multi-second LCP time to carousel JavaScript.

The corrected proportional architecture is:

```text
safety transaction: publication / hostname / slug ownership
  -> increment persisted safety generation
  -> ensure one specialized pending obligation and its one #3077 domain-event ledger/PGMQ item in the same transaction
  -> while it is unclaimed, later mutations coalesce into that same obligation/event and attach their receipts
  -> after claim, create at most one pending successor with one new event
  -> preserve OLD + NEW identities
  -> commit makes the event visible to the existing domain-event router

#3077 domain-event router (no provider work)
  -> recognize only the internal database-trusted storefront event
  -> atomically create one generic delivery, bind the specialized obligation, and archive PGMQ
  -> remain idempotent across route retries

candidate-affecting content transaction
  -> increment content dirty revision, not public content generation
  -> coalesce one content_reconciliation/merchant target; no provider event exists yet

same #3077 delivery-worker process, JIT content reconciler after debounce
  -> claim only one due reconciliation target into an immediately available slot
  -> read one generation-checked raw-input snapshot
  -> run the existing TypeScript selection + slide builders
  -> compare canonical shared-shell and home-critical fingerprints including renderer epoch + digest
  -> both unchanged: atomically close the reconciliation lease with no event, public generation advance, or purge
  -> home-critical only changed: atomically persist the immutable snapshot and advance content generation; create one exact-home provider obligation/event only when permanent output is claimable, while stable-degraded shell-1 `snapshot_only` creates none
  -> shared-shell changed: atomically persist/advance; permanent shared/cleanup actions create one all-document provider obligation/event, while stable-degraded shell-1 without promotion intent is also `snapshot_only` and a degraded promotion candidate only parks `promotion_staged` with no event until promotion CAS

shell-0 stock / order-quantity / availability mutation
  -> marks the H1 compatibility home-document fingerprint dirty
  -> if rebuilt Product/Offer bytes changed, one durable exact-home transition

shell-1 stock / order-quantity / price / image mutation outside Hero/link membership after Product/Offer removal
  -> affects only the separately no-store client feed
  -> no critical generation and no home-document purge

shell-1 selected crawlable-link status / name / slug / category / created_at ordering mutation
  -> marks the link projection dirty
  -> if rebuilt bounded anchor bytes changed, one durable exact-home transition

static-shell origin fill
  -> resolve cached current safety generation + committed content generation
  -> resolve the immutable public snapshot for that exact pair
  -> accept only OGABASSEY_MERCHANT_ID + matching generation pair + safety compatibility
  -> render published Hero, unpublished shell, or degraded no-Hero state
  -> stamp generation in HTML

#3077 event-delivery worker (sole executor)
  -> JIT-claim a storefront provider destination only when an execution slot is immediately free, using the destination-filtered formula-derived execution deadline and lease
  -> hard-expire Next data tags
  -> fresh origin probe + foreground-delete Vercel data + home-response tags
  -> safety: confirmed kind-scoped OLD+NEW host/path purge without debounce
  -> home content: after an actual home-critical fingerprint change, rate-bounded exact-home URL purge for every alias
  -> shared shell: after an actual permanent parent-shell fingerprint change, rate-bounded dedicated-host/merchant-prefix purge plus home/category/PDP/blog canaries
  -> after quiescence, fresh origin probe + repeat both Vercel and Cloudflare purges
  -> prewarm canonical home
  -> verify browser + Googlebot canaries for the claimed generation pair
  -> complete, supersede to one successor, or retry durably
```

No database/CDN design can make independent providers transactionally atomic. The strict contract is therefore **generation-fenced, transition-classed, confirmed, rate-bounded, and durably retried**, not “zero stale bytes under every provider outage.” The content lane may converge to a newer successor; the safety lane may not claim completion until the latest publication/routing state is proven.

## Preflight

Before implementation:

- [ ] Reuse `/Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home`; do not create another worktree.
- [ ] Run `git fetch origin main --prune` and record `HEAD`, `origin/main`, and `git status --short`.
- [ ] At this review revision the worktree and `origin/main` are both exact `9e3d1b14b1931a5e441fc23f0e5417c188056e47` (`git rev-list --left-right --count HEAD...origin/main` = `0 0`). Re-run that command before the first implementation commit and after every fetch. Any later main commit invalidates the frozen P0 base and requires full receipt/plan regeneration before implementation continues; never preserve a stale hand-written commit list or merge an unreviewed base into this phase.
- [ ] Commit this reviewed plan as a documentation-only baseline, or explicitly exclude it from the first runtime review. Do not let an untracked plan make CodeRabbit scope ambiguous.
- [ ] Merge current `origin/main` normally before each PR; never rebase or force-push this work.
- [ ] Treat P0 and every real H0/H1A/H1B/H1C1/H1C2/H1D1/H1D2/H2 PR **and every prerequisite, dependency, or migration-history repair PR** as an exact-head merge gate. This explicitly includes the post-#3077 recovery PR, the owner-reviewed `20260615120000` collision repair, every production-only-ledger reconciliation, and any #3112/#3024 prerequisite chosen below. After the final normal base merge and push, record the PR's current `headRefOid`, require it remains current/not-behind, require every required check for that exact SHA—including the repository CI Quality Gate—to complete green, require the current-head review verdict to permit merge, and require every review thread resolved. Any new commit or base merge invalidates the old evidence and restarts exact-head checks/review; never merge or deploy a stale/behind head. H0.75 is the sole unmerged/undeployed spike exception and still retains its local artifact proof.
- [ ] Recheck the open-PR overlap table below immediately before changing code.
- [ ] Reconcile the one durable invalidation substrate with merged #3077 and merged documentation-only #3060 before H1. #3077 is now immutable production history: merge commit `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8`, deployment run `29318477334`, with its migration job successful. Preserve every applied filename and byte. P0 must repair its unresolved typing, generated-schema, modularity, and tools/worker-check coverage before H0; H1 then extends the same PGMQ/domain-event delivery ledger, claims, retries, dead letters, replay/audit, heartbeat, and VPS runtime with one storefront-cache destination plus specialized frozen obligations. #3060's competing table/worker names remain superseded while its useful generation semantics are adopted. Never land a second independent queue, retry ledger, dead-letter API, or VPS worker for the same cache work.
- [ ] Before any H1 migration is allocated, prove `git merge-base --is-ancestor 8a0cabe7791e1701371c32a4ac911c32fb40322a HEAD`; this is merged #3114 and is now the required S0-A anonymous-column grant baseline. Run P0's checked `pnpm --filter @baci/web db:replay:chronological` disposable replay, not raw `supabase db reset`, then execute the plain SQL regression with `psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/tests/restore_merchants_anon_public_columns.sql`; `supabase test db` is not a substitute because this file is not pgTAP. Ancestry without successful overlay-hash verification, replay, and grant proof is insufficient.
- [ ] Before allocating any new migration timestamp, run the read-only linked-project migration ledger command with the installed Supabase CLI and export local filenames, remote applied versions, primary deployment evidence for every exception, and checksums/effect assertions. #3077's applied chain from `20260712150001_domain_event_pipeline_tables.sql` through `20260714000400_drop_legacy_event_ingress_rpc_overloads.sql` must never be renamed, retimestamped, or edited. P0 must prove two deterministic paths with its checked runner: chronological application of every current-tree SQL body and production-effect application of that same immutable tree with only the frozen evidence-backed duplicate, supersession, unique-reapply, full-#3077-log-order, and late-bundle constraints. The latter is a partial-order effect replay, not a claim about unavailable total history. The runner bootstraps the known-good Supabase prefix, uses fail-fast `psql` for the remainder, verifies every immutable source/overlay/provenance hash before network or database I/O, uses replay-only ledger identities for duplicate versions, and excludes only migration-ledger bookkeeping from the final comparison. Compare both replay effect hashes with a fresh read-only production effect snapshot covering schema, functions including identity arguments/body/config, grants, policies, queue objects, and typed RPC surface—not version numbers alone. If the three final states differ or an intended effect is absent, add only uniquely timestamped, append-only, idempotent repair/reapply migrations after the reconciled current tail, then repeat both replays and the snapshot. Fail on an unlisted source transform, unexplained production-only version, checksum ambiguity, unsupported total-order claim, or duplicate without an owner-reviewed history record. Repeat after merging latest main; never assume an observed production tail is still current.
- [ ] Treat the known second duplicate migration version as a blocking drift item, not another silent allowlist: `20260615120000_customer_order_cancellation.sql` and `20260615120000_register_push_token_rpc.sql`. Inspect the linked ledger/checksums and both intended current effects, including the later migrations that supersede those surfaces. The linked row records only one applied version, so preserve the deployment-proven applied body byte-for-byte and add an owner-reviewed append-only, uniquely timestamped, idempotent reapply/history record for any intended effect whose lineage or current state is not independently proven. Until both current effects, their grants, the exceptional mapping, and dual-order replay are proven, P0 cannot complete and H1 migration work cannot begin. Never rename or edit an already-applied file merely to make the duplicate disappear.
- [ ] Treat the refreshed 2026-07-14 linked-ledger read as a **current hard block** until every exception has a checked evidence record. The earlier `20260713160000` uncertainty is now resolved: deployment run `29284101263`/job `86932264596` applied `restore_merchants_anon_public_columns` from `8a0cabe7791e1701371c32a4ac911c32fb40322a`, the linked row names that body, and direct grant assertions match it. Historical #3098 blob `640df208b476993be5dc7461ad26db2dfc34d2e4` is explicitly non-production history. #3098's atomic payment body instead entered production at unique version `20260714123000` through merged base `19d03df8544270eaac9ee072f30f2294cd2024b6`. Production `20260615120000` is deployment-proven `register_push_token_rpc`; chronological replay still applies both immutable duplicate bodies under replay-only ledger identities and proves the later six-argument RPC plus cancellation columns/RPC/trigger. Production `20260713130000` is deployment-proven `add_storefront_paystack_subaccount_configured_rpc`; the skipped quiz body entered through unique reapply `20260713140000`. Every production-only row uses the frozen mapping below. P0 and H1 remain blocked until the checked history manifest plus the append-only fulfillment-timestamp repair make chronological and constrained production-effect replay hashes converge with the fresh production effect snapshot and linked read, with no unexplained drift.
- [ ] Treat open #3024 as a hard **pre-H1 migration-allocation and publish-route** prerequisite, not a code dependency of P0. At exact head `f160108c09ebd2d2367b3ae612a7aa9349febd97`, P0 records its exact 17-file top-level migration inventory and body hashes; all 17 versions are collision-free against frozen main `9e3d1b14b1931a5e441fc23f0e5417c188056e47` and the other observed open migration lanes. P0 must not import, retimestamp, or repair #3024 feature work. Before H1A allocates a migration, refresh #3024's exact head, path/body inventory, linked-ledger state, and route overlap. Any newly detected collision, changed migration byte, partially applied chain, or merged lane invalidates the P0/H1 allocation receipt and requires an explicit history strategy; never preserve the superseded nine-file/collision claim from an older review.
- [ ] Before any implementation PR, inventory every non-generated source, config, test, SQL, shell, and runtime file the phase will actually modify and enforce the repository's `<=300`-line/one-primary-export rule on the **finished touched tree**. Split oversized touched legacy files behind thin typed facades in the same phase; there is no implicit configuration-file waiver. P0 additionally checks in the complete #3077 path inventory, but its modularity repair scope is deliberately bounded to the named `811`-line events test, files created by #3077, and pre-existing files P0 itself modifies. Unrelated pre-existing storefront/payment/environment debt in the historical #3077 diff is recorded and deferred, not pulled into P0. The only possible protected-file exception is `proxy.ts`, and P0 never touches it.
- [ ] P0 adds a dedicated non-build TypeScript project at `apps/web/tsconfig.tools-workers.json` covering `tools/db/**/*.ts`, `tools/events/**/*.ts`, the exact `src/scripts/process-domain-events.ts` and `src/scripts/process-event-deliveries.ts` worker entrypoints, their tests, and their transitive imports. Do not broaden this P0 project to `tools/**/*.ts`: the exact base contains unrelated pre-existing `tools/seo` type failures, and repairing them is outside the frozen recovery scope. Change the existing `apps/web` `typecheck` package script to run both the normal project and this project, retain a focused `typecheck:tools-workers` script, and add a contract test proving the unchanged Quality Gate still invokes `pnpm turbo typecheck`. H0 and every H1/H2 slice extend and run that gate; they do not recreate it. The normal `apps/web/tsconfig.json` excludes `src/scripts` and does not include these tools, so its `tsc --noEmit` alone is not proof for generated RPC signatures, no-bare-`SupabaseClient`, operator tooling, rollout provenance, or worker interfaces.
- [ ] Record explicit owner approval in the PR before modifying protected `apps/web/src/proxy.ts`, naming all three exact scopes: the dedicated home-response tag on cacheable anonymous home documents, the dedicated shared-shell response tag on every cacheable anonymous storefront document, and `GET|POST /api/internal/storefront-cache/purge-vercel-tags` bypass of the generic IP bucket only after its dedicated server secret compares valid. The route repeats authentication. If approval is not granted for all three, stop after the non-proxy control-plane work; H1 enablement and H2 are prohibited.
- [ ] Require directly installed Supabase and PostgreSQL CLIs plus a disposable local Docker stack before SQL verification: `command -v supabase`, `command -v docker`, and `docker info >/dev/null`; resolve PostgreSQL as `command -v psql` or the executable `"$(brew --prefix libpq)/bin/psql"`. This host currently uses the keg-only `/opt/homebrew/opt/libpq/bin/psql` (`18.3`), so absence from `PATH` is not absence of the client. Do not rely on `pnpm` falling through to a machine-global `supabase` binary. Derive `LOCAL_DATABASE_URL` from `supabase status -o env`, fail unless its host is loopback, and never point the replay suite at production.
- [ ] Require `gh` and `jq` before the exact-SHA rollout: `command -v gh`, `command -v jq`, and `gh auth status`. The dispatch guard depends on structured GitHub output and must fail closed.
- [ ] Never run `vercel build`. Local Next build proof is allowed and required.

## Mandatory P0 — Post-#3077 Recovery

P0 is the first phase eligible for a derived executable plan. H0, H0.5, H0.75, H1, and H2 are blocked until its exact-head PR is merged, deployed where applicable, and green. P0 changes no storefront rendering and must not add cache-control behavior.

- [ ] Merge current `origin/main` normally, record that #3077 merge `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8` is an ancestor, and preserve the applied migration files byte-for-byte.
- [ ] Add the checked replay surface under `apps/web/tools/db/`: a single-purpose CLI `run-supabase-history-replay.ts`, focused manifest/materialization/effect-hash helpers with one primary export each, and colocated tests. Add `db:replay:chronological` and `db:replay:production-effect` scripts to `apps/web/package.json`. Freeze the sanitized machine-readable discovery receipts at `apps/web/tools/db/fixtures/linked-migration-ledger.json`, `apps/web/tools/db/fixtures/production-effect-provenance.json`, and `apps/web/tools/db/fixtures/production-history-effects.json`; the derived P0 plan defines and tests their exact schemas, canonical serialization, source run/job ids, row counts, hashes, and secret rejection.
- [ ] Before that plan is approved, bind the canonical `production-effect-provenance.json` SHA-256 and exceptional-record count plus primary deployment run id, database job id, primary job conclusion, log ordinal, applied name/version, repository owner path, and owner SHA-256 for every production-only mapping, duplicate-version owner, unique reapply, supersession, or late-applied entry. A failed job may support an applied entry only when its bound log proves that exact successful apply before the later failure and a separately bound successful run/job/log hash uniquely corroborates the same version/name as already applied. The sole planned P0 repair has no pre-existing run/job by definition; its exceptional record instead carries explicit `applied:null`, the frozen repair path/body hash, the production-only linked ordinal, and `nullReason:"p0_append_only_repair_not_yet_applied"`, then gains deployment evidence only in the later normal merged-main rollout. Version-sorted `supabase migration list --linked` output is inventory evidence only and must never be presented as application-order proof; the receipt must label its coverage `partial-order-effect-replay`.
- [ ] The runner uses an isolated temporary Supabase project and fail-fast `/opt/homebrew/opt/libpq/bin/psql` (or the verified `command -v psql` equivalent), refuses non-loopback URLs, cleans only its own project/temporary directory, and never touches the linked database except for the separately read-only ledger/effect export. Check in the sole SQL syntax correction at `supabase/tests/migration_history_overlays/20260525140048_quiz_authoritative_answer_scoring.sql`; its manifest entry binds original SHA-256 `2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41` to corrected SHA-256 `6f6444120e4cefe5febaba935ea70e7a304bf2d330702afc838d4ab70a77b9d8`. All other SQL bytes remain original: top-level `CONCURRENTLY` files run through `psql` outside a transaction, and duplicate versions receive synthetic identities only in the disposable ledger/receipt, never by renaming repository files.
- [ ] Export the linked migration ledger plus the exceptional production-effect provenance/partial-order constraints. Run checked chronological and constrained production-effect replays in disposable databases and compare both against the fresh read-only production snapshot for schema/RPC/grant/policy/queue effects. The historical `20260713160000` ambiguity is now resolved by primary evidence: deployment run `29284101263`, database job `86932264596`, explicitly applied `restore_merchants_anon_public_columns` from merge `8a0cabe7791e1701371c32a4ac911c32fb40322a`; the linked ledger records that name, and read-only effect assertions prove the public grant while withholding secret columns. Historical #3098 commit `f4be1dbff7e2011b5ad8869928d31e0e35d95951`/blob `640df208b476993be5dc7461ad26db2dfc34d2e4` remains a rejected colliding body, not production history. #3098 merged as `19d03df8544270eaac9ee072f30f2294cd2024b6`; deployment run `29365841123`, database job `87197071269`, applied its four now-unique migrations in order: `20260714090000_add_merchant_settlement_failed_review_type.sql`, `20260714093000_scope_capture_review_deduplication.sql`, `20260714100000_add_gateway_payment_wedge_review_type.sql`, and `20260714123000_complete_order_gateway_payment_atomic.sql`. #3099 merged as `1ba7562b640b418e47fd38a4a2449cfec82ea960`; deployment run `29367954362`, database job `87207417765`, applied `20260713123000_preserve_repeat_order_notification_cycles.sql` then `20260713123100_scope_manual_order_notifications_to_cycle.sql`, and deployment job `87207485170` completed green. P0 absorbs those files byte-for-byte from its target base, binds their log-local order and cross-run late-bundle relation, and replays/asserts their final effects; it does not reimplement payment or order-notification behavior or claim total historical order for ordinary rows lacking primary logs. Preserve history and add the one evidence-required, uniquely timestamped, idempotent fulfillment-timestamp repair only after the target base and free tail are frozen; any additional repair requires new missing-effect evidence and plan regeneration.

The P0 history manifest must contain this complete current production-only mapping. `canonical current-tree body` means the final replay source for that effect; `superseded final state` means the historical body is not replayed because the named later migration deliberately owns the final effect. The mapping freezes exact source/target SHA-256 values at plan derivation and rejects any drift.

| Linked version/name | Current-tree replay owner | Mapping rule |
| --- | --- | --- |
| `20260623190041_enable_realtime_negotiation_requests` | `20260623190000_enable_realtime_negotiation_requests.sql` | canonical current-tree body |
| `20260624211416_merchant_email_domains` | `20260624200000_merchant_email_domains.sql` | canonical current-tree body |
| `20260625173604_public_read_storefront_feature_settings` | `20260714010000_scope_feature_settings_read_policies.sql` | superseded final state; anon/public base-table read remains revoked |
| `20260626131520_fix_search_products_condition_filter` | `20260702024830_fix_search_products_condition_filter.sql` | canonical final function body |
| `20260629154903_add_order_fulfillment_timestamps` | P0's new append-only repair | add only missing `orders.shipped_at timestamptz` and `orders.delivered_at timestamptz` with `IF NOT EXISTS` |
| `20260630123511_fix_mobile_admin_product_phantom_columns` | `20260702063638_restore_mobile_admin_product_rpc_contract.sql` | superseded final RPC body |
| `20260701080400_order_item_unit_costs_supplier_analytics` | `20260702140100_order_item_unit_costs_supplier_analytics.sql` | canonical current-tree body |
| `20260701123945_supplier_purchase_analytics_branch_scope` | `20260702140200_supplier_purchase_analytics_branch_scope.sql` | canonical current-tree body |
| `20260706202930_add_storefront_preflight_rpcs` | `20260706200000_add_storefront_preflight_rpcs.sql` | canonical current-tree body |
| `20260706210329_allow_page_config_history_insert` | `20260706162109_allow_page_config_history_insert.sql` | canonical current-tree body |
| `20260707064146_add_blog_listing_preflight_rpc` | `20260706230000_add_blog_listing_preflight_rpc.sql` | canonical current-tree body |
| `20260708072653_create_domain_purchase_transaction_rpc` | `20260708013000_create_domain_purchase_transaction_rpc.sql` | canonical current-tree body |
| `20260708072825_fix_domain_purchase_rpc_merchant_derivation` | `20260708013500_fix_domain_purchase_rpc_merchant_derivation.sql` | canonical current-tree body |
| `20260708075932_lock_domain_purchase_rpc_service_role` | `20260708090000_lock_domain_purchase_rpc_service_role.sql` | canonical current-tree body |
| `20260708102643_optimize_storefront_cached_merchant_and_variant_wrappers` | `20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql` | canonical current-tree body |
| `20260708220832_drop_authenticated_domain_purchase_rpc` | `20260708220947_drop_authenticated_domain_purchase_rpc.sql` | canonical current-tree body |
| `20260713200830_split_platform_blog_anon_read_policy` | `20260713211500_split_platform_blog_anon_read_policy.sql` | canonical current-tree body; earlier linked effect remains an auditable predecessor |

- [ ] Regenerate `apps/web/src/types/supabase.ts` from the replayed schema and compile every #3077 RPC against its generated signature. The generated `Database` type intentionally models full table schemas and is **not** a public-projection allowlist. Add `apps/web/src/lib/events/event-pipeline-boundary-manifest.ts` with one primary exported manifest and a colocated test. For every checked event-pipeline path it freezes the authority (`anon/caller`, authenticated user, or service role), table/RPC, operation, selected columns or generated `Args`/`Returns`, and expected factory. The direct database projections are exhaustive, partitioned, and may not bleed across authorities: **identity** uses only `merchants.id`, `merchant_slug_aliases.merchant_id`, and `domains.merchant_id` through the recorded anon/caller factories; **paid-order hydration** uses only `orders.id, merchant_id, order_number, payment_status, total, currency, customer_email, customer_phone, customer_name, customer_id, shipping_address, ad_tracking` plus `order_items.id, product_id, name, price, quantity` through the service-role delivery factory; **conversion enrichment** uses only `merchants.country, payout_currency` through that factory; **legacy fallback persistence** writes only `analytics_events.merchant_id, event_type, event_data, event_timestamp, source, event_id` and `platform_events.event_data, event_id, event_timestamp, event_type, ip_address, merchant_id, page_url, referrer, session_id, user_agent` through the manifest-recorded server authorities; and **provider configuration** is the separately frozen secret projection `merchants.plan_tier, plan_expires_at, premium_features, offline_conversions_enabled, facebook_pixel_id, facebook_capi_token, tiktok_pixel_id, tiktok_access_token, google_analytics_id, ga4_api_secret, snapchat_pixel_id, snapchat_capi_token`, the matching eight credential columns on `merchant_feature_settings`, and `platform_settings.google_analytics_id, ga4_api_secret, facebook_pixel_id, facebook_capi_token`. Service-role authority applies only to durable delivery and the already-existing reviewed conversion/events legacy server fanout. Public untrusted Facebook/GA4/Snapchat/TikTok routes retain their caller-supplied typed RLS client and may never import the service factory or trusted wrapper; `/api/analytics/ads` retains its existing authenticated caller-scoped class. The conversion/events routes make their pre-existing hidden service authority explicit only after their route orchestration resolves the merchant identity; the wrapper receives that resolved identity as a separate argument and must reject any event/raw-body merchant mismatch, and no new importer is allowed. Provider credentials remain internal server inputs and must never enter an anon/public response, log, event payload, generated public snapshot, or client bundle. The manifest covers all nineteen final public #3077 event-pipeline functions and classifies them exactly: fifteen TypeScript-direct application functions, `cleanup_domain_event_pipeline_v1` as the MJS-direct service-role retention function, `is_event_ingress_capability_v1` and `replay_event_delivery_v1` as SQL-internal helpers, and `get_domain_event_queue_metrics_v1` as a service-role-only metrics function with PUBLIC/anon/authenticated execute revoked. Generated signature, identity/body/config, grant, and replay-effect checks cover all nineteen; the TypeScript caller guard applies to the fifteen TypeScript-direct functions, while the MJS cleanup receives a source-shape/generated-signature contract. A function may not be omitted merely because current TypeScript does not invoke it. Any additional column, authority, raw table query, or RPC requires an explicit reviewed manifest change. RPC arguments and returns must come from `Database['public']['Functions'][name]`, not handwritten escape types.
- [ ] Replace every #3077 runtime bare `SupabaseClient` with `SupabaseClient<Database>` or the exact typed factory return and add a static/compile-time boundary guard driven by that manifest. Its AST scope is exact: the seventeen current bare-client paths; `apps/web/src/app/api/admin/event-pipeline/replay/route.ts` and its test because that route invokes three replay RPCs through the inferred server factory; `apps/web/src/app/api/platform/events/platform-event-forwarding.ts` and its test because that #3077-created path performs the trusted `platform_settings` read; their direct database-bearing delivery closure through `apps/web/src/lib/analytics/analytics-platform-config.ts`; the service-role factory in `apps/web/src/lib/supabase/service.ts`; the raw hidden factory and second configuration read currently embedded in `apps/web/src/lib/analytics/send-to-ad-platforms.ts`; the pure entitlement predicate currently imported from mixed `apps/web/src/lib/merchant-feature-gates.ts`; and the corresponding tests. P0 must extract that predicate into a pure module, type the central service factory with `Database`, brand its `ServiceRoleClient` return with a non-exported `unique symbol` so an ordinary `SupabaseClient<Database>` is not structurally accepted, split configuration loading into a typed caller-injected fetch, split provider delivery into a DB-free Node-compatible configured fanout accepting `Readonly<AnalyticsPlatformConfig>`, and add a narrowly named Next-only trusted-server wrapper for only the two reviewed legacy route importers. Durable delivery passes its already-loaded immutable configuration to the pure fanout. Existing ads/Facebook/GA4/Snapchat/TikTok route sources remain byte-unchanged through the compatibility facade; static analysis proves their existing caller-scoped config path cannot reach the service factory/wrapper. Conversion/events legacy fanout imports the trusted wrapper explicitly and passes the route-resolved merchant identity rather than the raw request-body id. `/api/analytics/conversion` already owns a resolved merchant id; `/api/events` must retain the resolved context when durable enqueue is on and perform the same tenant-resolution check solely for elevated fanout when durable enqueue is off, without changing legacy persistence/response. Only after independent verified resolution may either route construct the branded service client. If that context is absent, mismatched, or unverified, it skips the trusted fanout with a typed reason and performs zero service-role I/O. The wrapper signature carries `(client, resolvedMerchantId, event, options?)` and rejects `event.merchant_id !== resolvedMerchantId`. Durable-on/off and raw/resolved mismatch tests are mandatory. A regression test proves each durable delivery attempt selects configuration exactly once; the hidden second service client/read is removed. A static import-boundary test proves credential-bearing runtime modules are unreachable from every `'use client'` graph and freezes the wrapper importer set to those two routes. Only the Next-only trusted wrapper may import `server-only`; the VPS worker-shared fanout remains plain-Node compatible. Network-only provider modules remain in touched-tree/modularity and behavioral-test scope but gain no database authority. The guard rejects bare `SupabaseClient`, untyped SDK factories inside this frozen closure, all current `64` `as never` escapes in the #3077 boundary tests, double assertions, and assertions around RPC names, generated `Args`, or generated `Returns`. It does **not** recursively claim that every unrelated caller of the shared service factory is a P0 event boundary, and it does not scan unrelated assertions in the historical #3077 diff. Replace the `58` client/mock escapes with a typed test-client builder; rewrite the six deliberate malformed-value cases to enter through `unknown`/parser boundaries. Because that necessarily modifies the current `376`-line `trigger-purchase-conversion.test.ts`, split it below the repository limit in P0. The JavaScript VPS cleanup boundary is verified by a generated-signature compile-time contract plus a source-shape assertion; do not claim that an untyped `.mjs` file itself was TypeScript-compiled.
- [ ] Split the `811`-line events-route test by behavior. Bring every non-generated file **created by #3077** and every pre-existing file **actually modified by P0** into the repository's `<=300`-line/one-primary-export contract, including `supabase/tests/domain_event_pipeline.sql` (`304` lines), the analytics conversion route (`302` lines), the trigger-conversion test (`376` lines), and the direct delivery closure's current `745`-line `send-to-ad-platforms.ts`. In addition to line-count splits, decompose the known #3077-created multi-primary-export modules `event-pipeline-config.ts`, `event-redaction.ts`, `event-route-registry.ts`, `schemas/event-dead-letter.ts`, `process-domain-events.ts`, and `process-event-deliveries.ts`, plus the now-in-scope `analytics-platform-config.ts`, `send-to-ad-platforms.ts`, and mixed `merchant-feature-gates.ts`; add a focused colocated contract test for the typed `service.ts` factory. Thin framework/CLI/compatibility facades may re-export the focused typed units they invoke. Check in the exact #3077 path inventory and record—but do not refactor—unrelated pre-existing oversized files that #3077 merely touched. In particular, P0 must not turn this gate into storefront, checkout, orders, payment-webhook, environment-module, or IMEI refactors. Documentation is evidence, not source-code modularity input. Next route method exports and thin re-export facades may expose the framework-required surface while retaining one primary responsibility.
- [ ] Add `apps/web/tsconfig.tools-workers.json`, wire `typecheck:tools-workers` into the existing `apps/web` `typecheck` script, and prove the repository Quality Gate still reaches it through `pnpm turbo typecheck`. Create `.github/scripts/tools-worker-typecheck-contract.test.mjs`, side-effect import it from the already CI-invoked `.github/scripts/resolve-ci-test-plan-config.test.mjs`, and include `node --test .github/scripts/tools-worker-typecheck-contract.test.mjs` in P0's local cumulative gate. Do not assume root `pnpm turbo test` discovers `.github/scripts` tests.
- [ ] Verify the complete 26-file immutable inventory, and first correct `apps/web/src/lib/domain-event-pipeline-migration.test.ts` so its immutable list includes the currently omitted `20260713113000_preserve_delivery_context_in_domain_events.sql` and `20260713205000_separate_delivery_replay_attempt_budget.sql`. Then verify both replay modes, schema/RPC/grant/policy/PGMQ effect equivalence against the fresh production snapshot, generated-type diff, typed RPC inventory, no-bare-client guard, touched-tree modularity inventory, targeted #3077 suites, `pnpm --filter @baci/web typecheck:tools-workers`, `pnpm turbo lint`, `pnpm turbo typecheck`, `pnpm turbo test`, local CodeRabbit review, and exact-head GitHub checks/review. Verify production database effects read-only and require every producer/worker flag disabled. Record an installed worker only when exact source and inert state are proven; absence is not a P0 failure. A still-running deployment is not completion evidence.
- [ ] Keep #3060 as a separate superseded-workaround/documentation decision. P0 does not import its second queue or HTTP drainer.
- [ ] P0 does not enable the event pipeline, install a new VPS service, or infer service health from the Vercel deployment. Read-only production verification proves database effects and that every producer/worker feature flag remains disabled. If a #3077 service is already installed, record its source SHA, unit state, effective flags, and heartbeat and require inert schema compatibility. If absent, record expected absence; H1C1 owns only exact-release inert installation/extension, while `H0R-H1-MEASURE` alone owns activation after its green H0R gate.

P0 plan derivation has one fail-closed evidence rule: if the target-base merge,
completed deployment logs, linked ledger, direct effect assertions, or free
migration tail differ from the frozen discovery receipt, stop before a repair
or generated-type write, regenerate the P0 plan with exact filenames/bodies,
and rereview it. A conditional placeholder migration is forbidden.

## Evidence Baseline

Exact post-PR-3082 release `0069d2ec1c6235bdc83c2aabf37f63d9d6ad0dce` produced:

| Surface | Prior run `29210282711` | Post-3082 run `29269951590` | Change |
| --- | ---: | ---: | ---: |
| Home mobile LCP | `6451 ms` | `6001 ms` | `-450 ms` (`-7.0%`) |
| Home mobile CLS | `0.160` | `0.076` | `-52.5%` |
| Home mobile score | `70` | `77` | `+7` |
| Home mobile TBT | `63 ms` | `38 ms` | `-25 ms` |

Interpretation:

- PR #3082 materially improved stability, not loading speed.
- Both historical workflow rows are single-run directional samples; H0 establishes the first six-observation home-mobile median plus dispersion baseline for architectural decisions.
- A fresh 2026-07-13 browser/Googlebot header probe observed the same Cloudflare object (`CF-Cache-Status: HIT`, continuously increasing `Age`) while the origin-facing headers simultaneously reported `x-vercel-cache: BYPASS`, browser `Cache-Control: private, no-cache, no-store`, and CDN `CDN-Cache-Control: max-age=3600, stale-while-revalidate=86400, stale-if-error=86400`. These layers are not contradictory: Cloudflare is caching under the CDN policy while Vercel/browser cacheability differs. Gate 0 records the full tuple instead of collapsing it to “warm” or “cold.”
- The current PSI collector exposes aggregate LCP/CLS/TBT and delayed field INP, but not a release-scoped LCP decomposition.
- Existing PostHog `web_vitals` events already carry LCP `ttfb`, `loadDelay`, `loadDuration`, `renderDelay`, `debugTarget`, `lcpUrl`, navigation type, tenant context, release version, and commit SHA. No new telemetry SDK is required.
- PSI field data and CrUX are delayed cohorts; they cannot prove an exact release.

## Hard Invariants

1. **Identity:** Static shopping HTML is admitted only for `OGABASSEY_MERCHANT_ID`. Absolute links solve path prefixing; they do not prove tenant identity.
2. **Coherence:** Publication state, business name, canonical slug, safety generation, committed content generation, and the immutable rendered snapshot pointer come from one database snapshot contract. A safety mutation invalidates snapshot compatibility until reconciliation commits `snapshot_safety_generation=current`; that equality plus current control/render/renderer state is render admission. `confirmed_safety_generation` is completion/audit evidence only and must never form a circular Hero-admission gate before the canary that is supposed to observe that Hero.
3. **No cached failure:** Timeouts, missing data, and errors are never cached as authoritative `null`.
4. **Publication:** There is no intentionally accepted CDN-TTL stale window. Every enabled safety mutation atomically ensures one pending specialized obligation plus its single #3077 domain-event ledger/PGMQ item, or coalesces into the existing unclaimed obligation without emitting another event; enqueue failure on new work rolls back the mutation rather than acknowledging untracked state. The exact-release-fenced domain-event router atomically creates/binds the generic delivery, and the exact-release-fenced delivery worker is the sole provider executor. Their recovery sweeps are the backstop. The operational target is delivery claim start within 5 seconds of source commit and latest safety canaries within 2 minutes when providers are healthy. A transition may claim completion only after its safety canaries pass; provider outage remains durable and alerting, not falsely complete.
5. **No service role in storefront/publication request reads:** The static storefront uses only the minimal anon-safe generation/snapshot projection. The publish request/status path uses the caller's authenticated client and exact tenant-authorized eligibility/mutation/status RPCs; neither surface creates, receives, or passes a service-role client. The hardened authenticated SECURITY DEFINER publication RPC evaluates only the exact required `merchant_verifications` flags internally with fixed `search_path`, explicit projection, permission checks, and revoked default execute. Broad service-role raw-input/commit/delivery authority remains only in the server-only VPS worker adapter; operator authority remains only behind #3077's authenticated admin surface.
6. **Initial HTML proof:** React source order, a mocked component call, or a fully collected streamed response is insufficient. Any H2/permanent-ownership claim must prove that the whole route tree places the Hero in the prerendered static shell. H1 remains request-owned and may establish the exact performance baseline, but it cannot claim permanent initial-HTML ownership.
7. **Degraded behavior:** Under H1 shell 0, a schema-valid bound but generation-incompatible snapshot may emit only the reviewed product-free neutral WebPage/H1 contract plus fixed reserved geometry covered by the exact completed-document closure; it emits **no Hero, product row, product link, price, image, or request shopping continuation**. Under H2 shell 1, degraded or renderer-mismatch output is likewise fully product-free and contains no request continuation. A timeout/RPC/schema failure is `unavailable`: it emits no merchant-branded static bytes; a request-scoped lookup may route a positively reassigned foreign tenant to its generic renderer but may not render exact-Oga shopping bytes. None is a slower Hero fallback.
8. **Development behavior:** Preserve the current unpublished-store development exception. Development may use request-scoped preview content, but it must not turn a cached stale shell into product UI.
9. **No speculative carousel rewrite:** Keep the current carousel in this plan. Write a separate plan only if post-release evidence assigns material render delay, JS CPU, or INP to it.
10. **One measurement lane:** A single exact-SHA workflow may take repeated serial samples. Never overlap PSI, DebugBear, or browser automation.
11. **Output-driven invalidation with one generation, two public views, and complete cached-object closure:** A candidate-affecting mutation may mark content dirty, but only the worker running the existing TypeScript builders can advance public `content_generation` and purge. The worker commits five canonical digests atomically: `homeLcpFingerprint` for page-owned metadata/WebPage/H1/Hero/slide/resource-hint bytes; `homeSemanticFingerprint` for the active-shell graph; `homeCrawlableLinksFingerprint` for a bounded product-link projection; `homeCriticalFingerprint = SHA-256(canonical JSON {version:2,criticalShellContractVersion,homeLcpFingerprint,homeSemanticFingerprint,homeCrawlableLinksFingerprint})`; and `homeDocumentFingerprint = SHA-256(canonical JSON {version:1,homeCriticalFingerprint,sharedShellFingerprint,staticDocumentClosureDigest})`. `sharedShellFingerprint` covers every mutable cacheable shared-shell byte emitted across home/category/PDP/blog: critical theme/CSS variables, inherited base metadata/head, product-free header/navigation/footer content, and any static analytics/config value. Under H1 shell 0, the semantic projection is the full current Organization/LocalBusiness/WebSite/topical/navigation/category/blog/homepage-CollectionPage/Product/Offer graph. Under H2 shell 1, a dedicated canonical builder reconstructs the reviewed non-inventory graph, excluding the inventory-bearing homepage collection `mainEntity`, JSON-LD product significant links, Product/Offer nodes, availability, price, stock, and image bytes—not non-product category/navigation CollectionPage nodes. H2 preserves crawlability separately through at most 24 active public anchors containing only product name plus canonical absolute href, selected by deterministic `created_at DESC, id ASC`; no price, stock, availability, image, Offer, or client-feed row is in that projection. The immutable snapshot owns the early LCP/shared-shell view and deferred semantic/link view. Before any compatible **home measurement marker, Hero, or semantic marker** can render, one request-memoized document adapter loads and validates both views for the same identifier/shell/generation/component/composite/document tuple; product-free route-wide safety/shared markers and the disabled safety marker use the separate safety-proof producer and do not force a home semantic read. Under H1 the request-scoped publication/tenant guard remains the Hero DOM visibility owner; under H2 the exact same early projection becomes permanent. Under both shells, the early projection feeds static shared chrome plus Hero/measurement bytes and is serialized first; the already-validated semantic graph and crawlable anchors serialize only afterward and never rebuild from live rows. The visible below-fold product feed and user/personalized widgets use a tenant/host-bound no-store client endpoint, fixed skeleton geometry, and `fetch(...,{cache:'no-store'})`; their product rows are absent from initial HTML, RSC, metadata, and cache keys. A change in any home component digest advances the same content generation and creates/coalesces one `home_content` duty based on the composite/document digest; a shared-shell change selects all-document work and subsumes home. There is never an independently advancing component generation. While shell 1 is stable degraded, public home component/document marker fields are null and a home/shared data change is snapshot-only unless promotion or an incompatible inherited duty blocks commit. Under shell 0, `products.updated_at` remains a positive semantic-selection dependency because the current bounded graph query orders/limits by it. Under both shells, `products.created_at` is positive for Hero/link membership/order. After shell 1 removes Product/Offer bytes, non-Hero price/image/stock/order-quantity/`updated_at` feed-only changes are negative; selected-link status/name/slug/category/`created_at` changes remain positive. A whole-response raw HTML/RSC closure test enumerates every mutable byte and proves it is fingerprint/purge-owned or absent behind the no-store boundary.
12. **Rate-bounded, non-narrowing convergence:** Ordinary content cannot cause more than one provider transition attempt per merchant per 60 seconds across both content scopes. Ordering is safety, then shared shell, then home content. The outstanding document scope forms the lattice `home_content < shared_shell`; coalescing, transfer, and supersession may upgrade home to shared shell but may never narrow an unfinished shared-shell duty to home, even when a newer generation changes only home bytes. A shared-shell claim covers a same-generation pending home claim rather than double-purging. Safety transitions bypass the content debounce, not provider capacity: a durable provider-limit-scoped budget (Cloudflare account + verified plan/tier + operation bucket) gives safety priority and bounds every purge operation across zones. A safety reconciliation that changes or inherits **visible permanent** shared-shell bytes must itself execute all-document purge plus shared-shell canaries or attach a shared-shell successor; stable degraded data-only changes follow the content-null snapshot/carry rule, and cleanup is always retained separately. Home-only safety proof can never cover a visible shared-shell or cleanup duty. Provider `429` responses honor `Retry-After` and never create an inline or background retry loop.
13. **Code is an input:** A DB-authoritative, monotonically activated renderer epoch + digest + critical-shell contract version covers pinned-slug configuration, selection/builders, formatting, public schema, and whether the permanent static-shell consumer exists. A checked-in renderer-contract manifest and executable import/source-closure verifier mechanically fail when a covered file changes or a semantic local import enters/leaves without a deliberate contract update. Snapshots, claims, cache keys, and workers carry that contract. A stale worker cannot commit after activation, and a code-only mismatch forces reconciliation rather than serving an old immutable snapshot indefinitely.

### Normative control transition set

Only `disabled -> enabling`, `enabling -> enabled` through the enable finalizer, `enabling -> draining` for abort/emergency shutdown, `enabled -> draining`, and `draining -> disabled` through the disable finalizer are legal, plus byte-identical same-state operation replay. Direct `enabling -> disabled`, `enabled -> disabled`, and `draining -> enabled` transitions are forbidden.

## Acceptance Gates

### Gate 0 — attribution before UI work

Proceed to the generation/shell implementation only when both are true:

- A real mobile lab trace shows that the Hero element or selected image is unavailable/undiscoverable until the postponed route subtree resolves.
- Across the six H0 home-mobile slots of the one controlled campaign, measure finite timestamps on one monotonic clock for `staticAnchorObservedAt`, selected-image `requestStart`, `responseEnd`, and `heroElementInsertedAt`; derive `loadDuration = responseEnd - requestStart` and require it finite and nonnegative. The static anchor is the required server measurement marker immediately before the postponed Hero boundary. Require one exact no-redirect selected resource and one exact LCP node, `staticAnchorObservedAt <= heroElementInsertedAt`, and stable same-byte resource/node identity across the cohort. For observation `i`, compute `counterfactualResourceReady_i = requestStart_i <= staticAnchorObservedAt_i ? responseEnd_i : staticAnchorObservedAt_i + loadDuration_i`, `counterfactualHeroReady_i = max(staticAnchorObservedAt_i, counterfactualResourceReady_i)`, `currentHeroReady_i = max(heroElementInsertedAt_i, responseEnd_i)`, and `causalHeroAvailabilityGain_i = max(0, currentHeroReady_i - counterfactualHeroReady_i)`. This is a predeclared mechanistic same-byte **counterfactual availability estimate**, not an observed LCP effect; it attributes only delayed resource discovery and delayed element insertion and excludes CSS, font, main-thread, and post-readiness presentation delay. Report `loadDelay`, `renderDelay`, and total LCP only as diagnostics. Proceed only when `median(causalHeroAvailabilityGain) - madScale(causalHeroAvailabilityGain) >=2500 ms`; otherwise stop and route to the measured owner.

Gate 0 is browser-cold but **CDN-state-controlled**, not “origin cold.” PSI's Lighthouse `network-requests` audit does not expose response headers, so it is never asked to fabricate `CF-Cache-Status`/`Age`/cache-control evidence. Exact PSI release proof remains the unique `?dpl=` asset marker. Each phase's fixed raw browser/Googlebot canaries record the header tuple as conditioning evidence, explicitly labeled as the GitHub runner's PoP rather than the PSI PoP; the controlled Chrome/Lighthouse campaign records the actual root-document `CF-Cache-Status`, `Age`, `x-vercel-cache`, browser `Cache-Control`, `CDN-Cache-Control`, `Vary`, `ETag`, `CF-Ray` colo suffix, `x-vercel-id`, root-body SHA-256, deployment marker, and normalized redirect/cache-key inputs for every route/profile cohort. H0, H0R when required, H1, and H2 execute the same ordered pre-canary/prewarm sequence. PSI therefore proves release-marker coherence and external directional corroboration only; it owns no causal, absolute, retain, or rollback verdict.

The predeclared decision class is exactly `cloudflare_hit_single_object`, evaluated independently per route/profile controlled cohort: after one unmeasured prewarm for that exact route/profile, every measured navigation uses the same scheme/host/path/query-free URL, UA/device/Vary inputs, and Cloudflare colo; every root response is `CF-Cache-Status: HIT`; deployment marker, normalized policy headers, `x-vercel-cache` class, `ETag` when present, `x-vercel-id`, and root-body SHA-256 are constant inside the cohort; and integer `Age` is nonnegative and nondecreasing. The prewarm may miss and is not an observation. An `Age` reset, colo change, object-identity change, non-HIT response, or cache-key/Vary drift invalidates only that controlled cohort; there is no post-hoc segment. Cross-phase bytes and Age need not match, but class, normalized inputs, and policy must. A class/policy mismatch or excessive dispersion is insufficient evidence. PSI disagreement is reported as `external_corroboration_disagrees` and routed for diagnosis; it does not invalidate or rescue a valid controlled cohort. Report median, MAD, IQR, min, and max for controlled and PSI cohorts separately.

If Gate 0 fails, route work to the measured owner:

| Dominant subpart | Next architecture slice |
| --- | --- |
| TTFB / cache miss | CDN route-key, cache-hit, origin-fill, and alias-coherence work |
| Resource load duration | Hero byte size, image origin, format, dimensions, and candidate-selection work |
| Render-blocking/FCP gap | critical CSS, font, and render-path work |
| Late element/resource discovery | advance to the approved derived H1/H2 phase plans for this generation-fenced initial-HTML contract |
| Interaction/LoAF | separate evidence-backed carousel/client plan |

### Gate 0.5 — choose and record the cache-consistency contract

The current production home response is not minutes-bounded: a live 2026-07-13 probe returned `CF-Cache-Status: HIT`, `Age: 3075`, and `CDN-Cache-Control: max-age=3600, stale-while-revalidate=86400, stale-if-error=86400`. A short Next `cacheLife` cannot invalidate HTML already stored at Vercel or Cloudflare, and a Cloudflare Cache Rule can override origin headers. Therefore H1 must not begin until ADR 002 records one of these choices:

| Choice | Required contract | Result |
| --- | --- | --- |
| **Strict hybrid — default only after proof** | Durable generation fence plus transactional #3077 delivery for publication/routing safety; coherent snapshot plus debounced exact-home invalidation for ordinary rendered-Hero content; one continuously polling VPS executor; no intentional TTL stale window; and either (a) a provider/runtime-enforced hard end-to-end stale-fill/cache-commit bound or (b) generation-aware fail-closed cache admission that proves a pre-mutation response cannot repopulate the CDN after purge. Empirical p99 is diagnostic only. Healthy-provider target: claim within 5 seconds and canary completion within 2 minutes | Continue with H1/H2 only after the chosen correctness fence passes integration proof |
| **TTL-only bounded staleness** | Owner explicitly accepts an end-to-end stale-shopping-HTML SLO; hard-expiry budgets across the snapshot, Vercel document, and Cloudflare document sum to no more than that SLO; SWR/SIE stale serving is disabled for the home HTML at every layer; the Cloudflare rule is proven to respect the intended policy; synchronous eviction remains; a controlled cache-hit/TTFB/LCP pilot passes | Stop after H0 and write a smaller replacement implementation plan; do not execute H1/H2 below |

The ADR must quantify the complete cache chain rather than calling a single `300 s` layer a five-minute guarantee. Refusing TTL-bounded staleness does not itself prove the strict path: the ADR must name and prove one of the two strict correctness fences above. If neither can be proven, H1/H2 stop and the owner must choose the bounded-staleness contract explicitly. The ADR must also record the actual Cloudflare plan, its account-shared purge budget, and whether dashboard rules override origin `CDN-Cache-Control`.

The downstream H1 contract currently instantiates strict option (a), the enforced hard bound. Selecting generation-aware fail-closed admission instead requires a reviewed contract revision and regenerated H1 phase plans that replace—not silently bypass—the hard-bound fields/tests.

### Immediate exact-release gate

Use four serial measurement states: H0, H0R, H1, and H2. Each state owns exactly one immutable workflow campaign and run id with two namespaced 21-slot sets inside the same bounded run attempts: cache-controlled Chrome/Lighthouse authority first, then PSI external corroboration. Shared provenance, content/profile contracts, and pre/post controlled canaries bind the authoritative stage; a PSI-only failure, orphan, or later diagnostic drift cannot veto already-frozen controlled evidence. Each namespace has six home-mobile observations and three observations for home desktop plus category/PDP mobile and desktop. Run Lighthouse `13.4.0` programmatically with the campaign-frozen Chrome/profile contract and retain every raw LHR/CDP log. CDP—not Lighthouse's summarized network audit—proves root cache headers, colo, deployment marker, body digest, cache-key inputs, and object identity. Controlled evidence owns every immediate LCP/FCP/CLS/TBT pass, retain, rollback, absolute-target, and non-regression decision; PSI disagreement or incompleteness is external diagnostic evidence only. H1 is judged against same-SHA H0R and H2 against its exact H1 parent. H0-to-final is contextual unless frozen comparison/profile contracts match. Every home-mobile verdict uses all six controlled observations; median for six is the mean of sorted positions 3 and 4. Report MAD/IQR/range separately for controlled and PSI evidence.

The small lab cohorts use deterministic MAD stability margins, not confidence intervals, standard errors, or inferential uncertainty. For each cohort compute `madScale = 1.4826 × MAD`, `stabilityUpper = median + madScale`, and, for positive-time candidate/baseline comparisons, `pooledMadDispersionPct = 100 × sqrt(candidateMadScale² + baselineMadScale²) / baselineMedian`. Define `dispersionAdjustedGainPct = rawGainPct - pooledMadDispersionPct` and `dispersionAdjustedRegressionPct = rawRegressionPct + pooledMadDispersionPct`. These are predeclared conservative decision heuristics only. A material gain requires `dispersionAdjustedGainPct >=10%`; non-regression requires `dispersionAdjustedRegressionPct <=10%`. CLS uses `candidateStabilityUpper`, `(candidateMedian + candidateMadScale) - (baselineMedian - baselineMadScale)`, and raw MAD `<=0.01`. TBT uses the positive-time rule when baseline is positive; when baseline is zero, candidate `stabilityUpper` must be `<=20 ms`; in all cases it must be `<=100 ms`. The absolute home-mobile target requires median and `stabilityUpper` both `<=3500 ms`; stretch requires both `<2500 ms`. A stability margin crossing a threshold is insufficient evidence. Do not describe any lab margin as probability, confidence, or statistical uncertainty.

The controlled lab has one authoritative performance variable and one Gate-0 attribution variable. `controlledLcp` is Lighthouse LCP from a cache-proven controlled observation. `causalHeroAvailabilityGain` is the H0-only, same-byte late-discovery/insertion estimate defined above. H1 requires dispersion-adjusted `controlledLcp` non-regression against H0R. H2 requires a positive dispersion-adjusted `controlledLcp` direction against H1, the exact slide-zero image in initial HTML, and earlier selected-resource/element availability consistent with the intended mechanism. The controlled cohort owns the `3500 ms`, stretch, `10%` material-gain, and rollback decisions. PSI remains external corroboration only.

Before H1 may become `H1_LAB_BASELINE_SHA`, its controlled cohort must pass the visible shell-0 **whole-document/root-closure** gate: exact cardinality/cache provenance; green publication/tenant/SEO canaries; proof that the cached HTML/RSC object contains only the admitted early, semantic/link, shared-shell, static-closure, and fixed client-placeholder bytes; zero visible feed rows; home/nested CLS stability upper `<=0.10` and delta `<=0.01`; home TBT stability upper `<=100 ms` plus its non-regression rule; and home/category/PDP mobile/desktop LCP/FCP dispersion-adjusted regression `<=10%`. Home-mobile CLS `<=0.05` remains H2's stricter guardrail. A new H1 SHA requires a new immutable campaign and controlled cohort; PSI cannot promote or reject the baseline.

- Controlled home-mobile median LCP and stability upper are `<=3500 ms`. Stretch: both `<2500 ms`.
- Home mobile CLS has `stabilityUpper <=0.05`, raw MAD `<=0.01`, and H1-relative stability delta `<=0.01`.
- Home mobile TBT stability upper is `<=100 ms` and passes the H1-relative positive-time/zero-baseline rule.
- Home mobile LCP/FCP pass dispersion-adjusted `<=10%` H1-relative non-regression.
- Home desktop CLS has `stabilityUpper <=0.10`, raw MAD `<=0.01`, and H1-relative stability delta `<=0.01`; home desktop LCP/FCP pass dispersion-adjusted `<=10%` H1-relative non-regression.
- The LCP element is the slide-zero Hero image and exists in the prerendered document.
- Category and PDP mobile controlled LCP/FCP pass dispersion-adjusted `<=10%` H1-relative non-regression; CLS stability upper is `<=0.10` and delta `<=0.01`. Historical single PSI rows remain directional only.
- Category and PDP desktop controlled LCP/FCP pass dispersion-adjusted `<=10%` H1-relative non-regression; CLS stability upper is `<=0.10` and delta `<=0.01`.
- Browser and Googlebot responses agree on release marker, safety/content generation markers, canonical, H1, tenant identity, image candidate, and slide-zero link.
- An unpublished shell at the latest safety/committed-content pair contains no product image, product copy, Offer/Product schema, or PDP link.

Decision:

- Evaluate these rows top-down after safety, SEO, accessibility, and controlled nested-route guardrails. All medians and stability margins in this table come from the controlled Chrome/Lighthouse cohort.
- If controlled H1 home-mobile median and stability upper already reach `<=3500 ms` and the complete H0R-relative controlled gate is green, stop before H2 and report the causal H0R → H1 effect plus H0 → H1 context when contracts permit.
- If controlled H2 home-mobile median and stability upper are `<=3500 ms`, its dispersion-adjusted LCP direction versus H1 is strictly positive (`>0`), slide zero is proven in initial HTML, and every controlled guardrail is green, the home architecture passes.
- If controlled H2 remains above `3500 ms` but its dispersion-adjusted LCP gain is `>=10%`, slide zero is in initial HTML, and every controlled guardrail is green, retain H2 but keep the home objective and category implementation incomplete.
- If controlled H2 remains above `3500 ms` with dispersion-adjusted gain `<10%`, has a nonpositive controlled direction, or fails a controlled non-regression guardrail, execute the forward-epoch visible rollback and route to the measured owner.
- Any publication, tenant, canonical/SEO, stated CLS/FCP/TBT/category/PDP guardrail, hydration, accessibility, or controlled interaction failure rolls back H2 immediately regardless of LCP.
- PSI disagreement is recorded beside the decision but cannot change any row above.

PSI `loadingExperience`/CrUX INP is delayed cohort data and is diagnostic only in the immediate gate; it cannot pass or fail an exact release. Immediate interaction safety comes from lab TBT plus the controlled keyboard/swipe/reduced-motion/console checks. Exact-release INP comes from the later PostHog cohort.

### Field confirmation

After at least 48 hours, query exact-release PostHog cohorts:

- `event = 'web_vitals'`;
- initial-navigation hostname `ogabassey.com`, pathname `/`;
- metric `LCP`, `INP`, or `CLS`;
- exact `git_commit_sha`;
- mobile viewport cohort (`$screen_width <= 767`); missing-width rows are reported separately and are ineligible for the verdict;
- `navigationType = 'navigate'`;
- include both `posthog_js` and `pagehide_beacon` after H0 gives them identical full-SHA and `$screen_width` context;
- require finite immutable `navigation_started_at_ms = floor(performance.timeOrigin)`, plus two distinct initial-document properties captured once before any metric callback or soft navigation: `initial_storefront_presentation_mode = legacy | request_owned | permanent | degraded` and `initial_control_render_mode = legacy | degraded | permanent`, together with `initial_critical_shell_contract_version`, renderer epoch/digest, host, and path. H0/H0R are `legacy/legacy/0`; eligible H1 is `request_owned/degraded/0`; eligible H2 is `permanent/permanent/1`; an H2 neutral control marker is `degraded/degraded/1` and is campaign-ineligible. Presentation describes visible ownership; control render mode is the database/control-plane state. Neither may be inferred from the other;
- capture initial home content generation and `initial_home_lcp_fingerprint` from the required server-emitted marker in every phase. H0/H0R are not markerless: they carry the canonical server-computed legacy Hero fingerprint. H1/H2 additionally carry the committed `home_critical_fingerprint`, but performance cohorts are keyed by the early LCP fingerprint because it identifies the actual Hero/metadata/resource output. The separately fingerprinted semantic/link view is nevertheless a deliberate bounded pre-render admission dependency. After H1 enablement or H2 promotion and before its sole campaign, each exact visible snapshot must own one immutable prewarmed-origin admission receipt containing requested identifier, exact OgaBassey merchant id, safety/content/shared-shell generations, safety-proof revision, required+committed renderer tuple, shell/presentation/control-render modes, the complete `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, and `homeDocumentFingerprint` tuple, canonical semantic/link byte hashes/sizes, document-adapter/fixture digest, 30 early-view and paired-view raw object hashes, parse+digest CPU distribution, early-only versus paired-view wall-clock delta distribution, and p95. Pre-canaries and the campaign claim bind its SHA-256 and require every tuple/fingerprint/hash field to equal the visible home/semantic/shared markers; content drift invalidates the receipt rather than reusing release-level evidence. Controlled rows do not invent per-navigation admission timing on Cloudflare HITs. PostHog rows do not transport a self-referential receipt field: the field-decision query joins the immutable receipt by the exact SHA/renderer/generation/complete-document tuple and requires an explicit expected receipt SHA. An over-budget, missing, or mismatched receipt makes the release ineligible. Retain final LCP resource URL on every LCP update. A missing/malformed marker makes the row ineligible; no client-computed, point-polled, or post-callback fallback digest is permitted. Decision cohorts require exact predeclared LCP fingerprints/resources plus pre/post-canary proof of the complete committed document tuple. Every remotely mutable LCP object must be content-addressed/versioned or have a provider-enforced version plus complete write/delete audit; overwriteable in-place objects make field evidence insufficient;
- filter the cohort interval on `navigation_started_at_ms`, never the later event/update timestamp; a bfcache restore or delayed pagehide update retains its original navigation time and initial-document contract;
- first collapse updates by `(git_commit_sha, metric, id, navigation_started_at_ms)` with `argMax` over the complete value and attribution tuple at the latest event timestamp **not later than the frozen collection cutoff**; exclude and separately report missing-id, missing-SHA, missing/invalid navigation time, or wrong initial-contract rows.

An exact SHA is necessary but not sufficient to define the cohort because H2 is deployed before its renderer sweep/promotion. Record immutable UTC activation windows and expected initial-document contracts in the rollout ledger. H0 starts only after its exact deployment/browser+Googlebot coherence canaries; H1 starts only after control enablement and its exact enabled shell-0 canaries; H2 starts only after the exact renderer release is activated, reconciliation completes, database `render_mode=permanent` is promoted, and compatible browser+Googlebot canaries pass. End a phase immediately before the next release/control activation, suppress, rollback, or replacement becomes externally visible. The H2 degraded/no-Hero pre-promotion window is excluded even though it shares the SHA: its navigation start precedes `H2_FIELD_ACTIVATED_AT` and/or its initial pair is `presentation=degraded/control=degraded` at shell `1`, so neither a delayed beacon nor bfcache restore can cross the boundary. Every decision query requires explicit `--phase`, `--from`, exclusive `--to`, `--collected-through`, and expected presentation/control-render/shell/renderer values; no rolling `--hours 48` query can enter a verdict.

Close late updates deterministically. Each decision segment has `COLLECTED_THROUGH = TO + 6 hours`; run it exactly once after that instant, canonicalize the eligible/excluded raw rows plus latest-event dedupe result, store the read-only extract artifact and SHA-256 in the rollout ledger, and calculate every repeated verdict from that frozen extract—not a later live PostHog read. The event timestamp selects the latest update available in that extract at or before the cutoff, never cohort admission. An event ingested after the extract was frozen is excluded permanently even if it carries an older client timestamp. Baseline and candidate use the same six-hour grace. A day-7 extension queries only the new navigation-start segment `[prior TO, new TO)` after its own `new TO + 6 h`, freezes a second artifact, and unions it with the immutable first segment; it never re-queries or rewrites the earlier segment. A retired baseline's initial extract must be frozen before H2 deployment if it is to be selected; otherwise predeclare another sufficiently sampled baseline. Tests pin the inclusive-start/exclusive-end boundary so one navigation can enter exactly one segment. This makes repeated reads reproducible without depending on an unverified server-ingestion timestamp.

Only an absolute controlled-lab pass (`<=3500 ms` median plus stability upper and every guardrail) may enter the category-unlock field gate. Before candidate results, freeze baseline SHA, comparison hash, and deployment-contained maximum UTC interval. Baseline contract must equal final candidate; otherwise field evidence is permanently insufficient. Prefer exact H1 for H2 when its frozen interval qualifies; use H0 only when predeclared, sampled, and contract-equal, labeling H0→H2 as total-program rather than H2-only causality. If no retired baseline qualifies before candidate results, record insufficiency; day 7 cannot create retired events or repair content mismatch. Controlled H1→H2 remains the causal visible comparison.

At 48 hours, close equal-duration navigation prefixes beginning at each frozen activation start, wait the fixed six-hour late-update grace, then compare them. Require at least `n = 50` eligible deduplicated observations **per metric in both cohorts**, identical filters/contracts, and equal navigation duration before a verdict. The baseline maximum interval may be extended with the final interval to day 7 only while equal-duration time exists inside both recorded deployment windows and each new end receives the same grace. Otherwise record **insufficient evidence**, not pass/fail. If H2 is safely retained above `3500 ms`, record `DIAGNOSTIC_HOME_SHA=H2_SHA`, `DIAGNOSTIC_BASELINE_SHA`, and both frozen intervals instead; the same read-only query may guide residual diagnosis, but it is never a category-unlock verdict regardless of its percentage improvement.

Do not unlock category from raw p75 point estimates. The pure two-extract comparator—not either single-cohort query—performs the deterministic `10,000`-replicate, one-hour-cluster bootstrap using the frozen seed contract below. Define the cluster index separately for each equal-duration cohort as `floor((navigation_started_at_ms - FROM_ms) / 3_600_000)`; retain the final partial hour and every empty bucket through `TO`, so UTC-calendar alignment cannot change the resample. The gate consumes exactly six one-sided bounds: LCP candidate absolute upper and relative-improvement lower; INP candidate absolute upper and candidate-minus-baseline upper; and CLS candidate absolute upper and candidate-minus-baseline upper. Report raw p50/p75 and control familywise error at `95%` with a Bonferroni-adjusted `1 - 0.05/6` one-sided bound for **each of those six**, without rounding in code or output. Subpart/LoAF bounds are diagnostic and do not add hidden decision opportunities. If an hour has no eligible row it remains an empty time bucket rather than disappearing; if any required bootstrap cannot produce a finite bound, evidence is insufficient.

Every field decision also requires at least `12` nonempty hourly clusters in each baseline and candidate cohort in addition to `n>=50` eligible deduplicated rows per metric. Empty hours remain in the resampling index but do not count toward this coverage minimum.

- LCP passes when either the candidate p75 one-sided upper bound is `<=2500 ms`, or the one-sided lower bound on relative p75 improvement is `>=30%` against the exact cohort named by `FIELD_BASELINE_SHA`; report p50/p75 and bounds for every LCP subpart. When H1 is final, H0 is eligible only under the frozen contract-equality and sampling rule. When H2 is final, the exact H1 parent is preferred only if its frozen interval met the sampling rule; otherwise H0 is eligible only if it was predeclared, sufficiently sampled, and contract-equal to H1/H2. Never relabel an H0 → H2 field comparison as H1 → H2 causality.
- Freeze `FIELD_INP_NONINFERIORITY_MARGIN_MS = 20` before candidate collection. This is 10% of the `200 ms` Good-INP boundary and may change only through a new reviewed comparison contract before the candidate interval begins. INP passes only when the candidate p75 one-sided upper bound is `<=200 ms` **and** the one-sided upper bound for candidate-minus-baseline p75 is `<=20 ms`. A bound above either threshold is **not proven / insufficient evidence** and keeps category blocked; do not label it a regression unless a separately predeclared lower-bound test proves regression. Do not require superiority (`<=0 ms`). Tests cover exact boundaries `20`, `20.001`, `200`, and `200.001`.
- Report the already-emitted INP LoAF script/style/layout/longest-script attribution for every eligible poor-INP row (`value >200 ms`) and aggregate it only after the same dedupe/filter; LoAF is diagnostic attribution, not a fourth cardinality gate.
- CLS passes only when the candidate p75 one-sided upper bound is `<=0.10` and the one-sided upper bound for candidate-minus-baseline p75 is `<=0.01`.
- All three metric rules must pass. Any bound crossing a threshold is insufficient evidence and keeps category blocked; it is never rounded into a favorable verdict.
- CrUX/Search Console remains a delayed 28-day confirmation only.

The authoritative controlled exact-release gate decides whether H1/H2 remains deployed; field data does not retroactively force rollback of a coherent controlled pass. Only an absolute controlled pass may enter field confirmation. A passing 48-hour-plus-grace verdict unlocks category implementation; failure pauses category and opens residual diagnosis before any performance-only rollback. Safety/SEO regressions still roll back normally. If `n<50`, fewer than 12 nonempty hourly clusters, or statistical bounds are insufficient at 48 hours, repeat the same frozen equal-duration read at day 7 only when the retired baseline contains matching time. Otherwise category remains blocked unless the owner explicitly accepts the documented field gap. That exception cannot waive controlled median plus stability upper `<=3500 ms`. Retained-above-target releases remain diagnostic and keep category planning/implementation blocked.

## PR Sequence

1. **P0 — Post-#3077 and production-history recovery.** Preserve applied history, bind the now-resolved `20260713160000` mapping and merged #3098/#3099 application evidence, prove chronological and constrained production-effect convergence against a fresh production snapshot, regenerate types, close bare-client/modularity/typecheck gaps, and pass its exact-head gate. It absorbs immutable current-base payment/order-notification migrations but does not reimplement either feature lane. No CWV/cache behavior changes.
2. **H0-RUNNER — Persistent controlled-measurement authority.** Provision or formally adopt exactly one isolated self-hosted runner, register the dedicated label, freeze its complete machine/browser/network attestation, and prove fail-closed availability before workflow code may consume it. This is an operations/infrastructure phase, not a metric campaign.
3. **H0 — Measurement and proof tooling.** Bind the workflow to the H0-RUNNER label/attestation; no visible rendering change; merge and deploy its exact SHA.
4. **H0-MEASURE — before H1 architecture.** Run the one resumable phase+SHA measurement campaign, record `H0_TARGET_MANIFEST_SHA256` plus `H0_COMPARISON_CONTRACT_SHA256`, and stop/reroute if Gate 0 fails.
5. **H0.5 — ADR decision and merged-#3077/#3060 substrate reconciliation.** Documentation/architecture only; select strict hybrid only after a hard stale-fill/cache-admission fence is proved, or stop for the smaller TTL-only/replacement plan.
6. **H0.75 — Disposable actual-route build spike.** On an unmerged/undeployed spike branch, prove the two generated OgaBassey home artifacts can place a static child marker before request-scoped layout work **without parallel slots**. Failure stops H1.
7. **H1A — Disabled data/control substrate.** Core tables/RLS, immutable snapshot/fingerprint, generation/reconciliation, #3077 destination/obligation extension, worker-release/protocol/routing substrate, and local SQL proofs; OgaBassey remains disabled.
8. **H1B — Reader-first routing compatibility.** Deploy v2-capable readers and prove an unsignaled merchant retains v1/local behavior under load and Edge outage.
9. **H1C1 — Durable worker and operations.** Extend the existing #3077 services with cache destination, provider budgets, canaries, recovery, heartbeat, and inert typed actuator client; no second service, queue, route, or schedule.
10. **H1C2 — Protected web cache and shell-0 render boundary.** After explicit proxy approval, land the actuator/auth boundary, reviewed proxy scopes, response tags, protocol rotation, exact-identifier routing marker, and the visible shell-0 cutover in which page metadata, request-owned Hero, resource hints, immutable shared chrome, deferred semantic graph/crawlable anchors, and their measurement/shared/semantic markers all consume one committed complete-document tuple. Initial HTML/RSC contains zero visible feed rows and only fixed no-store client placeholders outside that tuple. It is non-activating, not a measurement-only change: every control remains final-disabled+null until `H0R-H1-MEASURE`.
11. **H1D1 — Additive publication cutover.** Land evaluator/context/RPC/receipt path plus temporary old-fleet direct compatibility while all controls remain final-disabled+null.
12. **H1D2 — Publication ACL closure and activation readiness.** Prove old fleet drained, close every context-free writer including service role, apply grant completeness, and leave all controls final-disabled+null.
13. **H0R-H1-MEASURE — sole H1 activation owner.** Complete one H0R campaign with H1 disabled, activate that same SHA through the replayable bootstrap, then complete one H1 campaign. Each campaign contains its own PSI/controlled namespaces. If controlled H1 reaches `<=3500 ms`, stop H2.
14. **H2 — only from measured exact H1 parent.** One coherent critical render state, mandatory layout split, initial-HTML Hero, and whole-route proof.
15. **H2-ROLLOUT — activation, promotion, measurement, and decision.** This phase owns exact-SHA worker installation, renderer activation, durable sweep, explicit promotion and cache-canary completion, then the one H2 campaign including its controlled namespace and the pass/retain/rollback decision against H1. No unowned activation step exists between H2 merge and this gate.
16. **FIELD — only an absolute controlled-lab pass can unlock category.** Run matched 48-hour/day-7 exact-SHA query.

Conditional category/image/cache/carousel follow-up is not a phase in this contract. Create it only after the selected terminal outcome supplies evidence and a separately reviewed plan.

Each real PR merges and deploys independently. H0.75 is the single exception: it is a disposable, local-build-only/draft spike and must never deploy or merge. H1 records its exact spike commit, patch digest, Next version, generated params, prerender artifacts, and assertion output. H2 replays the proven structure and must fail its drift test if it diverges. H2 starts from merged H1 and never depends at runtime on the unmerged spike branch.

## Current Open-PR Decisions

Live state refreshed from GitHub, Git, deployment logs, and the linked Supabase ledger on 2026-07-15 immediately before P0 implementation. The worktree is exactly current with `origin/main` (`HEAD=origin/main=9e3d1b14b1931a5e441fc23f0e5417c188056e47`) after a normal fast-forward. Preserve both user-owned notifier modifications, `apps/web/supabase/.temp/cli-latest` and `supabase/.temp/cli-latest`, plus this untracked contract; never reset, clean, stage, or overwrite them. Current main includes the previously frozen architecture prerequisites plus merged #3117, #3121, #3120, and the exact migration-name-alias repair #3122. Run `29417244012` completed successfully for exact main: database job `87358367070` applied only `20260714220000_quiz_event_lifecycle_followup.sql`, reported `1 applied, 423 skipped`, and produced the bound semantic-v1 digest `8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e`. The linked ledger contains `439` remote rows and ends at `20260714225500`; the current tree has `424` migration files and `422` unique versions. `20260714225501_reconcile_order_fulfillment_timestamps.sql` is the first free successor, is absent from current main and every open PR, and has the frozen body SHA-256 `1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361`. The run's production-deploy job `87358421368` was truthfully `skipped` because change detection compared only #3122's tooling diff; #3120's earlier run had failed before deploy. The latest proven application release therefore remains `769c1645348d20f719e424423c9d3bedbc5985d0`, run `29380448299`, deploy job `87245007215`. Local P0 recovery may proceed because the intervening frozen P0 changes are CI configuration and a SQL regression test, not a P0 runtime path. Exact-current-main application deployment remains a hard gate before activation, H0 measurement, or any production-coherence/final-handoff claim. Refresh the base, ledger, deployment state, and open migration lanes before every append-only allocation because this paragraph is evidence-at-freeze, not a future shortcut.

- **#3061 — snapshot read cutover:** merged as `62e81f07e2` and already in this worktree's ancestry. Treat its public snapshot patterns and SQL tests as the current baseline.
- **#3060 — workaround-retirement/B0 invalidation docs:** merged documentation-only as base `4ee1ab4361e7f6e0d0b1a825978a21ee1c349ea0`, now an ancestor of current main. Run `29371937075` completed green with `0` migrations applied and its production-deploy job skipped. Its discovery artifacts describe a competing generation-aware outbox/HTTP-drainer direction but add no runtime migration. H0.5 may adopt useful generation/lease semantics while keeping the standalone table/worker/operator substrate superseded under #3077. Never ship its ledger beside #3077's delivery lifecycle.
- **#3077 — durable CDC/PGMQ delivery pipeline:** merged as `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8` from head `59ca6b23c0339370416de8d14af00e5be30c15a7`; all 26 PR migration versions are now present in the linked remote ledger. Never rename, retimestamp, or edit them. Its database deployment job in run `29318477334` succeeded, but the unresolved recovery debt is real: generated Supabase types do not yet expose the new RPCs, runtime bare `SupabaseClient` uses remain, `apps/web/src/app/api/events/route.test.ts` remains `811` lines, and normal typecheck excludes tools/worker entrypoints. Mandatory P0 closes those gaps and proves clean chronological replay converges with the evidence-constrained production-effect replay and fresh production snapshot before H0. H1 then extends these same router/delivery services with explicit existing/cache destination lanes and one `storefront_cache_transition` destination plus specialized frozen obligation. Silence is not permission to ship a second pipeline.
- **#3108 — remote cache demotions:** merged as `e472dabba8b40951c6007e546aae30cc385fd44c` and is now in this worktree through exact current main. Its cache payload caps/fail-loud fills/pagination changes are part of the H1 baseline. Re-run snapshot timing, failure, and invalidation tests from that merged state; do not recreate or revert its policy inside this plan.
- **#3116 — application-owned resilient remote cache handler:** merged as `69cc74628f3fb8dfd5f92c41fd3e99488ce62429` and is part of the exact P0/H1 baseline. It registers `cacheHandlers.remote` in `apps/web/next.config.ts`, adds the application-owned read/write/tag/failure runtime, and changes `turbo.json`; the H1 control-plane sequence modifies both config files and the H1/H2 snapshot depends explicitly on `use cache: remote`. H1 must preserve its handler registration and build-environment contract while adding output tracing, then rerun its null-sentinel/failure/circuit-breaker/tag-invalidation tests plus this plan's snapshot, build-tracing, and origin-load gates. Its merged oversized `next.config.ts` is explicit H1 touched-tree debt, not a waiver and not P0 scope.
- **#3119 — OgaBassey social-identity consistency:** merged as ancestor `14e1b51d39248ace3c52cec3cf301554f1b86442`. It changes home/PDP/blog structured metadata and shared OgaBassey social identity without adding a migration. P0 preserves it byte-for-byte; H0 and later cohorts treat its output as the SEO baseline and may not regress or silently replace it.
- **Current unrelated open lanes:** observed heads may move without invalidating P0, so the binding is each migration path/body/collision set rather than unrelated PR bytes. #3117, #3121, and #3120 are merged production history, not open lanes. At this refresh #3024 is open at `f160108c09ebd2d2367b3ae612a7aa9349febd97` with exactly seventeen bound top-level migration paths; all seventeen versions are collision-free against exact main and every other open lane. #2958 remains open at `3666b70b6ec7ead109910cdf5816392eca0d0b9e` with no top-level migration, while #2928 and #2686 also have none. None owns or collides with P0's frozen `20260714225501`. Regenerate only if main changes, one of these lanes merges, or a bound migration path/body/collision set changes; unrelated open-head movement is observational. No derived plan may copy their feature scope into the CWV lane.
- **#2928 — old carousel tests:** open at `269be3a0ad3c35b21f2317588367a7ea93f09901`, `BEHIND/MERGEABLE`, with no aggregate review decision. This plan does not replace the carousel, so do not close it as “superseded.” Refresh/merge or close separately on its present testing value.
- **#2686 — CWV measurement runner:** open at `67585ec88f22a18c518fd5d349a097e2ed1f60ff`, `BEHIND/MERGEABLE`, with no aggregate review decision. Its current branch is not silently assumed to be the runner implementation and is not a code dependency as-is. `H0-RUNNER` is nevertheless a hard infrastructure dependency: its derived plan must inspect #2686's then-current exact head and either refresh/adopt it through a separately reviewed exact-head path or record why the provisioned dedicated runner supersedes it. H0 may not fall back to `ubuntu-24.04` or any hosted runner.
- **#2958 — category filter:** open at `3666b70b6ec7ead109910cdf5816392eca0d0b9e`; GitHub reported it behind at this freeze, with no aggregate review decision. It is outside home scope and must not be mixed into H0–H2.
- **#3109 — BNPL popup-marker race:** merged as `f2f153b984093c1d56143f0942e68dc89139781b` and now in `origin/main`. It is unrelated to this architecture and needs no separate gate after the mandatory main merge.
- **#3024 — BYOK/PayPal lane:** open, `BEHIND/MERGEABLE`, with changes requested at exact head `f160108c09ebd2d2367b3ae612a7aa9349febd97`. Its paginated 180-file inventory contains exactly seventeen top-level migrations. The previously colliding versions have been reallocated, so all seventeen are collision-free against exact main at this freeze; the derived P0 plan binds every path/body SHA-256 and the canonical seventeen-row lane digest. P0 records this inventory only. The separately reviewed lane remains a hard pre-H1 migration-allocation and H1D publish-route gate; never resolve it by dropping either route's auth/KYC/payment behavior or the receipt contract.
- **#3098 — paid-order wedge work and migration-history collision:** merged from head `c7e7bcf66f77720c2b6671a553fdaa7cf4d4e676` as `19d03df8544270eaac9ee072f30f2294cd2024b6`. Deployment run `29365841123` completed green; database job `87197071269` applied `20260714090000_add_merchant_settlement_failed_review_type.sql`, `20260714093000_scope_capture_review_deduplication.sql`, `20260714100000_add_gateway_payment_wedge_review_type.sql`, and `20260714123000_complete_order_gateway_payment_atomic.sql` in that order, and deploy job `87197219600` succeeded. P0 absorbs those immutable base files and proves their replay/effects; it does not recreate payment behavior. Historical `20260713160000_complete_order_gateway_payment_atomic.sql` at commit `f4be1dbff7e2011b5ad8869928d31e0e35d95951`/blob `640df208b476993be5dc7461ad26db2dfc34d2e4` is explicitly rejected as production history because #3114's deployment log proves the restore body owned that version. #3024 has since reallocated its former `20260714090000` collision; P0 binds the current collision-free open-lane inventory without importing it.
- **#3099 — repeat fulfillment notification cycles:** merged from head `c92b9bcf88052fd80b97843d45b7a0b868f9c7b7` as `1ba7562b640b418e47fd38a4a2449cfec82ea960`. It adds `20260713123000_preserve_repeat_order_notification_cycles.sql` and `20260713123100_scope_manual_order_notifications_to_cycle.sql`. Deployment run `29367954362` completed green; database job `87207417765` applied those files in that order and deploy job `87207485170` succeeded. P0 absorbs those immutable base files and evidence; it does not change order-notification behavior.
- **#3107 — wallet-credit push delivery:** merged as `6758e4db3f28d3f2f7acc98e2802234f38631284`. Deployment run `29370675467` completed green; database job `87215018094` applied only `20260714161000_claim_wallet_credit_push.sql` and deploy job `87215100556` succeeded. P0 absorbs that immutable migration and does not change wallet notification behavior. Later merged #3117/#3121/#3120 history advances the current tail and fixes the P0 repair successor at `20260714225501` for this exact base only.
- **#3112 — authenticated merchant server-boundary S1 lane:** merged as `37fe2ebae1275ffabb3e146a7bad2c5374e17c1b` and now in `origin/main`. Treat that server-boundary shape as the H1 baseline after the mandatory main merge. Its still-separate ACL follow-up remains a merge-order concern only if it exists at the time H1D is derived; preserve narrow RPC grants and rerun the anon/authenticated/service-role matrix rather than depending on an already-merged PR number.
- **#3114 — restore anon merchant public columns:** merged as `8a0cabe7791e1701371c32a4ac911c32fb40322a` and now at `origin/main`. It is no longer an open code dependency; it is the required H1 ancestry/replay baseline. Merge it normally, prove the commit is an ancestor, and pass P0's checked replay runner before allocating H1 migrations; raw `supabase db reset` is known-invalid historical evidence and is not the gate. Primary deployment logs for run `29284101263`/job `86932264596`, the linked-ledger name, and direct grant assertions prove that production received the restore body at `20260713160000`; the historical #3098 payment blob at that version is rejected history. P0 must preserve that mapping and prove chronological and constrained production-effect hashes converge with the fresh production snapshot.

H0 has no unconditional open-PR code dependency, but it has the hard `H0-RUNNER` infrastructure/attestation dependency and inherits P0's completed #3077/production-history/#3098/#3099 recovery exact head. H1 is additionally gated by Gate 0, the Gate 0.5 ADR/#3060 one-pipeline decision, the separate #3024 history/route reconciliation, preservation of merged #3116/#3119/#3112 baselines, merged-#3114 replay proof, and explicit proxy approval. Neither #3060 nor merged #3077 permits a second ledger or worker.

---

## Normative Contract H0-RUNNER: Persistent Controlled-Measurement Authority

`H0-RUNNER` is a hard prerequisite, not an implied property of GitHub-hosted CI and not a measurement campaign. Its derived plan owns the external infrastructure operations needed to provision or formally adopt exactly one repository-authorized self-hosted runner and must leave a reproducible, secret-free evidence receipt before H0 workflow code is reviewed. It may inspect #2686, but it cannot inherit that stale branch by name or treat a green hosted job as equivalence.

- [ ] Record the owner-approved host, administrative owner, recovery contact, runner group/repository restriction, dedicated OS account, service definition, working directory, and exact labels. The required workflow selector is exactly `runs-on: [self-hosted, baci-cwv-measurement]`; the dedicated label may resolve to only one online runner, and that runner may accept only one job at a time. Repository queries must prove no second online runner carries the label. H0 removes `ubuntu-24.04` from every rollout control/slot/finalization job and has no hosted fallback expression, matrix, or alternate label.
- [ ] Isolate the host from builds, deployments, cron, backups, browser automation, DebugBear, and unrelated user workloads during every campaign. Freeze the host identity only: CPU topology/model, governor/power mode, memory, kernel/OS image, filesystem, network interface, egress IP/provider, DNS resolver policy, locale, timezone, Chrome binary/version/SHA-256, Node/pnpm, and GitHub runner binary. The derived plan defines exact commands and expected outputs for each field, plus idle CPU/memory/network acceptance thresholds checked immediately before every slot. H0—not H0-RUNNER—pins the repository Lighthouse package/config/integrity and incorporates it into `controlled-profile.json`; the infrastructure phase must not claim a hash for code that does not yet exist.
- [ ] Register with a short-lived owner-issued token, remove the token and shell history residue after service installation, restrict the runner group to this repository/workflow, and prove the service starts after reboot without exposing repository or measurement credentials. Never place a registration token, PSI key, PostHog key, cookie, or raw environment dump in the receipt. H0 owns the later namespace-locked progress helper and job-scoped writer token; H0-RUNNER owns the external ruleset that makes matching refs create-only and proves the runner boundary can receive required secrets without exposing them.
- [ ] Provision an owner-approved read-only `BACI_CWV_RUNNER_AUDITOR` GitHub App installed only on this repository with exactly repository `Administration: read` and `Metadata: read`; it has no Contents, Actions-write, Issues, Pull requests, or organization-write permission. Store its client id as a repository variable and private key as a masked repository secret, record only app slug/installation id/permission digest in the receipt, and pin the official installation-token action by full commit SHA in the derived H0 plan. H0 mints this at campaign preflight only to list repository self-hosted runners and read the repository artifact-retention setting, then lets the action revoke it; the token never reaches a measurement subprocess or artifact/progress writer.
- [ ] Create one active repository ruleset named `ogabassey-rollout-progress-immutable` with the exact provider shape `target:"tag"`, `enforcement:"active"`, `bypass_actors:[]`, `conditions.ref_name.include:["refs/tags/ogabassey-rollout-claim/*","refs/tags/ogabassey-rollout-progress/**/*","refs/tags/ogabassey-semantic-admission/*"]`, `conditions.ref_name.exclude:[]`, and `rules:[{"type":"update"},{"type":"deletion"}]`; deliberately configure **no** creation rule. This permits fresh refs but makes every matching claim/start/terminal/admission-receipt ref immutable, including for administrators. Normalize the provider readback to those exact semantic fields, then record ruleset id, canonical JSON, and SHA-256 in the runner receipt. Create one permanent probe in each namespace, prove a second create of the same ref fails, prove update and delete fail, and prove the corresponding helper rejects every ref outside its named namespace. Never add a bypass or weaken the ruleset to let cleanup delete a probe/campaign/receipt record; an unexpected pre-created ref is a safe collision/stop, not an overwrite.
- [ ] Record and prove an Actions-artifact retention policy of at least `30` days and self-hosted egress to every GitHub artifact endpoint required by the supported client. The auditor App may read the policy but cannot upload or delete artifacts. H0's job-scoped built-in token has only `actions:read` plus the narrowly justified `contents:write` needed to create new protected progress refs; no workflow credential receives `actions:write`. The active ruleset and a namespace-locked helper—not a falsely named GitHub permission—enforce create-only progress behavior.
- [ ] Produce canonical `h0-runner-attestation.json` and `H0_RUNNER_ATTESTATION_SHA256`. The canonical identity object binds a stable runner id/generation, all frozen machine/browser/network fields above, runner group/labels, service unit digest, attestation-script digest, isolation/load policy, and the exact repository id. Sign or owner-approve the digest in the rollout ledger, retain the raw command evidence read-only, and verify a fresh readback reproduces the same digest before H0 begins. Receipt `capturedAt` values, online status, and transient load samples are attempt evidence outside the hashed identity object, so a healthy reread can reproduce the identity digest without erasing time/load provenance.
- [ ] Prove online/offline detection, wrong/reused label rejection, two-runner ambiguity rejection, hosted-runner rejection, runner/service restart, reboot persistence, Chrome/Node/runner-binary checksum drift, egress/DNS/locale/timezone drift, load-threshold refusal, concurrent-job refusal, missing/over-scoped auditor App, disabled/drifted/bypassed tag ruleset, insufficient artifact retention, and blocked artifact egress. These are infrastructure tests only: they make no storefront request and create no H0/H0R/H1/H2 campaign claim or metric slot beyond the permanent ruleset probe. H0 separately tests Lighthouse package/config/integrity and supported artifact-client drift as part of the controlled profile.
- [ ] H0 consumes the frozen runner id/generation and attestation digest as immutable workflow configuration, verifies the live attestation before the first canary, and persists it in every attempt ledger. A missing/offline/ambiguous runner blocks H0 and terminates as `STOPPED_REROUTED`; it never authorizes a hosted fallback. A later replacement host is a new runner generation: no observation from it may complete an existing campaign or pair with an earlier attestation. Continuing on a replacement requires a separately reviewed runner plan plus a fresh unconsumed exact control SHA/campaign sequence; H0R→H1 and H1→H2 may never mix generations.

---

## Normative Contract H0: Attribution And Repeated Measurement

**Modify**

- `.github/workflows/seo-monitoring.yml`
- `apps/web/package.json` and `pnpm-lock.yaml`, only for exact `lighthouse@13.4.0`, exact `@actions/artifact@6.2.1` (including the lockfile integrity `sha512-sJGH0mhEbEjBCw7o6SaLhUU66u27aFW8HTfkIb5Tk2/Wy0caUDc+oYQEgnuFN7a0HCpAbQyK0U6U7XUJDgDWrw==`), and their controlled-lab commands; preserve P0's already-enforced `typecheck:tools-workers` wiring
- `apps/web/tsconfig.tools-workers.json`, extending P0's project to cover the H0 tools while preserving both worker entrypoints, their tests, and transitive imports
- `apps/web/tools/seo/run-pagespeed.cli.ts`
- `apps/web/tools/seo/run-pagespeed.ts`
- `apps/web/tools/seo/run-pagespeed.config.ts`
- `apps/web/tools/seo/run-pagespeed.shared.ts`
- `apps/web/tools/seo/run-pagespeed.types.ts`
- their existing colocated tests
- `apps/web/src/components/analytics/web-vitals-reporter.tsx` and colocated test
- `apps/web/src/lib/posthog/web-vitals-pagehide-flush.ts` and both existing colocated tests
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-static-home-page-content.tsx` and colocated test

**Create**

- `.github/workflows/ogabassey-rollout-control.yml`, the bounded reusable preflight/pre-canary coordinator
- `.github/workflows/ogabassey-rollout-controlled-stage.yml`, the bounded reusable explicit serial controlled-slot `01..21` plus post-canary coordinator
- `.github/workflows/ogabassey-rollout-psi-stage.yml`, the bounded reusable explicit serial PSI-slot `01..21` coordinator
- `.github/workflows/ogabassey-rollout-slot.yml`, the one-slot primitive called by the two stage coordinators
- `apps/web/tools/perf/query-ogabassey-home-web-vitals.ts`
- `apps/web/tools/perf/query-ogabassey-home-web-vitals.test.ts`
- `apps/web/tools/perf/compare-ogabassey-home-web-vitals.ts`
- `apps/web/tools/perf/compare-ogabassey-home-web-vitals.test.ts`
- `apps/web/tools/perf/capture-ogabassey-home-lcp-trace.ts`
- `apps/web/tools/perf/capture-ogabassey-home-lcp-trace.test.ts`
- `apps/web/tools/perf/run-ogabassey-controlled-lab.ts`
- `apps/web/tools/perf/run-ogabassey-controlled-lab.test.ts`
- `apps/web/tools/perf/measure-storefront-origin-fill.ts`
- `apps/web/tools/perf/measure-storefront-origin-fill.test.ts`
- `apps/web/tools/seo/run-pagespeed.provenance.ts`
- `apps/web/tools/seo/run-pagespeed.provenance.test.ts`
- `apps/web/tools/seo/run-pagespeed.comparison-contract.ts`
- `apps/web/tools/seo/run-pagespeed.comparison-contract.test.ts`
- `apps/web/tools/seo/run-pagespeed.artifact-store.ts`
- `apps/web/tools/seo/run-pagespeed.artifact-store.test.ts`
- `apps/web/tools/seo/run-pagespeed.progress-store.ts`
- `apps/web/tools/seo/run-pagespeed.progress-store.test.ts`
- `apps/web/tools/seo/run-pagespeed.semantic-admission-store.ts`, a read-only exact-ref/tag-object loader/verifier for `refs/tags/ogabassey-semantic-admission/<sha256>`
- `apps/web/tools/seo/run-pagespeed.semantic-admission-store.test.ts`
- `apps/web/tools/seo/run-pagespeed.runner-authority.ts`
- `apps/web/tools/seo/run-pagespeed.runner-authority.test.ts`
- `.github/scripts/seo-monitoring-workflow-contract.test.mjs`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.tsx`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.test.tsx`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-context.ts`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-context.test.ts`
- `apps/web/src/components/analytics/ogabassey-home-measurement-observer.ts`
- `apps/web/src/components/analytics/ogabassey-home-measurement-observer.test.ts`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-legacy-lcp-fingerprint.ts`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-legacy-lcp-fingerprint.test.ts`
- `apps/web/src/config/ogabassey-home-legacy-renderer-contract.ts`
- `apps/web/src/config/ogabassey-home-legacy-renderer-contract.test.ts`

**Interfaces**

```ts
interface VerifyRolloutProvenanceInput {
  expectedSha: string;
  expectedDeployRunId: string;
  expectedDeployRunAttempt: number;
  expectedDeploymentMarker: string;
  githubSha: string;
  deployRun: unknown;
}

interface VerifiedRolloutProvenance {
  deployRunId: string;
  deployRunAttempt: number;
  deployRunUrl: string;
  deploymentMarker: string;
  exactSha: string;
}

verifyRolloutProvenance(
  input: VerifyRolloutProvenanceInput
): VerifiedRolloutProvenance;
```

`run-pagespeed.provenance.ts` has that one primary export. It validates `deployRun` with Zod, reconstructs the marker using the production `getNextDeploymentId()` rule, and never accepts a stable-but-unbound marker. `capture-ogabassey-home-lcp-trace.ts` adds exact CLI flags `--expected-deployment-marker <marker>`, `--require-lcp-identity ogabassey-home-slide-zero`, and `--comparison-contract <path>`.

- [ ] Emit exactly one server-owned, product-byte-free `OgabasseyHomeMeasurementMarker` in raw home HTML for each explicitly marker-bearing canonical OgaBassey state in H0/H0R/H1/H2. Marker-bearing presentation states are only `legacy|request_owned|permanent|degraded`; the separately serialized control render mode is only `legacy|degraded|permanent`. Campaign eligibility additionally requires the exact OgaBassey tenant/publication binding and the phase's predeclared pair. H2's decision campaign predeclares `permanent/permanent`, so a valid `degraded/degraded` marker is safety/control evidence but still stops before prewarm or any measurement slot. This one component only serializes a typed object; `ogabassey-home-measurement-context.ts` owns the one versioned Zod schema, canonical parser, and normalized property names consumed by the marker, Web Vitals reporter, MutationObserver, controlled browser, and canaries. H0/H0R keep the static anchor immediately before the postponed Hero boundary for Gate-0 timing. H1 emits `request_owned/degraded` inside the already-required request publication/tenant guard, immediately before the Hero that consumes the exact same early committed projection; the bootstrap's early MutationObserver must observe this streamed marker before the Hero element. H2 permanent emits `permanent/permanent` in the static critical prefix. Every marker carries `data-ogabassey-measurement-context="v1"`, the exact bound `merchant_id=OGABASSEY_MERCHANT_ID`, both initial modes, shell contract version, and renderer epoch/digest. H0/H0R use the checked-in legacy renderer epoch/digest manifest, not a null or invented renderer. `legacy` carries generation `legacy`, its 64-character `initial_home_lcp_fingerprint`, and null committed composite. `request_owned|permanent` carry their typed content generation, 64-character `initial_home_lcp_fingerprint`, and 64-character committed `home_critical_fingerprint`. H2 `degraded` carries all three content fields exactly null so a private `snapshot_only` commit cannot change degraded initial HTML. `suppressed|unavailable|unbound|draining|disabled` emit no home measurement marker and are campaign-ineligible; encountering one stops before prewarm or any measurement slot rather than inventing a null variant. The marker exposes no product id, URL, name, price, image, or link.
- [ ] Define the H0/H0R LCP fingerprint as SHA-256 of canonical JSON `{version:1,status,merchantId,slides}` where slides preserve rendered order and include exactly `id,name,priceLabel,href,imageUrl,imageAlt,ctaLabel`; `unpublished` and `unavailable` remain distinct internal fingerprint states but are measurement-ineligible and emit no home marker. H1/H2 instead consume the committed `homeLcpFingerprint` from the early snapshot view and expose the separately committed composite only as release/coherence context. No measurement marker claims that the deferred H1 semantic graph has rendered.
- [ ] Prove with raw no-JavaScript responses for both generated OgaBassey identifiers that every eligible marker exists in server HTML before the postponed Hero continuation, while every ineligible state above has no home marker. Browser/Googlebot canaries parse it. A missing, duplicate, malformed, client-created, or late marker in an otherwise eligible document invalidates the phase; an intentionally absent marker classifies the document ineligible and stops the campaign.
- [ ] Add the programmatic Lighthouse `13.4.0` controlled-lab runner through one top-level rollout workflow and the four bounded reusable coordinator/slot workflows named above. The top-level workflow has the explicit serial `needs` chain `control -> controlled-stage -> psi-stage -> finalizer`; each stage file spells out its own non-matrix slot chain and stays `<=300` lines. Reusable calls remain inside the caller's one workflow run and must receive/verify the caller `github.run_id`, `github.run_attempt`, immutable campaign key, and attested runner identity; no coordinator may `workflow_dispatch` another run or create another campaign. Every control, slot, post-canary, and finalization job uses exactly `runs-on: [self-hosted, baci-cwv-measurement]`, requires the green H0-RUNNER receipt, and has no hosted fallback. The composed DAG is control/pre-canary, controlled slots `01..21`, controlled post-canary, PSI slots `01..21`, finalization; a rendered-workflow contract expands the calls and proves exact-name/needs equality, same-run propagation, no matrix, no parallel edge, and every touched workflow file below the repository ceiling. It consumes the pinned target/comparison/profile contracts, SHA, deployment marker, and controlled 21-slot namespace; captures raw LHR plus CDP logs; proves route/profile-local `cloudflare_hit_single_object`; and emits authoritative LCP/FCP/CLS/TBT rows. No job relies on a predecessor's local checkout or filesystem state: every boundary is reconstructed from immutable refs/artifacts. Controlled work runs only on the one named persistent runner whose live immutable attestation must reproduce `H0_RUNNER_ATTESTATION_SHA256` and binds runner generation, machine id, hardware/CPU model, OS image, network interface/egress, runner binary, Chrome binary/version/SHA, Lighthouse config/integrity, throttling, cache/service-worker clearing, fresh-process/context rule, load threshold, locale, timezone, and request representation inputs. All attempts and H0R→H1/H1→H2 pairs require the same attestation and Cloudflare colo class; a hosted or replacement machine cannot contribute a slot. Test every profile/attestation drift dimension, wrong/ambiguous label, wrong marker, MISS, Age reset, colo/object drift, incomplete cardinality, and PSI disagreement.
- [ ] Install the marker observer with `page.evaluateOnNewDocument` before application scripts. Capture static-anchor, selected-image request/response, and Hero insertion timestamps on one clock. Test preloaded image, late request, late-only element, CSS/render delay after readiness, missing marker, and identity mismatch; post-readiness CSS/main-thread delay must never increase `causalHeroAvailabilityGain`.

- [ ] Add failing tests for `PAGESPEED_RUNS` validation: integer `1–5`, default `1`, H0/H0R/H1/H2 rollout value `3`. Add `PAGESPEED_HOME_MOBILE_EXTRA_RUNS`: integer `0–3`, default `0` for scheduled/all-site mode, allowed only in `ogabassey-rollout`, and required value `3` for **all four** rollout states. Add required rollout-only `PAGESPEED_MEASUREMENT_PHASE=H0|H0R|H1|H2` and reject phase/run-count mismatches. H0R requires every critical control/flag disabled and the same exact deployed SHA later used by H1; H1 rejects any intervening deploy.
- [ ] Add a tested manual `ogabassey-rollout` target mode that selects only the configured OgaBassey home/category/PDP guardrails. Keep scheduled/all-site mode at one run so repetition cannot multiply every platform default URL. In rollout mode, skip the unrelated `search-console-readiness` and `notify-slack` jobs; preserve both unchanged for scheduled/all-site monitoring. Add a rendered-workflow test proving a rollout run's conclusion is determined only by the PageSpeed evidence-integrity job and its always-uploaded artifacts, not by Search Console readiness or notification delivery.
- [ ] Fail before measurement unless rollout mode resolves exactly one canonical home, one category, and one PDP PSI URL on `ogabassey.com` **and** one canonical blog canary URL. The canonical manifest has exact top-level objects `pagespeedTargets:{home,category,pdp}` and `canaryDocuments:{home,category,pdp,blog}`; the three shared values must be byte-equal. Blog is provenance/canary-only and never adds a PSI observation. Never silently substitute platform defaults or duplicate aliases.
- [ ] Add `workflow_dispatch` inputs `pagespeed_runs`, `pagespeed_home_mobile_extra_runs`, `pagespeed_target_mode`, `pagespeed_measurement_phase`, `pagespeed_expected_sha`, `pagespeed_expected_deploy_run_id`, `pagespeed_expected_deploy_run_attempt`, `pagespeed_expected_deployment_marker`, `pagespeed_expected_target_manifest_sha256`, `pagespeed_expected_comparison_contract_sha256`, `pagespeed_expected_controlled_profile_sha256`, and `pagespeed_expected_semantic_admission_receipt_sha256`. The four deployment-provenance inputs may be absent for scheduled/all-site monitoring but are mandatory in `ogabassey-rollout`. Wire them to matching uppercase environment variables. H0 requires all four expected contract/receipt hashes empty and emits the canonical URL-manifest, semantic/resource comparison-contract, and controlled-profile hashes. H0R requires the exact H0 URL-manifest hash, leaves expected comparison/profile/admission-receipt empty, and emits the new control-baseline comparison/profile hashes. H1 requires exact H0R comparison/profile hashes, one 64-character lowercase admission-receipt hash for the post-enable visible snapshot, and the same exact deployment marker/SHA; H2 requires exact H1 comparison/profile hashes and one receipt hash produced after promotion for its exact visible snapshot. H0R/H1/H2 all require the original 64-character lowercase H0 URL-manifest hash. Reject missing, malformed, or phase-incompatible combinations before the first canary or external request; scheduled/all-site monitoring must leave the admission-receipt input empty.
- [ ] Give every rollout control/slot/finalization job explicit `actions: read` and `contents: write`; scheduled/all-site and unrelated workflow jobs stay at their narrower existing permissions. Use the job-scoped built-in token only through `run-pagespeed.progress-store.ts`, which may call Git Data create-tag/create-ref and read-ref APIs only for `refs/tags/ogabassey-rollout-claim/<campaignId>` or `refs/tags/ogabassey-rollout-progress/<campaignId>/...`. Before the initial claim and again before every request-bearing slot, read back the active H0-RUNNER ruleset and require its exact id/digest, update+delete restrictions, target patterns, and empty bypass list. The helper creates an annotated tag object pointing to the exact deployed commit and then creates a new ref; it exposes no update/delete/force operation and treats an unexpected existing ref as a hard collision while same-run reruns may only read and byte-verify their already-owned claim/progress refs. A static contract test rejects `git push`, `force`, delete/update endpoints, raw token export, or any ref outside the two namespaces. Verify the expected completed successful `Deploy to Vercel` run, exact head SHA, deploy attempt, reconstructed deployment marker, named persistent measurement-runner attestation, and—for H1/H2—the immutable semantic-admission receipt plus exact visible snapshot bindings before any request. A phase+SHA owns exactly one dispatch, one workflow run id, one permanent campaign claim tag, and one immutable input set. GitHub `run_attempt=1..3` are bounded reruns of that **same run id**, not new dispatches or new campaigns. Reject a second workflow run, changed ref/SHA/input/visible state/receipt, overlapping SEO/browser lane, attempt four, runner-attestation drift, ruleset drift, or a rerun after semantic drift. Persist deploy provenance, campaign id, one run id, current run attempt, phase, manifest/comparison/profile hashes, expected semantic-admission receipt hash and bound snapshot tuple when applicable, exact runner identity, ruleset id/digest, the server marker's `initial_home_lcp_fingerprint`, the nullable committed composite, and LCP-resource-set SHA-256 in every attempt ledger.
- [ ] For H1/H2 only, `run-pagespeed.semantic-admission-store.ts` reads exactly `refs/tags/ogabassey-semantic-admission/<PAGESPEED_EXPECTED_SEMANTIC_ADMISSION_RECEIPT_SHA256>`, follows its annotated tag object to the expected deployed commit, parses the bounded canonical JSON message, recomputes its SHA-256, and validates its schema, 30-sample cardinality, caps, and exact pre-canary snapshot/marker tuple. It exposes no create/update/delete method and accepts no caller-supplied alternate ref. H0/H0R never call it. Wrong object type/commit/ref name/message hash/tuple, lightweight tag, missing receipt, or ruleset drift stops before campaign claim and before any prewarm/request. The control artifact and final index retain the tag-object SHA and canonical receipt payload hash so later PostHog decisions can fetch the same immutable object.
- [ ] In the initial control job and every request-bearing slot job, mint the H0-RUNNER read-only auditor-App token through the full-SHA-pinned official action, query `GET /repos/{owner}/{repo}/actions/runners`, and require exactly one online runner carrying `self-hosted` and `baci-cwv-measurement`. Because the query executes from the selected job itself, that sole runner must be `busy:true`; `busy:false` proves the API row is not the executing authority and stops. Require API id/name/OS/status/busy/version/labels plus `RUNNER_NAME`, `RUNNER_OS`, and `RUNNER_ARCH` to bind the current job to the frozen runner id/name/generation; the local signed attestation additionally proves the runner-binary checksum and complete machine identity. The initial control job also proves repository artifact retention is at least `30` days. Remove the auditor token from the environment before every canary/request; it never reaches a measurement subprocess. Separately require nonempty `ACTIONS_RUNTIME_TOKEN` and `ACTIONS_RESULTS_URL` for `DefaultArtifactClient` without logging their values and validate that the pinned client exposes current-job upload plus immediate REST/readback/download support. Missing Administration-read authority, ambiguous inventory, an idle/mismatched selected runner, expired/missing artifact runtime authority, retention below 30 days, or blocked artifact endpoints stops before that job's request; identity is never guessed from `RUNNER_NAME` alone.
- [ ] Make phase+SHA one immutable workflow campaign. Its key is SHA-256 of canonical JSON `{phase,exactSha,deploymentMarker,targetManifestSha256,expectedComparisonContractSha256,controlledProfileSha256,semanticAdmissionReceiptSha256,slotManifestSha256}`; `semanticAdmissionReceiptSha256` is the empty string for H0/H0R and the required verified receipt digest for H1/H2. `slot-manifest.json` predeclares exactly 21 logical route/profile slots—home mobile `1..6`, and home desktop plus category/PDP mobile/desktop `1..3`—with two namespaced records per slot: `controlledSlots` for authoritative Chrome/Lighthouse evidence and `psiSlots` for external corroboration. The explicit serial DAG runs shared provenance/pre-canary/contract/receipt conditioning in its control job, one controlled slot per called reusable-workflow job, its immediate post-canary/freeze job, one bounded PSI slot per called reusable-workflow job, then finalization. Already-frozen slot jobs reconstruct and verify their immutable terminal and perform no request. PSI exhaustion, orphan, or diagnostic drift yields `external_corroboration_incomplete`; it never consumes, replaces, or vetoes a controlled slot.
- [ ] Resume only through GitHub rerun of the same run id and immutable inputs. Each run attempt verifies the permanent campaign claim, runner attestation, and all earlier create-only records. A logical slot is requestable only while unfrozen: every earlier envelope must have a typed disposition, every earlier started request must have a typed terminal failure, and no valid terminal may exist. The first valid terminal freezes that namespaced slot permanently; a terminal failure may consume the next chronological HTTP/run attempt within the declared bound. An envelope uploaded/read back without a start ref is frozen `abandoned_before_start`, can never later receive a start ref, consumes that chronological attempt ordinal but not a network request, and permits only the next bounded attempt. A start with a durable raw object but no terminal is finalized deterministically from that object without another request. A start with neither response object nor terminal is finalized as typed `orphaned_after_start` without re-request; it makes a controlled slot non-resumable insufficient evidence but only marks a PSI slot `external_corroboration_incomplete`. Preserve all later/ineligible rows; never discard, replace, or reassign an observation.
- [ ] Make request-start and raw-result durability an exact state machine. `request-envelope.json` is canonical Zod-validated JSON containing only schema version; campaign/evidence/slot/run/http-attempt keys; sanitized method and canonical URL with query secrets removed; strategy/profile/timeout; request-body and representation-header SHA-256 values; expected SHA/marker/manifest/comparison/profile/semantic-admission-receipt/runner/ruleset hashes; and retry ordinal. It contains no API key, cookie, authorization value, product payload, or raw request body. Upload it first with `DefaultArtifactClient.uploadArtifact()` as the single-file, unique artifact `ogabassey-envelope-<campaignId>-<evidenceKind>-<slotId>-a<runAttempt>-h<httpAttempt>`, `retentionDays:30`, and no overwrite path. Then use Actions REST read plus client download to verify exact current run id/attempt, name, immutable artifact id, nonexpired `expires_at`, byte length, API archive digest, and canonical payload SHA-256. Only after that readback succeeds may the helper create and read back `.../request_started`, whose canonical tag message contains the envelope id/digests and exact deployed commit. Only after the start ref exists may network I/O begin. After response/error, sanitize the complete raw LHR/CDP/PSI/error payload, upload the unique `ogabassey-raw-...` artifact with the same 30-day contract, perform the same REST+download readback, and only then create/read back the typed terminal ref with raw artifact ids/digests. The end-of-attempt artifact is only an aggregate/index, never the sole raw store.
- [ ] Recovery follows those durable boundaries mechanically. An envelope artifact with no start ref proves no request was permitted; the next run attempt creates/read-backs its immutable `abandoned_before_start` disposition and may then allocate only the next chronological attempt key with a new envelope. It never backdates a start ref or network request to the earlier `github.run_attempt`. A start ref with no raw object or terminal is finalized `orphaned_after_start` against the envelope and is never requested again. A raw artifact with no terminal is deterministically parsed and terminalized without another request. A terminal is valid only when both its tag payload and referenced artifact REST/download readback match. Tests kill the runner before envelope upload, after envelope upload, after envelope readback, after start-ref creation, immediately before request, after response, after raw upload, after raw readback, after terminal creation, and before aggregate upload; they also simulate artifact/ref collision, wrong run/attempt/name/id, expired or short retention, missing runtime variables, archive/payload digest mismatch, ruleset drift, attempted backdating, and attempted update/delete/out-of-namespace writes.
- [ ] Bound the artifact ledger before collection against the exact pinned client's **ten-artifacts-per-job** ceiling. Across all three GitHub run attempts, each controlled logical slot may allocate at most one attempt key per run attempt (`63` controlled attempt keys maximum campaign-wide), but one controlled slot-job execution creates at most one envelope, one raw object, and one slot index: at most `3` artifacts. Each PSI logical slot may allocate at most three attempt keys campaign-wide (`63` PSI attempt keys maximum); one PSI slot-job execution may create at most three envelopes, three raw objects, and one slot index: at most `7` artifacts. Each non-slot control/post-canary/finalization job creates at most one immutable control or campaign-index artifact. `abandoned_before_start` creates no raw replacement under the old key. The workflow contract fails on any path that could reach artifact 11 in one job, any aggregate emitted from a slot job beyond its single index, or any attempt to pool all raw objects into one job. Frozen valid slots and exhausted PSI slots are verified without request and never reallocated on later run attempts.
- [ ] Any SHA, marker, target, comparison contract, content/resource, controlled profile, semantic-admission receipt or bound snapshot tuple, cache policy, runner identity, or controlled pre/post-canary drift invalidates authoritative evidence and cannot be rerun. Controlled completion requires all 21 `controlledSlots`, zero controlled orphans, and one frozen valid result per slot; after attempt three, controlled incompleteness blocks H0/H0R before activation, requires the exact drain/deactivation/final-cache rollback when H1 is already active, or rolls H2 forward to the verified H1 visible state. PSI-only missing/failed/orphan slots remain `external_corroboration_incomplete`, are reported with exact cardinality, and never block enablement, promotion, retention, or rollback. Never start a replacement campaign for the same phase+SHA.
- [ ] Make all requests serial. Preserve every raw PSI report, LHR, CDP log, retry/error row, and progress record. For each namespace require six home-mobile logical observations and three for every other route/profile. Define/test the even median as the mean of sorted positions 3 and 4. Compute MAD, `madScale=1.4826×MAD`, stability upper, IQR, min, max, and relative MAD for positive-time metrics; relative MAD above `15%` makes percentage evidence insufficient, while CLS uses raw MAD `<=0.01`. The cross-phase controlled parser computes pooled MAD dispersion and dispersion-adjusted decisions exactly as frozen above. Report HTTP attempts, run attempts, started records, terminal records, valid observations, and frozen slots separately.
- [ ] Define a valid PSI observation exactly: one successful Lighthouse result for the expected canonical URL + strategy with finite numeric FCP, LCP, CLS, and TBT, plus exactly one unique expected deployment marker across the `?dpl=` asset URLs. Do **not** require response headers from Lighthouse `network-requests`; upstream Lighthouse does not emit them. Delayed field INP and optional LCP element/breakdown diagnostics may be absent. A null/error payload, wrong URL/strategy, non-finite required metric, missing required lab metric, or wrong/mixed marker is a failed external attempt. Allocate at most three chronological attempt keys campaign-wide per PSI logical slot and therefore at most two serial network retries after the first started request **only when no earlier key was abandoned before start**. Each `abandoned_before_start` key reduces the remaining possible network requests/retries one-for-one; it never earns a fourth key. Carry cumulative `httpAttempt=1..3` as that chronological key across same-run reruns, honor `Retry-After`, and preserve every failure; incomplete PSI remains diagnostic and never resets or extends the ordinal.
- [ ] A PSI rollout observation is marker-valid only when its raw Lighthouse `network-requests` audit contains exactly one unique Next deployment-marker value across all `?dpl=` asset URLs and it equals `PAGESPEED_EXPECTED_DEPLOYMENT_MARKER`. Missing, mixed, or different values are failed external attempts. Shared pre/post browser and Googlebot canaries must match that same marker.
- [ ] Put one immutable `campaignStartedAt` and `campaignDeadlineAt = campaignStartedAt + 120 minutes` in the claim; do not pretend forty-five serial jobs share one job timeout. The measured-work budgets across the DAG are `45` minutes cumulative controlled, `45` minutes cumulative PSI-external, and `15` minutes cumulative for provenance/pre/post canaries plus ledger/index finalization (`105` minutes total), leaving `15` minutes of wall-clock transition/queue reserve. Every job reconstructs prior immutable elapsed records, checks both its cumulative stage budget and the campaign-wide absolute deadline before sleeping or beginning a request, and reserves enough absolute time for the remaining mandatory post-canary/finalizer work. Controlled budget exhaustion emits insufficient evidence and stops before PSI; after controlled evidence and its immediate post-canary freeze, PSI budget exhaustion yields `external_corroboration_incomplete`. Job-level `timeout-minutes` remains a smaller fail-safe and never resets either campaign budget on rerun. Always publish the current job's attempt-qualified slot/control index under `if: always()`; the finalizer alone publishes the campaign aggregate.
- [ ] Separate collection integrity from the architecture decision. In `ogabassey-rollout`, do not fail an observation merely because it exceeds the scheduled monitor's generic `2500 ms` LCP threshold. Shared provenance/content/canary drift or incomplete authoritative controlled evidence fails integrity; PSI-only incompleteness produces a successful-but-explicit `external_corroboration_incomplete` evidence state. The workflow computes no pass/retain/rollback verdict; the rollout phase applies the frozen controlled decision table. Scheduled/all-site mode preserves its present jobs and thresholds.
- [ ] In every run attempt execute one fixed explicit `needs` sequence: the control job verifies provenance, persistent-runner attestation, immutable campaign/progress ledger, browser then Googlebot raw-response pre-canaries over the exact four-document manifest, and comparison/profile contracts; controlled slot jobs `01..21` each perform their exact route/profile prewarm and only their unfrozen authoritative request; the post-canary job repeats browser/Googlebot canaries and freezes controlled validity; PSI slot jobs `01..21` execute only their unfrozen bounded corroboration; the finalizer validates cardinality and writes the aggregate verdict-neutral index. Record conditioning tuples as `conditioningPop=measurement_runner`, never PSI-PoP evidence. All controlled states require expected marker/SHA, canonical/H1/Hero identity, exact manifest, matching comparison/profile contracts, stable cache policy, and the server marker. H0/H0R carry legacy shell-0 attributes plus canonical `initial_home_lcp_fingerprint`; H1 carries shell-0 safety/content/renderer state plus matching early/semantic composite proof in pre/post canaries; H2 carries shared-parent state plus permanent-Hero LCP/composite fingerprints on home. PSI after the controlled post-canary cannot retroactively invalidate controlled evidence.
- [ ] Persist every sanitized request envelope, raw PSI response/error, and controlled LHR/CDP/error through the exact `@actions/artifact@6.2.1` contract above before its start/terminal ref. `run-pagespeed.artifact-store.ts` has one primary create/readback export, wraps `DefaultArtifactClient`, never exports the client, and statically forbids `deleteArtifact`; lockfile integrity, runtime-variable presence, ten-artifacts-per-job enforcement, and immediate artifact-id/REST-digest/download behavior are tested. Under `if: always()`, each slot job uploads at most one attempt-qualified slot index naming only artifacts created/read by that job; control and post-canary jobs upload at most one bounded evidence artifact each; the finalizer uploads the sole `ogabassey-rollout-evidence-<run-id>-a<run-attempt>-<full-sha>` campaign aggregate with overwrite disabled and exactly 30-day requested retention. The final index reconstructs and lists every envelope/raw/control artifact id, API archive digest, payload hash, expiry, start/terminal ref, target manifest, comparison/profile contracts, expected semantic-admission receipt hash plus verified receipt artifact id/payload hash/bound snapshot tuple for H1/H2, runner attestation, and pre/post canary proof; it never overwrites an earlier attempt artifact or copies raw payloads into the finalizer job. Before campaign retention expiry, the rollout ledger exports the terminal index and all referenced raw artifacts to the owner-approved immutable archive or records the explicit retention cutoff; no pass/retain/rollback decision may cite an object that failed live readback at decision time.
- [ ] Generate and canonicalize the exact manifest—three `pagespeedTargets` plus four `canaryDocuments` including blog—before the first external request. H0 computes its SHA-256 and H0R/H1/H2 require byte-canonical equality with the frozen H0 manifest. A mismatch creates no request-start record and stops as semantic drift. Never rediscover a different category, PDP, or blog later.
- [ ] Before the first request, build `comparison-contract.json` and `controlled-profile.json`. The comparison contract freezes canonical/H1 identity, visible candidate ids/text/resources, representation inputs, remote bytes, and `lcpResourceSetSha256` as defined below. The controlled profile freezes exact persistent-runner attestation; Chrome binary version/SHA-256; Lighthouse `13.4.0` package/integrity and complete config; throttling method plus RTT/throughput/CPU multiplier; viewport/DPR/UA/Accept/Client Hints; locale/timezone; browser HTTP-cache and service-worker clearing; fresh browser process and incognito context per navigation; and idle-load acceptance threshold. Canonicalize and hash the complete profile. H0/H0R emit their hash; H1/H2 must equal the dispatch's `PAGESPEED_EXPECTED_CONTROLLED_PROFILE_SHA256` before any request. Any binary/config/throttle/cache/SW/context/runner/load drift invalidates the controlled namespace; H0R→H1 and H1→H2 require byte-equal profiles and runner attestations.
- [ ] Build the route/resource comparison contract with the detailed candidate and remote-object rules below. H0/H0R emit a baseline; H1 must equal H0R and H2 must equal H1 before any request. Comparison drift consumes the phase+SHA key and requires the separately reviewed newly deployed control path; it never authorizes a second campaign for the same key.
- [ ] For each remotely mutable LCP resource record, classify immutability as `content_addressed_url | provider_version_locked | overwriteable`. Persist provider version/audit proof when available. `overwriteable` may enter equal-byte lab comparison but makes field category-unlock evidence insufficient.
- [ ] Sanitize request envelopes and response evidence before artifact upload and never persist the PSI API key or a URL containing it. Progress annotated-tag messages contain only artifact ids, archive/payload hashes, bounded typed metadata, and start/terminal state; sanitized response bodies live only in their referenced immutable archives. No workflow credential has Actions-write/delete authority, the artifact helper exposes no deletion method, and a missing/deleted artifact invalidates the evidence rather than being silently reconstructed.
- [ ] Add FCP to types, summaries, thresholds/guardrail output, and failure fixtures.
- [ ] Run PSI and controlled Chrome/Lighthouse as two namespaced serial stages of the **same immutable campaign/run attempt DAG**. H0's six home-mobile `controlledSlots` also capture the Gate-0 timestamps and compute `causalHeroAvailabilityGain`; no second six-navigation trace exists. H0/H0R/H1 require request-owned slide-zero identity; H2 requires permanent slide zero in initial HTML for all six home-mobile controlled rows and matching browser/Googlebot canaries. Compare H0R→H1 and H1→H2 controlled medians, stability margins, cache state, and nested-route guardrails. PSI disagreement or incompleteness is diagnostic and cannot change the controlled verdict.
- [ ] Add the tested single-cohort PostHog extract utility `query-ogabassey-home-web-vitals.ts`. Decision mode requires explicit `--phase H0|H0R|H1|H2`, ISO-8601 `--from`, exclusive `--to`, `--collected-through` equal to `to + 6h`, exact `--sha`, `--expected-presentation-mode`, `--expected-control-render-mode`, `--expected-shell-version`, `--expected-renderer-epoch`, `--expected-renderer-digest`, `--expected-home-lcp-fingerprint`, and the ledger-recorded contracted LCP-resource-set SHA-256. H0/H0R require exactly `legacy/legacy/0`, the checked-in legacy renderer tuple, forbid both `--expected-home-critical-fingerprint` and `--expected-semantic-admission-receipt-sha256`, never call the receipt loader, and serialize their receipt/composite fields as null. H1 requires `request_owned/degraded/0`; H2 requires `permanent/permanent/1`; both require a lowercase 64-character `--expected-home-critical-fingerprint` and `--expected-semantic-admission-receipt-sha256`, load/byte-verify that immutable receipt, and join it through the complete exact SHA/merchant/safety-proof-revision/renderer/shell/two-mode/generation/LCP/semantic/link/critical/shared/static/document tuple from the rollout ledger. Phase-incompatible flags or properties fail before querying. The receipt is not a PostHog event property. The utility rejects inverted/future/open/rolling intervals, an early collection cutoff, a resource-set or receipt-binding mismatch, or any missing initial-navigation property. It returns one canonical immutable extract object for **all three required metrics** with schema version, phase/contract/interval/collection cutoff, eligible and reason-bucketed excluded deduplicated rows, hour indexes including empty buckets, raw p50/p75, LCP subparts/target/URL, INP timings plus sanitized poor-row LoAF attribution, CLS largest-shift attribution, capture modes, and source-query digest. It computes no baseline/candidate relative bound and no pass/fail verdict. A convenience rolling-hours mode, if retained, prints `diagnosticOnly=true`, cannot be frozen as a decision extract, and cannot feed a field gate.
- [ ] Add the pure two-extract comparator `compare-ogabassey-home-web-vitals.ts`. Its exact decision CLI is `--baseline-extract <path> --baseline-extract-sha256 <hex> --candidate-extract <path> --candidate-extract-sha256 <hex> --comparison-contract-sha256 <hex> --lcp-resource-set-sha256 <hex> --replicates 10000 --output <path>`; no network or PostHog credential is available to this process. It canonicalizes and hashes both files, validates each extract against its own phase-specific renderer/two-mode/shell and receipt/null contract, permits only the predeclared phase pairs `H0→H1`, `H0→H2`, or preferred causal `H1→H2`, requires distinct exact SHAs plus identical merchant/cohort filters/comparison-contract/resource-set, equal navigation duration and six-hour grace, `n>=50` per metric, and at least 12 nonempty hourly clusters per cohort. Renderer epochs/digests and shell/mode pairs are expected to differ across a legitimate phase transition and are compared to their own ledgers, never required byte-equal to each other. Using seed `SHA-256(canonical JSON {version:1,baselineSha,candidateSha,baselineInterval,candidateInterval,comparisonContractSha256,lcpResourceSetSha256})`, it performs the predeclared 10,000-replicate joint comparison by independently resampling each cohort's fixed one-hour cluster index with replacement while retaining empty/final-partial buckets. Its canonical output contains raw p50/p75, diagnostic subparts, cluster/cardinality facts, seed/replicate count, and exactly the six Bonferroni-adjusted one-sided `99.166666666666...%` bounds: LCP candidate absolute upper, LCP relative-improvement lower, INP candidate absolute upper, INP candidate-minus-baseline upper, CLS candidate absolute upper, and CLS candidate-minus-baseline upper. It emits `eligible | insufficient_evidence` plus rule facts, never a hidden alternative comparison or rounded favorable verdict. Tests freeze deterministic fixtures, input-order independence, hash/contract/phase/receipt/duration mismatch, illegal phase pairs, empty buckets, nonfinite replicates, every threshold boundary, and exact repeated output bytes. Derived FIELD plans must invoke query once per frozen cohort, archive/hash both extracts, then invoke this comparator; they may never compare two live query responses in memory.
- [ ] Reuse the existing server-only `POSTHOG_API_KEY` and `POSTHOG_PROJECT_ID` query configuration and accept the release SHA as an explicit CLI argument. Never add, log, or commit another PostHog credential.
- [ ] Implement Gate-0 attribution as an internal capture module invoked by the six H0 home-mobile controlled slots—never as a second navigation run. It consumes the same frozen browser/profile, expected SHA/marker, H0 manifest/comparison contract, and server marker; proves one colo, six HITs, stable object/policy/key, nondecreasing Age, exact merchant-bound marker fingerprint, and request-owned slide-zero identity. Capture finite marker/image/Hero/LCP timestamps on the one monotonic CDP clock, enforce the ordering/no-redirect rules above, and compute `causalHeroAvailabilityGain` plus its MAD stability margin. Test preload, late request, late element, CSS/main-thread post-readiness delay, already-present marker, streamed marker, identity mismatch, cache drift, and wrong provenance.
- [ ] Replace empirical origin-fill timing as a safety premise with one enforced end-to-end stale-fill/cache-admission deadline. Define `cacheAdmissionClosureDigest` over every cacheable anonymous response/redirect/streaming/full-body/abort path for canonical/custom/platform-subdomain/platform-path identities and home/category/PDP/blog, plus Next/Vercel/Cloudflare admission rules and delayed-origin fixtures. Freeze `staleFillCommitHardBoundSeconds` against `{cacheAdmissionClosureDigest,providerRuleDigest}`; `provenAtSha` is audit provenance only and runtime compatibility compares the closure/provider digests, never raw SHA. The bound runs from Cloudflare acceptance until the request either aborts in a way proven unable to admit later or commits the complete object and becomes observable. Include DNS/connect, origin queueing, Vercel execution/streaming/full-body completion, tiered/background fill, admission, and visibility; forbid SWR, unbounded streaming, background writes, or any branch able to admit after deadline. Exercise every distinct branch with unique reviewed keys and deterministic delayed fixtures; prove within-bound fills become observable and past-bound fills abort without a later HIT. A same-closure later deploy may reuse evidence; any changed closure/provider digest blocks deployment or promotion until re-proven. Keep the 100-read p50/p95/p99/max probe diagnostic only. The bound must be `1..14`; missing/unverifiable evidence, late admission, or branch mismatch stops strict option (a) for the explicit TTL-bounded-staleness ADR.
- [ ] Preserve updated Web Vitals emissions while freezing one initial-document context. The bootstrap first synchronously queries raw DOM for exactly one existing marker, validates its bound merchant id and full contract, and freezes context **before** registering buffered web-vitals callbacks. Only when no marker exists may it install the early MutationObserver; on first valid streamed marker it disconnects, freezes context, and then registers buffered callbacks so earlier browser entries replay through the library. Duplicate/malformed/wrong-tenant markers fail closed. Freeze `navigation_started_at_ms`, host/path, navigation type, `initial_storefront_presentation_mode`, `initial_control_render_mode`, shell-contract version, renderer epoch/digest, content generation, `initial_home_lcp_fingerprint`, and nullable committed composite, and never restamp on soft navigation, bfcache restore, DOM replacement, or pagehide. If no valid marker arrives, emit only `missing_initial_measurement_context`, never an eligible metric. Every field query deduplicates by `(git_commit_sha, metric, id, navigation_started_at_ms)` at `COLLECTED_THROUGH` and computes statistics only from rows matching the expected tenant/two-mode initial contract/LCP fingerprint/resource set; H1/H2 release eligibility additionally requires the pre/post-canary composite proof.
- [ ] Make capture transport explicit and uniform. In the normal `capturePostHogWebVitals` path, add the literal `capture_mode='posthog_js'`; in `flushWebVitalsBeacon`, add `capture_mode='pagehide_beacon'`. Give the boot-free beacon path exact-release, device-width, and immutable-navigation-context parity by stamping `$screen_width` and the frozen context at metric capture time and applying `getPostHogReleaseContext(env)` after sanitized payload properties so trusted build context overrides any payload value. Test full, untruncated `git_commit_sha`, `release_version`, `$screen_width`, `$host`, initial host/path, `navigation_started_at_ms`, both `initial_storefront_presentation_mode` and `initial_control_render_mode`, shell-contract version, renderer tuple, tenant context, and both exact capture-mode literals across delayed pagehide and bfcache fixtures. The schema/query/fixtures use underscores only—`posthog-js` is forbidden. Exact-release field cohorts include both eligible transports after query-side id dedupe; transport remains a reported dimension, not an exclusion.
- [ ] Merge and deploy H0 green, then dispatch exactly one H0 workflow campaign on that SHA and complete it in one run id with at most three bounded `github.run_attempt` executions. Run the release-scoped PostHog query against that exact SHA. Record campaign id, single run id, attempt-qualified ledger/artifact hashes, controlled evidence, PSI coverage, and outputs; never dispatch a second campaign or replace a frozen slot.
- [ ] Put every tested H0 dispatch, same-run rerun, artifact-download, ledger-verification, PostHog-query, and verdict command in the dedicated `H0-MEASURE` derived plan. This normative contract intentionally contains no copy-paste rollout shell. The derived plan must consume the one run id and attempt-qualified artifacts, read `initialHomeLcpFingerprint` consistently, and invoke no second local browser cohort.

- [ ] Record `H0_TARGET_MANIFEST_SHA256` and `H0_COMPARISON_CONTRACT_SHA256`. Reuse URL manifest through H0R/H1/H2; H0 comparison is contextual, while H0R→H1 and H1→H2 are causal. Apply Gate 0 only with exact marker/SHA/contracts and matching canaries. Semantic/cache/provenance drift invalidates the campaign and stops later phases; infrastructure/cardinality failure may resume only under the bounded same-campaign rules. If attribution fails, write the measured-owner plan.

**H0 verification**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  tools/seo/run-pagespeed.cli.test.ts \
  tools/seo/run-pagespeed.config.test.ts \
  tools/seo/run-pagespeed.failures.test.ts \
  tools/seo/run-pagespeed.provenance.test.ts \
  tools/seo/run-pagespeed.artifact-store.test.ts \
  tools/seo/run-pagespeed.progress-store.test.ts \
  tools/seo/run-pagespeed.runner-authority.test.ts \
  tools/seo/run-pagespeed.shared.test.ts \
  tools/seo/run-pagespeed.test.ts \
  src/components/analytics/web-vitals-reporter.test.tsx \
  src/lib/posthog/web-vitals-pagehide-flush.test.ts \
  src/lib/posthog/web-vitals-pagehide-flush.identity.test.ts \
  'src/app/(storefront)/ogabassey/ogabassey-home-legacy-lcp-fingerprint.test.ts' \
  'src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.test.tsx' \
  tools/perf/query-ogabassey-home-web-vitals.test.ts \
  tools/perf/capture-ogabassey-home-lcp-trace.test.ts \
  tools/perf/measure-storefront-origin-fill.test.ts
node --test \
  .github/scripts/seo-monitoring-workflow-contract.test.mjs \
  .github/scripts/tools-worker-typecheck-contract.test.mjs
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
if coderabbit review --help | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git diff --check
```

The workflow-contract test asserts exact-name-set equality for all twelve dispatch inputs; the exact H0/H0R/H1/H2 target/comparison/profile/admission-receipt hash matrix; symmetric `3+3` home-mobile sampling in all four states; one run id with attempts `1..3`; one permanent claim plus the exact active immutable-tag ruleset and duplicate/update/delete/out-of-namespace guards; read-only auditor-App runner inventory in every request-bearing job with the sole selected API row online and `busy:true`; persistent-runner attestation; the envelope-upload → readback → start-ref → network → raw-upload → readback → terminal-ref order; campaign-wide request ceilings `63+63`; the explicit non-matrix serial DAG of one control/pre-canary job, controlled slots `01..21`, one post-canary job, PSI slots `01..21`, and one finalizer; per-job artifact ceilings `3` controlled, `7` PSI, and `1` control/finalizer under the exact ten-artifact client limit; controlled-before-PSI authority/order; manifest/comparison/profile/admission-receipt verification; root-document cache-tuple preservation; `cancel-in-progress: false`; rollout-only job conditions; immutable `120`-minute campaign deadline plus cumulative `45+45+15` measured-work budgets; rollout-only `actions: read` + `contents: write`, no `actions: write`, and no token export; provenance verification before every external request; exact `@actions/artifact` integrity; no cross-job filesystem dependency; slot/control indexes plus the final campaign aggregate under `if: always()`; and no raw-artifact pooling in the finalizer.

---

## Normative Contract H0.5: Cross-Provider Decision

**Create**

- `docs/adr/002-publication-safe-critical-storefront-html.md`

**Modify**

- `docs/adr/README.md`

- [ ] Use the repository ADR structure: Status, Context, Decision, Consequences, Alternatives, Implementation Notes, and AI Context.
- [ ] State explicitly that cache purge is not a distributed transaction.
- [ ] Record the Gate 0.5 choice. Under the default strict hybrid, state why a short Next snapshot TTL alone is insufficient while Vercel/Cloudflare can independently retain the HTML document.
- [ ] Put the TTL-only alternative on the record with its real requirements: an owner-approved end-to-end stale-HTML SLO; hard-expiry budgets across snapshot + Vercel + Cloudflare whose worst-case sum stays within that SLO; no home HTML SWR/SIE stale serving at any layer; a proven Cloudflare `respect_origin`/equivalent rule; retained synchronous eviction; and a cache-hit/TTFB/LCP pilot. Reject it under the current strict publication/domain invariant. If the owner selects it, stop this plan after H0 and write the smaller replacement plan.
- [ ] Define two top-level generation classes and the content subscopes in their delivery state machines:
  - `safety`: publication, canonical slug/alias ownership, domain attach/detach/reassignment; transactional #3077 delivery, routing sync, kind-scoped OLD+NEW host/path purge, and the deduplicated union of every affected identity home plus canonical home/category/PDP/blog under **both** shell contracts. Every ready shell `0` and shell `1` document proves the same versioned `OgabasseySharedShellMarker` safety/shared tuple; persistent disabled legacy alone proves the standalone byte-stable safety marker. Alert after 2 minutes;
  - `content`: candidate-affecting writes advance one private dirty revision and upsert only `content_reconciliation/merchant`; no domain event/provider obligation is created while scope is unknown. After a 60-second trailing debounce and 120-second max wait, the same existing worker process JIT-claims that reconciliation target, runs the existing TypeScript builders, and atomically closes it with no event only when `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, and `homeDocumentFingerprint` are unchanged, or commits one new public generation/snapshot with a server-derived transition action when any owned output changed. An LCP-only, semantic-only, crawlable-link-only, shared-shell-only, or combined change remains one generation with the narrowest sound `home_content` or `shared_shell` action; static-closure drift is a renderer/protocol release change, never an ordinary row mutation. Claimable `home_content/home`, `storefront_shared_shell/merchant`, and `shared_shell_cleanup` actions create exactly one correctly scoped provider obligation/event. Under an unchanged renderer, stable degraded shell 1 with no live/awaiting promotion and no inherited cleanup duty uses `snapshot_only` for any home and/or shared data-fingerprint change and creates no new provider work; an existing home/shared duty may be carried only when its proof is already the degraded content-null shape, otherwise reconciliation waits without committing until transfer/terminal. Degraded shell-1 `promotion_staged` creates only the parked no-event stage until promotion CAS. Exact-home work purges home URLs; shared/cleanup work purges all merchant documents through dedicated-host and merchant-path-prefix duties and proves the required home/category/PDP/blog browser+Googlebot outcome. Provider scopes share one cooldown/priority lane and a shared-shell transition covers a same-generation home transition. Alert after 5 minutes without reconciling the latest dirty revision.
- [ ] Define supersession: a claimed dirty revision that is no longer newest records `superseded`, leaves exactly one successor pending, and cannot spin immediately. A committed changed fingerprint owns one immutable content generation; an unchanged fingerprint completes with no public generation advance or provider purge. Safety never treats a stale canary as completion. A safety claim captures one coherent committed content generation; newer ordinary content work becomes or remains a separate successor and cannot livelock the safety invariant.
- [ ] Define enabled/fenced provider failure behavior around an immutable publication-mutation receipt, not “whatever generation is latest.” A fenced mutation returns its own `mutationId`, target safety generation, expected publication state, and transition id. Because the mandatory Edge propagation floor alone is `11 s`, the request performs no fantasy `8 s` waiter: after commit it reads that exact receipt once. Return `200 complete` only when an idempotent/replayed receipt is already terminal, `202 pending` immediately while durable work continues, `409 STOREFRONT_STATE_SUPERSEDED` when a conflicting later mutation makes the requested outcome false, and `503` only for dead-letter/control-plane failure. Never report another transition's completion as this mutation's success. The absent/disabled-with-no-final-transition legacy branch retains its current synchronous success/retryable-failure response and creates no receipt/delivery work.
- [ ] Define the logical cache-delivery lifecycle precisely on the selected #3077 substrate: a specialized `pending` obligation's coalescible target may advance until its generic delivery is first claimed; that first generic claim freezes target generation/revision, URL/tag set, and identity/outcome children permanently. Bootstrap staging is explicitly **not** a generic delivery claim: it uses only a pre-provider routing-child lease while the generic delivery remains physical `pending`, `claim_token/lease=NULL`, `attempts_in_cycle=0`, and claim-excluded by the receipt state. The bootstrap finalizer makes that same still-mutable delivery claimable; only its later first generic claim freezes it. A mutation after that claim creates/coalesces exactly one successor and may never thaw, rewrite, or reset the predecessor. Only guarded generic lifecycle fields—state, lease/token, attempts, retry time, provider outcome, and completion metadata—plus destination-specific CAS outcome fields may change afterward. Keep the generic append-only delivery audit and one specialized transition-event audit keyed to it. Enforce at most one mutable pending successor per `(merchant_id, target_kind, target_id)` using a partial unique index. Preserve #3077's physical generic-state constraint and map it explicitly: generic `retry` is exposed as logical receipt/API `retry_wait`; generic `delivered` maps to specialized/receipt `completed`; generic `dead_letter` remains terminal failure; specialized supersession/coverage terminally maps the predecessor generic row to existing `skipped` and records `superseded|covered` only in the specialized/audit layer. Never add physical generic `retry_wait` or `superseded` states and never duplicate lifecycle columns. Lease expiry returns the same frozen delivery through physical `retry` unless a proven successor later maps it to `skipped`.
- [ ] Define publication receipts separately from mutable/coalesced work. A receipt may be `pending | retry_wait | completed | covered | superseded_conflict | dead_letter`; `covered` is legal only when a completed successor proves a superset of the original obligations **and** the current publication value still equals the receipt's expected value. Receipts are immutable audit identities even when work is coalesced.
- [ ] Define safety capacity and chaining: safety bypasses debounce but must acquire a provider-limit-scoped purge token keyed by Cloudflare account + verified plan/tier + operation bucket, receives priority over content, batches/chunks identities within the provider's documented operation limit, and never retries inline. A successor unions every distinct still-unpurged identity from non-completed safety work, but stores **exactly one** canary outcome per identity rebased to the newest safety generation. Superseded intermediate outcomes remain immutable only in audit/receipts. When duties transfer from a claimed predecessor, unique OLD identities remain purge duties while any overlapping identity's expected owner/state is recomputed from the latest authoritative transition, so `A → B → C` never loses `A` and never requires both `B` and `C` for one hostname.
- [ ] Define the two-stage #3077/single-process contract without pretending output scope is known at mutation time. Safety mutations atomically create their specialized obligation plus domain-event ledger/PGMQ item; enqueue failure aborts the source transaction. Ordinary content mutations atomically update only the singleton `content_reconciliation/merchant` target. The existing continuously polling `process-event-deliveries.ts` process has a small JIT reconciliation lane that claims one due target only when its dedicated build slot is immediately free, reads/builds/hashes, and passes its lease token into compare-and-commit. `unchanged` atomically advances the reconciled pointer and closes that lease with no domain event. `advanced` always commits the immutable snapshot/public generation and then obeys exactly one server-derived `transition_action`: claimable home/shared/cleanup creates one specialized obligation plus domain-event ledger/PGMQ item; `snapshot_only` creates no **new** event/work and may only return one unchanged degraded-compatible `carried_work_id`; `promotion_staged` creates only its non-claimable parked row with no event. Any required commit/action construction failure rolls back snapshot, pointer, and lease together. The existing domain-event router handles only the claimable actions: it atomically creates one generic delivery, binds the provider obligation, marks the ledger routed, and archives PGMQ; it performs no provider work. The same existing delivery-worker process JIT-claims provider work only into immediately available execution slots and remains the sole storefront provider executor. Extend generic claims with explicit destination isolation/priority and per-class lease so cache and existing analytics lanes cannot steal, queue behind already-leased rows, or head-of-line block each other. There is no `pg_net` callback, HTTP drain route, second provider worker/process, second systemd service, or new crontab entry.
- [ ] Include routing caches in the safety boundary. Current `domain-cache-simple.ts` can retain reverse mappings for 5 minutes and `slug-alias-cache.ts` can retain alias/liveness for 120/30/10 seconds; document purge alone cannot prove domain/slug convergence. Existing v1 keys remain strings; v2 records live only under a separate bounded namespace. New readers check an **identity-keyed** `routing_v2_live_<sha256(kind + NUL + normalizedIdentity)>` signal before consulting any process-local/v1 candidate. Every route-record key is likewise `routing_v2_record_<kind>_<sha256(kind + NUL + normalizedIdentity)>`; raw domains/slugs never enter an Edge item key. Values repeat the full kind+normalized identity, so a hash/key/value mismatch is corruption and falls through to authority. Every key matches `^[A-Za-z0-9_-]+$` and is `<=256` characters under the provider contract. An absent signal selects the current legacy path; a valid signal names `mode=v2|legacy|absent`, the current public owner/outcome, and one global monotonic `identityVersion`. `mode=v2` makes the version-matched v2 route record authoritative; `legacy|absent` prevents a stale candidate from selecting the wrong merchant. Missing/malformed/version-mismatched records use the new minimal anon-safe routing-resolution RPC, never a stale local candidate. Activation remains per control-managed merchant, but discovery is per identity, so both disabled-old→activated-new and activated-old→disabled-new reassignments converge. Distributed Edge mapping/version proof precedes HTML purge/prewarm.
- [ ] Make “Edge Config readback” a precise globally propagated proof, never a management-API echo. Vercel documents that `api.vercel.com` item reads always return the latest write even while global Edge Config propagation can take up to `10 s`; therefore management REST readback alone is forbidden as a purge gate. After one atomic coalesced PATCH, obtain the expected config digest with at most one bounded management **metadata** read, persist it in the claim/audit, wait a configured `11 s` propagation floor, then fetch `https://edge-config.vercel.com/<id>/digest` and the exact affected item set through the read-token endpoint and require expected digest plus byte-equal version/outcome values before any Vercel/Cloudflare document purge or prewarm. The later public route canaries remain the end-to-end PoP proof. A mismatch waits/retries within the routing-stage bound and never falls back to management data. Record the actual Hobby/Pro/Enterprise store limit (`8/64/512 KB` in the current official table), existing `sizeInBytes`, projected post-batch size including metadata, current writes/usage/cost allowance, and at least `20%` free headroom before enablement; reject every key above `256` characters and every batch that would exceed `80%` of the verified store cap. The current docs price writes rather than documenting a universal `480/day` hard limit, so do not freeze that unverified number: calculate an owner-approved daily spend/write budget from the live plan and measured mutation rate. Respect the management API's `20` item-read/minute cap, use no management polling loop, and block activation when size, write, or cost headroom is insufficient.
- [ ] Make each externally visible Edge boundary one indivisible PATCH. Bootstrap staging may write compatibility-v1 and v2 records with no activation/live signal. Activation then repeats the complete versioned-v2 record set and writes merchant activation `enabled=true` plus every `mode=v2` live signal in **one** PATCH; no reader may observe a live signal without its record and activation in the same digest. Already-enabled identity changes patch compatibility-v1, v2 records, and the matching live versions together. Deactivation/reassignment patches the complete compatibility-v1 desired state, merchant activation `enabled=false`, and all `legacy|absent` tombstones together before the DB deactivation CAS. Every boundary waits the `11 s` floor and proves the one distributed digest plus exact complete item set. Partial multi-PATCH visibility is forbidden even when every individual write would later converge.
- [ ] Serialize that entire PATCH→propagation→proof interval per Edge Config store. Add one DB-authoritative, expiring write lease keyed by Edge Config id; every worker identity applier, operator activation/deactivation command, and retained legacy global sync must claim the same lease before PATCH and hold its token through the `11 s` floor, distributed whole-store digest, exact-item proof, and audit commit. No database transaction or connection is held while waiting. Lease loss/expiry stops before the next side effect; stale-lease recovery reapplies and reproves the claimant's complete idempotent batch. A disjoint concurrent writer may not change the digest during another claim's proof. Use a bounded `30 s` lease for the `20 s` routing stage, no local wait queue, and durable retry/operator polling on contention. Measure serialized throughput and include it in the worst-case safety SLA/write budget; if the actual mutation rate cannot fit one proven batch per lease interval, H1 enablement is blocked. Test two disjoint worker transitions, worker versus operator activation, legacy sync versus deactivation, claimant death before/after PATCH, lease expiry during the floor, and zero digest ping-pong/livelock.
- [ ] Inventory every caller of `triggerDomainEdgeConfigSync()` and replace its implicit global-write contract with `triggerDomainEdgeConfigSync({ merchantIds, reason })`. `merchantIds` scopes audit/coalescing, not deletion discovery. If every affected merchant is absent/final-disabled and no affected identity has `mode=v2`, retain the current **global desired-set v1 string reconciliation** so detached/deleted keys are removed by diff; a merchant-current-row-only sync is forbidden because it cannot discover the old key. A retained `legacy|absent` live tombstone does not make this enqueue-only: new readers seeing that tombstone always call the authoritative routing RPC, never trust v1/local, until a bounded retirement job proves v1 readback plus the maximum 5-minute local-cache/Edge propagation window and deletes it. For control-managed merchants or any affected `mode=v2` identity, the call is enqueue-only. State-specific ownership is mandatory: while `enabling`, the durable worker may write/delete/prove compatibility v1 and versioned v2 route records only, then mark the exact receipt `routing_staged`; it may not write merchant activation or any live-v2 signal. The operator activation RPC owns DB activation plus one atomic Edge PATCH containing every v2 record, merchant activation, and live signal for that visibility boundary, then waits the propagation floor and proves the distributed digest/items before releasing the same work for the worker's document purge/public-canary pass. Once already `enabled`, the worker may advance versioned route records and live identity signals in one atomic Edge batch under the safety claim without changing merchant activation. Draining/final-disable remains operator-owned and Edge-first. Final-disable proves no `mode=v2` signal remains; disabled mutations during tombstone retention therefore remain safe. A static contract test must fail on a zero-argument/direct-v2-provider call or a bootstrap worker activation/live-signal write so domain actions, verification, purchase, slug rename, and payment/webhook paths cannot silently retain a second writer.
- [ ] Define Cloudflare provider admission once for the entire repository, independently of request rate limiting. Inventory and migrate **every current caller**, including the new storefront worker; publication and product/PDP/category/listing paths; `cache-revalidation.ts` blog purges; `image-format-backfill.ts`; `.github/scripts/cloudflare-purge-cache.mjs`; `.github/scripts/storefront-sitemap-purge.mjs`; and every invoking `deploy.yml` step. Each supplies one frozen class from the seven-value contract and acquires the same fail-closed shared-Redis token keyed by actual account + verified plan + operation bucket before each provider call through one canonical checked-in runtime bundle: JSON for the class/bucket/result constants, one Lua byte string for the atomic Redis algorithm, and a Node-compatible MJS loader. The typed TS facade derives from and validates that JSON; web, VPS, and GitHub adapters load the same JSON+Lua bytes and never transpile/import TypeScript in a plain Node runner. Export both typed and runtime entrypoints from `@baci/shared`, install/copy the runtime bundle in the VPS release, and add route-specific Next `outputFileTracingIncludes` plus `.nft.json` assertions so every Vercel purge consumer contains the JSON/Lua files. A byte-parity test across TS, MJS, VPS, GitHub, and traced Vercel artifacts fails on a missing file, different Lua digest, or second constant set. Safety has a reserved opportunity/priority; lower-priority work may not consume it while safety is due. Redis unavailability or provider backoff makes zero Cloudflare calls. Worker safety/shared/home moves delivery to physical `retry`/logical `retry_wait`; legacy product hands off to its reliable-revalidation owner or returns retryable failure; required sitemap/release coherence fails the deploy rather than claiming a purge. Record two narrow TTL exceptions in ADR 002: fire-and-forget blog `legacy_content` may log a typed deferred result and rely on its existing outer TTL, and an operator image backfill may count the URL as residual/deferred for a later run. Neither exception may call Cloudflare, report success/freshness, or consume the safety reserve without admission. GitHub purge steps receive scoped `UPSTASH_REDIS_REST_URL`/token secrets only for those steps and use the same contract/bucket; missing secrets are typed no-call outcomes, never fail-open API calls. `proxy.ts` and the public API limiter do not participate. Static TS/MJS/workflow scans fail any raw Cloudflare endpoint, unclassified helper invocation, second token-bucket algorithm, or unreviewed exception.
- [ ] Record the Vercel runtime boundary explicitly. `dangerouslyDeleteByTag` is a Vercel-runtime primitive and may not be invoked or treated as successful on the VPS. The VPS remains coordinator but calls one narrow Vercel-resident purge actuator on a configured Vercel-origin/deployment-alias URL that bypasses the public OgaBassey Cloudflare document cache. Authenticated `GET` on that exact route is a `no-store` release-provenance probe; authenticated `POST` verifies the probed marker, accepts a bounded exact-tag request, performs only foreground tag deletion, and returns a typed receipt. It cannot claim/finish/retry work, call Cloudflare, prewarm, or canonical-canary. Non-Vercel execution, marker mismatch, authentication failure, helper failure, or any URL resolving through the canonical Cloudflare hostname is retryable and can never report success; public canonical browser/Googlebot canaries belong after both provider purges and remain the end-to-end proof.
- [ ] Define one server-only public-document fetch policy for the VPS prewarm and canaries. Inputs are a strict target-class/assertion-kind discriminated pair: the target freezes `{ targetClass, documentKind, identityKind, normalizedIdentity, hostname, path, expectedOutcome }`, while `expectedProof` carries every merchant/publication/safety/renderer/shell/render-mode and class-specific comparison value. Both are materialized only from frozen persisted obligations/snapshot or the bounded committed nested-route manifest; arbitrary URLs or reconstructed proof fields are never accepted. Identity-safety targets are home-only: host/subdomain/custom-domain targets permit `/`, and a platform-path target permits exact `/<normalized-slug>`. The nested manifest permits exactly canonical home/category/PDP/blog route targets with document-kind-specific normalized path grammars and no arbitrary fifth path. Require HTTPS/443, no IP literal/userinfo/query/fragment/custom port, lower-case IDNA host equality, manual/no-follow redirects, certificate validation for the expected hostname, exact `Host` and TLS SNI, no inherited proxy environment, a bounded body/header/time budget, and connect-time DNS protection. Resolve and validate the complete CNAME/A/AAAA result, reject if any candidate is loopback/private/link-local/CGNAT/reserved/documentation/multicast/metadata space (including IPv4-mapped and IPv6 equivalents), pin one validated public address for that request, and re-resolve independently for later requests. Freeze outcome-specific verdicts: `route` requires byte-equality with the expected success/canonical/tenant/safety/renderer/shell/document proof; `redirect` accepts only its exact reviewed 30x and normalized public `Location` without following it; `absent` accepts a controlled neutral `404|410` with no former-tenant bytes, a two-round authoritative/DNSSEC negative `NXDOMAIN|NODATA` proof after DB+Edge readback, or public-DNS TLS-name rejection that makes the HTTPS identity non-readable in both rounds. Private-address answers, timeout, SERVFAIL, connection failure, unexpected TLS/status/location, size, proof, or policy failure remain retryable and never pass. Test every proof-field mismatch, rebinding, private CNAMEs, IPv4/IPv6 literals and encodings, Unicode/punycode, wildcard/custom-domain and platform-path targets, all four nested document kinds, path-kind/assertion substitution, exact redirects, detach-to-NXDOMAIN, TLS-lost detach, timeout/SERVFAIL, later reattachment/version invalidation, redirect-to-private, and proxy-environment injection.
- [ ] Make dead letters operable, not merely visible. Extend #3077's authenticated, operator-checked cursor-list, compare-and-swap requeue, and resolve-covered RPCs through its existing tested admin dead-letter/replay routes, narrow destination adapter, and runbook while preserving total-attempt history. Requeue/resolve accept the authenticated operator UUID, require it to equal `auth.uid()` unless service role, and persist it with the bounded reason in immutable audit; `is_event_pipeline_operator_v1()` remains mandatory. Resolve-covered is allowed only for the same merchant with newer-or-equal generation, matching safety/renderer/cache-protocol fences, and a server-proven obligation/outcome superset. Same-class coverage is allowed; the **only** cross-class relation is completed `shared_shell` covering `home_content` under the `home_content < shared_shell` lattice. Safety may cover content only when it actually carried the inherited document scope and exact output duties. Home can never cover shared shell, and content can never cover safety. There is no arbitrary “mark complete.” The caller-bound admin route must not instantiate a service-role client. Do not create a cache-only CLI or operator stack.
- [ ] Record the actual Cloudflare plan/account-shared limits before enablement. Use the official hostname/tag/prefix and single-file purge tables; do not assume Enterprise capacity.
- [ ] Inspect and export the live Cloudflare Cache Rule, Cache Key, Worker Cache API, and URL Transform definitions before selecting a purge duty. If anonymous browser/Googlebot/device variants use Cache-Rule custom keys, single-file home purges must persist/send every required header tuple; if a Worker Cache API custom key is used, single-file purge is forbidden and the ADR must select a proven tag/host/prefix alternative. For all-document safety/shared-shell work, freeze duties by identity kind: dedicated canonical/custom/platform-subdomain hostnames may use hostname purge; `platform_path` on shared `usebaci.com` must use one exact single-file purge for `https://usebaci.com/<slug>` plus a boundary-safe prefix `usebaci.com/<slug>/` for descendants, using the post-transform path required by the live rule. Never hostname-purge `usebaci.com`. Prove sibling `<slug>2` isolation and every cache-key variant in a controlled test. If that cannot be proven, H1 enablement is blocked; two-UA canaries alone are not cache-key coverage proof.
- [ ] Reconcile open #3060 and #3077 explicitly with a field-by-field mapping. Under the preferred path, `domain_events` + the #3077 delivery ledger remain the only queue/claim/retry/dead-letter/replay lifecycle; H1 adds one `storefront_cache_transition` destination and a specialized frozen-obligation/coalescing child keyed to that lifecycle, plus destination-scoped RPC wrappers where the VPS worker needs narrower types. Reuse #3077's VPS deployment, heartbeat, recovery sweep, retention, and operator surface; do not create a second schedule/service/admin dead-letter stack. Mark #3060's standalone outbox/worker names superseded while adopting any stronger generation/lease rules. If the mapping cannot preserve H1's pending-successor coalescing, safety priority, immutable OLD+NEW obligations, receipt coverage, and provider-budget semantics, stop for an explicit owner decision rather than implementing both.
- [ ] Define public vs service-role boundaries and the minimum public projection.
- [ ] Define response/data tag names and alias coverage.
- [ ] Reference official semantics:
  - [Next Cache Components](https://nextjs.org/docs/app/getting-started/partial-prerendering)
  - [Next `use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache)
  - [Next `revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
  - [Vercel cache functions](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package)
  - [Vercel Edge Config REST versus globally distributed read endpoint](https://vercel.com/docs/edge-config/vercel-api)
  - [Vercel Edge Config propagation and plan limits](https://vercel.com/docs/edge-config/edge-config-limits)
  - [Supabase Queues / PGMQ](https://supabase.com/docs/guides/queues)
  - [Cloudflare purge options and account-shared limits](https://developers.cloudflare.com/cache/how-to/purge-cache/)
  - [Cloudflare purge by prefix](https://developers.cloudflare.com/cache/how-to/purge-cache/purge_by_prefix/)
  - [Cloudflare custom cache-key purge behavior](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-cache-key/)
  - [Cloudflare revalidation and stale behavior](https://developers.cloudflare.com/cache/concepts/revalidation/)
  - [Cloudflare CDN cache-control precedence](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/)

**Initial configuration contract — copy into ADR 002 and the tested config boundary**

| Setting | Initial contract |
| --- | --- |
| PSI per-observation retry budget | `2` retries after the first attempt, serial, honoring `Retry-After`; no workflow-level replacement |
| Content trailing debounce / hard max wait / provider cooldown | `60 s / 120 s / 60 s` |
| Storefront ingress/destination rollout gates | `STOREFRONT_CACHE_TRANSITION_INGRESS_ROUTING_ENABLED=false` on the existing router and `STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED=false` on the existing delivery worker; enable only after both exact effective-state heartbeats match the release fence. Once a merchant control row is enabled, that DB row is the sole source enqueue gate: a later worker crash/flag outage leaves mutations durably pending and alerting rather than falling back or aborting the state change. `STOREFRONT_CACHE_TRANSITION_CONCURRENCY=1`, clamped `1–2`. The specialized ingress lane is independent of analytics `EVENT_PIPELINE_ROUTING_MODE`; neither cache flag enters `EVENT_PIPELINE_ACTIVE_DESTINATIONS` or changes the four-destination legacy-fanout cutover check |
| Worker release fence | One DB-authoritative CAS row pins router SHA/ingress contract, delivery SHA/destination contract, renderer epoch/digest/critical-shell contract version, and cache-protocol version/digest. Control enablement requires fresh matching V2 heartbeats from both existing services; ingress/claim re-check it on every batch. It deliberately does not pin the changing web deployment marker |
| Cache-protocol rotation | A version/digest change requires a durable drain id: suppress and final-disable every control-managed merchant under the old protocol, reach zero live/retry/dead-letter old-protocol obligations and leases, stop both storefront lanes, then deploy/install/CAS the new protocol and re-enable. Same-protocol renderer/release changes pass no rotation id. Never reinterpret or reclaim a frozen claim under a different tag grammar |
| Vercel purge actuator | Dedicated `STOREFRONT_CACHE_PURGE_ACTUATOR_URL` + `STOREFRONT_CACHE_PURGE_ACTUATOR_SECRET`; URL must be a reviewed Vercel-origin/deployment alias and never the canonical Cloudflare hostname; authenticated no-store `GET` provenance plus bounded `POST` on the same exact path; at most `32` total distinct reviewed storefront tags, proven before enqueue; `5 s` per origin-probe/POST call. The worker passes the origin-probed marker + cache-protocol digest to `POST`, requires both in its typed receipt, then verifies canonical browser+Googlebot post-canaries after Vercel and Cloudflare purge |
| Storefront delivery poll/claim target | Existing #3077 service poll interval `<= 1 s`; healthy due work claimed within `5 s`; existing one-minute recovery sweep remains mandatory |
| Destination execution budget | Freeze one formula only after admission and purge-barrier proof: `stageTotal = routingStageHardMax + probe1 + vercelPurge1GlobalMax + cloudflarePurge1GlobalMax + quiescenceMax + probe2 + vercelPurge2GlobalMax + cloudflarePurge2GlobalMax + prewarmMax + canaryMax + quietMax + dbCasMax`. Bind `probe1=5 s` and `probe2=5 s` to the actuator GET cap. `routingStageHardMax=20 s` is inclusive of PATCH `<=3 s`, fixed floor `11 s`, and distributed proof/audit `<=6 s`; `quiescenceMax<=15 s`, `prewarmMax<=10 s`, `canaryMax<=24 s`, `quietMax=2 s`, `dbCasMax=7 s`. Provider purge variables are the proved global-effect bounds, not HTTP response times. Require `executionDeadline >= stageTotal + 15 s final-CAS reserve` and `lease >= executionDeadline + 60 s`; the intended `150/210 s` values are legal only if the frozen formula fits. Otherwise strict option (a) blocks pending a reviewed protocol/budget revision—never squeeze or omit a barrier |
| Enabled publish response | No server wait loop and one exact-receipt read after mutation. V1 returns `200` only for an already complete/covered idempotent receipt, otherwise immediate `202` pending/retry-wait, `409` conflicting supersession, or `503` dead-letter/control-plane failure. Legacy `{}` returns its old success shape only when a retry finds its DB-backed action receipt terminal; pending/retry-wait immediately returns non-2xx `503 STOREFRONT_PROPAGATION_PENDING` plus `Retry-After: 2`, and a same-state retry reuses that receipt rather than creating work |
| V1 client status UX | After `202`, poll the authenticated status URL every `2 s` for at most `120 s`; then stop network activity and leave an honest “propagation pending” state. Closing the client never cancels durable work |
| Provider admission | One repository-wide shared-Redis Cloudflare token bucket at verified account/plan/operation scope for worker, legacy product/content, image-backfill, and deploy callers; explicit `safety | shared_shell | home_content | legacy_product | legacy_content | image_backfill | deploy_coherence` class, with safety reserved first and image backfill last. No class may call Cloudflare without a token or use a process-local fallback. Safety/shared/home retain durable retry; legacy product returns/queues its reliable retry; required deploy coherence fails honestly. ADR-approved `legacy_content` and operator `image_backfill` may drop only the purge attempt and rely on their documented TTL/residual report, but must return a typed skipped/deferred outcome, make zero provider call, and never claim fresh CDN state |
| Edge Config admission | One coalesced PATCH per safety transition/batch at most; expected digest recorded once; fixed `11 s` minimum global-propagation wait; distributed digest+item read, never management-item polling. Record current store size, plan, daily usage/cost allowance, and worst-case writes before enablement; current management REST item reads are capped at `20/min`, while the globally distributed read endpoint is the readback lane |
| Edge Config size/key/atomicity | Every item key is hash-bounded, provider-regex-valid, and `<=256` characters; raw identities live only in values and must match their key hash. Prove the actual `8/64/512 KB` plan cap, `sizeInBytes`, projected atomic batch size including metadata, and `>=20%` free headroom. Activation is one v2+activation+live PATCH; enabled changes are one compatibility-v1+v2+live PATCH; deactivation is one compatibility-v1+activation-false+tombstone PATCH. No universal `480 writes/day` assumption: record live priced usage and an owner-approved daily write/spend budget |
| Edge Config write serialization | One DB-authoritative `30 s` lease per Edge Config store covers the complete `routingStageHardMax=20 s`: PATCH `<=3 s`, fixed `11 s` floor, distributed digest/item proof plus audit CAS `<=6 s`. The lease must still have enough lifetime for the remaining residual before every substep and remain valid through audit commit. Contention creates durable retry/operator wait, never a second writer or local queue |
| Storefront claim/lease | Claims are JIT, never prefetched: one reconciliation row only when its build slot is free, and at most immediately free provider slots (`1`, maximum `2`) with safety/shared-shell-or-cleanup/home priority. `shared_shell_cleanup` is distinct/non-narrowable. Intended provider lease/deadline are `210/150 s` only after the frozen stage formula proves they fit; otherwise activation blocks. No row waits locally with a lease. Worst-case tests hold one execution for the configured deadline and prove the next remains unclaimed/recoverable |
| Worker destination deadline | Configured to the frozen formula with at least `15 s` final-CAS reserve and lease headroom `>=60 s`; before every routing/provider/barrier/wait/prewarm/canary side effect require remaining time >= that stage maximum + final reserve |
| Public prewarm/canary fetch | Frozen typed document target only; HTTPS/443, manual/no-follow redirects, identity homes use host/subdomain `/` or platform path exact `/<normalized-slug>`, and the separately bounded checked-in Oga canary-document manifest permits only canonical home/category/PDP/blog paths; no IP literals, userinfo, query, fragment, custom port, arbitrary fifth document, or environment proxy; validate and pin a public connect address while preserving exact hostname certificate/Host/SNI; `4 s` per read and `2 MiB` maximum response bytes. Verdicts are outcome-specific: exact route, exact no-follow redirect, or proven neutral/DNS-negative/TLS-unreadable absence; private DNS, timeout, SERVFAIL, and ambiguity retry |
| Retry schedule | Exponential from `15 s`, cap `900 s`, maximum `12` attempts; then `dead_letter` + page. Dead letters are never garbage-collected automatically |
| Persisted safety identity/target/tag ceiling | At most `8` distinct OLD+NEW semantic identity/outcome children, at most `8` exact typed home identity targets, one checked-in canonical document manifest of exactly `4` home/category/PDP/blog targets, and `32` total distinct Vercel tags. A slug child may consume platform-subdomain and platform-path homes. **Every shell-0 or shell-1 safety transition** unions the canonical four with identity homes, deduplicates canonical home, and admits at most `11` fetch targets. Every ready compatible canonical document under either shell contract proves the one versioned `shared_shell` safety/shared marker; persistent disabled legacy alone uses the standalone safety marker. A safety obligation carrying inherited cleanup materializes the canonical four as `shared_shell_cleanup` and proves old-marker absence plus the restored shell-0 shared marker or exact neutral/disabled outcome. Ordinary `shared_shell` canaries use exactly four documents under both shell contracts; forward cleanup uses the same four; home content uses one home. The protocol reserves `8 core + 3 per identity <=32`; source transaction, claim, worker, and actuator enforce the same bounds with no truncation |
| Control-managed identity admission | Enablement first materializes the merchant's complete current identity-home duty and fails before activation if it exceeds `8` semantic children or `8` typed home targets. While `enabling|enabled|draining|disabled-final-cache-pending`, every domain/alias/slug ownership mutation calculates the exact OLD+NEW transition union under the same SQL builder before changing ownership and rejects a ninth child/target with a typed capacity error. This guard cannot block publication-only unpublish at the admitted cap, because unpublish adds no identity; it must always commit and drain. Capacity expansion requires an ADR/protocol rotation or disabling/detaching first, never enqueue-time surprise |
| Quiescence interval | `staleFillCommitHardBoundSeconds + 1`; total `2–15 s`. Evidence is keyed to exact `cacheAdmissionClosureDigest + providerRuleDigest`; `provenAtSha` is audit only. Missing, unverified, wrong-closure, or wrong-provider evidence blocks enablement/promotion. Empirical p99 remains diagnostic only |
| Operational alert delivery | `STOREFRONT_CACHE_ALERT_WEBHOOK_URL` is a dedicated Slack-compatible operations webhook installed on the VPS and required before any merchant can enter `enabling`; structured journald logs remain the audit fallback. Safety age `>2 min`, content-reconciliation age `>5 min`, dead letter, stale release heartbeat, provider-budget starvation, and alert-delivery failure emit deduplicated alerts with merchant/work/stage and no secrets. Alert failure never marks work complete; heartbeat/health exposes `lastAlertAttemptAt`, `lastAlertSuccessAt`, and sanitized error. Reuse of the optional GitHub-only `SEO_MONITORING_SLACK_WEBHOOK_URL` is forbidden because it is not available to the worker runtime |
| Canary fan-out / quiet interval | Safety under shell `0` or `1` uses the deduplicated union of up to `8` identity homes plus the canonical `4`, at most `11` targets, × browser and Googlebot in two rounds: at most `22` reads/round, concurrency `8`, `4 s`/read, three waves/round = `12 s`, two rounds = `24 s`, then `2 s` quiet. Ordinary shell 0 omits the H2 shared-marker assertion, never the nested safety documents; cleanup-carrying safety instead requires marker absence on all canonical four. Shared-shell content uses four documents; home content uses one. Never truncate; test platform-subdomain + platform-path and all document kinds |
| Snapshot retention | Keep current + previous rollback generation unconditionally and other unreferenced snapshots for `7 days` |
| Transition/audit retention | Completed/superseded specialized events `90 days`; logical receipt `retry_wait`, physical generic `retry`/`dead_letter`, and referenced rows retained until explicitly resolved |
| Routing v2 activation scope | Per control-managed merchant, with an identity-keyed live/tombstone signal checked before any candidate bootstrap; absent signals preserve the v1/local lane, valid signals carry a global identity version and prevent stale-candidate blind spots |
| Cloudflare capacity | No default. Verified plan/tier, account id, operation buckets, per-request item limits, and cache-key variant contract are required before enablement |

Any change to these values is an ADR/config change with proportional load/race tests; an executor may not invent per-module defaults.

---

## Normative Contract H0.75: Actual-Route Build Spike

Next's bundled/current Parallel Routes contract says sibling slots at one segment cannot be independently prerendered when another slot is dynamic. Therefore `@critical` is a **rejected implementation**, not the plan. Before spending on H1, prove the non-slot alternative against the actual `[slug]` route tree.

**Disposable spike branch only — never merge or deploy**

**Create on the spike branch**

- `apps/web/tools/perf/assert-ogabassey-layout-feasibility.ts` and colocated test
- `apps/web/tools/perf/run-ogabassey-layout-feasibility-fixture.ts` and colocated test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-critical-shell-spike-marker.tsx` and colocated test

**Temporarily modify on the spike branch**

- `apps/web/src/app/(storefront)/[slug]/layout.tsx` and test
- `apps/web/src/app/(storefront)/[slug]/(home)/page.tsx` and static-param test
- `apps/web/src/app/(storefront)/[slug]/(home)/ogabassey-static-home-page.tsx` and test
- the minimum extracted static-shell/request-boundary modules intended by H2-A

- [ ] Start from the merged H0/H0.5 exact head on a clean `codex/cwv-layout-feasibility-spike` branch in this existing worktree. Make one commit, record its SHA and a SHA-256 digest of its patch, and do not merge it into the implementation branch.
- [ ] Preserve the real `generateStaticParams()` owner in `(home)/page.tsx` and assert exact generated values `ogabassey.com` and `ogabassey`. Do not fake a separate fixture route.
- [ ] On this non-deployed branch only, branch the actual parent layout on those generated identifiers before the current request snapshot, place a hidden product-free `<span data-ogabassey-critical-spike="v1" />` in the real OgaBassey home page, and let the marker-bearing home child sit outside the temporary request-resume boundary. The spike may use a hardcoded neutral/publication fixture solely to test Next's partitioning; it must contain no product data and must never be served.
- [ ] Do not create `@critical`, another parallel slot, a proxy rewrite, or a fixture-only URL. The test is whether ordinary `children` can contribute a static home prefix while request-scoped chrome/body work resumes later.
- [ ] The fixture runner owns one disposable local Supabase reset/seed and a scrubbed local production-server child. Seed one real generic merchant identifier that resolves through the ordinary `[slug]` route in addition to the two generated OgaBassey identifiers; do not add it to `generateStaticParams()` or hardcode a fixture branch in application code. The runner records root HTML, response headers, linked stylesheets, route/chunk manifests, and fetched CSS bytes for all three identifiers, then kills/waits for the exact child.
- [ ] Run the local production build and assertion only:

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  tools/perf/assert-ogabassey-layout-feasibility.test.ts \
  'src/app/(storefront)/[slug]/layout.test.tsx' \
  'src/app/(storefront)/[slug]/(home)/page.test.tsx'
pnpm --filter @baci/web build
pnpm --dir apps/web exec tsx tools/perf/run-ogabassey-layout-feasibility-fixture.ts \
  --next-dir .next \
  --generic-identifier cwv-layout-generic-fixture \
  --output-dir "$RUNNER_TEMP/ogabassey-layout-feasibility"
pnpm --dir apps/web exec tsx tools/perf/assert-ogabassey-layout-feasibility.ts \
  --next-dir .next \
  --capture-dir "$RUNNER_TEMP/ogabassey-layout-feasibility" \
  --identifier ogabassey.com \
  --identifier ogabassey \
  --generic-identifier cwv-layout-generic-fixture \
  --marker data-ogabassey-critical-spike=v1
git diff --check HEAD^ HEAD
```

- [ ] The assertion must parse the prerender manifest and real route artifacts, prove both OgaBassey identifiers are generated, locate the marker before the first request-resume/postponed boundary, and prove the marker is absent from category/PDP/blog artifacts. It must additionally prove the OgaBassey critical stylesheet/link/chunk and its unique sentinel rule are present for both generated OgaBassey captures but absent from the real generic merchant response, its linked CSS set, and its route/chunk dependency graph. A fully collected streamed response or component-call test does not count for the marker; a source-regex claim does not count for CSS partitioning.
- [ ] If either OgaBassey identifier is wholly dynamic, if the child marker appears only after resume, if category/PDP/blog inherits it, or if the generic merchant imports/links/contains any OgaBassey critical CSS byte, stop the entire H1/H2 plan and write a route-hierarchy/proxy-identity replacement proposal. Do not “try H1 anyway.”
- [ ] If green, preserve commit/patch digest, Next version, build command, manifests, artifacts, and assertion JSON. Return to the clean branch; leave the spike unmerged/undeployed. H2-A must reproduce its structural signature with the H1 coherent render state.

---

## Normative Contract H1A/H1D: Generation, Snapshot, And Publication Data Plane

**Create**

- **H1A/H1D1/H1D2:** next free ordered append-only migrations, **as many as required to keep every file under 300 lines and one cohesive responsibility per file**. Do not freeze a seven-file/timestamp count. The numbered slice labels below are authoritative ownership:
  1. **H1A:** control/snapshot/operator-receipt/specialized-obligation substrate schema, indexes, constraints, and RLS; publication receipt tables may exist inertly, but no publication evaluator/primitive/guarded publication trigger/RPC or grant cutover lands here;
  2. **H1A:** renderer requirement, generation/snapshot/raw-input/compare-and-commit RPCs;
  3. **H1A:** atomic transition ensure/coalesce and receipt attachment;
  4. **H1A:** specialized #3077 storefront ingress routing/binding and stale-generic-router guard;
  5. **H1A:** generic claim exclusion/replacement plus worker-release rows and heartbeats;
  6. **H1A:** specialized claim/complete/retry/transfer lifecycle and exact-release fencing;
  7. **H1A:** bounded content and non-publication identity-safety triggers while every control remains disabled;
  8. **H1A:** dead-letter/operator cursor-list, CAS requeue, resolve-covered, control-state, render-mode, cache-protocol rotation, atomic successor-completion/predecessor-coverage, and reconciliation-sweep RPCs—split again if the file would exceed 300 lines; these must exist before any H1D enablement path can call them;
  9. **H1D1 only:** private publication/eligibility lock context, evaluator, guarded publication trigger, eligibility/mutation/status RPCs, receipt wiring, and temporary mixed-fleet grants that retain the old direct publication columns;
  10. **H1D2 only, after fleet-drain proof:** append-only direct-publication-column revocation, exact positive safe-column grants, grant/projection completeness sweeps, and final ACL tests;
  11. **H1A:** exact comments and remaining non-publication ACL hardening. If a later phase discovers an additional publication-specific ACL change, it must allocate a new phase-owned migration rather than silently extending this H1A slice.
- **H1D1:** `packages/shared/src/schemas/storefront-publication-transition.ts` and colocated test
- **H1D1:** `packages/shared/src/schemas/storefront-publication-mutation-request.ts` and colocated test
- **H1D1:** `packages/shared/src/schemas/storefront-publication-eligibility.ts` and colocated test
- **H1D1:** `packages/shared/src/fixtures/storefront-publication-eligibility-cases.json`
- **H1A:** `apps/web/src/schemas/storefront-home-critical-public-snapshot.ts` and colocated test
- **H1A:** `apps/web/src/schemas/storefront-home-critical-semantic-snapshot.ts` and colocated test
- **H1A:** `apps/web/src/schemas/storefront-home-critical-generation-state.ts` and colocated test
- **H1A:** `apps/web/src/schemas/storefront-public-safety-proof.ts` and colocated test, owning the exact product-free route-wide proof and canonical URL-outcome digest inputs
- **H1A:** `apps/web/src/lib/storefront-public-safety-proof-payload.ts` and colocated test, the one pure TypeScript builder for the immutable proof row and canonical URL-outcome payload
- **H1A:** `apps/web/src/fixtures/storefront-public-safety-proof-cases.json`, consumed byte-for-byte by the TypeScript and SQL parity suites
- **H1A:** focused `supabase/tests/storefront_public_safety_proof_parity_*.sql` suites, including canonical sort, duplicate-target rejection, revision/current-pointer selection, grants, and exact JSON/digest parity
- **H1A:** `apps/web/src/schemas/storefront-home-critical-reconcile-input.ts` and colocated test
- **H1A:** `apps/web/src/schemas/storefront-home-critical-commit-result.ts` and colocated test
- **H1A:** `apps/web/src/schemas/storefront-critical-operator-transition.ts` and colocated test
- **H1A:** `apps/web/src/config/ogabassey-home-renderer-contract.ts`
- **H1A:** `apps/web/src/config/ogabassey-home-renderer-contract-manifest.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-launch-product-selection.ts` and colocated test, extracted without behavior change from the current launch-products module
- **H1A:** `apps/web/src/lib/ogabassey-home-hero-resource-hint-projection.ts` and colocated test, a pure builder for the exact connection/preload attributes currently derived inside `ogabassey-home-hero-resource-hints.ts`; worker, renderer, fingerprint, and canary all consume this one projection
- **H1A:** `apps/web/src/lib/ogabassey-home-critical-public-payload.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-semantic-public-payload.ts` and colocated test; H1A implements only the full current shell-0 graph. The schema may reserve shell version `1`, but the first shell-1 payload implementation and builder belong exclusively to H2.
- **H1A:** `apps/web/src/lib/ogabassey-home-crawlable-product-links.ts` and colocated test, selecting at most 24 active public products by the total order `created_at DESC, id ASC` and projecting only `{name,canonicalAbsoluteHref}`; price, image, stock, availability, description, and mutable `updated_at` are forbidden inputs
- **H1A:** `apps/web/src/lib/ogabassey-shared-shell-public-payload.ts` and colocated test, producing the bounded product-free theme/header/navigation/footer/static-config projection consumed by every Oga route shell
- **H1A:** `apps/web/src/lib/ogabassey-home-lcp-fingerprint.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-semantic-fingerprint.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-crawlable-links-fingerprint.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-shared-shell-fingerprint.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-critical-fingerprint.ts` and colocated test, exporting only the version-2 LCP+semantic+links composite builder
- **H1A:** `apps/web/src/lib/ogabassey-home-document-fingerprint.ts` and colocated test, composing home-critical, shared-shell, and checked-in static-document-closure digests
- **H1A:** `apps/web/src/lib/storefront-home-critical-cache-tags.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-critical-snapshot.ts` and colocated test
- **H1A:** `apps/web/src/lib/ogabassey-home-semantic-snapshot.ts` and colocated test
- **H1A:** `apps/web/src/lib/storefront-critical-snapshot-migration-contract.test.ts`
- **H1D1/H1D2:** `apps/web/src/lib/storefront-publication-writer-inventory.test.ts`, first proving the additive writer inventory and later the direct-column revoke/final grant closure
- **H1A:** `apps/web/tools/perf/assert-ogabassey-renderer-contract.ts` and colocated test
- **H1D1:** `apps/web/tools/test/assert-storefront-publication-eligibility-parity.ts` and colocated test
- **H1A:** `apps/web/tools/test/storefront-critical-phase-gate-manifest.ts` and colocated test, freezing cumulative files/commands for H1A, H1B, H1C1, H1C2, H1D1, and H1D2 without requiring later-phase files early
- **H1A:** `apps/web/tools/test/storefront-critical-active-phase.ts` and colocated test, exporting the one committed active phase; each later H1 PR advances this marker exactly once and CI rejects absent/ambiguous/backward phase selection
- **H1A:** `apps/web/tools/test/run-storefront-critical-phase-gate.ts` and colocated test, executing exactly one manifest phase and emitting an exact-SHA gate receipt
- **H1A/H1D1/H1D2:** focused SQL suites named `supabase/tests/storefront_critical_h1a_*.sql`, `supabase/tests/storefront_critical_h1d1_*.sql`, and `supabase/tests/storefront_critical_h1d2_*.sql`; each glob belongs only to its namesake phase. Each file owns one behavior family and is `<=300` lines; do not replace them with one monolithic snapshot/generation script

**Modify**

- **H1D1:** `packages/shared/src/schemas/index.ts` export update

- **H1A/H1D1/H1D2 as applicable:** `apps/web/src/types/supabase.ts` by regenerating it from the disposable local schema in **every phase that adds or changes an RPC/schema**—at minimum H1A, H1D1, and H1D2 if its revoke/grant migration changes the generated surface; never hand-edit generated database types. Each phase runs `supabase gen types` against its own clean replayed local schema, diffs the exact artifact in that PR, and proves every newly typed route/client compiles before merge.
- **H1A:** `apps/web/src/lib/supabase/public.ts` and a new colocated test. Its public factory must return generated `SupabaseClient<Database>` without `unknown`, `any`, or a call-site cast. The named early, deferred-semantic/link, and no-store-feed adapters must compile directly against generated RPC signatures and use `.rpc(name,args,{get:true})`, query-level `AbortSignal.timeout(5_000)`, `.retry(false)`, and the existing `resolveStorefrontReadResult` error discipline. Each adapter maps only explicit `found-compatible | found-neutral | unbound | unavailable/integrity-failure` outcomes; no auto-retry, POST RPC, uncancelled `Promise.race`, or nullable-error cache producer is allowed. Remove the matching `cached-data.ts` `as unknown as` bridge when the generated signature replaces its call; if an unrelated bridge remains, the phase plan must list it as out of scope rather than silently depending on it.
- **H1A:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-launch-products.ts` and colocated test, routing its existing `selectOgabasseyLaunchProducts` implementation through the extracted pure selector with byte-identical order, full descriptions, URL inputs, and fallback behavior.

Treat all future filenames/counts as tentative: start from P0-recovered merged #3077, reconcile local and linked ledgers, then allocate free strictly increasing timestamps after the exact tail, splitting every slice before 300 lines and updating fixtures. Preserve applied #3077 files byte-for-byte; never reuse an occupied local or remote version.

Phase ownership is normative even though this H1A/H1D section documents the final combined interface. H1A may create inert substrate rows/types; H1D1 first creates/routes the publication evaluator/context/RPC compatibility path; H1D2 alone revokes columns, closes context-free writers, and applies final grants. Migration-contract tests fail on later-phase behavior landing early.

**Named SQL/TypeScript interface contract — freeze these names before the first migration**

```sql
public.get_storefront_home_critical_generation_state(p_merchant_id uuid)
RETURNS TABLE(
  control_state text,
  render_mode text,
  safety_generation text,
  confirmed_safety_generation text,
  content_generation text,
  shared_shell_content_generation text,
  required_renderer_epoch text,
  required_renderer_digest text,
  required_critical_shell_contract_version integer,
  committed_renderer_epoch text,
  committed_renderer_digest text,
  committed_critical_shell_contract_version integer,
  snapshot_state text,
  current_snapshot_id uuid,
  current_public_safety_proof_revision text,
  control_row_version text
)

public.get_storefront_public_safety_proof_v1(
  p_requested_identifier text,
  p_merchant_id uuid,
  p_expected_safety_generation text,
  p_expected_public_safety_proof_revision text
) RETURNS jsonb

public.get_storefront_home_critical_snapshot(
  p_merchant_id uuid,
  p_requested_identifier text,
  p_expected_control_state text,
  p_expected_render_mode text,
  p_expected_safety_generation text,
  p_expected_public_safety_proof_revision text,
  p_expected_content_generation text,
  p_expected_shared_shell_content_generation text,
  p_expected_renderer_epoch text,
  p_expected_renderer_digest text,
  p_expected_critical_shell_contract_version integer
) RETURNS jsonb

public.get_storefront_home_critical_semantic_snapshot(
  p_merchant_id uuid,
  p_requested_identifier text,
  p_expected_control_state text,
  p_expected_render_mode text,
  p_expected_safety_generation text,
  p_expected_public_safety_proof_revision text,
  p_expected_content_generation text,
  p_expected_shared_shell_content_generation text,
  p_expected_renderer_epoch text,
  p_expected_renderer_digest text,
  p_expected_critical_shell_contract_version integer,
  p_expected_home_lcp_fingerprint text,
  p_expected_home_semantic_fingerprint text,
  p_expected_home_crawlable_links_fingerprint text,
  p_expected_home_critical_fingerprint text,
  p_expected_shared_shell_fingerprint text,
  p_expected_static_document_closure_digest text,
  p_expected_home_document_fingerprint text
) RETURNS jsonb

public.get_ogabassey_home_feed_v1(
  p_requested_identifier text,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 12
) RETURNS TABLE(
  id uuid,
  name text,
  canonical_absolute_href text,
  price_minor text,
  currency text,
  image_url text,
  image_alt text,
  category_name text,
  created_at timestamptz
)

public.claim_due_storefront_content_reconciliations_v1(
  p_worker_release_row_version text,
  p_worker_id text,
  p_delivery_release_sha text,
  p_destination_contract_version integer,
  p_renderer_epoch text,
  p_renderer_digest text,
  p_critical_shell_contract_version integer,
  p_cache_protocol_version integer,
  p_cache_protocol_digest text,
  p_limit integer default 1,
  p_lease_seconds integer default 60
) RETURNS TABLE(
  merchant_id uuid,
  target_dirty_revision text,
  renderer_epoch text,
  renderer_digest text,
  critical_shell_contract_version integer,
  claim_token uuid,
  row_version text,
  lease_expires_at timestamptz
)

public.release_storefront_content_reconciliation_v1(
  p_merchant_id uuid,
  p_claim_token uuid,
  p_expected_row_version text,
  p_retry_at timestamptz,
  p_sanitized_error_code text
) RETURNS TABLE(
  merchant_id uuid,
  state text,
  row_version text,
  next_attempt_at timestamptz
)

public.get_storefront_home_reconcile_input(
  p_merchant_id uuid,
  p_mode text,
  p_expected_safety_generation text,
  p_expected_dirty_revision text,
  p_renderer_epoch text,
  p_renderer_digest text,
  p_critical_shell_contract_version integer
) RETURNS jsonb

public.compare_and_commit_storefront_home_snapshot(
  p_merchant_id uuid,
  p_mode text,
  p_expected_safety_generation text,
  p_expected_dirty_revision text,
  p_renderer_epoch text,
  p_renderer_digest text,
  p_critical_shell_contract_version integer,
  p_expected_current_snapshot_id uuid,
  p_expected_control_row_version text,
  p_home_lcp_public_payload jsonb,
  p_home_semantic_public_payload jsonb,
  p_home_crawlable_links_public_payload jsonb,
  p_shared_shell_public_payload jsonb,
  p_home_lcp_fingerprint text,
  p_home_semantic_fingerprint text,
  p_home_crawlable_links_fingerprint text,
  p_home_critical_fingerprint text,
  p_shared_shell_fingerprint text,
  p_static_document_closure_digest text,
  p_home_document_fingerprint text,
  p_reconciliation_claim_token uuid,
  p_expected_reconciliation_row_version text,
  p_provider_work_id uuid,
  p_provider_claim_token uuid
) RETURNS TABLE(
  outcome text,
  changed_scope text,
  transition_action text,
  committed_safety_generation text,
  committed_content_generation text,
  committed_snapshot_id uuid,
  committed_shared_shell_content_generation text,
  committed_shared_shell_fingerprint text,
  committed_home_lcp_fingerprint text,
  committed_home_semantic_fingerprint text,
  committed_home_crawlable_links_fingerprint text,
  committed_home_critical_fingerprint text,
  committed_static_document_closure_digest text,
  committed_home_document_fingerprint text,
  successor_required boolean,
  stage_id uuid,
  work_id uuid,
  carried_work_id uuid,
  row_version text,
  control_row_version text
)

public.enqueue_storefront_renderer_reconciliation_batch(
  p_sweep_id uuid,
  p_after_merchant_id uuid default null,
  p_limit integer default 100
) RETURNS TABLE(
  merchant_id uuid,
  enqueued boolean,
  next_cursor uuid,
  sweep_complete boolean
)

public.get_storefront_renderer_reconciliation_sweep_status_v1(
  p_owner_kind text,
  p_operation_id uuid,
  p_sweep_id uuid,
  p_expected_sweep_row_version text default null,
  p_after_merchant_id uuid default null,
  p_limit integer default 100
) RETURNS TABLE(
  owner_kind text,
  operation_id uuid,
  sweep_id uuid,
  sweep_row_version text,
  merchant_id uuid,
  renderer_epoch text,
  renderer_digest text,
  critical_shell_contract_version integer,
  current_release_match boolean,
  current_is_published boolean,
  visibility_policy text,
  transition_action text,
  stage_id uuid,
  obligation_id uuid,
  work_id uuid,
  target_state text,
  cache_canary_terminal boolean,
  activation_readiness text,
  readiness_reason text,
  row_version text,
  next_cursor uuid,
  all_targets_activation_ready boolean,
  all_targets_terminal boolean
)

public.get_storefront_publication_eligibility_v1(p_merchant_id uuid)
RETURNS TABLE(
  is_eligible boolean,
  missing_codes text[]
)

public.set_merchant_publication_state_with_transition(
  p_merchant_id uuid,
  p_is_published boolean,
  p_mutation_id uuid
 ) RETURNS TABLE(
  control_mode text,
  mutation_id uuid,
  transition_id uuid,
  target_safety_generation text,
  expected_is_published boolean
)

public.get_storefront_safety_mutation_status(p_mutation_id uuid)
RETURNS TABLE(
  mutation_id uuid,
  transition_id uuid,
  target_safety_generation text,
  expected_is_published boolean,
  current_is_published boolean,
  state text,
  covered_by_transition_id uuid,
  row_version text
)

-- H1D1-only compatibility signature; H1D2 drops/hard-disables the
-- p_state_already_applied=true surface and retains only context-owning mutation.
eventing.apply_storefront_publication_mutation_v1(
  p_merchant_id uuid,
  p_expected_current_state boolean,
  p_target_state boolean,
  p_mutation_id uuid,
  p_actor_id uuid,
  p_state_already_applied boolean
) RETURNS TABLE(
  control_mode text,
  mutation_id uuid,
  transition_id uuid,
  target_safety_generation text,
  expected_is_published boolean
)

eventing.ensure_storefront_cache_transition_v1(
  p_transition_id uuid,
  p_merchant_id uuid
) RETURNS TABLE(
  domain_event_id uuid,
  queue_message_id text,
  obligation_id uuid,
  created_event boolean,
  coalesced boolean
)

public.route_storefront_cache_transition_v1(
  p_queue_message_id text,
  p_domain_event_id uuid
) RETURNS TABLE(
  delivery_id uuid,
  archived boolean,
  already_routed boolean
)

public.route_pending_storefront_cache_transitions_v1(
  p_worker_id text,
  p_limit integer,
  p_worker_release_sha text,
  p_ingress_contract_version integer
) RETURNS TABLE(
  queue_message_id text,
  domain_event_id uuid,
  obligation_id uuid,
  delivery_id uuid,
  already_routed boolean
)

public.read_non_storefront_domain_events_v2(
  p_visibility_timeout_seconds integer default 60,
  p_batch_size integer default 100,
  p_max_poll_seconds integer default 5
) RETURNS TABLE(
  msg_id text,
  read_ct integer,
  enqueued_at timestamptz,
  visible_at timestamptz,
  message jsonb
)

public.claim_non_storefront_event_deliveries_v2(
  p_batch_size integer,
  p_worker_id text,
  p_lease_seconds integer default 60
) RETURNS TABLE(
  id uuid,
  domain_event_id uuid,
  destination text,
  payload jsonb,
  claim_token uuid,
  attempt_number integer,
  claimed_at timestamptz
)

public.claim_cache_invalidation_work(
  p_worker_id text,
  p_limit integer,
  p_lease_seconds integer,
  p_destination_class text,
  p_worker_release_sha text,
  p_destination_contract_version integer,
  p_renderer_epoch text,
  p_renderer_digest text,
  p_critical_shell_contract_version integer,
  p_cache_protocol_version integer,
  p_cache_protocol_digest text
) RETURNS SETOF jsonb

public.claim_storefront_routing_stage_bindings_v1(
  p_parent_work_id uuid,
  p_expected_parent_version text,
  p_enable_operation_id uuid,
  p_bootstrap_revision text,
  p_worker_id text,
  p_worker_release_sha text,
  p_limit integer default 8,
  p_lease_seconds integer default 45
) RETURNS SETOF jsonb

public.stage_storefront_routing_stage_binding_v1(
  p_stage_binding_id uuid,
  p_lease_token uuid,
  p_expected_binding_version text,
  p_expected_global_identity_version text,
  p_readback_digest text
) RETURNS TABLE(
  stage_binding_id uuid,
  state text,
  row_version text,
  staged_at timestamptz
)

public.release_storefront_routing_stage_binding_v1(
  p_stage_binding_id uuid,
  p_lease_token uuid,
  p_expected_binding_version text,
  p_reason text
) RETURNS TABLE(
  stage_binding_id uuid,
  state text,
  row_version text
)

public.complete_storefront_routing_identity_obligation_v1(
  p_parent_work_id uuid,
  p_parent_claim_token uuid,
  p_expected_parent_version text,
  p_identity_obligation_id uuid,
  p_lease_token uuid,
  p_expected_version text,
  p_identity_version text,
  p_applied_outcome jsonb
) RETURNS TABLE(
  identity_obligation_id uuid,
  state text,
  row_version text,
  identity_version text,
  applied_at timestamptz
)

public.release_storefront_routing_identity_obligation_v1(
  p_parent_work_id uuid,
  p_parent_claim_token uuid,
  p_expected_parent_version text,
  p_identity_obligation_id uuid,
  p_lease_token uuid,
  p_expected_version text,
  p_sanitized_reason_code text
) RETURNS TABLE(
  identity_obligation_id uuid,
  state text,
  row_version text,
  identity_version text
)

public.claim_storefront_edge_config_write_lease_v1(
  p_edge_config_id text,
  p_holder_kind text,
  p_holder_id text,
  p_expected_worker_release_row_version text default null,
  p_operation_id uuid default null,
  p_compatibility_contract_version integer default null,
  p_lease_seconds integer default 30
) RETURNS TABLE(
  edge_config_id text,
  lease_token uuid,
  row_version text,
  lease_expires_at timestamptz
)

public.complete_storefront_edge_config_write_lease_v1(
  p_edge_config_id text,
  p_lease_token uuid,
  p_expected_row_version text,
  p_expected_digest text,
  p_proven_item_set_digest text
) RETURNS TABLE(
  edge_config_id text,
  row_version text,
  last_proven_digest text,
  released_at timestamptz
)

public.release_storefront_edge_config_write_lease_v1(
  p_edge_config_id text,
  p_lease_token uuid,
  p_expected_row_version text,
  p_sanitized_reason_code text
) RETURNS TABLE(
  edge_config_id text,
  row_version text,
  next_attempt_at timestamptz
)

public.complete_cache_invalidation_work(
  p_work_id uuid,
  p_claim_token uuid,
  p_expected_version text,
  p_expected_worker_release_row_version text,
  p_worker_release_sha text,
  p_provider_outcome jsonb,
  p_canary_outcome jsonb
) RETURNS TABLE(
  state text,
  row_version text,
  confirmed_safety_generation text,
  covered_receipt_count integer,
  covered_renderer_predecessor_count integer,
  conflicted_receipt_count integer
)

public.retry_cache_invalidation_work(
  p_work_id uuid,
  p_claim_token uuid,
  p_expected_version text,
  p_expected_worker_release_row_version text,
  p_worker_release_sha text,
  p_stage text,
  p_sanitized_error_code text,
  p_next_attempt_at timestamptz
) RETURNS TABLE(
  state text,
  row_version text,
  attempts_in_cycle integer,
  total_attempts text,
  next_attempt_at timestamptz
)

public.transfer_cache_invalidation_obligations(
  p_from_work_id uuid,
  p_from_claim_token uuid,
  p_to_work_id uuid,
  p_expected_from_version text,
  p_expected_to_version text,
  p_expected_worker_release_row_version text,
  p_worker_release_sha text
) RETURNS TABLE(
  transferred boolean,
  from_state text,
  from_row_version text,
  to_row_version text,
  obligation_count integer
)

public.set_storefront_routing_v2_activation(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_routing_operation_id uuid,
  p_authority_mode text,
  p_bootstrap_revision text,
  p_expected_control_row_version text,
  p_expected_operator_receipt_row_version text,
  p_expected_safety_generation text,
  p_expected_row_version text,
  p_enabled boolean,
  p_reader_contract_version integer,
  p_reader_first_sha text,
  p_activated_release_sha text
) RETURNS TABLE(
  merchant_id uuid,
  operation_id uuid,
  routing_operation_id uuid,
  authority_mode text,
  bootstrap_revision text,
  control_row_version text,
  operator_receipt_row_version text,
  previous_row_version text,
  row_version text,
  enabled boolean,
  reader_contract_version integer,
  reader_first_sha text,
  activated_release_sha text,
  activated_at timestamptz
)

public.finalize_storefront_routing_v2_bootstrap_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_bootstrap_revision text,
  p_expected_control_row_version text,
  p_expected_operator_receipt_row_version text,
  p_expected_activation_row_version text,
  p_expected_safety_generation text,
  p_edge_config_write_lease_token uuid,
  p_expected_edge_config_write_lease_row_version text,
  p_staged_identity_readbacks jsonb,
  p_edge_activation_readback_digest text,
  p_edge_live_readback_digest text
) RETURNS TABLE(
  merchant_id uuid,
  operation_id uuid,
  control_row_version text,
  operator_receipt_row_version text,
  activation_row_version text,
  receipt_state text,
  resumed_work_id uuid,
  resumed_work_row_version text,
  applied_identity_count integer
)

public.reset_storefront_routing_v2_bootstrap_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_reset_operation_id uuid,
  p_routing_deactivation_operation_id uuid,
  p_expected_bootstrap_revision text,
  p_expected_control_row_version text,
  p_expected_operator_receipt_row_version text,
  p_expected_activation_row_version text,
  p_expected_safety_generation text,
  p_edge_deactivation_readback_digest text,
  p_edge_live_absence_readback_digest text
) RETURNS TABLE(
  merchant_id uuid,
  operation_id uuid,
  reset_operation_id uuid,
  routing_deactivation_operation_id uuid,
  previous_bootstrap_revision text,
  bootstrap_revision text,
  control_row_version text,
  operator_receipt_row_version text,
  activation_row_version text,
  receipt_state text,
  resumed_work_id uuid,
  resumed_work_row_version text,
  superseded_stage_count integer
)

public.get_storefront_routing_v2_bootstrap_reset_status_v1(
  p_reset_operation_id uuid
) RETURNS TABLE(
  reset_operation_id uuid,
  operation_id uuid,
  routing_deactivation_operation_id uuid,
  merchant_id uuid,
  previous_bootstrap_revision text,
  bootstrap_revision text,
  control_row_version text,
  operator_receipt_row_version text,
  activation_row_version text,
  receipt_state text,
  resumed_work_id uuid,
  resumed_work_row_version text,
  superseded_stage_count integer,
  edge_deactivation_readback_digest text,
  edge_live_absence_readback_digest text,
  input_digest text,
  committed_at timestamptz,
  is_current_bootstrap_revision boolean
)

public.get_storefront_routing_v2_activation_status_v1(
  p_routing_operation_id uuid
) RETURNS TABLE(
  routing_operation_id uuid,
  operation_id uuid,
  authority_mode text,
  merchant_id uuid,
  bootstrap_revision text,
  input_digest text,
  control_row_version text,
  operator_receipt_row_version text,
  previous_row_version text,
  row_version text,
  enabled boolean,
  reader_contract_version integer,
  reader_first_sha text,
  activated_release_sha text,
  activated_at timestamptz,
  committed_at timestamptz,
  is_current_bootstrap_revision boolean
)

public.resolve_storefront_routing_identity_v2(
  p_requested_identifier text
) RETURNS TABLE(
  normalized_identity text,
  identity_kind text,
  identity_version text,
  outcome text,
  merchant_id uuid,
  canonical_slug text,
  routing_mode text
)

public.activate_storefront_cache_worker_release_v1(
  p_operation_id uuid,
  p_expected_worker_row_version text,
  p_template_key text,
  p_expected_renderer_epoch text,
  p_expected_renderer_digest text,
  p_expected_critical_shell_contract_version integer,
  p_expected_cache_protocol_version integer,
  p_expected_cache_protocol_digest text,
  p_next_renderer_epoch text,
  p_next_renderer_digest text,
  p_next_critical_shell_contract_version integer,
  p_next_cache_protocol_version integer,
  p_next_cache_protocol_digest text,
  p_router_release_sha text,
  p_ingress_contract_version integer,
  p_delivery_release_sha text,
  p_destination_contract_version integer,
  p_protocol_rotation_id uuid default null
) RETURNS TABLE(
  operation_id uuid,
  worker_row_version text,
  router_release_sha text,
  ingress_contract_version integer,
  delivery_release_sha text,
  destination_contract_version integer,
  renderer_epoch text,
  renderer_digest text,
  critical_shell_contract_version integer,
  cache_protocol_version integer,
  cache_protocol_digest text,
  sweep_id uuid,
  sweep_required boolean
)

public.begin_storefront_cache_protocol_rotation_v1(
  p_operation_id uuid,
  p_expected_worker_row_version text,
  p_expected_protocol_version integer,
  p_expected_protocol_digest text,
  p_next_protocol_version integer,
  p_next_protocol_digest text
) RETURNS TABLE(
  rotation_id uuid,
  operation_id uuid,
  state text,
  row_version text
)

public.mark_storefront_cache_protocol_rotation_drained_v1(
  p_rotation_id uuid,
  p_expected_row_version text
) RETURNS TABLE(
  rotation_id uuid,
  state text,
  old_protocol_live_work_count text,
  non_disabled_control_count text,
  row_version text
)

public.get_storefront_cache_protocol_rotation_status_v1(
  p_rotation_id uuid
) RETURNS TABLE(
  rotation_id uuid,
  state text,
  old_protocol_live_work_count text,
  non_disabled_control_count text,
  cursor_merchant_id uuid,
  row_version text
)

public.abort_storefront_cache_protocol_rotation_v1(
  p_rotation_id uuid,
  p_expected_row_version text,
  p_reason text
) RETURNS TABLE(
  rotation_id uuid,
  state text,
  row_version text
)

public.record_event_worker_release_heartbeat_v2(
  p_worker_name text,
  p_worker_id text,
  p_status text,
  p_processed_count integer,
  p_error_code text,
  p_release_sha text,
  p_ingress_contract_version integer,
  p_destination_contract_version integer,
  p_ingress_enabled boolean,
  p_delivery_enabled boolean,
  p_renderer_epoch text,
  p_renderer_digest text,
  p_critical_shell_contract_version integer,
  p_cache_protocol_version integer,
  p_cache_protocol_digest text
) RETURNS void

public.set_storefront_critical_control_state_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_expected_control_row_version text,
  p_expected_worker_release_row_version text,
  p_target_state text
) RETURNS TABLE(
  merchant_id uuid,
  operation_id uuid,
  control_state text,
  control_row_version text,
  worker_release_row_version text,
  transition_id uuid,
  target_safety_generation text,
  promotion_sweep_owner_kind text,
  promotion_sweep_owner_operation_id uuid,
  promotion_sweep_id uuid
)

public.finalize_storefront_critical_control_enable_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_expected_control_row_version text,
  p_expected_worker_release_row_version text,
  p_expected_routing_activation_row_version text,
  p_expected_safety_generation text
) RETURNS TABLE(
  merchant_id uuid,
  control_state text,
  control_row_version text,
  worker_release_row_version text,
  routing_activation_row_version text,
  confirmed_safety_generation text
)

public.finalize_storefront_critical_control_disable_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_expected_control_row_version text,
  p_expected_worker_release_row_version text,
  p_expected_routing_activation_row_version text,
  p_expected_safety_generation text
) RETURNS TABLE(
  merchant_id uuid,
  control_state text,
  control_row_version text,
  worker_release_row_version text,
  routing_activation_row_version text,
  confirmed_safety_generation text
)

public.set_storefront_critical_render_mode_v1(
  p_merchant_id uuid,
  p_operation_id uuid,
  p_expected_control_row_version text,
  p_expected_worker_release_row_version text,
  p_promotion_sweep_owner_kind text,
  p_promotion_sweep_owner_operation_id uuid,
  p_promotion_sweep_id uuid,
  p_render_mode text
) RETURNS TABLE(
  merchant_id uuid,
  operation_id uuid,
  render_mode text,
  control_row_version text,
  worker_release_row_version text,
  transition_id uuid,
  target_safety_generation text,
  promotion_sweep_owner_kind text,
  promotion_sweep_owner_operation_id uuid,
  promotion_sweep_id uuid
)

public.get_storefront_critical_operator_transition_status_v1(
  p_operation_id uuid
) RETURNS TABLE(
  operation_id uuid,
  merchant_id uuid,
  operation_kind text,
  expected_control_state text,
  expected_render_mode text,
  expected_is_published boolean,
  transition_id uuid,
  target_safety_generation text,
  state text,
  covered_by_transition_id uuid,
  current_control_state text,
  current_render_mode text,
  current_safety_generation text,
  confirmed_safety_generation text,
  routing_bootstrap_revision text,
  routing_activation_operation_id uuid,
  routing_activation_enabled boolean,
  routing_activation_row_version text,
  promotion_sweep_owner_kind text,
  promotion_sweep_owner_operation_id uuid,
  promotion_sweep_id uuid,
  row_version text
)

public.list_cache_invalidation_dead_letters(
  p_limit integer default 50,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
) RETURNS TABLE(
  work_id uuid,
  merchant_id uuid,
  target_class text,
  target_generation text,
  stage text,
  sanitized_error_code text,
  attempts_in_cycle integer,
  total_attempts text,
  operator_requeues integer,
  row_version text,
  created_at timestamptz
)

public.requeue_cache_invalidation_dead_letter(
  p_work_id uuid,
  p_expected_version text,
  p_operator_id uuid,
  p_operator_reason text
) RETURNS TABLE(
  work_id uuid,
  state text,
  row_version text,
  attempts_in_cycle integer,
  total_attempts text,
  operator_requeues integer,
  next_attempt_at timestamptz
)

public.resolve_cache_invalidation_dead_letter(
  p_work_id uuid,
  p_expected_version text,
  p_covering_work_id uuid,
  p_operator_id uuid,
  p_operator_reason text
) RETURNS TABLE(
  work_id uuid,
  state text,
  row_version text,
  covering_work_id uuid,
  resolved_at timestamptz
)
```

`storefront_routing_v2_activation_operations` is immutable, RLS-enabled, and has no public grants. It is keyed by caller-generated `routing_operation_id` and binds parent operation, merchant, authority mode, bootstrap revision, desired enabled state, canonical input digest, old/new row versions, typed result, and commit time. `authority_mode` is exactly `bootstrap_enable | bootstrap_reset | control_drain`: enable requires `bootstrap_enable`, control `enabling`, exact enable receipt `routing_staged`, and `enabled=true`; bootstrap deactivation requires `bootstrap_reset`, control still `enabling`, the same enable receipt `routing_reset_required`, exact current revision, and `enabled=false`; ordinary/emergency deactivation requires `control_drain`, control `draining`, exact disable receipt, and `enabled=false`. Cross-mode operation/receipt reuse is rejected. The operation record is checked before live versions, so byte-identical replay returns its committed result after later changes; mismatch rejects. Status returns explicit typed authority/input/result columns. The CLI persists ids and recovers only by exact replay/status.

A control-enable receipt also owns canonical-text `routing_bootstrap_revision`, initially `0`. Every staged identity child, staged readback, routing-activation operation, and bootstrap finalizer is bound to that exact revision. Any publication, slug, alias, domain, or other safety-generation mutation while `control_state=enabling` locks the control, enable receipt, routing activation, parent work, and staged children in the normal global order before advancing safety state. If routing activation has never committed for the current revision and the activation row is disabled, the mutation atomically invalidates/supersedes the old staged evidence, advances `routing_bootstrap_revision` once, records `routing_stage_invalidated_before_activation`, moves the receipt to `pending`, and makes the latest parent due; multiple mutations before restaging coalesce into that revision. If activation may have committed—or the activation row is enabled—the mutation preserves the newest safety/identity work but moves the receipt to `routing_reset_required`, invalidates `cache_complete`, parks unclaimed parent work, and prevents old-generation completion/finalization. Further mutations coalesce while reset is required.

The operator persists caller-generated `routing_deactivation_operation_id` and `reset_operation_id` before any reset side effect. It performs the Edge-first atomic deactivation/tombstone PATCH under the shared lease, proves distributed live-v2 absence, then exact-replays or status-recovers the `bootstrap_reset` DB deactivation CAS before calling `reset_storefront_routing_v2_bootstrap_v1`. `storefront_routing_v2_bootstrap_reset_operations` is immutable, RLS-enabled, and has no public grants; it binds reset id, enable operation, merchant, old revision, deactivation operation/result row versions, both readback digests, canonical input digest, exact typed result, and commit time. Reset checks it before live versions: byte-identical replay returns the prior result after later rows advance; mismatch rejects id reuse. First execution validates disabled activation, supersedes only this parent's old stage bindings/readbacks, advances revision once, records evidence, and moves the receipt to bootstrap-only `pending`. Status returns `input_digest`, `committed_at`, and `is_current_bootstrap_revision`; recovery with `false` returns the historic result but commands the CLI to stop and stage the newest revision, never continue the old one. Lost responses use replay/status only. `routing_staged|routing_reset_required` remain generic-claim-ineligible.

Before every bootstrap Edge write, the pre-provider routing-child lease rechecks control state, receipt state, and bootstrap revision; the generic delivery remains unclaimed and mutable throughout this stage. A routing-child lease bound to an invalidated revision may finish an in-flight read but may not reacquire the Edge-store lease, start another Edge side effect, write a live signal, or advance the receipt. Only after the exact bootstrap finalizer may the provider lane first claim the generic delivery; before every purge, prewarm, canary, or completion side effect that frozen generic claim rechecks control, receipt, and revision. A provider call already in flight after a later mutation may finish only as non-authoritative audit; its completion CAS is rejected and the one successor owns final proof. The bootstrap finalizer requires exact `p_bootstrap_revision`; mismatch returns typed `BOOTSTRAP_CHANGED` and status directs reset/resume rather than deadlock.

The renderer-sweep aggregate contract is exact and is evaluated over one locked/versioned scan. Every sweep has immutable `owner_kind = release_activation | merchant_enrollment`, `owner_operation_id`, renderer tuple, and scope: a release-owned sweep is bound to exactly one worker-release activation receipt and may contain the fleet; an enrollment-owned sweep is bound to exactly one control-enable operator receipt and exactly its merchant. A check constraint/FK pair requires the matching owner receipt and forbids both/neither. The status RPC requires the exact owner kind + operation + sweep triple, authorizes against the matching receipt, rejects a cross-kind id even when UUIDs collide, and returns only that sweep's scope. `all_targets_activation_ready=true` only when every in-scope target is one of: `cache_terminal` for `direct_cache`, `ready_stage` for a published `promotion_required` target, or `ready_deferred_unpublished` for an unpublished `promotion_required` target; any `not_ready`, `superseded`, abandoned, or dead-letter target makes it false. `all_targets_terminal=true` is stricter and means every target is `completed/cache_terminal`; it is mandatory for all-direct sweeps, especially forward `1→0` cleanup, but is not expected for a mixed shell-1 sweep whose promotion-required targets intentionally remain staged. Tests cover both owner kinds, cross-kind/operation/merchant denial, mixed direct/staged/deferred release targets, single-merchant enrollment, all-direct cleanup, page-version restart, and a late failure making both aggregates false.

Every text state above is constrained to the enumerations in this plan and parsed through a one-primary-export Zod schema before use. Every **new H1** PostgreSQL `bigint` that crosses PostgREST/JavaScript—generation, revision, epoch, row version, queue id, price-minor value, or lifetime attempt count—is exposed and accepted as canonical unsigned decimal `text` (`0|[1-9][0-9]*`), range-checked and cast inside the SQL function; JavaScript never parses it to `number`. Internal tables and comparisons remain `bigint`. Contract tests include values above `Number.MAX_SAFE_INTEGER` and reject signs, whitespace, leading zeroes, decimals, and overflow. The one temporary exception is #3077's pre-existing `read_domain_events_v1` return signature, which must remain `msg_id bigint` for stale-binary compatibility; its replacement raises/alerts before returning an id above `Number.MAX_SAFE_INTEGER`, excludes storefront events entirely, and has zero updated-worker call sites. V2 returns canonical text, and retirement of v1 is a required follow-up before that bound can be approached. `claim_cache_invalidation_work` returns one exact `StorefrontCacheInvalidationClaim` JSON object per row: work/merchant ids, class, actual changed scope plus non-narrowing required document scope, frozen target generation/revision/renderer epoch/digest/shell version, the complete `homeLcpFingerprint`/`homeSemanticFingerprint`/`homeCrawlableLinksFingerprint`/`homeCriticalFingerprint`/nullable `sharedShellFingerprint`/`staticDocumentClosureDigest`/`homeDocumentFingerprint` tuple, cache-protocol and canary-manifest version/digest, claim token/version/lease, **activated worker-release row version + delivery SHA + destination contract**, immutable OLD+NEW semantic identity/outcome children, separately bounded identity-home and canonical-document target arrays, kind-scoped Cloudflare URL/host/prefix/header obligations, exact Vercel tags, `attemptsInCycle`, canonical-text `totalAttempts`, retry/provider timestamps, and a bounded `globalIdentityClaims` array. Each array entry is exactly either `leased` with `{ identityObligationId, leaseToken, rowVersion, identityVersion }` or `covered` with `{ identityObligationId, rowVersion, identityVersion, appliedOutcomeDigest }`; no raw merchant row or secret is returned. Provider/canary JSON inputs have separate exact schemas and bounded sizes; arbitrary JSON keys are rejected in SQL and TypeScript.

The enabled-state parent claim and global identity leases are one database transaction. For each candidate parent, `claim_cache_invalidation_work` locks the parent and its required current global identity obligations in canonical `(identity_kind, normalized_identity, identity_version, id)` order, validates matching already-applied coverage, and normalizes every expired child before it mutates the parent: expiry is a predicate, not a physical state, so a row remains `leased` until the locked transaction CASes exact expired `leased -> pending`, clears worker/token/lease fields, and advances row version; a stale-version/outcome row becomes `superseded` instead. It then leases every remaining `pending` child. A database constraint requires `pending|applied|superseded` to have null lease owner/token/expiry and requires `leased` to have all three non-null. If any required child is actively leased by another parent or worker—including an earlier candidate returned by the same batch—or cannot be locked, the candidate is skipped with **no parent lease, token, attempt increment, or frozen target**; it remains due for a later pass. The returned `globalIdentityClaims` is the complete exact child set, not a hint. Completion/release of a leased entry requires its own child token, row version, and identity version plus the still-live parent generic claim token; release performs `leased -> pending`, clears all lease fields, and advances row version. A covered entry is immutable evidence and cannot be completed or released. If parent A holds a shared child, parent B remains wholly unclaimed; after A commits the same-version outcome, B may claim using covered evidence. Bootstrap staging remains separate: it leases only per-parent stage bindings and reads the global version without acquiring an enabled-state global lease. Both its binding claim and finalizer accept global truth only when it is matching `applied` coverage or physically `pending`; an actively leased global makes the binding candidate/finalizer return typed `GLOBAL_IDENTITY_BUSY` without mutating the global, binding, receipt, or parent. An expired `leased` global is recoverable by the finalizer only under its exact live operator Edge-write lease: the finalizer first CASes it to clean `pending`, then may apply it from the exact same-version/outcome distributed readback. It never clears a live token or accepts a `pending` row carrying token residue. Tests cover all state/nullability constraints, A/B contention in both claim orders and in one `p_limit=2` batch, bootstrap-before-enabled and enabled-before-bootstrap races, already-applied coverage, child expiry/reclaim from physical `leased`, global-version advance, no parent lease while blocked, complete/release token isolation, and no purge before the full child set is owned or covered.

`eventing.ensure_storefront_cache_transition_v1` is the only **claimable** provider-work constructor. Safety/control calls it inside their source transaction because their maximum duty is known. Ordinary content calls it only from the successful `advanced` compare-and-commit transaction after output scope is derived; dirty triggers and reconciliation claims never call it. With the merchant/class target locked, it materializes/deduplicates every persisted identity purge duty. Safety under shell `0` or `1` always unions the exact four-entry canonical manifest with up to eight identity-home targets and deduplicates canonical home for at most eleven fetch targets. Ordinary ready shell `0` and shell `1` both require the versioned compatible `shared_shell` assertion on all four canonical documents. A safety obligation that absorbs or inherits any uncompleted `shared_shell_cleanup` duty must instead materialize the four cleanup assertions with old-marker absence plus restored shell-0 shared-marker/home-outcome proof; only additional identity targets retain their identity-specific assertions, and canonical-home deduplication must satisfy both. `shared_shell` and `shared_shell_cleanup` content canaries use exactly four canonical documents; `home_content` uses one home. It enforces eight identity children, eight identity homes, exact manifest digest/cardinality, class-specific `<=11 | =4 | =1` fetch cardinality, and `8 core + 3 per identity <=32` tags before source mutation/event commit. A platform slug may yield both subdomain and path homes, both counted. It inserts one specialized pending obligation plus one trusted ledger/PGMQ event only when no mutable unclaimed obligation exists; the sole exception is non-claimable shell-1 `promotion_staged` with no event. Pre-route/routed-unclaimed mutations update the same coalescible target and attach receipts; after the first generic claim freezes it, later mutations create/coalesce exactly one successor. Claim construction re-materializes the arrays and rechecks every bound under the frozen protocol. Tests assert no orphan event, no event/lease/attempt/generic delivery on `promotion_staged`, and no cleanup absorption that narrows the four-document absence proof.

`storefront_critical_operator_receipts` makes control/render operations exact and idempotent. `operation_id uuid` is caller-generated and unique; reuse is legal only for the same merchant, operation kind, and expected state/mode/publication tuple. The receipt state enum is `pending | routing_staged | routing_reset_required | cache_complete | final_cache_pending | completed | covered | superseded_conflict | dead_letter`. `set_storefront_critical_control_state_v1` and `set_storefront_critical_render_mode_v1` insert the receipt and attach it through the same transition machinery—there is **no non-coalescible second provider obligation**. The specialized obligation's `promotion_staged` state is the one pre-event exception: a renderer sweep may persist exactly one shell-1 shared-shell staging row keyed by merchant plus renderer epoch while `render_mode=degraded`; it has no operator receipt yet, `domain_event_id`, PGMQ row, generic delivery, lease, attempt, retry clock, or worker claim. The caller-generated `promote-render` CAS must atomically insert/replay its pending operator receipt, set `render_mode=permanent`, bind that receipt to the exact staging row, convert the row to an ordinary pending specialized obligation, and insert its one ledger/PGMQ event. A crash before commit leaves degraded rendering and the same parked stage; a crash after commit leaves one durable receipt/event pair. Pre-route/routed-preclaim operations then coalesce into the one mutable work/event; post-claim operations use the one successor/event. The receipt retains its exact target generation and expected outcome even when work coalesces. Publication/identity mutations that preserve the expected operator outcome may cover it; a later conflicting render-mode/control/publication operation marks it `superseded_conflict`, never silently successful. Precedence is fail-closed: `draining` overrides any pending permanent-promotion receipt; degradation can be covered by later draining/disabled no-Hero state; permanent promotion captures `expected_is_published=true` and conflicts with a later unpublish; no operation can promote while `enabling|draining|disabled`. During first enablement the worker may advance the receipt only to `routing_staged` after compatibility-v1/v2 records and the snapshot are read back while every live-v2 signal remains absent; operator activation/live-signal readback then releases the same work for document purge and public canaries. Cache/canary completion marks ordinary render operations `completed`; a control-enable receipt becomes `cache_complete` until its exact finalizer succeeds. A control-disable receipt becomes `cache_complete` after the draining outcome, `final_cache_pending` when the finalizer makes legacy rendering visible and enqueues its post-CAS duty, and `completed` only after that final legacy outcome is purged and canaried. `get_storefront_critical_operator_transition_status_v1` is service-role/operator-only and is the only wait/read interface; CLI polling keys by `operation_id`, verifies the immutable transition id/target generation, and never polls “latest.” SQL concurrency tests cover promote→suppress, promote→unpublish, suppress→drain, publication coalescing, operation-id replay/mismatch, renderer-sweep `promotion_staged` parking and atomic receipt/event release, bootstrap death at every `routing_staged`/`routing_reset_required`/activation/cache-complete/final-cache-pending handoff, post-final-CAS mutation, process death/provider failure, pre/post-claim races, covered versus conflict, dead letter, and one-successor/zero-orphan invariants.

The promotion sweep triple is explicit end to end and is distinct from the new render-mode `p_operation_id`. For `disabled -> enabling` under shell contract `1`, `set_storefront_critical_control_state_v1` atomically persists and returns `promotion_sweep_owner_kind='merchant_enrollment'`, `promotion_sweep_owner_operation_id=<enable operation_id>`, and the exact enrollment `promotion_sweep_id`; the operator receipt status returns that same immutable triple so a lost response is recoverable. Shell-0 enablement and non-enable control operations return all three null. `set_storefront_critical_render_mode_v1(..., 'permanent')` requires all three non-null, constrains owner kind to `release_activation | merchant_enrollment`, locks/authorizes the matching owner receipt/sweep/merchant/current renderer target, and rejects a stale, cross-owner, cross-merchant, abandoned, or already-consumed target before changing render mode. `set_storefront_critical_render_mode_v1(..., 'degraded')` requires all three null so suppression cannot accidentally consume a stage. Its return and new render receipt echo/persist the validated triple for audit/replay. SQL and CLI tests cover enable-response loss recovered from status, fleet and enrollment promotion, null/all-or-none enforcement, owner-operation UUID collision across kinds, stale/higher-epoch target, cross-merchant denial, and suppression with no triple.

`route_storefront_cache_transition_v1` is the only per-event router for that internal event. It locks the queued ledger and matching obligation, validates exact event name, producer/trust, queue id, merchant, and transition linkage, inserts one `event_deliveries(destination='storefront_cache_transition')` row, binds its id to the obligation, marks the ledger routed, and archives that exact PGMQ message in one idempotent transaction. A route retry returns the same delivery and `already_routed=true`; missing/mismatched obligation is retryable and can become a linked **storefront-ingress** dead letter that drives the receipt to control-plane failure. `route_pending_storefront_cache_transitions_v1` is the bounded, `SKIP LOCKED` batch wrapper used by the existing domain-router process; it verifies the DB-authoritative router SHA/contract before invoking the per-event router. This specialized batch can run when analytics routing is disabled without reading, leasing, archiving, or incrementing `read_ct` for unrelated PGMQ messages. The generic external `resolveEventRoute`/`route_domain_event_v1` registry remains limited to its four provider destinations.

Ingress isolation is symmetric. With P0-recovered merged #3077 as the immutable baseline, H1 adds `read_non_storefront_domain_events_v2` with the same v1 columns/order/lifecycle except for the versioned `msg_id bigint -> canonical decimal text` change, plus a DB predicate excluding linked storefront messages before lease/read-count mutation. The same append-only migration preserves v1's exact signature while adding that exclusion so stale generic routers cannot touch storefront work. The updated generic lane calls v2; the specialized lane uses only `route_pending_storefront_cache_transitions_v1`. Concurrent SQL/process tests prove shape parity, zero cross-lane leases/read-count changes, no unrelated specialized lease, and bounded route-to-claim latency.

`claim_non_storefront_event_deliveries_v2` is the append-only production replacement for #3077's unfiltered `claim_event_deliveries_v1`: it preserves the v1 return shape and lifecycle but SQL-excludes `destination = 'storefront_cache_transition'` from both due and expired-lease candidates. The same new append-only migration also `CREATE OR REPLACE`s v1 with that exclusion while preserving its exact signature/return shape, so a stale pre-H1 delivery worker cannot steal storefront rows during rollout. The updated worker's standard lane must call v2; v1 remains only for backward binary compatibility and has zero repository production call sites after H1. A static scan plus concurrent SQL test proves v1/v2 can never claim storefront work, and `claim_cache_invalidation_work` can never claim a non-storefront delivery.

The storefront claim uses the same text worker id (`hostname:pid`) as #3077's generic claims and heartbeats. It compares supplied delivery SHA/destination contract, renderer epoch/digest/shell version, and cache-protocol version/digest with the DB-authoritative activated release row; a stale/mismatched worker receives no claim. The ingress batch independently compares router SHA/ingress contract. Both services emit `record_event_worker_release_heartbeat_v2` with exact source-checkout SHA, relevant capability versions/digests, effective flags, and renderer capability triple. Entering `control_state=enabling` fails unless both heartbeats are fresh, exact, match the same activated release row, and prove ingress/delivery enabled; entering `draining` remains available for emergency shutdown. In `enabling|enabled|draining`, and in `disabled` while `final_disable_transition_id IS NOT NULL`, the control row—not a web flag—is the sole mutation/enqueue gate: later worker outage leaves durable pending work and alerts. Only `disabled + final_disable_transition_id IS NULL` selects legacy. Claim freezes the activated release row version/SHA/contracts into work. Complete and retry compare that frozen release with the still-active DB row in the same lifecycle CAS; transfer additionally requires the source delivery's exact still-active `p_from_claim_token`, while the destination is fenced by its expected unclaimed row version. A release-only R2 whose renderer triple **and** complete cache-protocol closure are byte-identical may reject late R1 writes, wait for lease expiry, and reclaim/repeat that same frozen obligation. That permission does not extend to a renderer change.

For a same-protocol **renderer-changing** activation, `activate_storefront_cache_worker_release_v1` performs one set-based transactional handoff before publishing R2: it retargets every mutable, unclaimed R1 obligation to the new release/renderer and, for every claimed or renderer-frozen/retry R1 obligation, creates or unions exactly one R2 successor per merchant/class with an immutable predecessor link and the exact superset of OLD+NEW identities, typed public targets, URLs, tags, receipts, and outcome duties. The pre-event `promotion_staged` row is deliberately **not** a renderer-frozen claim and never enters this generic successor path: a higher-epoch/shell change terminally invalidates that parked row under the same lock without creating a generic delivery, skipped predecessor, successor, or domain event; the new sweep then applies the normal renderer-pair rule, so a `1→0` rollback creates exactly one `shared_shell_cleanup` event and no inherited promotion event. A claimed predecessor keeps its lease and blocks its successor until that lease expires; a retry predecessor with no live lease can unblock immediately. The old worker rechecks release authority before every remaining side effect and every late lifecycle write is rejected. R2 never reclaims, rebuilds, or completes the old-renderer claim, and neither the generic nor specialized claim API returns a linked predecessor. The successor's one `complete_cache_invalidation_work` call supplies the terminal provider/canary evidence while its claim is still active and, in the same transaction, verifies the active R2 release plus server-proven obligation/outcome superset, completes the successor, maps every linked predecessor's physical generic row to `skipped`, and records specialized `superseded|covered`. It covers an attached receipt only when the receipt's expected outcome is still true; a conflict remains `superseded_conflict`. There is no post-completion RPC that tries to reuse a cleared claim token. Recovery after process death resumes the durable successor/predecessor links after lease expiry and never skips early. A cache-protocol-changing release remains stricter: it cannot activate while any R1 work exists and uses the explicit drain barrier below. The returned claim includes generic delivery/event identity, token/attempt/version, and atomically frozen specialized obligation/release/protocol so generic audit and cache CAS operations correlate exactly.

The authenticated publication boundary is the database RPC, not the route's preflight. `get_storefront_publication_eligibility_v1` and the mutation RPC share one private evaluator and the exact missing-code enum `store_url | identity_verification | bank_account | payment_method | country | contact | active_product`. Atomicity uses one private transaction-advisory lock namespace keyed by merchant id with one universal order: **lock affected merchant rows first in sorted UUID order, then acquire their advisory locks in the same order, then read/write eligibility sources**. Publish locks its merchant row, acquires the advisory lock, and re-evaluates slug/country/contact/bank/Paystack fields, `merchant_verifications.nin_verified|bvn_verified|cac_verified`, `merchant_feature_settings.paystack_enabled|korapay_enabled|pay_on_delivery_enabled`, and active-product existence in one snapshot immediately before mutation. Direct merchant-field updates naturally take the tuple lock first; triggers then take the advisory lock. Related-table insert/update/delete triggers lock the affected merchant rows then advisory locks before commit; merchant-id moves and bulk statements use sorted distinct OLD+NEW ids. No path may take advisory then merchant-row lock. A new evaluator source cannot land without entering this lock/trigger matrix and its static completeness test. Tests use bounded lock timeouts to prove direct merchant update versus publish and each related-table race serialize in both start orders without deadlock. A concurrent unverify/payment-disable/product-deactivate therefore serializes before publish and fails eligibility or after the committed publish—never races silently. Unpublish requires permission but no launch eligibility. The API route may call the eligibility RPC first for friendly UX, but that result is advisory; a direct authenticated PostgREST RPC cannot bypass the atomic recheck. Backend read failure is control-plane failure, never a missing-item result.

`eventing.apply_storefront_publication_mutation_v1` is the one private mutation primitive. Its SECURITY DEFINER wrapper creates an unforgeable one-use row in private `eventing.storefront_publication_mutation_contexts`, keyed by transaction id + merchant + mutation id + cryptographic nonce and containing exact old/new publication values. The table has RLS, no API exposure, and `REVOKE ALL` from anon, authenticated, and service_role; only the owning definer and guarded trigger can insert/read/delete it. In the same transaction the wrapper inserts context, updates the merchant, and the SECURITY DEFINER trigger atomically matches and deletes exactly one token before creating receipt/generation/identity/work; absence, mismatch, reuse, cross-merchant use, or multiple matching tokens raises and rolls back. Custom GUCs, session variables, temporary tables, connection-local flags, and caller-supplied “trusted” booleans are forbidden because pooled/service-role sessions could forge or leak them. Freeze timestamps: false→true sets transaction time, true→false preserves it, replay/no-op is byte-equal. H1D1 alone retains the gated context-free old-server branch while all controls are final-disabled+null and creates no receipt/generation/work; H1D2 closes it, migrates every repository/VPS/internal/service-role writer to the normal wrapper, revokes direct columns, and drops/hard-disables `state_already_applied=true`. Final tests attempt anon/authenticated/service-role forge, nonce reuse, cross-merchant reuse, wrong target values, pooled-session reuse, trigger-only UPDATE, and wrapper rollback, plus normal publish/unpublish/no-op/replay/opposite-state behavior.

The public mutation RPC returns exactly `control_mode`, `mutation_id`, nullable `transition_id`, nullable `target_safety_generation`, and `expected_is_published`. Its branch is frozen inside the same transaction: absent/no control row or `control_state='disabled' AND final_disable_transition_id IS NULL` updates only the merchant and returns `control_mode='legacy'` with the input mutation id and null transition/generation—no control row, receipt, generation advance, identity child, or delivery work. `enabling|enabled|draining` and `disabled` with a non-null final-disable transition all remain `control_mode='fenced'`; they perform receipt insertion/attachment, the required safety-generation/identity action, and `ensure_storefront_cache_transition_v1` atomically. Failure to create newly required ledger/PGMQ work aborts the whole mutation. During `enabling`, `draining`, and final-cache-pending disabled, the state-specific routing/render contract remains no-permanent-Hero, so identity/publication changes cannot split the planes. In the fenced v1 branch, a repeated client `p_mutation_id` is idempotent only when merchant and requested state match, and reuse with different inputs is rejected. A **new** v1 UUID requesting an already-current state still inserts its own immutable receipt row for that supplied UUID. If matching work is pending, the alias attaches to that exact transition without generation/event advance; if the current target is already terminal and still true, the new receipt is immediately `covered` by the completed current transition/baseline with server-proven obligations, again with zero generation/event/provider work. The response/status always echoes the caller's UUID, never substitutes an older receipt id. For a fenced legacy-body call with no client UUID, the RPC instead locks the merchant and atomically resolves a DB-generated legacy action id: repeated same-merchant/same-desired-state calls with no intervening opposite action reuse the one live or latest terminal matching receipt and never advance generation/enqueue again; a unique constraint plus row lock prevents concurrent duplicates. An opposite desired-state action conflicts/supersedes the prior receipt and creates one new legacy action id; a later return to the original state is therefore a new action. In the absent/final-disabled+null branch the UUID remains correlation/echo only and synchronous desired-state write/purge is safely repeatable. The status RPC applies the same tenant permission boundary and cannot expose another merchant's receipt.

Publication ACL closure is a two-deployment cutover, never “schema first and hope.” H1D1 adds the lock/evaluator, guarded trigger, RPC, new route, and clients while temporarily preserving the existing authenticated publication-column grant so a pre-H1 binary remains functional during fleet overlap. The guarded trigger applies the same eligibility invariant to that old direct update and, because all controls remain disabled, creates no fenced work; the old route still owns synchronous legacy eviction. After the H1D1 exact marker is coherent on every browser/Googlebot canary and deployment logs/fixtures prove no old direct-update binary remains, H1D2 applies a later append-only migration that revokes authenticated `merchants.is_published`/`published_at`, replaces broad UPDATE with the exact safe column set, and makes the RPC the only user-facing mutation path. Control cannot enter `enabling` before H1D2 succeeds. Runtime tests cover old-server/new-H1D1-schema, new-server/H1D1-schema, new-server/H1D2-schema, and reject old-server/H1D2 as an unsupported rollback unless the forward compatibility migration has first restored the exact safe legacy grant/path. Real JWT/PostgREST tests prove direct updates fail only after H1D2, intended non-publication columns still work, eligible publish succeeds, every missing-code publish fails without state/generation/event change, unpublish succeeds with permission, and cross-merchant/staff-without-permission calls fail.

```ts
type StorefrontPublicationMutationTarget =
  | {
      mode: 'legacy';
      mutationId: string;
      expectedIsPublished: boolean;
    }
  | {
      mode: 'fenced';
      mutationId: string;
      transitionId: string;
      targetSafetyGeneration: string;
      expectedIsPublished: boolean;
    };

type StorefrontSafetyMutationState =
  | 'pending'
  | 'retry_wait'
  | 'completed'
  | 'covered'
  | 'superseded_conflict'
  | 'dead_letter';
```

Put the runtime response/status schemas in `packages/shared` because both web and mobile clients consume them. Keep database adapters and service-role types inside `apps/web`. No implementation PR may rename or widen an RPC ad hoc; change this catalog and its contract tests first.

The shared mutation request is a strict discriminated union: legacy `{}` or v1 `{ propagationContractVersion: 1, mutationId: uuid }`. Treat a truly absent/empty legacy body as `{}`; malformed non-empty JSON is `400`, never silently legacy. New web/mobile clients generate one UUID per user action and reuse it only for a transport retry of the same desired state. During mixed deployment, an absent version passes a null client mutation id so the database creates/reuses the fenced legacy action id under the locked contract above; the route must not mint a fresh UUID on every retry. Old clients retain only `200` after exact-receipt completion or named non-2xx pending/failure semantics—never `202`, because current old clients treat any 2xx as fully live. V1 clients receive the full `200/202/409/503` response union and their own UUID replay identity; fenced legacy clients receive DB-backed same-action replay even though they cannot poll a status URL.

**H1A review slices — implement and review in this order**

1. **H1A-1 schema/ACL skeleton:** substrate tables, RLS, immediate revoke-after-create rule, and non-publication exact projection/grant sweep; publication receipt tables may be inert, but publication evaluator/RPC/trigger/grant cutover is forbidden; red SQL tests first.
2. **H1A-2 snapshot/fingerprint:** executable renderer-contract source manifest, raw input, deterministic TypeScript builder, one immutable generation with separate early-LCP/shared-shell and deferred-semantic/link payload columns, the complete LCP/semantic/link/critical/shared/static/document fingerprint tuple, all narrow anon-safe generation-checked projections, and compare-and-commit; red source-drift/race/fingerprint/projection tests first.
3. **H1A-3 delivery extension/operator receipts/triggers:** #3077 destination mapping, ensure/coalesce semantics, frozen specialized obligations, exact router/delivery release fences, destination-filtered claim/lease support, operator/control receipts, dirty matrix, and non-publication OLD+NEW identity triggers; user-facing publication eligibility/mutation/ACL closure remains H1D1/H1D2; red concurrency tests first.
4. **H1A-4 operator controls/public adapters:** dead-letter RPCs, shared response schemas, H1A-local clean-replay Supabase type regeneration/diff, and exact consumer contract tests. H1D1 repeats type regeneration after adding publication RPCs before its typed routes/clients can merge; H1D2 repeats it whenever its final schema/ACL surface changes generated output.

Each slice is a separately reviewable commit with its focused tests green. H1A does not contain the user-facing publication cutover and cannot enable OgaBassey. H1D1 later adds evaluator/primitive/guarded publication trigger/RPC/receipt routing under temporary grants; H1D2 alone revokes direct publication columns, applies the exact final safe-column grant sweep, and makes enablement legal.

The H1A base renderer manifest has `criticalShellContractVersion: 0` and exactly these semantic entrypoints after the pure selector extraction:

```text
src/lib/ogabassey-home-critical-public-payload.ts
src/lib/ogabassey-home-semantic-public-payload.ts
src/lib/ogabassey-home-lcp-fingerprint.ts
src/lib/ogabassey-home-semantic-fingerprint.ts
src/lib/ogabassey-home-critical-fingerprint.ts
src/lib/ogabassey-launch-product-selection.ts
src/lib/ogabassey-home-hero-resource-hint-projection.ts
src/lib/storefront-home-semantic-graph.ts
src/components/storefront/ogabassey/components/build-launch-slides.ts
src/schemas/storefront-home-critical-public-snapshot.ts
src/schemas/storefront-home-critical-semantic-snapshot.ts
src/config/ogabassey-home-renderer-contract.ts
```

H1C2 must deliberately bump the still-shell-0 renderer epoch/digest and extend that same manifest before its final phase gate with these final visible-output entrypoints:

```text
src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.tsx
src/app/(storefront)/ogabassey/ogabassey-home-semantic-snapshot-marker.tsx
src/app/(storefront)/ogabassey/ogabassey-home-hero-resource-hints.ts
src/app/(storefront)/ogabassey/ogabassey-home-document-snapshot.ts
src/app/(storefront)/ogabassey/ogabassey-static-home-page-content.tsx
src/app/(storefront)/ogabassey/ogabassey-home-page-content.tsx
src/app/(storefront)/ogabassey/ogabassey-home-dynamic-content.tsx
src/components/storefront/ogabassey/components/Hero.tsx
src/components/storefront/ogabassey/pages/home.tsx
```

Its raw `structuralOwners` are `src/app/(storefront)/[slug]/(home)/page.tsx` and `src/app/(storefront)/[slug]/(home)/ogabassey-static-home-page.tsx`; its CSS `assetEntrypoints` include `src/app/(storefront)/storefront-home-critical.css`. These owners make marker/Hero/semantic ordering, request-guard placement, exact identifier flow, and critical utility discovery part of the executable shell-0 contract rather than untracked component behavior. H1C2 remains non-activating: every merchant control is still final-disabled+null while this renderer successor is installed. The later H0R-H1 rollout may enable OgaBassey only against this final H1C2 epoch/digest; it may never enable the smaller H1A base manifest.

The verifier parses TypeScript/TSX/JSON runtime `import` and `export ... from` edges, resolves relative paths and tsconfig aliases, and walks the complete transitive closure. Bare imports are never blindly excluded: pnpm-workspace packages (especially `@baci/shared/storefront`, which owns `effectiveLaunchPins`/`selectLaunchProducts`) resolve through package exports to exact source. True external runtime packages enter an exact locked dependency manifest; unresolved imports fail. Only `import type` and Node built-ins are omitted. The manifest also supports explicit `structuralOwners` whose raw bytes are hashed and CSS `assetEntrypoints`; CSS bytes are hashed and local `@import`/Tailwind `@source` edges are resolved recursively, with missing/out-of-root/dynamic edges failing closed. There are no glob roots or ignored runtime/assets. H2 must replace the H1 route/render entrypoints with its route metadata, critical-shell style/content, canonical non-product semantic builder, and `ogabassey-static-shell-layout.tsx` entrypoints; retain every still-consumed payload/fingerprint/schema and deferred semantic-render source; add structural owners for `[slug]/layout.tsx` and `(home)/page.tsx`; and retain the split critical-CSS facade plus both imported CSS assets. Import-graph tests prove the structural owners delegate every H2 permanent byte and deferred semantic byte to the covered graph and prove only the obsolete live semantic-construction path is unreachable. `criticalShellContractVersion` is part of the digest: H1/restored-H1 is `0`; H2 is `1`. H2 sets `1`, bumps epoch/digest, deploys matching worker source, activates/reconciles, then promotes before a permanent Hero can appear. An unrelated app deploy with an identical manifest leaves the worker release row untouched.

Renderer-manifest mutation tests are phase-local. H1A mutates only its then-existing builder/projection/schema/config closure. H1C2 adds and mutates the final shell-0 render owners, route structural owners, markers, Hero, and critical CSS listed above. Only H2 may name or mutate H2-created route-resolution/static-layout/critical-content files. Therefore references below to H2 structural owners, `ogabassey-static-shell-layout.tsx`, parent-layout branches, or the H2 permanent component graph apply to the H2 manifest successor—not to H1A or an earlier H1 phase. A phase gate fails if its manifest names a source that does not exist in that phase or omits a source that owns the phase's emitted critical bytes.

- [ ] First write a failing complete-output fingerprint contract around the actual pinned-slug configuration, launch/recent selectors, slide and resource-hint builders, page metadata/WebPage/H1/Hero bytes, full shell-0 semantic builder, shell-1 non-inventory semantic builder, bounded crawlable-link builder, product-free shared-shell builder, critical CSS/source graph, fixed feed-skeleton/client-island server markup, and every other byte that can enter the completed anonymous home HTML/RSC object. Add a reviewed monotonic `rendererContractEpoch` and `rendererContractDigest` plus a checked-in renderer manifest covering normalized semantic entrypoints, structural owners, CSS/assets, client-boundary server markup, resolved source closure, and locked external dependencies. `staticDocumentClosureDigest` is the SHA-256 of that manifest's canonical subset for immutable code/config-owned home bytes; it changes with any static skeleton, server client-stub, analytics-config, critical CSS, or serialization change not represented by data projections. `--check` is default/CI; deliberate `--write` accompanies epoch/digest bump. Commit one immutable generation with: (a) early LCP plus shared-shell payloads and their digests; (b) deferred semantic plus at-most-24 crawlable-link payloads and their digests; (c) `homeCriticalFingerprint = SHA-256(canonical JSON {version:2,criticalShellContractVersion,homeLcpFingerprint,homeSemanticFingerprint,homeCrawlableLinksFingerprint})`; and (d) `homeDocumentFingerprint = SHA-256(canonical JSON {version:1,homeCriticalFingerprint,sharedShellFingerprint,staticDocumentClosureDigest})`. Renderer epoch/digest/shell version sit beside—not ambiguously inside—the data digests. Shell 0's semantic digest covers the exact current graph including Product/Offer/availability; shell 1's semantic digest covers the dedicated non-inventory graph and must not recursively delete every CollectionPage. Both shells compute `sharedShellFingerprint` over every emitted product-free theme/header/navigation/footer/base-head/static-config byte and render those bytes only from the immutable projection. Both shells compute the crawlable-link digest over the deterministic `created_at DESC, id ASC` name+canonical-href projection. The no-store feed/client-personalization boundary serializes zero data rows/config secrets into initial HTML/RSC and is verified by the whole-object closure test. Scope selection is explicit: stable shell-0 code/data changes use `home_content` or `shared_shell`; stable shell-1 permanent changes do the same; shell0→shell1 parks one `promotion_staged` shared duty while degraded; shell1→shell0 creates non-narrowable `shared_shell_cleanup`. A shared change subsumes home. Any LCP, semantic, link, or document-composite-only change advances one generation and creates/coalesces one exact-home duty; a shared-shell change selects all-document work. H1/H2 requests consume only the committed projections, so no live header/footer/overlay/feed/analytics byte can mix generations. Publication, merchant id, and canonical ownership remain safety inputs. The consumer map names every field that can affect each digest, including H1 `products.updated_at` graph ordering and both-shell `created_at` Hero/link ordering.
- [ ] Interpret the renderer and digest sentences above with render-mode precedence: `shell1→shell1` selects claimable `shared_shell` only for a renderer-changing target whose output is already permanent. A higher-epoch shell-1 activation while currently degraded/suppressed initializes that sweep target as `awaiting_promotion` and creates the same zero-event `promotion_staged` output as initial `0→1`; the prior successful sweep stays closed, and only the new epoch/sweep reopens promotion readiness. For an unchanged renderer in stable degraded shell 1 with no live/awaiting promotion and no inherited cleanup duty, a home and/or shared **data** digest change is `snapshot_only`, because neither permanent digest is present in the rendered shell; it never selects claimable home/shared work merely from the data-scope label. An existing home/shared duty is carried only if already degraded/content-null; a permanent-proof duty blocks the snapshot commit until transfer or terminal completion.
- [ ] Derive a conservative SQL **dirty-input + completed-document consumer matrix** from every field that can affect `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, or `homeDocumentFingerprint`. Label each field `home_lcp | home_semantic | home_links | shared_shell` or an exact union and mechanically compare the active renderer import/consumer graph. Both shells classify theme, base metadata, product-free header/navigation/footer, and static analytics/config inputs as `shared_shell`; page-owned metadata and Hero bytes are `home_lcp`; graph inputs follow the active semantic builder; selected crawlable-link status/name/slug/category/`created_at` are `home_links`. Explicitly classify `products.created_at` for Hero and link membership/order under both shells and `products.updated_at` as shell-0 semantic because the current recent-product graph orders/limits by it. Add insert/update/order/limit-boundary tests. H1 shell 0 keeps stock/manage-stock/inventory/order quantity/availability/product-significant-link inputs positive when the full graph emits them. In H2, only after the non-inventory graph is committed, non-Hero price/image/stock/order-quantity/`updated_at` feed-only mutations are negative because the no-store feed owns them; selected-link status/name/slug/category/`created_at` remain positive, as do identity/contact/address/social/trust/topical/blog/category/navigation fields emitted by graph or shared shell. Prove shared changes select all-document work; LCP-, semantic-, or link-only changes select exact-home work; simultaneous shared/home changes select one shared transition covering home; and a feed-only change alters neither committed digest nor root work. The raw completed-object test mutates every mapped source and requires either an updated fingerprint/purge duty or byte-identical cached HTML/RSC with the new value available only through the no-store endpoint. Any future builder/layout/metadata/client-stub dependency change updates its projection, fingerprints, consumer matrix, renderer manifest/static closure digest, and positive/negative tests in the same PR.
- [ ] Classify metadata by **emitted document ownership**, not by source column wholesale: parent/base metadata bytes are `shared_shell`; page-owned home metadata bytes are `home_lcp`; a source feeding both is labeled both. Positive scope tests mutate each page-owned home field and require exact-home work, mutate each parent/base field and require all-document work, and mutate a shared source to require the conservative shared-shell superset. No compatible/permanent metadata byte may sit outside the component/composite plus shared-shell fingerprint union.
- [ ] Add a singleton/template-keyed `storefront_renderer_contract_requirements` row with DB-authoritative required epoch, digest, and critical-shell contract version. Activation is monotonic and compare-and-swap: it rejects a non-increasing epoch, an unexpected previous contract, or a digest/shell-version pair that does not match the deployed caller's reviewed manifest.
- [ ] Add a per-merchant control row with `safety_generation bigint`, `confirmed_safety_generation bigint`, `content_dirty_revision bigint`, `reconciled_dirty_revision bigint`, `content_generation bigint`, `shared_shell_content_generation bigint`, `snapshot_safety_generation bigint`, committed renderer epoch/digest/critical-shell contract version, `shared_shell_fingerprint text`, `home_lcp_fingerprint text`, `home_semantic_fingerprint text`, `home_crawlable_links_fingerprint text`, `home_critical_fingerprint text`, `static_document_closure_digest text`, `home_document_fingerprint text`, a current immutable-snapshot pointer, nullable `final_disable_transition_id uuid`, `control_state` constrained to `disabled | enabling | enabled | draining`, and `render_mode` constrained to `degraded | permanent`. `content_generation` identifies the one current immutable snapshot and both public views; component fingerprints may never advance separately. `shared_shell_content_generation` identifies the content generation that most recently changed route-wide shared-shell output and is carried forward unchanged across home-only commits. This separate pointer is mandatory because a home-only transition must not make cached category/PDP/blog markers falsely stale. `confirmed_safety_generation` is monotonic and may advance only when the worker atomically completes every routing/purge/canary obligation for that exact safety claim; it never advances merely because work was queued or a provider call returned, and it is never consulted to admit compatible render bytes. Render admission instead requires a snapshot committed for the exact current safety generation plus current control/render/renderer compatibility. Seed OgaBassey `disabled/degraded` with a null final-disable transition.
  - `disabled -> enabling`: the operator CAS requires fresh matching workers but no pre-existing snapshot/routing activation. It enters the fenced lane, advances safety generation, and ensures the first transition/reconciliation; rendering stays degraded. The same worker process's **bootstrap routing sublane** claims only current-revision routing-stage bindings through `claim_storefront_routing_stage_bindings_v1`, builds the snapshot, stages/readbacks compatibility-v1 + v2 while activation/live signals are absent, marks the receipt `routing_staged`, and clears only those routing-child leases. The generic delivery was never claimed: it remains physical `pending` with null token/lease and zero attempts and is SQL-excluded from `claim_cache_invalidation_work`. The operator CAS-enables routing, atomically PATCHes v2+activation+live, waits/proves the distributed boundary, and the exact finalizer records `routing_resumed`; only then does the generic claim predicate permit the first provider claim and freeze the target plus its complete global-child lease/coverage set. That worker purges/prewarms/canaries through live v2 to `cache_complete`, then the enable finalizer may CAS `enabling -> enabled`. There is no bootstrap worker authority to write activation/live state, no generic thaw/reset, and no document provider work before `routing_resumed`.
    Before this CAS changes state, the database materializes the complete current semantic identity/home-target/tag duty with the same protocol builder and rejects enablement if any `8`-child, `8`-typed-home-target, or `32`-tag ceiling would be exceeded. No worker/enqueue-time check may be the first place that discovers an already-enabled merchant is unrepresentable.
    When the active renderer target is shell contract `1`, the same `disabled -> enabling` transaction also creates/replays a merchant-scoped renderer sweep with immutable `owner_kind=merchant_enrollment`, `owner_operation_id=<enable operation_id>`, an FK to that exact control-enable receipt, and one `promotion_required/awaiting_promotion` target for the exact current renderer tuple. It does not reopen or mutate a completed `owner_kind=release_activation` fleet sweep and emits no provider event. The bootstrap reconciliation creates/refreshes this enrollment target's stage under the same zero-event contract; promotion accepts only the merchant's current live release-owned or enrollment-owned target and passes the exact owner kind/operation/sweep triple to the locked status/validation path. A re-enable under the same renderer creates a new enrollment generation after the prior disabled lifecycle, because the old completed target cannot prove the newly seeded snapshot. A partial enable/disable or retry resumes the same operation-scoped target; a higher renderer abandons it. A partial unique constraint permits only one live promotion target for `(merchant_id, renderer_epoch, renderer_digest, critical_shell_contract_version)`. Tests enable a merchant after the H2 fleet sweep closed, deny cross-kind/cross-operation lookup, disable/re-enable under the same shell-1 renderer, replay the enable operation, race a higher epoch, and prove a stage exists before promotion while zero event exists before the promotion CAS.
  - `enabling | enabled -> draining`: the emergency disable CAS is legal from either source and atomically sets degraded/draining, creates the drain receipt/barrier, and keeps all mutations fenced. From `enabling`, it marks the unfinished enable receipt `superseded_conflict`, abandons the enrollment promotion target/stage with zero promotion event, and records whether any bootstrap activation operation may have committed; it never drops the newest safety/identity obligations. Parked `routing_staged` or `routing_reset_required` work cannot block entry to draining. The operator always executes the idempotent Edge-first activation-false/tombstone boundary: if no activation operation ever committed, exact DB plus distributed live-signal absence is the terminal no-op proof; if activation committed or its response was lost, immutable activation status supplies the exact committed row version and compensation is mandatory. After distributed proof, the replay-safe DB deactivation CAS and existing drain/final-disable sequence apply. Ordinary catalog/metadata writes still advance dirty revision for later recovery but park content reconciliation and enqueue no new content provider work while draining; the drain barrier may mark older content-only duties `covered` after the neutral no-Hero purge. The operator waits until current safety is confirmed and no live pre-disable safety/routing/publication receipt remains, then calls `finalize_storefront_critical_control_disable_v1`. That finalizer requires routing disabled, confirmed=current safety, no live pre-disable safety work, and older content duties completed/covered; it CASes `draining -> disabled`, sets non-null `final_disable_transition_id`, advances the receipt to `final_cache_pending`, and atomically ensures one final-disabled provider obligation/event. Enqueue failure rolls back the state CAS. Workers and flags remain on until the final legacy purge/canary clears the id and completes the receipt. Tests begin the abort from `pending`, `routing_staged`, `routing_reset_required`, DB-activated-before-Edge, Edge-applied-before-finalizer, and `cache_complete`.
  - Only `disabled` **with `final_disable_transition_id is null`** uses legacy synchronous eviction and creates no receipt/delivery work. `enabling|enabled|draining` and post-CAS disabled-final-cache-pending remain durable/fenced. A never-enabled disabled row has a null id and performs no control-plane work. Re-enable always forces reconciliation from the latest dirty revision before permanent render can be promoted.
  - The neutral no-Hero purge may cover only ordinary home/shared content whose visible duty it actually subsumes. It may not cover a `shared_shell_cleanup` predecessor unless the drain/final safety obligation non-narrowingly carries that exact cleanup duty, deletes the shared-shell tags, materializes canonical home/category/PDP/blog as `shared_shell_cleanup`, and passes all four marker-absence proofs plus the publication/control-discriminated home outcome. A generic shell-0 safety marker or identity-only success is never cleanup evidence.
  - `set_storefront_critical_render_mode_v1` is the only render-mode writer: it is service-role/operator-only, CASes the control and active worker-release versions, requires `control_state=enabled`, and enters the exact operator-receipt/coalescing lifecycle defined below. Promotion to `permanent` additionally requires active/committed shell contract `1`, a current compatible snapshot, and the exact non-claimable `promotion_staged` row for that renderer epoch. In one transaction it inserts/replays the operator receipt, changes render mode, converts the stage to a claimable `shared_shell` obligation, and creates its sole domain event; failure rolls back all four effects. The worker may purge/prewarm/canary only after that commit and may complete the promotion receipt only after the exact permanent home/category/PDP/blog outcomes pass. Degradation is always allowed and, under shell contract `1`, selects ordinary shared-shell all-document work so cached nested markers become degraded too. While degraded, the early public view emits the enabled `snapshotState=degraded` no-Hero shape and the semantic view emits its matching non-rendering state even if a compatible immutable snapshot remains stored. This emergency Hero suppression lane leaves fenced publication mutations, routing v2, workers, and snapshot reconciliation enabled.
- [ ] Add one DB-authoritative `storefront_cache_worker_release_requirements` row with CAS version, exact router SHA/ingress contract, delivery SHA/destination contract, renderer epoch/digest/critical-shell contract version, and cache-protocol version/digest, plus durable `storefront_renderer_reconciliation_sweeps` and per-merchant sweep targets for every renderer change, immutable `storefront_worker_release_activation_receipts`, and `storefront_cache_protocol_rotations` for protocol-changing drains. Every sweep stores the immutable owner union defined above: `release_activation` requires the matching activation receipt and allows fleet targets; `merchant_enrollment` requires the matching control-enable receipt and exactly one merchant target. `activate_storefront_cache_worker_release_v1` requires caller `p_operation_id` and atomically records the complete expected/next/release/protocol/rotation tuple plus returned row version/sweep id. First execution CASes the worker release, cache protocol, and renderer requirement: an unchanged exact renderer triple is a release-only activation with no renderer sweep; a changed renderer contract requires a strictly increasing epoch, transactionally performs the old-work retarget/successor handoff defined above, and inserts one resumable `release_activation` sweep id in the same transaction. Replaying the same operation id with byte-identical inputs returns the stored exact result even after the live row version advanced; reuse with any different input is rejected. A crash before commit leaves no receipt/change and is safely retryable; a lost response after commit is recovered by replay and cannot lose or duplicate the sweep id. Sweep targets use exact `reconciling | awaiting_promotion | cache_pending | completed | dead_letter | abandoned` states and persist the server-derived `transition_action`, nullable stage id, nullable work id, row version, and terminal cache/canary evidence. A `0→1` merchant remains `awaiting_promotion` after reconciliation/stage creation; unpublish may remove its unsafe snapshot stage but cannot erase that intent. A later republish under the same still-required renderer must reconcile and recreate the exact no-event stage. The promotion CAS moves that target to `cache_pending`, records its event/work id and promotion time, and only provider/canary completion may move it to `completed`; a higher-epoch replacement marks old progress `abandoned`; suppression after a successfully promoted shell does not reopen it. A `1→0` compare commit moves its target to `cache_pending` with the exact `shared_shell_cleanup` work id, and the target cannot become completed from snapshot compatibility alone. The paginated status RPC is service-role/operator-only, requires the exact owner-kind/operation/sweep triple, validates the corresponding owner receipt and scope, returns every in-scope target's exact stage/work and terminal state, and reports `all_targets_terminal=true` only when **every target is `completed` and none is `abandoned` or `dead_letter`**; `abandoned` returns `SWEEP_SUPERSEDED`, and `dead_letter` is a surfaced hard failure. Activation aborts rather than exposing R2 if any frozen predecessor cannot be represented by the exact new-release obligation superset. If cache-protocol version/digest changes, `p_protocol_rotation_id` is mandatory and the RPC atomically requires that exact durable rotation be `drained`, every control row be final `disabled`, every old-protocol obligation/delivery/receipt/identity child be terminal/covered with no live lease/retry/dead-letter, and storefront ingress/delivery flags be effectively off. Same-protocol renderer/release activation passes `null`. A control row may enter `enabling` only through `set_storefront_critical_control_state_v1`, which requires fresh exact `domain-event-router` and `event-delivery` V2 heartbeats matching the entire row and effective flags true; neither an environment flag nor a manually supplied claim value is authority. Promotion to `render_mode=permanent` additionally requires active/committed `critical_shell_contract_version=1`; H1 or a restored-H1 release reports `0` and cannot be promoted accidentally. In every control-managed state the row remains the source mutation gate even if a worker goes down. Ingress/claim re-check release/capability on every operation, and the worker re-checks the current origin actuator protocol before any Vercel side effect. A pre-H1/mismatched router or delivery binary receives no cache work. Do not pin this row to the frequently changing web marker; unrelated app deploys with an identical cache protocol must not halt convergence. SQL concurrency tests cover both owner kinds and cross-owner denial, same-id replay, mismatched-id reuse, commit-response loss, simultaneous activation attempts, exact sweep-id recovery, 0→1 stage readiness, 1→0 cleanup pending/completed/dead-letter, and refusal to equate snapshot compatibility with cache/canary completion.
- [ ] Make sweep status a locked, versioned decision interface rather than a bag of racy fields. Every target/publication/link/state change increments the parent `sweep_row_version`. The first page accepts null expected version and returns it; every later page requires the exact same value or returns `SWEEP_CHANGED` and forces a full scan restart. In the same transaction, status locks/reads the active release, renderer tuple, merchant publication state, target, stage, and current obligation and returns `current_release_match` plus server-derived `activation_readiness = ready_stage | ready_deferred_unpublished | cache_terminal | not_ready | superseded` and a bounded reason. `ready_stage` requires published + promotion-required + exact current stage; `ready_deferred_unpublished` requires unpublished + awaiting-promotion + null stage + terminal neutral safety duty; `cache_terminal` requires the exact current renderer outcome/canaries; a tuple mismatch or abandoned target is `superseded`. The CLI consumes only this readiness enum/current-match result, never combines separate publication/release reads. Tests change publication, stage, work link, and active release between pages and require restart or superseded—not mixed-page success.
- [ ] Give each renderer sweep target a CAS-versioned `visibility_policy = direct_cache | promotion_required` plus a mutable pointer to its current specialized obligation/work. Target creation locks control then sweep target and derives policy with **target-shell precedence**. Every target whose required `critical_shell_contract_version=0` is `direct_cache`, regardless of current `render_mode`; a forward `1→0` target therefore binds one claimable `shared_shell_cleanup` obligation and becomes ready only through terminal marker-absence canaries. For target shell `1`, `permanent` chooses `direct_cache`, while `degraded` chooses `promotion_required` and initializes `awaiting_promotion` for `0→1` or suppressed higher-epoch `1→1`. Policy may change only for an unbound target-shell-1 target while `target_state=reconciling`, action unset, and stage/work null. `set_storefront_critical_render_mode_v1(...degraded)` may CAS only such a shell-1 `direct_cache` target to `promotion_required`; it can never convert or reinterpret a target-shell-0 cleanup. Compare-and-commit derives action from this locked policy. Once any action, stage, or work is bound, the policy is immutable and suppression cannot reinterpret it. This is the only race-safe re-promotion initializer after suppression and requires the new higher epoch/sweep; same-epoch suppression alone never creates a stage. Coalesce keeps the same target link; post-claim successor creation, transfer, safety absorption, and resolve-covered atomically rebind it to the exact successor/covering obligation and work while preserving every cleanup marker-absence duty. A skipped/covered predecessor can never complete the sweep by itself. Only the currently linked terminal work whose server-proven duty includes the target's exact renderer outcome may set `cache_canary_terminal` and `completed`; cleanup specifically requires the retained H2-marker-absence canaries. Any target entering `abandoned` forces both aggregate readiness flags false and status `SWEEP_SUPERSEDED` for the old operation—never vacuous success. Tests cover target-shell-0 under both render modes, suppress versus target-create/compare in both lock orders, refusal to mutate policy after stage/action/work binding, claimed cleanup transferred to a successor, cleanup absorbed by safety with the absence duty retained, skipped predecessor versus covering completion, and resumed old activation after higher-epoch abandonment.
- [ ] Before `promote-render` can convert a stage, it locks the merchant control, sweep target, stage, and specialized obligation namespace in the same global order and requires every pre-promotion ordinary home/shared/safety obligation inherited from the renderer handoff to be terminal with its degraded/current outcome. Pending, routed, claimed, retry, or dead-letter inherited work blocks promotion and finishes/requeues under its existing event; it can never cover the permanent outcome. Under that lock the promotion CAS creates the one distinct post-promotion shared-shell obligation/event, freezes `expected_render_mode=permanent`, carries forward any still-required completed-duty audit, and prevents a concurrent ordinary ensure from inserting between the zero-live check and event creation. Later mutations may coalesce/succeed only through that permanent obligation or its successor. Tests cover pending and claimed inherited shared work, retry/dead-letter/requeue, completion immediately before the CAS, and a concurrent content/safety ensure; exactly one event/canary chain must prove permanent bytes.
- [ ] Sweep-linked dead-letter recovery is explicit. The authenticated #3077 requeue CAS, when applied to the target's exact current work/row version, atomically moves generic delivery back to its existing retry lifecycle **and** moves the sweep target `dead_letter -> cache_pending` with the same obligation/work pointer and preserved renderer/cleanup outcome. If requeue creates or selects a successor, the same transaction rebinds the target as defined above. A stale/different work id cannot revive the target. Status polling resumes rather than leaving the sweep permanently failed; tests cover exact requeue, stale requeue rejection, requeued cleanup completion, and a requeued work that is later covered by a duty-preserving successor.
- [ ] Dead-lettering cache work records each attached receipt's `resume_state_before_dead_letter` from its last valid claimable phase (`pending` or `final_cache_pending`). Both `routing_staged` and `routing_reset_required` are excluded: their parents are physically unclaimed and cannot dead-letter or be requeued until audited bootstrap finalization/reset advances them to `pending`. `cache_complete` is also not resumable provider work. Requeue locks delivery, specialized work, sweep target, and receipts; validates the persisted phase against immutable operation/current state; restores only that phase; and preserves ids, generations, expected outcome, lifetime attempts, and audit. It cannot guess a caller phase or revive a conflicting receipt. Tests cover ordinary requeue, released bootstrap `pending`, denial for both parked routing states, final-cache-pending disable, stale/cross-operator denial, and crash/replay.
- [ ] Freeze the cache-protocol rotation lifecycle; immutable old claims are never reinterpreted by a new tag grammar. `storefront_cache_protocol_rotations` is keyed by one operator `operation_id` and exact old/new version+digest with `draining | drained | activated | aborted`, cursor, CAS row version, timestamps, and audit. The `rotate-cache-protocol` operator command first suppresses permanent rendering, then drains/disables every explicitly listed control-managed merchant under the still-active old web/worker/actuator protocol. It waits for current safety confirmation, final control disable **including completion/clearing of every non-null `final_disable_transition_id`**, completed/covered receipts, applied/released identity children, zero pending/routed/claimed/retry/dead-letter storefront deliveries, and expiry/recovery of every old lease; mutations during disabled-final-cache-pending remain fenced and can extend the final duty. Only final disabled+null uses the synchronous legacy lane and creates no frozen work. Only then does it CAS the rotation `drained`, turn both storefront flags off, deploy the new web protocol, install/heartbeat the new router/delivery binaries, and call release activation with the exact rotation id. After CAS it turns flags on, requires fresh exact heartbeats, and re-enables merchants through their normal bootstrap. A protocol-only release needs no renderer sweep but still needs this full drain barrier. CLI death resumes from the durable rotation cursor/id; failure before release CAS keeps/restores old web+worker protocol and may re-enable safely, while failure after CAS keeps all controls disabled and requires a forward higher protocol activation—never a backward reinterpretation. Tests cover an in-flight claim at every provider stage, lease expiry, retry/dead-letter refusal, mutation during drain and immediately after the disable finalizer CAS, CLI death before/after each boundary, old-web/new-worker and new-web/old-worker mismatch, same-protocol renderer activation without a drain, and forward rollback.
- [ ] Add one `storefront_routing_v2_activations` row per merchant. `set_storefront_routing_v2_activation` is fenced by operator/receipt/control/safety/activation/release versions plus the discriminated authority mode above. `bootstrap_enable` requires staged current identities. `bootstrap_reset` is the only legal deactivation while control remains `enabling/routing_reset_required`; `control_drain` is the only legal deactivation while `draining`. Both false modes require Edge-first proof and immutable operation replay, but neither can impersonate the other. A merchant cannot become final enabled until public canaries complete. RLS denies public access; only the service-role RPC mutates it. Tests cover every valid mode and cross-mode/operation/receipt/revision denial before Edge or DB mutation.
- [ ] Add `storefront_safety_mutation_receipts` with `mutation_id uuid primary key`, merchant/transition ids, target safety generation, expected publication state, state, optional covering transition id, compare-and-swap row version, and timestamps. A receipt follows the exact state machine above; coalescing attaches it to the existing unclaimed obligation without changing its expected state/generation, and work never destroys or retargets the receipt.
- [ ] Implement one private publication-eligibility evaluator and reuse it from both the authenticated eligibility RPC and the single mutation primitive. Freeze the exact missing-code enum and one checked-in JSON fixture matrix covering null/non-NG/NG country, the helpers' Paystack-default behavior, Paystack/Korapay/POD combinations, bank/subaccount variants, NIN/BVN/CAC verification, slug/contact/country, and active/only-inactive/no products. Vitest feeds every fixture through current `requiresNigerianKycForLaunch` + `getLaunchPaymentRequirement`; the local PostgREST/DB parity tool materializes the same fixture, calls the eligibility/mutation RPC as an authenticated actor, and requires exact ordered missing-code equality. Add the private merchant-keyed transaction-advisory lock plus statement/row triggers for every actual eligibility source; test concurrent publish versus verification, feature-setting, merchant bank/contact/country/slug, active-product, and merchant-id-move mutations in both lock orders, with sorted multi-merchant locking and no deadlock. A checkout/payment-helper or evaluator-source change cannot land without updating the fixture, lock matrix, trigger matrix, and static completeness test deliberately. Publish re-evaluates all requirements under that lock; unpublish is permission-only. H1D1 deliberately retains the legacy direct grant for old binaries but routes it through the guarded invariant; H1D2, in a later deployment after fleet-drain proof, revokes `is_published`/`published_at` and positively grants only reviewed safe merchant columns. Missing/conflicting #3112 hardening or inability to prove the H1D1 server drain blocks H1D2 and all control enablement.
- [ ] Backfill existing merchants deterministically and initialize new merchants transactionally; the generation RPC must never invent a different default on separate instances.
- [ ] Add an immutable `storefront_home_critical_snapshots` store keyed by merchant and committed `content_generation`, containing only the schema-validated public payload, renderer epoch/digest/critical-shell contract version, canonical `shared_shell_content_generation`, canonical `shared_shell_fingerprint`, canonical `home_critical_fingerprint`, and source dirty revision. The control row points to the current snapshot. Never update a committed payload in place; garbage collection may remove only unreferenced rows after all delivery/canary references finish, must always retain current + prior rollback generation, and retains other unreferenced snapshots for the configured `7 days`.
- [ ] Extend the merged #3077 domain-event/delivery pipeline rather than creating `cache_invalidation_outbox`. Add the fixed internal event `storefront.cache_transition.v1` and delivery destination `storefront_cache_transition`, plus `storefront_cache_transition_obligations` normally keyed to one immutable non-null `domain_event_id` and bound idempotently to the generic delivery id by `route_storefront_cache_transition_v1`. The only nullable-event row is the unique renderer-sweep `promotion_staged` obligation keyed by merchant + renderer epoch; a database constraint requires its operator receipt/delivery/lease/attempt fields null, and only the atomic promotion RPC may convert it to ordinary `pending` while inserting the event. The obligation owns merchant/class/target, coalescible pending revision, frozen OLD+NEW identity outcomes, exact URL/tag/header duties, provider result, and coverage relation. `ensure_storefront_cache_transition_v1` emits ledger/PGMQ only when it creates new claimable pending work; pre-route and routed-but-unclaimed mutations mutate that same child and attach receipts without another event; after claim, exactly one pending successor/event may exist. Generic delivery rows remain the single owner of immutable delivery id, state, claim token/lease, retry time, `attempts_in_cycle`, monotonic total attempts/operator requeues, row version, sanitized error, dead-letter/replay audit, heartbeat, and retention. Enforce at most one coalescible pending specialized successor per `(merchant_id, target_kind, target_id)` plus one promotion-stage uniqueness constraint. This plan uses `storefront_critical_safety/merchant`, `storefront_shared_shell/merchant`, `storefront_shared_shell_cleanup/merchant`, and `storefront_home_content/home`. Cleanup uses provider class/document scope `shared_shell` but retains its distinct prior-shell-marker absence duty. Execution priority is `safety > shared_shell|shared_shell_cleanup > home_content`; the ordinary document-scope lattice remains `home_content < shared_shell`. The pending/successor row stores the maximum outstanding scope; every coalesce, transfer, safety absorption, and renderer-successor union uses `max(oldScope,newScope)`. It may upgrade home to shared shell and may cover home with a completed shared-shell superset, but it can never narrow a failed/claimed/retry/dead-letter shared-shell duty to home. Cleanup cannot be covered by home or by a shell-1 shared transition; a safety successor may absorb it only while preserving the exact shell-0 marker-absence canaries. Requeue resets only the generic current retry cycle and never resets lifetime counters/frozen obligations. No second PGMQ queue, independent retry ledger, cache-only dead-letter table/API, provider worker service, or schedule is permitted.
- [ ] Extend the existing `process-domain-events.ts` process with a **separate storefront ingress lane** gated by `STOREFRONT_CACHE_TRANSITION_INGRESS_ROUTING_ENABLED=false` by default. That lane calls only `route_pending_storefront_cache_transitions_v1`; it never calls the generic PGMQ reader and therefore runs independently of analytics `EVENT_PIPELINE_ROUTING_MODE=disabled|shadow|active` and can never consume unrelated messages. Replace both updated and stale generic reader paths at the DB boundary as described above, excluding linked storefront messages before lease/read-count mutation; filtering after `pgmq.read` is forbidden. The old generic ingress-dead-letter RPC is replaced in the append-only migration with the same signature plus a guard that refuses to terminally archive any valid linked storefront event; only the specialized ingress path may dead-letter it. Test the complete 3×2 analytics-mode/cache-ingress matrix, concurrent old/new generic readers, zero storefront generic lease/starvation, stale-router classification, control-managed state with router flag later false (mutation remains durable/pending), and no change to the four-provider cutover completeness gate.
- [ ] Extend #3077's generic claim API with an explicit destination-class filter, priority, and lease so only `process-event-deliveries.ts` claims `storefront_cache_transition`. In the same process/service, run a JIT storefront provider lane separately from analytics: calculate immediately free execution slots first, claim no more rows than that count (`1` initially, maximum `2`), order safety then shared shell then home content, and start every returned row synchronously in its reserved slot. Never prefetch five leased rows into an in-process queue. Keep one safety opportunity between consecutive content claims so content cannot occupy all future capacity indefinitely. Freeze the production execution deadline only as `stageTotal + 15 s` and the lease only as at least `executionDeadline + 60 s` after the provider bounds are proved; `150/210 s` are merely intended values and activation blocks if the formula does not fit. Commit visibility plus the service's existing `<=1 s` idle poll is the immediate execution path; the existing stale-lease/minutely recovery sweep is the only recovery schedule. Test exact router/delivery/protocol release rejection, transactional new-work enqueue rollback, pre-route/routed-preclaim/post-claim coalescing, same-generation shared-shell coverage of home, zero orphan messages, atomic parent/global-child claim isolation, A/B shared-child contention with no blocked parent lease, lane fairness, per-stage remaining-budget refusal, one execution held for the configured deadline while the next row remains unclaimed, process death, stale lease recovery, service restart, and healthy claim latency `<=5 s`. Do not add `pg_net`, an HTTP callback, Vault wakeup state, or another executor.
- [ ] Add `storefront_routing_identity_versions` and one global `storefront_routing_identity_obligations` row per normalized identity/current version. Every slug/domain/alias ownership mutation locks affected identities in sorted order, increments each identity's global monotonic `identity_version` exactly once in the transaction, and links the same newest `(identity, identityVersion, outcome)` obligation to **all** affected old/new merchant transitions/receipts. Routing identity children contain the union of distinct OLD and NEW slugs, hostnames, merchant ids, exact home URLs, response tags, and exactly one latest expected post-transition outcome per identity (`current tenant + state`, `new tenant + state`, `absent`, or `redirect`). Per-merchant safety generation remains receipt/audit context but is never the Edge-record freshness comparator. The global child has one DB claim/lease, so concurrent A and B merchant claims cannot race writes to the same Edge key: one worker applies, the other observes/waits for the identical completed child. Before every provider side effect and after stale-lease recovery, the applier rechecks that its version is still current; an older unstarted child is superseded, same-version/same-outcome is idempotent, and same-version/different-outcome is a control-plane error. A claimed older version finishes or is safely superseded before the one successor version applies. A content coalesce may advance its target dirty revision but may never erase an OLD identity purge duty. A new safety successor links every still-unpurged identity and rebases to the newest global child; superseded outcomes remain in immutable audit only. Test enabled A→enabled B and rapid A→B→C with reverse merchant-claim and stale-lease order, exactly one identity applier, and no oscillation.
- [ ] Add `storefront_edge_config_write_leases`, one row per configured Edge Config id, plus the three exact lease RPCs above. It is a cross-identity writer mutex, not a queue: holder kind is exactly `worker | operator | legacy_sync`, holder id is bounded, and the SQL validates one authority tuple before granting a token. `worker` requires the exact active worker-release row version and forbids operation/compatibility inputs; `operator` requires that release version plus an exact live operator `operation_id` and forbids compatibility input; `legacy_sync` requires the reviewed compatibility-contract version and forbids release/operation inputs. The row stores one token, row version, `30 s` expiry, last expected/proven digest, exact item-set digest, and sanitized failure audit. The token must remain live through PATCH, `11 s` floor, distributed whole-store digest, exact affected-item proof, and completion audit; no transaction stays open while sleeping. Contention performs no Edge call and returns durable retry/operator-pending. Expiry recovery never assumes the prior PATCH failed: it re-reads globally, reapplies the claimant's complete idempotent atomic batch, and reproves. Tests prove all valid/invalid authority matrices, same-key and disjoint-key writers, operator/worker/legacy combinations, death at every stage, stale token/version rejection, no digest ping-pong, and bounded serialized throughput.
- [ ] Separate global identity truth from merchant bootstrap staging. `storefront_routing_identity_obligations` owns only global identity/version, desired/applied outcome, `pending|leased|applied|superseded`, its global lease/version, and parent links; it has no merchant bootstrap revision or `staged` state. Its CHECK constraints make the lifecycle executable: `pending|applied|superseded` require null lease owner/token/expiry, `leased` requires all three non-null, and an expired timestamp does not itself change state. Only a locked recovery CAS may move exact expired `leased -> pending`, clear the complete lease tuple, and advance row version before a new lease or bootstrap apply. Add `storefront_routing_stage_bindings` keyed by `(parent_work_id, merchant_id, enable_operation_id, bootstrap_revision, identity_obligation_id)` with `pending|leased|staged|applied|superseded`, routing-child lease, row version, and readback digest. Enabling merchants lease these bindings only, stage compatibility-v1+v2, mark bindings/receipt staged, clear only binding leases, and leave generic delivery pending/null/zero-attempt. Finalizer promotes exact bindings and makes the parent generic-claimable. Reset/drain supersedes only that merchant/revision's bindings; it never supersedes the shared global obligation or another merchant link unless the global `identityVersion` itself advanced. Enabled merchants recover then acquire all still-pending global leases atomically with the frozen generic claim and apply global identity + live records only under those returned child tokens. Tests cover invalid token residue on pending/applied/superseded, expired-leased recovery, A/B reassignment where A resets/aborts while B still requires the same global proof, enabled A/B shared-child contention, existing global coverage, global-version advance, zero cross-merchant stage loss, pre/post-activation mutation, and zero generic thaw.
- [ ] Make `finalize_storefront_routing_v2_bootstrap_v1` the only stage-binding promotion/parent-resume operation. `storefront_routing_v2_bootstrap_finalizations` is an immutable no-public-grants result keyed by `(operation_id,bootstrap_revision)` with canonical evidence/input digest and typed result, checked before live predicates for replay after generic progress. The input includes the exact operator `storefront_edge_config_write_leases` token and expected row version used for the activation/live batch. First execution locks control/activation/receipt/parent, exact bindings, globals, and that Edge lease in the canonical order; requires the Edge lease still live with `holder_kind=operator` and `holder_id=operation_id`, activation enabled, receipt staged, complete evidence, and generic pending/null/zero. For each exact same-version/same-outcome global it accepts matching `applied` coverage or physically clean `pending`. A nonexpired `leased` row returns typed `GLOBAL_IDENTITY_BUSY` and changes nothing. An expired `leased` row may be recovered only while that exact operator Edge lease is live: the locked finalizer CASes `leased -> pending`, clears owner/token/expiry, advances row version, revalidates the distributed digest produced after the recovery protocol's global reread/idempotent reapply, and only then continues. From that exact readback it CAS-marks only clean matching `pending` global state `applied`, then promotes only this parent's bindings, writes `routing_resumed`, and makes the parent claimable. It never clears a live child token, and `pending` with any lease residue is a constraint/control-plane failure rather than accepted evidence. Another parent may consume the global applied fact while keeping an independent binding. Its evidence array is at most eight exact `{stageBindingId,identityObligationId,expectedBindingRowVersion,expectedGlobalRowVersion,identityVersion,expectedOutcome,liveRecordDigest}`. `stage_storefront_routing_stage_binding_v1` and `release_storefront_routing_stage_binding_v1` mutate only leased bindings; global complete/release RPCs are legal only for already-enabled application and reject binding ids. Tests cover commit→lost response→generic claim→replay, cross binding/global/Edge-lease ids, expired global with expired versus live operator Edge lease, A/B shared global proof, existing global coverage, both bootstrap/global-lease race orders, busy retry without mutation, token residue rejection, and zero purge before finalization.
- [ ] Add safety triggers for publication, real `merchants.slug`, aliases, and `domains` ownership/routability fields. Never reference nonexistent `merchants.custom_domain`; test the matrix against `information_schema`. For control-managed identity mutation, materialize the exact prospective OLD+NEW child/home-target/tag union and reject over `8/8/32` before ownership changes; publication-only unpublish at cap always commits. The publication trigger consumes exact private context and does no duplicate work. During H1D1 only, a context-free old-server write may use the explicitly gated no-receipt/no-work compatibility path while controls are final-disabled+null; H1D2 raises a typed exception for every context-free write, including service role. Other safety triggers advance generation/dirty state once and ensure/coalesce exact OLD+NEW work; ordinary content triggers exclude the same event. Tests cover nonexistent-column rejection, capacity rollback, unpublish-at-cap, H1D1 zero-work compatibility, and H1D2 context-free denial.
- [ ] Add content triggers only for the proven dirty-input/consumer matrix. They increment `content_dirty_revision`—never public `content_generation`—and, in `enabling|enabled`, upsert one output-reconciliation target with `next_attempt_at = LEAST(first_dirty_at + interval '120 seconds', last_mutation_at + interval '60 seconds')`, while enforcing `next_attempt_at >= last_provider_attempt_at + interval '60 seconds'`. Triggers do not choose home versus shared-shell provider scope; only the rebuilt fingerprint comparison may do that. In `draining` and `disabled + final_disable_transition_id IS NULL`, they record dirt but park ordinary reconciliation; the next `disabled -> enabling` transition forces one reconciliation to the latest revision. In `disabled + final_disable_transition_id IS NOT NULL`, the legacy route is already visible but worker-owned until proven: every matrix-positive write atomically advances dirt and non-narrowingly extends the exact final obligation (home inputs add root duty; route-wide legacy metadata adds the bounded all-document duty) or its single successor, so completion cannot clear the id after canarying older bytes. Direct SQL, workers, imports, mobile mutations, and API routes must not bypass these semantics.
- [ ] Give `storefront_content_reconciliation_targets` one row per merchant and only `pending | leased` physical states, target dirty revision, renderer triple, next attempt, first-dirty/last-attempt timestamps, sanitized last build error, claim token/worker/lease, and canonical row version. It is not a queue, provider retry ledger, or dead-letter table and owns no domain event until output changes. `claim_due_storefront_content_reconciliations_v1` is service-role-only, recovers expired leases, accepts only `p_limit=1`, uses `SKIP LOCKED`, and may be called only when the same existing delivery-worker process has an immediately free reconciliation slot. It compares every caller-supplied local release/renderer/protocol value in the frozen SQL signature above with the active worker-release row **and** a fresh exact heartbeat for that same worker id; a stale binary cannot obtain a reconciliation claim merely by reading the active row version. `release_storefront_content_reconciliation_v1` requires the exact live token/version and returns it to pending with bounded backoff; repeated build failures remain visible/alerting rather than spinning or being mislabeled provider dead letters. The compare-and-commit RPC requires exactly one authority by mode: ordinary `content` supplies the live reconciliation token/version and null provider ids; `safety` supplies the exact live provider work/token and null reconciliation fields. `superseded` returns the singleton target to pending. `unchanged` advances the reconciled pointer and consumes/releases the lease with no event. An `advanced` commit atomically persists the immutable snapshot/generation and consumes the lease, then applies the renderer/render-mode action in the same transaction: `0→0` and permanent stable `1→1` invoke claimable ensure at the derived visible scope; unchanged-renderer stable degraded shell 1 with no live/awaiting promotion and no inherited cleanup duty commits `snapshot_only` for home and/or shared data changes with **zero additional content event/work**, carrying only an already-degraded/content-null home/shared duty; a permanent-proof inherited duty returns no-commit `superseded` until transferred/terminal; `0→1` or higher-epoch suppressed `1→1` while degraded creates or refreshes the unique non-claimable `promotion_staged` row with **zero event**; `1→0` invokes claimable ensure once with `shared_shell_cleanup`. In safety mode, `snapshot_only` updates the compatible snapshot while the existing safety work remains the sole provider/canary owner; it does not create another content obligation. Required event/stage creation failure rolls back snapshot, pointer, and lease consumption together. Tests cover stale local SHA/capability despite a current row-version value, stale/missing heartbeat, worker death/lease recovery, stale token/version, build error backoff, newer dirt during build, zero-event unchanged, zero-additional-event degraded home/shared `snapshot_only` in both ordinary and safety modes, degraded-compatible carried work, permanent-proof inherited blocking, exact-one-event claimable visible advanced/cleanup, zero-event staged advanced, stage refresh, and no generic provider claim before scope exists.
- [ ] Make the combined release RPC plus durable sweep the only renderer activation path. After exact new binaries heartbeat, the operator atomically activates their SHA/contracts and the manifest's epoch/digest/critical-shell contract version. `enqueue_storefront_renderer_reconciliation_batch(sweep_id, cursor, 100)` is idempotent and marks progress in the durable sweep row; it gives every enabled mismatching control row one immediate frozen reconciliation target carrying that required contract and resumes after CLI/process death. This is the code-only invalidation path and requires no merchant data write. A partial failure after activation is safe-degraded/no-Hero and alerting until the same sweep id resumes; it can never leave a falsely compatible old snapshot. Old deployments may observe the new requirement but cannot activate backward or commit an old contract. Renderer rollback is forward-only: deploy the previous implementation under a **new higher epoch/digest** and the reviewed restored shell version, atomically activate it with its worker release, and reconcile; never decrement the DB epoch.
- [ ] Use statement-level transition tables or an equivalently bounded design so a bulk import creates at most one safety-generation or content-dirty-revision advance per affected merchant/class per statement. Load-test representative bulk and rapid sequential updates; prove bounded rows, frozen claimed targets, one pending successor, bounded provider attempts, no lock amplification, and convergence to the newest dirty revision.
- [ ] Add a service-role-only, generation-checked raw-input RPC for the reconciler. It returns the minimum candidate inputs in one PostgreSQL snapshot together with the captured safety generation and dirty revision. Ordinary content mode discards the build if either is stale at commit; safety mode follows the explicit captured-revision rule below so newer ordinary dirt cannot livelock safety.
- [ ] In the worker, run the deterministic launch selection, slide, resource-hint, early LCP, shared-shell, full active-shell semantic, and crawlable-link builders from one captured raw input; validate the two final public views with separate Zod schemas; serialize each component canonically; compute the four component digests, home-critical composite, and complete home-document digest; then commit both payloads and every digest in one transaction. Do not reproduce ranking, price-label, semantic-graph, link-selection, image, shared-chrome, or URL rules in SQL.
- [ ] Add a service-role-only compare-and-commit RPC that locks the control row and checks the expected safety generation, captured dirty revision, frozen renderer epoch/digest/critical-shell contract version, and current DB requirement. A worker whose local/frozen contract is no longer required returns `renderer_version_mismatch` and can commit nothing. Otherwise it accepts an explicit `content` or `safety` reconciliation mode and returns one typed outcome. Renderer-pair precedence is evaluated before data-digest equality: a changed renderer always returns `advanced`, advances the immutable snapshot/public content generation, and conservatively selects `0→0 = (shared_shell, shared_shell)`, `1→1 + permanent = (shared_shell, shared_shell)`, `target shell 1 + degraded = (shared_shell, promotion_staged)` (covering both `0→1` and higher-epoch suppressed `1→1`), or `1→0 = (shared_shell, shared_shell_cleanup)` even when rebuilt data fingerprints are byte-equal. Shell-0 renderer code owns the shared header/footer/theme/static closure, so it may never default to `home_content`; a future narrower renderer action would require a separately versioned executable source-closure proof and contract revision. Only an unchanged renderer may use digest equality to return `unchanged`:
  - `superseded`: an expected revision changed **or** stable-degraded reconciliation found an inherited home/shared duty whose frozen proof still expects permanent content fields. Persist no snapshot and keep one successor pending until the suppression/safety transfer makes that duty degraded-compatible or terminal; never reinterpret the permanent proof in place;
  - `unchanged` with `changed_scope=none` and `transition_action=none`: update reconciled/compatible pointers, advance no public content generation, and require no content purge;
  - `advanced` with `changed_scope=none` and `transition_action=snapshot_only`: ordinary `content` or `safety` mode for an unchanged-renderer shell-1 control with `render_mode=degraded`, no live/awaiting promotion intent, and no inherited cleanup duty may use this result when the home and/or shared data fingerprint changed. Increment public `content_generation`; when the shared fingerprint changed, also set `shared_shell_content_generation` to the new generation and persist that fingerprint, otherwise carry the shared generation/fingerprint forward; insert the newest immutable private snapshot, update the current pointer, and create no **additional content** obligation/event/work because degraded home/shared markers make the content generations/fingerprints null. In safety mode the already-active safety claim remains provider-owned and canaries only the explicit degraded outcome. An inherited home/shared work item may be carried only when its frozen expected proof is already the degraded content-null shape; the RPC returns that existing id separately as nullable `carried_work_id`, preserves its event/target unchanged, and still returns null new `work_id`. If inherited work expects permanent content fields, return `superseded` with no snapshot commit and leave one reconciliation successor until the suppression/safety transfer makes the duty degraded-compatible or terminal. An inherited cleanup duty always forbids this path. A future permanent exposure is necessarily a new higher-epoch sweep and must stage/purge that newest snapshot normally;
  - `advanced` with `changed_scope=home_content`: under an unchanged renderer, the home-critical/document tuple changed because the LCP, semantic, link, critical composite, or home-only document input changed while shell `0` or permanent shell `1` is visible and `sharedShellFingerprint` stayed byte-equal; increment public `content_generation` once, carry forward the prior `shared_shell_content_generation` and fingerprint unchanged, insert both immutable projections under that one generation, update the current pointer, and use `transition_action=home_content`;
  - `advanced` with `changed_scope=shared_shell`: the unchanged-renderer shared fingerprint changed while visible output is active **or** renderer precedence selected any renderer change/rollback; increment public `content_generation`, set `shared_shell_content_generation` to that new generation when the target shell computes a shared fingerprint, and perform the same immutable commit. Stable degraded unchanged-renderer data changes were already consumed by `changed_scope=none/snapshot_only` and never reach this claimable branch. A shell-0 or permanent shell-1 renderer change uses `transition_action=shared_shell`; any renderer-changing target-shell-1 sweep while degraded—including initial `0→1` and a higher-epoch suppressed `1→1`—uses `transition_action=promotion_staged`; a forward `1→0` renderer activation uses `transition_action=shared_shell_cleanup`. It returns the exact committed content generation, shared-shell generation, `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, `homeDocumentFingerprint`, scope, transition action, nullable stage/work id, and row version in one transaction.
- [ ] Freeze `changed_scope` to `none | home_content | shared_shell` and `transition_action` to `none | snapshot_only | home_content | shared_shell | promotion_staged | shared_shell_cleanup`. Both are derived inside the locked compare-and-commit operation from old/new shell versions, render mode, previous/supplied canonical digests, inherited duties, and the locked renderer-sweep merchant state; neither is caller-selected. The snapshot records changed scope/action. **Promotion-intent precedence is evaluated before the ordinary stable-`1→1` action:** if `render_mode=degraded` and the required renderer's merchant sweep is `awaiting_promotion`, every compatible **published** home/shared/safety reconciliation forces `transition_action=promotion_staged`, creates or refreshes that sweep's one stage to the newest committed tuple, and emits zero event—even when an earlier unpublish invalidated the row or the rebuilt digests are equal. Unpublish invalidates the live stage and performs its neutral safety duty but leaves the sweep merchant `awaiting_promotion`; a same-renderer republish therefore recreates the stage before promotion can proceed. With no live/awaiting promotion intent and no inherited cleanup duty, every stable degraded unchanged-renderer `1→1` home-only, shared-only, or combined data change is `snapshot_only`; an inherited home/shared item may be carried only under its already-degraded content-null proof, while a permanent-proof item forces no-commit `superseded` until transferred/terminal. Permanent stable `1→1` home/shared changes remain claimable normally. A claimable obligation records `required_document_scope = max(changed_scope, every uncompleted inherited scope)` plus both digests. A `promotion_staged` row instead records the exact sweep/merchant id, current safety generation, content/shared-shell generation, snapshot id, dirty/reconciled revision, renderer tuple, fingerprints, manifest/tag duties, and row version. While it is parked, every later compatible published content or safety reconciliation atomically replaces those stage pointers with the newest committed tuple without emitting an event; an unpublish or conflicting higher renderer invalidates it under lock without erasing the durable intent unless the higher renderer abandons the sweep. Promotion locks control, sweep progress, current snapshot, reconciliation target, and stage and rejects unless publication is still true, sweep state is `awaiting_promotion`, dirty equals reconciled, the stage tuple is byte-equal to the current compatible snapshot/control/renderer/safety tuple, and no wider uncompleted duty is omitted. Its CAS records `promoted_at`, changes the exact sweep-target state to `cache_pending`, and binds the new work id; only provider/canary completion may then set `completed`. Supersession, transfer, renderer-successor union, safety absorption, and resolve-covered may cover home with shared shell only for the same merchant and newer-or-equal content generation with matching safety/renderer contract; home can never cover shared shell. Cleanup retains its shell-0 marker-absence duty through every union. The compare RPC's nullability matrix is fixed: `unchanged|superseded` returns `transition_action=none` with null `stage_id/work_id/carried_work_id`; `snapshot_only` returns null `stage_id/work_id` for new content work and nullable `carried_work_id` only for an exact degraded-compatible existing duty; `promotion_staged` returns its non-null `stage_id` and null `work_id/carried_work_id`; every claimable advanced action returns null `stage_id/carried_work_id` and its non-null work id. Tests race mutations before/during promotion, include unpublish→republish before promotion, stable degraded ordinary/safety home-only/shared-only/combined changes with no inherited duty, degraded-compatible carried work, permanent-proof inherited work, and cleanup inheritance; prove stale stages cannot expose bytes, an awaiting stage always creates/refreshes with zero event, snapshot-only commits newest private payload with no additional event/work, permanent-proof/cleanup inheritance cannot commit snapshot-only, no snapshot pointer advances without exactly the required stage/provider/no-visible-output duty, `0→1` creates no event before CAS, and `1→0` creates exactly one cleanup event.
In the preceding transition paragraph, legacy shorthand such as “both digests” or “fingerprints” means the complete frozen output tuple: `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, and `homeDocumentFingerprint`; no stage, obligation, successor, or coverage proof may omit a component/document digest merely because a composite is present.

- [ ] In the preceding promotion paragraph, “marks sweep progress promoted” names the immutable promotion timestamp/audit fact; the exact sweep-target enum transition is `awaiting_promotion -> cache_pending`, followed only by provider/canary completion to `completed`. There is no `promoted` target state.
- [ ] In ordinary `content` mode, require the dirty revision still to be current before `unchanged` or `advanced`. In `safety` mode, require the safety generation still to be current but allow a coherent captured dirty revision to become the safety-compatible snapshot even when newer ordinary content is dirty; return `successorRequired=true` and retain that newer content target. The safety compare computes and persists the complete frozen output tuple—LCP, semantic, crawlable-link, critical composite, shared-shell, static-closure, and document fingerprints—plus the inherited required-document-scope; omitting a component because a composite is present is forbidden. Under stable degraded unchanged-renderer shell 1 with no live/awaiting promotion and no inherited cleanup duty, home and/or shared data changes may select `snapshot_only`; this creates zero additional content obligation/event/work, while the existing safety claim continues and canaries the explicit content-null degraded outcome. A degraded-compatible inherited home/shared item is returned only as `carried_work_id`; a permanent-proof inherited item makes the reconcile no-commit `superseded` until safety/suppression transfer or completion, and cleanup always keeps its claimable four-document action. If permanent bytes are active or promotion is awaiting, the safety obligation must include the required tag/purge/canary superset or atomically attach a duty-preserving successor before any predecessor can be covered. A home-only safety canary never completes shared-shell output delivery, and ordinary shell-0 safety proof never completes cleanup. This prevents continuous catalog writes from blocking unpublish/domain safety convergence without erasing broader cache work.
- [ ] Add a minimal anon-safe RPC for the current safety generation, **current public safety-proof revision**, confirmed safety generation, committed content generation, shared-shell content generation, exact `control_state`, and exact `render_mode`. Never return the private `final_disable_transition_id` or derive a public finalization enum/bit. Never add or derive an `enabled` boolean: callers must handle every public control/render state without a lossy compatibility alias. Expose no fingerprint, delivery state, identities, hostnames, provider result/error, snapshot bytes, receipts, or merchant columns. This projection is a first/key read only: it can select exact generation+proof-revision cache arguments but can never populate the H1 measurement marker or a canary proof. Static rendering may cache it only under the hard-expiry generation **and proof-revision** tags below. Publication status polling does **not** use this public RPC; it uses the authenticated exact-receipt status RPC.
- [ ] Add immutable `storefront_public_safety_proofs` rows keyed by `(merchant_id, safety_generation, proof_revision)`, never merely merchant + generation. The control row holds the locked `current_public_safety_proof_revision`; a safety mutation advances the safety generation and starts revision `1`, while renderer/protocol activation may append revision `N+1` under the same safety generation only inside the locked sweep/CAS and atomically move the current pointer after all tuple checks. Old revisions remain immutable and canary-auditable. No unlocked “latest row” selection is legal. The safety mutation/identity-child transaction creates the row from the exact normalized current supported identities/outcomes and active cache-protocol manifest. The canonical target-manifest digest is the checked-in four-document manifest digest frozen by the active cache protocol. `canonicalUrlOutcomeDigest` is SHA-256 of canonical JSON `{version:1,merchantId,publicationState,targets:[{identityKind,normalizedIdentity,canonicalUrl,expectedOutcome,expectedMerchantId}]}` with targets sorted by `(identityKind,normalizedIdentity,canonicalUrl)` and one latest non-contradictory outcome per target. The named shared TypeScript builder/fixture and SQL parity suites above must produce byte-identical JSON/digest; callers cannot supply either digest. Backfill the persistent disabled Oga control deterministically with a current revision. RLS denies table reads; anon receives only the fixed RPC below.
- [ ] Add anon-safe `get_storefront_public_safety_proof_v1(p_requested_identifier,p_merchant_id,p_expected_safety_generation,p_expected_public_safety_proof_revision)` and return exactly `schemaVersion`, requested identifier, merchant/template identity, publication state, safety generation, proof revision, canonical target-manifest digest, canonical URL-outcome digest, required renderer epoch/digest, committed renderer epoch/digest, critical-shell contract version, control state, and normalized `controlRenderMode = legacy | degraded | permanent`. `legacy` is emitted only for the persistent disabled legacy contract; it is not a value stored in the controlled database `render_mode` column and never means visible Hero ownership. The function resolves the identifier through the same ownership snapshot, requires both expected values to equal the locked current pointer, joins exactly `(merchant_id,safety_generation,proof_revision)` to the active requirement/current committed snapshot atomically, and fails closed rather than selecting a newer revision. `storefront-public-safety-proof.ts` first consumes the generation-state selector, then calls the typed public GET RPC with its exact generation/revision, 5-second query abort, `retry(false)`, exact Zod parse, and React request memoization. Every bound metadata/layout/home/category/PDP/blog consumer shares this one object; the early home RPC embeds the exact same `safetyProof` object, and the document adapter rejects inequality including revision and both renderer tuples. One-call/meta→layout→route race tests, stale-current-pointer/key-invalidation tests, same-generation renderer-revision races, projection/grant tests, detach/reassignment tests, and disabled-private-finalizer byte-equality tests are mandatory.
- [ ] Add one anon-safe generation-checked **early critical** RPC that joins current publication/safety state to the immutable committed snapshot and returns only:

```text
schemaVersion
safetyProof: exact StorefrontPublicSafetyProof
controlState: disabled | enabling | enabled | draining
renderMode: degraded | permanent
rendererContractEpoch: canonical decimal string
rendererContractDigest
criticalShellContractVersion: integer
requestedIdentifier: normalized exact input
identityState: bound | unbound
merchantId: uuid only when bound, otherwise null
canonicalSlug: string only when bound, otherwise null
safetyGeneration: canonical decimal string
publicSafetyProofRevision: canonical decimal string
contentGeneration: canonical decimal string
sharedShellContentGeneration: canonical decimal string | null // non-null for every compatible controlled shell; null for neutral/non-compatible shapes
status: published | unpublished | null when unbound
snapshotState: compatible | degraded | suppressed | draining | disabled | unbound
criticalRenderOwnership: request_owned | permanent | absent
businessName: string only when bound, otherwise null
sharedShell: bounded product-free theme/header/navigation/footer/static-config projection | null
sharedShellFingerprint: canonical digest | null
homeLcpFingerprint: canonical digest | null
homeSemanticFingerprint: canonical digest | null // digest only; no semantic graph bytes
homeCrawlableLinksFingerprint: canonical digest | null // digest only; no link rows
homeCriticalFingerprint: canonical digest | null
staticDocumentClosureDigest: canonical digest | null
homeDocumentFingerprint: canonical digest | null
metadata: {
  siteTitle
  siteDescription
  siteTagline
  canonicalUrl
  country
  logoUrl
  faviconSvgUrl
  faviconPng32Url
  faviconAppleTouchUrl
  googleSiteVerification
  socialImageUrl
  twitterHandle
} | null
webPage: minimal final public WebPage/H1 inputs with zero CollectionPage/Product/Offer/availability bytes
heroSlides: minimal bounded final slide payload
```

The `sharedShell` value is not a prose bag or a `MerchantData` subset chosen at a call site. `apps/web/src/schemas/storefront-home-critical-public-snapshot.ts` owns its one primary Zod schema and exports the inferred type `StorefrontHomeCriticalSharedShellProjection`; its version-1 shape is exactly:

```text
schemaVersion: 1
merchantId: uuid
businessName: 1..120 chars
canonicalOrigin: normalized query-free HTTPS origin
logo: { url: normalized HTTPS URL, alt: 1..160 chars, width: 1..1024, height: 1..1024 }
theme: { primary, accent, background } // normalized reviewed CSS colors only
navigationCategories: <=12 [{ id: uuid, name: 1..80 chars, canonicalAbsoluteHref: same-origin HTTPS URL }]
headerLinks: <=8 [{ kind: fixed reviewed enum, label: 1..80 chars, canonicalAbsoluteHref: same-origin HTTPS URL }]
footer: {
  tagline: 0..180 chars,
  sections: <=4 [{ heading: 1..80 chars, links: <=8 [{ label: 1..80 chars, canonicalAbsoluteHref: same-origin HTTPS URL }] }],
  contact: { addressLines: <=3 [1..120 chars], phoneLabel: 0..40 chars, phoneHref: normalized tel URL | null, email: normalized mailto URL | null },
  socialLinks: <=8 [{ kind: fixed reviewed enum, canonicalAbsoluteHref: HTTPS URL }]
}
trustPolicyVisibility: { privacy: boolean, terms: boolean, shipping: boolean, returns: boolean, warranty: boolean }
publicWidgetConfig: { googleStoreEnabled: boolean }
speculationRules: { prerenderPatterns: <=4 [canonical same-origin pattern], prefetchPatterns: <=8 [canonical same-origin pattern] }
```

Every string/array has a schema byte cap and the complete canonical value is capped at `48 KiB`. The current hardcoded Oga footer artwork/text/icon order, static menu labels, fixed skeleton/client-stub markup, and serializer code are renderer-manifest/static-closure inputs; any merchant-mutable text/link/color/config is in the projection above. Search, notifications, cart count/sidebar, account/session, popup/offline/chat, ad units, Google widget execution, analytics execution, and route-reactive behavior are `OgabasseyClientShellIslands`: their server output is fixed manifest-owned placeholder geometry with zero user/cart/product/config rows, and mutable reads occur only after hydration through existing local state or explicit no-store endpoints. The static header/footer never call `useMerchantSafe`, never receive `MerchantData`, and never derive request `basePath`; all compatible Oga links are the canonical absolute URLs already in the projection. `OgabasseyStorefrontLayout`, `StorefrontShellLayout`, `StorefrontChromeRuntime`, `OgabasseyLayoutChrome`, navbar/secondary-nav/search/notification/mobile-menu components, footer/deferred-footer/overlay components, speculation rules, and the Google widget wrapper must each be classified by a source-closure test as projection renderer, manifest-owned constant, or client island. An unclassified emitted byte fails H1C2.

`resourceHints` is intentionally absent from the RPC. The worker, render adapter, and canary all derive the exact connection/preload projection from canonical slide zero through `buildOgabasseyHomeHeroResourceHintProjection`; `homeLcpFingerprint` includes that derived projection, and any caller-supplied/precomputed hint field is rejected. Under both shell contracts, a compatible early view carries the bounded product-free `sharedShell` projection and theme; every rendered shared CSS/header/navigation/footer/static-config byte belongs to `sharedShellFingerprint`. H1C2 cuts the Oga layout/page to this projection before control activation; H2 changes ownership from request-gated to permanent without reintroducing a live server chrome read.

The early RPC returns the committed semantic/link/component/document digests solely so the adapter can verify the versioned composites before trusting the Hero; it never returns, constructs, serializes, or hashes the semantic graph or crawlable-link rows. Add a second anon-safe generation-checked deferred semantic/link RPC whose successful shell-0 response is exactly:

```text
schemaVersion
semanticState: compatible | degraded | suppressed | draining | disabled | unbound
requestedIdentifier: normalized exact input
identityState: bound | unbound
merchantId: uuid only when bound, otherwise null
status: published | unpublished | null when unbound
controlState: disabled | enabling | enabled | draining
renderMode: degraded | permanent
rendererContractEpoch: canonical decimal string
rendererContractDigest
criticalShellContractVersion: integer
safetyGeneration: canonical decimal string
publicSafetyProofRevision: canonical decimal string
contentGeneration: canonical decimal string
homeSemanticFingerprint: canonical digest | null
homeCrawlableLinksFingerprint: canonical digest | null
homeCriticalFingerprint: canonical digest | null
staticDocumentClosureDigest: canonical digest | null
homeDocumentFingerprint: canonical digest | null
semanticGraph: exact bounded final public active-shell JSON-LD graph | null
crawlableProductLinks: at most 24 exact { name, href } rows | null
```

`compatible` is legal only for a published, bound, exact-generation snapshot. Under shell contract `0` it returns the prebuilt full current home graph; under shell contract `1` it returns the prebuilt canonical non-inventory graph. Both return the bounded crawlable-link projection selected by `created_at DESC, id ASC`, with only name and canonical absolute href. Every other shape returns semantic/link/component/document fingerprints, graph, and links as null. The deferred call supplies the shell contract, generation, component/composite/document tuple obtained from the early view; it never chooses “latest,” falls forward to another generation, rebuilds from live rows, filters a shell-0 graph at request time, or contains visible feed price/image/stock rows.

The server-only H1C2 document adapter freezes this exact result shape before any home marker/Hero JSX is returned:

```ts
type OgabasseyHomeDocumentSnapshot =
  | {
      kind: 'compatible';
      early: Extract<
        StorefrontHomeCriticalPublicSnapshot,
        { snapshotState: 'compatible' }
      >;
      semantic: Extract<
        StorefrontHomeCriticalSemanticSnapshot,
        { semanticState: 'compatible' }
      >;
      resourceHints: OgabasseyHomeHeroResourceHintProjection;
    }
  | {
      kind: 'neutral';
      early: Exclude<
        StorefrontHomeCriticalPublicSnapshot,
        { snapshotState: 'compatible' }
      >;
      semantic: null;
      resourceHints: null;
    };

const getOgabasseyHomeDocumentSnapshot = cache(
  async (
    identifier: OgabasseyGeneratedIdentifier,
  ): Promise<OgabasseyHomeDocumentSnapshot> => {
    // Reuse the exact request-memoized route-resolution early object, load the
    // deferred view only for a compatible home, and validate the complete tuple.
  },
);
```

For `compatible`, the request-memoized route resolution/early adapter gives parent metadata, parent layout, home metadata, and home page one early-view object identity without loading semantic/link bytes. Only the home page calls `getOgabasseyHomeDocumentSnapshot(identifier)`; that adapter reuses the exact early object, calls the deferred semantic/link RPC with the complete shell/safety-generation/proof-revision/content/component/composite/document tuple, derives hints from slide zero, validates the LCP, semantic, crawlable-link, home-critical, shared-shell, and complete-document digests, enforces the admission caps, and only then returns marker/Hero-capable home JSX. React `cache()` gives the home page and all home render children one document-object identity; no child performs an RPC. Category/PDP/blog/layout consumers use only safety+early shared-shell proof and execute zero deferred home calls. For every neutral home shape the adapter returns without a deferred call.

- [ ] Make each public projection one coherent PostgreSQL snapshot and fail when any expected safety generation, **public safety-proof revision**, content/shared-shell-content generation, renderer tuple, or expected composite changed. In each snapshot, normalize and resolve `p_requested_identifier` through the exact current slug/domain/alias ownership rules used by the proxy. `identityState=bound` is legal only when the identifier currently resolves to `p_merchant_id`; otherwise return the exact unbound shape with null merchant/product/theme/component/composite fields and empty payload. Never return the reassigned merchant row. The safety-proof, early, and deferred calls use the same identifier, merchant, safety generation/proof revision, content generation, renderer tuple, and composite; none may silently select a newer generation or revision. This ownership result and identifier are part of all remote cache keys and safety/proof-revision-tag invalidation contracts, so a cached OgaBassey projection can never be reused for a detached/reassigned hostname or a superseded same-generation proof.
- [ ] Return exact `control_state`, `render_mode`, and shell contract, never the internal final-transition UUID, a derived finalization bit, or a lossy enabled boolean. For the backfilled OgaBassey merchant, both private disabled sub-states return the same bound `snapshotState=disabled` shape with current product-free safety/renderer/canonical fields but no immutable content pointer, home/shared fingerprints, theme/metadata, WebPage data, or Hero slides; the route resolver renders the same request-scoped legacy shopping outcome. A missing control row for that constant merchant is a typed unavailable failure and cannot fabricate a safety generation, proof revision, or marker. For an existing disabled OgaBassey control row, that outcome always includes the same standalone product-free `OgabasseyStorefrontSafetyMarker` with `controlRenderMode=legacy`, current safety generation/proof revision, and no private receipt/finalization field—both before and after the internal final-transition UUID clears. This byte-stable marker lets the worker prove the final legacy outcome without exposing operator state and prevents a marker-removal cache transition. Mutation ownership changes only inside private/authenticated control interfaces. `enabling` returns the degraded/no-Hero shape while workers seed snapshot/routing. `draining` returns its own bound neutral shape and remains fenced. An `enabled + shell contract 0 + render_mode=degraded` exact compatible early snapshot returns `snapshotState=compatible`, `criticalRenderOwnership=request_owned`, non-null component/composite fingerprints, and the bounded early payload; the request publication/tenant guard remains the sole DOM visibility owner and emits the marker immediately before the Hero. An `enabled + shell contract 1 + render_mode=permanent` exact compatible snapshot returns `snapshotState=compatible`, `criticalRenderOwnership=permanent`, and the H2 early payload. An `enabled + shell contract 1 + render_mode=degraded` response remains the exact content-null degraded/no-Hero shape regardless of a stored compatible private snapshot. Shell-0 compatible input can never enter H2 permanent rendering, and shell-1 input can never enter the H1 request-owned branch. Entering draining, making the legacy disabled route visible, degrading shell 1, or advancing the current proof revision hard-expires the exact public state/view keys and tags; the receipt-backed obligation purges Vercel/Cloudflare HTML before private completion. Clearing the private final-transition UUID changes no public byte and therefore requires no second document purge.
- [ ] Never return the full `CachedMerchant` or raw candidate rows. The early projection returns only exact bounded shared-shell, metadata, WebPage/H1/Hero/slide fields plus all committed component/composite/document digests when `snapshotState=compatible` and snapshot safety generation matches current safety. Resource hints are derived from slide zero by the shared pure builder and are never transported. It contains zero semantic-graph or crawlable-link rows and performs no deferred payload construction or serialization in SQL; those digests are already-committed 64-character integrity inputs. The deferred projection returns only the exact prebuilt bounded active-shell graph, at most 24 `{name,href}` crawlable-link rows, and matching semantic/link/composite/document fingerprints for the same generation. Its shell-0 exact-key graph may contain only the public identity/trust/contact/category/blog/product fields already emitted by the current JSON-LD; its shell-1 graph contains no Product, Offer, price, stock, inventory, availability, product significant-link, or image field. The separate shell-1 crawlable-link rows contain only selected product name and canonical absolute href. The no-store feed endpoint is the sole visible product-card data owner and none of its rows may appear in the initial HTML/RSC snapshot. These projections cover every mutable cacheable home/shared byte without a second live merchant/product read. A published mismatch returns degraded shapes with null component/composite/document fingerprints and empty payloads.
- [ ] For a bound unpublished snapshot, both projections return `suppressed`, status plus only the neutral public name/non-shopping metadata needed for an accurate no-store response; every component/composite/shared fingerprint and `sharedShell` is null, and WebPage, semantic graph, Hero slides, product/image/link fields are empty at the SQL boundary. Test all early shapes (`compatible/request_owned`, `compatible/permanent`, `degraded`, `suppressed`, `draining`, `disabled`, `unbound`) and all semantic shapes (`compatible` under shell 0, `compatible` under shell 1, `degraded`, `suppressed`, `draining`, `disabled`, `unbound`) by exact JSON equality for both `ogabassey.com` and `ogabassey`, including separate disabled-null and disabled-non-null private final-transition fixtures that produce byte-identical public disabled JSON, shell-0/shell-1 substitution attempts, control drain, detach, and reassignment between the early and deferred reads.
- [ ] Enable RLS on new tables. Public roles cannot read the control/specialized-obligation/immutable-snapshot/routing-activation tables or #3077 delivery internals directly. Grant anon only the narrow public generation/completion, early-snapshot, and semantic-snapshot RPCs. Grant renderer-version sweep, routing activation, raw-input, compare-and-commit, destination-scoped claim, atomic successor-complete/predecessor-cover, retry, and transfer RPCs only to the server-side worker role. The shared dead-letter list/requeue/resolve-covered operator RPCs are the deliberate exception: revoke default execute immediately, then grant only `authenticated` and `service_role`, reuse #3077's `is_event_pipeline_operator_v1()` authorization inside every call, and expose them only through its authenticated admin routes. Requeue/resolve require `p_operator_id`, persist it in immutable audit, and require `p_operator_id = auth.uid()` unless the caller is the service role; a caller-bound route never creates or receives an admin/service-role client.
- [ ] Harden every definer function with an empty/fixed `search_path`, schema-qualified objects, revoked default `PUBLIC` execute, explicit role grants, bounded inputs, and tests proving anon cannot read delivery/control-plane data.
- [ ] In **each function-creation migration**, revoke execute from `PUBLIC`, `anon`, and `authenticated` immediately after every SECURITY DEFINER function is created, inside the same migration transaction. The later ACL migration adds the exact positive grants and completeness assertions; it must never be the first revocation because that would leave an apply-window exposure.
- [ ] Add an exhaustive projection/grant sweep: assert exact top-level and nested keys separately for the private raw-input RPC, public generation/completion RPC, early `sharedShell`/`metadata`/`webPage`/`heroSlides` projection, and deferred `semanticGraph`/`crawlableProductLinks` projection. Prove the early payload contains no transported `criticalTheme`, `resourceHints`, graph, link rows, Product/Offer/availability, or feed rows; permits `sharedShell` only for compatible shell 0/1; and exposes only committed deferred digests. Prove `sharedShell.theme` is the sole mutable compatible-theme value and every rendered compatible CSS variable derives byte-for-byte from it. Prove the deferred payload has zero Hero/resource-hint/theme/raw-merchant/feed/price/image/stock keys; shell-1 graph has zero Product/Offer/product-significant-link keys; and crawlable rows have exact `{name,href}` shape and cardinality. Prove exact unpublished JSON equality; no current/future merchant column can appear because a table grows; `PUBLIC` has no execute; anon executes only intended public generation/completion/two-view/feed RPCs; and the feed RPC returns an exact product-card projection through the no-store route without table access. Every renderer-sweep/raw-input/compare-and-commit/claim/atomic-complete-and-cover/retry/transfer RPC is service-role-only; authenticated has only the separately operator-checked dead-letter surface; public roles have zero direct control/delivery/snapshot/audit table privileges. Exercise owner, non-operator, cross-operator-id, operator, service-role, anon feed, cross-tenant identifier, and malformed-host cases through real JWT contexts and runtime SQL/JSON assertions—not source regexes.
- [ ] Extend that sweep to the authenticated publication RPC/status surface: exact scalar columns only, tenant-owner/staff permission enforced, cross-merchant receipt lookup denied, no `merchant` row expansion, no receipt/provider error leakage, and no direct table grants. Explicitly assert that #3114's restored anon merchant columns do not become reachable through a broader snapshot or receipt projection.
- [ ] Extend the authenticated sweep with a real role/JWT matrix: direct `UPDATE merchants SET is_published/published_at` is denied; reviewed non-publication column updates still succeed; the eligibility RPC exposes only `isEligible` plus the fixed missing codes; every individual missing requirement and a concurrent eligibility change reject publish atomically with zero state/generation/event delta; eligible owner and authorized staff publish; unauthorized/cross-merchant publish fails; and permissioned unpublish succeeds without launch prerequisites.
- [ ] Cache the current public safety generation **and current public safety-proof revision**, content/shared-shell-content generations, required renderer epoch/digest/critical-shell contract version, and `render_mode` remotely under dedicated hard-expiry tags. The generation-state result is the only key selector. It calls `get_storefront_public_safety_proof_v1` with that exact expected safety generation/revision; the proof RPC returns no alternative/latest revision and fails closed if the locked current pointer changed. A proof-revision advance under the same safety generation invalidates the old revision tag and can never reuse its key. Never expose or key public state on the private final-disable transition UUID; both disabled sub-states share the same public cache key and byte-stable disabled payload.
- [ ] Cache the two immutable public views separately. The early key is requested identifier + merchant id + safety generation + current public safety-proof revision + content/shared-shell-content generations + renderer epoch/digest/critical-shell contract version + render mode; the deferred key repeats that tuple and adds expected home-critical and home-document fingerprints. Both RPCs require the exact expected proof revision selected by the generation-state read, join only the locked row at `(merchant_id,safety_generation,proof_revision)`, and reject a moved current pointer before returning bytes. Both use dedicated hard-expiry identity/generation/proof-revision/home tags and resolve to the same immutable snapshot id. Shell contract `0` requires canonical shared-shell generation/fingerprint/payload, a compatible early view with request-owned Hero rendering, and a compatible deferred full semantic + crawlable-link view. Shell contract `1` permanent compatible snapshots require the same shared-shell closure, a compatible early view, and a compatible deferred canonical non-inventory semantic + crawlable-link view. A safe unbound result may be cached only under its exact identifier, safety generation, and proof revision; failure, malformed output, generation/proof mismatch, or unavailable transport may not be cached as null/not-found. Never cache raw reconciler or visible feed inputs in the public render path.
- [ ] Normalize the safety generation, dirty revisions, content generation, and shared-shell content generation to canonical decimal strings before they enter JSON, cache keys, logs, or HTML so JavaScript number precision cannot split the fence.
- [ ] Remove `Promise.race` from authoritative cache production. An abortable request deadline may degrade the current render, but errors/timeouts must throw through the cache producer and must never store `null`.
- [ ] Reject either bound public view when its requested identifier is not the exact caller input, identity is not currently bound to `OGABASSEY_MERCHANT_ID`, canonical slug is wrong, generation/renderer tuple differs from the requested tuple, safety compatibility is stale, or component/composite relation fails. Map a schema-valid `unbound` result to the generic request-scoped route path; never degrade it into an OgaBassey-branded shell. The document adapter first resolves the early view, then requests the semantic view with that exact shell/generation/composite and validates the pair before returning any marker-bearing render state. `not_found`, `unavailable`, mismatch, malformed output, size/budget violation, or digest failure throws the typed terminal `STOREFRONT_HOME_SEMANTIC_INTEGRITY_FAILURE` before the page returns renderable JSX and schedules reconciliation; it is never converted into a successful graphless fallback or cacheable empty graph.
- [ ] Validate the private raw-input payload, early public payload, and deferred semantic/link payload with three separate Zod boundaries and runtime integrity checks. Recompute `homeLcpFingerprint` from the exact early object, `homeSemanticFingerprint` from the exact deferred graph, `homeCrawlableLinksFingerprint` from the bounded canonical anchors, and the critical/shared/static/document composites before rendering; any mismatch throws the terminal failure above before the document adapter returns. The semantic JSON is capped at `64 KiB`, the link projection at `8 KiB` and 24 rows, the combined deferred payload at `72 KiB` canonical uncompressed bytes, parse+digest CPU at `10 ms`, and a 30-read prewarmed origin probe must show the second-view admission delta at p95 `<=150 ms`; exceeding any cap blocks H1 activation until the projection/read path is reduced. Pre-render failure integration tests require a non-success response with no home measurement/Hero/semantic marker and no Vercel/Cloudflare cache admission; omission is not an allowed fallback. No correctness proof depends on a post-flush error abort. The cacheable request path consumes only committed early, semantic/link, and shared-shell projections plus renderer-owned static bytes; it never rebuilds fingerprint-owned selection from live candidate rows. Visible product/category feed rows and personalized analytics/widgets exist only behind the separately bound no-store client surfaces with fixed server placeholders; category/trust/blog semantics remain worker-built immutable graph inputs.

- [ ] Close promotion enrollment under the same control locks before a disable lifecycle can become final. If a merchant enters draining/disable while its current renderer target is `awaiting_promotion` with a zero-event stage, atomically invalidate that stage and mark the target `abandoned` with bounded reason `control_disabled`; no generic delivery/event is manufactured. A live `promote-render` receipt bound to that target becomes `superseded_conflict` because its permanent outcome is false. A still-in-flight control-enable receipt becomes `superseded_conflict` only when its expected `enabled` control outcome is being abandoned. An already-completed enable receipt remains immutable `completed` as audit proof, while its returned enrollment-sweep triple now resolves to the abandoned target/typed `SWEEP_SUPERSEDED`; it is never rewritten merely because later promotion did not occur. If the target is already `cache_pending`, the drain/suppression safety work must cover or wait for its claimed duty under the normal transfer rules before final disable. Only after the old target is non-live may the disable finalizer clear the lifecycle and a later re-enable create a new same-renderer enrollment generation. The partial unique index excludes terminal `abandoned` rows. Tests cover disable-before-stage, disable-after-stage/before-promotion, completed versus in-flight enable receipts, a bound promotion receipt, disable racing promotion CAS, disable after promotion claim, finalizer replay, and same-tuple re-enable with exactly one live target.

- [ ] Serialize renderer-changing release activation against merchant bootstrap. Under the release/control locks, reject the renderer CAS with typed `MERCHANT_ENROLLMENT_IN_PROGRESS` while any control row is `enabling` or any enable operation owns a live merchant-enrollment target/receipt that has not been finalized or safely drained. The operator must complete enable, or drive the documented drain/disable path that abandons the old target, before retrying the exact release operation. Release-only activation with an unchanged renderer triple may proceed because it does not invalidate promotion intent. A higher renderer therefore can never abandon an enabling merchant's only target without atomically creating its replacement. Tests race activation before/after enrollment creation, snapshot/stage creation, enable finalization, and safe drain; a rejected activation changes no requirement/target/receipt, and the later retry enrolls the now-enabled merchant in the normal fleet sweep.

**Required race/failure tests**

- [ ] publication changes between generation and snapshot reads;
- [ ] rendered-Hero content changes between generation and early-snapshot reads;
- [ ] a mutation commits generation `N+1` after the early `N` read but before the deferred read: the deferred RPC refuses latest, emits no semantic marker/graph, and the response can never satisfy the `N` or `N+1` canary;
- [ ] the semantic RPC times out, returns malformed/oversized JSON, exceeds the admission budget, or fails its digest while the document adapter is assembling the pair: it throws `STOREFRONT_HOME_SEMANTIC_INTEGRITY_FAILURE` before renderable JSX exists, the response contains no Hero/home marker/semantic marker, Vercel and Cloudflare admit no success object, reconciliation remains durable, and no provider/canary completion CAS occurs;
- [ ] early and deferred views from the same generation each recompute their component digest and the same composite; a mixed snapshot id, component digest, composite, renderer, identifier, publication, or tenant tuple fails closed before cache completion;
- [ ] LCP-only, semantic-only, crawlable-link-only, and simultaneous component changes each advance exactly one content generation and create/coalesce exactly one exact-home transition; no component owns an independent generation or provider event. A shared-shell-only change selects the all-document shared-shell action, and static-document-closure drift is rejected as an unactivated renderer/protocol release rather than committed as ordinary content;
- [ ] under H1 shell contract `0`, stock/order-quantity and `products.updated_at` changes mark the semantic component dirty and create one durable exact-home transition only when rebuilt Product/Offer/selection bytes changed; under H2 shell contract `1`, only after the canonical H2 non-product semantic projection/digest is committed and its product/inventory/`updated_at` selection inputs are removed, the same inputs create neither a dirty revision nor root-home/provider transition; `products.created_at` remains a positive Hero-selection dependency under both shells, with insert/update/order/limit-boundary fixtures;
- [ ] the document adapter proves worker-built early and deferred semantic/link views were fetched, parsed, and validated against the complete LCP/semantic/link/critical/shared/static/document tuple before render admission within the `64 KiB`/`10 ms`/p95 `150 ms` caps; raw HTML then proves the H1 measurement marker and Hero/resource hint precede every semantic marker/graph/link byte. Instrumentation fails if request code constructs/rebuilds the graph or link projection, if semantic/link HTML bytes precede the Hero element, if the shared/static/document composite differs, or if any admission cap is exceeded; deferred view transfer/parse/digest before the Hero is expected and measured;
- [ ] a non-selected candidate change marks dirty but produces `unchanged`, no content-generation advance, and zero provider purge;
- [ ] a selected rendered-byte change produces `advanced`, one immutable snapshot, and one rate-bounded provider transition;
- [ ] safety changes make the prior snapshot incompatible; published reads degrade to no-Hero until reconciliation, while unpublished reads expose no product bytes immediately;
- [ ] a code-only renderer epoch/digest activation enqueues reconciliation, advances the committed generation/snapshot/renderer tuple, recomputes every affected component/composite/shared-shell fingerprint from actual output (allowing a digest to remain byte-equal when output is unchanged), and restores coherent early and semantic public views without any merchant DB write;
- [ ] an old worker that started before renderer activation finishes after the new version commits and is rejected without pointer/fingerprint regression or a backward successor;
- [ ] delivery release R1 claims, then: (a) byte-identical-renderer/protocol release-only R2 rejects late R1 complete/retry/transfer, waits for lease expiry, and safely reclaims the same frozen obligation; and (b) renderer-changing R2 retargets unclaimed work, creates one exact-superset successor for claimed/retry work, never lets R2 claim the old renderer, blocks the successor until the predecessor lease expires, completes the successor, and only then covers the predecessor through generic `skipped` plus specialized `superseded|covered`;
- [ ] renderer activation races before build, after old snapshot commit, and at every routing/Vercel/Cloudflare/prewarm/canary stage; worker death and lease expiry, successor failure/retry, exact obligation/receipt union, active-release coverage authorization, and receipt-outcome conflict all converge without an early skip or stale-renderer commit;
- [ ] old-generation cache producer finishes after a purge;
- [ ] direct DB/worker safety mutation creates immediate safety work; direct content mutation creates one debounced home target;
- [ ] continuous content mutation creates bounded supersession rather than purge-loop livelock;
- [ ] `G1 advanced → provider failure → G2 advanced` transfers and unions the outstanding duty before superseding G1; an `unchanged` successor leaves G1 current and retryable;
- [ ] `G1 shared_shell advanced → provider failure → G2 home_content advanced` preserves the shared-shell all-document duty on the one successor; the reverse sequence upgrades home to shared shell, and neither ordering emits two provider transitions for the same covered output;
- [ ] a safety mutation arriving over a failed shared-shell duty either executes the combined all-document purge plus canonical home/category/PDP/blog canaries or atomically leaves an attached shared-shell successor; browser/Googlebot home-only safety proof cannot mark the shared-shell predecessor covered;
- [ ] a claim freezes target/identity fields while guarded lifecycle fields advance; later mutations coalesce into exactly one pending successor and append-only audit events preserve every transition;
- [ ] domain insert/delete, status change, hostname change, merchant reassignment, merchant slug change, and slug-alias deletion preserve every OLD+NEW purge identity;
- [ ] chained safety changes `A → B → C` retain every distinct still-unpurged identity, keep one newest non-contradictory outcome per identity, do not double-advance safety-owned content fields, and complete despite continuous ordinary content writes; include same-host publish→unpublish and owner `A → B → C` assertions that no claim asks one hostname to satisfy two owners/states;
- [ ] concurrent workers and zones respect one provider-limit-scoped account/plan/operation budget, prioritize safety without bypassing capacity, chunk without truncation, and honor `Retry-After` without an inline retry;
- [ ] Vercel failure, Cloudflare failure, and process death after the DB commit;
- [ ] wrong merchant, detached/reassigned domain, retired alias, malformed projection;
- [ ] empty catalog is a valid published snapshot with neutral no-product geometry, not a cached error.
- [ ] Run the SQL integration test against a disposable local Supabase database; source-text regex tests do not count as proof of trigger, RLS, grant, or transaction behavior.

---

## Normative Contract H1B/H1C: Durable Routing And Cache Completion

**Create**

- **H1C1:** `apps/web/src/lib/events/storefront-cache-transition-destination.ts` and colocated test
- **H1C1:** `apps/web/src/lib/events/storefront-cache-transition-data-access.ts` and colocated test
- **H1C1:** `apps/web/src/lib/events/storefront-cache-event-route.ts` and colocated test
- **H1C1:** `apps/web/src/lib/cache-provider-purge-budget.ts` and colocated test
- **H1C1:** `apps/web/src/lib/storefront-cache-operations-alert.ts` and colocated test
- **H1C1:** `apps/web/src/lib/vercel-storefront-cache-purge-actuator-client.ts` and colocated test
- **H1C1:** `apps/web/src/lib/storefront-cache-purge-actuator-auth.ts` and colocated test, reusing `constant-time-equal.ts`
- **H1C1:** `apps/web/src/lib/storefront-public-fetch-policy.ts` and colocated test
- **H1C1:** `apps/web/src/config/ogabassey-canary-document-manifest.ts` and colocated test
- **H1C1:** `apps/web/src/config/storefront-critical-cache-transition.ts` and colocated test
- **H1C1:** `apps/web/src/config/storefront-cache-protocol.ts`
- **H1C1:** `apps/web/src/config/storefront-cache-protocol-manifest.ts` and colocated test
- **H1C1:** `apps/web/tools/perf/assert-storefront-cache-protocol.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-purge-actuator-request.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-purge-actuator-response.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-purge-actuator-probe-response.ts` and colocated test
- **H1B:** `apps/web/src/schemas/storefront-routing-edge-record.ts` and colocated test
- **H1B:** `apps/web/src/schemas/storefront-routing-v2-live-record.ts` and colocated test
- **H1B:** `apps/web/src/schemas/storefront-routing-resolution.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-routing-v2-activation.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-edge-config-write-lease.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-invalidation-claim.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-provider-outcome.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-cache-canary-outcome.ts` and colocated test
- **H1C1:** `apps/web/src/schemas/storefront-worker-release-capability.ts` and colocated test
- **H1C2:** `apps/web/src/app/api/internal/storefront-cache/purge-vercel-tags/route.ts` and colocated test
- **H1D1:** `apps/web/src/app/api/merchant/publish/status/route.ts` and colocated test
- **H1C2:** `apps/web/src/lib/storefront-home-response-cache-tags.ts` and colocated test
- **H1C2:** `apps/web/src/lib/storefront-shared-shell-response-cache-tags.ts` and colocated test
- **H1C2:** `apps/web/src/components/storefront/storefront-tenant-routing-marker.tsx` and colocated test; the home-only marker exposes only a versioned tenant-route proof digest and exact canonical home URL, never merchant/product bytes
- **H1C2:** `apps/web/src/schemas/storefront-tenant-routing-proof.ts` and colocated test, owning canonical digest construction/parsing for non-Oga reassignment canaries
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-storefront-safety-marker.tsx` and colocated test; it is the byte-stable standalone proof only for persistent disabled legacy output under either deployed renderer
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-shared-shell-marker.tsx` and colocated test, owning one versioned route-wide compatible shared-shell proof for shell 0 and later shell 1; the standalone safety marker remains only for persistent disabled legacy output
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-semantic-snapshot-marker.tsx` and colocated test; this deferred, product-byte-free marker carries only merchant/shell/generation, `homeSemanticFingerprint`, and the matching composite and is never a Web Vitals context source
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-dynamic-content-semantic.test.tsx`, receiving the existing JSON-LD/projection cases so both it and the retained `ogabassey-home-dynamic-content.test.tsx` finish at `<=300` lines
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-document-snapshot.ts` and colocated test, the one React-request-memoized admission adapter that loads the early view, loads the exact deferred semantic/link view, validates the complete LCP/semantic/link/critical/shared/static/document tuple, enforces the byte/latency budget, and returns one coherent server-only document object before rendering begins
- **H1C2:** `apps/web/src/app/(storefront)/[slug]/(home)/page-h1-critical-projection.test.tsx`, receiving new shell-0 metadata/early-view identity cases so the existing near-limit `page.test.tsx` remains `<=300` lines
- **H1C2:** `apps/web/src/app/(storefront)/storefront-home-critical-ogabassey.css`, receiving the OgaBassey-specific critical rules and exact Tailwind `@source` entries from the oversized current critical stylesheet
- **H1C2:** `apps/web/src/app/(storefront)/storefront-css-partition-fixtures.ts`, `storefront-critical-css-source-discovery.test.ts`, and `storefront-deferred-css-partition.test.ts`, replacing the oversized combined CSS-partition test with focused files under `300` lines
- **H1C2:** `apps/web/src/schemas/storefront-home-feed-query.ts` and colocated test, validating the exact public identifier/cursor/limit boundary for the no-store client feed
- **H1C2:** `apps/web/src/schemas/storefront-home-feed-response.ts` and colocated test, owning the exact bounded card projection and opaque next-cursor response
- **H1C2:** one next-free append-only migration defining `get_ogabassey_home_feed_v1` plus focused SQL/RLS/grant tests; regenerate `apps/web/src/types/supabase.ts` from a clean replay in this phase and never hand-edit it
- **H1C2:** `apps/web/src/app/api/storefront/home-feed/route.ts` and colocated test, a tenant/host-bound public GET using the typed anon client, exact projection, query-level abort, `retry(false)`, and `Cache-Control: private, no-store, max-age=0` with no `CDN-Cache-Control`
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-home-feed-skeleton.tsx` and colocated test, owning fixed responsive geometry and accessible loading semantics with zero product rows
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-home-feed-client.tsx` and colocated test, a small intersection/idle client island that calls the same-origin endpoint with `fetch(...,{cache:'no-store'})` and never competes with the initial Hero request
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-home-crawlable-links.tsx` and colocated test, rendering only the immutable bounded `{name,href}` projection as ordinary server anchors after the Hero
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-client-shell-islands.tsx` and colocated test, owning only personalized/user/cart widgets whose data is absent from initial HTML/RSC and fetched no-store after hydration
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-static-shared-header.tsx` and colocated test, rendering only the immutable product-free shared-shell projection with canonical absolute links
- **H1C2:** `apps/web/src/components/storefront/ogabassey/ogabassey-static-shared-footer.tsx` and colocated test, rendering only the immutable product-free shared-shell projection with canonical absolute links
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-page-metadata-projection.ts` and colocated test, keeping `(home)/page.tsx` below 300 lines while consuming only the same request-memoized route resolution/early projection as parent metadata/layout; it never calls or receives the deferred semantic/link view
- **H1C2:** `apps/web/src/lib/storefront-public-safety-proof.ts` and colocated test, the one React-request-memoized typed anon adapter used by metadata/layout/home/category/PDP/blog markers and compared byte-for-byte with the home early view's embedded proof
- **H1C2:** `apps/web/tools/perf/measure-ogabassey-semantic-admission.ts` and colocated test, producing the 30-sample exact-snapshot admission receipt from the same typed early/deferred adapters
- **H1C2:** `apps/web/tools/perf/publish-ogabassey-semantic-admission-receipt.ts` and colocated test, creating and immediately reading back only the protected annotated-tag receipt ref
- **H1C2:** `apps/web/src/schemas/ogabassey-semantic-admission-receipt.ts` and colocated test, owning canonical bounded receipt parsing/serialization for producer, publisher, workflow loader, and field comparator
- **H1C1:** `apps/web/src/lib/storefront-home-purge-ownership.ts` and colocated test
- **H1C1:** `apps/web/src/lib/storefront-cache-runtime-env.ts` and colocated test, owning the new server-only environment projection
- **H1D1:** `apps/web/src/lib/storefront-publication-route-handler.ts` and colocated test, owning the validated mutation/receipt mapping behind the thin route
- **H1D1:** `apps/web/src/hooks/use-store-publish-transition.ts` and colocated test
- **H1D1:** `apps/web/src/components/dashboard/store-publish-propagation-status.tsx` and colocated test
- **H1C1:** `packages/shared/src/cloudflare-provider-budget-contract.ts` and colocated test, exporting a typed facade over the canonical runtime JSON without secrets
- **H1C1:** `packages/shared/src/runtime/cloudflare-provider-budget-v1.json`, `cloudflare-provider-budget-v1.lua`, and `cloudflare-provider-budget-runtime.mjs`, plus deterministic multi-caller/parity tests; keeping every runtime artifact under the package `rootDir` makes its export/tracing ownership explicit. The MJS loader is directly executable by repository Node, VPS, and GitHub runners and returns the exact checked-in JSON plus Lua digest/bytes
- **H1C1:** `.github/scripts/cloudflare-provider-budget.mjs` and test, importing the canonical runtime through the explicit repository-relative `../../packages/shared/src/runtime/cloudflare-provider-budget-runtime.mjs` path; root has no `@baci/shared` dependency, so a bare workspace-package import is forbidden here
- **H1C1:** `vps-workers/lib/cloudflare-provider-budget.mjs` and test, importing that same canonical runtime through the release-relative `../../packages/shared/src/runtime/cloudflare-provider-budget-runtime.mjs` path rather than copying/reimplementing the token bucket
- **H1C1:** `vps-workers/deploy.test.mjs`, because no such test exists on current main/#3077; it is new coverage, not a file to modify
- **H1C1:** `apps/web/tools/ops/activate-storefront-routing-v2.ts` and colocated test
- **H1C1:** `apps/web/tools/ops/manage-storefront-critical-control.ts` and colocated test
- **H1C1:** `apps/web/src/lib/storefront-routing-v2-writer.ts` and colocated test
- **H1C1:** `apps/web/src/lib/storefront-routing-v2-activation.ts` and colocated test
- **H1C1:** `docs/ops/storefront-critical-cache-transition-rollback.md`

**Modify**

- **H1C1:** the P0-created `apps/web/tsconfig.tools-workers.json`, preserving both exact `src/scripts/process-domain-events.ts` and `process-event-deliveries.ts` entrypoints/tests and extending coverage to every H1 operator/performance/protocol tool plus all transitive imports; the P0 package/turbo/Quality-Gate contract and H0 extension test must remain green without editing the oversized CI workflow
- **H1C1:** `apps/web/src/lib/storefront-publication-cache-eviction.ts` and test
- **H1C1:** `apps/web/src/lib/storefront-product-purge-urls.ts` and test
- **H1C1:** `apps/web/src/lib/storefront-product-purge.ts` and test
- **H1C1:** `apps/web/src/lib/revalidate-products-reliable.ts` and test
- **H1C1:** `apps/web/src/app/api/internal/revalidate-products/route.ts` and test
- **H1C1:** `apps/web/src/app/api/cache/revalidate/route.ts` and test
- **H1C1:** every product-purge caller and its colocated test: `apps/web/src/app/api/products/route.ts`, `apps/web/src/app/api/products/[id]/route.ts`, `apps/web/src/app/api/products/[id]/archive/route.ts`, and `apps/web/src/app/api/products/bulk-update/route.ts`; a static call-site inventory must fail when a new caller omits merchant id or bypasses the ownership resolver
- **H1D1:** `apps/web/src/lib/merchant-publish-client.ts` and test
- **H1D1:** `apps/web/src/app/dashboard/client-page.tsx` and test
- **H1D1:** `apps/web/src/components/dashboard/setup-checklist.tsx` and test
- **H1D1:** `apps/mobile-admin/hooks/useStorePublish.ts` and test
- **H1D1:** `apps/web/src/app/api/merchant/publish/route.ts` and test, preserving all existing auth/CSRF/KYC/payment behavior while replacing only the publication mutation/response lane
- **H1C1:** `apps/web/src/env.ts` and its existing tests, adding only the new server-side cache-worker/actuator/alert configuration
- **H1C1:** the decomposed merged-#3116 `apps/web/next.config.ts` and focused config modules/tests, preserving the application-owned `cacheHandlers.remote` registration; define one checkout-local root as `path.resolve(__dirname, '../..')`, set both `outputFileTracingRoot` and `turbopack.root` to that exact absolute path, and add the three route-consumer `outputFileTracingIncludes` globs **relative to `apps/web`** as `../../packages/shared/src/runtime/cloudflare-provider-budget-v1.json`, `../../packages/shared/src/runtime/cloudflare-provider-budget-v1.lua`, and `../../packages/shared/src/runtime/cloudflare-provider-budget-runtime.mjs`. The contract test must fail when the resolved root is the surrounding `/Users/mac/Baci-app` checkout instead of the current worktree/release checkout, preserve the existing middleware include, prove the handler registration, and inspect every consuming `.nft.json` for all three real files.
- **H1C1:** `packages/shared/package.json`, exporting the typed Cloudflare budget contract and Node-compatible runtime loader from the exact `src/runtime` files without exposing secrets
- **H1C1:** `packages/shared/tsconfig.json`, deliberately enabling `resolveJsonModule` while retaining `rootDir: "./src"` and `include: ["src/**/*"]`; the shared-package typecheck and export/runtime parity tests must prove the typed facade resolves the canonical JSON and the Node/VPS/GitHub loader resolves the same JSON/Lua bytes
- **H1C1:** merged-#3116 `turbo.json`, preserving its remote-cache build environment while adding every new build/runtime-sensitive server variable to `tasks.build.env` so cached builds cannot erase or reuse a different cache-handler/actuator/worker contract
- **H1C1:** `apps/web/src/lib/vercel-storefront-publication-cache.ts` and its existing colocated test
- **H1C1:** `apps/web/src/lib/cloudflare-purge.ts` and test
- **H1C1:** `apps/web/src/lib/cache-revalidation.ts` and test, routing blog/content purge scheduling through explicit low-priority admission
- **H1C1:** `apps/web/src/lib/image-format-backfill.ts` and test, routing wet-run purges through the explicit `image_backfill` class
- **H1C1:** `.github/scripts/cloudflare-purge-cache.mjs` and test
- **H1C1:** `.github/scripts/storefront-sitemap-purge.mjs` and test
- **H1C1:** `.github/workflows/deploy.yml`, wiring the shared Redis admission secrets only to purge steps and preserving honest required-versus-best-effort outcomes
- **H1B:** `apps/web/src/lib/domain-cache-simple.ts` and colocated test
- **H1B:** `apps/web/src/lib/slug-alias-cache.ts` and colocated test
- **H1B:** `apps/web/src/lib/edge-config-keys.ts` and colocated test
- **H1C1:** `apps/web/src/lib/edge-config-sync.ts` and colocated test
- **H1C1:** `apps/web/src/app/api/edge-config/sync/route.ts` and colocated test
- **H1C1:** merged #3077's `apps/web/src/lib/events/event-destination.ts` plus a new colocated test, adding the internal discriminated worker context without widening the external four-provider `EventDestination` registry
- **H1C1:** merged #3077's `apps/web/src/lib/events/deliver-domain-event.ts` and test, dispatching the storefront destination through the server-only adapter with its destination-specific deadline
- **H1C1:** merged #3077's `apps/web/src/lib/events/event-pipeline-config.ts` and test, adding independent storefront ingress plus delivery enablement/concurrency without changing existing analytics defaults
- **H1C1:** merged #3077's `apps/web/src/scripts/process-domain-events.ts` and test, retaining the analytics PGMQ reader only for `shadow|active` while running the exact-release-fenced `route_pending_storefront_cache_transitions_v1` lane whenever storefront ingress is enabled; the specialized lane never invokes the external registry or generic PGMQ reader
- **H1C1:** merged #3077's `apps/web/src/scripts/process-event-deliveries.ts` and test, replacing the unfiltered generic claim loop with two explicit lanes in the same process: existing destinations exclude storefront cache; storefront claims are safety-first and destination-filtered

The checked-in `ogabassey-canary-document-manifest.ts` is the sole nested-route source for provider canaries. During H1 it is generated once from the exact downloaded H0 `target-manifest.json`, then reviewed and committed with schema version, the recorded `H0_TARGET_MANIFEST_SHA256`, canonical origin, and exactly one normalized path each for home, category, PDP, and blog. Its test recomputes the canonical manifest digest, rejects duplicate/missing/extra kinds, query/fragment/cross-origin paths, and proves every path came from that exact H0 artifact. It is a semantic cache-protocol entrypoint and frozen into every safety/shared-shell claim by digest; the worker never discovers or substitutes a route at runtime. A later deleted/moved category, PDP, or blog target yields typed `CANARY_DOCUMENT_UNAVAILABLE`, keeps the provider duty retryable/dead-letter-visible, and requires an operator-reviewed manifest/protocol update plus normal drain/rotation before replay—never a silent replacement or false completion.
- **H1C1:** merged #3077's `apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts` and test, extending it with a destination filter and sanitized storefront-cache projection while preserving its caller-bound authenticated client and operator check
- **H1C1:** merged #3077's `apps/web/src/app/api/admin/event-pipeline/replay/route.ts` and test, extending its CAS/replay contract for cache delivery while preserving its caller-bound authenticated client, `is_event_pipeline_operator_v1()` authorization, exact operator UUID, and audit; preserve the applied `20260714000100`–`20260714000400` files byte-for-byte, require P0's dual-order effect proof, and add only a new uniquely timestamped append-only repair if an intended effect is missing. Never retimestamp or rewrite that chain
- **H1C1:** merged #3077's event-router/delivery schemas, data access, and heartbeat code/tests needed for `record_event_worker_release_heartbeat_v2`; do not fork generic lifecycle or operator state under cache-only names
- **H1C1:** every current `triggerDomainEdgeConfigSync()` caller and its test: domain delete, verify, purchase, domain create/update, slug rename, payment webhook, and dashboard domain actions
- **H1C2:** `apps/web/src/proxy.ts` and `apps/web/src/proxy.test.ts` **only after explicit approval**
- **H1C2:** `apps/web/src/app/(storefront)/[slug]/layout.tsx` and focused tests, making the control-managed Oga branch consume only the request-memoized public safety proof plus early critical view's immutable shared-shell projection while preserving generic routes. It must never call the deferred home semantic/link RPC; category/PDP/blog tests assert zero home-document-adapter and zero semantic RPC calls. Only the home page calls `getOgabasseyHomeDocumentSnapshot`. No live merchant/chrome byte may enter the completed Oga home object.
- **H1C2:** `apps/web/src/components/storefront/ogabassey/storefront-layout.tsx` and colocated test, adding a discriminated compatible-Oga branch that accepts only the exact shared-shell projection and renders the static header/footer, fixed client-island placeholders, canonical speculation rules, and widget enable bit; the existing `MerchantData` branch remains only for generic/legacy fallback and is unreachable from a compatible control-managed Oga route
- **H1C2:** `apps/web/src/components/storefront/ogabassey/storefront-shell-layout.tsx` and colocated test, replacing compatible-path `MerchantData` styling with the validated theme projection while retaining the generic fallback signature behind an explicit discriminant
- **H1C2:** `apps/web/src/components/storefront/ogabassey/storefront-chrome-runtime.tsx`, `storefront-layout-chrome.tsx`, `storefront-deferred-footer-chrome.tsx`, and `storefront-deferred-overlay-chrome.tsx` plus their colocated tests, narrowing reusable client-island props and proving the compatible Oga server branch imports no full merchant/context renderer; any retained full-merchant path is generic/legacy-only
- **H1C2:** `apps/web/src/components/storefront/ogabassey/layout/navbar.tsx`, `navbar-secondary-nav.tsx`, `navbar-search.tsx`, `navbar-notifications.tsx`, `navbar-notifications-panel.tsx`, `mobile-menu.tsx`, `footer.tsx`, and `apps/web/src/components/storefront/ogabassey/components/Footer.tsx` plus their colocated/focused tests as applicable, either extracting narrow interactive islands used by the new static header/footer or proving the existing full-context component is reachable only from generic/legacy fallback. The compatible branch must not call `useMerchantSafe`, derive `basePath`, or serialize cart/user/search result/product rows.
- **H1C2:** `apps/web/src/components/storefront/ogabassey/storefront-speculation-rules.tsx` and test plus `apps/web/src/components/analytics/deferred-google-store-widget.tsx` and test, consuming only the canonical projection patterns/widget boolean on the compatible path and emitting fixed server markup; no full merchant object crosses that boundary
- **H1C2:** `apps/web/src/app/(storefront)/[slug]/(home)/page.tsx`, `page.test.tsx`, and `page-metadata.test.ts`. In addition to the routing marker/exact identifier, shell-0 `generateMetadata` must consume the same request-memoized early projection as the Hero and serialize its page-owned metadata fields exactly; it may not call `buildOgabasseyStaticHomeMetadata()` or perform a second merchant/snapshot read for a compatible control-managed OgaBassey request. Generic/unbound and disabled legacy branches retain their existing metadata behavior.
- **H1C2:** `apps/web/src/app/(storefront)/[slug]/(home)/ogabassey-static-home-page.tsx` and colocated test, threading that exact identifier into the two generation-checked H1 projection consumers without reading request headers on the static prefix
- **H1C2:** `apps/web/src/components/storefront/ogabassey/storefront-layout.tsx` and colocated test, integrating the versioned shared-shell marker once for every ready compatible Oga identity home and canonical home/category/PDP/blog document under shell `0`, while persistent disabled legacy alone receives the standalone safety marker
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.tsx` and test, preserving the H0 schema/component while adding typed H1 values
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-shell-data.ts` and test, replacing its independent merchant/launch-product reads and uncancelled 500 ms `Promise.race` with the bounded abortable early committed-snapshot adapter; it returns no semantic graph bytes and preserves canonical absolute PDP links
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-resource-hints.ts` and colocated test, delegating every connection/preload attribute to the H1A pure resource-hint projection; direct `getImageProps`/loader/AVIF/media recomputation outside that pure builder is forbidden
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-static-home-page-content.tsx` and test, receiving the request-memoized coherent document snapshot, sourcing preload/fallback/early render data only from its early view, and passing its exact generation/component/composite tuple into the request guard; it never passes semantic bytes into the Hero component
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-page-content.tsx` and test, preserving the request-scoped publication and exact-tenant guard while rendering the H1 measurement marker immediately before the request-owned Hero from the same early projection; mismatch/unpublished/unbound states render no marker or shopping Hero
- **H1C2:** `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-dynamic-content.tsx` and test, removing every independent fingerprint-owned identity/trust/navigation/category/blog/launch-product/CollectionPage graph build, receiving the already-admitted full semantic/link projection from the same document snapshot and rendering its semantic marker, prebuilt graph, crawlable anchors, fixed feed skeleton, and client feed island after the Hero; it performs no public RPC or live fingerprint-owned read, and serializes zero visible feed product rows into initial HTML/RSC
- **H1C2:** `apps/web/src/components/storefront/ogabassey/pages/home.tsx` and colocated test. When `renderHero=false`, it must perform zero `buildLaunchSlides` work and must not server-render the product grid/feed; the test spies on the builder and proves no slide construction or serialized product rows while preserving only the reviewed product-free continuation/analytics shell. This removes duplicate request-path Hero/feed work after H1 moves ownership to the committed projection plus no-store client surface.
- **H1C2:** `apps/web/src/app/(storefront)/storefront-home-critical.css`, reducing it to a bounded base/facade that imports `storefront-home-critical-ogabassey.css` in deterministic order; both CSS files must finish at `<=300` lines, and the renderer-manifest CSS walker must hash/follow the local `@import` plus every exact `@source` edge.
- **H1C2:** replace `apps/web/src/app/(storefront)/storefront-css-partition.test.ts` with the three focused CSS-partition files listed under Create; preserve every existing assertion and add shell-0 marker/semantic/resource-hint/page-source coverage.
- **H1C1:** merged #3077's `vps-workers/bin/process-domain-events.sh`, `process-event-deliveries.sh`, wrapper tests, service installer/tests, deployment path, heartbeat, and one-minute recovery sweeps where exact release/config/capability assertions must recognize the new internal route and delivery lane; do not add another service or crontab entry
- **H1C1:** `vps-workers/deploy.sh`, adding exact-SHA release-directory installation, atomic source-pointer switching, restart/readback, and rollback for the separate worker checkout rather than merely rsyncing wrapper files; its new test is listed under Create
- **H1C1:** merged #3077's durable-event operations runbook, adding the storefront-cache destination states, coverage proof, and rollback/recovery drill
- **H1C1:** `docs/ops/vps-workers.md`

**The no-store feed is a separately bound public interface, not an unscoped product query.** The H1C2 migration defines exactly:

```text
get_ogabassey_home_feed_v1(
  p_requested_identifier text,
  p_after_created_at timestamptz default null,
  p_after_id uuid default null,
  p_limit integer default 12
)
```

It is a fixed-`search_path` SECURITY DEFINER function with execute revoked from `public`/`authenticated`/`service_role` and granted only to `anon`; it resolves the normalized identifier through the same database-authoritative public identity rules, requires the resolved merchant to equal `OGABASSEY_MERCHANT_ID`, requires publication true in the same statement snapshot, clamps `p_limit` to `1..12`, requires both cursor fields together, and returns only active publicly eligible products in total order `created_at DESC, id ASC` using the keyset predicate `created_at < cursor_created_at OR (created_at = cursor_created_at AND id > cursor_id)`. Each row is exactly `{id,name,canonicalAbsoluteHref,priceMinor,currency,imageUrl,imageAlt,categoryName,createdAt}`; URL construction is canonical-origin-bound, `priceMinor` is a canonical unsigned decimal string representing the integer minor-unit value and is parsed/validated without JavaScript precision loss, and no description, cost, stock quantity, supplier, merchant row, hidden category, or admin field is exposed. The route parses the query before database access, decodes/re-encodes one opaque base64url cursor through the response schema, derives the effective host only through the existing trusted proxy/host normalizer, and requires that host binding and query identifier resolve to the same public Oga identity. It uses the generated `SupabaseClient<Database>`, `.rpc(...,{get:true})`, `AbortSignal.timeout(5_000)`, `.retry(false)`, and `resolveStorefrontReadResult`; it never accepts cookies as authority and never creates an admin/service-role client. Cross-host, reassigned, unpublished, unbound, cursor-mismatch, timeout, schema, and database failures return the reviewed empty/404/4xx/503 shape with `Cache-Control: private, no-store, max-age=0`, `Pragma: no-cache`, and no `CDN-Cache-Control` on every path. Tests prove no successful or error response is CDN-cacheable, no other tenant can be enumerated, and initial HTML/RSC contains the fixed skeleton plus zero feed row values.

The SQL function pins the canonical OgaBassey merchant UUID as the literal `6b5cb8a4-5575-456c-b936-8cdfae30db74` inside the append-only migration; SQL cannot import a TypeScript symbol and may not accept a caller-supplied merchant id. A contract test reads `apps/web/src/config/ogabassey.ts`, extracts `OGABASSEY_MERCHANT_ID`, and requires byte-equality with the migration literal and every feed fixture. The unrelated historical AI/chat constants using another UUID are explicitly out of this storefront contract and must never satisfy the feed function.

**Semantic-admission receipt production is exact and precedes a campaign.** On the exact deployed checkout after H1 enablement canaries or H2 promotion canaries, the rollout operator runs the derived plan's fully expanded form of:

```bash
pnpm --dir apps/web exec tsx tools/perf/measure-ogabassey-semantic-admission.ts \
  --base-url https://ogabassey.com \
  --identifier ogabassey.com \
  --merchant-id "$OGABASSEY_MERCHANT_ID" \
  --expected-sha "$EXACT_SHA" \
  --expected-deployment-marker "$DEPLOYMENT_MARKER" \
  --expected-renderer-epoch "$RENDERER_EPOCH" \
  --expected-renderer-digest "$RENDERER_DIGEST" \
  --expected-shell-version "$SHELL_VERSION" \
  --expected-presentation-mode "$PRESENTATION_MODE" \
  --expected-control-render-mode "$CONTROL_RENDER_MODE" \
  --samples 30 \
  --output "$TMPDIR/ogabassey-semantic-admission.json"
pnpm --dir apps/web exec tsx tools/perf/publish-ogabassey-semantic-admission-receipt.ts \
  --receipt "$TMPDIR/ogabassey-semantic-admission.json" \
  --expected-sha "$EXACT_SHA"
```

The measure tool first proves browser and Googlebot raw home canaries have the expected deployment marker and one compatible marker/semantic/document tuple, then prewarms the exact typed early and deferred RPC adapters once. It performs exactly 30 serial samples with a fresh request memoization scope per sample: time/validate/hash the early adapter alone, then time the real sequential early→deferred document-admission path plus canonical parse/digest checks; alternate only the outer early-only-versus-paired measurement order to bound order bias, never the production adapter order. Every sample records monotonic wall times, parse+digest CPU, early/deferred object hashes, semantic/link canonical byte hashes/sizes, and the exact requested identifier, merchant, safety/content/shared generations, required+committed renderer tuple, shell/control/presentation modes, all component/composite/document fingerprints, adapter manifest digest, and exact SHA. The same tuple must remain byte-equal in pre/mid/post canaries and all 30 samples. Any redirect, cache/marker drift, nonfinite time, object drift, more/less than 30 samples, semantic graph above `64 KiB`, crawlable-link payload above `8 KiB`/24 rows, combined deferred payload above `72 KiB`, parse+digest CPU above `10 ms`, or paired-minus-early p95 above `150 ms` fails without a receipt. The canonical schema is bounded to `16 KiB`, contains hashes/timings rather than raw product/contact content, and its SHA-256 is the receipt id.

The publish tool requires a short-lived operator `GH_TOKEN` with repository contents-write, creates one annotated tag object targeting exactly `EXACT_SHA` whose message is the canonical receipt JSON, then creates only `refs/tags/ogabassey-semantic-admission/<receipt-sha256>`. It immediately reads ref and tag object back, recomputes the payload digest, and verifies the target commit. It exposes no update/delete/force path. If the exact ref already exists after a response-loss retry, byte-identical ref/object/message is idempotent success; any other object/target/message is a hard collision. The active no-bypass ruleset makes the ref immutable. Only after readback prints `SEMANTIC_ADMISSION_RECEIPT_SHA256=<digest>` may H1/H2 dispatch its sole campaign with that exact input; the temporary file is deleted after the workflow control job has independently read back the tag. H0/H0R never run these tools and carry the empty receipt key.

**Cloudflare runtime resolution is one artifact, not one assumed package install.** Web/TypeScript consumers use the exported typed facade. Next pins `outputFileTracingRoot` and `turbopack.root` to the current checkout's `path.resolve(__dirname, '../..')`; because `outputFileTracingIncludes` globs are evaluated from `apps/web`, it traces the exact JSON/Lua/MJS files only through the explicit `../../packages/shared/src/runtime/...` paths above. A surrounding checkout/lockfile may never become the inferred root. GitHub's root-run Node scripts use the explicit repository-relative MJS path because root neither depends on nor links `@baci/shared`. The VPS wrapper uses the release-relative MJS path inside `/opt/baci/releases/<full-sha>`; `vps-workers/deploy.sh` installs the immutable whole-repository checkout, verifies all three canonical files and their recorded digests at `<release>/packages/shared/src/runtime`, executes the VPS loader smoke test from that release, and only then switches `BACI_REPO_DIR`. It never copies them into an unversioned global directory. CI parity tests load the web facade, repository-root GitHub wrapper, and release-layout VPS wrapper and require the exact same JSON bytes/Lua digest/token decisions.

**Modularity/existing-file boundary is a gate, not a waiver.** Before each H1A/H1B/H1C1/H1C2/H1D1/H1D2 phase PR, run the repository line/export inventory over the complete proposed diff and final touched tree. Every touched non-proxy source/config/test/runtime file—not merely every newly owned module—must finish at `<=300` lines with one primary export/responsibility. The current baseline makes the needed extractions explicit: merged-#3116 `next.config.ts` (`761`), `src/env.ts` (`1641`) and its test (`1279`), `publish/route.ts` (`402`) and test (`1055`), `cache-revalidation.ts` (`525`) and test (`1046`), `dashboard/client-page.tsx` (`814`), and `setup-checklist.tsx` (`760`) cannot be touched and left oversized. Split them phase-locally into focused Next-config modules, the named typed env projection, publication handler, provider-admission/revalidation helpers, publish hook/status component, and focused behavior test files; leave each original as a thin facade only if it too is `<=300`. Because #3116 is now merged, H1C1 must perform the Next-config split before adding tracing/Turbopack-root behavior, preserve every merged handler/config semantic, and finish the touched tree within the limit. Apply the same inventory to the merged #3077 diff and any event/data-access aggregator. Do not paste state machines, schemas, provider admission, or receipt polling into existing large files. For protected `proxy.ts`, the approval record must choose one of two exact paths: authorize a separately reviewed mechanical decomposition with byte-for-byte routing/security regression proof, or explicitly grandfather its pre-existing length for **only** the three small helper calls while every new branch/parser/tag/auth behavior remains in under-300-line tested modules. The three functional approvals alone do not authorize broad proxy refactoring, and silence is not a line-limit exception; without the recorded choice H1C2, H1 enablement, and H2 remain blocked.

**H1 phase ownership is normative; this is not one PR.** H1B owns only reader-first routing. H1C1 owns inert reconciliation/provider/worker operations and typed actuator client. H1C2 owns only the protected web/actuator boundary, approved proxy scopes, markers/tags, and protocol closure. H1D1 owns the additive publication cutover. H1D2 owns later ACL/context closure and **activation readiness only**; it must merge/deploy with every control final-disabled+null and may not run bootstrap activation. `H0R-H1-MEASURE` alone activates OgaBassey after a green H0R controlled campaign on the same SHA. Each slice has independent proof, and a combined H1B+C1+C2+D PR is rejected.

The new server configuration surface is exact: `STOREFRONT_CACHE_TRANSITION_INGRESS_ROUTING_ENABLED`, `STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED`, `STOREFRONT_CACHE_TRANSITION_CONCURRENCY`, `STOREFRONT_CACHE_PURGE_ACTUATOR_URL`, `STOREFRONT_CACHE_PURGE_ACTUATOR_SECRET`, and `STOREFRONT_CACHE_ALERT_WEBHOOK_URL`. Add each to the server-only `env.ts` schema/test and to `turbo.json` `tasks.build.env` because the web/worker build graph imports their config; never prefix them `NEXT_PUBLIC_`. Preserve any existing Edge/Redis/Cloudflare variables rather than creating aliases. H1C1/H1C2 config tests prove missing secrets/URLs keep flags off and control enablement fails; logs and build artifacts never expose values.

**Phase-local H1 gates are executable and cumulative.** The inline `**H1A:**`, `**H1B:**`, `**H1C1:**`, `**H1C2:**`, `**H1D1:**`, and `**H1D2:**` labels in the Create/Modify inventories are authoritative path ownership, not commentary; a derived plan may not move an entry to a different phase. The H1A-owned gate manifest lists only files that exist by the selected phase and rejects a later-phase source, migration, grant, route, or test appearing early. One committed `storefront-critical-active-phase.ts` marker—not an environment variable, PR label, or caller guess—selects the phase; every later H1 PR advances it exactly once. Its ordinary Vitest contract runs inside the existing Quality Gate and fails closed on an absent/invalid/backward marker, an unlabelled path, a path assigned to multiple phases, or a later-phase migration/grant/route appearing early. The only deliberate cumulative-path exceptions are `apps/web/src/types/supabase.ts` (regenerated in every schema-changing labelled phase) and the three phase-gate files themselves (created in H1A, then advanced by each labelled phase and H2); the manifest encodes those exceptions explicitly and rejects every other overlap. The local phase runner reads only that marker, performs a fresh disposable reset, the #3114 plain-SQL regression, cumulative phase SQL globs through fail-fast `psql`, phase-local generated-type regeneration/comparison when schema changes, exact focused Vitest/Node suites, the final-tree line/export inventory, `typecheck:tools-workers`, full lint/typecheck/test, and `git diff --check`. It emits a receipt containing phase, HEAD SHA, dirty-diff digest when local, migration/type/test manifest digests, and command outcomes. The existing CI does not pretend to rerun Docker/Postgres phase setup it does not own: merge requires both the attached clean exact-head local receipt and the standard exact-head Quality Gate whose normal tests validate the committed marker/manifest.

| PR phase | Cumulative SQL/type scope | Focused contract scope; later files are forbidden |
| --- | --- | --- |
| `H1A` | `storefront_critical_h1a_*.sql`; regenerate types | #3077 typed destination/claim isolation, snapshot/fingerprint/control/receipts, renderer sweep, operator/dead-letter, and phase-gate runner |
| `H1B` | H1A SQL/types unchanged | reader-first routing schemas/read path, bounded Edge keys, disabled/unsignaled merchant query-count/TTFB proof; no writer/provider/proxy/publication path |
| `H1C1` | H1A SQL/types unless an explicitly reviewed C1 schema addition forces regeneration | existing-process reconciler/provider lanes, Edge writer, central Cloudflare runtime/budget, alerts, public-fetch policy, VPS wrappers/deploy/heartbeats, operator tools, and actuator client/schemas; actuator route/auth/proxy/publication clients absent |
| `H1C2` | cumulative H1A/C schema and regenerated types if changed | actuator route/auth, approved proxy scopes, home/shared-shell response tags, generic tenant-routing marker, versioned compatible shell-0 shared marker plus disabled-legacy safety marker, exact identifier flow, early request-owned Hero/measurement projection, deferred semantic/link projection/marker, complete-document mixed-generation rejection, final shell-0 renderer-manifest successor plus cache-protocol closure; no publication cutover or control activation |
| `H1D1` | add every `storefront_critical_h1d1_*.sql`; regenerate types | eligibility parity, additive guarded publication RPC/trigger, route/client/mobile receipt semantics, old/new fleet compatibility; direct publication grants still present |
| `H1D2` | add every `storefront_critical_h1d2_*.sql`; regenerate types | fleet-drain proof, direct-column revoke, exact positive grants/projections/JWT matrix, activation-readiness/rollback rehearsal with controls final-disabled+null; then run the cumulative readiness gate below |

For each independent PR, update exactly one committed phase marker, run the dirty-tree gate before local review, then rerun it from the clean committed exact head before push. Receipts live under the external temp directory, never an unignored repository `artifacts/` path. The runner prints a sanitized receipt summary/digest for the PR evidence record; the full temporary JSON is deleted on exit. Use the same help-probed CodeRabbit gate before commit:

```bash
set -euo pipefail
umask 077
H1_GATE_TMP_ROOT="${RUNNER_TEMP:-${TMPDIR:-/tmp}}"
H1_GATE_RECEIPT="$(mktemp "$H1_GATE_TMP_ROOT/baci-storefront-critical-gate.XXXXXX")"
trap 'rm -f -- "$H1_GATE_RECEIPT"' EXIT
pnpm --dir apps/web exec tsx \
  tools/test/run-storefront-critical-phase-gate.ts \
  --phase-from-committed-marker \
  --allow-dirty \
  --receipt "$H1_GATE_RECEIPT" \
  --print-sanitized-summary
if coderabbit review --help | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git diff --check
```

After committing but before pushing, rerun the exact same tool with `--require-clean --expected-head "$(git rev-parse HEAD)"`, persist the printed receipt SHA-256/phase/head in the PR evidence, and delete the temporary file. The pushed current-head Quality Gate must then be green and its phase-marker/manifest test must report that same committed phase. The later cumulative H1D2 **readiness** gate references all H1 files but performs no activation; the derived `H0R-H1-MEASURE` plan owns rollout activation. Earlier slices cannot borrow a later receipt, and any commit/base merge invalidates evidence.

**Single-worker interfaces**

```ts
interface DeliverDomainEventOptions {
  timeoutMs?: number;
}

type DomainEventDeliveryContext =
  | {
      kind: 'provider';
      destination: EventDestination;
      event: DomainEventV1;
      supabase: SupabaseClient<Database>;
    }
  | {
      kind: 'storefront_cache_transition';
      claim: StorefrontCacheInvalidationClaim;
      supabase: SupabaseClient<Database>;
    };

async function deliverDomainEvent(
  context: DomainEventDeliveryContext,
  options?: DeliverDomainEventOptions,
): Promise<EventDestinationResult>;

interface StorefrontVercelPurgeActuatorRequest {
  version: 1;
  invocationId: string;
  transitionId: string;
  expectedDeploymentMarker: string;
  cacheProtocolVersion: 1;
  expectedCacheProtocolDigest: string;
  tags: string[];
}

interface StorefrontVercelPurgeActuatorProbeResponse {
  ok: true;
  deploymentMarker: string;
  gitCommitSha: string;
  cacheProtocolVersion: 1;
  cacheProtocolDigest: string;
  cacheControl: 'no-store';
}

type StorefrontVercelPurgeActuatorResponse =
  | {
      ok: true;
      invocationId: string;
      deploymentMarker: string;
      cacheProtocolVersion: 1;
      cacheProtocolDigest: string;
      deletedTagSetDigest: string;
    }
  | {
      ok: false;
      code:
        | 'AUTH_FAILED'
        | 'INVALID_REQUEST'
        | 'RELEASE_MISMATCH'
        | 'CACHE_PROTOCOL_MISMATCH'
        | 'NOT_VERCEL_RUNTIME'
        | 'VERCEL_PURGE_FAILED';
      retryable: boolean;
    };

type StorefrontEdgeConfigSyncReason =
  | 'domain_mutation'
  | 'domain_verification'
  | 'domain_purchase'
  | 'slug_rename'
  | 'payment_webhook';

async function triggerDomainEdgeConfigSync(input: {
  merchantIds: readonly string[];
  reason: StorefrontEdgeConfigSyncReason;
}): Promise<void>;

interface StorefrontRoutingV2SyncResult {
  v2Writes: number;
  v2Deletes: number;
  compatibilityV1Writes: number;
  compatibilityV1Deletes: number;
  readbackMatched: boolean;
  identities: readonly {
    identityKind: StorefrontRoutingIdentityKind;
    normalizedIdentity: string;
    identityVersion: string;
    outcome: 'route' | 'redirect' | 'absent';
    state: 'staged' | 'applied' | 'superseded';
  }[];
}

async function synchronizeClaimedStorefrontRoutingV2(
  claim: StorefrontCacheInvalidationClaim,
): Promise<StorefrontRoutingV2SyncResult>;

interface ActivateStorefrontRoutingV2Input {
  merchantId: string;
  operationId: string;
  desiredEnabled: boolean;
  expectedControlRowVersion: string;
  expectedOperatorReceiptRowVersion: string;
  expectedSafetyGeneration: string;
  expectedRowVersion: string;
  readerFirstSha: string;
  promotedReleaseSha: string;
  promotedDeploymentMarker: string;
}

async function activateStorefrontRoutingV2(
  input: ActivateStorefrontRoutingV2Input,
): Promise<StorefrontRoutingV2Activation>;

interface FinalizeStorefrontRoutingV2BootstrapInput {
  merchantId: string;
  operationId: string;
  bootstrapRevision: string;
  expectedControlRowVersion: string;
  expectedOperatorReceiptRowVersion: string;
  expectedActivationRowVersion: string;
  expectedSafetyGeneration: string;
  edgeConfigWriteLeaseToken: string;
  expectedEdgeConfigWriteLeaseRowVersion: string;
  stagedIdentityReadbacks: readonly {
    stageBindingId: string;
    identityObligationId: string;
    expectedBindingRowVersion: string;
    expectedGlobalRowVersion: string;
    identityVersion: string;
    expectedOutcome: 'route' | 'redirect' | 'absent';
    liveRecordDigest: string;
  }[];
  edgeActivationReadbackDigest: string;
  edgeLiveReadbackDigest: string;
}

async function finalizeStorefrontRoutingV2Bootstrap(
  input: FinalizeStorefrontRoutingV2BootstrapInput,
): Promise<StorefrontRoutingV2BootstrapFinalization>;

interface StorefrontRoutingV2BootstrapFinalization {
  merchantId: string;
  operationId: string;
  bootstrapRevision: string;
  controlRowVersion: string;
  operatorReceiptRowVersion: string;
  activationRowVersion: string;
  receiptState: 'pending';
  resumedWorkId: string;
  resumedWorkRowVersion: string;
  appliedIdentityCount: number;
}

type StorefrontRoutingIdentityKind =
  | 'custom_domain'
  | 'platform_subdomain'
  | 'platform_path'
  | 'canonical_domain';

interface StorefrontIdentityHomeFetchTargetBase {
  targetClass: 'identity_home';
  documentKind: 'home';
  identityKind: StorefrontRoutingIdentityKind;
  normalizedIdentity: string;
  hostname: string;
  path: '/' | `/${string}`;
  identityVersion: string;
}

type StorefrontIdentityHomeFetchTarget =
  | (StorefrontIdentityHomeFetchTargetBase & {
      expectedOutcome: 'route';
      expectedRedirectStatus: null;
      expectedRedirectLocation: null;
      expectedCanonicalUrl: string;
      assertionKind:
        | 'ogabassey_identity_route'
        | 'foreign_tenant_route';
    })
  | (StorefrontIdentityHomeFetchTargetBase & {
      expectedOutcome: 'redirect';
      expectedRedirectStatus: 301 | 302 | 307 | 308;
      expectedRedirectLocation: string;
      expectedCanonicalUrl: null;
      assertionKind: 'identity_nonroute';
    })
  | (StorefrontIdentityHomeFetchTargetBase & {
      expectedOutcome: 'absent';
      expectedRedirectStatus: null;
      expectedRedirectLocation: null;
      expectedCanonicalUrl: null;
      assertionKind: 'identity_nonroute';
    });

interface StorefrontCanonicalDocumentFetchTarget {
  targetClass: 'canonical_document';
  documentKind: 'home' | 'category' | 'pdp' | 'blog';
  identityKind: 'canonical_domain';
  normalizedIdentity: string;
  hostname: string;
  path: '/' | `/${string}`;
  expectedOutcome: 'route';
  expectedRedirectStatus: null;
  expectedRedirectLocation: null;
  expectedCanonicalUrl: string;
  identityVersion: string;
  canonicalManifestDigest: string;
  assertionKind:
    | 'safety_marker'
    | 'shared_shell'
    | 'shared_shell_cleanup'
    | 'home_content_shell0'
    | 'home_content_shell1';
  mergedIdentityHomeAssertion: {
    identityObligationId: string;
    identityVersion: string;
    expectedOutcome: 'route';
    routeProofKind: 'ogabassey_identity_route';
  } | null;
}

type StorefrontPublicFetchTarget =
  | StorefrontIdentityHomeFetchTarget
  | StorefrontCanonicalDocumentFetchTarget;

interface StorefrontExpectedSafetyProof {
  merchantId: string;
  templateIdentity: 'ogabassey';
  safetyGeneration: string;
  proofRevision: string;
  publicationOutcome: 'published' | 'unpublished';
  canonicalTargetManifestDigest: string;
  canonicalUrlOutcomeDigest: string;
  requiredRendererEpoch: string;
  requiredRendererDigest: string;
  committedRendererEpoch: string;
  committedRendererDigest: string;
  criticalShellContractVersion: 0 | 1;
  controlRenderMode: 'legacy' | 'degraded' | 'permanent';
}

interface StorefrontExpectedForeignTenantProof {
  schemaVersion: 1;
  tenantMerchantId: string;
  publicationOutcome: 'published' | 'unpublished';
  canonicalOrigin: string;
  tenantRoutingProofDigest: string;
}

type StorefrontExpectedPublicDocumentProof =
  | {
      kind: 'ogabassey_identity_route';
      safety: StorefrontExpectedSafetyProof;
      identityVersion: string;
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'foreign_tenant_route';
      tenant: StorefrontExpectedForeignTenantProof;
      identityVersion: string;
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'identity_nonroute';
      identityVersion: string;
      expectedOutcome: 'redirect' | 'absent';
      expectedRedirectStatus: 301 | 302 | 307 | 308 | null;
      expectedRedirectLocation: string | null;
    }
  | {
      kind: 'safety_marker';
      safety: StorefrontExpectedSafetyProof;
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'shared_shell';
      safety: StorefrontExpectedSafetyProof;
      snapshotState: 'compatible' | 'degraded' | 'suppressed';
      sharedShellContentGeneration: string | null;
      sharedShellFingerprint: string | null;
      homeProof:
        | {
            kind: 'request_owned';
            contentGeneration: string;
            homeLcpFingerprint: string;
            homeSemanticFingerprint: string; // recomputed canonical shell-0 graph digest
            homeCrawlableLinksFingerprint: string;
            homeCriticalFingerprint: string;
            staticDocumentClosureDigest: string;
            homeDocumentFingerprint: string;
            heroOwnership: 'request_publication_guarded';
          }
        | {
            kind: 'permanent';
            contentGeneration: string;
            homeLcpFingerprint: string;
            homeSemanticFingerprint: string; // recomputed canonical H2 non-product graph digest
            homeCrawlableLinksFingerprint: string;
            homeCriticalFingerprint: string;
            staticDocumentClosureDigest: string;
            homeDocumentFingerprint: string;
            heroOwnership: 'permanent_initial_html';
          }
        | {
            kind: 'neutral';
            contentGeneration: null;
            homeLcpFingerprint: null;
            homeSemanticFingerprint: null;
            homeCrawlableLinksFingerprint: null;
            homeCriticalFingerprint: null;
            staticDocumentClosureDigest: null;
            homeDocumentFingerprint: null;
            heroOwnership: 'absent';
          }
        | null;
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'shared_shell_cleanup';
      safety: StorefrontExpectedSafetyProof & {
        criticalShellContractVersion: 0;
      };
      priorShell1SharedMarkerMustBeAbsent: true;
      cleanupControlOutcome: 'enabled' | 'draining' | 'disabled_legacy';
      restoredSharedShellProof:
        | {
            kind: 'compatible';
            sharedShellContentGeneration: string;
            sharedShellFingerprint: string;
          }
        | {
            kind: 'neutral';
            sharedShellContentGeneration: null;
            sharedShellFingerprint: null;
          };
      homeOutcome:
        | {
            kind: 'published_request_owned';
            snapshotState: 'compatible';
            contentGeneration: string;
            homeLcpFingerprint: string;
            homeSemanticFingerprint: string;
            homeCrawlableLinksFingerprint: string;
            homeCriticalFingerprint: string;
            staticDocumentClosureDigest: string;
            homeDocumentFingerprint: string;
            semanticMarkerRequired: true;
            criticalPayloadOwnership: 'committed_snapshot';
            heroOwnership: 'request_owned';
          }
        | {
            kind: 'neutral';
            reason: 'unpublished' | 'draining' | 'disabled_legacy';
            contentGeneration: null;
            homeLcpFingerprint: null;
            homeSemanticFingerprint: null;
            homeCrawlableLinksFingerprint: null;
            homeCriticalFingerprint: null;
            staticDocumentClosureDigest: null;
            homeDocumentFingerprint: null;
            heroOwnership: 'absent';
          }
        | null;
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'home_content_shell0';
      safety: StorefrontExpectedSafetyProof & {
        criticalShellContractVersion: 0;
        controlRenderMode: 'degraded';
      };
      snapshotState: 'compatible';
      sharedShellContentGeneration: string;
      sharedShellFingerprint: string;
      contentGeneration: string;
      homeLcpFingerprint: string;
      homeSemanticFingerprint: string;
      homeCrawlableLinksFingerprint: string;
      homeCriticalFingerprint: string;
      staticDocumentClosureDigest: string;
      homeDocumentFingerprint: string;
      semanticMarkerRequired: true;
      criticalPayloadOwnership: 'committed_snapshot';
      heroOwnership: 'request_owned';
      expectedCanonicalUrl: string;
    }
  | {
      kind: 'home_content_shell1';
      safety: StorefrontExpectedSafetyProof & {
        criticalShellContractVersion: 1;
        controlRenderMode: 'permanent';
      };
      snapshotState: 'compatible';
      contentGeneration: string;
      homeLcpFingerprint: string;
      homeSemanticFingerprint: string; // recomputed canonical H2 non-product graph digest
      homeCrawlableLinksFingerprint: string;
      homeCriticalFingerprint: string;
      staticDocumentClosureDigest: string;
      homeDocumentFingerprint: string;
      sharedShellContentGeneration: string;
      sharedShellFingerprint: string;
      semanticMarkerRequired: true;
      criticalPayloadOwnership: 'committed_snapshot';
      heroOwnership: 'permanent_initial_html';
      expectedCanonicalUrl: string;
    };

interface StorefrontPublicFetchInput {
  target: StorefrontPublicFetchTarget;
  expectedProof: StorefrontExpectedPublicDocumentProof;
  userAgent: 'browser' | 'googlebot' | 'prewarm';
  timeoutMs: 4_000;
  maximumResponseBytes: 2_097_152;
}

type StorefrontPublicFetchResult =
  | {
      ok: true;
      evidence: 'https_response' | 'dns_absent' | 'tls_unreadable';
      status: number | null;
      location: string | null;
      responseBytes: number;
      connectedAddressFamily: 4 | 6 | null;
      body: Uint8Array;
    }
  | {
      ok: false;
      code:
        | 'INVALID_TARGET'
        | 'DNS_POLICY_REJECTED'
        | 'TLS_IDENTITY_REJECTED'
        | 'OUTCOME_MISMATCH'
        | 'RESPONSE_TOO_LARGE'
        | 'TIMEOUT'
        | 'FETCH_FAILED';
      retryable: true;
    };

async function fetchStorefrontPublicDocument(
  input: StorefrontPublicFetchInput,
): Promise<StorefrontPublicFetchResult>;
```

Every sync/readback/parity assertion keys identity evidence by the full `(identityKind, normalizedIdentity)` pair. Equal normalized text across `custom_domain`, `platform_subdomain`, and `platform_path` is legal and must produce distinct typed records rather than collapse in a string-only map.

Import `Database` from the repository's generated `@/types/supabase` contract (or alias the exact typed return of the server-only worker client factory); bare `SupabaseClient` is forbidden because its default database generic is `any`. A compile-time contract test must reject an untyped client at this boundary.

`DomainEventDeliveryContext` is deliberately discriminated. Existing provider calls preserve their current event/destination context and can never carry a cache claim. The storefront lane must pass the exact `StorefrontCacheInvalidationClaim` returned by its claim RPC; the destination adapter may not reconstruct frozen obligations from the immutable generic event payload. That claim contains the generic delivery id/token plus the specialized frozen target and is the sole input to routing/purge/canary execution. The external `EventDestination`/route registry remains the original four providers.

`deliverDomainEvent` preserves #3077's `10_000 ms` default for every existing provider context. The storefront context alone passes `{ timeoutMs: executionDeadlineMs }`, where the checked-in cache-protocol config derives and freezes `executionDeadlineMs = stageTotal + 15 s` only after the global purge-barrier bounds are proved; its lease configuration must be at least `executionDeadlineMs + 60 s`. The config parser accepts only that reviewed protocol tuple while preserving the existing-provider bound. The helper owns one abort signal/timer for the whole destination adapter. The storefront executor carries one monotonic deadline and, before every identity write, distributed Edge propagation proof, fresh origin probe, Vercel tag deletion, Cloudflare call, quiescence wait, prewarm, canary round, or final CAS, requires enough remaining time for that stage's frozen maximum plus the `15 s` finalization reserve; otherwise it releases/retries before the side effect. Timeout/abort tests cover the unchanged analytics default, the exact formula-derived `stageTotal`, rejection when any provider bound makes the intended `150/210 s` tuple insufficient, acceptance only when `executionDeadlineMs >= stageTotal + 15 s` and `leaseMs >= executionDeadlineMs + 60 s`, refusal before every first/second-pass stage, deterministic fake-clock abort at the configured production deadline, no in-process wait after claim, and no completion after abort. Any shorter timing fixture is explicitly scaled test time and is never asserted as a production budget.

The Vercel actuator wire contract is equally narrow. Only `GET|POST /api/internal/storefront-cache/purge-vercel-tags` is eligible. The configured actuator URL must pass an allowlist/parser proving it is the reviewed Vercel project origin or deployment alias and is not `ogabassey.com`, `www.ogabassey.com`, `usebaci.com`, or any custom-domain/Cloudflare hostname. The VPS sends `Authorization: Bearer <STOREFRONT_CACHE_PURGE_ACTUATOR_SECRET>` for both methods. Authenticated `GET` requires `VERCEL=1`, returns exact runtime full SHA/marker plus cache-protocol version/digest with `Cache-Control: private, no-store, max-age=0` and `Vercel-CDN-Cache-Control: max-age=0`, and has no mutation path. `POST` accepts the one strict request object above; tags are deduplicated, bounded to `1..32`, and must match the reviewed generation/snapshot/publication/home-response/shared-shell-response tag grammar—arbitrary tags, URLs, provider names, extra keys, and mixed auth are rejected. After explicit proxy approval, proxy bypasses the generic IP limiter only for this exact path, these two methods, and a valid secret; the route repeats constant-time auth before probing or acting. `POST` reconstructs the current full marker and local protocol digest, requires equality with both prior origin-probed expected values, calls `dangerouslyDeleteByTag(tags, { revalidationDeadlineSeconds: 0 })`, and returns marker/protocol/canonical tag-set digest. The route has no Supabase client and no lifecycle/provider authority beyond Vercel tags. Outside Vercel it returns `503 NOT_VERCEL_RUNTIME`; the client treats every non-typed/mismatched response as retryable failure, and tests prove `not_running_on_vercel` can never become success.

`fetchStorefrontPublicDocument` is the only worker helper allowed to perform canonical prewarm/canary reads. It constructs an HTTPS request from the frozen typed target and its complete `expectedProof`; it never accepts a URL or comparison value reconstructed from a queue payload. SQL materialization binds target `assertionKind`, route outcome, and `expectedCanonicalUrl` to the same-kind proof and rejects extra/missing fields before claim. Every routed target carries one normalized absolute query-free HTTPS `expectedCanonicalUrl`; redirect/absent targets require it null. A route verdict byte-validates the response's single canonical link against that target value; a foreign-tenant home also byte-validates the generic marker's canonical value. An aggregate canonical digest alone can never satisfy a target. A safety claim contains two separately typed, bounded sets whose deduplicated union is at most eleven targets under **both** shell contracts: (1) up to eight `identity_home` targets, all `documentKind=home`, carrying every frozen OLD+NEW identity and its exact `route|redirect|absent` outcome; host/subdomain/custom/canonical homes require `/`, while `platform_path` requires exactly `/<normalized-slug>` on the reviewed platform hostname; and (2) exactly four query-free `canonical_document` route targets—home, one canonical category, one canonical PDP, and blog—frozen from the committed manifest with their exact absolute canonicals. When canonical Oga home occurs in both sets, materialization emits one canonical-home target with non-null `mergedIdentityHomeAssertion` and `routeProofKind=ogabassey_identity_route`; that single response must satisfy both the canonical marker and exact identity-version/outcome/canonical proof, so deduplication never drops an obligation or counts two reads. Every compatible ready Oga document under shell `0` or `1` uses the versioned `shared_shell` assertion, whose normalized safety projection includes the exact safety proof revision and whose shell-specific payload proves the immutable shared generation/fingerprint. Only a persistent disabled legacy document uses standalone `safety_marker` with `controlRenderMode=legacy`, whether the private `final_disable_transition_id` is non-null or null. The UUID clear changes mutation ownership but no public proof byte. Target materialization therefore selects the assertion from the frozen control/render outcome, never from shell version alone. An Oga identity route uses `ogabassey_identity_route` and proves the same merchant, publication outcome, safety generation/proof revision, manifest digest, identity version, and exact canonical. A reassignment route to a non-Oga tenant instead uses `foreign_tenant_route`: the shared home page branch emits one product-free `StorefrontTenantRoutingMarker` whose only public values are schema version, `tenantRoutingProofDigest`, and exact canonical home. The digest is SHA-256 of canonical JSON `{schemaVersion:1,tenantMerchantId,publicationOutcome,canonicalOrigin}` materialized from DB-authoritative new-tenant truth; the proof carries those typed inputs and the helper recomputes the digest before comparing it. It never expects or parses the Oga marker. Redirect/absent targets use `identity_nonroute`, emit no tenant requirement, and cannot borrow any routed-document success. A `shared_shell` claim under either shell uses exactly the four canonical documents. A forward shell-0 cleanup uses `shared_shell_cleanup` on those four: every document must prove the restored shell-0 safety/canonical state and absence of the shell-1 serialized marker version, while canonical home alone carries non-null `homeOutcome`. `restoredSharedShellProof.kind=compatible` requires one non-null shell-0 shared generation/fingerprint on all four documents and is legal only for the enabled+published+degraded cleanup outcome; canonical home then carries `published_request_owned` while nested targets carry null `homeOutcome`. `kind=neutral` requires both shared fields null and is legal only for the exact unpublished/draining/disabled-legacy outcome; canonical home then carries the matching neutral variant while nested targets again carry null. That home outcome is either the restored published request-owned H1 complete component/document tuple, or an exact neutral no-Hero proof for concurrent unpublish, draining, or disabled legacy state. A home-content claim contains canonical home only and selects `home_content_shell0` or `home_content_shell1`; both shell variants must prove the exact shared-parent `snapshotState`, shared generation, shared fingerprint, control render mode, safety proof revision, and complete home output tuple, with request-publication-guarded ownership for shell 0 and permanent-initial-HTML ownership for shell 1. SQL and Zod require `homeOutcome` non-null iff the cleanup target is home and enforce the full cross-field matrix: `published_request_owned` means control enabled + publication published + control render mode degraded; neutral `unpublished` means enabled + unpublished + degraded; neutral `draining` means control draining + degraded; neutral `disabled_legacy` means public control disabled + normalized legacy mode, independent of the private finalizer UUID. Nested cleanup targets require null `homeOutcome` but the same safety/control outcome. Reject any cross-set kind/path/assertion/proof/canonical combination, IP literal, non-443 port, userinfo, query/fragment, kind/identity/hostname/path mismatch, unbounded/arbitrary document path, or malformed IDNA. Resolve the complete CNAME/A/AAAA chain immediately before connect, reject the entire answer when any hop/address enters loopback, private, link-local, CGNAT, reserved, documentation, multicast, metadata, IPv4-mapped, or equivalent IPv6 space, then pin one validated public address for that request while preserving the expected hostname for certificate validation, `Host`, and TLS SNI. Do not inherit `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, or `NO_PROXY`; bound headers/body to `2 MiB`, abort at `4 s`, never follow a redirect, and re-resolve independently for each later round. Verdict evaluation is part of the helper: `route` requires the reviewed success status and byte-equal tenant proof, safety/publication when Oga, exact canonical, renderer, shell/control-render-mode, and class-specific marker fields from `expectedProof`; `redirect` requires the frozen reviewed 30x plus normalized public `Location` and returns without fetching the destination; `absent` requires a neutral `404|410` without former-tenant bytes, a two-round authoritative/DNSSEC negative answer, or public-address TLS identity failure in both rounds after exact DB+Edge absent readback. A private answer, timeout, SERVFAIL, connection refusal, unexpected redirect/TLS/status/body, stale/missing/wrong marker, missing/substituted canonical, proof mismatch, or later identity-version change is retryable and cannot cover the duty. Tests use a controllable resolver/socket adapter to prove every expected-proof field mismatch, generic-tenant digest forgery and foreign-tenant reassignment, DNS rebinding, private CNAME, redirect-to-private, alternate numeric IP encodings, Unicode/punycode normalization, wildcard/custom and platform-path identity homes, both shell contracts, ready/disabled-legacy/cleanup assertions, both home-content variants, all four canonical document kinds, canonical-home merged-obligation success/failure/cardinality, stale-but-visually-identical safety HTML, missing/substituted canonical target, path-kind/assertion substitution, exact redirect, detach-to-NXDOMAIN/NODATA, TLS-lost detach, timeout/SERVFAIL, later reattachment, certificate/Host/SNI mismatch, oversized output, and proxy environment cannot reach or pass a canary. Any non-verdict returns one typed retryable policy outcome and performs no completion CAS.

Cleanup assertion precedence is non-narrowable across safety absorption. If a safety obligation carries `shared_shell_cleanup`, its canonical home/category/PDP/blog entries use `assertionKind=shared_shell_cleanup`, not ordinary `safety_marker`, and all four require the prior H2 shared marker absent. Identity-home-only entries retain their identity outcome proof. When canonical home is deduplicated across sets, that one target carries both `mergedIdentityHomeAssertion` and cleanup `homeOutcome`; its response must satisfy identity version/tenant/canonical facts **and** the cleanup absence/restored-or-neutral-home facts. Materialization, SQL/Zod validation, tag selection, completion CAS, and tests reject any absorbed cleanup represented by only a generic shell-0 safety assertion.

Cache protocol compatibility is mechanical, not the hand-written destination version. Checked-in `cacheProtocolVersion: 1` plus `cacheProtocolDigest` hashes the **complete frozen-claim execution closure**: publication/data/critical/home-response/shared-shell-response tag builders and the class-to-tag matrix; root-home purge ownership resolver and shell-0-versus-shell-1 product-purge contract; tag-slot/identity/document-kind/typed-target/cardinality/deadline/admission constants; the claim, provider-outcome, canary-outcome, typed public-fetch-target, routing-record/live-signal/resolution, and actuator request/probe/response schemas; claim materialization/data access; hashed Edge key derivation, atomic batch composition, size/headroom checks, and routing-v2 writer ordering; Cloudflare URL/header/cache-key purge contracts for exact home, dedicated-host hostname scope, and shared-platform-host exact-root plus boundary-safe trailing-slash prefix scope; public-fetch/DNS/TLS/redirect/document-path policy; provider-budget and executor-stage dispatch; actuator URL/auth validation and client; and Vercel route validation. The manifest has explicit semantic entrypoints for each class and recursively hashes local/workspace/external runtime dependencies. `assert-storefront-cache-protocol.ts --check` uses the same fail-closed import/source-closure rules as the renderer verifier and fails when any covered byte/import/dependency/list changes without a deliberate protocol version/digest update. A merely hand-written `destination_contract_version` is never evidence that an old frozen claim remains executable. The worker-release row, both V2 heartbeats, and frozen claim carry the version/digest. Origin `GET` returns the deployed web digest; `POST` requires the claim/request digest equal its own and echoes it in the receipt. A later web deploy with identical protocol remains decoupled, and a release-only worker may reclaim an old lease only when the renderer triple and complete protocol closure are byte-identical; renderer changes take the explicit successor handoff above. Any incompatible parser, routing, Cloudflare/header/prefix, target/outcome, public-fetch, stage-budget, root-home ownership, document-scope, or admission change necessarily changes the digest and takes the durable drain/disable rotation. A protocol-changing deployment is prohibited until that rotation is `drained`; the old web/worker/actuator stay available until every old-protocol duty is terminal, and the new web is deployed only while every control is final disabled+null. Old/new mismatch still stops before tag deletion with `CACHE_PROTOCOL_MISMATCH`. A protocol-only release with unchanged renderer creates no renderer sweep, but it never skips the protocol-rotation barrier. Tests mutate every covered source class, add/remove a transitive import, change a tag/identity/target/document-kind/key/prefix slot or stage budget, simulate old-worker/new-web and new-worker/old-web, prove no partial provider work on mismatch, prove same-renderer/same-digest reclaim remains decodable/executable, and prove no old-protocol work exists at activation.

The storefront data-access adapter exposes only renderer activation/sweep, bootstrap stage-binding claim/stage/release, the atomic destination-filtered parent-plus-global-child claim, global routing-identity complete/release, reconcile, compare-and-commit, parent complete/retry/transfer, provider-budget acquisition, and the named operator operations in H1A/H1D. The #3077 worker and extended admin routes import that adapter; none may use a generic service-role `.from(...)` mutation. Generic parent claim/retry/dead-letter/replay state remains owned by #3077 rather than copied into this adapter; the identity child has only the minimal lease/apply lifecycle above.

Executor ownership is frozen: the existing `baci-event-delivery-worker.service` is the only process for `storefront_cache_transition`. Its existing-destination lane uses the non-storefront generic claim. Inside the same process, a zero-provider **bootstrap routing sublane** calls `claim_storefront_routing_stage_bindings_v1` only for `control_state=enabling`, activation disabled, current enable operation/bootstrap revision, pre-stage receipt `pending`, generic delivery physical `pending` with null claim/lease and zero attempts, and no current-revision `routing_resumed` fact. It leases only per-parent stage bindings and reads the corresponding global versions; it never leases the enabled-state global child or the generic delivery. The provider lane calls `claim_cache_invalidation_work`; SQL rejects every enabling parent unless activation is enabled and the exact current-revision finalizer audit contains `routing_resumed`, then atomically leases the complete pending current global-child set (or records matching applied coverage) before its first generic claim freezes the target. An actively leased required child causes the parent candidate to remain wholly unclaimed. It orders safety before content and dispatches through `deliverDomainEvent`. All lanes share the process/heartbeat/restart/recovery surface but have distinct JIT concurrency and leases. Tests prove initial `pending` is bootstrap-only, post-finalizer `pending` is provider-claimable, generic attempts/lease stay zero before finalization, A/B global-child contention never strands a parent lease, no unfiltered claim remains, and no cache row reaches the unknown adapter.

Cache rollout configuration is isolated from #3077's analytics cutover. `STOREFRONT_CACHE_TRANSITION_INGRESS_ROUTING_ENABLED` and `STOREFRONT_CACHE_TRANSITION_DELIVERY_ENABLED` both default false; the first gates only the specialized routing batch and the second only the storefront delivery lane. `STOREFRONT_CACHE_TRANSITION_CONCURRENCY` defaults/clamps to `1`/`1–2`. The domain-router process returns early only when analytics routing **and** storefront ingress are both disabled; cache ingress otherwise runs without reading generic PGMQ. Do not append the cache destination to the four-item `EVENT_PIPELINE_ACTIVE_DESTINATIONS` completeness test or change `isLegacyAnalyticsFanoutDisabled()`. Router-ingress and delivery effective flags plus exact release heartbeats must agree before OgaBassey control enablement. After enablement, a flag/process outage stops routing/claiming and alerts but does not select legacy behavior or abort a publication state mutation; durable work remains pending until recovery or an explicit drain-and-disable rollback.

The activation CLI requires `input.merchantId`, verifies exact promoted marker and GitHub compare result `identical|ahead`, and persists original activation inputs/ids. Git SHAs are never lexically ordered. After the DB activation CAS it sends one Edge PATCH with activation + byte-identical staged v2 records + live signals, waits/proves the distributed boundary, then calls the replay-safe bootstrap finalizer. If the CAS response is lost, it replays the **same operation id with the original byte-identical expected versions and inputs**; it uses the recovered returned row version only for the Edge batch/finalizer, never as a changed replay input. Deactivation is Edge-first and uses discriminated `bootstrap_reset` or `control_drain` authority before the DB false CAS. Failures retain the safe writer/state and recover by immutable operation status. Tests cover response loss followed by later row advance, cross-mode denial, atomic batch failure, partial proof, and no stale-v2 trust window.

- [ ] Modify the publish route deliberately. Freeze both protected methods to this order: **authenticate -> CSRF -> parse JSON -> strict Zod legacy/v1 union -> access/permission -> friendly eligibility -> mutation RPC**. Authentication is the only database-backed operation permitted before validation. Malformed non-empty JSON returns `400` with zero merchant/access/eligibility/mutation RPC calls; it is never coerced to `{}`. Replace route-owned launch eligibility with `get_storefront_publication_eligibility_v1` for the friendly missing-items response, but preserve the database mutation RPC's same-transaction recheck as the authority. Replace the raw `merchants.is_published` update with `set_merchant_publication_state_with_transition`. V1 passes the client UUID; legacy `{}` passes no client UUID and receives the DB-created-or-reused fenced legacy action id—never a fresh per-request server UUID. Remove the route's service-role `merchant_verifications` reader after parity tests prove the definer RPC owns the exact three-column KYC check; never pass an admin client into either RPC. Preserve established payment/KYC error semantics and resolve the #3024 overlap before H1D; its behavior and this receipt contract must both survive.
- [ ] Define the helper boundary exactly:

```ts
async function evictStorefrontPublicationCaches(
  identity: StorefrontPublicationCacheIdentity,
  target: StorefrontPublicationMutationTarget,
  options: { supabase: AuthenticatedSupabaseClient },
): Promise<StorefrontPublicationPropagationResult>;
```

For `mode='legacy'`, retain the exact pre-H1 synchronous eviction behavior. For `mode='fenced'`, the helper performs one `get_storefront_safety_mutation_status(target.mutationId)` read through the caller's authenticated client; it never follows the latest generation, loops on the server, or receives anon/service-role authority. New clients own optional status-URL polling after `202`; old clients retry the same desired action id after the server's `Retry-After`.
- [ ] For a **v1 client**, return one strict shared-schema discriminated union. Synchronous final-disabled-with-no-final-transition/absent-control completion is `200 { success: true, propagation: 'complete', controlMode: 'legacy', mutationId, transitionId: null, expectedIsPublished }`. Fenced completion is the same shape with `controlMode: 'fenced'` and a non-null `transitionId`. Only fenced v1 mode may return `202 { success: true, propagation: 'pending', controlMode: 'fenced', mutationId, transitionId: string, expectedIsPublished, statusUrl, message }`, `409 { success: false, code: 'STOREFRONT_STATE_SUPERSEDED', controlMode: 'fenced', transitionId: string, ... }`, or retryable fenced `503` for a persisted dead-letter/control-plane failure. If the atomic mutation/receipt/enqueue transaction fails before commit, return the distinct retryable `503 { success: false, code: 'STOREFRONT_MUTATION_NOT_APPLIED', controlMode: 'not_applied', mutationId, transitionId: null, expectedIsPublished }`; state, receipt, and queue work must all be absent, and retrying the same mutation id is safe. Never fabricate a fenced transition for an uncommitted failure. For a legacy **request body** `{}`, preserve the pre-H1 success shape only when that call's DB-created/reused exact receipt is already `completed|covered` and the expected state is still current. A single read finding `pending|retry_wait` immediately returns non-2xx `503 { success: false, error: 'Store update is still propagating. Please retry shortly.', code: 'STOREFRONT_PROPAGATION_PENDING' }` with `Retry-After: 2`; exhausted/dead-letter uses distinct `STOREFRONT_PROPAGATION_FAILED`, and conflicting supersession is non-2xx until a new opposite-state action is intentionally created. Older clients never receive the new success discriminant or any `202`. Repeating the same legacy desired state reuses the live/latest matching receipt; an intervening opposite-state action is the explicit boundary that makes a later return a new action. The status route exists only for a fenced v1 receipt, authenticates first, then Zod-validates one UUID query parameter, calls the tenant-authorized status RPC with that authenticated client, and returns the fenced subset without provider internals. Add new-client/new-server tests for absent, disabled, disabled-final-cache-pending, enabling, enabled-pending, enabled-complete, draining, and pre-commit rollback plus old-client/enabled-pending/retry/completion/opposite-action/concurrent-duplicate mixed-deploy cases.
- [ ] Update the web dashboard, setup checklist, and mobile publish hook to send `{ propagationContractVersion: 1, mutationId: crypto.randomUUID() }` and parse the shared schema. Reuse the same UUID only for a transport retry of the same desired state; generate a new UUID for a different user action. Fenced v1 mode enforces replay identity through its receipt; absent/final-disabled legacy mode treats the UUID as correlation only and may safely repeat synchronous desired-state update/purge, while fenced legacy-body mode uses the separate DB-backed server action identity above. After `202`, poll the authenticated status URL every `2 s` for at most `120 s`, then stop and retain an honest propagation-pending state. Never toast “live” or flip durable local publication state on `202`; `409` refreshes current merchant state and `503` offers retry/status guidance. Client polling is optional UX and never owns completion. Mixed-deploy tests must prove old-client/new-server never receives `202`, receives honest non-2xx pending with no duplicate receipt/generation/event on retry, and gets legacy `200` only after its reused receipt is terminal; new-client/old-server accepts the existing legacy `200 { success: true, message }` as completion because the old server owns synchronous confirmed eviction; all non-2xx legacy responses remain errors.
- [ ] Acknowledge that Supabase's `service_role` token is inherently broad and bypasses RLS; DB grants cannot make it least-privilege. Keep it only in the existing server-only #3077 VPS worker/ops runtime, behind a destination adapter whose typed API exposes renderer activation/sweep, raw-input, compare-and-commit, destination-filtered claim, atomic complete-and-cover, retry, transfer, and the named service operations. The user-facing #3077 admin dead-letter/replay routes keep their caller-bound authenticated client and invoke only authenticated, operator-checked RPCs; they never instantiate, receive, or import a service-role client. Add contract-test/lint assertions that the worker adapter performs no generic `.from(...)` table mutations, never serializes/exports its client, and the admin route graph has no admin-client import.
- [ ] Let the single private publication primitive call `ensure_storefront_cache_transition_v1` atomically with the mutation. The guarded publication trigger may call the H1D1-only compatibility overload only during the proven old-fleet drain window; H1D2 closes that phase and rejects every context-free write, including service-role writers. New work creates one #3077 ledger/PGMQ event plus specialized pending obligation; pre-claim mutations coalesce/attach receipts without another event; post-claim mutations create at most one pending successor/event. New-event enqueue failure rolls back the enabled mutation. The existing domain-router process's specialized ingress lane alone creates/binds the generic delivery later and never performs provider work.
- [ ] Preserve a hard rollout branch in the shared eviction library. If the merchant has no control row or `control_state=disabled AND final_disable_transition_id IS NULL`, execute the exact legacy synchronous eviction contract with no generation RPC, Redis budget, delivery, or worker dependency. `enabling|enabled|draining` **and disabled-final-cache-pending** all enter the fenced/budgeted lane; disabled is not synonymous with legacy while the final purge/canary duty or routing tombstone transition remains live. Add publish/unpublish/slug/domain regression tests for absent, never-enabled disabled, enabling, enabled, draining, mutation immediately after the disable finalizer CAS, final purge failure/retry, and disabled after the final id is cleared.
- [ ] Close the product-purge root-home bypass with one owner in every state. Change `scheduleStorefrontProductPurge` to require `merchantId` and make `storefront-home-purge-ownership.ts` resolve exact control state, shell version, and typed affected-field classification before URL construction. Legacy root purge is legal only after a positive no-control or final-disabled+null result; lookup failure never means absence. Under H1 shell 0, every field consumed by Hero, full semantic graph, crawlable links, shared shell, or static closure is owned by the durable output-checked home/shared transition, including stock/manage-stock/inventory/order quantity/availability and `updated_at` graph selection; the detached product helper never duplicates root. Under H2 shell 1, the renderer atomically commits the non-inventory graph plus crawlable anchors and proves feed rows absent from cached HTML/RSC before removing non-Hero price/image/stock/order-quantity/`updated_at` feed-only fields from the root lane. Selected Hero/link status/name/slug/category/created_at remain durable root inputs. Disabled-final-cache-pending stays mutation-fenced and attaches the newest exact output duty before clearing the final id. An unresolved state returns retryable `STOREFRONT_ROOT_OWNERSHIP_UNRESOLVED`, performs zero root purge, and retains reliable revalidation; it never opens legacy. PDP, `/products`, and category-listing URLs remain in the existing product lane. Update every current caller to pass merchant id/typed field class and add a production call-graph test proving no bypass.
- [ ] Record the narrower shell-1 freshness contract that makes post-H2 exclusion safe: the permanent critical snapshot and all cached home HTML/RSC/JSON-LD contain no feed-card price/image/stock/availability, Product, Offer, or other inventory-sensitive bytes; Product/Offer structured data remains on PDP. The selected Hero's `priceLabel` is a permanent critical byte and its exact price dependency remains in the current dirty matrix/fingerprint. Every non-selected visible home card is fetched only by the tenant/host-bound no-store client endpoint after hydration; zero card row may remain in, or be recovered from, the cached document. Tests prove H1 shell-0 stock changes enter the durable semantic/document fingerprint and produce a root transition only when output changes; disabled-final-cache-pending stock changes extend the exact final obligation; H2 graph removal precedes shell-1 exclusion; shell-1 feed-only stock/order-quantity/price/image changes produce zero critical transition/root purge while becoming visible through the no-store endpoint; selected-Hero price changes still advance the fingerprint; and any future feed row or inventory/Product/Offer home byte fails the whole-object dependency/ownership contract.
- [ ] For a content claim, call the private generation-checked input RPC, run the existing TypeScript builders, validate and canonically hash the public payload, then call the compare-and-commit RPC. Treat `superseded` as convergence work and `unchanged` as successful no-purge reconciliation. On `advanced`, execute only its server-derived `transition_action`: ordinary visible home/shared/cleanup actions create one durable provider event; `snapshot_only` commits the stable degraded home/shared snapshot with no new provider work and may only preserve an already-degraded `carried_work_id`; and `promotion_staged` creates or refreshes the parked no-event row and performs no Vercel/Cloudflare call until promotion CAS.
- [ ] For a safety claim, first guarantee safe visibility. Unpublished state proceeds directly to neutral-shell eviction. Published state may safely expose the latest tenant/publication/canonical shell with **no Hero** while snapshot compatibility is stale; the safety invariant does not require the request path to build a Hero. The worker runs `safety`-mode reconciliation without the ordinary content debounce. Under shell `0`, rebuilding and atomically committing compatible early plus semantic projections may create the subsequent exact-home transition; the request path renders them only after its publication/tenant guard. Under stable shell `1` while rendering is deliberately degraded, no new promotion intent exists, and no cleanup duty is inherited, any home and/or shared data rebuild is `snapshot_only`: it creates no additional content event/work, while the original safety claim completes only against the explicit content-null degraded-no-Hero outcome. An inherited home/shared item may continue only when it already asserts that degraded shape; a permanent-proof item blocks the commit until transfer/terminal, and cleanup keeps its own four-document action. It never pretends to restore or canary permanent bytes. Permanent visibility after suppression requires the separately owned higher-epoch sweep/stage/promotion path. Capture one coherent committed content generation with its complete component/composite tuple or an explicit degraded-no-Hero state for canaries; later ordinary dirty/content generations remain separate successors and do not block the safety invariant.
- [ ] Make the existing #3077 durable worker the **only safety and control-managed root-home provider coordinator**. After commit makes a specialized delivery visible, its storefront lane performs destination-filtered claiming, routing sync, Redis capacity acquisition, calls the narrow Vercel actuator for exact tag deletion, calls Cloudflare directly under the shared budget, then prewarms/canaries/completes. H1 shell-0 inventory-sensitive writes reach that worker through the semantic/composite home fingerprint; they do not rely on today's fire-and-forget `scheduleStorefrontProductPurge`/TTL fallback. Existing product paths may continue PDP/category/listing purges and legacy root purges only for absent or final-disabled+null merchants after the ownership resolver proves they do not overlap a specialized root duty. Disabled-final-cache-pending inventory writes extend the worker-owned final legacy-output obligation rather than opening a second owner. H2 removes the product/inventory subset and its dirty dependencies only after committing and rendering the canonical non-product semantic projection/digest. The VPS must never import/call `dangerouslyDeleteByTag` or treat `not_running_on_vercel` as success. Publication/identity request paths and the Vercel actuator make zero claim/complete/retry decisions or provider calls. Ordinary critical-home content updates use worker ownership and never enter a request-bound fast path. Tests prove exactly one root owner for every `(shell contract, affected-field class, control state)` cell and reject an untyped/general caller-selected root option.
- [ ] Route every VPS prewarm/canary read through `fetchStorefrontPublicDocument`; no raw `fetch`, `curl`, queue-provided URL, or ambient proxy may reach a persisted custom hostname. Safety under shell contracts `0` and `1` executes the same deduplicated union of every frozen identity-home target (including platform path and platform/custom subdomains) plus the checked-in canonical home/category/PDP/blog set × browser/Googlebot in two complete rounds. Every routed response must prove its exact per-target canonical. A compatible Oga route under either shell proves the route-wide versioned product-free shared-shell marker; persistent disabled legacy uses the standalone safety marker. A reassigned non-Oga route proves the generic tenant-routing digest/canonical marker for the DB-authoritative new tenant and never expects Oga bytes; redirect/absent outcomes use their typed non-route evidence. With at most eight identity homes and only three additional nested canonical targets after canonical-home deduplication, each safety round is at most twenty-two reads, scheduled at concurrency eight with a four-second timeout: three waves/twelve seconds per round, twenty-four seconds total plus the two-second quiet interval. `shared_shell` exists in both shell contracts and executes the exact four-document set; shell 0 canonical home additionally proves request-owned guarded Hero plus the complete home tuple, while shell 1 proves permanent initial-HTML ownership. Forward shell-0 cleanup executes the same four-document set with the shell-1 serialized marker version absent everywhere and the publication/control-outcome-discriminated home proof on canonical home: restored request-owned bytes when published+enabled, otherwise exact neutral unpublished/draining/disabled-legacy bytes. Home content executes canonical home only and always proves its versioned shared parent plus the shell-discriminated complete home proof. A slug's platform subdomain and platform path are separate counted identity targets even though they share one global identity version. Validate the complete result array length, exact document-target/UA Cartesian product, frozen identity version where applicable, exact canonical URL, canonical manifest digest under both shells, shell-specific marker assertion, tenant-proof kind, and outcome-specific verdict before the completion CAS; never truncate, follow redirects, short-circuit the remaining targets after one success, or let a failed target inherit another target's result. An `absent` DNS/TLS proof is valid only for that frozen absent identity version and cannot cover later reattachment. The maximum-cardinality fixture contains both platform surfaces, one reassignment to a foreign tenant, enough custom/canonical targets to reach eight, all four document kinds under both shells plus cleanup, and proves admission rejects a ninth identity target or non-manifest nested target before enqueue.
- [ ] Apply cleanup precedence to runtime canaries as well as SQL materialization. Ordinary shell `0` safety requires the Oga safety marker on the canonical four; a safety claim carrying cleanup instead requires `shared_shell_cleanup` on those four, shared-marker absence everywhere, and the exact publication/control-discriminated home outcome on canonical home. Its extra identity targets keep their identity/route verdicts. A canonical-home merged target must pass both kinds in the same response, so neither an identity success nor a generic neutral safety response can complete the cleanup duty.
- [ ] The exact receipt status is decisive. `completed` succeeds; `covered` succeeds only after the server proves successor-obligation superset and current publication still equals `expectedIsPublished`; `pending/retry_wait` becomes `202`; `superseded_conflict` becomes `409`; `dead_letter` becomes `503`. On publish with temporarily stale snapshot compatibility, the worker may canary the explicitly degraded published no-Hero shell as the safe safety outcome; completion proves this receipt's publication/routing state, not that later ordinary Hero reconciliation has finished.
- [ ] Add race tests proving a fenced **publication/identity or product** request in enabling/enabled/draining/disabled-final-cache-pending cannot call Redis, Edge Config sync, Vercel, Cloudflare, prewarm, or canary helpers directly; shell-0 stock writes only mark/attach durable work transactionally and return without a detached provider call. The existing-destination lane cannot claim a storefront delivery; concurrent identical mutation ids are idempotent; a new v1 no-op UUID receives its own alias receipt and echoed UUID with zero generation/event/provider work; publish receipt `A` followed by unpublish `B` returns `409` for `A` rather than `B`'s success; a compatible completed successor may return `covered`; a request crash/timeout does not cancel durable work; worker death/restart plus the recovery sweep resumes the frozen claim; draining and post-finalizer-CAS mutations remain fenced/v1+v2 coherent; and only absent or disabled+null merchants execute the exact legacy synchronous publication/root-home purge contract.
- [ ] Keep page-config publication separate from merchant storefront publication. Current occurrences in `(platform)/onboarding/actions.ts`, `api/builder/builder-route-utils.ts`, and `api/mobile-onboarding/route.ts` update `page_configs.is_published/published_at`, not `merchants`, and must **not** call this launch-eligibility/receipt RPC. Add a syntax/data-flow inventory test that enumerates every `.from('merchants')` update, SQL function, trigger, and generated query touching merchant `is_published/published_at`. After H1D2, the public RPC plus private context-owning primitive are the only owners; every authenticated, internal, VPS, import, worker, or service-role writer must adopt them, and the scan fails on any context-free merchant publication update.
- [ ] Hard-expire safety-generation, committed-content-generation, and critical-snapshot Next tags. A dirty revision alone never changes the public cache key and never triggers provider invalidation.
- [ ] Have the VPS derive the exact bounded class-specific tag set, then call authenticated no-store `GET` on the configured Vercel-origin actuator URL immediately before `POST`. Require one typed current web SHA/marker from that origin probe, pass that marker with the claim's invocation/transition ids, and never source it from the canonical OgaBassey response, Cloudflare cache, or long-lived worker release row. A canonical pre-state read may be logged as non-authoritative diagnostics only. Only the Vercel-resident `POST` foreground-deletes tags with `revalidationDeadlineSeconds: 0`, returning a typed marker/tag-digest receipt that the VPS verifies before Cloudflare purge, prewarm, and canaries. Freeze the matrix: `home_content` deletes generation + snapshot + dedicated home-response tags; `shared_shell` deletes generation + snapshot + dedicated shared-shell-response tags (which includes home because home carries that tag); `shared_shell_cleanup` uses that same all-document tag set plus the frozen prior shell-1 renderer/marker identity so the absence canary cannot be satisfied by a shell-0 home-only purge; `safety` deletes generation + snapshot + broad publication/identity plus home-response and, when shell/shared duties require it, shared-shell-response tags. The contract test exercises every current Vercel `Vary`/cache-key dimension, including `x-baci-metadata-cache-bucket`, and proves one tag deletion removes all variants; no caller enumerates one bucket and calls that complete. Never give all content work the home tag. Post-canaries must converge on the same marker; a deployment race yields `RELEASE_MISMATCH` or post-canary drift and retries the frozen duty against the next origin-probed marker. URL allowlist, auth, marker, schema, tag-builder, timeout, non-Vercel, or digest mismatch leaves the frozen work retryable. Thus a stale Cloudflare document cannot deadlock the purge, and unrelated app deploys/H2 do not require worker reactivation unless worker/renderer contract sources actually changed.
- [ ] Never write an object into an existing v1 string key. Add only bounded v2 keys: `routing_v2_record_<kind>_<sha256(kind + NUL + normalizedIdentity)>`, `routing_v2_live_<sha256(kind + NUL + normalizedIdentity)>`, and `routing_v2_activation_<merchant-uuid>`. Every key matches the provider regex and is `<=256` characters regardless of maximum raw domain/slug length. Route/live values repeat the full identity kind plus normalized identity; a hash-key/value mismatch is collision/corruption and falls through to the authoritative RPC, never another tenant. Domain normalization uses lower-case IDNA ASCII, strips the one trailing dot, forbids ports/paths/userinfo, and is shared by DB/proxy/worker fixtures; slug/alias normalization is separately typed so equal strings from different identity kinds cannot collide. Admission computes the complete atomic PATCH's resulting config bytes and rejects it before write when the verified plan cap/headroom would be breached.

```ts
interface StorefrontRoutingEdgeRecord {
  schemaVersion: 2;
  identityKind: StorefrontRoutingIdentityKind;
  normalizedIdentity: string;
  identityVersion: string;
  merchantId: string | null;
  outcome: 'route' | 'redirect' | 'absent';
  value: string | null;
}

interface StorefrontRoutingV2LiveRecord {
  schemaVersion: 2;
  identityKind: StorefrontRoutingIdentityKind;
  normalizedIdentity: string;
  identityVersion: string;
  mode: 'v2' | 'legacy' | 'absent';
  merchantId: string | null;
  outcome: 'route' | 'redirect' | 'absent';
}

interface StorefrontRoutingV2Activation {
  schemaVersion: 2;
  activationVersion: string;
  merchantId: string;
  enabled: boolean;
  readerContractVersion: 2;
  readerFirstSha: string;
  activatedReleaseSha: string;
  activatedAt: string;
}
```

For `shared_shell`, `homeProof` is non-null if and only if the frozen target's `documentKind` is `home`. A compatible shell-0 outcome requires the `request_owned` variant and byte-equal content generation, recomputed LCP, current full semantic graph, crawlable-link, critical composite, static-closure, and document digests plus request-publication/tenant-guarded Hero ownership from the same snapshot as the shared-shell tuple. A compatible shell-1 outcome requires the `permanent` variant with the same complete tuple, canonical non-product semantic graph, and initial-HTML Hero ownership. A degraded or suppressed home requires the `neutral` variant and every home component/document field null. Category, PDP, and blog require `homeProof=null` but still recompute the actual header/footer/theme/base-head shared fingerprint from response bytes. A `shared_shell` transition may cover a same-generation home duty only after canonical home passes that combined shell-specific proof; the other three documents can never substitute for it.

Deploy in four independently reversible phases: (1) reader-first support lands with no live signal, preserving v1/local behavior; (2) enabling stages exact-bootstrap-revision compatibility-v1/v2 records and physically parks the parent in `routing_staged`; (3) the operator uses a persisted replayable routing operation to CAS activation, atomically PATCH v2+activation+live, prove distributed state, finalize exact-revision stages, then lets the worker prove public caches before the enable finalizer; (4) readers use version-matched v2 under live signal and fall back to the authoritative RPC on mismatch. Any safety/identity mutation between staging and enable finalization applies the bootstrap-revision rule: pre-activation it atomically invalidates/restages; post/maybe-activation it enters `routing_reset_required`, performs Edge-first compensation, replay-safe DB deactivation, audited reset, then stages the newest revision. Already-enabled changes patch compatibility-v1+v2+live under their claim without toggling activation. Deactivation/reassignment remains Edge-first. Tests cover activation-response loss, every mutation boundary before/after DB CAS/Edge PATCH/readback/finalizer, rapid A→B→C, reset races, and death/retry.
- [ ] Replace `triggerDomainEdgeConfigSync()` with the typed merchant/reason form and update every caller/test. Static scan rejects zero-argument calls and direct provider writes outside state-specific owners. Final-disabled identities retain global v1 reconciliation; enabling/enabled/draining or any v2 signal is enqueue-only. During enabling, every safety mutation must advance/coalesce through the bootstrap-revision contract: the identity applier may stage compatibility-v1/v2 only for the current revision; pre-activation mutation invalidates/restages atomically; post/maybe-activation mutation enters `routing_reset_required` and forbids further side effects until operator Edge-first compensation/reset. Operator activation remains the sole bootstrap-live writer. Enabled identity applier may update compatibility-v1/v2/live under a claim; deactivation is operator-only. Retire v1/dual-write only after fleet proof.
- [ ] Add `resolve_storefront_routing_identity_v2` as a minimal anon-safe `SECURITY DEFINER` function with fixed `search_path`, schema-qualified reads, normalized/bounded identifier input, and exact projection only: normalized identity/kind, canonical decimal global identity version, public outcome, merchant id, canonical slug, and routing mode. Grant execute to `anon`/`authenticated`, revoke all other function/table leakage, and return no merchant contact/payment/config fields. New proxy readers check `routing_v2_live_*` before any local/v1 candidate. A valid `mode=v2` signal+record+activation tuple is authoritative; an absent signal selects legacy; `legacy|absent`, malformed, missing, collision, or version mismatch calls this RPC and may not fall back to the candidate. Add real anon PostgREST tests, cross-tenant projection equality, invalid-host bounds, detached/redirect/absent cases, hash collision/mismatch, both reassignment directions, tombstone retirement, disabled mutation during retention, and query/load gates for a representative unsignaled storefront.
- [ ] Remove process-local time-only routing values only from the final decision path for identities carrying a live signal. `domain-cache-simple.ts` and `slug-alias-cache.ts` retain current production behavior when the signal is absent. A stale local/v1 candidate can never suppress a signal naming a different activated owner. Add old-reader/new-writer and new-reader/old-writer matrices plus the non-Oga unsignaled TTFB/query-count/load gate.
- [ ] For safety work, synchronize the complete desired Edge Config mapping set—including deletions and OLD+NEW expected outcomes—before document purge/prewarm. Read it back and require each claimed global identity version/outcome. Failure, an older version, or same-version/different-outcome keeps the safety row retryable; never purge then refill through an unproven map. Independent old/new merchant claims for one reassignment idempotently prove the same identity version. Code-only content transitions do not run routing sync.
- [ ] For safety, purge the full persisted OLD+NEW identity duty even when the current loader no longer returns a detached identity, but execute the duty by kind. Dedicated canonical/`www`/custom/platform-subdomain hostnames may use hostname purge. A `platform_path` identity on shared `usebaci.com` must purge its exact root as a single file plus the boundary-safe post-transform prefix `usebaci.com/<normalized-slug>/` for descendants; **never** hostname-purge `usebaci.com`, and never use the unsafe prefix without the trailing slash because it can match a sibling such as `<slug>2`. Confirm both sides of reassignment, include required single-file custom-cache-key headers, use the live proven transform/prefix contract, chunk only at the documented limit, and never truncate.
- [ ] For `home_content`, call the confirmed single-file purge with the exact root home URL for every persisted Cloudflare-backed alias in one bounded request, including every required custom-cache-key header tuple when the live Cache Rule uses header variants. The implementation must encode the ADR's proven cache-key contract; URL-only is permitted only after variant-eviction proof. Never hostname-purge category, PDP, blog, feeds, or trust routes merely because Hero copy/image/price changed.
- [ ] For `shared_shell`, delete the per-merchant shared-shell Vercel response tag, hostname-purge only dedicated canonical/`www`/custom/platform-subdomain hosts, and use the same exact-root + boundary-safe trailing-slash prefix pair for the merchant's shared `usebaci.com/<slug>` path. This is “all merchant documents,” not “all documents on a shared hostname.” Tests prove sibling merchants remain cache hits, every Oga nested document becomes `MISS|EXPIRED`, and post-transform/cache-key variants converge before the four route canaries pass.
- [ ] Add the dedicated home response tag alongside the existing broad publication tag only for cacheable anonymous home documents, and add the dedicated per-merchant shared-shell response tag to every cacheable anonymous storefront document (home, category, PDP, blog, and other nested routes). Preserve no-store/query/auth behavior. A proxy integration test proves home receives both tags, nested documents receive shared-shell but not home, generic/other-merchant tags are independently namespaced, and no tag value is caller-controlled.
- [ ] Add one generic product-free `StorefrontTenantRoutingMarker` in the already-resolved shared `[slug]/(home)` page branch for every successfully routed storefront **home**, before any home-template/content Suspense. Its public schema contains exactly `{schemaVersion:1,tenantRoutingProofDigest,canonicalUrl}`. The digest is SHA-256 of canonical JSON `{schemaVersion:1,tenantMerchantId,publicationOutcome,canonicalOrigin}` from the same route-resolution snapshot; merchant id and publication state are digest inputs but are not emitted as separate public attributes. `canonicalUrl` is the tenant's exact absolute canonical home and must equal the single canonical link. Unbound/unavailable/redirect/absent home branches emit no marker. The marker is canary evidence only, never a routing or publication decision input, and adds no product/name/price/image/link/request-host/secret bytes. Include its builder/parser/home-placement and canonical-home derivation in the cache-protocol closure and test every home template branch, published/unpublished route, cross-tenant reassignment, streaming order, duplicate/malformed digest, and canonical mismatch. A reassignment identity-home canary to a foreign tenant passes only this generic proof plus the exact DB/Edge identity version/outcome; it must not require that tenant to render an Oga-specific marker. Nested canonical document canaries remain Oga-specific and do not consume this home-only marker.
- [ ] Keep `OgabasseyStorefrontSafetyMarker` only for a bound persistent disabled legacy response, outside shopping-content Suspense and byte-stable across the private finalizer UUID clear. Every ready compatible Oga document under H1 shell `0` or H2 shell `1` instead emits the one versioned route-wide product-free `OgabasseySharedShellMarker`; redirect/absent outcomes emit neither and use typed non-body proof. The normalized shared marker carries exact merchant/template identity, safety generation and proof revision, publication outcome, canonical target-manifest and URL-outcome digests, required+committed renderer identity, critical-shell contract version, normalized control render mode, snapshot state, and nullable/non-null shared generation/fingerprint according to state—no request-host identity, home generation/fingerprint, Hero, price, image, product, or link. The browser/Googlebot schema rejects a stale proof revision/generation/manifest even when visible bytes are identical. Include both marker builders/parsers and their placement owners in renderer/cache-protocol closures and broad safety/shared tags. The H1 home measurement marker separately stamps the early `homeLcpFingerprint`, generation, and committed `homeCriticalFingerprint` while retaining the request-owned Hero; H2 changes only presentation/control ownership and the versioned shared marker shell byte.
- [ ] Add the product-byte-free `OgabasseyHomeSemanticSnapshotMarker` immediately adjacent to the deferred compatible semantic graph plus crawlable anchors under both shell contracts. It carries exactly schema version, merchant id, shell contract, content generation, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `staticDocumentClosureDigest`, and `homeDocumentFingerprint`; it is not a Web Vitals context and appears for compatible H1 and H2 documents and never appears for degraded, suppressed, draining, disabled, unbound, unavailable, or mismatched states. The early H1/H2 measurement marker carries the matching generation/critical composite plus `homeLcpFingerprint`; the shared marker carries the shared generation/fingerprint. The document adapter has already validated both narrow views and the complete document tuple before JSX is returned. Raw byte-order tests prove the measurement marker, slide-zero resource hint, and Hero element occur before any semantic marker/graph/anchor byte; the later static-continuation component receives the validated graph/link object and performs no RPC, live read, or fingerprint rebuild. Admission latency is governed by the explicit size/CPU/p95 caps above rather than hidden inside a Suspense boundary. The cache-protocol closure fails if either marker/parser/component/document-fingerprint builder changes without a deliberate digest rotation.
- [ ] Test apex, `www`, custom domain, merchant subdomain, platform path, preview, retired/deleted alias, detach, and reassignment. After detach, the old hostname must not serve the former tenant; after reassignment, it must not retain either tenant's stale shell. A tag helper test alone is insufficient; proxy response tests must cover the real branches.
- [ ] Enforce the content schedule in both SQL and worker tests: trailing debounce `60 s`, hard max-wait `120 s`, and no content provider attempt earlier than `last_provider_attempt_at + 60 s`. Safety bypasses those timers but every Cloudflare producer must acquire capacity before each provider operation from one atomic shared token bucket keyed by the **actual provider limit scope**: account + verified plan/tier + operation bucket (hostname/tag/prefix versus single-file), never by zone. Zone belongs only in the purge payload/telemetry. Centralize admission in the lowest shared Cloudflare client so the worker, legacy publication, product/PDP/category/listing routes, reliable revalidation, and deploy/coherence scripts cannot bypass it. Callers declare a bounded priority class; reserve the next available safety opportunity while due safety work exists, and make lower-priority request paths hand failure to their durable reliable-revalidation owner or return retryable failure. Implement on the existing server-only Redis connection with no in-memory/fail-open production fallback. Redis unavailable means zero Cloudflare calls. Account for both quiescence purges and globally apply provider `Retry-After`. Test multiple instances/zones plus a saturated product import racing an urgent unpublish; the unpublish must claim reserved capacity and complete without product purge starvation.
- [ ] Freeze `providerPurgeBarrierDigest` from current official/provider-tested semantics for both Vercel tag deletion and each Cloudflare purge class. An API success/accepted response is not automatically a global barrier: each provider operation must expose an enforceable completion signal or a reviewed hard global-effect bound with deterministic multi-PoP tests. Start the monotonic quiescence timer only after **both purge-one operations are globally effective** under that contract, then wait `staleFillCommitHardBoundSeconds + 1`. The fixed one-second margin is not statistical. Perform the fresh no-store Vercel-origin marker probe, repeat both purges, and wait/prove **both purge-two operations globally effective** before prewarm, two-round canaries, or final completion CAS. Recalculate the 150-second execution budget and provider tokens from the worst-case purge barriers plus quiescence; fail H1 strict option (a) if either provider lacks an enforceable barrier/bound. Any admission-closure, provider-rule, purge-barrier, deadline, or protocol drift returns retryable failure before purge one.
- [ ] Safety runtime canaries must exercise every persisted affected OLD+NEW identity and expected post-transition outcome for both browser and Googlebot. First prove authoritative DB and the post-floor **distributed** Edge Config digest/item reads agree on the claimed routing generation; management REST may diagnose the write but cannot prove propagation. Current identities must show the latest safety generation and expected publication/tenant/canonical state against the claim's coherent committed-content generation; detached/retired identities must not expose the former tenant; reassigned identities must resolve to the new tenant. Bound the set with an explicit configured maximum and fail to operator handling rather than truncate. A newer ordinary content generation cannot block this safety verdict. Tests must prove late instances cannot consult a stale process-local routing value after Edge Config/DB advances.
- [ ] Content canaries prove the committed pair returned by `advanced` **only for a claimable provider transition**. `snapshot_only` completes reconciliation from the atomic snapshot/pointer audit with no purge/prewarm/canary claim, and `promotion_staged` completes reconciliation into its parked stage while deferring all provider/canary proof to promotion CAS. If a newer dirty revision exists after a successful claimable purge, record the completed generation, retain exactly one successor due after the cooldown, and do not treat normal supersession as failure or restart immediately. After a safety purge, atomically absorb/supersede pending content provider work only when its exact committed generation and complete URL set were covered by the safety purge/canaries; unreconciled dirty work always remains pending.
- [ ] Freeze the content provider obligation to the exact commit-time safety generation, requested-identifier ownership, and every relevant global identity version/outcome. Immediately before **each** Vercel probe/delete, Cloudflare host/prefix/file purge, prewarm, canary round, and completion CAS, re-read those minimal versions through the claim RPC and require equality. If publication, detach, slug/domain mutation, or reassignment advanced any fence, perform no next side effect and atomically transfer the still-outstanding document-scope/tag/host/path duty into the current safety or one correctly owned successor before mapping the old generic row to `skipped`; never send an old merchant's purge/prewarm to a hostname or platform path now owned by another tenant. A completed newer safety work may cover it only by server-proven same-output/superset evidence. Race tests change ownership before every stage, including canonical A→B and platform-path slug reuse, and prove zero post-mismatch provider calls or new-tenant cache poisoning.
- [ ] Before every retry of a failed content-provider obligation, compare its committed generation with the current pointer. If a newer `advanced` obligation exists, atomically union the older outstanding URL/tag duty into the newer row, prove the newer row now covers a superset, and only then mark the older row `superseded`; never prewarm or canary stale output. If the successor reconciliation was `unchanged`, the older committed generation remains current and retains its provider obligation. Test both `G1 advanced → purge failed → G2 advanced` and `G1 advanced → purge failed → successor unchanged`.
- [ ] Mark work completed/superseded only under those rules. A safety completion and its `confirmed_safety_generation` advance are one compare-and-swap transaction and may succeed only after every frozen identity/provider/canary obligation passed; if the current safety generation has advanced, retain/transfer the outstanding union and never stamp an unproven generation confirmed. Otherwise record the stage/error, move the physical generic delivery to `retry` with bounded exponential backoff plus jitter, and expose logical receipt/API `retry_wait`; only exhausted/operator-required work becomes generic `dead_letter`. Proven supersession uses generic `skipped` plus specialized `superseded|covered`, never a new generic state. A `429` must parse and honor `Retry-After`; tests must prove no provider request occurs before it expires. Publication polling performs no inline retry/provider work and reports the exact receipt state using the `200/202/409/503` contract.
- [ ] Make claiming idempotent and safe under concurrent workers.
- [ ] Add structured journald fields for merchant id, transition class, changed/required document scope, safety generation/proof revision, target/reconciled dirty revisions, committed content generation, `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, nullable `sharedShellFingerprint`, `staticDocumentClosureDigest`, `homeDocumentFingerprint`, renderer/protocol/manifest digests, transition id, first-dirty age, attempt, stage, elapsed time, provider result/status, retry-after, Edge lease/digest, and current Cloudflare capacity assumption. Add `storefront-cache-operations-alert.ts` as the one deduplicating adapter for the required VPS-only `STOREFRONT_CACHE_ALERT_WEBHOOK_URL`; do not reuse the optional GitHub Actions SEO webhook. Alert safety after 2 minutes without latest-state completion, content after 5 minutes without reconciling the latest dirty revision, every dead letter, stale release heartbeat, provider-budget starvation, Edge-lease starvation, and alert-delivery failure. The adapter sends no hostname secrets/tokens or raw payloads, persists/exposes last attempt/success and sanitized failure in worker health, and never marks work complete. Enablement fails if a test alert cannot reach the reviewed operations channel; runtime alert failure leaves work durable and visible in journald/health.
- [ ] Before enabling, record the actual Cloudflare plan, per-operation item limits, and account-shared budget in the rollout evidence. Inventory every raw provider endpoint/helper call and fail if any path bypasses the central budget. Load-test the configured worst-case combined rate—including both safety quiescence purges, shared-shell/home work, deploy coherence, and representative product-import/PDP/category/listing purges—below the allowance; prove safety reservation/priority, correct global `Retry-After` recovery, honest retry ownership for lower-priority failures, no identity truncation, and no unrelated-storefront eviction.
- [ ] Before `enable-merchant`, with no PSI/DebugBear/browser lane active and at owner-approved load timing, prove delayed-origin cache admission and both provider purge barriers for the exact `cacheAdmissionClosureDigest`, `providerRuleDigest`, and `providerPurgeBarrierDigest`; record `provenAtSha` only as provenance. Separately run `measure-storefront-origin-fill.ts` against the reviewed Vercel-origin/platform-path URL using `--samples 100 --concurrency 4 --expected-sha <H1_SHA> --expected-deployment-marker <MARKER> --expected-merchant-id <OGABASSEY_MERCHANT_ID> --output <DIAGNOSTIC_ARTIFACT>`. The diagnostic tool reads every body and reports p50/p95/p99/max without supplying the fence. `enable-merchant` refuses missing/stale/wrong-closure/wrong-provider/wrong-purge-barrier evidence, a bound outside `1..14 s`, a quiescence interval outside `2..15 s`, or a recomputed provider-stage budget above the frozen executor deadline.
- [ ] Keep #3077's existing continuously running `baci-domain-event-router.service` and `baci-event-delivery-worker.service`, `Restart=on-failure`, V2 release heartbeats, and existing one-minute recovery sweeps as the only runtime. Extend health checks to expose exact source SHA/capabilities/effective cache flags plus per-destination queue age/depth, last storefront route/claim, lease recovery, and safety/content backlog without adding another service, cron entry, web route, or `vercel.json` job. A one-off recovery uses the existing wrappers and the same specialized ingress/destination-filtered claims.
- [ ] Freeze the two-lane claim topology in tests: the existing lane explicitly excludes `storefront_cache_transition`; the storefront lane exclusively includes it and orders safety before content. The worker process may interleave lanes fairly, but no second process/route may claim cache work. A cache claim never consumes analytics concurrency, and an analytics claim never uses the formula-derived storefront lease/deadline tuple. The intended `210/150 s` tuple is enabled only after the checked-in stage formula proves it sufficient.
- [ ] Implement `list`, `requeue`, and `resolve-covered` by extending #3077's existing caller-bound authenticated dead-letter/replay admin routes and destination adapter, not by adding a cache-only CLI, service-role route client, or operator stack. Preserve the current-head admin-filter migration's destination and operator authorization. List uses stable `(created_at, id)` cursor pagination, checks `is_event_pipeline_operator_v1()`, and returns sanitized error summaries. Requeue requires expected row version plus exact authenticated operator UUID, resets only the current retry cycle, preserves lifetime attempts/frozen obligations, and appends operator UUID/reason to immutable audit. Resolve-covered requires the same operator identity plus the completed covering work id and server-side same-merchant, generation, inherited-safety-duty, and document-scope-lattice proof: equal classes may cover; `shared_shell` may cover `home_content`; `home_content` may never cover `shared_shell`; and safety may cover content only when its frozen duties explicitly inherited and completed that exact document scope. Grant these guarded RPCs to `authenticated` and `service_role`, require `p_operator_id=auth.uid()` except for service role, and keep worker claim/complete/retry/transfer authority service-role-only. Rehearse owner/non-operator/cross-id/operator/service-role matrices and the documented admin/runbook flow on a disposable dead letter before enablement.
- [ ] Make `vps-workers/deploy.sh --app-sha <H1_SHA>` deploy the source it actually runs. Fetch the exact commit into a new immutable `/opt/baci/releases/<full-sha>` checkout, verify the commit is reachable from the reviewed repository, install with the repository's locked pnpm version and `pnpm install --frozen-lockfile`, run the worker/config and renderer-manifest `--check` smoke suite, and only then atomically switch `BACI_REPO_DIR` (or the one canonical `/opt/baci/app` symlink) to that release. Restart the two existing services, require `git -C "$BACI_REPO_DIR" rev-parse HEAD == <H1_SHA>`, and wait for fresh router/delivery V2 heartbeats containing that SHA, effective flags, renderer digest, and exact capability versions. Only after readback succeeds may the operator CAS-activate the DB release row and enable OgaBassey. Any install/restart/readback failure keeps control disabled, atomically restores the prior source pointer, restarts the old binaries, and records the failed release; it never half-activates. The changing Vercel marker is observed per claim, not installed into this release.
- [ ] Make `manage-storefront-critical-control.ts` the fail-closed caller for release activation/sweeps, cache-protocol rotation begin/status/drain/abort, `set_storefront_critical_control_state_v1`, both control finalizers, `set_storefront_critical_render_mode_v1`, and exact operator-status polling; manual SQL is forbidden. Every mutating command requires a caller-generated `operation_id` persisted in the rollout ledger before the RPC, and retries that exact id only. `activate-release` verifies the local/installed full SHA, executable renderer-manifest epoch/digest/shell version, complete cache-protocol manifest, exact router/delivery capability versions, fresh matching heartbeats, and both expected DB versions before the atomic worker+renderer CAS. A `1→0` activation additionally aborts under the DB locks unless every affected control row is already `render_mode=degraded`, no permanent-promotion/suppression receipt is live, and any row that was previously permanent has a latest completed/covered suppression receipt proving the degraded shared-shell canaries; a never-promoted awaiting stage may instead prove it never exposed permanent bytes. The release RPC never silently demotes a control row. A changed cache-protocol digest also requires the exact durable drained rotation id and refuses all other states. If the returned renderer sweep id is non-null, it drives/resumes cursor batches until enqueue `sweep_complete=true`, then pages `get_storefront_renderer_reconciliation_sweep_status_v1('release_activation',operation_id,sweep_id,...)` against one stable sweep row version; cursor completion or snapshot compatibility is never release readiness. Every renderer sweep requires `all_targets_activation_ready=true`. For a target-shell-1 sweep, each `direct_cache` target must be `cache_terminal`, each published `promotion_required` target must be `ready_stage` with non-null current stage/null work/compatible snapshot, and each unpublished promotion target may be `ready_deferred_unpublished` only after its exact neutral safety duty is terminal; mixed direct/staged/deferred targets therefore do **not** require `all_targets_terminal`. Deferred unpublished targets cannot be promoted, and republish must recreate their stage before `promote-render` succeeds. An all-direct sweep—including every target-shell-0 pair and especially forward `1→0` cleanup—additionally requires every target's exact current work to have terminal canary proof and `all_targets_terminal=true`; only then may rollback/release completion be reported. Any abandoned/superseded target makes activation readiness false and returns typed `SWEEP_SUPERSEDED`; any dead letter returns a hard typed failure with the exact target/work/receipt ids. If the CAS fails after the source pointer switched, it restores/restarts the prior release; if the CAS succeeds but the CLI dies or its response is lost, replaying the activation operation id recovers the same sweep id and resumes versioned status polling while the new release remains active/safe-degraded.
  - `rotate-cache-protocol` is a resumable multi-invocation command around the normal prebuilt deployment workflow; it never invokes `vercel` itself. `begin/drain` suppresses, drains, and final-disables the explicit merchant set under the old protocol, proves zero old work and flags off, then records `drained`. The rollout operator deploys the reviewed new web through the standard VPS/prebuilt workflow and records its exact run/attempt/marker. `activate` verifies that marker, installed worker SHA/heartbeats, and drained row before the protocol CAS; `resume` reads the exact rotation row/cursor; `abort` is allowed only before activation and records a bounded reason after restoring/proving the old release. Re-enable is a distinct normal command after new flags/heartbeats are exact.
  - `enable-merchant --merchant-id <uuid>` accepts only the explicitly named merchant, rechecks release/heartbeat/flags, CASes `disabled -> enabling/degraded`, then waits for the exact operator receipt to reach `routing_staged` while the worker seeds the snapshot and compatibility-v1/v2 route records with live signals absent. It alone CAS-activates DB routing and sends one atomic Edge PATCH containing the staged v2 records, activation value, and every live-v2 signal; after the fixed propagation floor it proves the distributed digest/items, promotes the staged identity children, and resumes the exact parent transition. It then waits for the worker's document purge/prewarm/browser+Googlebot proof to produce `cache_complete` before calling the enable finalizer with exact receipt/control/routing/generation versions. Only then is state `enabled`. It never constructs route-record payloads itself, never splits one visibility boundary across Edge writes, and never delegates bootstrap activation/live signals to the worker.
  - `promote-render` proves the current no-store Vercel-origin marker maps to the exact active source SHA, the checked-in manifest reports shell contract `1`, required/committed epoch/digest/shell version match, a compatible published snapshot exists, and the exact current `release_activation` or `merchant_enrollment` owner-kind/operation/sweep triple resolves through the locked status interface to exactly one in-scope `promotion_staged` row with no generic event. Its render-mode CAS receives and revalidates that immutable owner triple, atomically makes the mode permanent, and releases that row as one shared-shell event; it then polls the exact operator receipt through `completed|covered|superseded_conflict|dead_letter`, and `completed` requires permanent browser+Googlebot home/category/PDP/blog canaries. `suppress-render` uses the inverse exact-receipt path, selects shared-shell all-document work under shell `1`, and never disables the control plane.
  - `disable-merchant` CASes `enabling|enabled -> draining/degraded`, immediately serving the neutral no-permanent-Hero shape while all new mutations remain fenced. An enabling abort uses a new disable operation id, marks the enable receipt `superseded_conflict`, preserves newest safety/identity duties, and follows the same Edge-first path. It reads immutable routing-activation status before compensation, polls the exact drain receipt and older obligations until confirmed=current and quiescent, sends one atomic Edge deactivation PATCH containing compatibility-v1 desired state + activation false + every `legacy|absent` tombstone, waits/proves its distributed digest/items, replay-safely applies the routing-row CAS, then calls the disable finalizer with exact versions. The finalizer's `disabled + final_disable_transition_id != null` state remains fenced; the CLI must continue polling through the final legacy-visible purge/canary and refuse worker/flag shutdown. Only `disabled + final_disable_transition_id IS NULL` permits legacy mutations or shutdown. A concurrent safety mutation before or immediately after the finalizer CAS invalidates/transfers the final duty and forces continued polling rather than escaping the durable lane.
  Tests cover stale SHA/digest/shell version/heartbeat, incoherent production marker, false flags, wrong merchant, operation-id replay/mismatch, worker/renderer CAS races, release-only versus renderer-changing activation, CLI death between every phase, cursor resume, stale-worker rejection, enabling bootstrap, promotion without a compatible snapshot, suppression with provider failure/retry, drain-time publication/identity mutations, finalizer CAS conflict, Edge readback failure, final-disable purge failure/retry, forward-only renderer rollback, non-empty drain, and idempotent recovery. Enable failures remain enabling/degraded or are safely drained back to disabled; render-mode failures retain the last confirmed mode; disable failures retain draining plus the still-required worker/v2 writer until safe completion.
- [ ] Prove the merged deployment installs exactly the existing #3077 services and recovery sweeps and no `drain-invalidations` route, `WEB_CRON_CONFIG` entry, wakeup secret, cache-only process, service, or crontab entry. Gate `vps-workers/deploy.test.mjs`, `vps-workers/jobs/deploy-crontab.test.mjs`, wrapper/service tests, exact source-pointer rollback, and heartbeat readback. OgaBassey enablement requires router-ingress/delivery effective-state parity, the DB-activated exact release row, fresh matching heartbeats, empty/healthy cache backlog, and an observed transactional-source-to-delivery-claim latency within `5 s`.
- [ ] Write and rehearse the H1 rollback runbook on a disposable database using the same state machine: enter `draining`, keep mutations fenced while safety/routing/publication work converges, cover parked content duties, perform the one atomic compatibility-v1+activation-false+tombstone Edge PATCH and distributed proof before routing DB CAS, then call the exact disable finalizer. Continue the worker until its post-finalizer obligation clears `final_disable_transition_id`; turn storefront ingress/delivery flags off only after state is `disabled + final_disable_transition_id IS NULL`, no live storefront work remains, and tombstone maintenance is either completed or explicitly retained. Never deploy the literal pre-H1 app after H1D revokes authenticated `is_published/published_at` writes: the rollback web release must retain the H1D publication RPC, shared legacy/fenced response compatibility, and hardened ACL while disabling the cache feature through final control/config state. A true older-app rollback requires a separately reviewed **forward append-only compatibility migration** that restores a safe publication path before that app is deployed; it may not regrant unsafe direct writes casually. The worker pointer may return to the #3077-only source after the storefront lane drains, but the shared services remain. Keep the generic ingress/claim exclusions so stale binaries cannot consume linked storefront work. If database cleanup is required, use a new append-only compensating migration preserving audit rows. Never strand a pending unpublish transition or edit an applied migration.

H1 is a visible shell-0 whole-document cutover, not a nonvisual rehearsal. It deploys the request-publication-guarded Hero, immutable shared chrome, admitted semantic/link projection, zero-row feed placeholder, no-store client islands, complete document fingerprints, and both route-wide/home markers from one committed snapshot. It must prove transition recovery **and** its own controlled performance/safety gate before H2 may make that already-coherent Hero permanent HTML.

Prove the destructive publish/unpublish, detach/reassign, failure, supersession, and rollback matrix on the disposable local database by default. Production H1 proof is limited to worker destination-lane/heartbeat health, renderer activation/sweep, disabled-lane compatibility, OgaBassey enablement + initial snapshot seed, release/generation/routing coherence, one non-mutating transactional delivery-to-claim proof, and an empty/healthy backlog. Use a production-like non-OgaBassey transition identity only if the owner separately names and explicitly approves that merchant in the PR/rollout record. Never infer such authority and never publish/unpublish the real OgaBassey store merely to test the worker.

**Final cumulative H1D2 readiness gate (activation remains in H0R-H1-MEASURE)**

```bash
set -euo pipefail
umask 077
H1_LOCAL_ENV="$(mktemp /tmp/baci-local-supabase.XXXXXX)"
H1_GENERATED_TYPES="$(mktemp /tmp/baci-supabase-types.XXXXXX)"
cleanup_h1_gate() {
  gate_status=$?
  cleanup_status=0
  rm -f -- "$H1_LOCAL_ENV" "$H1_GENERATED_TYPES" || cleanup_status=$?
  trap - EXIT
  if [ "$gate_status" -ne 0 ]; then
    exit "$gate_status"
  fi
  exit "$cleanup_status"
}
trap cleanup_h1_gate EXIT
pnpm --filter @baci/web db:replay:chronological
supabase status -o env > "$H1_LOCAL_ENV"
LOCAL_DATABASE_URL="$(
  sed -nE 's/^DB_URL="?([^"[:space:]]+)"?$/\1/p' "$H1_LOCAL_ENV" |
    head -n 1
)"
case "$LOCAL_DATABASE_URL" in
  postgresql://*@127.0.0.1:*/*|postgresql://*@localhost:*/*) ;;
  *) echo "refusing non-loopback Supabase database" >&2; exit 2 ;;
esac
psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/tests/restore_merchants_anon_public_columns.sql
H1_SQL_COUNT="$(
  find supabase/tests -maxdepth 1 -type f \
    \( -name 'storefront_critical_h1a_*.sql' \
       -o -name 'storefront_critical_h1d1_*.sql' \
       -o -name 'storefront_critical_h1d2_*.sql' \) |
    wc -l | tr -d '[:space:]'
)"
if [ "$H1_SQL_COUNT" -eq 0 ]; then
  echo "no focused storefront critical SQL suites found" >&2
  exit 2
fi
while IFS= read -r sql_file; do
  sql_lines="$(wc -l < "$sql_file" | tr -d '[:space:]')"
  if [ "$sql_lines" -gt 300 ]; then
    echo "oversized SQL suite: $sql_file ($sql_lines lines)" >&2
    exit 2
  fi
  psql "$LOCAL_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
done < <(
  find supabase/tests -maxdepth 1 -type f \
    \( -name 'storefront_critical_h1a_*.sql' \
       -o -name 'storefront_critical_h1d1_*.sql' \
       -o -name 'storefront_critical_h1d2_*.sql' \) |
    LC_ALL=C sort
)
pnpm --dir apps/web exec tsx \
  tools/test/assert-storefront-publication-eligibility-parity.ts \
  --env-file "$H1_LOCAL_ENV"
supabase gen types typescript --local > "$H1_GENERATED_TYPES"
cmp "$H1_GENERATED_TYPES" apps/web/src/types/supabase.ts
pnpm --dir apps/web exec tsx \
  tools/perf/assert-ogabassey-renderer-contract.ts --check
pnpm --dir apps/web exec tsx \
  tools/perf/assert-storefront-cache-protocol.ts --check
pnpm --filter @baci/web exec vitest run \
  src/schemas/storefront-home-critical-generation-state.test.ts \
  src/schemas/storefront-critical-operator-transition.test.ts \
  src/schemas/storefront-routing-edge-record.test.ts \
  src/schemas/storefront-routing-v2-live-record.test.ts \
  src/schemas/storefront-routing-resolution.test.ts \
  src/schemas/storefront-routing-v2-activation.test.ts \
  src/schemas/storefront-cache-invalidation-claim.test.ts \
  src/schemas/storefront-cache-provider-outcome.test.ts \
  src/schemas/storefront-cache-canary-outcome.test.ts \
  src/schemas/storefront-worker-release-capability.test.ts \
  src/schemas/storefront-cache-purge-actuator-request.test.ts \
  src/schemas/storefront-cache-purge-actuator-response.test.ts \
  src/schemas/storefront-cache-purge-actuator-probe-response.test.ts \
  src/lib/ogabassey-home-critical-snapshot.test.ts \
  src/lib/ogabassey-home-semantic-snapshot.test.ts \
  src/lib/ogabassey-home-critical-public-payload.test.ts \
  src/lib/ogabassey-home-semantic-public-payload.test.ts \
  src/lib/ogabassey-launch-product-selection.test.ts \
  src/lib/ogabassey-home-lcp-fingerprint.test.ts \
  src/lib/ogabassey-home-semantic-fingerprint.test.ts \
  src/lib/ogabassey-home-critical-fingerprint.test.ts \
  src/schemas/storefront-home-critical-public-snapshot.test.ts \
  src/schemas/storefront-home-critical-semantic-snapshot.test.ts \
  src/config/ogabassey-home-renderer-contract-manifest.test.ts \
  src/config/storefront-cache-protocol-manifest.test.ts \
  tools/perf/assert-ogabassey-renderer-contract.test.ts \
  tools/perf/assert-storefront-cache-protocol.test.ts \
  tools/test/assert-storefront-publication-eligibility-parity.test.ts \
  src/lib/domain-event-pipeline-migration.test.ts \
  src/lib/events/event-destination.test.ts \
  src/lib/events/event-pipeline-config.test.ts \
  src/lib/events/deliver-domain-event.test.ts \
  src/lib/events/storefront-cache-event-route.test.ts \
  src/lib/events/storefront-cache-transition-destination.test.ts \
  src/lib/events/storefront-cache-transition-data-access.test.ts \
  src/scripts/process-domain-events.test.ts \
  src/scripts/process-event-deliveries.test.ts \
  src/lib/cache-provider-purge-budget.test.ts \
  src/lib/storefront-public-fetch-policy.test.ts \
  src/lib/vercel-storefront-cache-purge-actuator-client.test.ts \
  src/lib/storefront-cache-purge-actuator-auth.test.ts \
  src/lib/storefront-routing-v2-writer.test.ts \
  src/lib/storefront-routing-v2-activation.test.ts \
  src/app/api/admin/event-pipeline/dead-letters/route.test.ts \
  src/app/api/admin/event-pipeline/replay/route.test.ts \
  src/app/api/internal/storefront-cache/purge-vercel-tags/route.test.ts \
  src/app/api/merchant/publish/route.test.ts \
  src/app/api/merchant/publish/status/route.test.ts \
  src/lib/storefront-publication-writer-inventory.test.ts \
  src/lib/merchant-publish-client.test.ts \
  src/app/dashboard/client-page.test.tsx \
  src/components/dashboard/setup-checklist.test.tsx \
  src/lib/storefront-publication-cache-eviction.test.ts \
  src/lib/vercel-storefront-publication-cache.test.ts \
  src/lib/cloudflare-purge.test.ts \
  src/lib/domain-cache-simple.test.ts \
  src/lib/slug-alias-cache.test.ts \
  src/lib/edge-config-keys.test.ts \
  src/lib/edge-config-sync.test.ts \
  src/app/api/edge-config/sync/route.test.ts \
  tools/ops/activate-storefront-routing-v2.test.ts \
  tools/ops/manage-storefront-critical-control.test.ts \
  src/proxy.test.ts
pnpm --filter @baci/shared exec vitest run \
  src/schemas/storefront-publication-transition.test.ts \
  src/schemas/storefront-publication-mutation-request.test.ts \
  src/schemas/storefront-publication-eligibility.test.ts
pnpm --filter baci-mobile-admin exec vitest run \
  hooks/useStorePublish.test.ts
node --test \
  vps-workers/bin/event-pipeline-wrappers.test.mjs \
  vps-workers/install-event-pipeline-services.test.mjs \
  vps-workers/deploy.test.mjs \
  vps-workers/jobs/deploy-crontab.test.mjs
pnpm --dir vps-workers test
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
if coderabbit review --help | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git diff --check
```

The focused storefront files are plain fail-fast transaction/`DO` suites, not pgTAP, so execute every nonempty phase glob with `psql -v ON_ERROR_STOP=1` as shown; never assume a broad `supabase test db` invocation validates them. A future genuine pgTAP suite must be invoked through its exact path and cannot replace these checks.

The cumulative SQL matrix must additionally prove `routing_reset_required`, activation response-loss replay/status, byte-identical routing-operation replay after live-row advance, mismatched replay denial, bootstrap revision invalidation before activation, Edge-first compensation after possible activation, reset at every DB/Edge/readback/finalizer boundary, stale-worker side-effect refusal, drain from `pending|routing_staged|routing_reset_required|cache_complete`, staged-child supersession/duty transfer into drain, and final convergence to the newest revision with no stale live signal. These requirements supersede any shorter receipt-state list in the legacy mega-checklist below.

Run `pnpm --filter @baci/web db:replay:chronological` only against the disposable local project after the CLI/Docker preflight; never substitute raw `supabase db reset`. In the checklist below, reconciliation arrows containing `unchanged`, `advanced`, or `completed` are an **audit timeline**, not physical row states: the singleton row has only `pending|leased`; `unchanged` atomically records the audit outcome, advances the reconciled pointer, and consumes/resets the due row, while `advanced` records the output/action, commits the snapshot/generation, and consumes/resets the reconciliation row. Only a claimable transition action also creates a provider obligation; `snapshot_only` creates none and `promotion_staged` creates only the parked no-event stage. No assertion may query a physical `unchanged|advanced|completed` reconciliation state. The SQL/local/PostgREST integration suite must prove migration replay including #3114; executable renderer-manifest closure/digest; exact public/private/authenticated RPC projections; authenticated direct-publication-column denial with intended safe columns retained; shared TS/SQL eligibility-fixture parity and atomic concurrent eligibility rejection; anon/authenticated/service-role ACLs; every positive and negative dirty/metadata-matrix trigger; compare-and-commit atomicity; immutable-snapshot behavior; distinct OLD+NEW purge identities with one latest outcome each; rate bounds; monotonic renderer activation; exact router/delivery release and heartbeat rejection; and all `disabled|enabling|enabled|draining`/outage behavior. It must show the audited timeline `pending -> leased -> unchanged -> completed` with no generic event/delivery and zero provider calls; `pending -> leased -> advanced(snapshot_only) -> completed` with no stage/event/work; `pending -> leased -> advanced(promotion_staged) -> completed` with one unclaimable stage and no generic event/delivery; and `pending -> leased -> advanced(claimable) -> completed` that atomically creates one specialized obligation plus one generic `pending -> routed -> claimed -> delivered` lifecycle; renderer-frozen predecessor -> exact-superset R2 successor -> one atomic successor completion + generic predecessor `skipped` + specialized predecessor `superseded|covered`; and generic `pending -> claimed -> retry -> claimed -> delivered` while the receipt/API reports `retry_wait -> completed`. No migration may add generic `retry_wait` or `superseded`. It must also prove pre-route and routed-preclaim coalescing with one event, post-claim coalescing with exactly one successor/event, and zero orphan events; immutable operator enable/disable/promote/suppress receipts reaching `routing_staged|cache_complete|completed|covered|superseded_conflict|dead_letter`; the complete bootstrap stage/activation/live-signal/public-canary/finalizer death matrix; the complete analytics-mode/storefront-ingress matrix; stale generic-router dead-letter refusal; exact publication receipt `200/202/409/503` cases including opposite-transition supersession; a new v1 no-op UUID receipt alias with zero generation/event/provider work; fenced receipt replay versus legacy correlation-only retry; post-finalizer `disabled + final_disable_transition_id IS NOT NULL` mutations remaining fenced while already rendering legacy bytes; a concurrent final-pending content write extending the exact final obligation; worker flag outage after enablement leaving mutations durably pending; identity-keyed v2 live signals plus global identity-version/child-obligation claim-stage-finalize/complete/release lifecycle across both reassignment directions and `A -> B -> C`; mixed old/new Edge Config readers with reader-first activation and Edge-first deactivation; activated-to-disabled reassignment; a representative non-Oga disabled merchant retaining v1/local routing without per-request DB fallback; transactional new-event enqueue rollback; existing-lane exclusion plus storefront-lane exclusivity/fairness; dynamic web-marker and cache-protocol mismatch handling before any deletion; complete frozen-claim protocol-closure drift; same-renderer/same-digest lease reclaim; renderer-changing transactional successor handoff; changed-digest drain/disable rotation with in-flight/retry/dead-letter/CLI-death/forward-rollback cases and zero old work at CAS; exact 32-tag/8-semantic-identity/8-identity-home/4-manifest-document/11-prospective-union admission with a ninth identity-home rejection while unpublish-at-cap still succeeds; every-target two-UA/two-round canary cardinality and bounded concurrency; route/redirect/absent outcome verdicts for custom/subdomain/platform-path targets; SSRF/DNS-rebinding/private-CNAME/redirect/proxy/TLS/NXDOMAIN/reattachment/size handling; cross-instance fail-closed Redis provider budgeting across every purge producer with safety reservation over product-import traffic; dead-letter list/CAS-requeue/resolve-covered through the authenticated operator-checked #3077 surface with cross-operator denial and the exact coverage lattice; a code-only epoch/digest transition; stale-worker rejection; H1 shell-0 stock changes entering the compatibility fingerprint and durable root-home lane with no detached product-root call; H2 shell-1 stock-only changes causing no home transition/provider call only after Product/Offer/availability removal; exact worker source-pointer rollback; H1A/H1D1/H1D2 phase-local generated-type diffs, H1D1 old/new fleet compatibility, H1D2 old-binary drain proof and direct-column denial, forward-rollback compatibility; and successful control/routing rollback rehearsal. Production needs only the non-destructive proofs listed above unless separately authorized.

For the `snapshot_only` audit timeline above, “no work” means no **new** content obligation/event/work. Test two disjoint cases: null `carried_work_id` has no provider row at all; non-null `carried_work_id` points to one pre-existing degraded/content-null home/shared duty whose id, target, event count, and proof remain byte-stable. A permanent-proof inherited duty takes the no-commit `superseded` timeline, and cleanup inheritance stays claimable rather than entering snapshot-only.

---

For every `home_content_shell0`, `home_content_shell1`, compatible-home `shared_shell`, or published-request-owned cleanup verdict, the exact early measurement marker and deferred semantic marker must name the same merchant, shell contract, content generation, and critical composite. `fetchStorefrontPublicDocument` recomputes `homeLcpFingerprint` from the actual canonical page-owned metadata/head, WebPage/H1/Hero/slide, and pure resource-hint projection bytes; recomputes `homeSemanticFingerprint` from the actual shell-specific bounded JSON-LD graph; recomputes `homeCrawlableLinksFingerprint` from the actual bounded canonical anchor projection; then recomputes `homeCriticalFingerprint` and `homeDocumentFingerprint` using the frozen static closure and actual shared-shell fingerprint before success. Marker equality alone is insufficient. Shell 0 additionally proves request-publication/tenant-guarded ownership; shell 1 proves permanent initial-HTML ownership. Every `shared_shell` canonical-document verdict under either shell recomputes `sharedShellFingerprint` from the actual theme, header/navigation/footer, parent/base head, static config, and canonical speculation-rule bytes; nested documents require the same value while canonical home additionally proves its complete shell-specific home tuple. The request-memoized home document adapter must validate both views before either H1 or H2 returns marker-bearing home JSX. The semantic renderer performs no RPC and receives only that validated graph/link object. Raw output tests require the measurement marker, resource hint, and Hero element to precede every semantic marker/graph/link byte and prove zero feed rows. A missing marker, mixed generation, component/document mismatch, aggregate-only proof, request-path graph reconstruction, semantic bytes before the Hero element, feed row in initial HTML/RSC, or admission size/CPU/p95 budget breach is retryable and performs no completion CAS.

## Normative Contract H2-A: Coherent Critical Render State And Static Shell

**Hard prerequisite:** H2 is blocked until the owner-approved `proxy.ts` home-response tag lane and H1 are merged, deployed, and proven by browser/Googlebot canaries for every supported OgaBassey identity. If proxy approval is denied, the H1 control plane is unavailable, or H0.75 cannot reproduce the actual-route static-prefix signature, stop H2 and write a replacement route-hierarchy proposal. A Hero-only leaf edit is not an allowed fallback: the current parent layout postpones ordinary `children` behind request-scoped merchant and header work.

H2 deliberately expands the executable renderer manifest, sets critical-shell contract version `1`, and bumps its epoch/digest. During the unavoidable deploy-before-renderer-CAS interval, the H2 app may receive a coherent shell-0 `enabled + degraded + compatible/request_owned` projection. It must classify that tuple as `renderer_mismatch` and render a brand-neutral, product-free, no-shopping response with no H1 or H2 home/shared measurement marker—not reinterpret shell 0 as an H2 degraded state and not fall back to stale slides. After the exact H2 source is installed for both existing VPS services, the atomic worker+renderer release activation succeeds, its durable reconciliation sweep completes, required/committed proofs agree, and the explicit render-mode promotion transition completes, only the exact shell-1 permanent tuple may expose permanent bytes. This post-deploy control-plane activation is part of H2 rollout but does not trigger a second Vercel deploy. Unrelated later deployments whose manifest is byte-identical require no worker activation.

**Create**

- `apps/web/src/app/(storefront)/ogabassey/ogabassey-critical-render-state.ts` and colocated test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-critical-render-state-types.ts`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-route-resolution.ts` and colocated test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-route-metadata.ts` and colocated test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-critical-shell-style.ts` and colocated test
- `apps/web/src/app/(storefront)/[slug]/ogabassey-static-shell-layout.tsx` and colocated test
- `apps/web/src/app/(storefront)/[slug]/ogabassey-request-shell-snapshot.ts` and colocated test
- `apps/web/src/app/(storefront)/[slug]/ogabassey-request-route-provider.tsx` and colocated test
- `apps/web/src/app/(storefront)/[slug]/storefront-layout-renderer.tsx` and colocated test, extracting the template discriminant and generic compatibility composer
- `apps/web/src/app/(storefront)/[slug]/storefront-shell-frame.tsx` and colocated test, extracting merchant/cart/tool provider ownership for generic/legacy routes
- `apps/web/src/app/(storefront)/[slug]/storefront-theme-frame.tsx` and colocated test
- `apps/web/src/app/(storefront)/[slug]/storefront-ppr-static-shell.tsx` and colocated test
- `apps/web/src/app/(storefront)/[slug]/storefront-layout-content.tsx` and colocated test, owning only generic/legacy request-bound layout content after the Oga static branch is selected

**Modify**

- `apps/web/src/app/(storefront)/[slug]/layout.tsx` and test
- `apps/web/src/app/(storefront)/[slug]/storefront-shell-snapshot.ts` and test
- `apps/web/src/app/(storefront)/[slug]/(blog)/layout.tsx` and a new colocated test
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(listing)/layout.tsx` and its existing colocated test
- `apps/web/src/app/(storefront)/[slug]/(catalog)/(pdp)/layout.tsx` and its existing colocated test
- `apps/web/src/app/(storefront)/[slug]/(commerce)/layout.tsx` and its existing colocated test
- `apps/web/src/app/(storefront)/[slug]/(content)/layout.tsx` and a new colocated test
- `apps/web/src/app/(storefront)/[slug]/(customer)/layout.tsx` and its existing colocated test
- `apps/web/src/app/(storefront)/[slug]/(utility)/layout.tsx` and a new colocated test
- `apps/web/src/components/storefront/ogabassey/storefront-shell-layout.tsx` and test
- `apps/web/src/components/storefront/ogabassey/storefront-layout.tsx` and test; it is retained as the explicit generic/legacy compatibility composer and is unreachable from a compatible permanent Oga route
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-measurement-marker.tsx` and test, preserving the same H0/H1 schema/component while adding typed H2 values
- `apps/web/src/components/storefront/ogabassey/ogabassey-shared-shell-marker.tsx` and colocated test, advancing its shell-0 schema to the shell-1 renderer contract without changing normalized safety/shared proof semantics
- `apps/web/tools/test/storefront-critical-active-phase.ts` and colocated test, advancing exactly once from `H1D2` to `H2`
- `apps/web/tools/test/storefront-critical-phase-gate-manifest.ts` and colocated test, adding the exact cumulative H2-A/H2-B/H2-C source, migration, deletion, build, and proof inventory
- `apps/web/tools/test/run-storefront-critical-phase-gate.ts` and colocated test, accepting only the committed `H2` marker and emitting the exact-head H2 gate receipt

**H2-A modularity is a merge gate.** The current `[slug]/layout.tsx` is `389` lines before this work. H2 must first extract its independent route resolution, request snapshot/slots, static Oga shell, and generic compatibility composition into the named modules so the finished layout facade and **every touched source/test** are each `<=300` lines. Run the same final-tree inventory across every nested layout and test listed above; create focused tests rather than growing a single layout suite past the limit. No “legacy file” exception applies to this H2 tree, and the protected-proxy grandfather cannot be reused here.

**Normative interfaces**

```ts
type OgabasseyGeneratedIdentifier = 'ogabassey' | 'ogabassey.com';

type OgabasseyCriticalRenderState =
  | {
      kind: 'ready';
      snapshot: Extract<
        StorefrontHomeCriticalPublicSnapshot,
        { identityState: 'bound' }
      >;
    }
  | {
      kind: 'disabled';
      snapshot: Extract<
        StorefrontHomeCriticalPublicSnapshot,
        {
          identityState: 'bound';
          controlState: 'disabled';
          snapshotState: 'disabled';
        }
      >;
    }
  | {
      kind: 'draining';
      snapshot: Extract<
        StorefrontHomeCriticalPublicSnapshot,
        { controlState: 'draining'; snapshotState: 'draining' }
      >;
    }
  | {
      kind: 'unbound';
      identifier: OgabasseyGeneratedIdentifier;
    }
  | {
      kind: 'unavailable';
      reason:
        | 'timeout'
        | 'lookup_error'
        | 'malformed'
        | 'renderer_mismatch';
    };

const getOgabasseyCriticalRenderState = cache(
  async (
    identifier: OgabasseyGeneratedIdentifier
  ): Promise<OgabasseyCriticalRenderState> => {
    // Normative behavior is specified below.
  }
);

type OgabasseyRouteResolution =
  | {
      kind: 'ready';
      criticalState: Extract<OgabasseyCriticalRenderState, { kind: 'ready' }>;
      requestSnapshot: null;
    }
  | {
      kind: 'draining';
      criticalState: Extract<
        OgabasseyCriticalRenderState,
        { kind: 'draining' }
      >;
      requestSnapshot: null;
    }
  | {
      kind: 'request_bound';
      criticalState: Extract<
        OgabasseyCriticalRenderState,
        { kind: 'disabled' | 'unbound' | 'unavailable' }
      >;
      requestSnapshot: StorefrontShellSnapshot | null;
    };

const getOgabasseyRouteResolution = cache(
  async (
    identifier: OgabasseyGeneratedIdentifier
  ): Promise<OgabasseyRouteResolution> => {
    // Normative behavior is specified below.
  }
);

interface OgabasseyRouteMetadataPair {
  layout: Metadata;
  home: Metadata;
}

function buildOgabasseyRouteMetadata(
  resolution: OgabasseyRouteResolution
): OgabasseyRouteMetadataPair;

function getOgabasseyRequestShellSnapshot(
  identifier: OgabasseyGeneratedIdentifier
): Promise<StorefrontShellSnapshot | null>;

interface OgabasseyStaticShellLayoutProps {
  children: React.ReactNode;
  criticalState: Extract<OgabasseyCriticalRenderState, { kind: 'ready' }>;
  identifier: OgabasseyGeneratedIdentifier;
}

interface OgabasseyRequestRouteProviderProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}
```

The interface block is the contract, not permission to put multiple primary exports in one source file. Put reusable types in the dedicated type/schema module and keep each runtime file to one primary export.

- [ ] First write a red coherence test. Call parent metadata, parent layout, home metadata, and home-critical page consumers in that order; mutate the mocked producer result/identifier ownership after the first read. All four must receive the same `OgabasseyRouteResolution` object identity and, when ready, the same early critical-state object, requested-identifier binding, safety/content generation pair, publication state, renderer contract, `homeLcpFingerprint`, `homeCriticalFingerprint`, theme, WebPage payload, and slides, with exactly one producer call. Under shell contract `1`, the same early state carries the committed canonical non-product semantic digest used by the composite. Before the home page returns a marker-bearing branch, `getOgabasseyHomeDocumentSnapshot(identifier)` combines that exact route resolution with the matching semantic view and validates the pair; the later semantic component receives the validated graph and performs no fetch. For unbound/unavailable, all four receive the same memoized request snapshot and actual tenant. No consumer may reconstruct a partial state from a second RPC.
- [ ] Implement `getOgabasseyCriticalRenderState` with React `cache()` around the H1 generation/snapshot producer, passing the normalized requested identifier into its cache key/RPC. It checks the exact `controlState`, renderer tuple, shell contract, render ownership, and `renderMode` before accepting a snapshot: both private disabled sub-states map to the same explicit legacy-visible `disabled` object carrying the exact bound product-free public snapshot and no finalization field; `draining` maps to the separately keyed fenced neutral state; only an exact shell-1 `enabled+degraded` tuple selects H2's neutral ready state; and even a cached formerly compatible payload is rejected when any public field changes. A shell-0 compatible/request-owned tuple observed by H2 before activation, or any wrong required/committed renderer tuple, maps to `unavailable(reason='renderer_mismatch')`; it is not an H2 degraded marker state and never renders H1/H2 markers, static continuation, feed island, or shopping bytes. H1A backfill guarantees the OgaBassey merchant has a persistent control row; a missing row for that constant merchant is `unavailable`, never an invented disabled safety tuple. A valid `identityState=unbound` maps to `unbound` and contains no snapshot/product data. The underlying remotely cached producer must otherwise return one schema-validated bound snapshot or throw; it must never convert timeout, RPC, or schema failure to `null` and must never remote-cache a failure/null sentinel. The wrapper applies the reviewed bounded timeout, catches ordinary failures, calls `unstable_rethrow(error)` before mapping to `unavailable`, and classifies only the reviewed failure reasons above. Disabled and draining are separately hard-keyed/tagged by control state and safety generation; the internal operator UUID never crosses the anon projection or cache key. `unavailable` is memoized only for the current React render. Tests prove disabled+private-finalizer and disabled+null produce byte-identical snapshots and standalone safety-marker HTML, missing-control produces no fabricated marker, H2-deploy-before-CAS shell 0 produces the product-free `renderer_mismatch` branch, H2 rollback-deploy-before-shell-0-CAS treats shell 1 the same way, and neither mismatch branch calls the static continuation or feed endpoint.
- [ ] Implement `getOgabasseyRouteResolution` as the only entrypoint used by both `generateMetadata` owners and both render owners. It awaits `getOgabasseyCriticalRenderState(identifier)` once. `ready` carries that exact object and does not request a full merchant for metadata; `draining` carries its exact neutral bound snapshot and likewise performs no legacy merchant read; only `disabled|unbound|unavailable` awaits `getOgabasseyRequestShellSnapshot(identifier)` once and carries that exact request snapshot for metadata/layout/page fallback. Both helpers use React `cache()` and the actual-route test must prove their memoization spans Next's metadata→layout→page execution order. A second direct call to the remote producer or request merchant helper from either metadata owner fails the import/call graph test.
- [ ] Freeze metadata field ownership. `[slug]/layout.tsx` remains the sole owner of base metadata (`metadataBase`, merchant verification, icons, manifest, and base site fields); `(home)/page.tsx` remains the sole owner of home title/description, canonical/language alternates, keywords, OpenGraph URL/title/image, and Twitter fields. Both call `getOgabasseyRouteResolution(identifier)` and then the same pure `buildOgabasseyRouteMetadata(resolution)`, returning only their named half. `ready + compatible + permanent ownership` derives both halves from the same early critical snapshot plus reviewed OgaBassey constants. `ready + degraded|suppressed` derives one reviewed product-free neutral metadata shape only from safety/publication/canonical/renderer state and constants; it consumes no mutable snapshot metadata field or content/shared fingerprint, so `snapshot_only` cannot change degraded head bytes. For `request_bound`, both derive from the same actual request-snapshot merchant or the same not-found metadata—never from the candidate identifier. Add metadata→layout→page interleaving tests for compatible/degraded/suppressed, detach/reassignment after the first read, and RPC timeout/error/malformed data; old Oga title/canonical may never pair with a new/generic body, nor the reverse.
- [ ] Mechanically serialize both compatible/permanent metadata halves into the output-fingerprint fixtures: the page-owned home half is byte-for-byte input to `homeLcpFingerprint`, the parent/base half is byte-for-byte input to `sharedShellFingerprint`, `homeCriticalFingerprint` is the version-2 LCP+semantic+crawlable-link composite, and `homeDocumentFingerprint` composes that value with shared-shell and static-closure digests. Assert that the metadata field sets are disjoint, their union equals every metadata/head byte emitted by the two owners, and a builder/output addition fails until it is assigned to exactly one half (or deliberately duplicated and labeled both). Neutral degraded/suppressed metadata is content-independent and excluded from both data fingerprints by construction.
- [ ] Add red/green tests for bound slug/domain identifiers, control disabled before the first read and between generation/snapshot/consumer reads, detached/reassigned/unbound identity, timeout, RPC failure, malformed data, Next control-flow rethrow, no remotely cached null, one producer call, and the mutation-between-consumers race. Follow the existing `ogabassey-home-hero-shell-data.ts` `unstable_rethrow` pattern rather than detecting Next digests manually.
- [ ] Reproduce the recorded H0.75 structural signature in the real route. `layout.tsx` resolves the generated identifier and branches for exactly `ogabassey.com` and `ogabassey` through `getOgabasseyRouteResolution` before any independent `getStorefrontShellSnapshotBase`, `headers()`, cookies, or request merchant helper. Do not add `@critical`, another parallel route, or a proxy-only fixture. The generic storefront branch remains behaviorally unchanged.
- [ ] Branch on the coherent route resolution before rendering any shopping subtree:
  - `draining`: render one bound neutral no-shopping transition shell with accurate neutral canonical metadata and no ordinary `children`, request chrome, Product/Offer/WebPage product schema, image, product copy, PDP link, Hero, or permanent fingerprints. It remains in the fenced mutation/control lane until final disable; it must never enter `request_bound + disabled` behavior early.
  - `request_bound + disabled`: render the exact legacy request-scoped storefront layout path from the resolver's same request snapshot. Emit no permanent critical snapshot, home measurement/content marker, shared marker, OgaBassey static metadata, or permanent Hero. Always emit the same product-free standalone `OgabasseyStorefrontSafetyMarker` with `controlRenderMode=legacy` for this persistent disabled control row; it exposes no finalization state and remains byte-equal when private completion clears the internal UUID. Visible shopping bytes are the unchanged legacy path. Whether mutations remain fenced or have returned to synchronous legacy is decided only by the private publication/cache control surface, never by this public render object.
  - `request_bound + unbound`: render the exact generic request-scoped storefront layout path for the tenant in the resolver's same request snapshot. Emit no OgaBassey theme, schema, Hero, marker, metadata, or product byte. The home page must make the same generic branch from that object.
  - `request_bound + unavailable`: never use the OgaBassey shopping compatibility path. For `renderer_mismatch`, do not request a second merchant snapshot: render one brand-neutral product-free no-shopping response with no ordinary `children`, request chrome, Hero, schema, image, link, or H1/H2 marker. For timeout/lookup/schema failure, the one request snapshot may be used only to detect an actually reassigned foreign tenant: that tenant may take the existing generic renderer, while the exact OgaBassey merchant, missing snapshot, or ambiguous identity gets the same brand-neutral product-free response. This state is campaign-ineligible and cannot be cache-admitted as a successful Oga document.
  - `ready + snapshotState=suppressed` in production: render the product-free parent marker in its explicit suppressed/null-shared-fields shape plus one themed `StoreNotPublished` response and no ordinary `children`, request chrome, product schema, product image, product copy, or PDP link. Preserve the current development exception by using the request-scoped compatibility path only in development.
  - `ready + snapshotState=compatible + criticalRenderOwnership=permanent + renderMode=permanent + criticalShellContractVersion=1`: render `OgabasseyStaticShellLayout` and ordinary `children` directly. No other compatible/request-owned shape is legal in H2; a shell-0 view or a compatible view lacking permanent ownership fails closed before this branch.
  - `ready + snapshotState=degraded`: render the neutral `OgabasseyStaticShellLayout` with its dedicated neutral critical child only. Suppress ordinary `children`, `OgabasseyHomeStaticContinuation`, client feed, crawlable links, and every shopping continuation. It uses neutral theme/schema/metadata, carries null home/shared fingerprints, and never renders a Hero. A renderer-mismatch tuple is not this state.
- [ ] `OgabasseyStaticShellLayout` may read only the supplied coherent bound state and reviewed constants. It renders `AdAttributionCapture` exactly once, one product-free `OgabasseySharedShellMarker`, one `StorefrontThemeProvider`, one `StorefrontCartProvider` initialized with canonical merchant slug `ogabassey`, and one `StorefrontShellLayout`. `StorefrontShellLayout` remains the sole owner of one `OgabasseyLayoutProviders` stateful scope. No raw `CachedMerchant`, `headers()`, `connection()`, cookie, request merchant, or routing helper may enter this static module.
- [ ] Make the parent marker one distinct versioned shared-shell schema, not an alias of the home marker. H1C2 first ships shell version `0`; H2 advances it to version `1`. Both preserve equal normalized values for schema family, exact merchant/template identity, current `safetyGeneration`, publication outcome, canonical target-manifest digest, canonical URL-outcome digest, required+committed renderer epoch/digest, render mode, snapshot state, non-null compatible `sharedShellContentGeneration`, and `sharedShellFingerprint`. The parser normalizes both versions into one `StorefrontPublicSafetyProof + shared output` projection; no test requires serialized version bytes to match. It emits no request-host identity, current home content generation, home component/document fingerprint, Hero/product/price/image/link field, or WebPage payload. A home-only commit leaves it byte-equal; safety/shared/renderer/shell/render changes own all-document invalidation. Degraded/suppressed ready states may emit the safety proof with null shared fields but never shopping bytes. Unbound/unavailable emit no Oga marker. Every persistent disabled control row emits only the byte-stable standalone `OgabasseyStorefrontSafetyMarker` before/after private finalizer clear. Require the compatible shared marker in initial HTML on every ready routed OgaBassey identity home and canonical home/category/PDP/blog for browser and Googlebot, with normalized safety equality and shell-specific shared generation/fingerprint proof across them.
- [ ] Render the static shell in this exact structural order:

```tsx
<>
  <AdAttributionCapture />
  <StorefrontThemeProvider appearance={ogabasseyAppearance}>
    <StorefrontCartProvider
      enableSmartCartPro
      merchantSlug="ogabassey"
      deferValidationUntilIdle
    >
      <OgabasseySharedShellMarker snapshot={criticalState.snapshot} />
      <StorefrontShellLayout
        shellStyle={criticalShellStyle}
        headerChrome={
          <OgabasseyStaticSharedHeader
            projection={criticalState.snapshot.sharedShell}
          />
        }
        footerChrome={
          <OgabasseyStaticSharedFooter
            projection={criticalState.snapshot.sharedShell}
          />
        }
        overlayChrome={<OgabasseyClientShellIslands />}
      >
        {children}
      </StorefrontShellLayout>
    </StorefrontCartProvider>
  </StorefrontThemeProvider>
</>
```

- [ ] Keep the two theme contracts type-correct. `ogabasseyAppearance` is the static `StorefrontAppearance` returned by `resolveStorefrontAppearance(identifier)`; it is not merchant brand color data. The new pure `buildOgabasseyCriticalShellStyle(theme: StorefrontHomeCriticalSharedShellProjection['theme'] | null)` returns the narrow CSS custom-property `CSSProperties` currently produced through `getOgabasseyLayoutStyle`; compatible rendering passes exactly `criticalState.snapshot.sharedShell.theme`, while degraded/suppressed rendering passes `null` and receives reviewed renderer-owned neutral defaults. There is no top-level `criticalTheme` field or second mutable theme alias. `StorefrontShellLayout` accepts that explicit `shellStyle` without a fake/full `MerchantData`, and `sharedShellFingerprint` covers the exact compatible theme object and every resulting CSS/header/navigation/footer/static-config byte. Identity mismatch, unknown snapshot state, generation mismatch, or renderer mismatch fails closed to degraded/no-Hero and schedules reconciliation; it never falls forward to stale slides.
- [ ] React-request-memoize `getOgabasseyRequestShellSnapshot(identifier)` only for generic fallback and non-home child merchant context. It owns request header routing, exact domain-versus-path `basePath`, and the full merchant projection for those branches, but no value from it may enter compatible Oga shared chrome or home HTML/RSC. The compatible Oga header/footer consume only `early.sharedShell`; personalized/user/cart/speculation/analytics tools live in `OgabasseyClientShellIslands`, whose server output is fixed fingerprinted placeholder markup and whose mutable data fetches are no-store after hydration.
- [ ] Preserve the merchant context inherited by every non-home route. `OgabasseyRequestRouteProvider` awaits the shared request snapshot and wraps only non-home route `children` in the existing stateless `StorefrontMerchantProvider`; for non-Oga identifiers it is a no-read passthrough. Use it in each existing non-home top-level route-group layout listed above. The `(home)` route never invokes it because all cacheable home bytes come from the immutable document snapshot or fixed no-store client stubs. Do not move or duplicate Cart, V2-theme, saved-items, customer-auth, or other stateful providers.
- [ ] Add a static route-tree coverage test that enumerates every immediate non-home route-group layout under `[slug]`, fails when a new group lacks `OgabasseyRequestRouteProvider`, and renders representative listing, PDP `ProductDetailClient`, commerce, content, customer/account, utility, and blog descendants under the special Oga parent. Each must resolve `useMerchant()` with the exact request snapshot/basePath and share the outer cart/theme state. Generic storefront routes retain the current single parent provider with no nested duplicate.
- [ ] A request snapshot that is missing, belongs to another merchant, or reports unpublished production state renders no Oga request chrome or below-fold shopping bytes. It cannot override coherent static safety/shared state or introduce a second Hero. Compatible-home tests fail on any call to the request merchant helper.
- [ ] Add red/green layout tests for canonical domain, platform path, and merchant subdomain base paths; bound compatible/degraded/suppressed, unbound/reassigned, unavailable, and development-exception states; static header-before-child/footer-after-child order; one Cart/Theme/`StorefrontShellLayout`/`OgabasseyLayoutProviders` instance; zero compatible-home request-snapshot calls; exact immutable shared projection use; fixed client-island server markup with no personalized/feed rows; identity mismatch generic-fallback behavior; nested `useMerchant` availability; and unchanged generic storefront behavior.

---

## Normative Contract H2-B: Root Home Ownership Of Permanent Critical Content

There is no parallel slot or request-owned home continuation in H2. The real generated home child supplies the static prefix proved by H0.75, followed only by the immutable `OgabasseyHomeStaticContinuation`; the no-store client feed activates after hydration.

**Create**

- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-critical-content.tsx` and colocated test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-static-continuation.tsx` and colocated test, rendering the already-admitted semantic marker/graph, crawlable anchors, fixed feed skeleton, and no-store client feed island with zero server product rows
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-unavailable-request-dispatcher.tsx` and colocated test
- `apps/web/src/lib/ogabassey-home-non-product-semantic-public-payload.ts` and colocated test, the one canonical shell-1 builder that reconstructs identity/WebSite/trust/topical/category-navigation/blog/homepage semantics without product/inventory bytes

**Modify**

- `apps/web/src/app/(storefront)/[slug]/(home)/page.tsx` and tests
- `apps/web/src/app/(storefront)/[slug]/(home)/ogabassey-static-home-page.tsx` and test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-dynamic-content.tsx` and test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-shell-data.ts` and test
- `apps/web/src/config/ogabassey-home-renderer-contract.ts`
- `apps/web/src/config/ogabassey-home-renderer-contract-manifest.ts` and colocated test
- `apps/web/src/lib/ogabassey-home-semantic-public-payload.ts` and colocated test, adding the shell-1 discriminant by delegating to the new canonical builder; H1A ships only the shell-0 implementation
- `apps/web/src/components/storefront/ogabassey/ogabassey-home-feed-client.tsx`, `ogabassey-home-feed-skeleton.tsx`, `ogabassey-home-crawlable-links.tsx`, `ogabassey-static-shared-header.tsx`, `ogabassey-static-shared-footer.tsx`, and `ogabassey-client-shell-islands.tsx` plus their tests, reusing the H1C2 byte-closure surfaces unchanged unless the renderer manifest deliberately changes their fixed server markup
- `apps/web/tools/perf/assert-ogabassey-renderer-contract.ts` and colocated test
- `apps/web/src/app/(storefront)/storefront-home-critical.css`
- `apps/web/src/app/(storefront)/storefront-home-critical-ogabassey.css`
- `apps/web/src/app/(storefront)/storefront-css-partition-fixtures.ts`, `storefront-critical-css-source-discovery.test.ts`, and `storefront-deferred-css-partition.test.ts`

**H2-B modularity is a merge gate.** H1C2 has already reduced `ogabassey-home-dynamic-content.tsx` and split its 475-line test, split the 608-line CSS-partition test, and split the 362-line critical stylesheet. H2 must preserve those boundaries. Before the H2 commit, run a fresh line/export inventory over every touched source, test, and CSS asset. The existing critical-CSS facade, `storefront-home-critical-ogabassey.css`, every focused CSS test/helper, dynamic source/test, and home-page test must each remain `<=300` lines; create another focused module before crossing the limit. No touched oversized code, test, or stylesheet is grandfathered.

**Delete in H2**

- `apps/web/src/app/(storefront)/ogabassey/ogabassey-static-home-page-content.tsx` and test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-publication-safe-hero-fallback.tsx` and test
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-static-resource-hints.tsx` and test; H2's pure slide-zero projection/critical-content path is the sole resource-hint owner
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-page-content.tsx` and test; H2 critical/static-continuation components already own its publication/tenant/semantic responsibilities

The H2 modifications to `storefront-home-critical.css`, `storefront-home-critical-ogabassey.css`, and the three named CSS-partition files remove and test the exact `@source` entries for these four deleted render modules; there is no wildcard or executor-chosen deletion.

The H2 import-graph test must prove all four deleted H1 render modules are unreachable, that `ogabassey-static-home-page.tsx` no longer imports `OgabasseyStaticResourceHints`, and that exactly one slide-zero resource-hint owner and one semantic-marker/graph owner remain.

**Normative interfaces**

```ts
interface OgabasseyHomeCriticalContentProps {
  identifier: OgabasseyGeneratedIdentifier;
}

interface OgabasseyHomeStaticContinuationProps {
  identifier: OgabasseyGeneratedIdentifier;
}
```

`OgabasseyHomeStaticContinuation` deliberately has no merchant, path-prefix, request-snapshot, or product-row prop. It obtains the already-admitted deferred semantic/link view from `getOgabasseyHomeDocumentSnapshot(identifier)` and gives the client feed only the validated public identifier plus fixed endpoint configuration.

- [ ] Preserve `generateStaticParams()` with exact values `ogabassey.com` and `ogabassey`. For either candidate identifier, the primary home page first reads the shared route resolution. `request_bound + disabled` delegates to the exact legacy request-scoped home renderer using the resolver's same snapshot and emits no permanent critical/shared/home measurement marker, permanent metadata, or permanent Hero. The parent always emits the same standalone product-free safety marker with normalized `controlRenderMode=legacy` for a bound persistent disabled control row, independent of the private finalizer UUID. `request_bound + unbound` delegates to the exact existing generic home renderer with the original `params` and same actual request snapshot; it imports/emits no OgaBassey critical CSS, resource hint, schema, marker, theme, metadata, or Hero. `request_bound + unavailable` emits no merchant-branded static bytes and renders only `<Suspense fallback={null}><OgabasseyHomeUnavailableRequestDispatcher params={params} /></Suspense>`. The dispatcher may use the resolution's one request snapshot only to route a positively resolved **different** tenant to the existing generic renderer; exact OgaBassey, missing, ambiguous, and every `renderer_mismatch` case renders the brand-neutral product-free response with zero shopping continuation. For `ready`, branch before creating child JSX: `degraded` renders `OgabasseyHomeCriticalContent` alone, `suppressed` renders no ordinary home child, and only `compatible+permanent` renders this exact immutable order:

```tsx
<>
  <OgabasseyHomeCriticalContent identifier={identifier} />
  <OgabasseyHomeStaticContinuation identifier={identifier} />
</>
```

Generic merchant homes keep their current path. Category, PDP, blog, and all nested routes have no import or render path to `OgabasseyHomeCriticalContent`.

- [ ] Make both metadata owners consume the same `getOgabasseyRouteResolution(identifier)` object as layout/page—never the remote producer or request merchant helper directly. `ready + compatible + permanent ownership` uses the immutable early view's exact bounded `metadata` projection plus reviewed constants and only when bound to `OGABASSEY_MERCHANT_ID`; `ready + degraded|suppressed` uses the neutral content-independent metadata contract above; `request_bound` uses the resolver's one actual request snapshot for both layout/home metadata. Test metadata→layout→page interleaving after detach/reassignment and during timeout/RPC/schema failure: the new tenant's title/canonical/body agree, there are zero stale OgaBassey Hero/schema/theme/marker/metadata bytes, no blank home, and browser/Googlebot parity. A compatible/permanent ready view whose metadata projection is absent/malformed is `unavailable`, not permission for a second merchant read; degraded/suppressed never read that projection.

- [ ] `OgabasseyHomeCriticalContent` consumes the request-memoized `getOgabasseyHomeDocumentSnapshot(identifier)` already admitted by the home page and only its exact ready route resolution's `criticalState`; parent metadata/layout still consume the early route resolution without semantic bytes. It is the sole owner of static WebPage JSON-LD, the same H0-created discriminated `OgabasseyHomeMeasurementMarker`, slide-zero connection/resource hints, and the permanent Hero. For an eligible permanent document, the marker carries H2's typed `safetyGeneration`, proof revision, required+committed renderer epoch/digest, shell contract version, `initial_storefront_presentation_mode=permanent`, `initial_control_render_mode=permanent`, current `contentGeneration`, `homeLcpFingerprint`, and `homeCriticalFingerprint`; the document adapter has already verified the complete semantic/link/shared/static/document tuple before this component can render. `OgabasseyHomeCriticalContent` emits no semantic bytes itself; `OgabasseyHomeStaticContinuation` receives that same validated graph/link object and emits the semantic marker, graph, crawlable anchors, skeleton, and feed client stub after the Hero element with no RPC or live read. For an eligible degraded document it carries the safety/renderer/shell/two-mode tuple with content generation and all home fingerprint fields exactly null. Suppressed and unavailable branches never render this component/marker and are measurement-ineligible; no null-valued marker variant exists for them. The parent `OgabasseySharedShellMarker` remains the sole owner of `sharedShellContentGeneration`/`sharedShellFingerprint`; neither component duplicates or substitutes the other's marker.
- [ ] Render the discriminated state exactly:
  - `ready + compatible`: require the constant merchant id, `criticalRenderOwnership=permanent`, `render_mode=permanent`, `critical_shell_contract_version=1`, `snapshot_safety_generation=current safety_generation` (never `confirmed_safety_generation`), matching snapshot/content generation, non-null LCP/composite fingerprints, the committed canonical non-product semantic digest, and committed renderer contract equal to both the DB requirement and deployed reviewed constant; then emit one Hero from the immutable slides. Provider purge/prewarm/browser+Googlebot canaries recompute the LCP component, later non-product semantic component, composite, and shared-shell component from actual output before the completion CAS advances `confirmed_safety_generation`.
  - `ready + degraded`: emit only the neutral critical shell: safety generation plus renderer/control-render-mode proof with home/shared content generation and fingerprints exactly null, neutral WebPage JSON-LD, one accessible neutral H1, and no Hero/Product/Offer/image/PDP-link/static-continuation/feed bytes. A private `snapshot_only` commit therefore changes no degraded document byte.
  - `ready + suppressed`: emit no shopping content, product schema, or home measurement marker defensively; the parent production branch must already have removed `children`, and the state is campaign-ineligible.
  - `disabled`: emit nothing defensively. The route resolver must already have selected the legacy request-scoped path, and the disable transition owns outer-cache purge/canary completion.
  - `draining`: emit only the neutral bound transition shell defensively. The route resolver must not request legacy merchant state or render shopping bytes while the durable drain obligation is live.
  - `unbound`: emit nothing defensively. The page and parent must already have delegated to the generic request-scoped tenant path.
  - `unavailable`: emit nothing, including no home measurement marker. The parent/page use the brand-neutral request-scoped compatibility dispatcher while the control plane recovers; only the resolved current tenant may add request-owned metadata/content, and the state is campaign-ineligible.
- [ ] Every compatible Oga Hero/PDP, header, footer, crawlable-anchor, speculation, and feed-endpoint identity uses the committed canonical absolute origin/URLs; no compatible home byte or client request derives a static/request `basePath`. Request-snapshot `basePath` remains only in generic/legacy fallback and non-home child merchant context.
- [ ] `OgabasseyHomeStaticContinuation` is legal only for the same `compatible+permanent` `OgabasseyHomeDocumentSnapshot` already admitted for `OgabasseyHomeCriticalContent`; its props/adapter make degraded, suppressed, unavailable, disabled, draining, or unbound invocation unrepresentable or fail closed before rendering. It receives no request snapshot or merchant row. It renders the committed semantic marker/graph, bounded crawlable anchors, fixed feed skeleton, and the client feed island whose initial server output contains zero product rows. Tests assert the page never instantiates it for `ready+degraded`, the whole initial HTML/RSC contains no feed price/image/stock/product-card payload, and exact-Oga unavailable/mismatch contains zero below-fold shopping bytes.
- [ ] Complete the H2 semantic cutover against H1's admitted deferred projection, not a second live graph. H1C2 already removed independent graph/link construction from the render path. In the same atomic H2 range, replace the shell-0 full graph with the dedicated canonical shell-1 builder that reconstructs public identity/WebSite/trust/topical/category-navigation/blog semantics and a product-free homepage node without inventory-bearing `mainEntity`, JSON-LD product significant links, Product/Offer/availability/price/stock/image fields. Preserve the separately committed at-most-24 name+canonical-href anchor projection unchanged unless its fingerprint deliberately changes. Recompute semantic/link/home-critical/document digests, update the dirty matrix/renderer manifest, and keep the deferred RPC compatible for the exact shell-1 generation. The builder must not recursively delete all CollectionPage nodes. `OgabasseyHomeCriticalContent` remains the sole WebPage JSON-LD owner; `OgabasseyHomeStaticContinuation` emits only the committed non-inventory graph, crawlable anchors, fixed skeleton, and no-store client stub. Compatible tests parse the committed semantic graph and require zero Product/Offer/availability/product-significant-link nodes/keys while separately requiring the reviewed anchor list and Hero links. Degraded/suppressed/disabled/unbound/unavailable whole responses require zero shopping links/bytes. PDP Product/Offer structured data remains unchanged.
- [ ] In the `unavailable` path, never reconstruct a Hero or OgaBassey below-fold shopping continuation from a second read. A snapshot/control-plane outage or renderer mismatch yields the brand-neutral product-free response for current/unknown Oga ownership; only a request snapshot that positively resolves to a different tenant may invoke that tenant's existing generic renderer. Add browser/Googlebot tests for exact Oga ownership, missing/ambiguous identity, shell-0-before-H2-CAS, shell-1-before-rollback-CAS, and reassigned-domain ownership.
- [ ] Add an import-graph regression test proving the critical-state, critical-content, static-continuation, and compatible shared-shell graphs contain no `headers`, `connection`, cookies, request-scoped merchant helper, `storefront-shell-snapshot`, admin client, or service-role import. Request routing/path resolution may live only in explicitly generic/legacy fallback and non-home child-context modules.
- [ ] Preserve carousel behavior. Do not modify autoplay, swipe, controls, rail geometry, or `Hero.tsx` without a separately proven integration defect.
- [ ] Reassess the manual responsive preload after the `picture` is present in initial HTML. Keep it only if one controlled waterfall proves exactly one selected product-image request, no unused-preload warning, and no cross-device candidate download; otherwise rely on eager/high-priority in-markup discovery.
- [ ] Update Tailwind `@source` entries and the CSS-partition regression for every critical state/content/layout/fallback file whose utilities must exist before deferred homepage CSS. The test must specifically fail if a newly imported critical component is absent from source discovery.

Normative Contracts H2-A and H2-B are one atomic, reviewable H2 SHA range; H2-C is the mandatory proof for that same range. A rollback restores the exact **measured H1C2 shell-0 route tree and visible behavior**: remove the mandatory parent split, static provider shell, ordinary-child permanent critical owner, and H2-only route-resolution/render modules; restore the committed pre-render document adapter, page-owned metadata projection, request-publication/tenant-guarded Hero and home marker, later validated semantic renderer/marker, versioned compatible shared marker, and byte-stable disabled-legacy safety marker from the exact H1 measurement SHA. There is no future “semantic closure” PR and no return to a pre-H1 incomplete approximation. After H2 renderer activation this is still not a plain historical revert: create a new revert/fix commit whose executable renderer manifest contains those restored H1 semantic entrypoints under a newly generated **higher** renderer epoch/digest, deploy that exact commit through the normal prebuilt Vercel flow and exact VPS source-release flow, atomically activate its worker/renderer release, resume its sweep, and require H1-visible browser/Googlebot canaries before declaring rollback complete. No parallel-slot files or proxy rewrite belong to this range; the DB epoch is never decremented.

---

## Normative Contract H2-C: Non-Parallel Hoisted Route Tree Proof

**Create**

- `apps/web/tools/perf/assert-ogabassey-home-initial-shell.ts`
- `apps/web/tools/perf/assert-ogabassey-home-initial-shell.test.ts`
- `apps/web/tools/perf/run-ogabassey-h2-build-fixture.ts`
- `apps/web/tools/perf/run-ogabassey-h2-build-fixture.test.ts`
- `supabase/tests/fixtures/ogabassey_h2_build_fixture.sql` (local disposable test data only; never a migration or production seed)

- [ ] Make the local build deterministic and independent of production state. `run-ogabassey-h2-build-fixture.ts` refuses to run unless `BACI_ALLOW_LOCAL_H2_BUILD_FIXTURE=1`, `supabase status -o env` identifies the disposable project, and every database/API hostname is loopback; it rejects inherited production project refs, URLs, keys, and non-loopback DNS before seeding or spawning Next. It creates a scrubbed child environment containing only the derived local Supabase URL/anon/service-role values, deterministic `OGABASSEY_MERCHANT_ID`, and reviewed build variables. The SQL fixture may commit deterministic release/heartbeat/provider-completion facts that normally arrive externally so the separate Next child can observe them, but only inside the disposable local database; no migration/backdoor may expose that ability and the public payload must still be built through the real TypeScript selector/builder plus generation-checked compare-and-commit path. It removes secret-bearing temp files on every exit and runs idempotent compensating fixture cleanup/reset on any failed mode. The successful compatible mode deliberately retains only disposable local rows through its runner-owned server/capture proof, and the full-gate `EXIT` trap invokes `--mode cleanup` again.
- [ ] Run two local builds in this order through that runner. `--mode h1-mismatch` seeds both real generated identifiers against an enabled/permanent-looking control whose required/committed renderer is the H1 shell-version-0 contract while the checked-out app is H2; the build must fail closed to the degraded/no-Hero artifact and record why, then compensating-clean its committed local rows. `--mode compatible-h2` then resets the fixture, installs the exact checked-in H2 worker/renderer/cache-protocol release and fresh local heartbeats, seeds the deterministic OgaBassey merchant/catalog/identity rows, runs reconciliation to an immutable shell-version-1 snapshot with the canonical non-product semantic payload/component, records a completed local render-promotion receipt, and builds again; both `ogabassey.com` and `ogabassey` artifacts must be `ready/permanent` with the same generation, LCP/composite fingerprints, recomputed non-product semantic component/marker, and Hero. The same runner immediately owns the local server and complete capture matrix under its scrubbed environment, then kills/waits for that exact child before returning; it leaves the compatible `.next` tree and capture files for the assertion tool. A live deployment, production snapshot, or developer `.env` value is never an input.
- [ ] Resolve both real generated identifiers, build with local Next (the fixture runner invokes exactly `pnpm --filter @baci/web build`), and parse the prerender manifest plus actual route artifacts. Never use `vercel build`. Require the H0.75 recorded structural signature and fail if the Next version, generated-route ownership, or boundary placement drifts without a new reviewed spike.
- [ ] For both identifiers, require this artifact order: product-free parent shared-shell marker, immutable static shared header geometry, home measurement/content/renderer/fingerprint marker, Hero image and slide-zero link, then the immutable `OgabasseyHomeStaticContinuation` semantic marker/graph/crawlable anchors/fixed feed placeholder. Every compatible-state marker/Hero byte must precede the static continuation; no request-owned home continuation or server-rendered product feed row may exist. A fully collected streamed response does not count.
- [ ] In artifact/HTML assertions, require only observable output: one header geometry owner, one `main#main-content`, one Hero, one H1, one footer owner, one selected eager/high-priority image, canonical absolute Hero links, and no duplicate product UI in the deferred subtree. Suppressed fixtures expose no product bytes; degraded fixtures preserve neutral WebPage/H1 output and no Hero; unavailable static output is brand-neutral/empty until the request dispatcher resolves the current tenant.
- [ ] Provider cardinality is **not observable in captured HTML** because React Context providers emit no DOM. Prove one `StorefrontThemeProvider`, `StorefrontCartProvider`, `StorefrontShellLayout`, and `OgabasseyLayoutProviders` instance in mocked layout integration tests, and prove that header, Hero, static continuation, and cart interaction share that one stateful scope. Browser QA proves shared cart/theme behavior after hydration; the curl/assertion tool must never claim provider counts.
- [ ] Build/test category, PDP, blog, and nested route artifacts. Every compatible OgaBassey artifact must contain the exact same parent shared-shell marker as home for its safety/shared-shell-generation/fingerprint/renderer/shell tuple, while none may contain either home-specific marker, current home content generation, home component/composite fingerprint, home WebPage or semantic payload, Hero, or slide-zero hint. There is no soft-navigation parallel-slot test because H2 contains no parallel slot; browser QA still verifies home → PDP/category/blog navigation removes home content normally.
- [ ] The **compatible fixture runner**, not the ambient outer shell, owns the local production server and capture lifecycle. After the compatible build, it removes/recreates the requested capture directory, spawns exactly `pnpm --dir apps/web start --port 3100` under the same validated scrubbed local-Supabase environment, records the exact child PID, waits for a bounded readiness probe, overwrites every expected capture, verifies the child is still that PID, then terminates/waits for it on success or error. It writes a capture manifest with mode, build digest, PID/start/stop status, expected filenames, byte counts, and local project ref; missing/extra/pre-existing/stale files fail. The outer gate never sources an emitted secret file and never starts Next with ambient `.env` values. Prove two different contracts:
  - Real public platform aliases (`usebaci.com/ogabassey` and `ogabassey.usebaci.com/`) must remain canonical redirects. Capture browser and Googlebot without `-L`; require `301`, exact `Location: https://ogabassey.com/`, and no tenant/product/schema bytes in the redirect body.
  - The canonical host and internal noncanonical local fixtures exercise generated HTML. `Host: ogabassey.com` maps to `ogabassey.com`; `Host: localhost` + `/ogabassey` and `Host: ogabassey.localhost` + `/` map to the generated `ogabassey` identifier while avoiding the production canonical redirect. Capture each for browser and Googlebot.

- [ ] Run the assertion tool over six HTML captures (canonical plus the two local fixture identities, browser and Googlebot) and four public redirect captures. Compatible Oga HTML requires coherent tenant/publication/generation/renderer/Hero facts, canonical absolute shared/Hero/anchor links, zero request-derived `basePath` bytes, and no duplicate critical payload; generic/legacy route integration separately proves request-correct path/domain `basePath`. The tool parses the first postponed/resume marker rather than searching only the fully assembled body. Redirect mode requires exact status/location, browser/Googlebot parity, and zero tenant bytes. A redirect body is never accepted as HTML proof.

- [ ] Add a layout/page race integration test that changes the producer after the parent read and proves the critical child still emits the original coherent snapshot. Add timeout, malformed, suppressed, degraded, and identity-reassignment fixtures. A second public-snapshot RPC, mixed generation pair, or cached null fails H2.
- [ ] Run local functional browser QA only after no PSI/DebugBear/browser lane is active. Verify LCP element identity, first-response discovery, priority/candidate choice, duplicate downloads, critical CSS, vertical scrolling, keyboard/swipe, reduced motion, cart continuity across critical/static-continuation content, theme continuity, normal home-to-nested navigation, and console/hydration errors. This QA is ineligible for rollout metrics, the campaign slot ledger, and any pass/retain/rollback computation; it is not a second controlled cohort.
- [ ] Failure to produce the hoisted non-parallel shell blocks H2. There is no conditional fallback to a Hero-only leaf implementation.

**H2 full gate**

```bash
set -euo pipefail
H2_CAPTURE_DIR=/tmp/ogabassey-h2-captures
H2_CAPTURE_MANIFEST=/tmp/ogabassey-h2-captures.json
pnpm --filter @baci/web db:replay:chronological
cleanup_h2_fixture() {
  gate_status=$?
  cleanup_status=0
  set +e
  BACI_ALLOW_LOCAL_H2_BUILD_FIXTURE=1 \
    pnpm --dir apps/web exec tsx \
    tools/perf/run-ogabassey-h2-build-fixture.ts --mode cleanup
  cleanup_status=$?
  trap - EXIT
  if [ "$gate_status" -ne 0 ]; then
    exit "$gate_status"
  fi
  exit "$cleanup_status"
}
trap cleanup_h2_fixture EXIT
BACI_ALLOW_LOCAL_H2_BUILD_FIXTURE=1 \
  pnpm --dir apps/web exec tsx \
  tools/perf/run-ogabassey-h2-build-fixture.ts \
  --mode h1-mismatch \
  --report /tmp/ogabassey-h2-mismatch-build.json
BACI_ALLOW_LOCAL_H2_BUILD_FIXTURE=1 \
  pnpm --dir apps/web exec tsx \
  tools/perf/run-ogabassey-h2-build-fixture.ts \
  --mode compatible-h2 \
  --report /tmp/ogabassey-h2-compatible-build.json \
  --capture-dir "$H2_CAPTURE_DIR" \
  --capture-manifest "$H2_CAPTURE_MANIFEST"
pnpm --filter @baci/web exec vitest run \
  'src/app/(storefront)/ogabassey/ogabassey-critical-render-state.test.ts' \
  'src/app/(storefront)/ogabassey/ogabassey-route-resolution.test.ts' \
  'src/app/(storefront)/ogabassey/ogabassey-route-metadata.test.ts' \
  'src/app/(storefront)/ogabassey/ogabassey-critical-shell-style.test.ts' \
  'src/app/(storefront)/[slug]/ogabassey-static-shell-layout.test.tsx' \
  'src/app/(storefront)/[slug]/ogabassey-request-shell-snapshot.test.ts' \
  'src/app/(storefront)/[slug]/ogabassey-request-route-provider.test.tsx' \
  'src/app/(storefront)/[slug]/storefront-layout-renderer.test.tsx' \
  'src/app/(storefront)/[slug]/storefront-shell-frame.test.tsx' \
  'src/app/(storefront)/[slug]/storefront-theme-frame.test.tsx' \
  'src/app/(storefront)/[slug]/storefront-ppr-static-shell.test.tsx' \
  'src/app/(storefront)/[slug]/storefront-layout-content.test.tsx' \
  'src/app/(storefront)/ogabassey/ogabassey-home-critical-content.test.tsx' \
  'src/app/(storefront)/ogabassey/ogabassey-home-static-continuation.test.tsx' \
  'src/app/(storefront)/ogabassey/ogabassey-home-unavailable-request-dispatcher.test.tsx' \
  'src/components/storefront/ogabassey/ogabassey-shared-shell-marker.test.tsx' \
  'src/components/storefront/ogabassey/storefront-shell-layout.test.tsx' \
  'src/components/storefront/ogabassey/storefront-layout.test.tsx' \
  'src/app/(storefront)/[slug]/layout.test.tsx' \
  'src/app/(storefront)/[slug]/(home)/page.test.tsx' \
  'src/app/(storefront)/storefront-critical-css-source-discovery.test.ts' \
  'src/app/(storefront)/storefront-deferred-css-partition.test.ts' \
  tools/test/storefront-critical-active-phase.test.ts \
  tools/test/storefront-critical-phase-gate-manifest.test.ts \
  tools/test/run-storefront-critical-phase-gate.test.ts \
  tools/perf/assert-ogabassey-home-initial-shell.test.ts \
  tools/perf/run-ogabassey-h2-build-fixture.test.ts
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
# The compatible fixture run above performed the canonical local Next build and
# deliberately left its verified .next tree. Do not run an unseeded third build.
pnpm --dir apps/web exec tsx tools/perf/assert-ogabassey-home-initial-shell.ts \
  --next-dir .next \
  --capture-manifest "$H2_CAPTURE_MANIFEST" \
  --response "$H2_CAPTURE_DIR/ogabassey-canonical-browser.html:ogabassey.com" \
  --response "$H2_CAPTURE_DIR/ogabassey-canonical-googlebot.html:ogabassey.com" \
  --response "$H2_CAPTURE_DIR/ogabassey-local-path-browser.html:ogabassey" \
  --response "$H2_CAPTURE_DIR/ogabassey-local-path-googlebot.html:ogabassey" \
  --response "$H2_CAPTURE_DIR/ogabassey-local-subdomain-browser.html:ogabassey" \
  --response "$H2_CAPTURE_DIR/ogabassey-local-subdomain-googlebot.html:ogabassey" \
  --redirect "$H2_CAPTURE_DIR/ogabassey-public-path-browser.headers:$H2_CAPTURE_DIR/ogabassey-public-path-browser.body:https://ogabassey.com/" \
  --redirect "$H2_CAPTURE_DIR/ogabassey-public-path-googlebot.headers:$H2_CAPTURE_DIR/ogabassey-public-path-googlebot.body:https://ogabassey.com/" \
  --redirect "$H2_CAPTURE_DIR/ogabassey-public-subdomain-browser.headers:$H2_CAPTURE_DIR/ogabassey-public-subdomain-browser.body:https://ogabassey.com/" \
  --redirect "$H2_CAPTURE_DIR/ogabassey-public-subdomain-googlebot.headers:$H2_CAPTURE_DIR/ogabassey-public-subdomain-googlebot.body:https://ogabassey.com/"
if coderabbit review --help | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git diff --check
```

Fix valid critical/high/major CodeRabbit findings, rerun proportional tests, then rerun the full gate whenever runtime behavior changed.

---

## Normative Contract Rollout: Exact-SHA Campaign And Decision

A phase+SHA owns exactly one dispatch, permanent campaign claim tag, workflow run id, immutable inputs, and persistent-runner attestation. That run may execute at most three GitHub run attempts under the namespaced controlled/PSI slot plus create-only raw-object/progress-ledger contract above. Rerun is legal only for predeclared infrastructure or controlled-cardinality incompleteness with no semantic/profile/runner/canary drift; an orphaned controlled start remains non-resumable, while PSI-only incompleteness never requires or authorizes rerun once controlled evidence is complete. There are no executable rollout commands in this cross-phase contract. The dedicated `H0-MEASURE`, `H0R-H1-MEASURE`, and `H2-ROLLOUT` plans must provide tested exact commands, attempt-qualified object/index handling, and no-duplicate guards against the then-current workflow.

- [ ] Record `H0_FIELD_ACTIVATED_AT` only after exact H0 deployment/browser+Googlebot canaries. Immediately before the complete H1-code deployment becomes externally visible, freeze `H0_FIELD_ENDED_AT`. H0R is a short lab control state, not a field-baseline promise. Record `H1_FIELD_ACTIVATED_AT` only after enabling the control plane on the exact H0R SHA with no intervening deployment and after its enabled shell-0 canaries. These UTC bounds, not deployment creation time, own field eligibility.
- [ ] After all H1 code is deployed with controls final-disabled+null, prove marker/SHA, freeze comparison/profile contracts, and complete one H0R immutable campaign/run id containing both namespaced controlled and PSI stages. Require all 21 controlled slots, route/profile single-object cache proof, request-owned Hero identity, and stability limits; PSI-only incompleteness is diagnostic. Record `H0R_LAB_CONTROL_SHA`, deploy provenance, campaign id/run id/attempt-qualified ledger hashes, `H0R_COMPARISON_CONTRACT_SHA256`, `H0R_CONTROLLED_PROFILE_SHA256`, persistent-runner attestation, controlled summaries, PSI coverage, and immutable raw-object ids/hashes. Controlled insufficiency blocks H1 activation; semantic/profile/runner drift is not resumable.
- [ ] `H0R-H1-MEASURE` alone owns bootstrap activation after the green H0R controlled gate. Enable H1 on that **same exact SHA and marker**, prove shell-0 canaries, and complete one H1 immutable campaign/run id containing both namespaced stages with `PAGESPEED_EXPECTED_COMPARISON_CONTRACT_SHA256=H0R_COMPARISON_CONTRACT_SHA256` and `PAGESPEED_EXPECTED_CONTROLLED_PROFILE_SHA256=H0R_CONTROLLED_PROFILE_SHA256`. Apply the H0R-relative controlled gate: home/nested CLS stability upper `<=0.10` and delta `<=0.01`; home TBT stability upper `<=100 ms` plus its non-regression rule; controlled home/category/PDP mobile/desktop LCP/FCP dispersion-adjusted regression `<=10%`; exact route/profile cache class; and every publication/tenant/SEO canary. PSI coverage is recorded separately. Only a controlled pass becomes `H1_LAB_BASELINE_SHA`; record campaign/run/attempt-ledger provenance, exact profile hash/runner attestation, and immutable raw-object ids/hashes. A safety/SEO failure, controlled orphan/integrity failure, or failed H0R-relative non-regression gate after H1 activation immediately enters the rehearsed H1 drain/deactivation/final-cache runbook; no H2 work may begin, and completion records `ROLLED_BACK_REROUTED` only after final-disabled+null is publicly proven.
- [ ] Before H2 deployment, record that same exact H1 SHA and lab cohort as `PRE_H2_BASELINE_SHA`. Freeze the field baseline SHA, comparison-contract hash, and maximum activation interval under the field rule above: either hold H1 until sufficiently sampled, or predeclare sufficiently sampled H0 only when its comparison contract equals H1's; if neither satisfies both requirements, record permanent baseline insufficiency now. Do not choose another baseline after seeing H2 results.
- [ ] Require the H2 PR base at merge time to equal `H1_LAB_BASELINE_SHA`, and require the deployed H2 merge/squash commit's first parent to be that SHA. The compare range from H1 to H2 may contain only the reviewed H2-A/H2-B/H2-C visible-shell range. If main advances or a commit mechanically proven outside the H1 control/configuration contract enters the range, invalidate the pre-H2 base, deploy/measure one newly deployed H1-only commit, and update both baseline variables before merging H2. If any H1-owned control/configuration/runtime behavior changes, the prior same-SHA causal pair is invalid: deploy a new exact commit with controls disabled, run one fresh H0R, enable that same SHA with no intervening deploy, run its one H1, and use only that green pair as the new baseline. Neither path may reuse a consumed phase+SHA key.
- [ ] If controlled H1 median and stability upper already pass `<=3500 ms` and its H0R-relative whole-document gate is green, stop before H2 and set `FINAL_HOME_SHA=H1_LAB_BASELINE_SHA`. Use H0 as field baseline only when its frozen contract and sampling coverage qualify; otherwise record insufficiency. Report H0R → H1 causally and H0 → H1 only as comparable total-program context. The exact measured H1C2 SHA already owns the semantic/link/shared-shell/static/document closure; no post-measurement closure PR may alter it. Category planning may begin, but implementation remains blocked by the field gate.
- [ ] Merge H2 only after H0 attribution, the exact-SHA H0R→H1 control comparison, and the exact-parent H1 baseline are deployed/measured and H2 exact-head checks/reviews are green.
- [ ] Let the normal prebuilt deployment workflow deploy the exact merge SHA. Never trigger a second deploy.
- [ ] Record the successful `Deploy to Vercel` run id, run attempt, exact merge SHA, run URL, and reconstructed 32-character deployment marker; prove the run is a successful `push` deployment for that SHA before any measurement dispatch.
- [ ] Before H2 becomes externally visible, recompute `cacheAdmissionClosureDigest`, `providerRuleDigest`, and `providerPurgeBarrierDigest` from the exact H2 build/route tree. If all three equal the proven H1 values, record mechanical reuse with H2 `provenAtSha` audit. If any differs, block production exposure until the delayed-origin/admission and provider-barrier proofs pass for the new closure; at minimum promotion remains forbidden. A renderer digest match cannot substitute for this cache-admission closure gate.
- [ ] Because H2 expands the renderer manifest, deploy that exact H2 SHA to the existing VPS source release, require fresh exact router/delivery capability heartbeats, then run `manage-storefront-critical-control.ts activate-release` with the reviewed previous/new epoch/digest and row versions. Freeze `H1_FIELD_ENDED_AT` at the instant immediately before the H2 web deployment first becomes externally visible—the start of the excluded degraded interval, **not** the later promotion time. Require the atomic release/renderer CAS and let its durable `0→1` sweep converge each enabled merchant to a compatible shell-1 snapshot plus exactly one non-claimable `promotion_staged` shared-shell row; at this point there must be no promotion domain event, generic delivery, provider attempt, or permanent-output canary. During this interval the web app must serve the explicit degraded/no-Hero state, which is excluded from both H1 and H2 field cohorts. After the sweep and backlog checks pass, run `promote-render --merchant-id <OGABASSEY_MERCHANT_ID>`. Its one CAS atomically changes render mode and releases the staged row as one durable shared-shell event; the existing worker then deletes Vercel tags, performs the persisted Cloudflare identity duties, prewarms, and canaries permanent browser+Googlebot home/category/PDP/blog. Only that event's successful completion may complete the promotion receipt and record `H2_FIELD_ACTIVATED_AT`; measurement remains blocked before it. Do not redeploy Vercel. If activation/sweep fails before promotion CAS, repair/resume the same sweep or abandon H2 while rendering remains safely degraded. If the promotion CAS committed, retain H2 workers and resume its exact durable event through completion or suppression; never manufacture a second stage/event. If the release must be abandoned, execute the higher-epoch rollback path below.
- [ ] Verify browser and Googlebot coherence on home, category, PDP, and blog.
- [ ] Verify the H2 home safety/content generation markers equal the current database generation pair and its required/committed renderer epoch/digest/shell-version markers plus render mode equal the deployed permanent contract.
- [ ] Prewarm only the canonical home if the deployment/control-plane workflow has not already done so.
- [ ] Dispatch exactly one H2 campaign on the deployed SHA with H0's manifest hash, `PAGESPEED_EXPECTED_COMPARISON_CONTRACT_SHA256=H1_COMPARISON_CONTRACT_SHA256`, and `PAGESPEED_EXPECTED_CONTROLLED_PROFILE_SHA256=H1_CONTROLLED_PROFILE_SHA256`. Use one workflow run id and at most three same-run GitHub attempts on the identical persistent runner to complete all 21 authoritative controlled slots; record campaign id, run id, permanent claim, create-only progress refs, runner attestation, raw-object ids/hashes, and attempt-qualified ledger hashes immediately. PSI slots are external corroboration and may be incomplete. Never create a second H2 campaign.
- [ ] Do not start DebugBear, another PSI run, or browser automation while it runs.
- [ ] In that one H2 campaign, parse the PSI namespace as external corroboration and the single controlled namespace as authority. Require complete controlled cardinality, route/profile `cloudflare_hit_single_object`, slide-zero identity in initial HTML, positive dispersion-adjusted H1-relative `controlledLcp` direction, and frozen profile equality. Use six home-mobile and three other observations for median/MAD/IQR/range/stability margins; materialize nested CLS stability upper and H1-relative delta. Controlled insufficiency triggers the forward-epoch visible rollback default; PSI incompleteness does not.
- [ ] Verify the completed workflow's pre-controlled and immediate post-controlled canaries have the same release marker, exact SHA, phase-appropriate safety/committed-content/Hero facts, H0-pinned URL-manifest checksum, exact H1 comparison-contract checksum, and exact H1 controlled-profile checksum. Any controlled-window drift makes the run insufficient evidence, never a partial pass/fail dataset. PSI-stage drift is reported only as external diagnostic incompleteness.
- [ ] Assert that no second local or workflow-controlled cohort ran for H2. The campaign ledger must contain exactly the frozen 21 controlled slot identities, one frozen valid terminal per slot, exact start→immutable-raw-object→terminal linkage, and zero controlled orphan/duplicate/replacement/outside-browser observations.
- [ ] Compare H2 directly to exact H1 for permanent-Hero visible-shell causality and H1 directly to exact same-SHA H0R for the visible shell-0 whole-document/control architecture effect. Report H0R → H1 and H1 → H2 unconditionally; report H0 → H1/H2 only as total-program context when the relevant comparison-contract hashes are equal. Keep historical runs `29210282711` and `29269951590` and H0 trace evidence directional only.
- [ ] Apply the controlled immediate decision table top-down: pass, retain-but-incomplete, insufficient-evidence rollback, or regression rollback. Passing requires controlled median plus stability upper target, strictly positive (`>0`) dispersion-adjusted `controlledLcp` direction versus exact H1, slide zero in initial HTML, and every home/category/PDP guardrail. Above-target results use the controlled `>=10%` retain or `<10%` rollback rule. PSI direction is recorded separately and cannot alter the verdict. No result above `3500 ms` unlocks category work.
- [ ] If the exact release **passes the absolute `<=3500 ms` lab gate**, freeze `FINAL_HOME_SHA`; freeze `FIELD_BASELINE_SHA` and schedule the category-unlock 48-hour PostHog query only when the predeclared contract-equal sampled baseline exists. Otherwise record field-baseline insufficiency immediately. Category planning may begin, but implementation remains blocked until the field rule passes or the owner explicitly accepts only the documented day-7/absent-baseline evidence gap. If H2 is retained-but-incomplete above `3500 ms`, freeze only `DIAGNOSTIC_HOME_SHA`/`DIAGNOSTIC_BASELINE_SHA`, keep category planning and implementation blocked, and label any 48-hour/day-7 query diagnostic; neither a favorable percentage nor owner acceptance of low field cardinality can waive the absolute lab target. Do not wait for CrUX.
- [ ] If the release meets a rollback condition or leaks publication/tenant data, immediately run `suppress-render --merchant-id <OGABASSEY_MERCHANT_ID>` and wait on its exact shell-1 shared-shell receipt until the permanent Hero is absent and canonical home/category/PDP/blog agree on the degraded marker; this leaves H1 fenced publication, routing v2, workers, and snapshot reconciliation active. Then restore the exact pre-H2 H1 route tree and request-scoped Hero in a **new higher-epoch** shell-0 release: one normal prebuilt Vercel deploy, the same exact SHA installed on both existing VPS services, and combined worker/renderer activation. The `1→0` sweep must create the distinct `shared_shell_cleanup` all-document target with the rebuilt non-null shell-0 shared generation/fingerprint and the exact prior shell-1 marker identity whose absence must be proven. Resume that exact transition through Vercel shared/home tag deletion, persisted Cloudflare identity purge duties, and two-UA canaries proving the H2 shared marker absent on home/category/PDP/blog plus the restored shell-0 shared marker and H1 request-owned home behavior. Do not rely on the deploy workflow's sitemap purge, and do not report rollback complete merely because suppression or the H1 deployment succeeded. Keep `render_mode=degraded` after cleanup; any future H2 attempt requires a new reviewed release, sweep, staged promotion, and explicit promotion receipt. A plain git revert against an already-activated lower digest is not complete and may not be reported as rollback. H1 control-plane behavior remains because it improves cache-transition correctness independently.
- [ ] Remove any temporary measurement tag after the workflow no longer needs checkout and delete the rollout heartbeat.

## Conditional Work After The Exact H1/H2 Decision

Do not pre-author an implementation and call it evidence.

- **H1 already passes controlled median plus stability upper `<=3500 ms`:** record `STRICT_H1_COMPLETE`, skip H2, and report causal H0R → H1 plus comparable H0 context. H1C2 already contains the complete shell-0 semantic/link/shared-shell/static/document closure; no post-measurement code change is permitted before freezing the terminal H1 SHA. Category planning may begin, but implementation remains blocked until field confirmation; PDP remains unchanged absent repeated evidence.
- **H2 passes `<= 3500 ms`:** report causal H0R → H1 and H1 → H2 plus only comparable H0 → H2 context, then write the category cached-first-row critical-viewport plan. Do not implement/release it until field confirmation passes or the owner explicitly accepts the documented day-7 evidence gap. PDP remains unchanged unless repeated evidence justifies it.
- **Home is retained above `3500 ms` under the controlled dispersion-adjusted material-improvement rule:** keep category blocked and write only the residual home owner plan selected by the Gate 0 routing table.
- **Load duration dominates:** write an image-delivery plan.
- **TTFB dominates:** write a route/CDN/cache-hit plan.
- **Render delay remains but Hero is already in initial HTML:** inspect critical CSS/fonts/paint containment before touching carousel JavaScript.
- **Carousel JS or LoAF is proven material:** write a separate accessible state-machine plan, preserving focus/hover pause, explicit restart, timer re-arm, swipe/scroll sync, vertical page scrolling, reduced motion, offscreen focus semantics, and later-image network isolation.

PR #2928 is decided only in that separate carousel review.

## Definition Of Done

Completion is a **disjoint terminal outcome**, not one checklist that forces work after an evidence-based stop. Record exactly one:

- `STOPPED_REROUTED`: H0-RUNNER, Gate 0, H0.75, cache-admission proof, proxy approval, or another hard prerequisite failed **before any H1 control activation or H2 visible-shell activation began**, and the owner did **not** accept the TTL replacement. Preserve the exact evidence, write the measured-owner/replacement plan, and prove no H1/H2 control or visible-shell rollout occurred. None of the strict-H1/H2 bullets below applies.
- `TTL_REPLACEMENT_SELECTED`: ADR 002 records owner acceptance of the bounded stale-HTML SLO and the full TTL-only provider/cache contract; this plan stops after H0/H0.5 and points to the separately reviewed smaller replacement/pilot. No strict-H1/H2 implementation or campaign is required here.
- `STRICT_H1_COMPLETE`: strict-hybrid prerequisites and all common strict bullets pass; the exact measured H1C2 SHA already contains the complete shell-0 semantic/link/shared-shell/static/document closure; H0R→H1 controlled evidence meets the absolute target; H2 is explicitly skipped and no H2 campaign is required.
- `STRICT_H2_COMPLETE`: strict-hybrid prerequisites and all common strict bullets pass; H2 executed from the exact H1 parent, its activation/promotion/campaign completed, and the frozen table selected the absolute controlled `<=3500 ms` pass. A retained-above-target or rolled-back H2 cannot use this outcome.
- `RETAINED_H2_INCOMPLETE`: all common strict correctness/safety/evidence bullets pass and the frozen table selected the safe `>=10%` retain branch, but controlled median or stability upper remains above `3500 ms`. Freeze only the diagnostic SHA/baseline, keep category and field-unlock blocked, and write the measured residual-home owner plan. This terminal handoff preserves a real gain without falsely completing the architecture performance goal.
- `ROLLED_BACK_REROUTED`: H1 activation or H2 activation/promotion/campaign began, but a safety, SEO, evidence-integrity, or frozen performance condition required abandonment. Preserve every immutable campaign/provider/control receipt and failed exact-SHA artifact. For H1 failure, complete the exact drain/deactivation/final-cache transition through final-disabled+null on every identity before storefront ingress/delivery lane flags may turn off or the worker source pointer may return to the shared #3077-only release; the two shared #3077 services remain running, and no H2 activation may have occurred. For H2 failure, first suppress the permanent Hero, then complete the new higher-epoch shell-0 restoration and non-narrowable `shared_shell_cleanup` through browser+Googlebot home/category/PDP/blog proof while keeping the valid H1 control plane active. Record which branch completed, the final public/control/renderer tuple, cleanup receipt ids, and a separately reviewed residual-owner plan; category remains locked. This outcome has its own rollback proof and does not pretend the failed candidate satisfied the common success checklist.

The remaining checklist applies to `STRICT_H1_COMPLETE | STRICT_H2_COMPLETE | RETAINED_H2_INCOMPLETE`, with H2-specific clauses required for both H2 outcomes. `RETAINED_H2_INCOMPLETE` satisfies correctness/evidence obligations but deliberately does not satisfy the absolute performance completion or field/category-unlock condition:

- [ ] H0-RUNNER produced the owner-approved canonical runner receipt and stable `H0_RUNNER_ATTESTATION_SHA256`; the controlled workflow uses only `[self-hosted, baci-cwv-measurement]`, proves exactly one eligible online runner, has no hosted fallback, and every executed campaign/attempt matches the required runner generation and attestation. Infrastructure drift/refusal is preserved honestly rather than filled with another machine.
- [ ] Gate 0 proved at least `2500 ms` of estimated recoverable same-byte Hero availability budget and was reported only as a mechanistic counterfactual estimate, never an observed LCP effect.
- [ ] ADR 002 documents the non-atomic provider boundary, the rejected/selected TTL-only alternative, the end-to-end stale SLO decision, real Cloudflare capacity, and the #3060/#3077 one-pipeline reconciliation.
- [ ] Safety mutations ensure one pending work/event identity, coalesce before claim without orphan messages, and create at most one post-claim successor. They retain every distinct OLD+NEW purge identity with exactly one latest non-contradictory outcome. Candidate-affecting content writes create one coalesced dirty target; `unchanged` advances no public generation/calls no provider, while `advanced` commits one immutable snapshot and obeys its server-derived action: claimable exact-home/shared/cleanup creates one rate-bounded transition, stable-degraded unchanged-renderer shell-1 home and/or shared `snapshot_only` creates no additional content work in either ordinary or safety mode, and `promotion_staged` parks one no-event stage until promotion CAS. Any absorbed cleanup remains four-document marker-absence work and cannot be covered by ordinary shell-0 safety. H1 shell-0 stock/order-quantity changes enter the durable compatibility fingerprint and exact-home lane with no detached legacy product-root call; H2 shell-1 stock/order-quantity changes create neither dirty nor provider work only after the home Product/Offer/availability graph is removed. Below-fold-only changes create neither throughout.
- [ ] The two public views are minimal, immutable, generation-checked, coherent across the safety/committed-content generation pair, safety-compatible, exact-key projected, anon-safe, and tenant-bound. The early view includes only the bounded metadata/WebPage/H1/Hero/resource-hint and immutable shared-shell projections plus `homeLcpFingerprint`, the already-committed integrity digests, and no deferred graph/link rows. The deferred view contains the bounded shell-specific graph and at-most-24 canonical anchors. Before either may render, the document adapter requires the same requested identifier, merchant, safety generation and proof revision, content/shared generations, renderer tuple, shell contract, snapshot id, `homeLcpFingerprint`, `homeSemanticFingerprint`, `homeCrawlableLinksFingerprint`, `homeCriticalFingerprint`, `sharedShellFingerprint`, `staticDocumentClosureDigest`, and `homeDocumentFingerprint`; it recomputes each view-owned digest and both composites. The executable renderer source/workspace/dependency manifest matches its epoch/digest/critical-shell contract version; combined worker/renderer activation is atomic and sweeps are resumable. A `0→1` sweep may only park a non-claimable promotion stage while degraded; only the later atomic promotion CAS may expose shell `1` and create its single provider event, and its receipt completes only after permanent all-document canaries. A `1→0` release is incomplete until its separate all-document cleanup proves old shared-marker absence. Stale renderer **or delivery release** workers cannot commit/complete/retry/transfer. Private raw inputs/compare-and-commit remain service-role-only.
- [ ] The database—not route preflight—atomically enforces the shared-fixture launch eligibility contract. Authenticated direct merchant publication-column writes are denied. Every user-facing publication mutation has an immutable tenant-authorized receipt and honest discriminated mixed-deploy-safe `200/202/409/503` semantics; legacy completion has `transitionId:null`, fenced states require one, an opposite successor cannot make the earlier mutation report success, and old clients never receive a misleading `202`.
- [ ] Edge Config v2 uses a separate namespace, per-merchant reader-first activation, Edge-first deactivation, scoped legacy-writer migration, and direct DB fallback for activated merchants. Disabled/absent merchants retain v1/local routing, and a representative non-Oga load/TTFB/query-count gate proves no fleet-wide DB fallback regression. The existing #3077 router/delivery services are the sole ingress/provider executors; storefront ingress is independent of analytics mode, generic ingress cannot dead-letter linked cache work, existing delivery excludes cache, and the cache lane is destination-filtered/safety-first. Exact installed SHA/capability/flag heartbeats and DB release CAS gate enablement; later outages leave work durable/pending. Vercel deletion occurs only through the authenticated runtime actuator using a dynamically observed coherent web marker; Cloudflare admission is shared-Redis, account-scoped, cross-instance, and fail-closed. Dead letters can be cursor-listed, CAS-requeued, or resolve-covered through the shared operator surface only with server-proven obligation coverage.
- [ ] The mechanically hashed cache-protocol closure covers every parser/schema/constant/provider/routing/public-fetch byte needed to execute a frozen claim. Same-digest releases can reclaim leases because that closure is identical; any incompatible drift requires a durable suppress/drain/final-disable protocol rotation with zero old work before CAS, normal prebuilt deployment, forward-only recovery, and normal merchant re-enablement. No old claim is reinterpreted under a new grammar.
- [ ] Every persisted safety target—including custom domain, platform subdomain, and platform path—is canaried for browser and Googlebot in both bounded rounds with no skipped Cartesian entry. The single fetch helper uses typed host/path/outcome targets, exact per-target canonical URLs, public-address DNS pinning, exact Host/SNI/TLS, no ambient proxy, no redirect following, and explicit Oga-route, foreign-tenant-route, redirect, and absent verdicts. Oga routes prove the versioned safety/shared marker; reassigned non-Oga routes prove the generic product-free tenant-routing digest/canonical marker without requiring Oga bytes. DNS rebinding/private addresses remain fail-closed, while only reviewed neutral, authoritative negative-DNS, or two-round HTTPS-unreadable evidence can prove absence. Shell `0` and shell `1` home canaries each recompute the actual LCP, shell-specific semantic, crawlable-link, critical, shared-shell, static-closure, and complete-document digests and require the measurement, semantic, and shared markers to name the one exact tuple; shell `0` additionally proves request-owned publication guarding and shell `1` permanent initial-HTML ownership. Forward shell-0 cleanup proves the old H2 shared marker absent on all four canonical documents plus the exact restored shell-0 versioned shared marker and published request-owned or neutral unpublished/draining/disabled-legacy home outcome.
- [ ] Protected proxy approval is recorded for all three exact scopes: the home-response tag on cacheable anonymous home documents across every supported identity, the shared-shell response tag on every cacheable anonymous storefront document, and the valid-secret-only generic-IP-limiter exemption for `GET|POST /api/internal/storefront-cache/purge-vercel-tags`; route-local constant-time authentication and all integration tests pass.
- [ ] Failure, process-death, stale-router/delivery/renderer, worker source-pointer rollback, alias, detach, reassignment, same-host publish→unpublish, `A → B → C` identity chaining, metadata→layout→page interleaving, control disable before/after producer reads, frozen-claim/pending-successor, lifecycle/release CAS/audit, class precedence, content-debounce, fingerprint unchanged/advanced, supersession, actuator marker race, `429`/`Retry-After`, provider-budget, and no-op dependency tests pass.
- [ ] Published/unpublished/degraded/disabled/development behavior is distinct and tested. Control disable emits no compatible permanent Hero, creates one final purge/canary obligation, and is complete only after the disabled outcome is coherent on every identity.
- [ ] H0.75 proved the ordinary-child static prefix on the actual generated route. If H1 already met the performance gate, H2 was explicitly skipped. Otherwise the mandatory parent-layout split reproduces the recorded signature: one stateful provider scope contains immutable shared header geometry, permanent root-home critical content, and the immutable static semantic/link/feed-placeholder continuation in that order; all non-home route groups restore the stateless request merchant context inside that stateful scope. Parent/home metadata and layout/page use one React-cached route-resolution object and exact metadata projection. The local-only loopback fixture first proves an H1 renderer mismatch degrades without Hero, then builds both real identifiers from an exact H2-compatible immutable snapshot and owns the scrubbed-env server/capture lifecycle; production data and ambient `.env` are never inputs. The Hero is proven in the whole prerendered route shell for both bound generated identifiers, disabled/unbound/outage paths resolve the current tenant without OgaBassey leakage, and category/PDP/blog/nested artifacts contain no home-critical bytes. Shell-1 activation parks before exposure and releases exactly one event at promotion. Any post-activation H2 rollback restores visible H1 semantics under a new higher renderer epoch and completes a non-narrowable `shared_shell_cleanup` transition whose browser+Googlebot canaries prove the H2 shared marker absent on home/category/PDP/blog; no backward epoch, plain revert, home-only purge, or deploy-sitemap purge is accepted.
- [ ] Every executable H0/H0.75/H0R/H1/H2 gate is fail-fast (`set -euo pipefail`), preserves the original failure through cleanup, removes secret-bearing local temp files with restrictive permissions, and fails if local fixture/server/capture cleanup is incomplete. Full lint, typecheck, tests, deterministic local Next builds, CodeRabbit, and diff checks pass.
- [ ] Exact-deployment-bound H0, H0R, and same-SHA H1 each complete one immutable measurement campaign identified by one permanent claim and one GitHub workflow run id; both `STRICT_H2_COMPLETE` **and** `RETAINED_H2_INCOMPLETE` additionally require the exact-parent H2 campaign, while `STRICT_H1_COMPLETE` records H2 as intentionally not dispatched. Each executed run owns two namespaced 21-slot sets: authoritative controlled Chrome/Lighthouse evidence first and diagnostic PSI evidence second. Recovery may use `github.run_attempt=1..3` on the **same run id**, immutable inputs, exact expected controlled-profile hash, and identical persistent-runner attestation; it never dispatches a second run or appends a second cohort. Every request envelope is durably uploaded/read back before its start ref and network I/O; every request start resolves to exactly one typed terminal whose object id/hash matches immutable sanitized raw response bytes or, only for `orphaned_after_start`, that immutable request envelope. The active tag ruleset makes every claim/start/terminal ref non-updatable and non-deletable with no bypass. The controlled namespace has zero orphans/duplicates and exactly one frozen valid terminal per slot; PSI orphans/incompleteness record `external_corroboration_incomplete` but never block or change the controlled verdict. The controlled set verifies deploy provenance, stable canaries, manifest/comparison/profile equality, server measurement marker, complete slots, route/profile single-object cache proof, and the full LCP/semantic/link/shared/static/document tuple. H1 first passes the controlled H0R-relative visible whole-document gate. Either the exact H1C2 SHA's controlled H1 median and stability upper reach `<=3500 ms` and H2 is skipped with no intervening closure PR, or controlled H2 proves slide-zero initial HTML, a strictly positive dispersion-adjusted H1-relative direction, and the pass/retain/rollback verdict. H0R → H1 and H1 → H2 are causal when applicable; H0 → final requires matching contracts.
- [ ] Category planning begins only after that hard H1-or-H2 lab gate. Category implementation/release also requires the 48-hour matched field verdict to pass, or an explicit owner acceptance of a still-insufficient day-7 cohort; a field failure pauses category and routes residual home diagnosis. PDP and carousel remain unchanged without evidence.
