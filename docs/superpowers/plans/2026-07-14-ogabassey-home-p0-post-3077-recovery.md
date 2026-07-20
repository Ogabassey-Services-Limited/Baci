# OgaBassey Home P0 Post-#3077 Recovery Implementation Plan

> **Active post-recovery receipt (2026-07-17):** [PR #3131](https://github.com/ogabasseyy/Baci/pull/3131), exact head `71f262a8254bf0087cb8f630e82b421feb7dfc0f`, merged as `bb55d407e01b719a9014c87fb8a8253861b7005d`. [Deployment run `29561460438`](https://github.com/ogabasseyy/Baci/actions/runs/29561460438) completed successfully for that exact merge; database job `87824630957` and production deploy job `87824674429` both completed successfully. The migration semantic digest is `400990a8ee41f6550b609795b02c6e8090d9c056941ab488d5cee0a2fdfc8af1`; log ordinals `1`, `2`, and `3` applied `20260714225501_reconcile_order_fulfillment_timestamps`, `20260714225502_reconcile_domain_event_duplicate_jsonb_operator`, and `20260714225503_reconcile_customer_order_cancellation_reason`, respectively, with summary `3 applied, 424 skipped`.
>
> The deployed repository registry contains `427` top-level migration files, `425` unique versions, and tail `20260714225503_reconcile_customer_order_cancellation_reason.sql`. The refreshed linked ledger contains `442` rows with tail `20260714225503`. Schema-v5 production provenance contains `25` primary evidence sources, `31` exceptional records, and `9` replay relations; record `31` now binds the exact applied `25501` evidence. The canonical forward-repair deployment receipt contains exactly two entries, for `25502` and `25503`; neither repair is a historical production-only mapping or an exceptional record.
>
> Exact refreshed fixture SHA-256 values are: linked ledger `0d8b54ecdae67d99da4e806276310e80992bda73ee94efaaf7a91fd16c3d8885`; production effects `bc1e37a53410d8dbeead2f3929a6e47149589ba68806fca88a359e0b9c7411c1`; production provenance `1f1e4e3112a0010dbed91a25a8185d38fcfd4cf56d2d2b60ca76306bbbb100e1`; forward-repair deployment receipt `8258b2098f1086a60e166935edf5313f2601977979d4eb1cb31c8ca41ef94e8c`; and semantic-lines fixture `1d550b33b8f681cdd2f1751279e6d93c1110457834d8743969aa6047d7e33eca`. The chronological receipt SHA-256 is `bd49803cad805fb80c626347652153941dfd98243a4babe6244cb68f9aa89f21`; the production-effect receipt SHA-256 is `225f0c4018a816eec6d10096104a564d34f737cf42b993a4672cd29238de3fef`.
>
> Both receipts used comparison mode `enforce`, required the byte-unchanged historical cancellation proof, converged with zero changed components, and equal the read-only production effect SHA-256 `71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`. The required old-proof transition is `6155b28720d0f4a8a20746aa1a2365e631249e940fa7339e0e19b66c28fa1e62` to `b21dc2134c1aa3df7aed6c8b7a57173b1fed910a04730f901e56622862503556`. Exact deployed main was merged normally into this recovery branch at local merge `1d5dbc073e13c96ee7bbc118f00bdf0b49ccd26e`. The normative V4 contract and the immutable historical cancellation-proof fixture remain byte-identical.
>
> **Active post-replay attestation amendment (2026-07-19):** Production now has an exact append-only suffix of twelve manifest-bound Credit Direct migrations, versions `20260718070000` through `20260718070011`. Exact merge `fb6c7570ac1a0897efb9890db6b9992410c5eb7a` deployed successfully in run `29676236659`; database job `88164086530` completed successfully with semantic-log SHA-256 `9c91aeab90841c40970f18a4d37a988f85a9204a6fde36daa4a07bdea5438ffa`, exact ordered summary `12 applied, 427 skipped`, and one applied entry for each manifest suffix source. The original `442`-row ledger remains an exact prefix with tail `20260714225503` and SHA-256 `1ddb8497e4d0cc692a4f8fd5c5dec7f5da16d49b4c45c0511d4f19e7646b8ffc`; the full live ledger has `454` rows, tail `20260718070011`, and SHA-256 `ce47c285538cd31047888b4b68c3e4291ace8774e3c29a1bed9735508e5c8832`. The twelve sources remain excluded from both immutable historical replay modes. Current read-only production still passes all `76` effect components and all `19` event RPC safety assertions, but its effect SHA-256 is now `dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70` because exactly one manifest-owned constraint changed: `public.reconciliation_review.reconciliation_review_issue_type_check`, from digest `e8c7feafd3d4249f19bdabadb9d38075dc303ec4b0c5e0dad579698500fb7906` to `b8162359116ec9a8565e08b8050a9646f711d081878f21c56a05f9963ff0c229`. Task 8.5 adds a separate no-write current-production attestation; it never refreshes or weakens the frozen replay fixtures.

> **Historical block scope:** The pre-recovery implementation receipt, frozen-input list, and execution gate below are retained verbatim as audit evidence. They were superseded as active execution controls by the post-recovery receipt and active gate above and below; their historical hashes, failed-deployment facts, and counts must not be rewritten as current values.

> **Implementation receipt (2026-07-16, refreshed after #3130):** The immutable migration/replay base remains `9e3d1b14b1931a5e441fc23f0e5417c188056e47`. Integration mains from #3123, #3124, #3125, #3128, and #3130 are merged normally at `e9234b8dfb`, `47b1a538be`, `2e396ebb54`, `afa9861f3c`, and `9e36bd690e`; current `origin/main` is `2a0dfadb45f03070dd1c294e81902851268fbbb4`, and the branch is ten commits ahead and zero behind. #3130 changes only mobile-admin, workspace, patch, and lockfile paths, outside the frozen P0 database scope. Deployment run `29530977388` completed with database job `87730933200` and changes job `87730933194` successful, but production deploy job `87731008611` failed during `Build for Vercel`; it is not a coherent application release. CI run `29530977474` completed successfully, including lint, typecheck, all test shards, Build, and the aggregate Quality Gate. Tasks 1 through 3 remain committed. Rereview proved that the schema-wide effect hash makes the old Task 4 unsafe and that two real production function repairs require an intermediate exact-head recovery release. Execute [2026-07-16-ogabassey-p0-effect-boundary-recovery.md](2026-07-16-ogabassey-p0-effect-boundary-recovery.md) before any further database mutation. The immutable replay fixtures, migration-base receipts, and normative V4 contract remain bound to their original SHAs.

> **Parallel H0 preparation receipt:** See [2026-07-16-ogabassey-h0-parallel-readiness-receipt.md](2026-07-16-ogabassey-h0-parallel-readiness-receipt.md). It records completed read-only discovery for lane `H0-PREP-READINESS-2026-07-16`. Do not repeat that inventory unless its invalidation conditions apply, and do not mistake it for H0-RUNNER, H0, or H0-MEASURE implementation.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Normative contract:** `docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md`
>
> **Frozen inputs:** `CONTRACT_SHA256=3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca`, `BASE_SHA=9e3d1b14b1931a5e441fc23f0e5417c188056e47`, `PRIOR_MAIN_SHA=cfa062a09bcb737c09e4171730615364afff6e68`, `CURRENT_MAIN_SHA=2a0dfadb45f03070dd1c294e81902851268fbbb4`, `PHASE=P0`, `PRODUCTION_EFFECT_PROVENANCE_SHA256=2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`, `PRODUCTION_EXCEPTIONAL_RECORD_COUNT=31`, `MIGRATION_BASE_DB_JOB_TERMINAL=success`, `MIGRATION_BASE_DEPLOYMENT_TERMINAL=skipped_path_filtered`, `CURRENT_MAIN_DB_JOB_TERMINAL=success`, `CURRENT_MAIN_DEPLOYMENT_TERMINAL=failure`, `LAST_PROVEN_APP_RELEASE_SHA=cfa062a09bcb737c09e4171730615364afff6e68`, `MIGRATION_TREE_SHA256=757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983`, `P0_FROZEN_SCOPE_SHA256=93167527d7f3ebcea35deae2ac16a522902c6b4e6d0433f742a7f0fe0056dc05`.
>
> **Execution gate:** Before each remaining task and before push, fail unless the contract and checked provenance bytes remain exact; `origin/main` still equals `CURRENT_MAIN_SHA`; that SHA is an ancestor of `HEAD` after the fifth completed normal integration merge; run `29530977388` still records successful database/changes jobs and the production deploy failure honestly; and CI run `29530977474` is refreshed to its real terminal state before any push rather than prematurely called green. The old Task 4 and fixed final graph are superseded. Continue only through the exact-effect-boundary recovery plan until an intermediate repair release deploys and the regenerated v3 effect fixture proves three-way equality.

> **Active execution gate:** Before each remaining source task and before any commit or push, require the normative V4 contract and immutable old-cancellation-proof fixture to remain byte-identical; require recovery merge `bb55d407e01b719a9014c87fb8a8253861b7005d` to be an ancestor of `HEAD`; require the branch to be zero commits behind the current `origin/main` after normal integration; require the refreshed fixture and receipt bytes to match every SHA-256 in the active receipt; require the frozen registry and linked receipt to remain `427`/`425` and `442`/tail `20260714225503`; require exactly `31` exceptional records and exactly two separate forward-repair receipt entries; and require both proof-required `enforce` receipts to remain equal to the frozen post-recovery production effect `71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`. After Task 8.5, additionally require the current read-only attestation to prove the exact unchanged `442`-row prefix, exact twelve-source post-replay suffix, `454`/tail `20260718070011` live ledger, all `76`/`19` safety assertions, and only the recorded one-constraint delta to live effect `dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70`. Task 4 is complete through the superseding recovery. Resume source implementation at Task 5. Task 9's exact graph, head, and ahead/behind assertions remain derived and must be regenerated from actual history when Task 9 is reached.

**Goal:** Recover the merged #3077 durable-event substrate into a replay-proven, generated-type-safe, modular, CI-covered baseline so H0 attribution can proceed without inheriting migration or worker uncertainty. P0 itself makes no storefront or Core Web Vitals change.

**Architecture:** Build a hash-bound disposable migration replay that compares deterministic frozen chronology with an evidence-backed frozen production-effect replay: the latter starts from the same registry and applies only the approved exceptional splices and partial-order constraints. Both historical replay effect hashes must equal the immutable post-recovery snapshot. A separate fail-closed read-only attestation proves that current production is exactly that frozen ledger/effect plus the manifest-bound post-replay suffix and its one recorded component delta; it never describes the current state as historical replay convergence. The plan explicitly makes no total historical order claim. Add the one frozen append-only fulfillment-column reconciliation, regenerate Supabase types, close every #3077 database boundary, make provider delivery caller-injected and single-load under the exact manifest authority, modularize the bounded #3077/P0 touched tree required by V4, and add a dedicated tools/workers TypeScript project reached by the existing Quality Gate. P0 prepares and proves the worker boundary but leaves every event producer/worker flag inert. H0-RUNNER preparation may begin after the P0 exact-head gate is green and owner/admin authority exists; H0 itself requires both a coherent P0 exact application release and green H0-RUNNER availability/attestation. Much later, H1C1 installs/extends the existing services in an inert state; `H0R-H1-MEASURE` alone owns queue/routing/delivery activation after its green H0R gate.

**Tech Stack:** TypeScript `7.0.2`, Node.js major `24`, pnpm `11.7.0`, tsx `4.22.4`, Vitest, PostgreSQL `18.3` `psql`, Supabase CLI `2.95.4`/local Docker, Supabase generated `Database`, Biome, Turborepo, Node test runner, CodeRabbit.

## Global Constraints

- Work only in `/Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home` on `codex/p0-event-pipeline-boundary`; do not create a worktree or rebase. This branch starts from merged main `dda0837fe9fae7729b1b1e1192b43fb79fc5e69c` after PR #3135 completed the Task 8 prerequisite.
- Preserve both pre-existing CLI notifier files, `supabase/.temp/cli-latest` and `apps/web/supabase/.temp/cli-latest`, and never stage, reset, or rewrite either one. Preserve the normative V4 document; stage it only in the explicit documentation-baseline commit.
- Do not touch `apps/web/src/proxy.ts`, storefront rendering, cache headers, invalidation behavior, Vercel tags, Cloudflare behavior, or H0/H1/H2 files.
- Do not install, enable, restart, or reconfigure any worker. Do not import #3060's queue or HTTP drainer.
- Do not deploy, invoke Vercel build/deploy, run a browser, run PSI, or run DebugBear.
- Existing migration files are immutable. Preserve the V4-bound fulfillment repair at `20260714225501`; the reviewed recovery plan may add only the separately proven `20260714225502` and `20260714225503` append-only function repairs after a fresh collision check.
- Every new runtime utility has one primary export, a colocated test, and no file over 300 lines. Type-only files and thin compatibility facades may re-export a focused surface.
- Use red-green TDD for every behavior change. After each task, run that task's focused tests and `git diff --check`, then commit only the listed files.
- Immediately before every task commit, run `coderabbit review --prompt-only -t uncommitted` when help exposes `--prompt-only`, otherwise run `coderabbit review --agent -t uncommitted`; fix every valid critical/high finding and repeat the focused test before committing.
- Never print access tokens, database passwords, service-role keys, or provider credentials. Production database access in P0 is read-only.
- Tasks 1-5 may proceed without changing privileged request authority. Task 6 is fail-closed until the owner explicitly approves the exact three-edge legacy exception: only the independently tenant-verified `analytics/conversion` and `events` trusted wrappers plus the already-existing byte-frozen `platform/events -> platform-event-forwarding.ts -> createAdminClient()` helper edge. Generic plan approval is not that security approval. If denied, stop and regenerate the plan around caller-scoped enqueue/internal-worker authority; do not improvise a service-role route path.
- Final P0 provider-authority invariant: the conversion and events routes are the only two trusted-wrapper importers. Each independently resolves and verifies tenant identity before constructing a branded service client, passes the resolved id separately, and rejects any raw/resolved mismatch. The four provider compatibility routes plus authenticated analytics dashboard remain on their five exact caller-scoped paths. The byte-frozen platform-events route retains only its separately manifested helper-to-admin platform-settings edge. None may import the trusted wrapper or service factory, and the platform/admin edge may not expand. No third wrapper importer, body-selected tenant authority, client-to-credential edge, or credential value in a response/log/event/client bundle is allowed.
- `sendConfiguredAdPlatforms(config,event,options)` and provider modules are plain-Node/database-free and receive an immutable configuration already loaded exactly once by the authorized caller. The durable delivery worker and the two reviewed trusted wrappers may use the branded client under their manifest projections; compatibility roots retain their existing typed caller-scoped RLS client. No provider sender constructs a client or reads environment credentials.
- P0 makes the two pre-existing conversion/events service-authority paths explicit, tenant-resolved, typed, bounded, and statically frozen while workers remain inert; it adds no route importer or provider authority. H0-RUNNER preparation may proceed after the P0 exact-head gate is green and owner/admin authority exists. H0 measurement remains blocked until the P0 exact application release is coherent and H0-RUNNER has a green availability/attestation proof. H1C1 later installs/extends the existing services while keeping them inert; `H0R-H1-MEASURE` alone owns queue/routing/delivery activation after its green H0R gate.

## Frozen Discovery Receipt

- Migration/P0 frozen base: `9e3d1b14b1931a5e441fc23f0e5417c188056e47`, including merged #3117, #3121, #3120, and the exact alias repair #3122. It remains the immutable replay, provenance, alias-receipt, and migration-hash base.
- Prior integration main #3123: `4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0`, a signed single-parent child of the frozen base. Its diff is limited to `.github/workflows/ios-storefront-release.yml`, `apps/mobile-storefront/**`, and `docs/superpowers/plans/2026-07-15-ios-att-review-reliability.md`, all outside the frozen P0 scope. It is already merged normally into this branch at `e9234b8dfb`.
- Prior integration main #3124: `dae4e734f747717654125a16c1527b7f6366ce87`, a signed single-parent child of #3123. Its diff contains exactly ten `apps/mobile-storefront/**` ATT startup/runtime/test paths and no web, workflow, shared-package, or migration path. It is merged normally into this branch at `47b1a538be`.
- Prior integration main #3125: `cfa062a09bcb737c09e4171730615364afff6e68`, a signed single-parent child of #3124. Its 42-path diff is limited to mobile-storefront checkout, two web GIGL service-centre quote files, and shared location-filter files. It changes no migration or frozen P0 path and is merged normally into this branch at `2e396ebb54`.
- Prior integration main #3128: `45c11e4669f621ee05fb35f0f598df05c444b223`, a signed single-parent child of #3125. Its diff is limited to mobile-storefront and release-workflow paths, changes no migration or frozen P0 path, and is merged normally into this branch at `afa9861f3c`.
- Current integration main #3130: `2a0dfadb45f03070dd1c294e81902851268fbbb4`, a signed single-parent child of #3128. Its diff is limited to mobile-admin Android build/recommendation fixes, workspace metadata, the React Native patch, and lockfile changes; it changes no migration or frozen P0 database path and is merged normally into this branch at `9e36bd690e`.
- #3077 merge: `0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8`; deployment `29318477334`; DB job `87037846150`; full run succeeded.
- #3114 grant restoration: `8a0cabe7791e1701371c32a4ac911c32fb40322a`; deployment `29284101263`; DB job `86932264596`; `20260713160000_restore_merchants_anon_public_columns.sql` applied.
- #3098 merge: `19d03df8544270eaac9ee072f30f2294cd2024b6`; deployment `29365841123`; DB job `87197071269`; four migrations applied; deploy job `87197219600` succeeded.
- #3099 merge: `1ba7562b640b418e47fd38a4a2449cfec82ea960`; deployment `29367954362`; DB job `87207417765`; `20260713123000` and `20260713123100` applied; deploy job `87207485170` succeeded.
- #3107 merge: `6758e4db3f28d3f2f7acc98e2802234f38631284`; deployment `29370675467` completed success; DB job `87215018094` applied only `20260714161000_claim_wallet_credit_push.sql`; deploy job `87215100556` completed success.
- Prior-base #3060 run: `29371937075` completed success; changes job `87224558121` and DB job `87224558186` succeeded; docs-only deploy job `87224593257` was skipped.
- Merged #3117 base: `ca04b9f27ddaa67ff91a84bc72bb46508cca3fca`; deployment run `29378150948`; DB job `87237670735` completed success and applied `20260714102200_quiz_identity_and_device_caps.sql`. Its semantic-v1 evidence log SHA-256 is `47c6d248b4b3bf353e9797959b5b5baca17dd023e90c4958799119ba75240584`; owner SHA-256 is `60e010cb814242dd13e31791e5bf26cc8f93461636ac75587456f9b266282979`.
- Last proven application release #3121: `769c1645348d20f719e424423c9d3bedbc5985d0`; deployment run `29380448299` completed success; DB job `87244973582` completed success with `1 applied, 422 skipped` and semantic-v1 digest `78984f89c5de2fa5b2ce1d29c90b5c929d00c820791f2fc50fff6ce8bfbbec94`; deploy job `87245007215` completed success at `2026-07-15T02:11:07Z`. Its sole new entry is `20260714225500_release_wallet_credit_push.sql`, owner SHA-256 `98b81fbe048dd4e65c40f4b217e2b892c5538fe3a3d6c15714b2d6215265db52`.
- Exact migration base #3122: `9e3d1b14b1931a5e441fc23f0e5417c188056e47`; run `29417244012` completed success; DB job `87358367070` applied `20260714220000_quiz_event_lifecycle_followup.sql`, reported `1 applied, 423 skipped`, and has semantic-v1 digest `8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e`. Deploy job `87358421368` was `skipped_path_filtered`; do not present it as current application deployment.
- Exact prior integration main #3123: run `29472376797` completed success; DB job `87537955743` reported `0 applied, 424 skipped` with semantic-v1 digest `57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c`; deploy job `87537988080` was `skipped_path_filtered`.
- Exact prior integration main #3124: run `29507413915` completed success; changes job `87651680075` proved `web=false` and `migrations=false`; DB job `87651680060` reported `0 applied, 424 skipped` with the same semantic-v1 digest `57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c`; deploy job `87651744254` was `skipped_path_filtered`. This is another no-op migration-tree validation, not a new production-effect provenance source or a proven web application release.
- Exact prior integration main #3125: run `29518515260` completed success; changes job `87689487532` succeeded; DB job `87689487486` reported `0 applied, 424 skipped` with the same semantic-v1 digest `57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c`; deploy job `87689557044` succeeded, including exact-release HTML purge/coherence and blog smoke. CI run `29518516918` is green. This is the last proven application release, but it does not alter or recapture the frozen production-effect provenance.
- Exact current integration main #3128: run `29523601720` completed success; database job `87706353357` and changes job `87706353472` succeeded; deploy job `87706408059` was `skipped_path_filtered`. CI run `29523601730`, including Quality Gate job `87708137429`, completed success. This is another no-op frozen-P0 validation, not a newer coherent web release.
- Exact current integration main #3130: run `29530977388` completed failure; database job `87730933200` and changes job `87730933194` succeeded, while production deploy job `87731008611` failed during `Build for Vercel`. CI run `29530977474` completed success, including lint, typecheck, all test shards, Build, and the aggregate Quality Gate. This changes no frozen P0 database object and is not a coherent application release.
- Historical migration-name alias receipt: canonical SHA-256 `ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`. It permits only `20260604132853` name reconciliation from `fix_storefront_order_customer_returning_id_ambiguity` to `fix_create_storefront_order_customer_returning_id_ambiguity`, records the failed run `29384198864` and successful run `29417244012`, proves no ledger write for the alias, and is not an effect exceptional record.
- Frozen local migration inventory before P0: `424` files, `422` unique versions, tail `20260714225500_release_wallet_credit_push.sql`; migration-tree SHA-256 `757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983`.
- Frozen linked inventory after the exact-base DB job: `439` rows, tail `20260714225500`; 17 production-only mapped rows. This version-sorted inventory proves membership only and is never presented as application-order evidence. The production-effect receipt has coverage `partial-order-effect-replay`, `24` primary evidence sources, `31` exceptional records, and explicit partial-order constraints.
- After the repair: `425` files, `423` unique versions, tail `20260714225501_reconcile_order_fulfillment_timestamps.sql`; migration-tree SHA-256 `b55c3e04b861d8abd3a320564e78a009fb5a6458b0bfd9c06e919ab55affe055`.
- #3077 path inventory: 154 paths; `git diff --name-status 0e04f7cf^1 0e04f7cf` SHA-256 `8a0f0b5e61d39fe46144e0114a41c7e25a8501e756ce1b819cca5fb793c6d0dc`.
- #3077 regression inventory: 64 artifacts, enumerated by `awk -F '\t' '$2 ~ /(^|\/)([^\/]+\.test\.(ts|tsx|mjs)|domain_event_pipeline\.sql)$/ {print $2}'` over the frozen path inventory.
- Replay bootstrap: 125 top-level migrations through `20260525060558_normalize_ogabassey_encoded_blog_slug.sql`; that tail body's SHA-256 is `1de67f610fb29831ffb2606eb1b227d0d4e1708b21860282ebce5aba762c3293`. The canonical 125-line bootstrap receipt SHA-256 is `06e17f84a563e147b290e90a307d269518d73d6452013fbe87570ee0fa70680e`.
- Bad quiz source SHA-256: `2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41`; the sole replacement removes `pg_catalog.` from `extract(epoch FROM ...)`; materialized corrected body SHA-256 `6f6444120e4cefe5febaba935ea70e7a304bf2d330702afc838d4ab70a77b9d8`.
- First later top-level concurrent migration: `20260531170108_optimize_feed_product_variants_rpc.sql`; SHA-256 `130a795c19fd5c0c7bb56aa9226af8d80909f59ec1b68a0ee2dc4a66a8f7e8e8`.
- Frozen repair body SHA-256: `1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361`.
- Open #2958 was observed at `3666b70b6ec7ead109910cdf5816392eca0d0b9e`; its frozen P0 migration set is empty. It must remain open with zero top-level `supabase/migrations/*.sql` paths, but unrelated head advancement is observational.
- Open #3024 is not P0 code scope. It was observed at exact head `f160108c09ebd2d2367b3ae612a7aa9349febd97`; the paginated 180-file response contains exactly 17 top-level migrations, all collision-free against current main and other open lanes. Their exact path/body pairs are frozen in `p0-open-pr-migration-lanes.tsv`; the canonical 17-row digest is `c7c43af3103d291a40c745bc8742e8094d82dcce60bc7cf90f6a97eb8c342137`.
- Merged #3116 is `69cc74628f3fb8dfd5f92c41fd3e99488ce62429`; it adds the remote-cache handler without a migration and is preserved outside P0 scope. Merged #3119 is prior base `14e1b51d39248ace3c52cec3cf301554f1b86442`; it changes SEO/social identity without a migration and is preserved through the later frozen base.
- #3120 is merged production history. Its exact owner is `supabase/migrations/20260714220000_quiz_event_lifecycle_followup.sql`, SHA-256 `30d2f298b74c7fe406440b1c0feffd849b4d4e40d928de0f497ba63716608a44`; it is exceptional record ordinal `30` with run/job evidence `29417244012` / `87358367070`.
- #3117, #3121, and #3120 are merged into the frozen migration base and are production-history evidence, not open-lane fixtures. P0 imports none of their feature code beyond the normal base merge. The refreshed open migration lanes are #2686 at `67585ec88f22a18c518fd5d349a097e2ed1f60ff` (empty), #2928 at `269be3a0ad3c35b21f2317588367a7ea93f09901` (empty), #2958 at `3666b70b6ec7ead109910cdf5816392eca0d0b9e` (empty), and #3024 at `f160108c09ebd2d2367b3ae612a7aa9349febd97` (the seventeen frozen rows). Regenerate only if one of those lanes merges or its migration path/blob/collision set changes; unrelated head advancement is observational.

## Frozen Production-Effect Provenance

> **Historical pre-repair snapshot:** This section records the immutable
> pre-recovery provenance state at the frozen replay base. Its `439`-row
> ledger, schema-v4 hash, 24-source count, and pending `25501` description are
> audit history, not assertions about the refreshed post-deployment fixture.
> The active schema-v5 bindings and current counts are recorded in the
> post-recovery receipt above; the historical statements below remain
> unchanged.

The final canonical receipt is `apps/web/tools/db/fixtures/production-effect-provenance.json`, exact SHA-256 `2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`, schema version `4`, migration base `9e3d1b14b1931a5e441fc23f0e5417c188056e47`, coverage `partial-order-effect-replay`, linked receipt `439` rows/tail `20260714225500`, `24` primary evidence sources, and `31` exceptional records. It does not claim or encode the unknowable total historical order of all linked migrations. The deterministic production-effect replay starts with the current-tree chronological registry and applies only the receipt's exact exceptional splices and `replayConstraints` partial order before effect comparison.

Schema v4 binds `logSanitizer` exactly as `{"markers":["→ applying:","✓ applied:","✓ already applied:","Migrations summary:"],"version":"github-actions-migration-semantic-lines-v1"}`. For each raw GitHub Actions log, scan physical lines in original order, retain only lines containing one of those markers, emit bytes from the first matched marker through the end of that line, encode UTF-8 with one LF after each retained line, and SHA-256 those semantic bytes. Marker-array order is normative; object keys are recursively sorted only by the canonical JSON serializer. Raw logs, timestamps, runner prefixes, ANSI bytes, and transport-specific fractional timestamp formatting are never persisted or hashed. The same extraction must produce identical bytes from the Actions job-log API and `gh run view --log`; any ambiguity or zero-line result fails closed.

Primary evidence admits `jobConclusion:"success"` or `jobConclusion:"failure_after_applied_entry"`. A failed-after-apply entry is valid only when the exact bound primary semantic log shows its successful migration entry before failure and its optional `corroboration` is the separately bound `kind:"later_success_already_applied"` run/job/head/semantic-log hash; corroboration intentionally has no migration log ordinal. Record `30` is the late-applied #3120 migration. The sole pending record is repair `20260714225501`, with `applied:null`, record ordinal `31`, linked ordinal `247`, frozen path/hash, and `nullReason:"p0_append_only_repair_not_yet_applied"`.

The historical name mismatch at version `20260604132853` is not an effect-history exception because the executable SQL bytes and version were unchanged. `apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json` is a separate canonical deployment-repair receipt, exact SHA-256 `ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`; tests require that it records no ledger write and never appears in `exceptionalRecords`.

The exact canonical alias receipt bytes are:

```json
{"alias":{"disposition":"already-applied-no-ledger-write","recordedName":"fix_storefront_order_customer_returning_id_ambiguity","repositoryName":"fix_create_storefront_order_customer_returning_id_ambiguity","version":"20260604132853"},"baseSha":"9e3d1b14b1931a5e441fc23f0e5417c188056e47","failedPreRepairAttempt":{"conclusion":"failure","databaseJobId":87253957845,"deploymentRunId":29384198864,"diagnosticLineSha256":"92c8639eec2357fe90a503130e91be313ee401db04eec1e0434ea8ecd0dbb30a","headSha":"5d29ed8245a247a33a0a6ec26055c5825b95fa4e"},"provenanceTreatment":"deploy-repair-only-not-production-effect-exceptional-record","receiptKind":"same-version-name-alias-deploy-repair","repairCommitSha":"9e3d1b14b1931a5e441fc23f0e5417c188056e47","schemaVersion":1,"successfulRepairAttempt":{"aliasLineSha256":"3ed1d616cc038502f71438ea230567d22b41f29e269ea6facc4a0f5088fabb12","conclusion":"success","databaseJobId":87358367070,"deploymentRunId":29417244012,"headSha":"9e3d1b14b1931a5e441fc23f0e5417c188056e47","migrationSummary":{"applied":1,"skipped":423},"newlyAppliedMigration":{"name":"quiz_event_lifecycle_followup","ownerSha256":"30d2f298b74c7fe406440b1c0feffd849b4d4e40d928de0f497ba63716608a44","repositoryOwnerPath":"supabase/migrations/20260714220000_quiz_event_lifecycle_followup.sql","version":"20260714220000"},"semanticJobLogSha256":"8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e"}}
```

The synthetic `20260615120000_customer_order_cancellation.sql` companion is not an evidence record. It is an exact `replayConstraints.relations` rule owned by evidence record 1 and is applied immediately after the production-owned push-token body under a synthetic replay receipt. The colliding quiz body is likewise outside evidence records and is governed by its duplicate-companion/unique-reapply relation. Job groups marked `partial-primary-log-constraint` constrain only their included records; they do not authorize ordering claims about omitted log entries.

The following compact object is copied byte-for-value from the approved binding and is the exact Task 2 manifest input; prose is not a substitute.

```json
{"evidenceSources":[{"databaseJobId":81543472691,"deploymentRunId":27581785760,"headSha":"0e6dc6ce4228ade3584fbc9a783513552617da50","jobConclusion":"success","sanitizedJobLogSha256":"af6ec638461ad02ac6972b9db5774a3e80b2ed0662239e899c8f83fdf128f1fc"},{"databaseJobId":83219057619,"deploymentRunId":28105650750,"headSha":"c730dcb22ce020df739d87b5d01db8f204fc92a6","jobConclusion":"success","sanitizedJobLogSha256":"2193b5fd58b56ff957c8f14d7e2da6a884624c3a8a5d48eff37857db2530aeed"},{"corroboration":{"databaseJobId":84230399303,"deploymentRunId":28423874283,"headSha":"f83cff5af2ec76e66f1fd1c2815e85fefbc27db4","kind":"later_success_already_applied","sanitizedJobLogSha256":"c6e1806decafdb5d9007b8b73c4915dbb6f4ed1361c2df82f41c26b82d5fd129"},"databaseJobId":84138758623,"deploymentRunId":28397154002,"headSha":"880b3d6aab332ed0c066f4dc8b83cc4b01cacb2a","jobConclusion":"failure_after_applied_entry","sanitizedJobLogSha256":"4faea169929bbcb38f623952f920f607d1240a7eaea94ebf1eeb3931c3a9ebff"},{"databaseJobId":84679401176,"deploymentRunId":28561321799,"headSha":"21e23cb7746ea8ec25b1cfb160050a3cfca5fc83","jobConclusion":"success","sanitizedJobLogSha256":"f429d6be1a1a64b896d514fee7e12cfa45e3ae8ef805303170e14df1dbbf63c6"},{"databaseJobId":84739317565,"deploymentRunId":28580496962,"headSha":"b8ef31b2a2d9a8e7764da789d08932fe33653a54","jobConclusion":"success","sanitizedJobLogSha256":"e2394f7ff27d74b975dad78253a2985606cbb342f116cbaab407ff8a91ae1e97"},{"databaseJobId":84963130874,"deploymentRunId":28649277516,"headSha":"49b7d3981a929a1f58c8532fdedb837b8d9de8b2","jobConclusion":"success","sanitizedJobLogSha256":"d397bde63b1730350945dc03262f79112583e88f3724b0da1123e5e515aebefb"},{"databaseJobId":85479163687,"deploymentRunId":28823016997,"headSha":"496833440bffac952b2905a8096017d9f83d4aee","jobConclusion":"success","sanitizedJobLogSha256":"3cdf2979dedda2f73ced5739e2e22f70ea9edc39759e8e1fff6424bccb588209"},{"databaseJobId":85495693863,"deploymentRunId":28828076455,"headSha":"aa24ea154735f9640fb57ae1d86dffa7e04cd0bb","jobConclusion":"success","sanitizedJobLogSha256":"57c6149714f7371297748d3d2a508c7cb72e3929b9790c5e0a8aa9a5a4789b7f"},{"databaseJobId":85642773225,"deploymentRunId":28873649727,"headSha":"b9067a970dbf87afbc8ee108356876b9b0b7b4b7","jobConclusion":"success","sanitizedJobLogSha256":"bc3f6801e113674541bca94c1d617ddef0e51c982535eb0b36197191319e92ff"},{"databaseJobId":85913066831,"deploymentRunId":28955450451,"headSha":"547a32b04901267052ec7774eeb1e1ae951ced9f","jobConclusion":"success","sanitizedJobLogSha256":"381f12fa6d0d8e7db94f75894f008fb1a6fd10b04ae53852ff1fba4caa53b006"},{"databaseJobId":85987008267,"deploymentRunId":28977145127,"headSha":"2402fc7e969fda813c30004093d5fc06dfc5d3c4","jobConclusion":"success","sanitizedJobLogSha256":"90cc9a2b097a331d3d3cae4eb2cea4d8b456afd3d18ed0fb8469975515658404"},{"corroboration":{"databaseJobId":86620056513,"deploymentRunId":29181543481,"headSha":"caf391a981478eda3483de89037a91423d3a437d","kind":"later_success_already_applied","sanitizedJobLogSha256":"92646d5c7d19098b6c92cf57b4b6ddf29c931cb99a38fb45cfbc45da143a899f"},"databaseJobId":86579206872,"deploymentRunId":29166042656,"headSha":"92db375aff650cf8ac12fbf8a80e00dcd48e0fff","jobConclusion":"failure_after_applied_entry","sanitizedJobLogSha256":"6bfb317c82d1a46e6990ece0b4b83e8652547bdfe6533ffb01c07835be7814e1"},{"databaseJobId":86818299307,"deploymentRunId":29250720772,"headSha":"ec3027ef95c981335f0e986ae19b3ac808c24bde","jobConclusion":"success","sanitizedJobLogSha256":"daf2ae2dd91150158a3256117f4b6fd308cdffeec96dc6cb283a3daa0df2783d"},{"databaseJobId":86905145251,"deploymentRunId":29276021836,"headSha":"b9101815c5f927679f46c262345a8dd7454d0d1e","jobConclusion":"success","sanitizedJobLogSha256":"e27b306223d0716c2df8e55907beef491ad0f35d43921e428b79ed383e387a74"},{"databaseJobId":86932264596,"deploymentRunId":29284101263,"headSha":"8a0cabe7791e1701371c32a4ac911c32fb40322a","jobConclusion":"success","sanitizedJobLogSha256":"d183c0664d460d9b12a084cc5dfc0bd4a8834a80489c024e870e5b67b1c290d7"},{"databaseJobId":86941439560,"deploymentRunId":29286878808,"headSha":"14de7528c240cac3aa8026268c3dcaebe791cd81","jobConclusion":"success","sanitizedJobLogSha256":"156d9dd403188b48f25a7a12d426e76ac93f0428f4bdb589f7d2e6d5a49c0437"},{"databaseJobId":87023465691,"deploymentRunId":29313663680,"headSha":"adaafb81d98cd4ab12f10ea1ff67434510b5fb3a","jobConclusion":"success","sanitizedJobLogSha256":"1b4450b562c4cbfc0f65ffeba9451095c266a9766fb1050c41c932e3d2293150"},{"databaseJobId":87037846150,"deploymentRunId":29318477334,"headSha":"0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8","jobConclusion":"success","sanitizedJobLogSha256":"622d12c395f23e976a8ffd8d4097a40437329f61592131af202e06a9e130bc22"},{"databaseJobId":87197071269,"deploymentRunId":29365841123,"headSha":"19d03df8544270eaac9ee072f30f2294cd2024b6","jobConclusion":"success","sanitizedJobLogSha256":"a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4"},{"databaseJobId":87207417765,"deploymentRunId":29367954362,"headSha":"1ba7562b640b418e47fd38a4a2449cfec82ea960","jobConclusion":"success","sanitizedJobLogSha256":"8f3169907d804eba0eb16c37d1fd4911ebbcb28b201e6f9615078ea31f2430ac"},{"databaseJobId":87215018094,"deploymentRunId":29370675467,"headSha":"6758e4db3f28d3f2f7acc98e2802234f38631284","jobConclusion":"success","sanitizedJobLogSha256":"17f4715d4ed0265a1bb5ee5aa7a34946919889b5b9a403c01b08f9b0a4f7ae84"},{"databaseJobId":87237670735,"deploymentRunId":29378150948,"headSha":"ca04b9f27ddaa67ff91a84bc72bb46508cca3fca","jobConclusion":"success","sanitizedJobLogSha256":"47c6d248b4b3bf353e9797959b5b5baca17dd023e90c4958799119ba75240584"},{"databaseJobId":87244973582,"deploymentRunId":29380448299,"headSha":"769c1645348d20f719e424423c9d3bedbc5985d0","jobConclusion":"success","sanitizedJobLogSha256":"78984f89c5de2fa5b2ce1d29c90b5c929d00c820791f2fc50fff6ce8bfbbec94"},{"databaseJobId":87358367070,"deploymentRunId":29417244012,"headSha":"9e3d1b14b1931a5e441fc23f0e5417c188056e47","jobConclusion":"success","sanitizedJobLogSha256":"8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e"}],"exceptionalRecords":[{"applied":{"name":"register_push_token_rpc","version":"20260615120000"},"evidence":{"databaseJobId":81543472691,"deploymentRunId":27581785760,"headSha":"0e6dc6ce4228ade3584fbc9a783513552617da50","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"af6ec638461ad02ac6972b9db5774a3e80b2ed0662239e899c8f83fdf128f1fc"},"exceptionalKinds":["duplicate_version_owner"],"mappingRule":"canonical","ownerSha256":"6000b0006539041c1bd914567ebcbc31eb15e8f14401ae488d0a609ce74b4293","recordOrdinal":1,"repositoryOwnerPath":"supabase/migrations/20260615120000_register_push_token_rpc.sql"},{"applied":{"name":"enable_realtime_negotiation_requests","version":"20260623190000"},"evidence":{"databaseJobId":83219057619,"deploymentRunId":28105650750,"headSha":"c730dcb22ce020df739d87b5d01db8f204fc92a6","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"2193b5fd58b56ff957c8f14d7e2da6a884624c3a8a5d48eff37857db2530aeed"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":207,"linkedName":"enable_realtime_negotiation_requests","linkedVersion":"20260623190041","mappingRule":"canonical","ownerSha256":"bc2165173828d7a5c667e5a7415fb37b9ba7762aad2e12268b70eab6dcc94526","recordOrdinal":2,"repositoryOwnerPath":"supabase/migrations/20260623190000_enable_realtime_negotiation_requests.sql"},{"applied":{"name":"merchant_email_domains","version":"20260624200000"},"evidence":{"corroboration":{"databaseJobId":84230399303,"deploymentRunId":28423874283,"headSha":"f83cff5af2ec76e66f1fd1c2815e85fefbc27db4","kind":"later_success_already_applied","sanitizedJobLogSha256":"c6e1806decafdb5d9007b8b73c4915dbb6f4ed1361c2df82f41c26b82d5fd129"},"databaseJobId":84138758623,"deploymentRunId":28397154002,"headSha":"880b3d6aab332ed0c066f4dc8b83cc4b01cacb2a","jobConclusion":"failure_after_applied_entry","logOrdinal":1,"sanitizedJobLogSha256":"4faea169929bbcb38f623952f920f607d1240a7eaea94ebf1eeb3931c3a9ebff"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":212,"linkedName":"merchant_email_domains","linkedVersion":"20260624211416","mappingRule":"canonical","ownerSha256":"120e16cb8768fdec2e36ce041dc5049e299594d271e1f900a4abd0ac3c775ad6","recordOrdinal":3,"repositoryOwnerPath":"supabase/migrations/20260624200000_merchant_email_domains.sql"},{"applied":{"name":"fix_search_products_condition_filter","version":"20260702024830"},"evidence":{"databaseJobId":84679401176,"deploymentRunId":28561321799,"headSha":"21e23cb7746ea8ec25b1cfb160050a3cfca5fc83","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"f429d6be1a1a64b896d514fee7e12cfa45e3ae8ef805303170e14df1dbbf63c6"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":218,"linkedName":"fix_search_products_condition_filter","linkedVersion":"20260626131520","mappingRule":"canonical","ownerSha256":"d94d9d87b238c217a8640c9e5b2ef57263ff2112015fac7e2f40de2a91270ed3","recordOrdinal":4,"repositoryOwnerPath":"supabase/migrations/20260702024830_fix_search_products_condition_filter.sql"},{"applied":{"name":"restore_mobile_admin_product_rpc_contract","version":"20260702063638"},"evidence":{"databaseJobId":84739317565,"deploymentRunId":28580496962,"headSha":"b8ef31b2a2d9a8e7764da789d08932fe33653a54","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"e2394f7ff27d74b975dad78253a2985606cbb342f116cbaab407ff8a91ae1e97"},"exceptionalKinds":["production_only_mapping","supersession"],"linkedLedgerOrdinal":248,"linkedName":"fix_mobile_admin_product_phantom_columns","linkedVersion":"20260630123511","mappingRule":"superseded-final-state","ownerSha256":"a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4","recordOrdinal":5,"repositoryOwnerPath":"supabase/migrations/20260702063638_restore_mobile_admin_product_rpc_contract.sql"},{"applied":{"name":"order_item_unit_costs_supplier_analytics","version":"20260702140100"},"evidence":{"databaseJobId":84963130874,"deploymentRunId":28649277516,"headSha":"49b7d3981a929a1f58c8532fdedb837b8d9de8b2","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"d397bde63b1730350945dc03262f79112583e88f3724b0da1123e5e515aebefb"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":249,"linkedName":"order_item_unit_costs_supplier_analytics","linkedVersion":"20260701080400","mappingRule":"canonical","ownerSha256":"b2c0bd55fdb092549ccbc42ed4011def80cc2f5417451bba14df6476cdf4a8a9","recordOrdinal":6,"repositoryOwnerPath":"supabase/migrations/20260702140100_order_item_unit_costs_supplier_analytics.sql"},{"applied":{"name":"supplier_purchase_analytics_branch_scope","version":"20260702140200"},"evidence":{"databaseJobId":84963130874,"deploymentRunId":28649277516,"headSha":"49b7d3981a929a1f58c8532fdedb837b8d9de8b2","jobConclusion":"success","logOrdinal":2,"sanitizedJobLogSha256":"d397bde63b1730350945dc03262f79112583e88f3724b0da1123e5e515aebefb"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":252,"linkedName":"supplier_purchase_analytics_branch_scope","linkedVersion":"20260701123945","mappingRule":"canonical","ownerSha256":"722b166fda187ee2cf4d8200d1b99a4af88fd41055ab85ba5ece171bdd3a721c","recordOrdinal":7,"repositoryOwnerPath":"supabase/migrations/20260702140200_supplier_purchase_analytics_branch_scope.sql"},{"applied":{"name":"allow_page_config_history_insert","version":"20260706162109"},"evidence":{"databaseJobId":85479163687,"deploymentRunId":28823016997,"headSha":"496833440bffac952b2905a8096017d9f83d4aee","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"3cdf2979dedda2f73ced5739e2e22f70ea9edc39759e8e1fff6424bccb588209"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":282,"linkedName":"allow_page_config_history_insert","linkedVersion":"20260706210329","mappingRule":"canonical","ownerSha256":"3104462281e7e92658b25c36cbb21c95437da84babb6e18f95c45242adfa5594","recordOrdinal":8,"repositoryOwnerPath":"supabase/migrations/20260706162109_allow_page_config_history_insert.sql"},{"applied":{"name":"add_storefront_preflight_rpcs","version":"20260706200000"},"evidence":{"databaseJobId":85495693863,"deploymentRunId":28828076455,"headSha":"aa24ea154735f9640fb57ae1d86dffa7e04cd0bb","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"57c6149714f7371297748d3d2a508c7cb72e3929b9790c5e0a8aa9a5a4789b7f"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":280,"linkedName":"add_storefront_preflight_rpcs","linkedVersion":"20260706202930","mappingRule":"canonical","ownerSha256":"091506e1cfb83822453a2134eb01f9e72fe78dbcb988eafe01412e78fd72d021","recordOrdinal":9,"repositoryOwnerPath":"supabase/migrations/20260706200000_add_storefront_preflight_rpcs.sql"},{"applied":{"name":"add_blog_listing_preflight_rpc","version":"20260706230000"},"evidence":{"databaseJobId":85642773225,"deploymentRunId":28873649727,"headSha":"b9067a970dbf87afbc8ee108356876b9b0b7b4b7","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"bc3f6801e113674541bca94c1d617ddef0e51c982535eb0b36197191319e92ff"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":286,"linkedName":"add_blog_listing_preflight_rpc","linkedVersion":"20260707064146","mappingRule":"canonical","ownerSha256":"e6f1050fa096534a442b1b19aad68039c577bb620bb897e5ece172a1e5c73a04","recordOrdinal":10,"repositoryOwnerPath":"supabase/migrations/20260706230000_add_blog_listing_preflight_rpc.sql"},{"applied":{"name":"optimize_storefront_cached_merchant_and_variant_wrappers","version":"20260707211507"},"evidence":{"databaseJobId":85913066831,"deploymentRunId":28955450451,"headSha":"547a32b04901267052ec7774eeb1e1ae951ced9f","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"381f12fa6d0d8e7db94f75894f008fb1a6fd10b04ae53852ff1fba4caa53b006"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":312,"linkedName":"optimize_storefront_cached_merchant_and_variant_wrappers","linkedVersion":"20260708102643","mappingRule":"canonical","ownerSha256":"2916e23dae09a40aa2e771798e3919ddea346f2ce8638837dd9a9de098b68e61","recordOrdinal":11,"repositoryOwnerPath":"supabase/migrations/20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql"},{"applied":{"name":"create_domain_purchase_transaction_rpc","version":"20260708013000"},"evidence":{"databaseJobId":85987008267,"deploymentRunId":28977145127,"headSha":"2402fc7e969fda813c30004093d5fc06dfc5d3c4","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"90cc9a2b097a331d3d3cae4eb2cea4d8b456afd3d18ed0fb8469975515658404"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":308,"linkedName":"create_domain_purchase_transaction_rpc","linkedVersion":"20260708072653","mappingRule":"canonical","ownerSha256":"40b5b16c32136c3fa8300725a48469d43af8264f60c4b1faa4fdc6a99e3f00e6","recordOrdinal":12,"repositoryOwnerPath":"supabase/migrations/20260708013000_create_domain_purchase_transaction_rpc.sql"},{"applied":{"name":"fix_domain_purchase_rpc_merchant_derivation","version":"20260708013500"},"evidence":{"databaseJobId":85987008267,"deploymentRunId":28977145127,"headSha":"2402fc7e969fda813c30004093d5fc06dfc5d3c4","jobConclusion":"success","logOrdinal":2,"sanitizedJobLogSha256":"90cc9a2b097a331d3d3cae4eb2cea4d8b456afd3d18ed0fb8469975515658404"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":309,"linkedName":"fix_domain_purchase_rpc_merchant_derivation","linkedVersion":"20260708072825","mappingRule":"canonical","ownerSha256":"53eca111142dda0f4f5030deeec5842b9eabc588f894d631a1830eb8f7dad999","recordOrdinal":13,"repositoryOwnerPath":"supabase/migrations/20260708013500_fix_domain_purchase_rpc_merchant_derivation.sql"},{"applied":{"name":"lock_domain_purchase_rpc_service_role","version":"20260708090000"},"evidence":{"databaseJobId":85987008267,"deploymentRunId":28977145127,"headSha":"2402fc7e969fda813c30004093d5fc06dfc5d3c4","jobConclusion":"success","logOrdinal":3,"sanitizedJobLogSha256":"90cc9a2b097a331d3d3cae4eb2cea4d8b456afd3d18ed0fb8469975515658404"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":310,"linkedName":"lock_domain_purchase_rpc_service_role","linkedVersion":"20260708075932","mappingRule":"canonical","ownerSha256":"7d522c998d5b32c230fe804cc21ffa0daa23832d37661a490164cbc840ba6855","recordOrdinal":14,"repositoryOwnerPath":"supabase/migrations/20260708090000_lock_domain_purchase_rpc_service_role.sql"},{"applied":{"name":"drop_authenticated_domain_purchase_rpc","version":"20260708220947"},"evidence":{"corroboration":{"databaseJobId":86620056513,"deploymentRunId":29181543481,"headSha":"caf391a981478eda3483de89037a91423d3a437d","kind":"later_success_already_applied","sanitizedJobLogSha256":"92646d5c7d19098b6c92cf57b4b6ddf29c931cb99a38fb45cfbc45da143a899f"},"databaseJobId":86579206872,"deploymentRunId":29166042656,"headSha":"92db375aff650cf8ac12fbf8a80e00dcd48e0fff","jobConclusion":"failure_after_applied_entry","logOrdinal":1,"sanitizedJobLogSha256":"6bfb317c82d1a46e6990ece0b4b83e8652547bdfe6533ffb01c07835be7814e1"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":315,"linkedName":"drop_authenticated_domain_purchase_rpc","linkedVersion":"20260708220832","mappingRule":"canonical","ownerSha256":"005b89e87c87bcad7f5b206ad61cff05041458edd19f60409c73889ed7921bc9","recordOrdinal":15,"repositoryOwnerPath":"supabase/migrations/20260708220947_drop_authenticated_domain_purchase_rpc.sql"},{"applied":{"name":"preserve_repeat_order_notification_cycles","version":"20260713123000"},"evidence":{"databaseJobId":87207417765,"deploymentRunId":29367954362,"headSha":"1ba7562b640b418e47fd38a4a2449cfec82ea960","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"8f3169907d804eba0eb16c37d1fd4911ebbcb28b201e6f9615078ea31f2430ac"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"39762ddc3e9d0c6fe92c2e6c502bf574c2e480aff448ed54ec0af4ad95606fd0","recordOrdinal":16,"repositoryOwnerPath":"supabase/migrations/20260713123000_preserve_repeat_order_notification_cycles.sql"},{"applied":{"name":"scope_manual_order_notifications_to_cycle","version":"20260713123100"},"evidence":{"databaseJobId":87207417765,"deploymentRunId":29367954362,"headSha":"1ba7562b640b418e47fd38a4a2449cfec82ea960","jobConclusion":"success","logOrdinal":2,"sanitizedJobLogSha256":"8f3169907d804eba0eb16c37d1fd4911ebbcb28b201e6f9615078ea31f2430ac"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"ff62e93746dc740e1a75bc19e4511b752fd3d7e385f26d6a66b62d1eec8d83b9","recordOrdinal":17,"repositoryOwnerPath":"supabase/migrations/20260713123100_scope_manual_order_notifications_to_cycle.sql"},{"applied":{"name":"add_storefront_paystack_subaccount_configured_rpc","version":"20260713130000"},"evidence":{"databaseJobId":86818299307,"deploymentRunId":29250720772,"headSha":"ec3027ef95c981335f0e986ae19b3ac808c24bde","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"daf2ae2dd91150158a3256117f4b6fd308cdffeec96dc6cb283a3daa0df2783d"},"exceptionalKinds":["duplicate_version_owner"],"mappingRule":"canonical","ownerSha256":"9cb95f8ba9ebd75568b9b5c7ee17521981465fa330d18a76ed467a179dd79645","recordOrdinal":18,"repositoryOwnerPath":"supabase/migrations/20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql"},{"applied":{"name":"quiz_finalize_rank_winners_reapply","version":"20260713140000"},"evidence":{"databaseJobId":86905145251,"deploymentRunId":29276021836,"headSha":"b9101815c5f927679f46c262345a8dd7454d0d1e","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"e27b306223d0716c2df8e55907beef491ad0f35d43921e428b79ed383e387a74"},"exceptionalKinds":["unique_reapply"],"mappingRule":"canonical","ownerSha256":"f3461eead2451852ecc9a643f34ca486207ea6b10b8ef3439e69718e738acd8c","recordOrdinal":19,"repositoryOwnerPath":"supabase/migrations/20260713140000_quiz_finalize_rank_winners_reapply.sql"},{"applied":{"name":"restore_merchants_anon_public_columns","version":"20260713160000"},"evidence":{"databaseJobId":86932264596,"deploymentRunId":29284101263,"headSha":"8a0cabe7791e1701371c32a4ac911c32fb40322a","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"d183c0664d460d9b12a084cc5dfc0bd4a8834a80489c024e870e5b67b1c290d7"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"8e0adbe1f2e51b882f719cb2b3fa69cdc6fdff24b9fa25fdd5430ba72a7079dd","recordOrdinal":20,"repositoryOwnerPath":"supabase/migrations/20260713160000_restore_merchants_anon_public_columns.sql"},{"applied":{"name":"split_platform_blog_anon_read_policy","version":"20260713211500"},"evidence":{"databaseJobId":86941439560,"deploymentRunId":29286878808,"headSha":"14de7528c240cac3aa8026268c3dcaebe791cd81","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"156d9dd403188b48f25a7a12d426e76ac93f0428f4bdb589f7d2e6d5a49c0437"},"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":411,"linkedName":"split_platform_blog_anon_read_policy","linkedVersion":"20260713200830","mappingRule":"canonical","ownerSha256":"d51de0171bb6837e4ed9fa161b1785de2d77915446d89cb2a857a0f403fa337f","recordOrdinal":21,"repositoryOwnerPath":"supabase/migrations/20260713211500_split_platform_blog_anon_read_policy.sql"},{"applied":{"name":"scope_feature_settings_read_policies","version":"20260714010000"},"evidence":{"databaseJobId":87023465691,"deploymentRunId":29313663680,"headSha":"adaafb81d98cd4ab12f10ea1ff67434510b5fb3a","jobConclusion":"success","logOrdinal":5,"sanitizedJobLogSha256":"1b4450b562c4cbfc0f65ffeba9451095c266a9766fb1050c41c932e3d2293150"},"exceptionalKinds":["production_only_mapping","supersession"],"linkedLedgerOrdinal":216,"linkedName":"public_read_storefront_feature_settings","linkedVersion":"20260625173604","mappingRule":"superseded-final-state","ownerSha256":"31091717a01f66c683c87e77a2f62245732df023b6dd61055855cf7ff78cff9f","recordOrdinal":22,"repositoryOwnerPath":"supabase/migrations/20260714010000_scope_feature_settings_read_policies.sql"},{"applied":{"name":"add_merchant_settlement_failed_review_type","version":"20260714090000"},"evidence":{"databaseJobId":87197071269,"deploymentRunId":29365841123,"headSha":"19d03df8544270eaac9ee072f30f2294cd2024b6","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"9c80b9ee1f45d2d7eaced5f3e466de68866fe1a614d1559733ee7287e2cf39c2","recordOrdinal":23,"repositoryOwnerPath":"supabase/migrations/20260714090000_add_merchant_settlement_failed_review_type.sql"},{"applied":{"name":"scope_capture_review_deduplication","version":"20260714093000"},"evidence":{"databaseJobId":87197071269,"deploymentRunId":29365841123,"headSha":"19d03df8544270eaac9ee072f30f2294cd2024b6","jobConclusion":"success","logOrdinal":2,"sanitizedJobLogSha256":"a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"ea2ea7f781662d04684f381d2a89270ecba68d7bc1f0f055ce14a9e4f36f8fcb","recordOrdinal":24,"repositoryOwnerPath":"supabase/migrations/20260714093000_scope_capture_review_deduplication.sql"},{"applied":{"name":"add_gateway_payment_wedge_review_type","version":"20260714100000"},"evidence":{"databaseJobId":87197071269,"deploymentRunId":29365841123,"headSha":"19d03df8544270eaac9ee072f30f2294cd2024b6","jobConclusion":"success","logOrdinal":3,"sanitizedJobLogSha256":"a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"150b7fbf9fe237a889f7aff62b2041e4d8289f9a9413e770289a472d1f341c13","recordOrdinal":25,"repositoryOwnerPath":"supabase/migrations/20260714100000_add_gateway_payment_wedge_review_type.sql"},{"applied":{"name":"complete_order_gateway_payment_atomic","version":"20260714123000"},"evidence":{"databaseJobId":87197071269,"deploymentRunId":29365841123,"headSha":"19d03df8544270eaac9ee072f30f2294cd2024b6","jobConclusion":"success","logOrdinal":4,"sanitizedJobLogSha256":"a7c4f7b0b2ff225a9ec3dc9320bf83e0a051e5ba7366c465f3aeaa734064e0c4"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"f7e22ba571d534352cc05dbf5d65c968f107844a1c962dea81a1a001a5150783","recordOrdinal":26,"repositoryOwnerPath":"supabase/migrations/20260714123000_complete_order_gateway_payment_atomic.sql"},{"applied":{"name":"claim_wallet_credit_push","version":"20260714161000"},"evidence":{"databaseJobId":87215018094,"deploymentRunId":29370675467,"headSha":"6758e4db3f28d3f2f7acc98e2802234f38631284","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"17f4715d4ed0265a1bb5ee5aa7a34946919889b5b9a403c01b08f9b0a4f7ae84"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"e2840c2ffb6ad0f7ebd4dccf85d2d46454c2ff71ec09a938cff43ecbc22e4d25","recordOrdinal":27,"repositoryOwnerPath":"supabase/migrations/20260714161000_claim_wallet_credit_push.sql"},{"applied":{"name":"quiz_identity_and_device_caps","version":"20260714102200"},"evidence":{"databaseJobId":87237670735,"deploymentRunId":29378150948,"headSha":"ca04b9f27ddaa67ff91a84bc72bb46508cca3fca","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"47c6d248b4b3bf353e9797959b5b5baca17dd023e90c4958799119ba75240584"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"60e010cb814242dd13e31791e5bf26cc8f93461636ac75587456f9b266282979","recordOrdinal":28,"repositoryOwnerPath":"supabase/migrations/20260714102200_quiz_identity_and_device_caps.sql"},{"applied":{"name":"release_wallet_credit_push","version":"20260714225500"},"evidence":{"databaseJobId":87244973582,"deploymentRunId":29380448299,"headSha":"769c1645348d20f719e424423c9d3bedbc5985d0","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"78984f89c5de2fa5b2ce1d29c90b5c929d00c820791f2fc50fff6ce8bfbbec94"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"98b81fbe048dd4e65c40f4b217e2b892c5538fe3a3d6c15714b2d6215265db52","recordOrdinal":29,"repositoryOwnerPath":"supabase/migrations/20260714225500_release_wallet_credit_push.sql"},{"applied":{"name":"quiz_event_lifecycle_followup","version":"20260714220000"},"evidence":{"databaseJobId":87358367070,"deploymentRunId":29417244012,"headSha":"9e3d1b14b1931a5e441fc23f0e5417c188056e47","jobConclusion":"success","logOrdinal":1,"sanitizedJobLogSha256":"8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e"},"exceptionalKinds":["late_applied"],"mappingRule":"canonical","ownerSha256":"30d2f298b74c7fe406440b1c0feffd849b4d4e40d928de0f497ba63716608a44","recordOrdinal":30,"repositoryOwnerPath":"supabase/migrations/20260714220000_quiz_event_lifecycle_followup.sql"},{"applied":null,"exceptionalKinds":["production_only_mapping"],"linkedLedgerOrdinal":247,"linkedName":"add_order_fulfillment_timestamps","linkedProductionOnlyOrdinal":247,"linkedVersion":"20260629154903","mappingRule":"append-only-repair","nullReason":"p0_append_only_repair_not_yet_applied","ownerSha256":"1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361","recordOrdinal":31,"repositoryOwnerPath":"supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql"}],"replayConstraints":{"coverage":"partial-order-effect-replay","jobGroups":[{"coverage":"complete-primary-log-group","databaseJobId":81543472691,"deploymentRunId":27581785760,"includedRecords":[{"logOrdinal":1,"recordOrdinal":1}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":83219057619,"deploymentRunId":28105650750,"includedRecords":[{"logOrdinal":1,"recordOrdinal":2}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":84138758623,"deploymentRunId":28397154002,"includedRecords":[{"logOrdinal":1,"recordOrdinal":3}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":84679401176,"deploymentRunId":28561321799,"includedRecords":[{"logOrdinal":1,"recordOrdinal":4}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":84739317565,"deploymentRunId":28580496962,"includedRecords":[{"logOrdinal":1,"recordOrdinal":5}],"observedMigrationEntryCount":1},{"coverage":"partial-primary-log-constraint","databaseJobId":84963130874,"deploymentRunId":28649277516,"includedRecords":[{"logOrdinal":1,"recordOrdinal":6},{"logOrdinal":2,"recordOrdinal":7}],"observedMigrationEntryCount":3},{"coverage":"complete-primary-log-group","databaseJobId":85479163687,"deploymentRunId":28823016997,"includedRecords":[{"logOrdinal":1,"recordOrdinal":8}],"observedMigrationEntryCount":1},{"coverage":"partial-primary-log-constraint","databaseJobId":85495693863,"deploymentRunId":28828076455,"includedRecords":[{"logOrdinal":1,"recordOrdinal":9}],"observedMigrationEntryCount":2},{"coverage":"complete-primary-log-group","databaseJobId":85642773225,"deploymentRunId":28873649727,"includedRecords":[{"logOrdinal":1,"recordOrdinal":10}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":85913066831,"deploymentRunId":28955450451,"includedRecords":[{"logOrdinal":1,"recordOrdinal":11}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":85987008267,"deploymentRunId":28977145127,"includedRecords":[{"logOrdinal":1,"recordOrdinal":12},{"logOrdinal":2,"recordOrdinal":13},{"logOrdinal":3,"recordOrdinal":14}],"observedMigrationEntryCount":3},{"coverage":"complete-primary-log-group","databaseJobId":86579206872,"deploymentRunId":29166042656,"includedRecords":[{"logOrdinal":1,"recordOrdinal":15}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":86818299307,"deploymentRunId":29250720772,"includedRecords":[{"logOrdinal":1,"recordOrdinal":18}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":86905145251,"deploymentRunId":29276021836,"includedRecords":[{"logOrdinal":1,"recordOrdinal":19}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":86932264596,"deploymentRunId":29284101263,"includedRecords":[{"logOrdinal":1,"recordOrdinal":20}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":86941439560,"deploymentRunId":29286878808,"includedRecords":[{"logOrdinal":1,"recordOrdinal":21}],"observedMigrationEntryCount":1},{"coverage":"partial-primary-log-constraint","databaseJobId":87023465691,"deploymentRunId":29313663680,"includedRecords":[{"logOrdinal":5,"recordOrdinal":22}],"observedMigrationEntryCount":5},{"coverage":"complete-primary-log-group","databaseJobId":87037846150,"deploymentRunId":29318477334,"observedMigrationEntryCount":26,"pipelineRecords":[{"applied":{"name":"domain_event_pipeline_tables","version":"20260712150001"},"logOrdinal":1,"ownerSha256":"4f31649ba4c9c3d6b5eb4110dbb0d144237502642d61c0606e15a9b1ba39556b","repositoryOwnerPath":"supabase/migrations/20260712150001_domain_event_pipeline_tables.sql"},{"applied":{"name":"eventing_internal_schema","version":"20260712150050"},"logOrdinal":2,"ownerSha256":"3a3018fcd2e0daea0dec918d953e1dadf314ea1f88698e336a72a97da8ddcd1c","repositoryOwnerPath":"supabase/migrations/20260712150050_eventing_internal_schema.sql"},{"applied":{"name":"domain_event_idempotency_guard","version":"20260712150075"},"logOrdinal":3,"ownerSha256":"dcb23009b30f1970359737ccfc1e34f3b63b952a59e6854d1352a98b4fbdc21b","repositoryOwnerPath":"supabase/migrations/20260712150075_domain_event_idempotency_guard.sql"},{"applied":{"name":"domain_event_enqueue_rpcs","version":"20260712150100"},"logOrdinal":4,"ownerSha256":"bce417899451c9bd0b5e18881b3776ecfcfb8128d2953d619c859e675c45cde1","repositoryOwnerPath":"supabase/migrations/20260712150100_domain_event_enqueue_rpcs.sql"},{"applied":{"name":"analytics_domain_event_rpc","version":"20260712150101"},"logOrdinal":5,"ownerSha256":"10162654ecc524c5d0fafd8f6c08f2fa439a2cce791373a7dc5b05e4e94cffe7","repositoryOwnerPath":"supabase/migrations/20260712150101_analytics_domain_event_rpc.sql"},{"applied":{"name":"domain_event_read_rpc","version":"20260712150102"},"logOrdinal":6,"ownerSha256":"a466608103ca395ac28582e30fcece53fb671b356e5422f9d58c6f5142a975e2","repositoryOwnerPath":"supabase/migrations/20260712150102_domain_event_read_rpc.sql"},{"applied":{"name":"platform_domain_event_rpc","version":"20260712150105"},"logOrdinal":7,"ownerSha256":"09b1bbb4ae19c13465a94250764e12539e3b6aabfb18f7a4d2190afa79d6695a","repositoryOwnerPath":"supabase/migrations/20260712150105_platform_domain_event_rpc.sql"},{"applied":{"name":"ingress_replay_audit","version":"20260712150106"},"logOrdinal":8,"ownerSha256":"45f445c112e1e76e1ff66ac0def33b6f9957c8b70e29f25dc5753860b55d41c1","repositoryOwnerPath":"supabase/migrations/20260712150106_ingress_replay_audit.sql"},{"applied":{"name":"domain_event_routing_rpcs","version":"20260712150110"},"logOrdinal":9,"ownerSha256":"735db06e396e8fd235d8b410911c824b312e7fa6dd05edf74fef7eb166e7e85d","repositoryOwnerPath":"supabase/migrations/20260712150110_domain_event_routing_rpcs.sql"},{"applied":{"name":"domain_event_metrics_rpc","version":"20260712150111"},"logOrdinal":10,"ownerSha256":"ae6d9af8d89034e2874c646a9d3ce76d84b93ea09e1aab16b84f7dab36f59819","repositoryOwnerPath":"supabase/migrations/20260712150111_domain_event_metrics_rpc.sql"},{"applied":{"name":"event_delivery_replay_audit","version":"20260712150115"},"logOrdinal":11,"ownerSha256":"f443ec53e6c087db9cae6d80904a2042cfdbeaee36f94acfee341fc679ab9d82","repositoryOwnerPath":"supabase/migrations/20260712150115_event_delivery_replay_audit.sql"},{"applied":{"name":"event_delivery_rpcs","version":"20260712150120"},"logOrdinal":12,"ownerSha256":"7930f4e4d57cd264edf72a4e61ecea2309d60c629bc6267026721ab9535ac6b9","repositoryOwnerPath":"supabase/migrations/20260712150120_event_delivery_rpcs.sql"},{"applied":{"name":"event_delivery_replay_rpc","version":"20260712150121"},"logOrdinal":13,"ownerSha256":"9efc932c818fe40f501a261399dbccf1e5146b0ec8e40050e0d4f0671e6c7f2c","repositoryOwnerPath":"supabase/migrations/20260712150121_event_delivery_replay_rpc.sql"},{"applied":{"name":"event_delivery_batch_replay_rpc","version":"20260712150122"},"logOrdinal":14,"ownerSha256":"6809f521ff5a08934f44e9c76626d4b978e9630413421b08f39788292f15ed60","repositoryOwnerPath":"supabase/migrations/20260712150122_event_delivery_batch_replay_rpc.sql"},{"applied":{"name":"event_worker_heartbeats","version":"20260712150125"},"logOrdinal":15,"ownerSha256":"9c5865a13cc5c75f9b31183ea599fc8d51296d0c2c71cc9ae430120f69a1ab04","repositoryOwnerPath":"supabase/migrations/20260712150125_event_worker_heartbeats.sql"},{"applied":{"name":"event_pipeline_admin_rpcs","version":"20260712150126"},"logOrdinal":16,"ownerSha256":"85897415c4352831b9e2cd48a3f2784e892c1e7316bdfccfa207482cef48e78e","repositoryOwnerPath":"supabase/migrations/20260712150126_event_pipeline_admin_rpcs.sql"},{"applied":{"name":"domain_event_cdc_triggers","version":"20260712150130"},"logOrdinal":17,"ownerSha256":"43a75c9243d6232102e7462842e7a8f3d2459410434cad8630da787c170560a5","repositoryOwnerPath":"supabase/migrations/20260712150130_domain_event_cdc_triggers.sql"},{"applied":{"name":"event_pipeline_retention_rpc","version":"20260712150140"},"logOrdinal":18,"ownerSha256":"11cb7190bd506ac7460170bcf2a18701eae227eb21292426d9b5e1c55741d031","repositoryOwnerPath":"supabase/migrations/20260712150140_event_pipeline_retention_rpc.sql"},{"applied":{"name":"preserve_delivery_context_in_domain_events","version":"20260713113000"},"logOrdinal":19,"ownerSha256":"6718cca7ae1f9dde88f0f6645be29b093025f6dbffeda1e4e006fca6108682a0","repositoryOwnerPath":"supabase/migrations/20260713113000_preserve_delivery_context_in_domain_events.sql"},{"applied":{"name":"event_delivery_replay_and_idempotency_fixes","version":"20260713120000"},"logOrdinal":20,"ownerSha256":"60d7beb0f4cbb42de43046648dd44413a8dedf96559b7bd171f8a121eea69cf1","repositoryOwnerPath":"supabase/migrations/20260713120000_event_delivery_replay_and_idempotency_fixes.sql"},{"applied":{"name":"separate_delivery_replay_attempt_budget","version":"20260713205000"},"logOrdinal":21,"ownerSha256":"708770981937505e9d27e2196d99346d38ef745abf19abd253a350aec4a234aa","repositoryOwnerPath":"supabase/migrations/20260713205000_separate_delivery_replay_attempt_budget.sql"},{"applied":{"name":"platform_event_legacy_idempotency","version":"20260713222000"},"logOrdinal":22,"ownerSha256":"427eb53af01548ae594013b71827324a544b3ffe37a41b302b74c1c386178457","repositoryOwnerPath":"supabase/migrations/20260713222000_platform_event_legacy_idempotency.sql"},{"applied":{"name":"harden_event_pipeline_admin_filters","version":"20260714000100"},"logOrdinal":23,"ownerSha256":"bfda81c357bff06435de481c993011652e173795d2497a5fde63e46c23102dca","repositoryOwnerPath":"supabase/migrations/20260714000100_harden_event_pipeline_admin_filters.sql"},{"applied":{"name":"scope_public_event_ingress","version":"20260714000200"},"logOrdinal":24,"ownerSha256":"619481d348cd55b38a5043f3ac003f39715887808328f96335ea4a2fa989e994","repositoryOwnerPath":"supabase/migrations/20260714000200_scope_public_event_ingress.sql"},{"applied":{"name":"allow_tenant_verified_event_ingress_fallback","version":"20260714000300"},"logOrdinal":25,"ownerSha256":"c429a6a71fec0487645b47f312998a25f14ec2af4c2741ce3de6b7b36b9356cf","repositoryOwnerPath":"supabase/migrations/20260714000300_allow_tenant_verified_event_ingress_fallback.sql"},{"applied":{"name":"drop_legacy_event_ingress_rpc_overloads","version":"20260714000400"},"logOrdinal":26,"ownerSha256":"fbf3de3af3099d6624d3367bfd91d9bc49435487c78670e2efc202e2456a18d2","repositoryOwnerPath":"supabase/migrations/20260714000400_drop_legacy_event_ingress_rpc_overloads.sql"}]},{"coverage":"complete-primary-log-group","databaseJobId":87197071269,"deploymentRunId":29365841123,"includedRecords":[{"logOrdinal":1,"recordOrdinal":23},{"logOrdinal":2,"recordOrdinal":24},{"logOrdinal":3,"recordOrdinal":25},{"logOrdinal":4,"recordOrdinal":26}],"observedMigrationEntryCount":4},{"coverage":"complete-primary-log-group","databaseJobId":87207417765,"deploymentRunId":29367954362,"includedRecords":[{"logOrdinal":1,"recordOrdinal":16},{"logOrdinal":2,"recordOrdinal":17}],"observedMigrationEntryCount":2},{"coverage":"complete-primary-log-group","databaseJobId":87215018094,"deploymentRunId":29370675467,"includedRecords":[{"logOrdinal":1,"recordOrdinal":27}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":87237670735,"deploymentRunId":29378150948,"includedRecords":[{"logOrdinal":1,"recordOrdinal":28}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":87244973582,"deploymentRunId":29380448299,"includedRecords":[{"logOrdinal":1,"recordOrdinal":29}],"observedMigrationEntryCount":1},{"coverage":"complete-primary-log-group","databaseJobId":87358367070,"deploymentRunId":29417244012,"includedRecords":[{"logOrdinal":1,"recordOrdinal":30}],"observedMigrationEntryCount":1}],"registryOrdering":"repositoryOwnerPath-ascending","relations":[{"kind":"duplicate-version-companion","ownerRecordOrdinal":1,"replayDisposition":"apply-synthetic-companion-immediately-after-owner","syntheticCompanion":{"name":"customer_order_cancellation","ownerSha256":"acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3","repositoryOwnerPath":"supabase/migrations/20260615120000_customer_order_cancellation.sql","version":"20260615120000"}},{"kind":"duplicate-version-companion","ownerRecordOrdinal":18,"replacementRecordOrdinal":19,"replayDisposition":"omit-colliding-body-use-unique-reapply","syntheticCompanion":{"name":"quiz_finalize_rank_winners","ownerSha256":"3140c3a76b2cd6ca1952dc166cd5e010d15c7070fde0647e41ad9bfc7d400ab2","repositoryOwnerPath":"supabase/migrations/20260713130000_quiz_finalize_rank_winners.sql","version":"20260713130000"}},{"afterRecordOrdinal":19,"beforeRecordOrdinal":18,"kind":"record-before-record","reason":"unique_quiz_reapply_follows_production_owned_duplicate"},{"after":{"databaseJobId":87207417765,"deploymentRunId":29367954362},"before":{"databaseJobId":87197071269,"deploymentRunId":29365841123},"kind":"job-group-before-job-group","reason":"late_group_primary_run_order"},{"after":{"databaseJobId":87215018094,"deploymentRunId":29370675467},"before":{"databaseJobId":87207417765,"deploymentRunId":29367954362},"kind":"job-group-before-job-group","reason":"late_group_primary_run_order"},{"after":{"databaseJobId":87237670735,"deploymentRunId":29378150948},"before":{"databaseJobId":87215018094,"deploymentRunId":29370675467},"kind":"job-group-before-job-group","reason":"late_group_primary_run_order"},{"after":{"databaseJobId":87244973582,"deploymentRunId":29380448299},"before":{"databaseJobId":87237670735,"deploymentRunId":29378150948},"kind":"job-group-before-job-group","reason":"late_group_primary_run_order"},{"after":{"databaseJobId":87358367070,"deploymentRunId":29417244012},"before":{"databaseJobId":87244973582,"deploymentRunId":29380448299},"kind":"job-group-before-job-group","reason":"late_group_primary_run_order"}]}}

```

## Frozen Replay Mappings

The implementation uses these exact current-tree owner hashes and rejects drift:

| Production-only version | Current-tree owner | Owner SHA-256 | Rule |
| --- | --- | --- | --- |
| `20260623190041` | `20260623190000_enable_realtime_negotiation_requests.sql` | `bc2165173828d7a5c667e5a7415fb37b9ba7762aad2e12268b70eab6dcc94526` | canonical |
| `20260624211416` | `20260624200000_merchant_email_domains.sql` | `120e16cb8768fdec2e36ce041dc5049e299594d271e1f900a4abd0ac3c775ad6` | canonical |
| `20260625173604` | `20260714010000_scope_feature_settings_read_policies.sql` | `31091717a01f66c683c87e77a2f62245732df023b6dd61055855cf7ff78cff9f` | superseded final state |
| `20260626131520` | `20260702024830_fix_search_products_condition_filter.sql` | `d94d9d87b238c217a8640c9e5b2ef57263ff2112015fac7e2f40de2a91270ed3` | canonical |
| `20260629154903` | `20260714225501_reconcile_order_fulfillment_timestamps.sql` | `1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361` | append-only repair |
| `20260630123511` | `20260702063638_restore_mobile_admin_product_rpc_contract.sql` | `a04858072ce04f37af2269bb14bd4a936df612b6243fdb0099e8b417ba9c3ba4` | superseded final state |
| `20260701080400` | `20260702140100_order_item_unit_costs_supplier_analytics.sql` | `b2c0bd55fdb092549ccbc42ed4011def80cc2f5417451bba14df6476cdf4a8a9` | canonical |
| `20260701123945` | `20260702140200_supplier_purchase_analytics_branch_scope.sql` | `722b166fda187ee2cf4d8200d1b99a4af88fd41055ab85ba5ece171bdd3a721c` | canonical |
| `20260706202930` | `20260706200000_add_storefront_preflight_rpcs.sql` | `091506e1cfb83822453a2134eb01f9e72fe78dbcb988eafe01412e78fd72d021` | canonical |
| `20260706210329` | `20260706162109_allow_page_config_history_insert.sql` | `3104462281e7e92658b25c36cbb21c95437da84babb6e18f95c45242adfa5594` | canonical |
| `20260707064146` | `20260706230000_add_blog_listing_preflight_rpc.sql` | `e6f1050fa096534a442b1b19aad68039c577bb620bb897e5ece172a1e5c73a04` | canonical |
| `20260708072653` | `20260708013000_create_domain_purchase_transaction_rpc.sql` | `40b5b16c32136c3fa8300725a48469d43af8264f60c4b1faa4fdc6a99e3f00e6` | canonical |
| `20260708072825` | `20260708013500_fix_domain_purchase_rpc_merchant_derivation.sql` | `53eca111142dda0f4f5030deeec5842b9eabc588f894d631a1830eb8f7dad999` | canonical |
| `20260708075932` | `20260708090000_lock_domain_purchase_rpc_service_role.sql` | `7d522c998d5b32c230fe804cc21ffa0daa23832d37661a490164cbc840ba6855` | canonical |
| `20260708102643` | `20260707211507_optimize_storefront_cached_merchant_and_variant_wrappers.sql` | `2916e23dae09a40aa2e771798e3919ddea346f2ce8638837dd9a9de098b68e61` | canonical |
| `20260708220832` | `20260708220947_drop_authenticated_domain_purchase_rpc.sql` | `005b89e87c87bcad7f5b206ad61cff05041458edd19f60409c73889ed7921bc9` | canonical |
| `20260713200830` | `20260713211500_split_platform_blog_anon_read_policy.sql` | `d51de0171bb6837e4ed9fa161b1785de2d77915446d89cb2a857a0f403fa337f` | canonical predecessor/final owner |

Duplicate-version ownership is exact:

- `20260615120000_customer_order_cancellation.sql` SHA-256 `acb7406d4975c5cd8d3964e86b991b51046b6f750d49b3769699b878b92192d3`.
- `20260615120000_register_push_token_rpc.sql` SHA-256 `6000b0006539041c1bd914567ebcbc31eb15e8f14401ae488d0a609ce74b4293`; production run `27581785760`, job `81543472691`, owns the linked row. Chronological replay applies both files under synthetic receipt IDs; production-effect replay applies the production body then the cancellation companion exactly as the receipt relation directs.
- `20260713130000_add_storefront_paystack_subaccount_configured_rpc.sql` SHA-256 `9cb95f8ba9ebd75568b9b5c7ee17521981465fa330d18a76ed467a179dd79645`; production run `29250720772`, job `86818299307`, owns the linked row.
- `20260713130000_quiz_finalize_rank_winners.sql` SHA-256 `3140c3a76b2cd6ca1952dc166cd5e010d15c7070fde0647e41ad9bfc7d400ab2`; chronological replay applies it under a synthetic receipt.
- `20260713140000_quiz_finalize_rank_winners_reapply.sql` SHA-256 `f3461eead2451852ecc9a643f34ca486207ea6b10b8ef3439e69718e738acd8c`; production run `29276021836`, job `86905145251`, owns the applied quiz effect.

The immutable #3077 inventory is exact:

```text
4f31649ba4c9c3d6b5eb4110dbb0d144237502642d61c0606e15a9b1ba39556b  20260712150001_domain_event_pipeline_tables.sql
3a3018fcd2e0daea0dec918d953e1dadf314ea1f88698e336a72a97da8ddcd1c  20260712150050_eventing_internal_schema.sql
dcb23009b30f1970359737ccfc1e34f3b63b952a59e6854d1352a98b4fbdc21b  20260712150075_domain_event_idempotency_guard.sql
bce417899451c9bd0b5e18881b3776ecfcfb8128d2953d619c859e675c45cde1  20260712150100_domain_event_enqueue_rpcs.sql
10162654ecc524c5d0fafd8f6c08f2fa439a2cce791373a7dc5b05e4e94cffe7  20260712150101_analytics_domain_event_rpc.sql
a466608103ca395ac28582e30fcece53fb671b356e5422f9d58c6f5142a975e2  20260712150102_domain_event_read_rpc.sql
09b1bbb4ae19c13465a94250764e12539e3b6aabfb18f7a4d2190afa79d6695a  20260712150105_platform_domain_event_rpc.sql
45f445c112e1e76e1ff66ac0def33b6f9957c8b70e29f25dc5753860b55d41c1  20260712150106_ingress_replay_audit.sql
735db06e396e8fd235d8b410911c824b312e7fa6dd05edf74fef7eb166e7e85d  20260712150110_domain_event_routing_rpcs.sql
ae6d9af8d89034e2874c646a9d3ce76d84b93ea09e1aab16b84f7dab36f59819  20260712150111_domain_event_metrics_rpc.sql
f443ec53e6c087db9cae6d80904a2042cfdbeaee36f94acfee341fc679ab9d82  20260712150115_event_delivery_replay_audit.sql
7930f4e4d57cd264edf72a4e61ecea2309d60c629bc6267026721ab9535ac6b9  20260712150120_event_delivery_rpcs.sql
9efc932c818fe40f501a261399dbccf1e5146b0ec8e40050e0d4f0671e6c7f2c  20260712150121_event_delivery_replay_rpc.sql
6809f521ff5a08934f44e9c76626d4b978e9630413421b08f39788292f15ed60  20260712150122_event_delivery_batch_replay_rpc.sql
9c5865a13cc5c75f9b31183ea599fc8d51296d0c2c71cc9ae430120f69a1ab04  20260712150125_event_worker_heartbeats.sql
85897415c4352831b9e2cd48a3f2784e892c1e7316bdfccfa207482cef48e78e  20260712150126_event_pipeline_admin_rpcs.sql
43a75c9243d6232102e7462842e7a8f3d2459410434cad8630da787c170560a5  20260712150130_domain_event_cdc_triggers.sql
11cb7190bd506ac7460170bcf2a18701eae227eb21292426d9b5e1c55741d031  20260712150140_event_pipeline_retention_rpc.sql
6718cca7ae1f9dde88f0f6645be29b093025f6dbffeda1e4e006fca6108682a0  20260713113000_preserve_delivery_context_in_domain_events.sql
60d7beb0f4cbb42de43046648dd44413a8dedf96559b7bd171f8a121eea69cf1  20260713120000_event_delivery_replay_and_idempotency_fixes.sql
708770981937505e9d27e2196d99346d38ef745abf19abd253a350aec4a234aa  20260713205000_separate_delivery_replay_attempt_budget.sql
427eb53af01548ae594013b71827324a544b3ffe37a41b302b74c1c386178457  20260713222000_platform_event_legacy_idempotency.sql
bfda81c357bff06435de481c993011652e173795d2497a5fde63e46c23102dca  20260714000100_harden_event_pipeline_admin_filters.sql
619481d348cd55b38a5043f3ac003f39715887808328f96335ea4a2fa989e994  20260714000200_scope_public_event_ingress.sql
c429a6a71fec0487645b47f312998a25f14ec2af4c2741ce3de6b7b36b9356cf  20260714000300_allow_tenant_verified_event_ingress_fallback.sql
fbf3de3af3099d6624d3367bfd91d9bc49435487c78670e2efc202e2456a18d2  20260714000400_drop_legacy_event_ingress_rpc_overloads.sql
```

The later deployment-owned inputs are also frozen:

```text
8e0adbe1f2e51b882f719cb2b3fa69cdc6fdff24b9fa25fdd5430ba72a7079dd  20260713160000_restore_merchants_anon_public_columns.sql
39762ddc3e9d0c6fe92c2e6c502bf574c2e480aff448ed54ec0af4ad95606fd0  20260713123000_preserve_repeat_order_notification_cycles.sql
ff62e93746dc740e1a75bc19e4511b752fd3d7e385f26d6a66b62d1eec8d83b9  20260713123100_scope_manual_order_notifications_to_cycle.sql
9c80b9ee1f45d2d7eaced5f3e466de68866fe1a614d1559733ee7287e2cf39c2  20260714090000_add_merchant_settlement_failed_review_type.sql
ea2ea7f781662d04684f381d2a89270ecba68d7bc1f0f055ce14a9e4f36f8fcb  20260714093000_scope_capture_review_deduplication.sql
150b7fbf9fe237a889f7aff62b2041e4d8289f9a9413e770289a472d1f341c13  20260714100000_add_gateway_payment_wedge_review_type.sql
f7e22ba571d534352cc05dbf5d65c968f107844a1c962dea81a1a001a5150783  20260714123000_complete_order_gateway_payment_atomic.sql
e2840c2ffb6ad0f7ebd4dccf85d2d46454c2ff71ec09a938cff43ecbc22e4d25  20260714161000_claim_wallet_credit_push.sql
```

## Phase Interfaces

The following signatures are binding across tasks:

```ts
export type SupabaseHistoryReplayMode = 'chronological' | 'production-effect';
export type ReplayCommand = (command: string, args: readonly string[], options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
}) => Promise<{ stderr: string; stdout: string }>;
export type ReplaySource = {
  receiptId: string;
  repositoryPath: string;
  sha256: string;
  transform?: { originalSha256: string; outputSha256: string; search: string; replacement: string };
};
export type ReplayReceipt = {
  baseSha: string;
  effectSha256: string;
  mode: SupabaseHistoryReplayMode;
  orderedSources: readonly ReplaySource[];
  serverVersionNum: 170006;
  sqlChecks: readonly string[];
};
export type EventPipelineClient = import('@supabase/supabase-js').SupabaseClient<
  import('@/types/supabase').Database
>;
export type EventPipelineRpcName = keyof import('@/types/supabase').Database['public']['Functions'];
export type EventPipelineRpcArgs<Name extends EventPipelineRpcName> =
  import('@/types/supabase').Database['public']['Functions'][Name]['Args'];
export type EventPipelineRpcReturns<Name extends EventPipelineRpcName> =
  import('@/types/supabase').Database['public']['Functions'][Name]['Returns'];
declare const serviceRoleClientBrand: unique symbol;
export type ServiceRoleClient = import('@supabase/supabase-js').SupabaseClient<
  import('@/types/supabase').Database
> & { readonly [serviceRoleClientBrand]: true };
export type AnalyticsPlatformConfig = {
  offline_conversions_enabled: boolean | null;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
};
export async function fetchAnalyticsPlatformConfig(
  client: EventPipelineClient,
  merchantId: string
): Promise<Readonly<AnalyticsPlatformConfig> | null>;
export type AdPlatformTarget = 'facebook' | 'google' | 'snapchat' | 'tiktok';
export type AdPlatformDeliveryOptions = {
  signal?: AbortSignal;
};
export async function sendConfiguredAdPlatforms(
  config: Readonly<AnalyticsPlatformConfig>,
  event: ConversionEvent,
  options?: AdPlatformDeliveryOptions
): Promise<AdPlatformResults>;
export async function trustedServerAdPlatformFanout(
  client: ServiceRoleClient,
  resolvedMerchantId: string,
  event: ConversionEvent,
  options?: AdPlatformDeliveryOptions
): Promise<AdPlatformResults>;
```

---

### Task 1: Freeze, merge, and check in the reviewed documentation baseline

**Files:**
- Create: `docs/architecture/durable-event-pipeline-p0-path-inventory.md`
- Create: `apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv`
- Create: `apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt`
- Create: `apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv`
- Add existing reviewed file: `docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md`
- Add approved phase file: `docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md`

**Produces:** An exact base/ledger/deployment/path receipt. No runtime source changes.

> **Historical execution note:** Task 1 was completed against #3123 at `8f6968f73d` plus normal merge `e9234b8dfb`. Its #3123 commands below are retained as evidence and must not be rerun as the current-base gate. The post-Task-2 receipt-regeneration checkpoint below exclusively owns the #3124 refresh and second normal integration merge.

- [ ] **Step 1: Prove the frozen contract and target before merging**

```bash
set -euo pipefail
cd /Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home
test "$(shasum -a 256 docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md | awk '{print $1}')" = "3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca"
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0"
test "$(git rev-parse origin/main^)" = "9e3d1b14b1931a5e441fc23f0e5417c188056e47"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'1\t1'
test "$(supabase --version)" = "2.95.4"
docker info >/dev/null
PSQL_BIN=/opt/homebrew/opt/libpq/bin/psql
test -x "$PSQL_BIN"
"$PSQL_BIN" --version | rg -q ' 18[.]3$'
gh auth status >/dev/null
coderabbit review --help >/dev/null
test -n "${SUPABASE_ACCESS_TOKEN:-}"
test -s supabase/.temp/project-ref
git diff --cached --quiet
typeset -a expected_initial_dirty=(
  ' M apps/web/supabase/.temp/cli-latest'
  ' M supabase/.temp/cli-latest'
  '?? docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md'
  '?? docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md'
)
actual_initial_dirty="$(git status --short --untracked-files=all | LC_ALL=C sort)"
expected_initial_dirty_text="$(printf '%s\n' "${expected_initial_dirty[@]}" | LC_ALL=C sort)"
test "$actual_initial_dirty" = "$expected_initial_dirty_text"
migration_tree_sha() {
  git ls-tree -r --name-only "$1" -- supabase/migrations |
    rg '^supabase/migrations/[^/]+[.]sql$' |
    LC_ALL=C sort |
    while IFS= read -r migration_path; do
      printf '%s\t%s\n' "$migration_path" \
        "$(git show "$1:$migration_path" | shasum -a 256 | awk '{print $1}')"
    done |
    shasum -a 256 | awk '{print $1}'
}
p0_frozen_scope_sha() {
  typeset -a p0_scope_prefixes=(
    .ruler/01-critical-rules.md
    AGENTS.md
    CLAUDE.md
    biome.json
    .github/workflows/deploy.yml
    .github/workflows/ci.yml
    .github/scripts/apply-pending-migrations.sh
    .github/scripts/apply-pending-migrations.test.sh
    .github/scripts/check-migration-versions.sh
    .github/scripts/check-migration-versions.test.sh
    .github/scripts/split-sql-statements.mjs
    .github/scripts/split-sql-statements.test.mjs
    .github/scripts/resolve-ci-test-plan-config.test.mjs
    .github/scripts/tools-worker-typecheck-contract.test.mjs
    docs/architecture/durable-event-pipeline-p0-path-inventory.md
    docs/architecture/biome.json
    docs/architecture/durable-event-pipeline-p0-chronological-receipt.json
    docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json
    docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
    apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.tools-workers.json
    apps/web/src/app/api/admin/event-pipeline apps/web/src/app/api/analytics
    apps/web/src/app/api/events apps/web/src/app/api/platform/events
    apps/web/src/lib/analytics apps/web/src/lib/events apps/web/src/lib/payments
    apps/web/src/lib/supabase apps/web/src/lib/merchant-feature-gates.ts
    apps/web/src/lib/merchant-feature-gates.test.ts
    apps/web/src/lib/merchant-has-feature.ts apps/web/src/lib/merchant-has-feature.test.ts
    apps/web/src/lib/domain-event-pipeline-migration.test.ts
    apps/web/src/lib/offline-conversions.ts
    apps/web/src/lib/server-side-analytics.ts
    apps/web/src/lib/trigger-purchase-conversion.ts
    apps/web/src/lib/trigger-purchase-conversion.test.ts
    apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts
    apps/web/src/scripts/process-domain-events.ts
    apps/web/src/scripts/process-domain-events.test.ts
    apps/web/src/scripts/process-event-deliveries.ts
    apps/web/src/scripts/process-event-deliveries.test.ts
    apps/web/src/schemas/event-dead-letter.ts
    apps/web/src/types/supabase.ts apps/web/tools/db apps/web/tools/events
    supabase/migrations/tests supabase/tests/migration_history_overlays
    supabase/tests/domain_event_pipeline.sql
    supabase/tests/domain_event_ingress_pipeline.sql
    supabase/tests/event_delivery_pipeline.sql vps-workers
  )
  git ls-tree -r --name-only "$1" -- "${p0_scope_prefixes[@]}" |
    LC_ALL=C sort -u |
    while IFS= read -r frozen_path; do
      printf '%s\t%s\n' "$frozen_path" \
        "$(git show "$1:$frozen_path" | shasum -a 256 | awk '{print $1}')"
    done |
    shasum -a 256 | awk '{print $1}'
}
test "$(migration_tree_sha 9e3d1b14b1931a5e441fc23f0e5417c188056e47)" = "757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983"
test "$(migration_tree_sha origin/main)" = "757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983"
test "$(p0_frozen_scope_sha 9e3d1b14b1931a5e441fc23f0e5417c188056e47)" = "93167527d7f3ebcea35deae2ac16a522902c6b4e6d0433f742a7f0fe0056dc05"
test "$(p0_frozen_scope_sha origin/main)" = "93167527d7f3ebcea35deae2ac16a522902c6b4e6d0433f742a7f0fe0056dc05"
test -z "$(git ls-tree -r --name-only 9e3d1b14b1931a5e441fc23f0e5417c188056e47 -- \
  supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql)"
test -z "$(git ls-tree -r --name-only origin/main -- \
  supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql)"
test ! -e supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql
typeset -a lane_rows=(
  $'3024\t2d702e2a39a90b4b78f0015a474c1cd62bbb699af92957924a34c8778b0c44a1\tsupabase/migrations/20260708093415_merchant_payment_credentials.sql'
  $'3024\t9b0455094b31d0e81a7dfd8a9c83201512ae870410ade6aaec23e9bff9fcf072\tsupabase/migrations/20260708140644_byok_direct_settlements.sql'
  $'3024\tefb14411b91c0118dc13b0d50d9dbd54e8d743c7c900280aa1470ad7611c41b0\tsupabase/migrations/20260708150000_paypal_capture_persist_reconciliation_issue.sql'
  $'3024\t0308b957a622c68bfa02f79dacda3243b61b678b91fdb20f4d3accb4994d3a73\tsupabase/migrations/20260712090000_delete_merchant_payment_credential_role.sql'
  $'3024\t0b4f1455a50879471e899afeecdaefb0b03e1e1a7b5657c571cd400d7e8a6c5d\tsupabase/migrations/20260712100001_orders_paid_transaction_marker.sql'
  $'3024\t6b2f4f4139702abcd5be077a069769114d47b7f0302a7c4d69d8b6441007df51\tsupabase/migrations/20260712100002_orders_paid_transaction_marker_index.sql'
  $'3024\td34e31e49b9d5a7ea3a2631d7a29d45a06e5cc0db76ce80019ea2a02dad4519e\tsupabase/migrations/20260712100100_credit_customer_wallet_order_refund.sql'
  $'3024\t59247745bfa511c70e4c4d0bfdb26abc8652c5565ef9e994c1a29247deee8f1b\tsupabase/migrations/20260713140001_touch_merchant_credential_validated_by_environment.sql'
  $'3024\tf2fe9d9345c4728a1a34f8cd44e6f1456fae2f18d88da6f7449cefce8d0a1de8\tsupabase/migrations/20260713150001_public_snapshot_paypal_flags.sql'
  $'3024\t951c980acd5d98a49d10160e0d830b50bfe9c9c7ed33585dce2327bdd4b8d986\tsupabase/migrations/20260714090001_transactions_refund_statuses.sql'
  $'3024\tf74bd1af1d8237976468e4df510b577e8b4de0947ba117fe9abb36cac6811e51\tsupabase/migrations/20260714090002_transactions_refund_pending_index.sql'
  $'3024\t072dd7791e4b9414187fe63c9056543f1b83b1a83837681584a9ae9527e020f3\tsupabase/migrations/20260714130000_include_paypal_capture_persist_review_type.sql'
  $'3024\t33d873748cd948a92c4cb32d2f12d3dba06670810fd4dc9b735fc54dac8ea0cc\tsupabase/migrations/20260714162000_replace_merchant_payment_credential_pair.sql'
  $'3024\tfd3391ef880d88b3b2f7083888a43099476489b52f6311dd004151efbebfe66d\tsupabase/migrations/20260714162100_mark_savings_redemptions_reversed.sql'
  $'3024\tcd91c66fed1a158455c83928e4eae42d3f3dd8a1db826c235e68857e689049fb\tsupabase/migrations/20260714162200_drop_legacy_credential_validation_touch.sql'
  $'3024\t6078df1576ec4ea3c94d565a6180242a688186c5e8e25ef943bb23144e6fa3c7\tsupabase/migrations/20260714162300_mark_paypal_transaction_refunded.sql'
  $'3024\t6bb7429b5f50c4116febc9c5c41cd1244105b9d0852944954825c6139ea64718\tsupabase/migrations/20260714162400_order_payment_snapshot_merchant_country.sql'
)
test "$(printf '%s\n' "${lane_rows[@]}" | shasum -a 256 | awk '{print $1}')" = \
  "c7c43af3103d291a40c745bc8742e8094d82dcce60bc7cf90f6a97eb8c342137"
for pr_number in 2686 2928 2958 3024; do
  gh pr view "$pr_number" --json state --jq 'select(.state == "OPEN") | .state' | rg -qx OPEN
  expected_paths="$(printf '%s\n' "${lane_rows[@]}" |
    awk -F '\t' -v pr="$pr_number" '$1 == pr {print $3}' | LC_ALL=C sort)"
  actual_paths="$(gh api --paginate "repos/ogabasseyy/Baci/pulls/$pr_number/files?per_page=100" \
    --jq '.[] | .filename | select(test("^supabase/migrations/[^/]+[.]sql$"))' |
    LC_ALL=C sort)"
  test "$actual_paths" = "$expected_paths"
done
assert_pr_migration_blob() {
  local pr_number="$1" migration_path="$2" expected_sha="$3" head actual
  head="$(gh pr view "$pr_number" --json state,headRefOid --jq 'select(.state == "OPEN") | .headRefOid')"
  test -n "$head"
  actual="$(gh api "repos/ogabasseyy/Baci/contents/$migration_path?ref=$head" --jq .content |
    base64 --decode | shasum -a 256 | awk '{print $1}')"
  test "$actual" = "$expected_sha"
}
while IFS=$'\t' read -r pr_number expected_sha migration_path; do
  assert_pr_migration_blob "$pr_number" "$migration_path" "$expected_sha"
done < <(printf '%s\n' "${lane_rows[@]}")
if for pr_number in $(gh api --paginate 'repos/ogabasseyy/Baci/pulls?state=open&per_page=100' --jq '.[].number'); do
  gh api --paginate "repos/ogabasseyy/Baci/pulls/$pr_number/files?per_page=100" --jq '.[].filename'
done | rg -q '^supabase/migrations/20260714225501_'; then
  exit 1
fi
```

Expected: the final contract/provenance/tree hashes and exact DB-job terminal binding have been replaced, the frozen migration base is an ancestor, each observed open lane remains open with its frozen migration bytes, no open PR owns `20260714225501`, the index is empty, and only the two preserved notifier files plus the two reviewed plan files are untracked/modified. Unrelated open-PR head advancement is allowed; a lane merge, frozen path/blob change, or collision stops execution.

- [ ] **Step 2: Prove the migration-base and current-main database jobs are terminal-success with no migration drift**

```bash
set -euo pipefail
gh run view 29417244012 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "9e3d1b14b1931a5e441fc23f0e5417c188056e47" and
  .status == "completed" and
  .conclusion == "success" and
  any(.jobs[]; .databaseId == 87358367070 and .name == "db-migrations" and
    .status == "completed" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87358421368 and .name == "deploy-production" and
    .status == "completed" and .conclusion == "skipped")'
semantic_log="$(LC_ALL=C gh run view 29417244012 --job 87358367070 --log |
  LC_ALL=C awk '
    { line=$0; best=0 }
    { for (i=1; i<=4; i++) { p=index(line, markers[i]); if (p && (!best || p<best)) best=p } }
    best { print substr(line,best) }
    BEGIN {
      markers[1]="→ applying:"; markers[2]="✓ applied:";
      markers[3]="✓ already applied:"; markers[4]="Migrations summary:"
    }')"
test "$(printf '%s\n' "$semantic_log" | shasum -a 256 | awk '{print $1}')" = "8d6bd79a6aefd1d6956141fba289018ec1902345bd85bce127a733ddb476215e"
printf '%s\n' "$semantic_log" | rg -qx 'Migrations summary: 1 applied, 423 skipped.'
gh run view 29472376797 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0" and
  .status == "completed" and
  .conclusion == "success" and
  any(.jobs[]; .databaseId == 87537955743 and .name == "db-migrations" and
    .status == "completed" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87537988080 and .name == "deploy-production" and
    .status == "completed" and .conclusion == "skipped")'
current_main_semantic_log="$(LC_ALL=C gh run view 29472376797 --job 87537955743 --log |
  LC_ALL=C awk '
    { line=$0; best=0 }
    { for (i=1; i<=4; i++) { p=index(line, markers[i]); if (p && (!best || p<best)) best=p } }
    best { print substr(line,best) }
    BEGIN {
      markers[1]="→ applying:"; markers[2]="✓ applied:";
      markers[3]="✓ already applied:"; markers[4]="Migrations summary:"
    }')"
test "$(printf '%s\n' "$current_main_semantic_log" | shasum -a 256 | awk '{print $1}')" = "57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c"
printf '%s\n' "$current_main_semantic_log" | rg -qx 'Migrations summary: 0 applied, 424 skipped.'
gh run view 29380448299 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "769c1645348d20f719e424423c9d3bedbc5985d0" and
  .status == "completed" and
  .conclusion == "success" and
  any(.jobs[]; .databaseId == 87245007215 and .name == "deploy-production" and
    .status == "completed" and .conclusion == "success" and
    .completedAt == "2026-07-15T02:11:07Z")'
```

Expected: the immutable migration-base database job proves one applied and 423 skipped files, while the exact current-integration-main job proves zero applied and 424 skipped files; both transport-stable semantic logs hash to their reviewed values. Both deploy jobs are explicitly `skipped`, not silently upgraded to success. The separate last-proven application receipt remains `769c164...` with successful deploy job `87245007215`. A queued/running/failed/cancelled database job, non-success overall run, changed receipt, or any attempt to claim current-main application coherence remains a hard stop.

- [ ] **Step 3: Merge the exact current integration main normally**

```bash
set -euo pipefail
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0"
test "$(git rev-parse origin/main^)" = "9e3d1b14b1931a5e441fc23f0e5417c188056e47"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'1\t1'
migration_tree_sha() {
  git ls-tree -r --name-only "$1" -- supabase/migrations |
    rg '^supabase/migrations/[^/]+[.]sql$' |
    LC_ALL=C sort |
    while IFS= read -r migration_path; do
      printf '%s\t%s\n' "$migration_path" \
        "$(git show "$1:$migration_path" | shasum -a 256 | awk '{print $1}')"
    done |
    shasum -a 256 | awk '{print $1}'
}
p0_frozen_scope_sha() {
  typeset -a p0_scope_prefixes=(
    .ruler/01-critical-rules.md
    AGENTS.md
    CLAUDE.md
    biome.json
    .github/workflows/deploy.yml
    .github/workflows/ci.yml
    .github/scripts/apply-pending-migrations.sh
    .github/scripts/apply-pending-migrations.test.sh
    .github/scripts/check-migration-versions.sh
    .github/scripts/check-migration-versions.test.sh
    .github/scripts/split-sql-statements.mjs
    .github/scripts/split-sql-statements.test.mjs
    .github/scripts/resolve-ci-test-plan-config.test.mjs
    .github/scripts/tools-worker-typecheck-contract.test.mjs
    docs/architecture/durable-event-pipeline-p0-path-inventory.md
    docs/architecture/biome.json
    docs/architecture/durable-event-pipeline-p0-chronological-receipt.json
    docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json
    docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
    apps/web/package.json apps/web/tsconfig.json apps/web/tsconfig.tools-workers.json
    apps/web/src/app/api/admin/event-pipeline apps/web/src/app/api/analytics
    apps/web/src/app/api/events apps/web/src/app/api/platform/events
    apps/web/src/lib/analytics apps/web/src/lib/events apps/web/src/lib/payments
    apps/web/src/lib/supabase apps/web/src/lib/merchant-feature-gates.ts
    apps/web/src/lib/merchant-feature-gates.test.ts
    apps/web/src/lib/merchant-has-feature.ts apps/web/src/lib/merchant-has-feature.test.ts
    apps/web/src/lib/domain-event-pipeline-migration.test.ts
    apps/web/src/lib/offline-conversions.ts
    apps/web/src/lib/server-side-analytics.ts
    apps/web/src/lib/trigger-purchase-conversion.ts
    apps/web/src/lib/trigger-purchase-conversion.test.ts
    apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts
    apps/web/src/scripts/process-domain-events.ts
    apps/web/src/scripts/process-domain-events.test.ts
    apps/web/src/scripts/process-event-deliveries.ts
    apps/web/src/scripts/process-event-deliveries.test.ts
    apps/web/src/schemas/event-dead-letter.ts
    apps/web/src/types/supabase.ts apps/web/tools/db apps/web/tools/events
    supabase/migrations/tests supabase/tests/migration_history_overlays
    supabase/tests/domain_event_pipeline.sql
    supabase/tests/domain_event_ingress_pipeline.sql
    supabase/tests/event_delivery_pipeline.sql vps-workers
  )
  git ls-tree -r --name-only "$1" -- "${p0_scope_prefixes[@]}" |
    LC_ALL=C sort -u |
    while IFS= read -r frozen_path; do
      printf '%s\t%s\n' "$frozen_path" \
        "$(git show "$1:$frozen_path" | shasum -a 256 | awk '{print $1}')"
    done |
    shasum -a 256 | awk '{print $1}'
}
test "$(migration_tree_sha origin/main)" = "757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983"
test "$(p0_frozen_scope_sha origin/main)" = "93167527d7f3ebcea35deae2ac16a522902c6b4e6d0433f742a7f0fe0056dc05"
git merge --no-edit origin/main
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'2\t0'
git merge-base --is-ancestor 4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0 HEAD
git merge-base --is-ancestor 9e3d1b14b1931a5e441fc23f0e5417c188056e47 HEAD
git merge-base --is-ancestor 0e04f7cfec5767efb9dbfa5bc5a4e6ec4b738ce8 HEAD
git merge-base --is-ancestor 8a0cabe7791e1701371c32a4ac911c32fb40322a HEAD
```

Expected: the historical first normal integration merge of exact #3123 produced the recorded two-ahead/zero-behind branch at that checkpoint, with both the immutable migration base and #3123 as ancestors; no rebase and no conflict hidden by taking one side wholesale. The receipt-regeneration checkpoint now exclusively owns the later #3124 merge.

- [ ] **Step 4: Write the evidence document**

The TSV is the exact 154-line `git diff --name-status` output and must hash to `8a0f0b5e61d39fe46144e0114a41c7e25a8501e756ce1b819cca5fb793c6d0dc`. The regression-path fixture is the exact 64-path extraction and must hash to `cebd386858493293948812acd6e7861f236f0c3cfc5fa7484a27bbf32e6d5237`. Create `apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv` with `apply_patch` using the exact ordered 17 `lane_rows` above; #2686, #2928, and #2958 are represented by their documented required-empty sets, not fabricated rows. The document links all three fixtures and contains all 26 #3077 migration filenames/hashes, the 17 production-only mapping rows, duplicate ownership, deployment/DB-job IDs, the 439/424/422 linked/local counts, schema-v4 production-effect provenance SHA-256 `2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`, its 31-record count and partial-order coverage, merged #3117/#3121/#3120 evidence, all seventeen current #3024 path/blob pairs, the empty open-lane sets, and the separate migration-name-alias repair receipt SHA-256 `ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`. It also records the exact-current-main DB / last-proven-web-release split and explicit deferred oversized debt (`tiktok-events-api.test.ts` and unrelated storefront/payment/environment files). It rejects total historical order claims, records the deterministic chronological-plus-exceptional-splice model, and states that #3060's second queue/HTTP drainer is superseded and not imported.

- [ ] **Step 5: Verify and commit only documentation**

```bash
set -euo pipefail
git diff --check
git add docs/architecture/durable-event-pipeline-p0-path-inventory.md \
  apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv \
  apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt \
  apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv \
  docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md \
  docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
test "$(git diff --cached --name-only | LC_ALL=C sort)" = "$(printf '%s\n' \
  apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv \
  apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt \
  apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv \
  docs/architecture/durable-event-pipeline-p0-path-inventory.md \
  docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md \
  docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md | LC_ALL=C sort)"
git diff --cached --name-only
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "docs: freeze event pipeline recovery contract"
```

Expected: neither `supabase/.temp/cli-latest` nor `apps/web/supabase/.temp/cli-latest` is staged.

---

### Task 2: Build the hash-bound replay manifest and single syntax overlay

**Files:**
- Create: `apps/web/tools/db/fixtures/biome.json`
- Create: `docs/architecture/biome.json`
- Create: `apps/web/tools/db/supabase-history-replay-types.ts`
- Create: `apps/web/tools/db/supabase-history-replay-manifest.ts`
- Create: `apps/web/tools/db/supabase-history-replay-manifest.test.ts`
- Create: `apps/web/tools/db/read-git-object-bytes.ts`
- Create: `apps/web/tools/db/read-git-object-bytes.test.ts`
- Create: `apps/web/tools/db/read-bound-replay-receipt.ts`
- Create: `apps/web/tools/db/read-bound-replay-receipt.test.ts`
- Create: `apps/web/tools/db/build-verified-replay-source-hashes.ts`
- Create: `apps/web/tools/db/build-verified-replay-source-hashes.test.ts`
- Create: `apps/web/tools/db/verify-supabase-history-replay-manifest.ts`
- Create: `apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts`
- Create: `apps/web/tools/db/verify-supabase-history-replay-receipts.ts`
- Create: `apps/web/tools/db/verify-supabase-history-replay-receipts.test.ts`
- Create: `apps/web/tools/db/schemas/production-effect-provenance-schema.ts`
- Create: `apps/web/tools/db/schemas/production-effect-provenance-schema.test.ts`
- Create: `apps/web/tools/db/schemas/migration-name-alias-deploy-repair-schema.ts`
- Create: `apps/web/tools/db/schemas/migration-name-alias-deploy-repair-schema.test.ts`
- Create: `apps/web/tools/db/canonical-replay-fixture-json.ts`
- Create: `apps/web/tools/db/canonical-replay-fixture-json.test.ts`
- Create: `apps/web/tools/db/fixtures/production-effect-provenance.json`
- Create: `apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json`
- Create: `supabase/tests/migration_history_overlays/20260525140048_quiz_authoritative_answer_scoring.sql`
- Modify: `apps/web/src/lib/domain-event-pipeline-migration.test.ts`
- Modify: `docs/architecture/durable-event-pipeline-p0-path-inventory.md`
- Modify: `docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md`

**Produces:** `supabaseHistoryReplayManifest` and `verifySupabaseHistoryReplayManifest(workspaceRoot,{ pendingRepairState }: { pendingRepairState: 'not-materialized' | 'materialized' }): Promise<VerifiedReplayManifest>`. The discriminant is required; filesystem auto-detection is forbidden.

- [ ] **Step 1: Write failing manifest tests**

Tests assert the frozen base, bootstrap count/path/hash, exactly one transform, exact source/output hashes, both duplicate groups, all 17 mappings/hashes, all 26 #3077 files/hashes, #3098/#3099/#3107/#3117/#3121/#3120 evidence, repair path/hash, the bound canonical production-effect provenance SHA-256 and exceptional-record count, every primary run/job/head/log-digest source in that fixture, every `replayConstraints` relation, and rejection of owner-body, evidence, or constraint drift. A separate strict alias-receipt test binds SHA-256 `ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade`, the failed/successful run and job ids, the exact old/new names, `already-applied-no-ledger-write`, and exclusion from production-effect exceptional records. The migration contract test adds the missing `20260713113000_preserve_delivery_context_in_domain_events.sql` and `20260713205000_separate_delivery_replay_attempt_budget.sql`, bringing its immutable inventory to 26. The strict schemas and canonical compact JSON fixtures are created here with `apply_patch`; Task 3 independently reproduces/compares them but does not become their first owner.

The bootstrap receipt byte contract is exact: list only top-level `supabase/migrations/*.sql` paths at frozen base `9e3d1b14b1931a5e441fc23f0e5417c188056e47`; sort full repository paths with `LC_ALL=C`; retain the first 125 through the named tail; for each emit `<filename-without-supabase/migrations/><TAB><SHA-256-of-git-show-body><LF>`; concatenate without a header or extra blank line; hash those bytes. The manifest test reproduces this command and requires 125 lines, the exact tail/body hash, and receipt `06e17f84a563e147b290e90a307d269518d73d6452013fbe87570ee0fa70680e`:

```bash
set -euo pipefail
git ls-tree -r --name-only 9e3d1b14b1931a5e441fc23f0e5417c188056e47 -- supabase/migrations |
  rg '^supabase/migrations/[^/]+[.]sql$' | LC_ALL=C sort |
  awk '$0 <= "supabase/migrations/20260525060558_normalize_ogabassey_encoded_blog_slug.sql"' |
  while IFS= read -r migration_path; do
    migration_file="${migration_path#supabase/migrations/}"
    printf '%s\t%s\n' "$migration_file" \
      "$(git show "9e3d1b14b1931a5e441fc23f0e5417c188056e47:$migration_path" |
        shasum -a 256 | awk '{print $1}')"
  done | shasum -a 256
```

```bash
set -euo pipefail
if pnpm --filter @baci/web exec vitest run \
  tools/db/schemas/production-effect-provenance-schema.test.ts \
  tools/db/schemas/migration-name-alias-deploy-repair-schema.test.ts \
  tools/db/canonical-replay-fixture-json.test.ts \
  tools/db/supabase-history-replay-manifest.test.ts \
  tools/db/read-git-object-bytes.test.ts \
  tools/db/read-bound-replay-receipt.test.ts \
  tools/db/build-verified-replay-source-hashes.test.ts \
  tools/db/verify-supabase-history-replay-receipts.test.ts \
  tools/db/verify-supabase-history-replay-manifest.test.ts \
  src/lib/domain-event-pipeline-migration.test.ts; then
  echo 'expected replay-manifest tests to fail before implementation' >&2
  exit 1
fi
```

Expected: FAIL because the manifest and verifier do not exist and the current migration contract has only 24 paths.

- [ ] **Step 2: Add the replay-only transform recipe**

The overlay file is a short, non-standalone replay fixture so the finished touched tree remains below 300 lines:

```sql
-- replay-only-transform
-- original-sha256: 2b1ebac0ab9514d5b6c91e0ebf4543e3470b9fa71b0a80ab0746c9cccc9a4c41
-- output-sha256: 6f6444120e4cefe5febaba935ea70e7a304bf2d330702afc838d4ab70a77b9d8
-- search: pg_catalog.extract(epoch FROM (pg_catalog.now() - v_issued_at))
-- replacement: extract(epoch FROM (pg_catalog.now() - v_issued_at))
```

The verifier requires exactly one search occurrence, applies the replacement in memory, and hashes the complete materialized SQL to the frozen output hash. It never modifies the historical migration.

The root `biome.json` is already 315 lines and P0 may not touch it while leaving it over the V4 modularity limit. Keep it byte-unchanged and create two small nested Biome configs using the supported `"extends":"//"` inheritance. Each nested config contains one exact-path override with `formatter.enabled=false`; together they cover only these canonical compact generated/receipt files:

```text
apps/web/tools/db/fixtures/production-effect-provenance.json
apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json
apps/web/tools/db/fixtures/linked-migration-ledger.json
apps/web/tools/db/fixtures/production-history-effects.json
docs/architecture/durable-event-pipeline-p0-chronological-receipt.json
docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json
```

`apps/web/tools/db/fixtures/biome.json` is exactly:

```json
{
  "root": false,
  "extends": "//",
  "overrides": [
    {
      "includes": [
        "production-effect-provenance.json",
        "migration-name-alias-deploy-repair.json",
        "linked-migration-ledger.json",
        "production-history-effects.json"
      ],
      "formatter": { "enabled": false }
    }
  ]
}
```

`docs/architecture/biome.json` is exactly:

```json
{
  "root": false,
  "extends": "//",
  "overrides": [
    {
      "includes": [
        "durable-event-pipeline-p0-chronological-receipt.json",
        "durable-event-pipeline-p0-production-effect-receipt.json"
      ],
      "formatter": { "enabled": false }
    }
  ]
}
```

The first config initially lives beside the four planned tools fixtures and names only their basenames; Task 3 appends only the structured semantic-lines fixture basename. The second lives in `docs/architecture` and names only the two receipt basenames. Neither config disables its whole directory. The overrides preserve the byte-bound single-line canonical JSON and do not disable parsing or linting, exclude a directory/glob, modify the 315-line root config, or affect any other JSON. `biome check` must accept both nested configs and the two Task 2 fixtures without rewriting them; their exact SHA-256 bindings remain the source of truth.

- [ ] **Step 3: Implement the manifest and pre-I/O verifier**

`supabase-history-replay-manifest.ts` is thin: it owns scalar/path/hash constants and transformation/mapping metadata, while the canonical compact JSON fixture is the sole owner of the large `evidenceSources`, `exceptionalRecords`, and `replayConstraints` payload. To preserve the hard 300-line modularity boundary, bounded receipt reading lives in `read-bound-replay-receipt.ts`, exact source-hash construction lives in `build-verified-replay-source-hashes.ts`, receipt/schema/cross-reference verification lives in `verify-supabase-history-replay-receipts.ts`, and byte-exact argv-safe Git blob reads live in `read-git-object-bytes.ts`; every helper has a colocated test and is listed explicitly in the focused gate/staging manifest. The public verifier reads the fixture through those utilities, validates it through the strict `tools/db/schemas` schema, reserializes it canonically, and checks its bound hash before using it; no giant TypeScript object/string duplicates or hides the receipt. `verifySupabaseHistoryReplayManifest(workspaceRoot,{pendingRepairState})` checks every current-tree source against `git show "$BASE_SHA:$REPOSITORY_PATH"` before any Supabase/Docker/network call; the repair and transform recipe are the only base-external paths. Task 2 invokes the explicit `pendingRepairState:'not-materialized'`: the pending record must be `applied:null`, the future path must be absent, and only its exact planned path/body/hash are bound. If a file already exists there, even with different bytes, this state fails. After Task 4 writes the migration, every runner uses `pendingRepairState:'materialized'`, which requires the file and exact hash and may never silently omit it. With no live-ledger or network input in Task 2, the verifier rejects an unknown/extra linked mapping inside the frozen provenance/manifest, validates every linked-field cross-reference, rejects a duplicate without an explicit relation, and rejects any other missing file, non-hex hash, source hash mismatch, transform count other than one, materialized transform hash mismatch, applied exceptional record without exact primary run/job/head/log-digest/`logOrdinal` evidence, invalid `jobConclusion`, corroboration carrying an invented ordinal, or provenance hash/count different from the already-frozen final values. Task 3 owns rejection of an unknown live linked-ledger row after capture. Task 2 performs no production/network I/O and does not infer or assert a total historical application order.

- [ ] **Step 4: Verify green and commit**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  tools/db/schemas/production-effect-provenance-schema.test.ts \
  tools/db/schemas/migration-name-alias-deploy-repair-schema.test.ts \
  tools/db/canonical-replay-fixture-json.test.ts \
  tools/db/supabase-history-replay-manifest.test.ts \
  tools/db/read-git-object-bytes.test.ts \
  tools/db/read-bound-replay-receipt.test.ts \
  tools/db/build-verified-replay-source-hashes.test.ts \
  tools/db/verify-supabase-history-replay-receipts.test.ts \
  tools/db/verify-supabase-history-replay-manifest.test.ts \
  src/lib/domain-event-pipeline-migration.test.ts
pnpm exec biome check apps/web/tools/db/fixtures/biome.json \
  docs/architecture/biome.json \
  apps/web/tools/db/fixtures/production-effect-provenance.json \
  apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json
git diff --check
typeset -a task2_paths=(
  apps/web/tools/db/fixtures/biome.json
  docs/architecture/biome.json
  apps/web/tools/db/supabase-history-replay-types.ts
  apps/web/tools/db/supabase-history-replay-manifest.ts
  apps/web/tools/db/supabase-history-replay-manifest.test.ts
  apps/web/tools/db/read-git-object-bytes.ts
  apps/web/tools/db/read-git-object-bytes.test.ts
  apps/web/tools/db/read-bound-replay-receipt.ts
  apps/web/tools/db/read-bound-replay-receipt.test.ts
  apps/web/tools/db/build-verified-replay-source-hashes.ts
  apps/web/tools/db/build-verified-replay-source-hashes.test.ts
  apps/web/tools/db/verify-supabase-history-replay-manifest.ts
  apps/web/tools/db/verify-supabase-history-replay-manifest.test.ts
  apps/web/tools/db/verify-supabase-history-replay-receipts.ts
  apps/web/tools/db/verify-supabase-history-replay-receipts.test.ts
  apps/web/tools/db/schemas/production-effect-provenance-schema.ts
  apps/web/tools/db/schemas/production-effect-provenance-schema.test.ts
  apps/web/tools/db/schemas/migration-name-alias-deploy-repair-schema.ts
  apps/web/tools/db/schemas/migration-name-alias-deploy-repair-schema.test.ts
  apps/web/tools/db/canonical-replay-fixture-json.ts
  apps/web/tools/db/canonical-replay-fixture-json.test.ts
  apps/web/tools/db/fixtures/production-effect-provenance.json
  apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json
  apps/web/src/lib/domain-event-pipeline-migration.test.ts
  docs/architecture/durable-event-pipeline-p0-path-inventory.md
  docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
  supabase/tests/migration_history_overlays/20260525140048_quiz_authoritative_answer_scoring.sql
)
git add -- "${task2_paths[@]}"
test "$(git diff --cached --name-only | LC_ALL=C sort)" = \
  "$(printf '%s\n' "${task2_paths[@]}" | LC_ALL=C sort -u)"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "test: freeze Supabase history replay manifest"
```

Expected: all focused tests pass; no historical migration is changed.

---

### Receipt-regeneration checkpoint after Task 2

**Files:**
- Modify: `docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md`

**Produces:** A reviewed exact-main receipt for #3124 without changing the immutable V4 contract or any Task 3 implementation file.

This checkpoint is mandatory because `origin/main` advanced after Task 2. The committed branch graph entering it is exact: Task 1 `8f6968f73d`, prior-main merge `e9234b8dfb`, Task 2 `19c3690b8f`, and Task 2 remediation `f5f5554d05`. Task 3 remains uncommitted and must be preserved byte-for-byte while the executable receipt is refreshed.

- [ ] **Step R1: Re-prove the new exact main and unchanged frozen surfaces**

```bash
set -euo pipefail
cd /Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home
test "$(git rev-parse HEAD)" = "f5f5554d0551254fdda271b910bcebeec0975acf"
test "$(shasum -a 256 docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md | awk '{print $1}')" = \
  "3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca"
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "dae4e734f747717654125a16c1527b7f6366ce87"
test "$(git rev-parse origin/main^)" = "4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0"
test "$(git rev-parse origin/main^^)" = "9e3d1b14b1931a5e441fc23f0e5417c188056e47"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'4\t1'
git diff --cached --quiet
git diff --quiet 4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0 \
  dae4e734f747717654125a16c1527b7f6366ce87 -- supabase/migrations
typeset -a frozen_p0_prefixes=(
  .ruler/01-critical-rules.md AGENTS.md CLAUDE.md biome.json
  .github/workflows/deploy.yml .github/workflows/ci.yml
  .github/scripts/apply-pending-migrations.sh
  .github/scripts/apply-pending-migrations.test.sh
  .github/scripts/check-migration-versions.sh
  .github/scripts/check-migration-versions.test.sh
  .github/scripts/split-sql-statements.mjs
  .github/scripts/split-sql-statements.test.mjs
  .github/scripts/resolve-ci-test-plan-config.test.mjs
  .github/scripts/tools-worker-typecheck-contract.test.mjs
  apps/web/src/app/api/admin/event-pipeline apps/web/src/app/api/analytics
  apps/web/src/app/api/events apps/web/src/app/api/platform/events
  apps/web/src/lib/analytics apps/web/src/lib/events apps/web/src/lib/payments
  apps/web/src/lib/supabase apps/web/src/lib/merchant-feature-gates.ts
  apps/web/src/lib/merchant-feature-gates.test.ts
  apps/web/src/lib/merchant-has-feature.ts
  apps/web/src/lib/merchant-has-feature.test.ts
  apps/web/src/lib/domain-event-pipeline-migration.test.ts
  apps/web/src/lib/offline-conversions.ts
  apps/web/src/lib/server-side-analytics.ts
  apps/web/src/lib/trigger-purchase-conversion.ts
  apps/web/src/lib/trigger-purchase-conversion.test.ts
  apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts
  apps/web/src/scripts/process-domain-events.ts
  apps/web/src/scripts/process-domain-events.test.ts
  apps/web/src/scripts/process-event-deliveries.ts
  apps/web/src/scripts/process-event-deliveries.test.ts
  apps/web/src/schemas/event-dead-letter.ts
  apps/web/src/types/supabase.ts apps/web/tools/db apps/web/tools/events
  supabase/migrations/tests supabase/tests/migration_history_overlays
  supabase/tests/domain_event_pipeline.sql
  supabase/tests/domain_event_ingress_pipeline.sql
  supabase/tests/event_delivery_pipeline.sql vps-workers
)
git diff --quiet 4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0 \
  dae4e734f747717654125a16c1527b7f6366ce87 -- "${frozen_p0_prefixes[@]}"
gh api repos/ogabasseyy/Baci/commits/dae4e734f747717654125a16c1527b7f6366ce87 \
  --jq 'select(.commit.verification.verified == true and
    .commit.verification.reason == "valid" and
    (.parents | length) == 1 and
    .parents[0].sha == "4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0") | .sha' |
  rg -qx dae4e734f747717654125a16c1527b7f6366ce87
gh run view 29507413915 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "dae4e734f747717654125a16c1527b7f6366ce87" and
  .status == "completed" and .conclusion == "success" and
  any(.jobs[]; .databaseId == 87651680060 and .name == "db-migrations" and
    .status == "completed" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87651680075 and .name == "changes" and
    .status == "completed" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87651744254 and .name == "deploy-production" and
    .status == "completed" and .conclusion == "skipped")'
current_main_semantic_log="$(LC_ALL=C gh run view 29507413915 --job 87651680060 --log |
  LC_ALL=C awk '
    { line=$0; best=0 }
    { for (i=1; i<=4; i++) { p=index(line, markers[i]); if (p && (!best || p<best)) best=p } }
    best { print substr(line,best) }
    BEGIN {
      markers[1]="→ applying:"; markers[2]="✓ applied:";
      markers[3]="✓ already applied:"; markers[4]="Migrations summary:"
    }')"
test "$(printf '%s\n' "$current_main_semantic_log" | shasum -a 256 | awk '{print $1}')" = \
  "57d230a7a72b001b5462dd993376c8e0c2f5a0943b3170a2110194d63d777c7c"
printf '%s\n' "$current_main_semantic_log" |
  rg -qx 'Migrations summary: 0 applied, 424 skipped.'
gh run view 29507418729 --json headSha,status,conclusion | jq -e '
  .headSha == "dae4e734f747717654125a16c1527b7f6366ce87" and
  .status == "completed" and .conclusion == "success"'
```

Expected: #3124 is a verified signed child of #3123; its exact ten-path mobile-storefront diff leaves the migration and frozen P0 surfaces unchanged; the database job is a no-op with the reviewed semantic digest; the web deploy is path-filtered; and the exact-main CI Quality Gate is green. The refreshed open-lane audit still requires PRs #2686/#2928/#2958/#3024 open with migration counts `0/0/0/17`, no path or timestamp collision, and the unchanged #3024 digest `c7c43af3103d291a40c745bc8742e8094d82dcce60bc7cf90f6a97eb8c342137`.

- [ ] **Step R2: Review and commit only the refreshed executable receipt**

```bash
set -euo pipefail
git diff --check
git add docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
test "$(git diff --cached --name-only)" = \
  "docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md"
git restore --staged -- docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
set +e
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit_output="$(coderabbit review --prompt-only -t uncommitted \
    --dir docs/superpowers/plans 2>&1)"
  coderabbit_status=$?
else
  coderabbit_output="$(coderabbit review --agent -t uncommitted \
    --dir docs/superpowers/plans 2>&1)"
  coderabbit_status=$?
fi
set -e
printf '%s\n' "$coderabbit_output"
if (( coderabbit_status != 0 )); then
  printf '%s\n' "$coderabbit_output" |
    rg -q 'Review failed: No files to review' ||
    exit "$coderabbit_status"
fi
git add docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md
test "$(git diff --cached --name-only)" = \
  "docs/superpowers/plans/2026-07-14-ogabassey-home-p0-post-3077-recovery.md"
git commit -m "docs: refresh event pipeline recovery receipt"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'5\t1'
```

Expected: the immutable V4 document and every Task 3 file remain unstaged. CodeRabbit may explicitly report `No files to review` for the Markdown-only directory; that narrow tool limitation is acceptable only after a separate fresh blocker-only plan review returns clean. Any other CodeRabbit failure or any review blocker stops the commit.

- [ ] **Step R3: Merge exact #3124 normally and restore the Task 3 gate**

```bash
set -euo pipefail
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "dae4e734f747717654125a16c1527b7f6366ce87"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'5\t1'
git merge --no-edit origin/main
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'6\t0'
test "$(git rev-list --count --merges origin/main..HEAD)" = "2"
git merge-base --is-ancestor dae4e734f747717654125a16c1527b7f6366ce87 HEAD
git merge-base --is-ancestor 4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0 HEAD
git merge-base --is-ancestor 9e3d1b14b1931a5e441fc23f0e5417c188056e47 HEAD
git diff --check
```

Expected: a second normal integration merge, no conflict, no rebase, no force-push, and the uncommitted Task 3 implementation preserved exactly for its own review and commit.

---

### Task 3: Implement disposable chronological and production-effect replay

**Files:**
- Create: `apps/web/tools/db/run-replay-command.ts`
- Create: `apps/web/tools/db/run-replay-command.test.ts`
- Create: `apps/web/tools/db/supabase-replay-contract.ts`
- Create: `apps/web/tools/db/supabase-replay-contract.test.ts`
- Create: `apps/web/tools/db/replay-repository-root.ts`
- Create: `apps/web/tools/db/replay-repository-root.test.ts`
- Create: `apps/web/tools/db/allocate-supabase-replay-ports.ts`
- Create: `apps/web/tools/db/allocate-supabase-replay-ports.test.ts`
- Create: `apps/web/tools/db/rewrite-supabase-replay-config.ts`
- Create: `apps/web/tools/db/rewrite-supabase-replay-config.test.ts`
- Create: `apps/web/tools/db/replay-project-ownership.ts`
- Create: `apps/web/tools/db/replay-project-ownership.test.ts`
- Create: `apps/web/tools/db/supabase-replay-expected-resources.ts`
- Create: `apps/web/tools/db/supabase-replay-expected-resources.test.ts`
- Create: `apps/web/tools/db/parse-supabase-migration-list.ts`
- Create: `apps/web/tools/db/parse-supabase-migration-list.test.ts`
- Create: `apps/web/tools/db/schemas/linked-migration-ledger-schema.ts`
- Create: `apps/web/tools/db/schemas/linked-migration-ledger-schema.test.ts`
- Create: `apps/web/tools/db/schemas/production-history-effects-schema.ts`
- Create: `apps/web/tools/db/schemas/production-history-effects-schema.test.ts`
- Create: `apps/web/tools/db/schemas/github-migration-semantic-lines-schema.ts`
- Create: `apps/web/tools/db/schemas/github-migration-semantic-lines-schema.test.ts`
- Create: `apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.ts`
- Create: `apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.test.ts`
- Create: `apps/web/tools/db/canonical-json-value.ts`
- Create: `apps/web/tools/db/canonical-json-value.test.ts`
- Modify: `apps/web/tools/db/canonical-replay-fixture-json.ts`
- Modify: `apps/web/tools/db/canonical-replay-fixture-json.test.ts`
- Create: `apps/web/tools/db/canonical-replay-effect-json.ts`
- Create: `apps/web/tools/db/canonical-replay-effect-json.test.ts`
- Create: `apps/web/tools/db/capture-supabase-history-ledger.ts`
- Create: `apps/web/tools/db/capture-supabase-history-ledger.test.ts`
- Create: `apps/web/tools/db/extract-github-migration-semantic-lines.ts`
- Create: `apps/web/tools/db/extract-github-migration-semantic-lines.test.ts`
- Create: `apps/web/tools/db/parse-github-migration-job-log.ts`
- Create: `apps/web/tools/db/parse-github-migration-job-log.test.ts`
- Create: `apps/web/tools/db/capture-production-effect-provenance.ts`
- Create: `apps/web/tools/db/capture-production-effect-provenance.test.ts`
- Create: `apps/web/tools/db/materialize-supabase-history-replay.ts`
- Create: `apps/web/tools/db/materialize-supabase-history-replay.test.ts`
- Create: `apps/web/tools/db/read-supabase-history-effects.ts`
- Create: `apps/web/tools/db/read-supabase-history-effects.test.ts`
- Create: `apps/web/tools/db/supabase-history-effects.sql`
- Create: `apps/web/tools/db/supabase-history-effects.test.ts`
- Create: `apps/web/tools/db/replay-module-boundaries.test.ts`
- Create: `apps/web/tools/db/fixtures/linked-migration-ledger.json`
- Create: `apps/web/tools/db/fixtures/production-history-effects.json`
- Create: `apps/web/tools/db/fixtures/github-migration-semantic-lines.json`
- Modify: `apps/web/tools/db/fixtures/biome.json`
- Create: `apps/web/tools/db/run-supabase-history-replay.ts`
- Create: `apps/web/tools/db/run-supabase-history-replay.test.ts`
- Create: `apps/web/tsconfig.tools-workers.json`
- Modify: `apps/web/package.json`

**Consumes:** The verified manifest from Task 2.

**Produces:** `runSupabaseHistoryReplay(options): Promise<ReplayReceipt>`, a CLI with `--mode`, required `--pending-repair-state`, repeatable `--sql-check`, `--types-output`, and `--receipt-output`; canonical linked-ledger and production-effect fixtures; and one structured offline fixture reproducing all 24 primary plus two corroboration semantic-log hashes. Normal package scripts pin `--pending-repair-state materialized`; the one red proof before Task 4 pins `not-materialized`. There is no filesystem auto-detection. Task 3 also creates the final-named DB-only `tsconfig.tools-workers.json` and runs it before commit; Task 7 expands that same project to the complete worker/event surface and proves the new modules typecheck before its commit, while Task 8 only wires the already-final project into the normal Quality Gate.

The fixture schemas are exact:

```ts
type LinkedMigrationLedgerFixture = {
  schemaVersion: 1;
  baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47';
  linkedRowCount: 439;
  linkedTailVersion: '20260714225500';
  localFileCount: 424;
  localUniqueVersionCount: 422;
  rows: Array<{ version: string; name: string; localPaths: string[]; localSha256: string[] }>;
};
type JobConclusion = 'success' | 'failure_after_applied_entry';
type Corroboration = {
  kind: 'later_success_already_applied';
  deploymentRunId: number;
  databaseJobId: number;
  headSha: string;
  sanitizedJobLogSha256: string;
}; // deliberately no logOrdinal
type EvidenceSource = {
  deploymentRunId: number;
  databaseJobId: number;
  headSha: string;
  sanitizedJobLogSha256: string;
  jobConclusion: JobConclusion;
  corroboration?: Corroboration;
};
type AppliedExceptionalRecord = {
  recordOrdinal: number;
  applied: { version: string; name: string };
  evidence: EvidenceSource & { logOrdinal: number };
  repositoryOwnerPath: string;
  ownerSha256: string;
  linkedLedgerOrdinal?: number;
  linkedVersion?: string;
  linkedName?: string;
  mappingRule: 'canonical' | 'superseded-final-state';
  exceptionalKinds: Array<
    'production_only_mapping' | 'duplicate_version_owner' | 'unique_reapply' |
    'supersession' | 'late_applied'
  >;
};
type PendingRepairRecord = {
  recordOrdinal: 31;
  applied: null;
  linkedLedgerOrdinal: 247;
  linkedProductionOnlyOrdinal: 247;
  linkedVersion: '20260629154903';
  linkedName: 'add_order_fulfillment_timestamps';
  nullReason: 'p0_append_only_repair_not_yet_applied';
  repositoryOwnerPath: 'supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql';
  ownerSha256: '1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361';
  mappingRule: 'append-only-repair';
  exceptionalKinds: ['production_only_mapping'];
};
type IncludedRecord = { logOrdinal: number; recordOrdinal: number };
type PipelineRecord = {
  logOrdinal: number;
  applied: { version: string; name: string };
  repositoryOwnerPath: string;
  ownerSha256: string;
};
type JobGroup = {
  coverage: 'complete-primary-log-group' | 'partial-primary-log-constraint';
  deploymentRunId: number;
  databaseJobId: number;
  observedMigrationEntryCount: number;
  includedRecords?: IncludedRecord[];
  pipelineRecords?: PipelineRecord[];
};
type SyntheticCompanion = {
  version: string;
  name: string;
  repositoryOwnerPath: string;
  ownerSha256: string;
};
type ReplayRelation =
  | {
      kind: 'duplicate-version-companion';
      ownerRecordOrdinal: number;
      replacementRecordOrdinal?: number;
      replayDisposition: 'apply-synthetic-companion-immediately-after-owner' |
        'omit-colliding-body-use-unique-reapply';
      syntheticCompanion: SyntheticCompanion;
    }
  | {
      kind: 'record-before-record';
      beforeRecordOrdinal: number;
      afterRecordOrdinal: number;
      reason: string;
    }
  | {
      kind: 'job-group-before-job-group';
      before: { deploymentRunId: number; databaseJobId: number };
      after: { deploymentRunId: number; databaseJobId: number };
      reason: string;
    };
type ProductionEffectProvenanceFixture = {
  schemaVersion: 4;
  baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47';
  logSanitizer: {
    markers: ['→ applying:', '✓ applied:', '✓ already applied:', 'Migrations summary:'];
    version: 'github-actions-migration-semantic-lines-v1';
  };
  coverage: 'partial-order-effect-replay';
  linkedLedger: { rowCount: 439; tailVersion: '20260714225500' };
  exceptionalRecordCount: 31;
  evidenceSources: EvidenceSource[];
  exceptionalRecords: Array<AppliedExceptionalRecord | PendingRepairRecord>;
  replayConstraints: {
    coverage: 'partial-order-effect-replay';
    registryOrdering: 'repositoryOwnerPath-ascending';
    jobGroups: JobGroup[];
    relations: ReplayRelation[];
  };
};
type ProductionHistoryEffectsFixture = {
  schemaVersion: 1;
  baseSha: '9e3d1b14b1931a5e441fc23f0e5417c188056e47';
  source: {
    kind: 'supabase-management-api-read-only';
    querySha256: string;
    serverVersionNum: 170006;
  };
  scope: {
    version: 'baci-owned-effects-v2';
    ownedSchemas: ['eventing', 'private', 'public'];
    projections: ['extensions', 'pgmq', 'cron-net', 'storage-policies'];
  };
  diagnostics: {
    extensionVersions: Array<{ name: string; schema: string; version: string }>;
  };
  ledger: { rowCount: 439; tailVersion: '20260714225500' };
  effectSha256: string;
  effects: {
    ordersShippedAtTimestamptz: boolean;
    ordersDeliveredAtTimestamptz: boolean;
    customerCancellationColumnsPresent: boolean;
    customerCancellationRpcPresent: boolean;
    customerCancellationTriggerPresent: boolean;
    registerPushTokenSixArgumentRpcPresent: boolean;
    paystackSubaccountConfiguredRpcPresent: boolean;
    hostedQuizProviderFinalRpcPresent: boolean;
    domainEventMigrationObjectCount: number;
    domainEventRpcCount: 19;
    pgmqDomainEventsQueuePresent: boolean;
    everyDomainEventProducerDisabled: boolean;
    anonymousMerchantPublicProjectionRestored: boolean;
    anonymousMerchantSecretProjectionWithheld: boolean;
    anonymousFeatureSettingsBaseReadWithheld: boolean;
  };
};
type GithubMigrationSemanticLinesFixture = {
  schemaVersion: 1;
  sanitizerVersion: 'github-actions-migration-semantic-lines-v1';
  sources: Array<{
    kind: 'primary' | 'corroboration';
    deploymentRunId: number;
    databaseJobId: number;
    sanitizedJobLogSha256: string;
    lines: Array<
      | {
          kind: 'migration';
          marker: '→ applying:' | '✓ applied:' | '✓ already applied:';
          version: string; // strict /^\d{14}$/
          name: string; // strict /^[a-z0-9_]+$/
        }
      | {
          kind: 'summary';
          marker: 'Migrations summary:';
          applied: number; // nonnegative integer
          skipped: number; // nonnegative integer
        }
    >;
  }>;
};
```

Every persisted object above is implemented as a strict Zod schema: unknown keys, wrong discriminants, non-positive ordinals, duplicate `recordOrdinal`, a corroboration `logOrdinal`, and any shape not represented above fail before canonicalization. `canonicalJsonValue` owns recursive object-key sorting, array-order preservation, non-JSON rejection, and exactly one trailing LF. `canonicalReplayFixtureJson` applies the existing credential/raw-log string policy before delegating to that encoder; its bound Task 2 fixture hashes must remain unchanged. `canonicalReplayEffectJson` delegates to the same encoder without the persisted-fixture string restriction, accepts multiline catalog/function bodies, is used only in memory, and never returns raw catalog text in a fixture, receipt, log, or error. Safe schema keys, migration names, and paths containing words such as `token`, `secret`, or `service_role` remain permitted. Green tests cover a multiline PL/pgSQL body plus `register_push_token_rpc`, `anonymousMerchantSecretProjectionWithheld`, and `lock_domain_purchase_rpc_service_role`; red persisted-fixture tests cover real credentials and raw logs.

The semantic-lines fixture is structured rather than raw and uses only the discriminated records above. Migration records reconstruct the exact historical script bytes with no filename punctuation: `→ applying:` plus eight spaces plus `${version}` plus two spaces plus `${name}\n`; `✓ applied:` plus nine spaces plus `${version}` plus two spaces plus `${name}\n`; or `✓ already applied:` plus one space plus `${version}` plus two spaces plus `${name}\n`. A summary reconstructs exactly `Migrations summary: ${applied} applied, ${skipped} skipped.\n`. There is no arbitrary suffix field. After stripping only the transport prefix up to the first reviewed marker, the extractor requires the complete remaining line to match the corresponding exact-spacing grammar and never accepts an underscore or `.sql` suffix. A line containing a marker but failing one of those four full-line grammars fails closed with only source identity and an error code; rejected text is never echoed. The strict schema requires exactly 26 unique run/job sources, cross-references their kind and SHA-256 against the 24 primary plus two corroboration bindings in the Task 2 provenance, rejects duplicate/unknown sources and any raw prefix/log blob, and remains canonical single-line JSON. The first reviewed capture creates this file once; later verification is offline-capable and live `--verify-only` capture compares against it without rewriting it. All checked JSON fixtures and every new/modified Task 3 TypeScript, SQL, and JSON/config file remain at or below 300 physical lines.

- [ ] **Step 1: Write failing unit tests for process safety**

Tests prove command arguments are arrays rather than shell strings; every child uses repository-root `cwd`; stdout and stdin are each capped at 8 MiB and stderr at 256 KiB with incremental byte accounting; and overflow/non-zero errors contain only a sanitized command basename and failure class, never argv, environment, cwd, stdout, stderr, or secret-bearing `--db-url` material. Loopback accepts only `localhost`, `127.0.0.0/8`, and `::1`; the replay owns a unique `project_id` and a dynamically allocated non-default loopback port set; cleanup calls `supabase stop --no-backup --workdir "$REPLAY_WORKDIR"` only after an ownership marker matching that project id and port set is present; and a path outside the owned temp is rejected.

`supabase-replay-contract.test.ts` freezes the complete Task 3 toolchain before Docker, GitHub, Supabase, or database I/O: `process.versions.node` must have major `24`; `pnpm --version` must be exactly `11.7.0`; the workspace-resolved `tsc --version` must be exactly `Version 7.0.2`; the workspace-resolved `tsx --version` must identify exactly `tsx v4.22.4` and Node major `24`; `supabase --version` must be exactly `2.95.4`; and the explicit `PSQL_BIN` must report PostgreSQL `18.3`. Tests inject every version result and prove each mismatch fails independently with only the tool name and expected/observed version class, never a command line or environment.

The port-map identity is always section-qualified. Supabase CLI 2.95.4 must expose exactly the enabled generated keys `api.port`, `db.port`, `db.shadow_port`, `studio.port`, `inbucket.port`, `edge_runtime.inspector_port`, and `analytics.port`; repeated bare names across sections are valid, while duplicate qualified keys, enabled unknown service-port keys, disabled `db.pooler.port`, and commented SMTP/POP3 examples fail or remain excluded as appropriate. A dependency-injected network fixture marks all seven defaults occupied, uses real temporary loopback listeners for chosen test candidates, and replaces Supabase/Docker commands with an argv-recording test double. It proves the replay selects a disjoint free set; rejects any pre-existing exact-project container/volume/network label; requires the config-derived expected resources after a successful start; targets only its owned workdir/project during start/stop; permits cleanup of a correctly labeled/name-patterned partial subset after a failed start because pre-start emptiness proves ownership; rejects mislabeled or wrong-prefix objects; never closes or rewrites an unrelated listener/project; and never logs or persists the secret-bearing status environment. This red/green unit gate needs no Docker; the first real Task 4 replay is the live integration proof.

After the tests exist and before any implementation, run the exact red set:

```bash
set -euo pipefail
if pnpm --filter @baci/web exec vitest run \
  tools/db/run-replay-command.test.ts \
  tools/db/supabase-replay-contract.test.ts \
  tools/db/replay-repository-root.test.ts \
  tools/db/allocate-supabase-replay-ports.test.ts \
  tools/db/rewrite-supabase-replay-config.test.ts \
  tools/db/replay-project-ownership.test.ts \
  tools/db/supabase-replay-expected-resources.test.ts \
  tools/db/parse-supabase-migration-list.test.ts \
  tools/db/schemas/linked-migration-ledger-schema.test.ts \
  tools/db/schemas/production-history-effects-schema.test.ts \
  tools/db/schemas/github-migration-semantic-lines-schema.test.ts \
  tools/db/schemas/supabase-history-effect-snapshot-schema.test.ts \
  tools/db/canonical-json-value.test.ts \
  tools/db/canonical-replay-fixture-json.test.ts \
  tools/db/canonical-replay-effect-json.test.ts \
  tools/db/capture-supabase-history-ledger.test.ts \
  tools/db/extract-github-migration-semantic-lines.test.ts \
  tools/db/parse-github-migration-job-log.test.ts \
  tools/db/capture-production-effect-provenance.test.ts \
  tools/db/materialize-supabase-history-replay.test.ts \
  tools/db/read-supabase-history-effects.test.ts \
  tools/db/supabase-history-effects.test.ts \
  tools/db/replay-module-boundaries.test.ts \
  tools/db/run-supabase-history-replay.test.ts; then
  echo 'expected replay tests to fail before implementation' >&2
  exit 1
fi
```

Expected red: failures name the missing bounded argv executor, exact Node/pnpm/tsc/tsx/Supabase/psql toolchain and root contract, strict fixture/effect validators, section-qualified owned-project/port allocator, structural config rewriter, ownership receipt, strict discriminated semantic extractor, stable topological materializer, and replay orchestrator. The module-boundary test also freezes the complete Task 3 multi-extension 300-line ceiling. A failure caused only by a typo, missing test import, unavailable test runner, Docker outage, or network access does not count as red; fix the harness and rerun until assertions fail for the intended missing behavior.

- [ ] **Step 2: Write failing sequence tests**

Tests prove chronological order is version then filename and includes both physical duplicates. Production-effect replay starts from the same deterministic chronological registry, then applies only the hash-bound exceptional splices and partial-order constraints. Every mapping references and moves an existing verified owner node rather than duplicating its SQL body. A stable topological sort rejects cycles/unknown nodes and uses `repositoryOwnerPath` ascending only as the tie-break between unconstrained nodes. Complete job groups constrain every observed entry in that group; partial job groups constrain only their listed records and never imply the position of omitted log entries. The synthetic cancellation companion is supplied only by `replayConstraints.relations`, immediately after owner record 1 and outside the 31 evidence records. The colliding quiz body is omitted and record 19's unique reapply is used exactly as its relation directs. Superseded mappings replay only the frozen final-state owner, late-applied #3120 is record 30, and pending repair record 31 is inserted at its deterministic splice without evidence. Tests require unique contiguous 1-based `recordOrdinal`, positive per-job `logOrdinal`, exact run/job/head/semantic-log/owner hashes for each applied exception, both valid `jobConclusion` paths, no ordinal on `later_success_already_applied`, exactly one evidence-free pending repair, all required constraint/classification shapes, the exact v4 `logSanitizer`, exact canonical provenance bytes matching `2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0`, and byte-for-byte reconstruction of all 26 semantic hashes from strict discriminated records under both API-download and `gh run view` prefix formats. Red cases cover one missing or extra historical alignment space for each marker, any invented underscore or `.sql`, a non-14-digit version, an uppercase/hyphenated name, summary punctuation/pluralization drift, negative/fractional counts, trailing text, and any old `suffix` key; failures never echo rejected text. They also prove the result is a deterministic effect replay, not a claimed total historical order. Both modes bootstrap exactly 125 files, require `supabase_migrations.schema_migrations` to equal those exact 125 ordered `(version,name)` rows with no missing, extra, duplicate, renamed, malformed, or reordered row, use `"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -f "$SQL_PATH"` for every later body, and never wrap top-level `CONCURRENTLY` in a transaction.

- [ ] **Step 3: Implement the local runner**

The runner performs this exact order:

1. derive the canonical repository root through `replayRepositoryRoot(import.meta.dirname) = resolve(import.meta.dirname, '../../../..')`, verify the manifest there under the explicit pending-repair state, and verify the frozen toolchain contract before any external I/O: Node major `24`, pnpm `11.7.0`, workspace TypeScript `7.0.2`, workspace tsx `4.22.4`, Supabase CLI `2.95.4`, and `PSQL_BIN=${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}` reporting exactly PostgreSQL `18.3`. Docker must exist only after those checks pass. The executor may override `PSQL_BIN` with another explicit PostgreSQL 18.3 binary, but never depends on `psql` being on `PATH`; `tsc` and `tsx` are resolved from the workspace rather than a global install. `not-materialized` requires the repair path absent and excludes only record 31; `materialized` requires its exact bytes;
2. require `docker info` success;
3. create `REPLAY_WORKDIR` with `mkdtemp`, derive a collision-resistant `project_id` from the owned temp basename plus random bytes, require zero pre-existing Docker containers, volumes, **and networks** with exact label `com.supabase.cli.project=$PROJECT_ID`, persist that pre-start-empty fact in the in-memory ownership state/marker, and run `supabase init --workdir "$REPLAY_WORKDIR"` before attempting port allocation;
4. pass the generated config through the dependency-free `rewriteSupabaseReplayConfig` section/assignment parser. Require `[db].major_version = 17` and exactly the seven enabled section-qualified numeric keys `api.port`, `db.port`, `db.shadow_port`, `studio.port`, `inbucket.port`, `edge_runtime.inspector_port`, and `analytics.port`; allocate that qualified key set from a disjoint free loopback range, set the unique project id, rewrite those values, and only then write the ownership marker containing the canonical workdir, project id, original config hash, rewritten config hash, and complete qualified port map. Supabase CLI 2.95.4's enabled `[storage.s3_protocol]` has no independent port and deliberately shares the API port, so no synthetic S3 port is invented. The parser preserves unrelated bytes/comments, permits repeated bare `port` keys only across different sections, ignores disabled pooler and commented SMTP/POP3 examples, and rejects duplicate qualified keys, malformed sections, nonnumeric active assignments, missing/unknown enabled service-port keys, or any rewritten value left at its default/outside the owned map;
5. re-probe the complete port map immediately before start; if a race is detected, allocate a new map, rewrite from the still-in-memory original config bytes whose hash—not contents—is stored in the marker, and atomically replace the config plus marker rather than stealing a port; then copy only the 125 bootstrap migrations into `$REPLAY_WORKDIR/supabase/migrations`;
6. run `supabase db start --workdir "$REPLAY_WORKDIR"` followed by `supabase migration up --local --workdir "$REPLAY_WORKDIR"` without `--include-all`; `supabase db reset` and full-stack `supabase start` are forbidden. The unique project start applies the 125 bound bootstrap migrations, while migration-up is only a deterministic no-op/ensure boundary and must not conceal an earlier history gap;
7. after a successful healthy start, capture `supabase status --workdir "$REPLAY_WORKDIR" -o env` in memory, parse only the database URL, require its loopback host and port to equal the owned `db.port`, then discard the full secret-bearing environment without logging or persisting it. Before source 126, query `supabase_migrations.schema_migrations` read-only and require exact ordered equality with all 125 bound `(version,name)` rows; any missing, extra, duplicate, renamed, malformed, or reordered row aborts and cleans up. The recovery plan's DB-only steady-state resource contract supersedes the former full-stack expectation: only the exact owned database container, database volume, and network are ready resources; bounded service bootstrap jobs may appear only during the initial `db start` and must not survive cleanup. Independently list/inspect **all** Docker containers, volumes, and networks filtered by exact label `com.supabase.cli.project=$PROJECT_ID`; after healthy start require the exact config-derived DB-only resource set, exact labels, database container name/image, and `SHOW server_version_num` exactly `170006`. This exact set is readiness only, not cleanup authority. **Register, but do not yet execute,** the outer `finally`: the same-process marker's pre-start-empty proof authorizes `supabase stop --no-backup --workdir "$REPLAY_WORKDIR"` even after a partial start. Record any exact-label/wrong-name/image/server anomaly as a terminal verification error, but the registered cleanup executes only after steps 8-12 complete or immediately on a failure;
8. materialize each remaining verified body into the owned temp and apply it with fail-fast `"$PSQL_BIN"` outside a wrapper transaction;
9. execute each repeatable SQL check with the same `"$PSQL_BIN"` flags;
10. reassert local `server_version_num=170006`, require the captured production fixture to bind the same value, and only then query `supabase-history-effects.sql`; validate the strict Baci-owned snapshot/projection schema, canonicalize the in-memory value with `canonicalReplayEffectJson`, SHA-256 it, retain only the safe summary/hash, and discard the raw catalog snapshot. No deparser-derived local/production value may be compared when either version preflight is absent or different;
11. when `--types-output` is present, run `supabase gen types typescript --db-url "$LOCAL_DATABASE_URL" --schema public` and atomically replace only that path;
12. write a secret-free create-only receipt;
13. execute the registered outer `finally`: stop only the owned project with `--no-backup`; use a nested `finally` so cleanup still runs after an ownership anomaly; require zero containers, volumes, and networks with the exact owned label; surface any recorded anomaly/cleanup failure; leave every other project untouched; and remove only the owned temp. The local database must remain running throughout steps 8-12.

`runReplayCommand` uses `spawn` with `shell:false`, argv arrays, incremental 8 MiB stdout/stdin and 256 KiB stderr limits, and sanitized failures that never echo argv/environment/cwd/output. Every command receives the canonical repository root as `cwd`; package-script working directory does not change any `supabase/...`, `apps/...`, or `docs/...` argument. Unit tests invoke the CLI contract from the package root and an unrelated cwd and require identical resolved paths.

- [ ] **Step 4: Implement exact effect coverage**

`supabase-history-effects.sql` returns one strict `scopeVersion:'baci-owned-effects-v2'` JSON object. The direct catalog scope is exactly the Baci-owned schemas `public`, `private`, and `eventing`; it does not use a negative namespace predicate. Within those three schemas cover schemas, enums and domains, sequence definitions without mutable counter state, view and materialized-view definitions without rows, tables/columns/defaults/nullability, constraints, indexes, functions with identity arguments/result/language/volatility/security/sorted config/body, RLS/forced-RLS, policies with sorted roles, table/column/function grants, triggers, and the public RPC type surface. Include the existence/config shape of Baci's `domain_event_producer_config`, never runtime counters, timestamps, object OIDs, or volatile table data rows.

Dependencies outside those schemas are represented only through four separately typed, normalized projections derived from explicit identities owned or referenced by the frozen Baci migration set: (1) installed extension name/schema identities, with extension versions recorded only in the separate diagnostic vector and explicitly excluded from `effectSha256`; (2) Baci-owned PGMQ queue identities, normalized queue configuration, wrapper/grant contract, and no message/archive contents or generic PGMQ implementation tables/functions; (3) Baci-owned `pg_cron`/`pg_net` integration identities and stable configuration, storing only normalized identifiers plus secret-free definition hashes and never generic cron/net rows, request/response history, credentials, or extension internals; and (4) only the exact Baci-owned policies on Supabase storage relations, normalized by relation/command/roles/qualifier/check expression, without hashing storage tables, buckets/objects, data, grants, functions, or other managed policies. The schema rejects an integration identity absent from the reviewed allowlist. Generic Supabase-managed `auth`, `storage`, `realtime`, `graphql`, `vault`, `cron`, `net`, `pgmq`, extension-owned, and other platform schemas/objects are excluded except for those four narrow projections. Capture and verify-only report extension-version drift diagnostically but do not fail structural equality or incorporate it into the effect hash; tests prove a version-only change leaves `effectSha256` unchanged.

Every JSON array is non-null and explicitly ordered in SQL: owned schemas by schema; enums/domains by schema/name/type; sequences by schema/name; views/materialized views by schema/name/kind; tables and RLS by schema/table; columns by schema/table/ordinal; constraints by schema/table/name/type; indexes by schema/table/index; functions and public RPCs by schema/name/identity arguments; policies by schema/table/name with roles sorted; grants by qualified object identity/grantee/privilege/grantability; triggers by schema/table/name; and each external projection by its complete stable identity. Nested function-config and role arrays are sorted lexically. Before any `pg_get_expr`, `pg_get_functiondef`, `pg_get_constraintdef`, `pg_get_indexdef`, view, trigger, or policy deparser output is read, `readSupabaseHistoryEffects` performs a separate SELECT-only `current_setting('server_version_num')::int` preflight and requires exactly `170006`. The SQL snapshot and canonical production fixture repeat that value, and comparison is forbidden unless both local and production report `170006`; a version mismatch fails before deparser-derived bytes are hashed or compared.

`supabase-history-effect-snapshot-schema.ts` strictly requires the three owned schemas, enum/domain, sequence, view/materialized-view, and every other named structural category, all four projection discriminants, `serverVersionNum:170006`, the separately typed extension-version diagnostics, and no unknown/missing field. `supabase-history-effects.test.ts` freezes the positive schema allowlist, projection allowlists/shapes, all category keys/order clauses, nested ordering, absence of mutable sequence counters, view rows, volatile rows/OIDs, and generic managed internals, exclusion of diagnostic extension versions from `effectSha256`, the two-phase version preflight, and the SELECT-only contract; the canonical production fixture binds the final SQL through `source.querySha256`. `readSupabaseHistoryEffects` proves object-key insertion order does not change the effect hash, array order remains authoritative, multiline function and view bodies hash successfully through the ephemeral canonicalizer, extension-version-only drift remains diagnostic, local/production server-version drift fails before comparison, and no raw body or rejected managed object can escape through its result or errors.

- [ ] **Step 5: Implement read-only linked capture**

`capture-supabase-history-ledger.ts` runs `supabase migration list --linked`, queries only `SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version` through the Supabase Management API, and joins filenames/hashes from `git ls-tree`/`git show` at the frozen `baseSha` rather than the mutable workspace. Before requesting any deparser-derived effect rows it separately executes the SELECT-only server-version preflight and requires production `server_version_num=170006`; only then may it run the bound effect query. It writes the immutable 424-file base `linked-migration-ledger.json` plus a fresh canonical SELECT-only `production-history-effects.json` whose source binds `serverVersionNum:170006`. It requires `SUPABASE_ACCESS_TOKEN` and the linked project ref, rejects a non-SELECT SQL payload, expects 439 inventory rows and tail `20260714225500`, and emits no credential. Consequently later verify-only runs remain a comparison to the same base discovery receipt after the planned repair exists. This sorted ledger proves membership only; it does not create, reorder, or validate production chronology.

`capture-production-effect-provenance.ts` uses `gh` read-only against the exact run/job pairs frozen in the receipt. For every one of the 24 primary sources and both corroborations, `extractGithubMigrationSemanticLines` executes the schema-v4 semantic-line contract with no extra BOM, ANSI, CRLF, timestamp, prefix, or redaction transform. It may locate the first reviewed marker after a transport prefix, but the complete slice from that marker through physical line end must match one and only one anchored grammar (the quantifiers are exact literal ASCII spaces):

```text
^→ applying: {8}([0-9]{14}) {2}([a-z0-9_]+)$
^✓ applied: {9}([0-9]{14}) {2}([a-z0-9_]+)$
^✓ already applied: ([0-9]{14}) {2}([a-z0-9_]+)$
^Migrations summary: ([0-9]+) applied, ([0-9]+) skipped\.$
```

It stores only the resulting migration or summary discriminated record and reconstructs semantic bytes using the exact marker-specific alignment spaces, two-space version/name separator, comma, period, and one LF specified above; it never inserts an underscore or `.sql`. It SHA-256 hashes those reconstructed bytes exactly. A physical line with no marker is ignored; a line containing a marker but not matching the full grammar, matching multiple markers, overflowing a bounded integer, or containing leading/trailing semantic text fails with a sanitized source/error code that never echoes the rejected line. The checked structured fixture has no arbitrary suffix or raw text, reproduces all 26 frozen `sanitizedJobLogSha256` values byte-for-byte, and proves identical extraction from API-download and `gh run view` timestamp formats without retaining raw prefixes/logs. The capture verifies repository, exact run head, job membership, recorded `jobConclusion`, and the evidence digest before parsing; a `failure_after_applied_entry` source is accepted only when its exact applied entry is present and its optional later successful job independently yields `already applied` for that owner. `parseGithubMigrationJobLog` numbers only explicit application entries within each primary semantic log, never assigns a corroboration ordinal, and never uses linked-ledger sort order. The capture then validates the complete strict v4 top level (`schemaVersion`, `baseSha`, `logSanitizer`, `coverage`, `linkedLedger`, `evidenceSources`, `exceptionalRecordCount`, `exceptionalRecords`, `replayConstraints`), canonicalizes recursively sorted object keys with array order preserved and one terminal LF, and asserts exact SHA-256 `2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0` and count 31. Missing, ambiguous, invented, raw-log, unknown-key, zero-line, duplicate/unknown run-job source, or total-order evidence fails closed.

Run both capture commands once in this task. Ledger/effects capture writes its two canonical fixtures. The first provenance capture requires the structured semantic fixture path to be absent, writes only that safe fixture create-only, keeps raw logs in bounded temporary memory, and byte-compares the reconstructed provenance with the Task 2 fixture:

```bash
set -euo pipefail
pnpm --filter @baci/web exec tsx tools/db/capture-supabase-history-ledger.ts
test ! -e apps/web/tools/db/fixtures/github-migration-semantic-lines.json
pnpm --filter @baci/web exec tsx tools/db/capture-production-effect-provenance.ts \
  --semantic-fixture-output apps/web/tools/db/fixtures/github-migration-semantic-lines.json
test "$(shasum -a 256 apps/web/tools/db/fixtures/production-effect-provenance.json | awk '{print $1}')" = "2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0"
jq -e '.schemaVersion == 4 and .logSanitizer.version == "github-actions-migration-semantic-lines-v1" and .coverage == "partial-order-effect-replay" and .exceptionalRecordCount == 31' \
  apps/web/tools/db/fixtures/production-effect-provenance.json
jq -e '.schemaVersion == 1 and .sanitizerVersion == "github-actions-migration-semantic-lines-v1" and (.sources | length) == 26' \
  apps/web/tools/db/fixtures/github-migration-semantic-lines.json
```

Later `--verify-only` invocations capture to bounded owned temporary memory, compare all 26 reconstructed semantic sources and provenance byte-for-byte with the checked fixtures, and write nothing. Unit tests use only the checked structured fixture and never contact GitHub.

- [ ] **Step 6: Add package scripts and the DB-tools typecheck project**

Create the final-named project with DB tools only; Task 7 owns its final include expansion and dedicated typecheck, while Task 8 owns only normal-gate wiring:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "incremental": false,
    "noEmit": true,
    "plugins": [],
    "types": ["node", "vitest/globals", "@testing-library/jest-dom", "google.maps"]
  },
  "include": ["tools/db/**/*.ts"],
  "exclude": ["node_modules", ".next", "supabase"]
}
```

Keep the normal web `typecheck` script as `tsc --noEmit` in Task 3 and add the dedicated script alongside the replay commands:

```json
{
  "typecheck:tools-workers": "tsc --noEmit -p tsconfig.tools-workers.json",
  "db:replay:capture-ledger": "tsx tools/db/capture-supabase-history-ledger.ts",
  "db:replay:capture-production-effect": "tsx tools/db/capture-production-effect-provenance.ts",
  "db:replay:chronological": "tsx tools/db/run-supabase-history-replay.ts --mode chronological --pending-repair-state materialized",
  "db:replay:production-effect": "tsx tools/db/run-supabase-history-replay.ts --mode production-effect --pending-repair-state materialized"
}
```

`replay-module-boundaries.test.ts` owns an exact Task 3 path manifest matching `task3_paths` and, before staging, checks every eligible new or modified `.ts`, `.sql`, and `.json`/config path in that manifest. This includes all `tools/db/**/*.ts`, `tools/db/supabase-history-effects.sql`, all four Task 3 fixture/config JSON files, `apps/web/tsconfig.tools-workers.json`, and `apps/web/package.json`; canonical one-line fixtures are checked, not exempted. It fails if an eligible Task 3 working-tree path is absent from the manifest or any checked file exceeds 300 physical lines. Keep semantic extraction separate from provenance capture and project lifecycle/ownership helpers separate from the replay orchestrator rather than suppressing the gate.

- [ ] **Step 7: Run unit tests and commit**

```bash
set -euo pipefail
test "$(node -p 'process.versions.node.split(".")[0]')" = "24"
test "$(pnpm --version)" = "11.7.0"
test "$(pnpm --filter @baci/web exec tsc --version)" = "Version 7.0.2"
pnpm --filter @baci/web exec tsx --version | sed -n '1p' | rg -qx 'tsx v4[.]22[.]4'
test "$(supabase --version)" = "2.95.4"
PSQL_BIN="${PSQL_BIN:-/opt/homebrew/opt/libpq/bin/psql}"
"$PSQL_BIN" --version | rg -qx 'psql \(PostgreSQL\) 18[.]3'
pnpm --filter @baci/web exec vitest run tools/db
pnpm --filter @baci/web exec vitest run tools/db/replay-module-boundaries.test.ts
pnpm --filter @baci/web typecheck:tools-workers
git diff --check
typeset -a task3_paths=(
  apps/web/tools/db/run-replay-command.ts
  apps/web/tools/db/run-replay-command.test.ts
  apps/web/tools/db/supabase-replay-contract.ts
  apps/web/tools/db/supabase-replay-contract.test.ts
  apps/web/tools/db/replay-repository-root.ts
  apps/web/tools/db/replay-repository-root.test.ts
  apps/web/tools/db/allocate-supabase-replay-ports.ts
  apps/web/tools/db/allocate-supabase-replay-ports.test.ts
  apps/web/tools/db/rewrite-supabase-replay-config.ts
  apps/web/tools/db/rewrite-supabase-replay-config.test.ts
  apps/web/tools/db/replay-project-ownership.ts
  apps/web/tools/db/replay-project-ownership.test.ts
  apps/web/tools/db/supabase-replay-expected-resources.ts
  apps/web/tools/db/supabase-replay-expected-resources.test.ts
  apps/web/tools/db/parse-supabase-migration-list.ts
  apps/web/tools/db/parse-supabase-migration-list.test.ts
  apps/web/tools/db/schemas/linked-migration-ledger-schema.ts
  apps/web/tools/db/schemas/linked-migration-ledger-schema.test.ts
  apps/web/tools/db/schemas/production-history-effects-schema.ts
  apps/web/tools/db/schemas/production-history-effects-schema.test.ts
  apps/web/tools/db/schemas/github-migration-semantic-lines-schema.ts
  apps/web/tools/db/schemas/github-migration-semantic-lines-schema.test.ts
  apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.ts
  apps/web/tools/db/schemas/supabase-history-effect-snapshot-schema.test.ts
  apps/web/tools/db/canonical-json-value.ts
  apps/web/tools/db/canonical-json-value.test.ts
  apps/web/tools/db/canonical-replay-fixture-json.ts
  apps/web/tools/db/canonical-replay-fixture-json.test.ts
  apps/web/tools/db/canonical-replay-effect-json.ts
  apps/web/tools/db/canonical-replay-effect-json.test.ts
  apps/web/tools/db/capture-supabase-history-ledger.ts
  apps/web/tools/db/capture-supabase-history-ledger.test.ts
  apps/web/tools/db/extract-github-migration-semantic-lines.ts
  apps/web/tools/db/extract-github-migration-semantic-lines.test.ts
  apps/web/tools/db/parse-github-migration-job-log.ts
  apps/web/tools/db/parse-github-migration-job-log.test.ts
  apps/web/tools/db/capture-production-effect-provenance.ts
  apps/web/tools/db/capture-production-effect-provenance.test.ts
  apps/web/tools/db/materialize-supabase-history-replay.ts
  apps/web/tools/db/materialize-supabase-history-replay.test.ts
  apps/web/tools/db/read-supabase-history-effects.ts
  apps/web/tools/db/read-supabase-history-effects.test.ts
  apps/web/tools/db/supabase-history-effects.sql
  apps/web/tools/db/supabase-history-effects.test.ts
  apps/web/tools/db/replay-module-boundaries.test.ts
  apps/web/tools/db/fixtures/biome.json
  apps/web/tools/db/fixtures/github-migration-semantic-lines.json
  apps/web/tools/db/fixtures/linked-migration-ledger.json
  apps/web/tools/db/fixtures/production-history-effects.json
  apps/web/tools/db/run-supabase-history-replay.ts
  apps/web/tools/db/run-supabase-history-replay.test.ts
  apps/web/tsconfig.tools-workers.json
  apps/web/package.json
)
git add -- "${task3_paths[@]}"
test "$(git diff --cached --name-only | LC_ALL=C sort)" = \
  "$(printf '%s\n' "${task3_paths[@]}" | LC_ALL=C sort -u)"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "feat: add checked Supabase history replay"
