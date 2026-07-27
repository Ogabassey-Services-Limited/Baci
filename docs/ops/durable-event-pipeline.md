# Durable Event Pipeline Runbook

## Safety posture

The pipeline ships disabled. The database migration creates a logged PGMQ queue, service-only ledgers, claim-token RPCs, and disabled CDC producer rows. No destination is allowed to send until its shadow comparison and provider identity drill pass.

Baci production was verified on PostgreSQL 17.6 on 2026-07-12. Before pipeline rollout, schedule the Supabase-supported 17.10 upgrade as a separate backed-up maintenance-window operation. PostgreSQL 18 is the latest upstream major but is not currently a hosted Supabase upgrade target; do not self-manage a divergent production major for this feature.

A clean repository reset is also blocked before these migrations by invalid syntax in the pre-existing `20260525140048_quiz_authoritative_answer_scoring.sql`. Repair that baseline through the approved migration-repair process before making clean-reset CI a launch gate; never edit an already-applied production migration in place.

Never delete queue, ledger, dead-letter, or replay rows during an incident. Never correct a stored payload in place. Fix the parser/router, replay the immutable event, or emit a new corrective event linked to the original event.

## Runtime controls

The web and VPS environments use these independent controls:

| Variable | Safe default | Effect |
|---|---:|---|
| `EVENT_PIPELINE_ENQUEUE_ENABLED` | `false` | Uses atomic analytics/platform recording and PGMQ enqueue. Paid-order side effects finish only after enqueue commits. |
| `EVENT_PIPELINE_ROUTING_MODE` | `disabled` | `shadow` creates terminal shadow rows; `active` permits only the destination and merchant canaries below. |
| `EVENT_PIPELINE_ACTIVE_DESTINATIONS` | empty | Comma-separated destination allowlist (`facebook,ga4,snapchat,tiktok`). Empty means no claimable delivery rows. |
| `EVENT_PIPELINE_CANARY_MERCHANT_IDS` | empty | Comma-separated merchant UUID allowlist. Use `*` only for an explicitly approved full rollout. |
| `EVENT_PIPELINE_DELIVERY_ENABLED` | `false` | Allows the destination worker to claim and send active deliveries. |
| `EVENT_PIPELINE_DISABLE_LEGACY_FANOUT` | `false` | Stops the old direct provider path only after destination parity is proven. |
| `EVENT_PIPELINE_ALLOW_UNVERIFIED_TELEMETRY` | `false` | Allows body-only/mobile telemetry to enqueue as observation-only; it never gains conversion trust. |
| `EVENT_PIPELINE_MAX_DELIVERY_ATTEMPTS` | `8` | Bounded destination attempt ceiling, clamped to 1–20. |
| `EVENT_PIPELINE_DELIVERY_CONCURRENCY` | `5` | Maximum parallel provider deliveries per worker, clamped to 1–10. |
| `EVENT_PIPELINE_INGRESS_MAX_READS` | `5` | Repeated routing failures enter ingress DLQ after this many reads, clamped to 2–20. |
| `EVENT_DELIVERY_ATTEMPT_RETENTION` | `30 days` | Minimum retained successful-attempt history. Lower values are rejected. |
| `EVENT_QUEUE_ARCHIVE_RETENTION` | `30 days` | Minimum retained duplicate PGMQ archive history. Lower values are rejected. |

Do not set routing to `active` while legacy fan-out is still enabled for the same merchant/destination unless duplicate-provider behavior has been explicitly proven.

The web cutover gate fails safe: `EVENT_PIPELINE_DISABLE_LEGACY_FANOUT=true` has no effect unless enqueue is enabled, routing is `active`, delivery is enabled, all four destinations are allowlisted, and the merchant scope is the explicit `*` full-rollout value in the same web environment. This guard does not replace staging parity or verifying that the VPS worker environment has matching flags.

## Deployment and worker checks

Deploy workers with the repository-backed VPS workflow:

```bash
bash vps-workers/deploy.sh
```

The deployment installs these user services and one-minute, shared-`flock` recovery sweeps:

```bash
systemctl --user status baci-domain-event-router.service
systemctl --user status baci-event-delivery-worker.service
journalctl --user -u baci-domain-event-router.service --since '15 minutes ago'
journalctl --user -u baci-event-delivery-worker.service --since '15 minutes ago'
```

The services use `Restart=on-failure`. When a feature flag changes from disabled to enabled, restart the corresponding service; the recovery sweep covers the interval.

```bash
systemctl --user restart baci-domain-event-router.service
systemctl --user restart baci-event-delivery-worker.service
```

One-off recovery, still protected by the same database claims:

```bash
NODE_ENV=production ~/baci-workers/bin/process-domain-events.sh --once
NODE_ENV=production ~/baci-workers/bin/process-event-deliveries.sh --once
```

### Storefront cache transition canary

The cache transition uses the existing router and delivery services. Do not add
a cache-specific systemd service, timer, cron entry, wrapper, or worker-side
Cloudflare credential. Before enabling either cache flag, deploy the migration
first, then the web/VPS artifacts with all cache flags false. Configure the
worker with the paired HTTPS `STOREFRONT_CACHE_ACTUATOR_URL` and
`STOREFRONT_CACHE_ACTUATOR_SECRET`; configure Vercel with that secret and the
same `STOREFRONT_CACHE_CANARY_MERCHANT_ID`. Verify configured values by
presence/equality only—never print secrets or UUIDs.

