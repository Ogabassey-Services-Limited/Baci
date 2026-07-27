# ADR B0 — Durable cache invalidation on the VPS

**Status:** implemented; direct-VPS revision owner-approved 2026-07-27
**Temporary authority expires:** 2026-09-16 or B0 retirement, whichever is first

## Context

Longer storefront cache lifetimes are safe only when invalidation intent cannot
be lost. Detached post-response purges are best-effort and a scheduled request
to a Next route still consumes Vercel Function runtime on every sweep.

Vercel's supported `dangerously-delete-by-tags` REST endpoint hard-deletes
tagged cache entries without executing the application. The VPS already owns a
server-only Supabase service-role credential for direct workers, so it can own
the entire durable delivery loop without a Baci web request.

## Decision

### Transactional outbox

Database triggers enqueue one immutable row per merchant and concrete
storefront slug/hostname target in the same transaction as a covered mutation.
Every enqueue advances a generation. Claim and finish RPCs require
`service_role`, use a UUID claim token, recover stale leases, apply bounded
backoff, honor bounded `Retry-After`, and dead-letter exhausted work.

A finish can only clear the exact claimed generation. If another mutation
advances the row while delivery is running, the newer generation remains
pending and is drained again.

### Direct VPS worker

`vps-workers/jobs/drain-cache-invalidations.mjs` runs every two minutes under
`flock` and a 90-second process deadline. For each bounded claim it:

1. Builds the tenant data, exact product, and storefront HTML response tags.
2. Calls Vercel's production hard-delete API in batches of at most 16 tags.
3. Calls Cloudflare's hostname purge API with at most 30 hosts.
4. Persists success or a structured retry through the token-fenced finish RPC.

Cloudflare is unreachable until every Vercel batch succeeds. Missing
configuration, timeout, non-2xx, `200 + success:false`, and throttling all fail
closed. Provider response bodies and secret values are never logged.

The worker never calls `BACI_WEB_BASE_URL`, `run-web-cron.mjs`, a Next Route
Handler, `next/cache`, or a Vercel Function. The periodic sweep therefore adds
zero Vercel Function runtime cost.

### Authority boundary

Only the exact VPS entrypoint may combine `SUPABASE_SERVICE_ROLE_KEY`,
`VERCEL_TOKEN`, and `CLOUDFLARE_API_TOKEN` for this job. Supabase use is limited
to `claim_cache_invalidations` and `finish_cache_invalidation`; no table query
or other RPC is authorized. The Vercel token must be scoped only to the owning
Baci team, with mandatory team and project identifiers targeting the Baci
project. The Cloudflare token is limited to Cache Purge on the configured zone.

This exception is recorded in the generated critical rules and event-pipeline
authority graph. It must be removed or explicitly reapproved at expiry.

## Deployment contract

The migration, direct worker, preflight, tests, crontab line, and runbook ship
together. Live activation is a separate deployment step that must:

- apply and verify the migration;
- install the required VPS environment variables without printing values;
- deploy the exact reviewed Git SHA;
- confirm the crontab contains the direct worker and no cache-invalidation web
  cron;
- run one bounded drain and verify a successful outbox transition.

## Consequences

- Durable retries turn a VPS outage into delayed freshness, not lost intent.
- The two-minute sweep has no Vercel invocation charge.
- The VPS remains a freshness single point of failure, while the database
  remains the durable source of pending work.
- Hard deletion can cause foreground revalidation; tenant-scoped tags and small
  batches constrain stampede risk.
- Storefront TTL increases remain blocked until live deployment and an
  end-to-end stale-content probe succeed.