```

Expected: the exact Node/pnpm/tsc/tsx/Supabase/psql pins, unit tests, and DB-only TypeScript project pass without starting Docker; the two explicit read-only fixture-capture commands above are the only Task 3 production/GitHub reads. Immediately before staging, the boundary gate proves every eligible Task 3 TypeScript, SQL, and JSON/config file—including `supabase-history-effects.sql` and the staged configs/fixtures—is present in its exact manifest and at most 300 physical lines. Only after that gate and `git diff --check` pass may `git add` run.

---

### Task 4: Add the frozen append-only fulfillment repair and prove both replay effects — complete via superseding recovery

> - [x] **Task-level completion through superseding recovery:** PR #3131 and
>   its post-deployment continuation replaced this rejected
>   `baci-owned-effects-v2` procedure. The refreshed v3 production fixture,
>   exact applied `25501` evidence, separate two-entry forward-repair receipt,
>   required immutable cancellation proof, and both `enforce` replay receipts
>   are the authoritative Task 4 result. See
>   [2026-07-16-ogabassey-p0-effect-boundary-recovery.md](2026-07-16-ogabassey-p0-effect-boundary-recovery.md).

#### Superseded historical procedure — do not execute

The files, commands, expectations, and unchecked substeps below are retained
unchanged as audit history. They were not executed as written against
`baci-owned-effects-v2`, must not be rerun, and must not be individually marked
complete. Their task-level outcome is supplied exclusively by the recovery
receipt above.

**Files:**
- Create: `supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql`
- Create: `supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql`
- Create: `docs/architecture/durable-event-pipeline-p0-chronological-receipt.json`
- Create: `docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json`
- Modify mechanically: `apps/web/src/types/supabase.ts`

**Produces:** One idempotent repair, equal replay effect hashes, regenerated public schema types.

- [ ] **Step 1: Refresh the fail-closed discovery receipt**

```bash
set -euo pipefail
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "cfa062a09bcb737c09e4171730615364afff6e68"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'8\t0'
git merge-base --is-ancestor cfa062a09bcb737c09e4171730615364afff6e68 HEAD
git merge-base --is-ancestor dae4e734f747717654125a16c1527b7f6366ce87 HEAD
git merge-base --is-ancestor 4535d1ada5a9cd7ae60eb4522b66101adcdc8fa0 HEAD
git merge-base --is-ancestor 9e3d1b14b1931a5e441fc23f0e5417c188056e47 HEAD
migration_tree_sha() {
  git ls-tree -r --name-only "$1" -- supabase/migrations |
    rg '^supabase/migrations/[^/]+[.]sql$' |
    LC_ALL=C sort |
    while IFS= read -r migration_path; do
      printf '%s\t%s\n' "$migration_path" \
        "$(git show "$1:$migration_path" | shasum -a 256 | awk '{print $1}')"
    done |
    shasum -a 256 | awk '{print $1}'
}
test "$(migration_tree_sha origin/main)" = "757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983"
test "$(migration_tree_sha HEAD)" = "757b9caab5d1d9ff22a3a2fbea35ce54448598031222b0d5fbe8a7eba9195983"
test -z "$(git ls-tree -r --name-only origin/main -- \
  supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql)"
