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

- Base: `git rev-parse HEAD` was `bcdbf54cb591af2d9047afacaf75cdaaa29cccfa`
  before the Task 0 documentation commit; the current branch contains only the
  Task 0 parent commit plus this focused implementation commit.
- Focused suites (direct shared Vitest binary, equivalent test runner because
  the sparse worktree lacks one pnpm patch): **3 files, 32 tests passed**.
- Biome on all five owned runtime/test files: passed.
- `git diff --check`: passed.
- Runtime/test file lengths: 53, 156, 267, 152, and 84 lines; all are below
  the 300-line limit.
- Static import review found no route/cache/infra/provider/migration/VPS/
  deployment/proxy imports. The only cache/route wording is explanatory prose.
- `pnpm --filter @baci/web exec vitest ...` and direct `pnpm exec` were blocked
  by the sparse checkout's missing
  `patches/@react-native-community/datetimepicker@9.1.0.patch`; no dependency
  or patch files were added to work around that environment issue.
- Full `pnpm turbo lint` and `pnpm turbo typecheck` were not run because the
  same sparse-install prerequisite is missing; direct Biome and focused tests
  are green.

## Boundary receipt

- Controls remain `final-disabled+null`.
- No public rendering, route ownership, cache admission, worker/provider
  change, deployment, or measurement activation occurred.
- No H0 runner or activation gate was satisfied or replaced.
- No performance or causal claim was made; test results are implementation
  validation only.
- Next action is to regenerate the applicable normative H1A/H1B/H1C1/H1C2/
  H1D1/H1D2 plan only after the V4 prerequisites are independently green.