Keep cache enqueue, routing, and delivery flags disabled until a capable
router/delivery heartbeat, queue-age alert transport, cache load/poison drill,
and database-to-Vercel canary UUID comparison have passed. Enable one
OgaBassey category transition, preserve the
canonical obligation/delivery records for every retry or replay, and observe
for 48 hours before considering wider rollout. Rollback means disable enqueue,
routing, and delivery flags; repair forward rather than deleting durable rows.

## Operational API

A platform administrator can inspect safe summaries at:

```text
GET /api/admin/event-pipeline/dead-letters
```

Supported filters are `kind`, `destination`, `error_code`, `merchant_id`, `from`, `to`, `limit`, and `offset`. `kind` is one of `all`, `ingress`, `delivery`, or `unknown`. Responses omit queue and destination payloads. They include separate counts, queue age/depth, and worker heartbeats.

The endpoint uses the administrator's authenticated Supabase session. Database RPCs independently verify `auth.uid()` belongs to a merchant row with `is_platform_admin=true`; the web route does not open a service-role client or grant direct access to event tables or PGMQ.

Initial alerts:

- oldest ingress message over 5 minutes;
- oldest open conversion delivery over 15 minutes;
- any commerce/payment observation DLQ growth;
- provider failure rate above 5% over 15 minutes with at least 20 attempts;
- continuous stale-claim recovery for 10 minutes;
- no successful worker heartbeat for 60 seconds;
- no completed sweep for 5 minutes.

Connect these thresholds to the production alert transport before active delivery. Structured worker logs and heartbeat rows provide the signals, but logs alone are not an alerting system.

## Failure interpretation

| State | Meaning | Operator action |
|---|---|---|
| `ingress_dead_letter` | Envelope, version, route, or trust validation failed. | Fix code/config, then replay the immutable ingress event. |
| `dead_letter` | Permanent provider/config/payload failure or attempts exhausted. | Repair the cause, verify destination identity behavior, replay selected rows. |
| `delivery_unknown` | Request may have reached the provider, but acceptance was not confirmed. | Reconcile provider-side first. Replay only when same-ID deduplication is proven or duplication is accepted. |
| `skipped` | Merchant disabled the integration or did not configure that destination. | No incident. A new event is required after configuration changes. |
| `shadowed` | Routing decision recorded during shadow mode; no provider request occurred. | Compare parity only. Never promote old shadow rows. |

## Replay

Replay requires platform-admin authentication, a valid CSRF token, and an operator reason between 3 and 1,000 characters.

Single ingress replay:

```json
{
  "kind": "ingress",
  "failure_id": "00000000-0000-4000-8000-000000000000",
  "reason": "Parser v1 now supports the corrected event name"
}
```

Capped destination replay:

```json
{
  "kind": "delivery",
  "delivery_ids": ["00000000-0000-4000-8000-000000000000"],
  "reason": "Merchant credential repaired and sandbox test passed"
}
```

Send either body to:

```text
POST /api/admin/event-pipeline/replay
```

The database rejects batches over 100, records the operator and reason, preserves the payload and provider event ID, and only transitions `dead_letter` or `delivery_unknown` rows.

## CDC enablement

CDC is disabled independently by producer row. Enable only one producer after staging rollback, latency, and queue-volume drills:

An enabled producer is fail-closed: a queue enqueue error rolls back the source mutation. This is intentional transactional-outbox behavior; disable the producer if queue availability or mutation latency breaches its rollout SLO.

```sql
UPDATE public.domain_event_producer_config
SET enabled = true, shadow_only = true, updated_at = now()
WHERE producer_key = 'catalog.products';
```

Orders and transactions remain observation-only. They must never trigger money movement. Enable them only after the payment-security review.

Rollback a producer without dropping its trigger:

```sql
UPDATE public.domain_event_producer_config
SET enabled = false, updated_at = now()
WHERE producer_key = 'catalog.products';
```

## Rollout sequence

1. Repair the historical clean-reset blocker, upgrade production 17.6 → 17.10 in its own maintenance window, and verify extension compatibility.
2. Apply migrations in staging and run migration, SQL lifecycle, worker, and provider sandbox suites.
3. Enable enqueue with routing disabled; prove atomic producer deduplication.
4. Set routing to `shadow`; compare event IDs, event counts, route choices, and redaction for at least 48 hours.
5. Connect alerts and perform poison-message, worker-kill, stale-claim, and replay drills.
6. Set routing to `active`, add exactly one destination to `EVENT_PIPELINE_ACTIVE_DESTINATIONS`, add exactly one merchant UUID to `EVENT_PIPELINE_CANARY_MERCHANT_IDS`, and enable delivery.
7. Prove stable provider IDs and crash-after-provider-success behavior.
8. Expand destination-by-destination and merchant-by-merchant; require seven clean days before broadening. Legacy overlap remains until same-ID provider deduplication is proven.
9. Set the merchant scope to `*` and disable legacy fan-out only after all four destinations and the full merchant rollout are approved.

## Rollback

1. Disable destination delivery first.
2. Set routing to `disabled`; queued messages remain durable.
3. Re-enable legacy fan-out only after checking duplicate-provider behavior.
4. Disable individual CDC producer rows if mutation latency or queue volume regresses.
5. Stop workers if needed; do not delete queue or ledger data.
6. Correct forward with a new append-only migration.