test ! -e supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql
supabase migration list --linked
for pr_number in 2686 2928 2958 3024; do
  gh pr view "$pr_number" --json state --jq 'select(.state == "OPEN") | .state' | rg -qx OPEN
  expected_paths="$(awk -F '\t' -v pr="$pr_number" '$1 == pr {print $3}' \
    apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv | LC_ALL=C sort)"
  actual_paths="$(gh api --paginate "repos/ogabasseyy/Baci/pulls/$pr_number/files?per_page=100" \
    --jq '.[] | .filename | select(test("^supabase/migrations/[^/]+[.]sql$"))' |
    LC_ALL=C sort)"
  test "$actual_paths" = "$expected_paths"
done
assert_pr_migration_blob() {
  local pr_number="$1" migration_path="$2" expected_sha="$3" head actual
  head="$(gh pr view "$pr_number" --json state,headRefOid --jq 'select(.state == "OPEN") | .headRefOid')"
  test -n "$head"
  actual="$(gh api "repos/ogabasseyy/Baci/contents/$migration_path?ref=$head" --jq .content |
    base64 --decode | shasum -a 256 | awk '{print $1}')"
  test "$actual" = "$expected_sha"
}
while IFS=$'\t' read -r pr_number expected_sha migration_path; do
  assert_pr_migration_blob "$pr_number" "$migration_path" "$expected_sha"
