# OgaBassey H0 Parallel Readiness Receipt

**Lane ID:** `H0-PREP-READINESS-2026-07-16`

**Captured:** 2026-07-16

**Status:** Read-only discovery complete; H0 phase implementation is not started.

**Normative contract:** [2026-07-13-ogabassey-home-critical-shell-v4.md](2026-07-13-ogabassey-home-critical-shell-v4.md)

**Contract SHA-256:** `3503ca9613b6a511b2e37fb3d35b48830d19e8559e7e3c5df136487fce9efdca`

**Observed preparation checkout:** `8dc37a8d22b5ad31bc144d4e85a49bc5b0eaaf6a`

**Observed `origin/main`:** `dae4e734f747717654125a16c1527b7f6366ce87`

**Latest coordination refresh:** P0 is now integrated through #3130 at
`origin/main=2a0dfadb45f03070dd1c294e81902851268fbbb4` and local merge
`9e36bd690e7a2a874464d2d43b042394396573f3` (`ahead=10`, `behind=0`).
Deployment run `29530977388` applied no new P0 database effect and had green
changes/database jobs, but its production build failed. CI run `29530977474`
completed successfully, including Build and the aggregate Quality Gate. These
values remain coordination evidence only, not an H0 phase gate.

## Purpose

Preserve the H0 discovery that can safely run in parallel with P0 so the next
executor does not repeat repository and GitHub inventory work. This receipt is
coordination evidence only. It does not authorize workflow changes, runner
registration, measurement, deployment, or any storefront implementation.

The executable sequence remains:

1. Complete the P0 exact-head gate.
2. With owner-approved persistent-host and GitHub administration authority,
   derive and execute H0-RUNNER against that exact current base.
3. Merge and deploy P0, then prove its exact application SHA and release
   canaries coherent before H0 measurement.
4. Derive and execute H0 measurement against both the coherent P0 release and
   the green H0-RUNNER receipt.
5. Derive H0 rollout analysis only after the exact H0 SHA is deployed and its
   canaries are coherent.

## Consumption Contract

- Treat the inventory below as completed work for lane
  `H0-PREP-READINESS-2026-07-16`.
- Do not repeat the repository discovery unless an invalidation condition below
  is true.
- Refresh the explicitly drift-prone GitHub runner, secret-name, and
  variable-name observations before freezing an executable H0-RUNNER plan.
- Do not treat this file as any of the three executable plans required by the
  normative V4 contract.
- Do not copy the observed checkout or `origin/main` SHA into a phase gate. The
  executable plans must bind the final P0 exact head and then-current base.
- Leave the normative V4 contract immutable. If its SHA changes, stop and
  rereview the full phase derivation.

## Required Executable Plans

The V4 contract requires these exact derived artifacts. All three were absent
when this receipt was captured:

