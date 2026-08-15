# Tasks 1–2 Report — Inert Hero Identity Preparation

Status: `DONE_WITH_CONCERNS`

## Scope completed

- Added the pure, versioned slide-zero resource-hint projection with canonical
  image fields and a SHA-256 integrity digest.
- Added strict projection validation that rejects field drift, malformed input,
  non-CDN sources, and whitespace-canonicalization mismatches.
- Added the pure homepage Hero contract that projects only published,
  merchant-bound shell data and assesses publication, merchant, preload,
  cardinality, and slide-zero parity with typed fail-closed reasons.
- Kept the existing resource-hints function signature and fail-open behavior;
  it now delegates its existing image transformation behavior to the shared
  projection identity.
- Kept the existing resource-hints test unchanged.

## TDD evidence

- Projection tests cover valid CDN AVIF identity, blank/non-CDN rejection, and
  drift across every identity field plus digest and version.
- Contract tests cover published/unpublished projection, preload identity, and
  every renderer mismatch reason.
- The existing emitter regression suite covers valid responsive preload,
  invalid source rejection, blank input, and fail-open exception handling.
- Focused red/green implementation work was limited to the exact current-main
  source inventory; no route, Supabase, cache, worker, provider, network,
  control, or renderer activation boundary was added.

## Validation

- Frozen base remains `bcdbf54cb591af2d9047afacaf75cdaaa29cccfa`; the branch
  includes the documented Task 0, implementation, and review-fix commits.
- Focused suites (direct shared Vitest binary with the Node environment override
  because host jsdom is incompatible): **4 files, 56 tests passed**.
- Biome on all seven owned runtime/test files: passed.
- `git diff --check`: passed.
- Current runtime/test file lengths: 53, 116, 247, 247, 206, 154, and 94
  lines; all are below the 300-line limit.
- Static import review found no route/cache/infra/provider/migration/VPS/
  deployment/proxy imports. The only cache/route wording is explanatory prose.
- Full web typecheck passes via `pnpm --filter @baci/web typecheck`; the
  repository-wide pnpm test/lint commands remain outside this focused receipt.

## Boundary receipt

- Controls remain `final-disabled+null`.
- No public rendering, route ownership, cache admission, worker/provider
  change, deployment, or measurement activation occurred.
- No H0 runner or activation gate was satisfied or replaced.
- No performance or causal claim was made; test results are implementation
  validation only.
- Next action is to regenerate the applicable normative H1A/H1B/H1C1/H1C2/
  H1D1/H1D2 plan only after the V4 prerequisites are independently green.

## Fix round 1 review response

- Hardened `project()` to fail closed for missing/non-array slides, malformed
  slide objects, invalid `kind`, blank required fields, non-OgaBassey image
  URLs, and non-UUID merchant IDs.
- Hardened `assessRenderer()` to require both a non-null expected preload and a
  validated non-null supplied preload before returning valid.
- Added exact regressions for missing slides, malformed fields/kind, a foreign
  image URL, malformed/whitespace merchant IDs, and the null/null preload case.
- Re-ran the three focused suites with the node environment override because
  the shared jsdom dependency intermittently failed under the host Node
  runtime (`MIMEType is not a constructor`); result: **3 files, 39 tests
  passed**.
- Biome passed on all five owned files and `git diff --check` passed.

## Fix round 2 review response

- Narrowed the `createPublishedShell()` test helper to the published variant of
  `OgabasseyHomeHeroShellInput`, fixing TypeScript union-property errors without
  weakening runtime validation or assertions.
- Focused suites: **3 files, 39 tests passed** (Node environment override).
- `pnpm --filter @baci/web typecheck`: passed, including the tools/workers
  project.
- Biome on all five owned files: passed; `git diff --check`: passed.

## Whole-branch review response

- Split renderer-assessment coverage into the colocated
  `ogabassey-home-hero-contract.renderer.test.ts`; current owned file lengths
  are 53, 116, 247, 247, 206, 154, and 94 lines respectively, all below 300.
- Narrowed every runtime slide through `isValidSlide` before selecting the
  candidate, and made resource-hint validation an explicit type predicate.
- Added malformed projection regressions for forged version and candidate
  shape, plus primitive/null validation-input coverage.
- Focused suites now cover four colocated files (56 tests passed), including
  the unchanged emitter regression suite; `pnpm --filter @baci/web typecheck`
  passed; Biome and `git diff --check` passed.
- The expected-preload rebuild remains intentional: it derives the canonical
  identity from the projected candidate image, then validates the supplied
  projection and digest, preventing independently supplied preload fields from
  becoming authoritative.

## Fix round 3 review response

- `isValidProjection` now accepts `unknown` and guards null/primitive runtime
  values before reading fields; renderer envelope guards reject null/non-array
  slides and null/invalid publication objects with typed failures.
- Added exact regressions for null/primitive/incomplete projections and malformed
  renderer envelope fields.
- Corrected the renderer null-preload regression to use a valid projection, so
  it directly exercises the required supplied-preload check.
- Updated the prep plan inventory and command to truthfully include seven owned
  files and four focused suites; controls and activation boundaries are
  unchanged.
- Fix commit `d2dedf259c` is committed; this receipt awaits fresh final review.

## Final evidence correction

- The projection builder now catches transformation/loader failures and
  returns `null`; the existing emitter preserves its fail-open error log for a
  valid CDN source whose projection cannot be built.
- The progress ledger and this report no longer claim a fixed branch-ahead
  count or a pending uncommitted fix; they record the current committed state
  and the amended 162-line plan.