done < apps/web/tools/events/fixtures/p0-open-pr-migration-lanes.tsv
if for pr_number in $(gh api --paginate 'repos/ogabasseyy/Baci/pulls?state=open&per_page=100' --jq '.[].number'); do
  gh api --paginate "repos/ogabasseyy/Baci/pulls/$pr_number/files?per_page=100" --jq '.[].filename'
done | rg -q '^supabase/migrations/20260714225501_'; then
  exit 1
fi
pnpm --filter @baci/web run db:replay:capture-ledger --verify-only
pnpm --filter @baci/web run db:replay:capture-production-effect --verify-only
test "$(shasum -a 256 apps/web/tools/db/fixtures/production-effect-provenance.json | awk '{print $1}')" = "2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0"
jq -e '.schemaVersion == 4 and .exceptionalRecordCount == 31' \
  apps/web/tools/db/fixtures/production-effect-provenance.json
```

Expected: 439 linked inventory rows, tail `20260714225500`, the same 17 mapped rows, byte-equal schema-v4 production-effect provenance with its bound SHA/count, merged #3117/#3121/#3120 present in the migration base, the current #3024 17-row path/blob set intact, every bound empty lane still empty, and no open migration colliding with `20260714225501`. Displayed open heads are observations, not unrelated-commit invalidators: regenerate only if the migration tree/frozen P0 paths change, one of these lanes merges, or a frozen migration path/blob/collision set changes. Any such material difference stops before creating the migration.

- [ ] **Step 2: Write the failing SQL assertion**

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name = 'shipped_at' AND data_type = 'timestamp with time zone'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name = 'delivered_at' AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'order fulfillment timestamp reconciliation missing';
  END IF;
END;
$$;
```