| Phase | Required path | Creation gate |
|---|---|---|
| H0-RUNNER | `docs/superpowers/plans/2026-07-14-ogabassey-cwv-measurement-runner.md` | P0 exact-head green, owner-approved persistent host, and GitHub administrative authority |
| H0 | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-measurement.md` | Green H0-RUNNER availability and attestation receipt |
| H0-MEASURE | `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-rollout.md` | Exact H0 SHA deployed with coherent browser and Googlebot canaries |

Their absence is expected at this stage. Creating them now as executable plans
would freeze the wrong base and falsely imply that prerequisites are satisfied.

## Completed Repository Inventory

### Existing diagnostic workflow

- [`.github/workflows/seo-monitoring.yml`](../../../.github/workflows/seo-monitoring.yml)
  already runs scheduled and manually dispatched SEO checks on
  `ubuntu-24.04`.
- Its PageSpeed job uses
  [`apps/web/tools/seo/run-pagespeed.cli.ts`](../../../apps/web/tools/seo/run-pagespeed.cli.ts)
  and `PAGESPEED_INSIGHTS_API_KEY`.
- Its concurrency policy cancels an in-progress run. That is appropriate for
  routine monitoring but incompatible with the V4 authoritative campaign
  contract, which requires one immutable campaign/run identity, same-run
  recovery, a complete slot ledger, and no replacement cohort.
- Reuse the PageSpeed parser/configuration where its semantics match. Do not
  repurpose the routine SEO workflow as the authoritative controlled Chrome
  campaign.

### Existing runner labels and workflows

- [`.github/actionlint.yaml`](../../../.github/actionlint.yaml) recognizes
  `baci-android`, `baci-deploy`, and `baci-lighthouse`.
- No checked-in workflow currently uses `baci-lighthouse`.
- No checked-in workflow or actionlint label currently defines the required
  `baci-cwv-measurement` runner lane.
- Existing self-hosted workflows use deployment or Android runner authority and
  must not silently become the measurement authority.

### Existing Real User Monitoring substrate

- [`web-vitals-reporter.tsx`](../../../apps/web/src/components/analytics/web-vitals-reporter.tsx)
  reports CLS, INP, LCP, FCP, and TTFB through the attribution build of
  `web-vitals`.
- [`web-vital-attribution.ts`](../../../apps/web/src/components/analytics/web-vital-attribution.ts)
  captures LCP target and timing decomposition, including load delay, load
  duration, and render delay, and redacts query/hash material from URLs.
- [`web-vitals-queue.ts`](../../../apps/web/src/lib/posthog/web-vitals-queue.ts)
  provides the bounded PostHog queue used by the reporter.
- This is reusable diagnostic substrate. It does not yet satisfy V4's exact
  initial-document release marker, measurement marker, comparison-contract
  hash, controlled-profile hash, campaign identity, or slot-ledger contract.

### Existing URL and threshold substrate

- [`docs/perf/storefront-lcp-urls.md`](../../perf/storefront-lcp-urls.md)
  documents canonical home and PDP targets plus mobile/desktop PageSpeed use.
- Current thresholds are LCP `2500 ms`, CLS `0.1`, TBT `200 ms`, and INP
  `200 ms`.
- The list does not provide the V4 authoritative 21-slot manifest and does not
  currently include the required category target.
- Reuse verified canonical targets, but generate the complete immutable H0
  manifest in the derived measurement plan.

## Completed Live GitHub Inventory

These facts were observed read-only on 2026-07-16 and are intentionally marked
drift-prone.

### Self-hosted runners

| Runner | State at capture | Labels at capture | H0 decision |
|---|---|---|---|
| `baci-android` | online, busy | `self-hosted`, `Linux`, `X64`, `baci-android` | Not eligible |
| `baci-deploy` | online, busy | `self-hosted`, `Linux`, `X64`, `baci-deploy` | Not eligible |
| `baci-deploy-2` | online, idle | `self-hosted`, `Linux`, `X64` | Not eligible |

No registered runner had `baci-lighthouse` or the required
`baci-cwv-measurement` label. Availability alone does not authorize reusing an
existing deployment machine. The owner must select the persistent measurement
host, and H0-RUNNER must prove exactly one eligible online attested runner with
no hosted fallback.

### Relevant Actions secret and variable names

Observed secret names include:

- `PAGESPEED_INSIGHTS_API_KEY`
- `POSTHOG_API_KEY`
- `POSTHOG_CLI_API_KEY`
- `POSTHOG_CLI_HOST`
- `POSTHOG_CLI_PROJECT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ZONE_ID`

Observed repository variable names include:

- `PAGESPEED_EXTRA_URLS`
- `PAGESPEED_STRATEGIES`
- `SEO_MERCHANT_ORIGINS`
- `SEO_PLATFORM_ORIGIN`
- `MCP_REQUIRED_TOOLS`

No H0-RUNNER-specific variable names or obvious read-only runner-auditor GitHub
App credential names were present. This observation covers names only; no
secret value was read.

Application-side PostHog health queries expect `POSTHOG_API_KEY` together with
`POSTHOG_PROJECT_ID`, while the observed Actions list contains
`POSTHOG_CLI_PROJECT_ID`. The H0 plan must explicitly select and map the exact
read-only query credential and project id. It must not assume those identifiers
are interchangeable.

## Reusable Assets

The derived plans should reuse, rather than rediscover:

- The current PageSpeed CLI, config, result parsing, and thresholds.
- The current canonical OgaBassey home and PDP targets after live canonical
  verification.
- The existing Web Vitals reporter and attribution schema as a field-data
  input.
- Existing release-coherence and browser/Googlebot canary patterns from the V4
  contract and completed rollout work.
- Existing GitHub artifact and workflow conventions where they can be made
  immutable and read back before verdict computation.

Reuse does not waive V4 requirements for a dedicated persistent runner,
attestation, controlled profile, immutable campaign identity, serial slot DAG,
raw evidence hashing, or exact-release marker coherence.

## Outstanding Gaps and Owner Authority

Before H0-RUNNER can become executable:

1. The final P0 exact-head gate must be green. P0 merge/deploy coherence is a
   hard prerequisite for H0 measurement, not for H0-RUNNER preparation.
2. The owner must select the persistent measurement host. An existing runner is
   not approved merely because it is online or idle.
3. The owner or repository administrator must approve runner registration and
   the exact `baci-cwv-measurement` label.
4. The owner or repository administrator must approve installation and minimum
   read-only permissions for the runner-auditor GitHub App.
5. The derived plan must define credential names and availability checks for
   PostHog read-only queries and PageSpeed without printing values.
6. The derived plan must define the immutable 21-slot manifest, controlled
   Chrome/Lighthouse profile, runner attestation digest, serial execution DAG,
   same-run recovery, artifact object hashes, and readback gates.
7. Alert ownership and destination must be named before monitoring or
   attestation-failure alerts are enabled.

## Non-Overlap Boundary

This lane performed no mutation and grants no permission to:

- modify a workflow or actionlint configuration;
- register, relabel, install, restart, or reconfigure a runner;
- create or change a GitHub App, secret, or repository variable;
- dispatch SEO, PSI, Lighthouse, DebugBear, or browser automation;
- deploy or prewarm production;
- modify storefront rendering, caching, proxy middleware, telemetry, or the V4
  contract.

The main executor should therefore skip discovery already recorded here, but
must still implement and verify every executable phase task after its gates
open.

## Invalidation Conditions

Repeat only the affected portion of discovery when one of these is true:

- the V4 contract hash differs from the receipt;
- the three required derived-plan files appear or their phase contract changes;
- P0 reaches a new final exact head, which requires freezing new executable
  inputs but not repeating stable repository inventory;
- the SEO workflow, PageSpeed tooling, Web Vitals telemetry, URL list, or runner
  label configuration changes materially;
- live runner registration, Actions secret names, or repository variables need
  current execution-time confirmation.

## Handoff

After P0 exact-head green, consume this receipt in the following order:

1. Revalidate only the drift-prone GitHub inventory.
2. Create
   `docs/superpowers/plans/2026-07-14-ogabassey-cwv-measurement-runner.md`
   against the exact current base and owner approvals.
3. Execute H0-RUNNER and freeze its successful attestation digest.
4. Merge and deploy P0, then prove the exact release coherent.
5. Create
   `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-measurement.md`
   against the exact P0 release and H0-RUNNER receipt.
6. Create
   `docs/superpowers/plans/2026-07-14-ogabassey-home-h0-rollout.md`
   only after the exact H0 SHA is deployed and coherent.

This is the explicit do-not-repeat marker for the parallel H0 preparation lane.
