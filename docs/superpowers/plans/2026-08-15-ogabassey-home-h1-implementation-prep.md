# OgaBassey Home H1 Implementation Prep — Inert Contract Lane

**Lane ID:** `H1-IMPLEMENTATION-PREP-2026-08-15`

**Status:** executable preparation only; no normative H1 implementation,
activation, cache admission, deployment, or performance claim.

> **Normative contract:** `docs/superpowers/plans/2026-07-13-ogabassey-home-critical-shell-v4.md`
>
> **Frozen inputs:** `CONTRACT_SHA256=d2da529f4524887e202e8aa34dcb7fac3569bb9e30f1951b610de119adcd11ea`, `BASE_SHA=bcdbf54cb591af2d9047afacaf75cdaaa29cccfa`, `PHASE=H1-IMPLEMENTATION/PREP`.
>
> Before every edit, verify the contract hash and `git merge-base --is-ancestor
> BASE_SHA HEAD`. A contract edit, base merge, or phase-boundary change
> invalidates this plan and requires regeneration. Do not run this plan against
> a stale H1 branch.

## Purpose and boundary

The strict V4 sequence remains unchanged: P0 → H0-RUNNER → H0 → H0-MEASURE →
H0.5 → H0.75 → normative H1A/H1B/H1C1/H1C2/H1D1/H1D2 → H0R-H1-MEASURE.
Those gates are not yet satisfied. This lane exists only to prepare a small,
testable Hero/preload contract on current main so later H1 work does not need to
redefine the identity seam.

The lane is inert by construction:

- Every merchant control remains `final-disabled+null`; no enable, publish,
  renderer promotion, or transition completion is allowed.
- No public route/page/layout ownership or visible initial-HTML/RSC rendering
  change is in scope; the resource-hint output must remain behaviorally
  equivalent. Cache-control or cache-tag behavior, proxy change,
  worker/provider/VPS change, migration, deployment, or `infra/cwv-runner`
  import is out of scope.
- No measurement run, PSI result, local timing, or focused test is an H0/H0R
  activation gate or a causal/absolute performance claim. Any observed timing
  is diagnostic only.
- The H0 runner remains the hard authority for later controlled measurement and
  activation. Ollama retirement status does not waive that gate, and this lane
  must not modify or consume runner/retirement machinery.
- Tenant binding, publication guards, SEO/metadata, accessibility, adjacent
  routes, and existing request-scoped behavior remain unchanged.

## Hard prerequisites that remain unchanged

This lane cannot satisfy or shorten any of these gates:

- P0 recovery must pass its current-main exact-head, migration-history, and
  production-coherence checks.
- H0-RUNNER must provide the owner-approved persistent host, read-only runner
  audit, and stable attestation receipt; hosted CI is never a substitute.
- H0/H0-MEASURE must deploy the exact measurement SHA and complete the declared
  controlled campaign before any causal H1 comparison is possible.
- H0.5 must record the hard cache-safety/TTL decision, and H0.75 must prove
  the actual-route layout boundary; either failure stops normative H1.
- Normative H1 still requires its exact-head H1A→H1D2 sequence, explicit proxy
  approval where applicable, fleet/ACL safety closure, and the H0R-H1 gate.

The prep receipt must carry these prerequisites as `unmet` until independently
proven. A passing focused test or a merged prep commit cannot relabel one as
green.

## Exact source inventory

Only these seven current-main files are owned by this prep slice. Each runtime
file has one primary export and each has its colocated/focused test:

- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-resource-hints.ts`
- `apps/web/src/app/(storefront)/ogabassey/ogabassey-home-hero-resource-hints.test.ts`
- `apps/web/src/lib/ogabassey-home-hero-contract.ts`
- `apps/web/src/lib/ogabassey-home-hero-contract.test.ts`
- `apps/web/src/lib/ogabassey-home-hero-contract.renderer.test.ts`
- `apps/web/src/lib/ogabassey-home-hero-resource-hint-projection.ts`
- `apps/web/src/lib/ogabassey-home-hero-resource-hint-projection.test.ts`

The existing resource-hint emitter may delegate to the projection, but its
public function remains fail-open and behaviorally equivalent for valid and
invalid inputs. Do not modify other route/page/layout emitters, `proxy.ts`,
cache/runtime code, `infra/cwv-runner`, VPS workers, migrations, providers, or
deployment workflows in this lane. If any additional emitter adapter is later
needed, stop and derive a new reviewed plan with an expanded inventory; do not
silently widen this one.

## Contract to prepare

The projection is a pure identity seam, not a renderer switch:

1. Build a versioned slide-zero Hero projection only from a published,
   merchant-bound shell. Unpublished, unbound, missing, malformed, or
   non-OgaBassey input returns `null` and cannot manufacture a candidate.
2. Build the preload identity from the same candidate image URL using the
   existing mobile dimensions, source media, quality, loader, AVIF fallback,
   and canonical absolute URL rules. Include a deterministic SHA-256 digest and
   validate every field; the digest is an integrity identity, not a cache key.
3. Assess a prospective render only when publication/merchant identity,
   preload identity, slide cardinality, and slide-zero fields agree. A mismatch
   fails closed with a typed reason and never falls back to stale slides.
4. Keep the projection independent of route resolution, request headers,
   merchant reads, cache tags, worker state, control mutations, and public
   rendering. Later H1 phases may consume it only after their own gates.

## TDD execution tasks

### Task 1 — Red tests for inert identity and rejection

- Add tests for published/bound input, unpublished/unbound input, empty or
  invalid image URLs, non-OgaBassey URLs, malformed projections, and every
  renderer mismatch reason.
- Assert no test calls a route, Supabase, cache, worker, provider, or network
  boundary. Assert projection output contains no control finalizer, provider
  response, tenant secret, or request identity beyond the bound merchant UUID.
- Expected red state: tests fail because the three prep runtime modules do not yet
  exist or lack the required discriminated behavior.

### Task 2 — Implement the two pure projections

- Implement only the exact source inventory above, preserving existing image
  loader/transform behavior, canonical field ordering, and the emitter's
  fail-open shell-safety behavior.
- Keep all failure paths explicit and fail-closed. Do not add a nullable-error
  cache sentinel, request-time fetch, retry, or side effect.
- Expected green state: focused tests pass and no later-phase import appears in
  the module graph.

### Task 3 — Regression and repository checks

- Run the colocated suites:

  The inventory contains four focused suites across seven owned files; the
  renderer assessment suite is split from the projection test to keep every
  test file below 300 lines.

  ```bash
  set -euo pipefail
  pnpm --filter @baci/web exec vitest run \
    'src/app/(storefront)/ogabassey/ogabassey-home-hero-resource-hints.test.ts' \
    src/lib/ogabassey-home-hero-contract.test.ts \
    src/lib/ogabassey-home-hero-contract.renderer.test.ts \
    src/lib/ogabassey-home-hero-resource-hint-projection.test.ts
  ```

- Run `pnpm turbo lint` and `pnpm turbo typecheck`; failures outside the exact
  inventory are reported, not repaired by widening this lane.
- Run `git diff --check` and verify every touched source file is ≤300 lines.
- Confirm a static diff/import review finds no `proxy.ts`, `infra/cwv-runner`,
  VPS, provider, migration, route, cache, or deployment change.

## Exit receipt

The prep lane may be reported `PREPARED_INERT` only when the exact SHA, contract
hash, base ancestry, source inventory, focused tests, lint/typecheck, and diff
checks are recorded. The receipt must state explicitly:

- controls remain `final-disabled+null`;
- no public rendering or cache activation occurred;
- no H0 runner/activation gate was satisfied or replaced;
- all metrics remain diagnostic and no performance claim was made; and
- the next action is regeneration of the applicable normative H1A/H1B/H1C1/
  H1C2/H1D1/H1D2 plan after the V4 prerequisites are green.

Any unexpected route/render/cache/infra/provider change is `STOPPED_REROUTED`:
preserve the diff and evidence, do not activate or deploy, and return to the
normative V4 sequence for review.