Run the chronological replay in its one explicit pre-repair state:

```bash
set -euo pipefail
red_output="$(mktemp)"
trap 'rm -f "$red_output"' EXIT
if pnpm --filter @baci/web exec tsx tools/db/run-supabase-history-replay.ts \
  --mode chronological \
  --pending-repair-state not-materialized \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  2>&1 | tee "$red_output"; then
  echo 'expected pre-repair replay to fail' >&2
  exit 1
fi
rg -qx 'Replay SQL check failed at ordinal 1: non-zero-exit' "$red_output"
rm -f "$red_output"
trap - EXIT
```

Expected: FAIL with the sanitized classification `Replay SQL check failed at ordinal 1: non-zero-exit`; the underlying database exception is intentionally not echoed. The flag requires the future path to be absent and omits only receipt record 31. It is not auto-selected; after Step 3 creates the file, this state is invalid and every package-script/default replay requires `materialized` exact bytes.

- [ ] **Step 3: Add the exact repair**

```sql
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
```

```bash
set -euo pipefail
test "$(shasum -a 256 supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql | awk '{print $1}')" = "1f6b9c1e12afbbab4e32a697230cebbe196fb9d43daf340caba1eb309370a361"
post_repair_tree_sha="$({
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print |
    LC_ALL=C sort |
    while IFS= read -r migration_path; do
      printf '%s\t%s\n' "$migration_path" \
        "$(shasum -a 256 "$migration_path" | awk '{print $1}')"
    done
} | shasum -a 256 | awk '{print $1}')"
test "$post_repair_tree_sha" = "b55c3e04b861d8abd3a320564e78a009fb5a6458b0bfd9c06e919ab55affe055"
```

- [ ] **Step 4: Run both isolated replays**

```bash
set -euo pipefail
pnpm --filter @baci/web run db:replay:chronological \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql \
  --receipt-output docs/architecture/durable-event-pipeline-p0-chronological-receipt.json
pnpm --filter @baci/web run db:replay:production-effect \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql \
  --receipt-output docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json
jq -e --slurp '
  .[0].serverVersionNum == 170006 and
  .[1].serverVersionNum == 170006 and
  .[2].source.serverVersionNum == 170006 and
  .[0].effectSha256 == .[1].effectSha256 and .[1].effectSha256 == .[2].effectSha256' \
  docs/architecture/durable-event-pipeline-p0-chronological-receipt.json \
  docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json \
  apps/web/tools/db/fixtures/production-history-effects.json
pnpm --filter @baci/web run db:replay:chronological \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql \
  --types-output apps/web/src/types/supabase.ts
```

Expected: both replays pass all SQL checks; both local receipts and the fresh read-only production-effects fixture bind `serverVersionNum:170006`; and only after that version equality is established does each produce the same nonempty Baci-owned effect SHA-256. This is effect convergence under the approved partial constraints, not proof of a total historical order. Only then does the third checked chronological replay atomically replace generated types. Neither the raw repository nor the disposable runner uses `supabase db reset`; the runner uses a fresh owned `db start`, `migration up --local` without `--include-all`, and exact 125-row bootstrap-history verification.

- [ ] **Step 5: Commit repair, receipts, and generated types**

```bash
set -euo pipefail
git diff --check
git add supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql \
  supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  docs/architecture/durable-event-pipeline-p0-chronological-receipt.json \
  docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json \
  apps/web/src/types/supabase.ts
test "$(git diff --cached --name-only | LC_ALL=C sort)" = "$(printf '%s\n' \
  apps/web/src/types/supabase.ts \
  docs/architecture/durable-event-pipeline-p0-chronological-receipt.json \
  docs/architecture/durable-event-pipeline-p0-production-effect-receipt.json \
  supabase/migrations/20260714225501_reconcile_order_fulfillment_timestamps.sql \
  supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql | LC_ALL=C sort)"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "fix: reconcile Supabase migration history effects"
```

---

### Task 5: Close the generated database boundary and remove all 64 `as never` escapes

> **Active continuation point (2026-07-17):** Begin source implementation
> here. Task 4 is satisfied only by the superseding recovery receipts. Tasks 5
> through 8 are active. Task 9's fixed commit graph, exact head, and
> ahead/behind assertions remain derived and must be regenerated from the
> eventual actual history before Task 9 executes.

**Files:**
- Create: `apps/web/src/lib/events/event-pipeline-database.ts`
- Create: `apps/web/src/lib/events/event-pipeline-database.test.ts`
- Create: `apps/web/src/lib/events/event-pipeline-boundary-manifest.ts`
- Create: `apps/web/src/lib/events/event-pipeline-boundary-manifest.test.ts`
- Create: `apps/web/src/lib/events/event-pipeline-test-client.ts`
- Create: `apps/web/src/lib/events/event-pipeline-test-client.test.ts`
- Create: `apps/web/src/lib/events/event-pipeline-service-role-test-client.ts`
- Create: `apps/web/src/lib/events/event-pipeline-service-role-test-client.test.ts`
- Create: `apps/web/tools/events/verify-event-pipeline-boundaries.ts`
- Create: `apps/web/tools/events/verify-event-pipeline-boundaries.test.ts`
- Modify: `apps/web/src/lib/supabase/service.ts`; create its currently absent colocated `service.test.ts`. Preserve the no-argument legacy return and add only the opt-in `'event-pipeline'` overload.
- Modify/test: `apps/web/src/lib/supabase/server.ts`, `server.test.ts`. Preserve both legacy no-argument/cookie overloads and add only opt-in `'event-pipeline'` overloads.
- Modify/test: `apps/web/src/lib/supabase/admin.ts`, `admin.test.ts`. Preserve the legacy no-argument return and add only the opt-in `'event-pipeline'` overload.
- Modify/test the trusted #3077 producer `apps/web/src/lib/events/record-platform-order-created-event.ts` and `record-platform-order-created-event.test.ts` to use the opt-in typed admin path.
- Modify the 12 governed bare runtime-client files:
  - `apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts` and its colocated `route.test.ts`
  - `apps/web/src/lib/events/analytics-destination-adapter.ts`
  - `apps/web/src/lib/events/enqueue-paid-order-domain-event.ts`
  - `apps/web/src/lib/events/event-destination.ts`
  - `apps/web/src/lib/events/event-ingress-capability.ts`
  - `apps/web/src/lib/events/event-ingress-context.ts`
  - `apps/web/src/lib/events/paid-order-delivery-event.ts`
  - `apps/web/src/lib/events/platform-destination-adapter.ts`
  - `apps/web/src/lib/events/record-analytics-domain-event.ts`
  - `apps/web/src/lib/events/record-platform-domain-event.ts`
  - `apps/web/src/scripts/process-domain-events.ts`
  - `apps/web/src/scripts/process-event-deliveries.ts`
- Modify the 14 exact `as never` test files:
  - `apps/web/src/lib/events/analytics-destination-adapter.test.ts`
  - `apps/web/src/lib/events/deliver-domain-event.test.ts`
  - `apps/web/src/lib/events/event-ingress-context.test.ts`
  - `apps/web/src/lib/events/paid-order-delivery-event.test.ts`
  - `apps/web/src/lib/events/platform-destination-adapter.test.ts`
  - `apps/web/src/lib/events/record-analytics-domain-event.test.ts`
  - `apps/web/src/lib/events/record-platform-domain-event.test.ts`
  - `apps/web/src/lib/events/to-conversion-order-items.test.ts`
  - `apps/web/src/lib/payments/paid-order-ad-tracking-executor.test.ts`
  - `apps/web/src/lib/payments/schedule-legacy-purchase-conversion.test.ts`
  - `apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts`
  - `apps/web/src/lib/trigger-purchase-conversion.test.ts`
  - `apps/web/src/scripts/process-domain-events.test.ts`
  - `apps/web/src/scripts/process-event-deliveries.test.ts`
- Modify typed-boundary coverage: `apps/web/src/lib/events/event-ingress-capability.test.ts` and `apps/web/src/lib/events/enqueue-paid-order-domain-event.test.ts`; replace the latter's bare/asserted `Pick<SupabaseClient,'rpc'>` with the typed test client and prove the capability factory returns `SupabaseClient<Database>` from `createClient<Database>`.
- Modify/test: `apps/web/src/app/api/admin/event-pipeline/replay/route.ts`, `route.test.ts`
- Modify: `vps-workers/bin/event-pipeline-wrappers.test.mjs`
- Extend SQL regression: `supabase/migrations/tests/restore_merchants_anon_public_columns.sql`

**Produces:** Generated `Args`/`Returns`, identity/body/config/grant/replay-effect coverage for all 19 final public #3077 functions, opt-in typed event-pipeline factory overloads with byte- and type-compatible legacy defaults, a direct-caller source guard, and zero `as never` in the frozen 64 occurrences. P0 does not globally type shared Supabase factories. Task 6 makes the two existing conversion/events service-authority wrappers explicit, typed, and tenant-bound while preserving provider compatibility behavior; it neither creates a third importer nor enables the pipeline.

- [ ] **Step 1: Write failing manifest and AST-guard tests**

The manifest freezes:

- identity/caller projection: `merchants.id`, `merchant_slug_aliases.merchant_id`, `domains.merchant_id`;
- conversion/service-delivery projection: `merchants.country,payout_currency`;
- merchant provider-configuration projection: `merchants.plan_tier,plan_expires_at,premium_features,offline_conversions_enabled,facebook_pixel_id,facebook_capi_token,tiktok_pixel_id,tiktok_access_token,google_analytics_id,ga4_api_secret,snapchat_pixel_id,snapchat_capi_token`, accessible only through the durable delivery worker or the two exact independently tenant-verified trusted wrappers, each using the branded `ServiceRoleClient`; the wrapper allowance exists only if the narrow owner-approved rule exception recorded by Task 6 is present;
- feature-settings provider-configuration projection: the same eight credential columns, keyed by `merchant_id`, under only the durable delivery worker or those same two exact trusted-wrapper authorities and the same approval gate;
- platform-settings projection: `platform_settings.google_analytics_id,ga4_api_secret,facebook_pixel_id,facebook_capi_token`, under the durable platform destination adapter and the one exact byte-frozen `platform/events -> platform-event-forwarding.ts -> createAdminClient()` legacy helper edge; retaining that legacy edge is covered by the same narrow owner-approved rule exception and it may not expand;
- analytics-route authority: no provider-secret value may enter a public response, log, event payload, browser/client graph, or caller-selected projection. Subject to Task 6's narrow recorded owner approval, exactly the two pre-existing trusted wrapper importers, `analytics/conversion` and `events`, may read the exact provider-configuration projection server-side only after each independently resolves and verifies tenant authority before constructing the typed service wrapper. The other six route roots below remain hash-bound and byte-identical in P0: Facebook/GA4/TikTok/Snapchat and authenticated analytics-ads are caller-scoped, while `platform/events` retains its separately reviewed `platform-event-forwarding.ts -> createAdminClient()` platform-settings class. Any changed route byte, new route importer, body-selected tenant, public credential flow, or new service/admin edge fails:

| SHA-256 | Exact route root |
| --- | --- |
| `f41e1de587645b8fdb2af8af180eb581b2bfeecae688670d7b5c7a80088b7c32` | `apps/web/src/app/api/analytics/facebook-capi/route.ts` |
| `9e9b8c3edb1636d2f27e9551568d5036778fce6ab54272f1fd3b77cfd0f88c9f` | `apps/web/src/app/api/analytics/ga4/route.ts` |
| `4d59510f6a72ae25dd45c8cc8ea6762a709bf745286140a7a9e1aa4b64ee942e` | `apps/web/src/app/api/analytics/tiktok/route.ts` |
| `1a7898d59038b6a37e057e74da3907f4a42da9c25c7236e9d324d7b1516e4cd3` | `apps/web/src/app/api/analytics/snapchat/route.ts` |
| `bb3b5ea163f7029bd8a90523ac7944c9e126b2aebc0ce673f82c4e0c48d00161` | `apps/web/src/app/api/platform/events/route.ts` |
| `b714f0bedeed7bded973fbe743c74517622ea8e0069dfca35051752dc45571dd` | `apps/web/src/app/api/analytics/ads/route.ts` |

- event tables: exact insert/upsert columns already used by `analytics_events` and `platform_events`;
- paid delivery: `orders.id,merchant_id,order_number,payment_status,total,currency,customer_email,customer_phone,customer_name,customer_id,shipping_address,ad_tracking` plus `order_items.id,product_id,name,price,quantity`;
- legacy analytics write: `analytics_events.merchant_id,event_type,event_data,event_timestamp,source,event_id`;
- legacy platform write: `platform_events.event_data,event_id,event_timestamp,event_type,ip_address,merchant_id,page_url,referrer,session_id,user_agent`;
- all nineteen final public #3077 functions, with arguments/returns derived from `Database['public']['Functions'][Name]` and this exact classification:

| Classification | Functions |
| --- | --- |
| TypeScript application-called RPC | `claim_event_deliveries_v1`, `dead_letter_ingress_event_v1`, `enqueue_domain_event_v1`, `finish_event_delivery_v1`, `get_event_pipeline_operations_v1`, `list_event_pipeline_deliveries_v1`, `list_event_pipeline_ingress_failures_v1`, `read_domain_events_v1`, `record_analytics_domain_event_v1`, `record_event_worker_heartbeat_v1`, `record_platform_domain_event_v1`, `replay_event_deliveries_batch_v1`, `replay_ingress_dead_letter_v1`, `route_domain_event_v1`, `select_event_pipeline_replay_ids_v1` |
| VPS cleanup application-called RPC | `cleanup_domain_event_pipeline_v1` |
| SQL-internal helper | `is_event_ingress_capability_v1`, `replay_event_delivery_v1` |
| service-role-only metrics RPC | `get_domain_event_queue_metrics_v1` |

Generated signature, function identity/body/config, grant, and replay-effect tests cover all 19. The source caller guard discovers literal `.rpc(...)` calls to every one of those 19 names repo-wide on each invocation, classifies the 15 TypeScript application calls, separately proves the VPS cleanup `.mjs` call with source shape plus a generated compile-only contract, and rejects any other direct caller. `get_domain_event_queue_metrics_v1` is a service-role-only SQL surface with zero current application callers: prove its generated signature/body/grant/effect and reject every direct runtime call. For client/operation/projection authority, the guard computes the current production import closure from the explicit operator-route, ingress, routing-worker, delivery-worker, paid-order, and trusted-producer roots, then unions every `BASE...HEAD`, staged, unstaged, and untracked TypeScript path. The 154-path fixture is immutable provenance and a minimum seed, never a ceiling. This dynamic scope means Task 7's newly split worker modules cannot escape merely because their paths did not exist in #3077.

Within that dynamic event-pipeline scope, the guard rejects a TypeScript call to either SQL-internal helper, an application RPC absent from the manifest, a bare `SupabaseClient` outside the exact five caller-scoped roots, an SDK factory without `<Database>` or the required typed sentinel, `as never`, nested assertions, asserted RPC names/Args/Returns, an operation absent from the manifest, or a selected column absent from the caller authority's projection. Compatibility is limited to (a) the exact hash-bound legacy overload declarations in `service.ts`, `server.ts`, and `admin.ts`, whose default returns remain contained pre-existing debt and may not be used by a governed P0 caller, (b) the five exact-byte caller-scoped roots above, (c) the byte-frozen platform route plus its separately manifested platform-settings helper, and (d) the two explicit, typed, tenant-resolved trusted wrapper importers governed by Task 6. The guard rejects a third wrapper importer, a changed frozen route byte, any additional platform/admin edge, or a privileged construction before tenant verification. Red tests create a new untracked worker module, move a direct RPC into it, alter one route receipt byte, add a sixth bare-client route, add a second platform/admin edge, add a third trusted-wrapper importer, and add an out-of-closure literal call; all are discovered with complete paths. A function cannot be omitted merely because TypeScript does not call it.

Extend `supabase/migrations/tests/restore_merchants_anon_public_columns.sql` as the executable anon grant-completeness sweep. Its explicit expected set is all 77 currently intended anon-readable merchant columns: the complete permanent set from `20260713150000_s0a_merchants_anon_containment.sql`, its nine dated Option-B bridge columns, and all 30 restored public columns from `20260713160000_restore_merchants_anon_public_columns.sql`. Compare that full set against `information_schema.column_privileges`, require the exact 18 named secret/private columns to remain absent, reject table-wide or `PUBLIC` merchant SELECT/write grants, and require the anon row-policy expression to be exactly published-only (`is_published IS TRUE`). Keep the four public measurement IDs (`google_analytics_id`, `facebook_pixel_id`, `tiktok_pixel_id`, `snapchat_pixel_id`) readable while CAPI/API secrets remain denied; retain the nine bridge columns and documented 2026-08-24 removal gate rather than misclassifying them as permanent.

Bound JSON-return inspection in P0 to `resolve_storefront_public_snapshot_v2(text)`, not the roughly 173 unrelated baseline anon function grants. Using deterministic published, unpublished, and missing fixtures, require the exact final function's 37 published `merchant_data` keys, four unpublished minimization keys (`id`, `business_name`, `slug`, `is_published`), `not_found` null payload, the 62 explicit top-level feature-setting keys (including the later final `repairs_catalog_enabled` addition from `20260712100000_public_snapshot_repairs_flag.sql`), and `custom_settings` containing only `google_merchant_id`/`google_store_widget_enabled`; compare `pg_get_functiondef` and executed JSON keys. Any future H1 hero snapshot RPC must add its exact identity/key manifest before gaining anon execute. Red assertions cover a missing expected column/key, any unexpected grant/key, a secret return key, wrong row policy, or table-wide/PUBLIC privilege. Record all other anon RPCs and the existing authenticated table-wide privilege/policy read-only as deferred S1 audit debt; the frozen repair migration cannot remediate either broader surface.

After these tests and SQL assertions exist, but before changing a factory, caller, or migration regression, run the red gate:

```bash
set -euo pipefail
if pnpm --filter @baci/web exec vitest run \
  src/lib/events/event-pipeline-database.test.ts \
  src/lib/events/event-pipeline-boundary-manifest.test.ts \
  src/lib/events/event-pipeline-test-client.test.ts \
  src/lib/events/event-pipeline-service-role-test-client.test.ts \
  tools/events/verify-event-pipeline-boundaries.test.ts \
  src/lib/supabase/service.test.ts \
  src/lib/supabase/server.test.ts \
  src/lib/supabase/admin.test.ts \
  src/app/api/admin/event-pipeline/dead-letters/route.test.ts \
  src/app/api/admin/event-pipeline/replay/route.test.ts \
  src/lib/events/record-platform-order-created-event.test.ts \
  src/lib/payments/paid-order-ad-tracking-executor.test.ts \
  src/lib/payments/schedule-legacy-purchase-conversion.test.ts \
  src/lib/trigger-purchase-conversion.pipeline.test.ts \
  src/lib/trigger-purchase-conversion.test.ts; then
  echo 'expected typed-boundary tests to fail before implementation' >&2
  exit 1
fi
```

Expected red: assertions fail on unbranded/bare clients inside governed event-pipeline callers, any byte drift or widening of the five caller-scoped roots or separate platform-settings class, any trusted-wrapper importer beyond the two reviewed route roots, missing typed sentinel overloads and legacy-`ReturnType` compatibility tests, missing generated RPC contracts, the 64 frozen `as never` escapes, incomplete caller/projection manifests, and the still-unextended anon grant/key sweep. Test-loader, path, or environment failures do not count.

- [ ] **Step 2: Add opt-in typed event-pipeline factory overloads and type only the bounded RPC callers**

The linked-production `Database` type is intentionally incompatible with globally typing these mature shared factories: doing so creates hundreds of unrelated baseline errors. Preserve every existing default call's legacy untyped return. Add the literal sentinel overloads below and implement `<Database>` only on the sentinel branch; in each overload set, declare the legacy overload **last** so `ReturnType<typeof factory>` remains the legacy type used by existing callers:

- `createServiceClient('event-pipeline'): ServiceRoleClient`; `createServiceClient(): SupabaseClient` remains last. Only the sentinel branch constructs the nominal brand, without a type assertion, by attaching the module-private unique-symbol property to `createClient<Database>(...)`. A normal `SupabaseClient<Database>` is not assignable to the brand.
- `createClient('event-pipeline'): Promise<SupabaseClient<Database>>` and `createClient(cookieStore,'event-pipeline'): SupabaseClient<Database>` in `server.ts`; the existing no-argument and cookie-store legacy overloads remain after them, with the legacy implementation return visible to `ReturnType`.
- `createClient('event-pipeline'): SupabaseClient<Database>` in `admin.ts`, inherited by `createAdminClient`; its no-argument legacy overload remains last and unbranded. The trusted `record-platform-order-created-event` producer opts into this typed admin overload. No new user-facing route gains admin authority; the separately approved byte-frozen platform route/helper retains only its exact pre-existing edge.

Tests lock all three sentinel results, legacy no-argument/cookie results, and `ReturnType` compatibility. They also prove the service sentinel is the only branded construction path, a normal typed client is not assignable to `ServiceRoleClient`, and service auth persistence/refresh remain false. The two operator routes opt into the typed server overload; the two worker entrypoints opt into the branded service overload; direct event-ingress capability continues to call `createClient<Database>` locally. No browser-client factory is in this frozen boundary.

Typing an opt-in path does not authorize replacing a route's existing caller-scoped client. Every new P0 user-facing route/path asserts service/admin factories are unreachable. Task 6 may modify only the two existing conversion/events wrapper paths to use the typed service factory after independently resolving and verifying tenant authority. The five compatibility/provider roots remain caller-scoped and byte-bound; the sixth, `platform/events`, remains byte-bound in its separately approved platform-settings class with its exact helper edge unchanged. Trusted routing and delivery workers may each construct the brand for manifest-approved RPCs, but only `process-event-deliveries` may pass it into `EventDestinationContext`, analytics configuration, destination, or provider closures. The final P0 verifier rejects every additional route importer or pre-verification privileged construction.

- [ ] **Step 3: Replace client mocks without assertions**

`event-pipeline-test-client.ts` creates a real caller-scoped `createClient<Database>('http://127.0.0.1:54321', 'event-pipeline-test-key', { global: { fetch }, auth: { autoRefreshToken:false, persistSession:false } })`. `event-pipeline-service-role-test-client.ts` is test-only and delegates to the real `createServiceClient('event-pipeline')` after installing validated test env and a mocked global fetch; it never casts or fabricates the nominal brand. Service-only suites (`deliver-domain-event.test.ts`, both destination-adapter tests, and `process-event-deliveries.test.ts`) use that branded helper; caller-scoped suites use the ordinary helper. Each former client/mock escape passes a typed mocked `fetch`; the six malformed parser cases in `to-conversion-order-items.test.ts` and `paid-order-ad-tracking-executor.test.ts` pass `unknown` into the public parser instead of asserting to a valid domain type.

- [ ] **Step 4: Prove the JavaScript VPS boundary honestly**

Extend `event-pipeline-wrappers.test.mjs` to assert wrappers invoke the typed TypeScript worker entrypoints and do not call RPCs directly. Add a TypeScript compile-only contract assigning the generated RPC `Args` and `Returns` used by the workers. Do not claim the `.mjs` file was TypeScript-compiled.

- [ ] **Step 5: Run focused guards and commit**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  src/lib/events \
  tools/events \
  src/lib/supabase/service.test.ts \
  src/lib/supabase/server.test.ts \
  src/lib/supabase/admin.test.ts \
  src/app/api/admin/event-pipeline/dead-letters/route.test.ts \
  src/app/api/admin/event-pipeline/replay/route.test.ts \
  src/lib/payments/paid-order-ad-tracking-executor.test.ts \
  src/lib/payments/schedule-legacy-purchase-conversion.test.ts \
  src/lib/trigger-purchase-conversion.pipeline.test.ts \
  src/lib/trigger-purchase-conversion.test.ts \
  src/scripts/process-domain-events.test.ts \
  src/scripts/process-event-deliveries.test.ts
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-boundaries.ts
pnpm --filter @baci/web run db:replay:chronological \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql
pnpm --filter @baci/web run db:replay:production-effect \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql
escape_count="$({ rg -n 'as never' \
  $(awk -F '\t' '$2 ~ /^apps\/web\/.*\.(ts|tsx)$/ {print $2}' \
    apps/web/tools/events/fixtures/event-pipeline-path-inventory.tsv) || true; } |
  wc -l | tr -d ' ')"
test "$escape_count" = "0"
node --test vps-workers/bin/event-pipeline-wrappers.test.mjs
git diff --check
typeset -a task5_paths=(
  apps/web/src/app/api/admin/event-pipeline/dead-letters/route.ts
  apps/web/src/app/api/admin/event-pipeline/dead-letters/route.test.ts
  apps/web/src/app/api/admin/event-pipeline/replay/route.ts
  apps/web/src/app/api/admin/event-pipeline/replay/route.test.ts
  apps/web/src/lib/events/event-pipeline-database.ts
  apps/web/src/lib/events/event-pipeline-database.test.ts
  apps/web/src/lib/events/event-pipeline-boundary-manifest.ts
  apps/web/src/lib/events/event-pipeline-boundary-manifest.test.ts
  apps/web/src/lib/events/event-pipeline-test-client.ts
  apps/web/src/lib/events/event-pipeline-test-client.test.ts
  apps/web/src/lib/events/event-pipeline-service-role-test-client.ts
  apps/web/src/lib/events/event-pipeline-service-role-test-client.test.ts
  apps/web/tools/events/verify-event-pipeline-boundaries.ts
  apps/web/tools/events/verify-event-pipeline-boundaries.test.ts
  apps/web/src/lib/supabase/service.ts apps/web/src/lib/supabase/service.test.ts
  apps/web/src/lib/supabase/server.ts apps/web/src/lib/supabase/server.test.ts
  apps/web/src/lib/supabase/admin.ts apps/web/src/lib/supabase/admin.test.ts
  apps/web/src/lib/events/analytics-destination-adapter.ts
  apps/web/src/lib/events/analytics-destination-adapter.test.ts
  apps/web/src/lib/events/enqueue-paid-order-domain-event.ts
  apps/web/src/lib/events/enqueue-paid-order-domain-event.test.ts
  apps/web/src/lib/events/event-destination.ts
  apps/web/src/lib/events/event-ingress-capability.ts
  apps/web/src/lib/events/event-ingress-capability.test.ts
  apps/web/src/lib/events/event-ingress-context.ts
  apps/web/src/lib/events/event-ingress-context.test.ts
  apps/web/src/lib/events/paid-order-delivery-event.ts
  apps/web/src/lib/events/paid-order-delivery-event.test.ts
  apps/web/src/lib/events/platform-destination-adapter.ts
  apps/web/src/lib/events/platform-destination-adapter.test.ts
  apps/web/src/lib/events/record-analytics-domain-event.ts
  apps/web/src/lib/events/record-analytics-domain-event.test.ts
  apps/web/src/lib/events/record-platform-domain-event.ts
  apps/web/src/lib/events/record-platform-domain-event.test.ts
  apps/web/src/lib/events/record-platform-order-created-event.ts
  apps/web/src/lib/events/record-platform-order-created-event.test.ts
  apps/web/src/lib/events/deliver-domain-event.test.ts
  apps/web/src/lib/events/to-conversion-order-items.test.ts
  apps/web/src/lib/payments/paid-order-ad-tracking-executor.test.ts
  apps/web/src/lib/payments/schedule-legacy-purchase-conversion.test.ts
  apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts
  apps/web/src/lib/trigger-purchase-conversion.test.ts
  apps/web/src/scripts/process-domain-events.ts
  apps/web/src/scripts/process-domain-events.test.ts
  apps/web/src/scripts/process-event-deliveries.ts
  apps/web/src/scripts/process-event-deliveries.test.ts
  vps-workers/bin/event-pipeline-wrappers.test.mjs
  supabase/migrations/tests/restore_merchants_anon_public_columns.sql
)
git add -- "${task5_paths[@]}"
expected_task5_paths="$(printf '%s\n' "${task5_paths[@]}" | LC_ALL=C sort -u)"
actual_task5_paths="$(git diff --cached --name-only | LC_ALL=C sort)"
test "$actual_task5_paths" = "$expected_task5_paths"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "refactor: type durable event pipeline boundaries"
```

Expected: generated contracts cover 19 functions; only the classified 15 TypeScript calls and one VPS cleanup call are accepted at runtime, while both SQL-internal helpers and the service-role-only metrics surface have zero application callers. The guard reports zero findings, consumes the checked 154-path TSV as immutable provenance, and dynamically governs new/moved event-pipeline callers. The focused Vitest path is exactly `tools/events` relative to the `@baci/web` package, never `apps/web/tools/events`; no ad-hoc path expansion is accepted.

---

### Task 6: Extract typed analytics delivery and close hidden service authority

**Files:**
- Modify the generated-rule source and regenerate only its checked agent outputs after the exact owner approval: `.ruler/01-critical-rules.md`, `AGENTS.md`, and `CLAUDE.md`. The exception names exactly the two tenant-verified trusted wrappers and the one byte-frozen platform helper edge; it authorizes no fourth edge, browser use, response/log/event credential exposure, or generic service-role route operation.
- Modify/test the two reviewed trusted-wrapper importers: `apps/web/src/app/api/analytics/conversion/route.ts`, `route.test.ts`, `apps/web/src/app/api/events/route.ts`, and `route.pipeline.test.ts`. Split the existing 811-line events `route.test.ts` in this task into the at-most-300-line non-registering manifest suite plus `route.test-support.ts`, `route.validation.test.ts`, `route.persistence.test.ts`, `route.event-data.test.ts`, `route.fanout.test.ts`, and `route.timestamp.test.ts`.
- Create/test focused route helpers: `apps/web/src/app/api/analytics/conversion/conversion-route-merchant-context.ts`, `store-legacy-conversion-event.ts`, and `apps/web/src/app/api/events/resolve-legacy-fanout-context.ts`.
- Split/facade `apps/web/src/lib/analytics/analytics-platform-config.ts` and retain/update `analytics-platform-config.test.ts`; create/test `analytics-platform-config-types.ts`, `merge-analytics-platform-config.ts`, `fetch-analytics-platform-config.ts`, and `has-configured-analytics-platform.ts`.
- Split/facade `apps/web/src/lib/analytics/send-to-ad-platforms.ts` and retain/update both existing tests; create/test `ad-platform-conversion-event.ts`, `ad-platform-target.ts`, `ad-platform-results.ts`, `normalize-ad-platform-event-type.ts`, `ad-platform-event-mappings.ts`, `ad-platform-products.ts`, `send-facebook-ad-platform-event.ts`, `send-tiktok-ad-platform-event.ts`, `send-snapchat-ad-platform-event.ts`, and `send-configured-ad-platforms.ts`.
- Create/test the narrowly named Next-only wrapper: `apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts` and `trusted-server-ad-platform-fanout.test.ts`.
- Create/test the plain entitlement predicate: `apps/web/src/lib/merchant-has-feature.ts` and `merchant-has-feature.test.ts`; modify/test `apps/web/src/lib/merchant-feature-gates.ts` and `merchant-feature-gates.test.ts` so the Next-bound facade delegates to the pure predicate.
- Modify/test the branded delivery closure where the split changes signatures: `apps/web/src/lib/events/analytics-destination-adapter.ts`, `analytics-destination-adapter.test.ts`, `apps/web/src/lib/events/platform-destination-adapter.ts`, `platform-destination-adapter.test.ts`, `apps/web/src/lib/events/event-destination.ts`, `apps/web/src/lib/events/deliver-domain-event.ts`, `deliver-domain-event.test.ts`, `apps/web/src/scripts/process-event-deliveries.ts`, and `process-event-deliveries.test.ts`.
- Modify/test the separate reviewed platform-settings authority: `apps/web/src/app/api/platform/events/platform-event-forwarding.ts` and `platform-event-forwarding.test.ts`; it must not import the trusted legacy wrapper.
- Modify/test the already-client-injected paid-order closure where imports/types move: `apps/web/src/lib/trigger-purchase-conversion.ts` and `trigger-purchase-conversion.pipeline.test.ts`. Split the existing 376-line `trigger-purchase-conversion.test.ts` in this task into the at-most-300-line non-registering manifest suite plus `trigger-purchase-conversion.delivery.test.ts`, `trigger-purchase-conversion.currency.test.ts`, and `trigger-purchase-conversion.validation.test.ts`.
- Create/test `apps/web/tools/events/analytics-delivery-authority-manifest.ts`, `verify-analytics-delivery-authority.ts`, and their colocated tests.
- Do **not** modify the six byte-frozen route roots: the five caller-scoped roots `analytics/facebook-capi/route.ts`, `analytics/ga4/route.ts`, `analytics/tiktok/route.ts`, `analytics/snapchat/route.ts`, and `analytics/ads/route.ts`, plus the separately classified `platform/events/route.ts`.

**Produces:** One typed caller-injected configuration loader; one DB/Next/environment-free configured fanout; one `server-only` trusted wrapper imported by exactly the existing conversion and events routes; tenant verification before either route constructs a branded service client; one configuration read per durable delivery attempt; preserved caller-scoped compatibility routes; and a final static authority graph with no new importer. Every modified non-generated source finishes at or below 300 lines. P0 keeps every producer/worker flag disabled. H0-RUNNER preparation may begin after the P0 exact-head gate is green and owner/admin authority exists; H0 may begin only after that runner proof is green and the P0 exact application release is coherent. H1C1 later installs/extends the existing services while keeping them inert; `H0R-H1-MEASURE` alone owns queue/routing/delivery activation after its green H0R gate.

- [ ] **Step 0: Record the exact owner-approved security exception**

Do not begin Task 6 unless the owner has explicitly approved all three named legacy privileged request edges. Record that approval in the PR/task evidence, then amend `.ruler/01-critical-rules.md` with a narrow exception immediately after the absolute service-role rule and regenerate only `AGENTS.md` and `CLAUDE.md` from Ruler. The generated text must state:

- `analytics/conversion` and `events` may construct only the branded `createServiceClient('event-pipeline')`, only after independent verified tenant resolution, only for the exact provider-configuration projection and server-side legacy fanout;
- the existing byte-frozen `platform/events -> platform-event-forwarding.ts -> createAdminClient()` helper may retain only its exact platform-settings projection/edge;
- credential values may never enter responses, logs, event payloads, or client bundles; no raw/body-selected tenant may confer authority; no fourth importer/edge is permitted;
- the exception is legacy and must be removed or re-approved when durable queue-only delivery makes these request-bound privileged reads unnecessary.

Use only the frozen Ruler package and bounded agent set; first preview, then apply:

```bash
set -euo pipefail
ROOT=/Users/mac/Baci-app/.worktrees/cwv-critical-viewport-home
RULER_PACKAGE_JSON="$(pnpm root -g)/@intellectronica/ruler/package.json"
test "$(node -p 'require(process.argv[1]).version' "$RULER_PACKAGE_JSON")" = '0.3.31'
ruler apply --agents agentsmd,claude --with-mcp=false --gitignore=false \
  --backup=false --local-only --project-root "$ROOT" --dry-run
ruler apply --agents agentsmd,claude --with-mcp=false --gitignore=false \
  --backup=false --local-only --project-root "$ROOT"
```

Verify the generated outputs contain the same exception and no unrelated generated drift. Before continuing, require that the only rule-generation changes relative to the pre-Step-0 tree are `.ruler/01-critical-rules.md`, `AGENTS.md`, and `CLAUDE.md`; no MCP config, `.gitignore`, backup, nested agent, or other file may change. If approval is absent or narrower than all three edges, stop and regenerate this plan; do not reinterpret `Begin Implementation` as a security exception.

- [ ] **Step 1: Write failing authority, route, and one-read tests**

Write the tests before implementation and prove this exact red state:

- `trusted-server-ad-platform-fanout.test.ts` requires `(client: ServiceRoleClient, resolvedMerchantId, event, options?)`, rejects `event.merchant_id !== resolvedMerchantId` before any query/provider call, loads configuration exactly once, and passes the same immutable config into the pure sender. A normal `SupabaseClient<Database>` is a compile-time rejection.
- Conversion-route tests prove both durable-on and durable-off fanout reuse an independently route-resolved merchant id; a raw/resolved mismatch or absent/unverified context preserves the existing persistence/response path but skips privileged fanout with zero service construction, configuration read, or provider call.
- Events-route tests prove durable-on reuses its already-resolved context. With durable enqueue off, it performs the same tenant-resolution check solely for elevated legacy fanout without changing legacy persistence or response. Mismatch, missing context, or unverified context skips the wrapper and performs zero service-role I/O.
- The pure configured fanout test takes `Readonly<AnalyticsPlatformConfig>`, never constructs/queries a Supabase client, never reads environment credentials, and has no Next import. Existing mapping, LDU, timestamp, enhanced-matching, target filtering, `Promise.allSettled`, and result semantics remain covered. A four-delivery-row regression with one target per row produces four provider calls, not sixteen.
- Adapter tests inject the existing branded client and prove exactly one applicable configuration load per attempt. They pass the immutable config and claimed destination unchanged into the pure sender; no adapter opens a second client or re-reads credentials.
- Boundary tests require exactly two trusted-wrapper production importers, reject a third importer and every privileged construction before verified tenant resolution, reject any `'use client'` or browser graph reaching credential-bearing modules, and hash-bind all six route roots while classifying five as caller-scoped and one as the existing platform-settings authority.
- Modularity assertions fail on the current 302-line conversion route and 745-line `send-to-ad-platforms.ts`, and require each final touched runtime module to have a same-basename test unless it is type-only or a permitted thin facade.
- The events and trigger-conversion tests are first copied into their named successor suites, run green, then removed from the two oversized originals. Each original becomes an at-most-300-line split-manifest meta suite and must not import/register its successor suites.

```bash
set -euo pipefail
if pnpm --filter @baci/web exec vitest run \
  src/app/api/analytics/conversion/route.test.ts \
  src/app/api/events/route.test.ts \
  src/app/api/events/route.pipeline.test.ts \
  src/lib/analytics \
  src/lib/merchant-has-feature.test.ts \
  src/lib/merchant-feature-gates.test.ts \
  src/lib/events/analytics-destination-adapter.test.ts \
  src/lib/events/platform-destination-adapter.test.ts \
  src/lib/events/deliver-domain-event.test.ts \
  src/scripts/process-event-deliveries.test.ts \
  src/app/api/platform/events/platform-event-forwarding.test.ts \
  src/lib/trigger-purchase-conversion.test.ts \
  src/lib/trigger-purchase-conversion.pipeline.test.ts \
  tools/events/analytics-delivery-authority-manifest.test.ts \
  tools/events/verify-analytics-delivery-authority.test.ts; then
  echo 'expected analytics authority tests to fail before implementation' >&2
  exit 1
fi
```

Expected red: behavioral assertions—not syntax, missing-fixture, test-loader, or environment failures—identify the hidden service client/read, raw-body identity risk, second configuration load, oversized touched modules, missing pure entitlement/configured fanout, and absent exact-importer graph.

- [ ] **Step 2: Split configuration and provider delivery into typed single-purpose modules**

`fetchAnalyticsPlatformConfig(client,merchantId)` accepts a caller-injected `SupabaseClient<Database>` (the branded `ServiceRoleClient` is accepted where elevated authority is already proven), imports no factory, and uses only the manifest's explicit merchant entitlement, merchant credential, and feature-setting projections. `merchantHasFeature(input,'growth_integrations')` is the only entitlement predicate used by the loader and has no Next, React, environment, cache, Supabase, route, or browser dependency. The existing Next-specific `merchant-feature-gates.ts` facade delegates to it.

`mergeAnalyticsPlatformConfig`, `hasConfiguredAnalyticsPlatform`, event normalization/mappings, product transformation, and each provider sender move into one-primary-export modules. `sendConfiguredAdPlatforms(config,event,options)` accepts `Readonly<AnalyticsPlatformConfig>`; it has no Supabase, Next, route, browser, or environment-credential import and never constructs a client. Preserve provider failure isolation and all existing event mappings. `send-to-ad-platforms.ts` becomes an at-most-300-line typed compatibility facade with no database authority; it re-exports only the focused public types/helpers/sender needed by existing non-route code and tests.

`trustedServerAdPlatformFanout(client,resolvedMerchantId,event,options)` is the only module in this split allowed to import `server-only`. It accepts the already-created branded client, rejects raw/resolved merchant mismatch before I/O, loads configuration once, and invokes the pure configured sender once. It never resolves a tenant, constructs a client, reads request headers, or accepts body identity as authority.

The durable analytics adapter loads configuration once through its supplied branded client and calls the pure sender with the claimed destination as the only target. The platform adapter keeps its explicit `platform_settings` projection and one-read/one-provider semantics under the same typed branded client. `platform-event-forwarding.ts` retains its existing trusted platform-settings behavior but uses the typed factory/projection; the public `platform/events/route.ts` remains byte-identical. `trigger-purchase-conversion.ts` keeps its caller-injected client and existing enqueue/legacy behavior while consuming the split types/loader; it never adds a hidden client.

- [ ] **Step 3: Make the two legacy route authorities explicit and tenant-bound**

For `/api/analytics/conversion`, extract focused context/persistence helpers so `route.ts` finishes below 300 lines. The route resolves tenant identity with its caller-scoped client first, checks any claimed merchant against that resolved id, and only then calls `createServiceClient('event-pipeline')` and the trusted wrapper. Durable-on and durable-off paths share the same verified resolved id. The historical native/default-OgaBassey fallback may remain valid for legacy persistence/response compatibility, but it is not independently verified authority for service-role fanout; elevate only after host/path/domain context resolves the same merchant. Invalid or unverified elevated context skips only the legacy privileged fanout; it does not silently rewrite the existing persistence/response contract.

For `/api/events`, retain the verified context already produced in durable mode. When durable enqueue is off, run `resolveEventIngressContext` solely before elevated fanout. Keep legacy persistence and the response contract unchanged. Pass a copied event with `merchant_id: resolvedMerchantId` plus the separate resolved id to the wrapper. The wrapper still checks equality; defense in depth is mandatory. Construct no branded client when resolution fails, is unverified, or mismatches the body. When fanout is scheduled with Next `after()`, construct the branded client inside that callback only after the immutable verified result exists; never capture raw body identity as authority.

The route source importer set for `trusted-server-ad-platform-fanout.ts` is exactly:

```text
apps/web/src/app/api/analytics/conversion/route.ts
apps/web/src/app/api/events/route.ts
```

No provider compatibility route, dashboard route, shared/universal helper, browser module, or platform route may import that wrapper or service factory. The five caller-scoped roots and the separate platform route remain byte-identical to their Task 5 hashes; the existing platform helper's admin edge may not expand.

- [ ] **Step 4: Implement and run the final authority/modularity verifier**

`analytics-delivery-authority-manifest.ts` records the two trusted-wrapper importers, five caller-scoped roots/hashes, the byte-frozen platform route/helper authority, service/client authority classes, exact credential projections, pure fanout roots, and worker roots. `verifyAnalyticsDeliveryAuthority(workspaceRoot)` follows static imports/re-exports/literal dynamic imports across committed, staged, unstaged, and untracked TypeScript paths and proves:

- exactly two route roots reach the trusted wrapper and each reaches the branded service factory only after a verified-context branch;
- the five caller-scoped route roots are byte-identical, while the separately classified platform route is byte-identical and its exact helper-to-admin edge is unchanged;
- no `'use client'` graph reaches a credential projection, trusted wrapper, service/admin factory, or provider server module;
- no pure fanout/provider module imports Supabase, Next, environment credential access, or a client factory;
- only delivery-worker graphs pass `ServiceRoleClient` into durable configuration/provider closures;
- configuration is loaded once per adapter/wrapper path and never again in a provider sender;
- every changed non-generated runtime file is at most 300 lines, has one primary export/responsibility, and has colocated coverage;
- the importer set cannot expand through a new file, re-export, alias, or literal dynamic import.

Red fixtures add a third importer, a pre-verification factory call, a body-selected merchant, a second config read, a client-to-credential edge, a changed caller-scoped route byte, and an untracked oversized provider module. Each failure prints the complete path.

- [ ] **Step 5: Run focused tests, verify exact unchanged roots, and commit**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  src/app/api/analytics/conversion \
  src/app/api/events \
  src/lib/analytics \
  src/lib/merchant-has-feature.test.ts \
  src/lib/merchant-feature-gates.test.ts \
  src/lib/events/analytics-destination-adapter.test.ts \
  src/lib/events/platform-destination-adapter.test.ts \
  src/lib/events/deliver-domain-event.test.ts \
  src/scripts/process-event-deliveries.test.ts \
  src/app/api/platform/events/platform-event-forwarding.test.ts \
  src/lib/trigger-purchase-conversion.test.ts \
  src/lib/trigger-purchase-conversion.pipeline.test.ts \
  src/lib/trigger-purchase-conversion.delivery.test.ts \
  src/lib/trigger-purchase-conversion.currency.test.ts \
  src/lib/trigger-purchase-conversion.validation.test.ts \
  tools/events/analytics-delivery-authority-manifest.test.ts \
  tools/events/verify-analytics-delivery-authority.test.ts
pnpm --filter @baci/web exec tsx tools/events/verify-analytics-delivery-authority.ts
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-boundaries.ts
git diff --exit-code 9e3d1b14b1931a5e441fc23f0e5417c188056e47 -- \
  apps/web/src/app/api/analytics/facebook-capi/route.ts \
  apps/web/src/app/api/analytics/ga4/route.ts \
  apps/web/src/app/api/analytics/tiktok/route.ts \
  apps/web/src/app/api/analytics/snapchat/route.ts \
  apps/web/src/app/api/platform/events/route.ts \
  apps/web/src/app/api/analytics/ads/route.ts
git diff --check
typeset -a task6_paths=(
  .ruler/01-critical-rules.md
  AGENTS.md
  CLAUDE.md
  apps/web/src/app/api/analytics/conversion/route.ts
  apps/web/src/app/api/analytics/conversion/route.test.ts
  apps/web/src/app/api/analytics/conversion/conversion-route-merchant-context.ts
  apps/web/src/app/api/analytics/conversion/conversion-route-merchant-context.test.ts
  apps/web/src/app/api/analytics/conversion/store-legacy-conversion-event.ts
  apps/web/src/app/api/analytics/conversion/store-legacy-conversion-event.test.ts
  apps/web/src/app/api/events/route.ts
  apps/web/src/app/api/events/route.test.ts
  apps/web/src/app/api/events/route.pipeline.test.ts
  apps/web/src/app/api/events/route.test-support.ts
  apps/web/src/app/api/events/route.validation.test.ts
  apps/web/src/app/api/events/route.persistence.test.ts
  apps/web/src/app/api/events/route.event-data.test.ts
  apps/web/src/app/api/events/route.fanout.test.ts
  apps/web/src/app/api/events/route.timestamp.test.ts
  apps/web/src/app/api/events/resolve-legacy-fanout-context.ts
  apps/web/src/app/api/events/resolve-legacy-fanout-context.test.ts
  apps/web/src/app/api/platform/events/platform-event-forwarding.ts
  apps/web/src/app/api/platform/events/platform-event-forwarding.test.ts
  apps/web/src/lib/analytics/analytics-platform-config.ts
  apps/web/src/lib/analytics/analytics-platform-config.test.ts
  apps/web/src/lib/analytics/analytics-platform-config-types.ts
  apps/web/src/lib/analytics/merge-analytics-platform-config.ts
  apps/web/src/lib/analytics/merge-analytics-platform-config.test.ts
  apps/web/src/lib/analytics/fetch-analytics-platform-config.ts
  apps/web/src/lib/analytics/fetch-analytics-platform-config.test.ts
  apps/web/src/lib/analytics/has-configured-analytics-platform.ts
  apps/web/src/lib/analytics/has-configured-analytics-platform.test.ts
  apps/web/src/lib/analytics/send-to-ad-platforms.ts
  apps/web/src/lib/analytics/send-to-ad-platforms.test.ts
  apps/web/src/lib/analytics/send-to-ad-platforms.facebook.test.ts
  apps/web/src/lib/analytics/ad-platform-conversion-event.ts
  apps/web/src/lib/analytics/ad-platform-target.ts
  apps/web/src/lib/analytics/ad-platform-results.ts
  apps/web/src/lib/analytics/normalize-ad-platform-event-type.ts
  apps/web/src/lib/analytics/normalize-ad-platform-event-type.test.ts
  apps/web/src/lib/analytics/ad-platform-event-mappings.ts
  apps/web/src/lib/analytics/ad-platform-event-mappings.test.ts
  apps/web/src/lib/analytics/ad-platform-products.ts
  apps/web/src/lib/analytics/ad-platform-products.test.ts
  apps/web/src/lib/analytics/send-facebook-ad-platform-event.ts
  apps/web/src/lib/analytics/send-facebook-ad-platform-event.test.ts
  apps/web/src/lib/analytics/send-tiktok-ad-platform-event.ts
  apps/web/src/lib/analytics/send-tiktok-ad-platform-event.test.ts
  apps/web/src/lib/analytics/send-snapchat-ad-platform-event.ts
  apps/web/src/lib/analytics/send-snapchat-ad-platform-event.test.ts
  apps/web/src/lib/analytics/send-configured-ad-platforms.ts
  apps/web/src/lib/analytics/send-configured-ad-platforms.test.ts
  apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.ts
  apps/web/src/lib/analytics/trusted-server-ad-platform-fanout.test.ts
  apps/web/src/lib/merchant-has-feature.ts
  apps/web/src/lib/merchant-has-feature.test.ts
  apps/web/src/lib/merchant-feature-gates.ts
  apps/web/src/lib/merchant-feature-gates.test.ts
  apps/web/src/lib/events/analytics-destination-adapter.ts
  apps/web/src/lib/events/analytics-destination-adapter.test.ts
  apps/web/src/lib/events/platform-destination-adapter.ts
  apps/web/src/lib/events/platform-destination-adapter.test.ts
  apps/web/src/lib/events/event-destination.ts
  apps/web/src/lib/events/deliver-domain-event.ts
  apps/web/src/lib/events/deliver-domain-event.test.ts
  apps/web/src/scripts/process-event-deliveries.ts
  apps/web/src/scripts/process-event-deliveries.test.ts
  apps/web/src/lib/trigger-purchase-conversion.ts
  apps/web/src/lib/trigger-purchase-conversion.test.ts
  apps/web/src/lib/trigger-purchase-conversion.pipeline.test.ts
  apps/web/src/lib/trigger-purchase-conversion.delivery.test.ts
  apps/web/src/lib/trigger-purchase-conversion.currency.test.ts
  apps/web/src/lib/trigger-purchase-conversion.validation.test.ts
  apps/web/tools/events/analytics-delivery-authority-manifest.ts
  apps/web/tools/events/analytics-delivery-authority-manifest.test.ts
  apps/web/tools/events/verify-analytics-delivery-authority.ts
  apps/web/tools/events/verify-analytics-delivery-authority.test.ts
)
git add -- "${task6_paths[@]}"
expected_task6_paths="$(printf '%s\n' "${task6_paths[@]}" | LC_ALL=C sort -u)"
actual_task6_paths="$(git diff --cached --name-only | LC_ALL=C sort)"
test "$actual_task6_paths" = "$expected_task6_paths"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "refactor: bound analytics delivery authority"
```

Expected: both routes preserve behavior while privileged fanout is independently tenant-bound; exactly two trusted-wrapper importers remain; durable delivery has one config read and no hidden client; all five caller-scoped roots and the separately classified platform route are unchanged; the platform helper's existing admin edge does not expand; the 302-line route and 745-line fanout are decomposed; no touched non-generated file exceeds 300 lines; every flag remains inert; and H0 follows the reviewed P0/H0-RUNNER sequence.

---

### Task 7: Modularize the bounded #3077 worker and route tree

**Files:**
- Split/facade `apps/web/src/lib/events/event-pipeline-config.ts` and retain/update `event-pipeline-config.test.ts`; move behavior into files under `apps/web/src/lib/events/`: `bounded-env-integer.ts`, `event-pipeline-enqueue-enabled.ts`, `event-pipeline-delivery-enabled.ts`, `event-pipeline-routing-mode.ts`, `event-pipeline-active-destinations.ts`, `event-pipeline-canary-merchant.ts`, `legacy-analytics-fanout-disabled.ts`, `unverified-event-telemetry-enabled.ts`, `event-delivery-max-attempts.ts`, `event-delivery-concurrency.ts`, and `event-ingress-max-reads.ts`, each with a same-basename test where runtime logic exists.
- Split/facade `apps/web/src/lib/events/event-redaction.ts`, retain/update `event-redaction.test.ts`, and create `apps/web/src/lib/events/sanitize-event-url.ts`/`.test.ts` and `apps/web/src/lib/events/redact-event-payload.ts`/`.test.ts`.
- Split/facade `apps/web/src/lib/events/event-route-registry.ts`, retain/update `event-route-registry.test.ts`, and create files under `apps/web/src/lib/events/`: type-only `event-route-destination.ts`, `event-route-resolution.ts`/`.test.ts`, `analytics-domain-event-name.ts`/`.test.ts`, `platform-domain-event-name.ts`/`.test.ts`, `client-analytics-domain-event-name.ts`/`.test.ts`, and `client-platform-domain-event-name.ts`/`.test.ts`.
- Split/facade `apps/web/src/schemas/event-dead-letter.ts`, retain/update `event-dead-letter.test.ts`, and create files under `apps/web/src/schemas/`: `event-dead-letter-query-schema.ts`, `event-dead-letter-replay-schema.ts`, `event-pipeline-list-result-schema.ts`, `event-pipeline-operations-schema.ts`, and `event-pipeline-replay-ids-schema.ts`, each with a same-basename test.
- Create runtime schemas in the mandated schema directory: `apps/web/src/schemas/domain-event-worker-message-schema.ts`/`.test.ts` and `claimed-event-delivery-schema.ts`/`.test.ts`; no inline Zod schema remains in a script.
- Split `apps/web/src/scripts/process-domain-events.ts` into files under `apps/web/src/scripts/`: type-only `domain-event-worker-message.ts`, `domain-event-worker-batch.ts`/`.test.ts`, `domain-event-worker.ts`/`.test.ts`, and the thin original CLI entry with its retained test. The batch imports the dedicated message schema.
- Split `apps/web/src/scripts/process-event-deliveries.ts` into files under `apps/web/src/scripts/`: `event-delivery-claim-batch-size.ts`/`.test.ts`, `process-claimed-event-delivery.ts`/`.test.ts`, `event-delivery-worker.ts`/`.test.ts`, and the thin original CLI entry with its retained test. These modules import the dedicated claimed-delivery schema.
- Split `supabase/tests/domain_event_pipeline.sql` into `supabase/tests/domain_event_ingress_pipeline.sql`, `supabase/tests/event_delivery_pipeline.sql`, and the thin original `\ir` driver.
- Create/test: `apps/web/tools/events/verify-event-pipeline-modularity.ts` and `.test.ts`.
- Modify: `apps/web/tsconfig.tools-workers.json` to its final exact tools/events/worker include surface.

**Produces:** Finished P0 touched tree at or below 300 lines and one primary responsibility/export per focused module, without behavior change, plus a final dedicated tools/workers project that typechecks every new worker module before this task commits.

- [ ] **Step 1: Write the failing modularity test**

The verifier derives #3077-created paths from the frozen merge and takes the union of committed `git diff --name-only BASE_SHA...HEAD`, unstaged/tracked working-tree changes, staged changes, and relevant `git ls-files --others --exclude-standard` paths. Its explicit `--include-working-tree` mode is mandatory before each task commit, so newly created untracked split modules cannot escape. It excludes generated `src/types/supabase.ts` and evidence Markdown/JSON; checks line count for TypeScript, TSX, MJS, shell, SQL, and config; parses TypeScript exports; permits only Next route method sets, type-only files, and named thin re-export facades; and requires colocated tests for every new runtime module/schema. Red coverage creates an untracked oversized file and an untested runtime utility in a temporary fixture worktree and requires both diagnostics. Against the remaining frozen P0 scope it must fail on the 304-line `supabase/tests/domain_event_pipeline.sql` plus the named multi-primary modules. Task 6 has already decomposed the 811-line events test, 376-line trigger-conversion test, 745-line provider fanout, and 302-line conversion route; this verifier rechecks those final files and every Task 6 split rather than deferring them.

After writing the verifier/tests and before splitting files, prove the intended red state:

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run tools/events/verify-event-pipeline-modularity.test.ts
if pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-modularity.ts --include-working-tree; then
  echo 'expected current bounded P0 tree to fail modularity' >&2
  exit 1
fi
```

Expected red: the unit suite is green for the verifier itself, while the real-tree invocation fails specifically on the remaining SQL size and named multi-primary responsibilities above. Any unrelated path, already-clean Task 6 path, missing fixture, or parser crash is a harness failure to fix before proceeding.

- [ ] **Step 2: Move tests without changing assertions**

For SQL, copy each behavior block into its child, run both children green, then delete the duplicated blocks from the original. Each child is a standalone `BEGIN; DO $$ ... $$; ROLLBACK;` regression with distinct UUID fixtures; the driver contains only `\set ON_ERROR_STOP on` and two `\ir` statements. Task 6 already owns the two TypeScript test splits and their non-registering manifest suites.

- [ ] **Step 3: Move runtime functions behind compatibility facades**

Move one function/schema/worker responsibility at a time, update the facade re-export, run its existing test after every move, and preserve public import names. Worker CLI entrypoints retain `dotenv/config`, `pathToFileURL` invocation detection, signals, disabled-by-default behavior, backoff, heartbeat semantics, and `--once` behavior.

After each RPC-bearing move, run `verify-event-pipeline-boundaries.ts` against the working tree. Its Task 5 synthetic untracked/moved-caller regression plus Task 7's invocation against the actual new `domain-event-worker*` and `event-delivery-worker*` paths is the executable proof that split modules remain governed; a moved literal RPC that is not classified fails before the task can commit.

- [ ] **Step 4: Expand and prove the final dedicated tools/workers project**

Replace Task 3's DB-only `include` array with this exact final array while retaining its compiler options and excludes:

```json
{
  "include": [
    "tools/events/**/*.ts",
    "tools/db/**/*.ts",
    "src/scripts/process-domain-events.ts",
    "src/scripts/process-domain-events.test.ts",
    "src/scripts/domain-event-worker-message.ts",
    "src/scripts/domain-event-worker-batch.ts",
    "src/scripts/domain-event-worker-batch.test.ts",
    "src/scripts/domain-event-worker.ts",
    "src/scripts/domain-event-worker.test.ts",
    "src/scripts/process-event-deliveries.ts",
    "src/scripts/process-event-deliveries.test.ts",
    "src/scripts/event-delivery-claim-batch-size.ts",
    "src/scripts/event-delivery-claim-batch-size.test.ts",
    "src/scripts/process-claimed-event-delivery.ts",
    "src/scripts/process-claimed-event-delivery.test.ts",
    "src/scripts/event-delivery-worker.ts",
    "src/scripts/event-delivery-worker.test.ts"
  ]
}
```

The broad `tools/**/*.ts` glob remains forbidden. Run `pnpm --filter @baci/web typecheck:tools-workers` after every include/import correction and require it green before staging; Task 8 may not defer typing any Task 7 source.

- [ ] **Step 5: Verify modularity, dedicated type safety, and commit**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run src/lib/events src/schemas src/scripts src/app/api/events src/lib/trigger-purchase-conversion
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-modularity.ts --include-working-tree
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-boundaries.ts
pnpm --filter @baci/web typecheck:tools-workers
pnpm --filter @baci/web run db:replay:chronological \
  --sql-check supabase/tests/domain_event_pipeline.sql
pnpm --filter @baci/web run db:replay:production-effect \
  --sql-check supabase/tests/domain_event_pipeline.sql
git diff --check
typeset -a task7_paths=(
  apps/web/src/lib/events/event-pipeline-config.ts
  apps/web/src/lib/events/event-pipeline-config.test.ts
  apps/web/src/lib/events/bounded-env-integer.ts
  apps/web/src/lib/events/bounded-env-integer.test.ts
  apps/web/src/lib/events/event-pipeline-enqueue-enabled.ts
  apps/web/src/lib/events/event-pipeline-enqueue-enabled.test.ts
  apps/web/src/lib/events/event-pipeline-delivery-enabled.ts
  apps/web/src/lib/events/event-pipeline-delivery-enabled.test.ts
  apps/web/src/lib/events/event-pipeline-routing-mode.ts
  apps/web/src/lib/events/event-pipeline-routing-mode.test.ts
  apps/web/src/lib/events/event-pipeline-active-destinations.ts
  apps/web/src/lib/events/event-pipeline-active-destinations.test.ts
  apps/web/src/lib/events/event-pipeline-canary-merchant.ts
  apps/web/src/lib/events/event-pipeline-canary-merchant.test.ts
  apps/web/src/lib/events/legacy-analytics-fanout-disabled.ts
  apps/web/src/lib/events/legacy-analytics-fanout-disabled.test.ts
  apps/web/src/lib/events/unverified-event-telemetry-enabled.ts
  apps/web/src/lib/events/unverified-event-telemetry-enabled.test.ts
  apps/web/src/lib/events/event-delivery-max-attempts.ts
  apps/web/src/lib/events/event-delivery-max-attempts.test.ts
  apps/web/src/lib/events/event-delivery-concurrency.ts
  apps/web/src/lib/events/event-delivery-concurrency.test.ts
  apps/web/src/lib/events/event-ingress-max-reads.ts
  apps/web/src/lib/events/event-ingress-max-reads.test.ts
  apps/web/src/lib/events/event-redaction.ts
  apps/web/src/lib/events/event-redaction.test.ts
  apps/web/src/lib/events/sanitize-event-url.ts
  apps/web/src/lib/events/sanitize-event-url.test.ts
  apps/web/src/lib/events/redact-event-payload.ts
  apps/web/src/lib/events/redact-event-payload.test.ts
  apps/web/src/lib/events/event-route-registry.ts
  apps/web/src/lib/events/event-route-registry.test.ts
  apps/web/src/lib/events/event-route-destination.ts
  apps/web/src/lib/events/event-route-resolution.ts
  apps/web/src/lib/events/event-route-resolution.test.ts
  apps/web/src/lib/events/analytics-domain-event-name.ts
  apps/web/src/lib/events/analytics-domain-event-name.test.ts
  apps/web/src/lib/events/platform-domain-event-name.ts
  apps/web/src/lib/events/platform-domain-event-name.test.ts
  apps/web/src/lib/events/client-analytics-domain-event-name.ts
  apps/web/src/lib/events/client-analytics-domain-event-name.test.ts
  apps/web/src/lib/events/client-platform-domain-event-name.ts
  apps/web/src/lib/events/client-platform-domain-event-name.test.ts
  apps/web/src/schemas/event-dead-letter.ts
  apps/web/src/schemas/event-dead-letter.test.ts
  apps/web/src/schemas/event-dead-letter-query-schema.ts
  apps/web/src/schemas/event-dead-letter-query-schema.test.ts
  apps/web/src/schemas/event-dead-letter-replay-schema.ts
  apps/web/src/schemas/event-dead-letter-replay-schema.test.ts
  apps/web/src/schemas/event-pipeline-list-result-schema.ts
  apps/web/src/schemas/event-pipeline-list-result-schema.test.ts
  apps/web/src/schemas/event-pipeline-operations-schema.ts
  apps/web/src/schemas/event-pipeline-operations-schema.test.ts
  apps/web/src/schemas/event-pipeline-replay-ids-schema.ts
  apps/web/src/schemas/event-pipeline-replay-ids-schema.test.ts
  apps/web/src/schemas/domain-event-worker-message-schema.ts
  apps/web/src/schemas/domain-event-worker-message-schema.test.ts
  apps/web/src/schemas/claimed-event-delivery-schema.ts
  apps/web/src/schemas/claimed-event-delivery-schema.test.ts
  apps/web/src/scripts/process-domain-events.ts
  apps/web/src/scripts/process-domain-events.test.ts
  apps/web/src/scripts/domain-event-worker-message.ts
  apps/web/src/scripts/domain-event-worker-batch.ts
  apps/web/src/scripts/domain-event-worker-batch.test.ts
  apps/web/src/scripts/domain-event-worker.ts
  apps/web/src/scripts/domain-event-worker.test.ts
  apps/web/src/scripts/process-event-deliveries.ts
  apps/web/src/scripts/process-event-deliveries.test.ts
  apps/web/src/scripts/event-delivery-claim-batch-size.ts
  apps/web/src/scripts/event-delivery-claim-batch-size.test.ts
  apps/web/src/scripts/process-claimed-event-delivery.ts
  apps/web/src/scripts/process-claimed-event-delivery.test.ts
  apps/web/src/scripts/event-delivery-worker.ts
  apps/web/src/scripts/event-delivery-worker.test.ts
  supabase/tests/domain_event_pipeline.sql
  supabase/tests/domain_event_ingress_pipeline.sql
  supabase/tests/event_delivery_pipeline.sql
  apps/web/tools/events/verify-event-pipeline-modularity.ts
  apps/web/tools/events/verify-event-pipeline-modularity.test.ts
  apps/web/tsconfig.tools-workers.json
)
git add -- "${task7_paths[@]}"
expected_task7_paths="$(printf '%s\n' "${task7_paths[@]}" | LC_ALL=C sort -u)"
actual_task7_paths="$(git diff --cached --name-only | LC_ALL=C sort)"
test "$actual_task7_paths" = "$expected_task7_paths"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "refactor: modularize durable event pipeline runtime"
```

Expected: every in-scope non-generated file is at most 300 lines; the final dedicated project typechecks every DB/event tool and every Task 7 worker entry/runtime/test path before staging; both chronological and production-effect disposable replays execute the thin SQL driver and both standalone child regressions successfully; unrelated pre-existing debt is reported as deferred and unchanged.

---

### Task 8: Wire the final tools/workers project into the repository typecheck gate

**Files:**
- Modify: `apps/web/package.json`
- Create: `.github/scripts/tools-worker-typecheck-contract.test.mjs`
- Modify: `.github/scripts/resolve-ci-test-plan-config.test.mjs`

**Produces:** proof that the unchanged CI Quality Gate reaches Task 7's already-final and independently green tools/events/worker TypeScript project through normal web `typecheck`; this task does not change the project's include surface.

- [ ] **Step 1: Write the failing Node contract test**

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('the Quality Gate reaches the tools and worker TypeScript project', async () => {
  const pkg = JSON.parse(await readFile('apps/web/package.json', 'utf8'));
  const toolsTsconfig = JSON.parse(await readFile('apps/web/tsconfig.tools-workers.json', 'utf8'));
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8');
  assert.match(pkg.scripts.typecheck, /typecheck:tools-workers/);
  assert.equal(pkg.scripts['typecheck:tools-workers'], 'tsc --noEmit -p tsconfig.tools-workers.json');
  assert.deepEqual(toolsTsconfig.compilerOptions.types, [
    'node', 'vitest/globals', '@testing-library/jest-dom', 'google.maps',
  ]);
  assert.deepEqual(toolsTsconfig.include, [
    'tools/events/**/*.ts',
    'tools/db/**/*.ts',
    'src/scripts/process-domain-events.ts',
    'src/scripts/process-domain-events.test.ts',
    'src/scripts/domain-event-worker-message.ts',
    'src/scripts/domain-event-worker-batch.ts',
    'src/scripts/domain-event-worker-batch.test.ts',
    'src/scripts/domain-event-worker.ts',
    'src/scripts/domain-event-worker.test.ts',
    'src/scripts/process-event-deliveries.ts',
    'src/scripts/process-event-deliveries.test.ts',
    'src/scripts/event-delivery-claim-batch-size.ts',
    'src/scripts/event-delivery-claim-batch-size.test.ts',
    'src/scripts/process-claimed-event-delivery.ts',
    'src/scripts/process-claimed-event-delivery.test.ts',
    'src/scripts/event-delivery-worker.ts',
    'src/scripts/event-delivery-worker.test.ts',
  ]);
  assert.ok(!toolsTsconfig.include.includes('tools/**/*.ts'));
  assert.match(workflow, /pnpm turbo typecheck/);
});
```

Run the contract as an asserted red gate:

```bash
set -euo pipefail
if node --test .github/scripts/tools-worker-typecheck-contract.test.mjs; then
  echo 'expected tools/worker CI contract to fail before implementation' >&2
  exit 1
fi
```

Expected red: Task 7 already provides the final include list and a green dedicated script, so the contract fails specifically and only because normal web `typecheck` does not yet invoke `typecheck:tools-workers`. The test still proves the final exact include list and rejects the broad `tools/**/*.ts` glob because unrelated base `tools/seo` files are outside P0 scope. An include mismatch, dedicated typecheck failure, syntax error, or test-loader failure is a pre-existing Task 7 gate failure, not the intended Task 8 red.

- [ ] **Step 2: Wire the already-final dedicated project into the normal gate**

Leave `apps/web/tsconfig.tools-workers.json` byte-unchanged from Task 7. Set web scripts exactly:

```json
{
  "typecheck": "tsc --noEmit && pnpm typecheck:tools-workers",
  "typecheck:tools-workers": "tsc --noEmit -p tsconfig.tools-workers.json"
}
```

Add `import './tools-worker-typecheck-contract.test.mjs';` to the already CI-invoked config test so no workflow trigger list changes are required.

- [ ] **Step 3: Verify and commit**

```bash
set -euo pipefail
node --test .github/scripts/tools-worker-typecheck-contract.test.mjs
node --test .github/scripts/resolve-ci-test-plan-config.test.mjs
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo typecheck
git diff --check
typeset -a task8_paths=(
  apps/web/package.json
  .github/scripts/tools-worker-typecheck-contract.test.mjs
  .github/scripts/resolve-ci-test-plan-config.test.mjs
)
git add -- "${task8_paths[@]}"
test "$(git diff --cached --name-only | LC_ALL=C sort)" = \
  "$(printf '%s\n' "${task8_paths[@]}" | LC_ALL=C sort -u)"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "ci: typecheck event tools and workers"
```

Expected: Task 7's unchanged final dedicated project and the normal web project both pass, and the Node contract proves CI reachability without changing the include surface.

---

### Task 8.5: Attest the exact post-replay production suffix

**Files:**
- Create: `apps/web/tools/db/post-replay-production-attestation-receipt.ts`
- Create: `apps/web/tools/db/verify-post-replay-production-attestation.ts`
- Create: `apps/web/tools/db/verify-post-replay-production-attestation.test.ts`
- Create: `apps/web/tools/db/create-supabase-management-read-only-executor.ts`
- Create: `apps/web/tools/db/create-supabase-management-read-only-executor.test.ts`
- Create: `apps/web/tools/db/attest-post-replay-production.ts`
- Create: `apps/web/tools/db/attest-post-replay-production.test.ts`
- Modify: `apps/web/tools/db/capture-supabase-history-ledger.ts`
- Modify: `apps/web/package.json`
- Modify: this plan only to record the regenerated gate

**Produces:** A no-write, fail-closed current-production attestation that preserves the historical replay receipts. No migration, replay materialization, fixture refresh, or activation.

- [ ] **Step 1: Freeze the failing pure contract**

Write red tests that reject any change to the frozen `442`-row prefix, the exact twelve manifest-derived suffix rows, full `454`-row ledger hash/tail, query/scope/server contract, `76`/`19` safety summary, live effect hash, or singleton before/after component digest. Also reject missing, reordered, duplicated, or additional suffix rows and every second changed component.

- [ ] **Step 2: Add the read-only executor and attestation runtime**

Extract the existing sanitized Supabase Management API read-only executor into one tested module and reuse it from the historical capture. The new attestation reads the ledger and the reviewed effect query only through `/database/query/read-only`, verifies the replay manifest with `pendingRepairState:materialized`, compares current effects in `classify` mode against the frozen production fixture, and passes only the secret-free digest result into the pure verifier. It must not invoke the Supabase CLI, write an output, or expose raw database values.

Add the exact script:

```json
"db:replay:attest-post-replay": "tsx tools/db/attest-post-replay-production.ts"
```

- [ ] **Step 3: Verify, review, and commit the remediation**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run \
  tools/db/create-supabase-management-read-only-executor.test.ts \
  tools/db/verify-post-replay-production-attestation.test.ts \
  tools/db/attest-post-replay-production.test.ts \
  tools/db/capture-supabase-history-ledger-boundaries.test.ts
pnpm --filter @baci/web typecheck:tools-workers
pnpm --filter @baci/web run db:replay:attest-post-replay
pnpm --filter @baci/web exec biome check \
  tools/db/create-supabase-management-read-only-executor.ts \
  tools/db/create-supabase-management-read-only-executor.test.ts \
  tools/db/verify-post-replay-production-attestation.ts \
  tools/db/verify-post-replay-production-attestation.test.ts \
  tools/db/post-replay-production-attestation-receipt.ts \
  tools/db/attest-post-replay-production.ts \
  tools/db/attest-post-replay-production.test.ts \
  tools/db/capture-supabase-history-ledger.ts
git diff --check
```

Expected: the historical receipt remains byte-identical; the current attestation reports only safe counts, tails, hashes, and the exact singleton delta; neither protected `cli-latest` path changes. Run one non-overlapping local CodeRabbit review, fix every valid critical/high finding, commit normally without amending, and obtain a fresh independent exact-head review before Task 9.

---

### Task 9: Run cumulative P0 gates and produce the exact-head handoff

**Files:**
- Modify: `docs/architecture/durable-event-pipeline-p0-path-inventory.md` only to append final receipts, current-head verification, and read-only production observations.

**Produces:** A reviewable P0 PR handoff. No deploy and no activation.

- [ ] **Step 1: Repeat replay and immutable-history gates**

```bash
set -euo pipefail
pnpm --filter @baci/web exec vitest run tools/db
pnpm --filter @baci/web run db:replay:attest-post-replay
pnpm --filter @baci/web run db:replay:capture-production-effect --verify-only
pnpm --filter @baci/web run db:replay:chronological \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql
pnpm --filter @baci/web run db:replay:production-effect \
  --sql-check supabase/migrations/tests/reconcile_order_fulfillment_timestamps.sql \
  --sql-check supabase/migrations/tests/restore_merchants_anon_public_columns.sql \
  --sql-check supabase/tests/domain_event_pipeline.sql
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-boundaries.ts
pnpm --filter @baci/web exec tsx tools/events/verify-analytics-delivery-authority.ts
pnpm --filter @baci/web exec tsx tools/events/verify-event-pipeline-modularity.ts
```

Expected: schema-v5 production provenance remains byte-identical with count `31`; the separate alias receipt remains outside effect records; both immutable replay effects equal frozen effect `71cba5629959c75352726e26cafcbfec8de99b1b52d10e6ad70fd85f07e4d253`; the current read-only attestation proves the exact unchanged `442`-row prefix, twelve-row manifest suffix, `454`-row live ledger, all `76`/`19` safety assertions, and only the recorded one-constraint delta to live effect `dd1f3d2e2b84fd1fe866eb3bd1baa44fc5edcf67aa97a53d1984e5d0b312bc70`. The 26 immutable #3077 hashes are intact; all 19 public function contracts/effects are proven; and there is no bare-client, unapproved authority/import expansion, escape, or modularity finding. The five caller-scoped roots and separate platform route/helper class remain exact-byte/edge clean, the trusted-wrapper importer set is exactly conversion/events, and the final analytics authority graph is clean. No result is described as total historical order proof or current-production replay convergence.

- [ ] **Step 2: Run all 64 frozen regression artifacts**

```bash
set -euo pipefail
rg '^apps/web/' apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt \
  | sed 's#^apps/web/##' \
  | xargs pnpm --filter @baci/web exec vitest run
pnpm --filter @baci/web exec vitest run \
  src/app/api/events/route.validation.test.ts \
  src/app/api/events/route.persistence.test.ts \
  src/app/api/events/route.event-data.test.ts \
  src/app/api/events/route.fanout.test.ts \
  src/app/api/events/route.timestamp.test.ts \
  src/lib/trigger-purchase-conversion.delivery.test.ts \
  src/lib/trigger-purchase-conversion.currency.test.ts \
  src/lib/trigger-purchase-conversion.validation.test.ts
pnpm --filter @baci/shared exec vitest run src/contracts/domain-event.test.ts
rg '^vps-workers/.*test\.mjs$' apps/web/tools/events/fixtures/event-pipeline-regression-paths.txt \
  | xargs node --test
```

Expected: 57 exact frozen web paths (including the two non-duplicating split-manifest meta suites), all eight successor behavior suites, one exact shared path, and five exact VPS paths pass. The one SQL path is executed by each fail-fast replay in Step 1, completing the exact 64-artifact inventory plus its explicit one-to-many successors; no artifact is replaced by a broad command alone.

- [ ] **Step 3: Run repository cumulative gates**

```bash
set -euo pipefail
node --test .github/scripts/tools-worker-typecheck-contract.test.mjs
pnpm --filter @baci/web typecheck:tools-workers
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
git diff --check
```

Expected: zero new lint/type errors and all tests green. Known warnings are recorded verbatim and must be unrelated to P0.

- [ ] **Step 4: Verify production effects read-only and inert state**

Use the Management API with a hardcoded SELECT-only query to run the same effect assertions against production. Assert both fulfillment columns; both duplicate-version effects; Paystack and quiz final RPCs; all #3077 tables/functions/grants/policies/PGMQ wrappers; no anon grant on provider secrets; all `domain_event_producer_config.enabled` values false. Do not update data.

The read-only worker proof is mandatory, not optional. Over the existing SSH transport, run exactly:

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 bassey@82.29.190.219 \
  'systemctl --user show baci-domain-event-router.service baci-event-delivery-worker.service --property=Id,LoadState,ActiveState,SubState,FragmentPath --no-pager'
```

The frozen pre-P0 result for exact base `9e3d1b14b1931a5e441fc23f0e5417c188056e47` is `LoadState=not-found`, `ActiveState=inactive`, `SubState=dead`, and empty `FragmentPath` for both exact unit names. Record that exact absence in the final evidence. Never request or print `ExecStart`, `Environment`, unit contents, or a command line because they can contain secrets. If either unit is present at handoff time, stop rather than accepting drift and regenerate the execution plan: the regenerated proof must use an allowlisted unit-to-repository script-path map plus remote `sha256sum`, print only allowlisted boolean/routing flag values, and query `event_pipeline_worker_heartbeats` for worker name/timestamps/error code/count. Do not restart, enable, or read secrets. A present unit without source-SHA, effective-flag, heartbeat, and schema-compatibility proof is a blocker; Task 9 may not infer inertness.

- [ ] **Step 5: Run local CodeRabbit**

```bash
set -euo pipefail
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t all --base-commit cfa062a09bcb737c09e4171730615364afff6e68
else
  coderabbit review --agent -t all --base-commit cfa062a09bcb737c09e4171730615364afff6e68
fi
```

Expected: no critical/high finding. Any valid critical/high finding is a hard stop. Do not edit, stage, amend, reset, or rewrite history inside Task 9: doing so would invalidate the fixed fourteen-commit graph (eleven non-merge P0 commits plus three normal integration merges) and exact non-merge subject gate. Regenerate this derived plan with an explicit remediation task, revised commit count/subjects/hash bindings, and a blocker-only review; only then may implementation resume. Task 9 may stage only its evidence Markdown.

- [ ] **Step 6: Commit final evidence and push normally**

```bash
set -euo pipefail
git add docs/architecture/durable-event-pipeline-p0-path-inventory.md
test "$(git diff --cached --name-only)" = \
  "docs/architecture/durable-event-pipeline-p0-path-inventory.md"
if coderabbit review --help 2>&1 | rg -q -- '--prompt-only'; then
  coderabbit review --prompt-only -t uncommitted
else
  coderabbit review --agent -t uncommitted
fi
git commit -m "docs: record event pipeline recovery evidence"
git diff --cached --quiet
test -z "$(git status --short --untracked-files=all | rg -v '^( M apps/web/supabase/[.]temp/cli-latest| M supabase/[.]temp/cli-latest)$' || true)"
test "$(shasum -a 256 docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md | awk '{print $1}')" = "3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca"
test "$(shasum -a 256 apps/web/tools/db/fixtures/production-effect-provenance.json | awk '{print $1}')" = "2e1be70f5cb3c2fdc049605343ea6d93b617493962920debaf5493668e4f03b0"
test "$(shasum -a 256 apps/web/tools/db/fixtures/migration-name-alias-deploy-repair.json | awk '{print $1}')" = "ba97d2e25bb8d2f43e0a4fdfdb1fa37586fd9c7397458fa8dc0c0c5858288ade"
jq -e '.schemaVersion == 4 and
  .logSanitizer.version == "github-actions-migration-semantic-lines-v1" and
  .coverage == "partial-order-effect-replay" and .exceptionalRecordCount == 31' \
  apps/web/tools/db/fixtures/production-effect-provenance.json
gh run view 29417244012 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "9e3d1b14b1931a5e441fc23f0e5417c188056e47" and
  .status == "completed" and .conclusion == "success" and
  any(.jobs[]; .databaseId == 87358367070 and .name == "db-migrations" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87358421368 and .name == "deploy-production" and .conclusion == "skipped")'
gh run view 29507413915 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "dae4e734f747717654125a16c1527b7f6366ce87" and
  .status == "completed" and .conclusion == "success" and
  any(.jobs[]; .databaseId == 87651680060 and .name == "db-migrations" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87651744254 and .name == "deploy-production" and .conclusion == "skipped")'
gh run view 29507418729 --json headSha,status,conclusion | jq -e '
  .headSha == "dae4e734f747717654125a16c1527b7f6366ce87" and
  .status == "completed" and .conclusion == "success"'
gh run view 29518515260 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "cfa062a09bcb737c09e4171730615364afff6e68" and
  .status == "completed" and .conclusion == "success" and
  any(.jobs[]; .databaseId == 87689487486 and .name == "db-migrations" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87689487532 and .name == "changes" and .conclusion == "success") and
  any(.jobs[]; .databaseId == 87689557044 and .name == "deploy-production" and .conclusion == "success")'
gh run view 29518516918 --json headSha,status,conclusion | jq -e '
  .headSha == "cfa062a09bcb737c09e4171730615364afff6e68" and
  .status == "completed" and .conclusion == "success"'
gh run view 29380448299 --json headSha,status,conclusion,jobs | jq -e '
  .headSha == "769c1645348d20f719e424423c9d3bedbc5985d0" and
  any(.jobs[]; .databaseId == 87245007215 and .name == "deploy-production" and .conclusion == "success")'
git fetch origin main --prune
test "$(git rev-parse origin/main)" = "cfa062a09bcb737c09e4171730615364afff6e68"
test "$(git rev-list --left-right --count HEAD...origin/main)" = $'14\t0'
test "$(git rev-list --count --merges origin/main..HEAD)" = "3"
test "$(git log --no-merges --format=%s --reverse origin/main..HEAD)" = "$(printf '%s\n' \
  'docs: freeze event pipeline recovery contract' \
  'test: freeze Supabase history replay manifest' \
  'fix: bind replay receipt server version' \
  'docs: refresh event pipeline recovery receipt' \
  'feat: add checked Supabase history replay' \
  'fix: reconcile Supabase migration history effects' \
  'refactor: type durable event pipeline boundaries' \
  'refactor: bound analytics delivery authority' \
  'refactor: modularize durable event pipeline runtime' \
  'ci: typecheck event tools and workers' \
  'docs: record event pipeline recovery evidence')"
git merge-base --is-ancestor origin/main HEAD
git push -u origin codex/ogabassey-home-critical-shell-v2-plan
```

Expected: normal push, no force. If `main` advanced after the frozen receipt, stop without merging it, regenerate the full P0 receipt/contract binding against the new base, obtain a fresh blocker-only rereview, and then repeat the plan; never push a behind-base or unreviewed-base head.

- [ ] **Step 7: Exact-head GitHub handoff**

Create or update the P0 PR; record `headRefOid`; require not-behind/mergeable, all required checks including CI Quality Gate green for that exact SHA, current-head review clean, and every review thread resolved. Do not merge or deploy in this phase execution. Once the exact-head P0 gate is green and owner/admin authority exists, H0-RUNNER preparation may proceed in parallel. After the user approves and P0 merges normally, require its exact application release to deploy coherently; H0 may proceed only when that release is coherent and H0-RUNNER availability/attestation is green. H1C1 later installs/extends the existing services in an inert state; `H0R-H1-MEASURE` alone owns queue/routing/delivery activation after its green H0R gate.

## Explicit Non-Deliverables

- No storefront response, Hero, CSS, cache, proxy, Cloudflare, Vercel-tag, SEO, or routing change.
- No event producer/delivery enablement and no worker service installation.
- No producer/delivery enablement, route conversion to queue-only behavior, worker installation, or provider-compatibility endpoint deletion. H1C1 owns later inert service installation/extension; `H0R-H1-MEASURE` alone owns activation after its green H0R gate.
- No #3024 retimestamping and no #3060 queue/drainer import.
- No H0 runner, telemetry campaign, browser trace, PSI, DebugBear, H1 control plane, or H2 render change.

## Completion Definition

P0 is ready for PR handoff only when the final V4 and strict schema-v5 production-effect provenance fixture/count are exactly bound, every applied exception has valid primary run/job/log-ordinal/head/semantic-log/owner-hash evidence, failure-after-apply evidence has only the allowed ordinal-free corroboration, every partial-order relation is enforced, both immutable replay effects equal the frozen post-recovery production effect, the separate no-write attestation proves the exact current post-replay ledger suffix and singleton effect delta, and no total historical order or current-production replay convergence is claimed. The repair and all immutable hashes must be proven; generated types and replay checks must cover all 19 public event functions; the direct-caller/authority/column guard must be clean; all 64 `as never` escapes must be gone; durable analytics and platform delivery must each perform exactly one applicable configuration read and at most one provider request for the claimed destination; configured delivery must be plain-Node/DB-free; no `'use client'` or browser graph may reach credential modules; the five caller-scoped roots plus separate platform route/helper class must be byte/edge clean; and exactly two independently tenant-verified trusted-wrapper importers may remain under the recorded narrow owner-approved rule exception. The bounded touched tree must be modular; tools/workers must be reached by normal typecheck; the 64-artifact regression inventory and monorepo gates must pass; production effects must be read-only verified and inert; and local review must have no critical/high finding. H0-RUNNER preparation may begin after the P0 exact-head gate is green and owner/admin authority exists. H0 itself requires both a coherent merged P0 exact application release and a green H0-RUNNER availability/attestation gate. P0 itself claims no Core Web Vitals improvement.
