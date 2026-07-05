# Auto-deliver same-city self-fulfilled orders after 24h

> Status: **Planned / not yet implemented.** Design doc for a follow-up task.
> This version incorporates the repo review findings: notification parity,
> idempotent retry, service-role-only RPC security, canonical state matching,
> and a concrete merchant settings surface.

## Context

Merchants who fulfill local orders themselves can forget to move orders from
`shipped` to `delivered`, leaving stale order states. For opted-in merchants,
same-city self-delivery orders should auto-transition from `shipped` to
`delivered` 24 hours after the shipped clock, but only when:

- the order is self-fulfilled (`fulfillment_type = 'self'`),
- the delivery city and state match the merchant's structured city and state,
- the merchant has opted in with a per-merchant setting, default OFF.

Locked decisions:

- Timing: rolling 24 hours after the self-fulfillment shipped timestamp.
- Customer notification: yes, parity with a manual delivered action. Customers
  should receive the delivered email, Google-review CTA where configured, and
  the order-status push notification where a customer app user exists.
- Rollout: per-merchant toggle, default OFF.
- Payment gate: none. Payment precedes shipping and `delivered` does not drive
  settlement.
- Cron runner: VPS worker cron, not Vercel cron.
- Data quality: structured city/state only. Never use the free-text address
  parser that defaults missing values to "Lagos".

## Current repo facts

- `apps/web/src/app/api/shipping/self-fulfill/route.ts` sets
  `self_fulfillment_data.fulfilledAt`, `shipping_status = 'shipped'`,
  `fulfillment_type = 'self'`, and provider/tracking fields. It does not
  populate `shipped_at`, so the auto-delivery clock must prefer
  `self_fulfillment_data->>'fulfilledAt'`.
- `apps/web/src/app/api/orders/[id]/delivered/route.ts` sends the delivered
  email and Google-review CTA. It does not send the push notification.
- `apps/web/src/app/api/orders/[id]/route.ts` sends order-status push
  notifications when `shipping_status` changes through the generic update path.
  A direct cron/RPC update will bypass this unless the cron notification helper
  recreates that push behavior.
- `apps/mobile-admin/hooks/createOrderDetailsStatusActions.ts` currently makes
  manual delivered parity by first updating status, then calling the delivered
  email route.
- The hardened `mark_abandoned_orders` RPC pattern is service-role-only:
  `SECURITY INVOKER`, explicit `search_path`, revoked public/authenticated
  execute, and granted only to `service_role`.
- Merchant structured address data lives on the merchant/settings surface
  (`registered_address`, `state_code`). The feature-toggle surface is
  `merchant_feature_settings`.
- Checkout/order shipping state values are human labels such as `Lagos` or
  `FCT - Abuja`, not guaranteed to be state codes like `NG-LA`.
- Manual delivered notifications do not currently write durable notification
  markers, so retry selection must distinguish orders delivered by this
  automation from historical/manual delivered orders.

## Implementation plan

### 1. Store the opt-in on the feature settings surface

Add `auto_deliver_local_enabled boolean default false` to
`merchant_feature_settings` in a new append-only migration.

Update the existing feature-settings contract end to end:

- `apps/web/src/schemas/merchant-features.ts`
- `apps/web/src/lib/merchant-feature-settings-defaults.ts`
- `apps/web/src/app/api/merchant/features/route.ts`
- any mobile/web feature-settings clients that read or write this surface

The toggle is disabled until the merchant has a structured city and state. The
UI should guide the merchant to save structured `registered_address.city` and
`registered_address.state` before enabling. Do not write or read from
`business_address` for matching.

If `registered_address.state` and `state_code` both exist but disagree after
canonicalization, disable the toggle and ask the merchant to correct the
structured address. The automation should not guess which field wins.

For mobile-admin, do not bolt this onto the current direct `merchants` update
payload unless it is explicitly extended for structured address and feature
settings. Prefer API-backed updates that keep web and mobile behavior aligned.

### 2. Canonicalize city and state in both app code and SQL

Extract a shared app-side normalizer for locality matching, for example:

- `packages/shared/src/contracts/local-delivery-location.ts`
- `normalizeLocationKey(value: string | null | undefined): string`
- `areSameLocalDeliveryLocation(merchant, order): boolean`

Rules:

- city and state must both be present after normalization,
- compare city and state independently,
- empty values never match,
- punctuation, casing, and spacing do not matter,
- Nigerian state aliases must match the existing alias behavior, especially
  `FCT`, `Abuja`, and `FCT - Abuja`.

Do not compare merchant `state_code` directly to order `shipping_address.state`.
If the merchant only has a code, map it to the canonical state label first, then
normalize. Add tests for code/name mismatch cases like `NG-LA` vs `Lagos` and
`NG-FC` vs `FCT - Abuja`.

The database RPC cannot call the TypeScript helper, so the migration must add
SQL-equivalent normalization. Keep the SQL behavior intentionally small and
testable:

- `public.normalize_local_delivery_text(text)` using
  `lower(regexp_replace(coalesce(value, ''), '[^a-z0-9]', '', 'g'))`
- `public.canonical_local_delivery_state(state_value text, state_code text)`
  using a deterministic Nigerian state-code/name mapping plus the FCT aliases
- the RPC uses those helpers for city and state matching

The helper functions are pure, but still live in `public`. Explicitly revoke
execute from `PUBLIC`, `anon`, and `authenticated`, then grant execute only to
`service_role` unless there is a deliberate need for client-side RPC access.

### 3. Add the service-role-only auto-delivery RPC

Create a new append-only migration for:

- `merchant_feature_settings.auto_deliver_local_enabled`
- `orders.auto_delivered_at timestamptz null`
- `orders.delivered_email_notified_at timestamptz null`
- `orders.delivered_push_notified_at timestamptz null`
- an index for eligible shipped self-fulfilled orders
- `public.auto_deliver_local_orders(hours_threshold int default 24)`

RPC security must follow the hardened cron RPC pattern:

- `SECURITY INVOKER`
- `SET search_path TO 'public'`
- revoke execute from `PUBLIC`, `anon`, and `authenticated`
- grant execute only to `service_role`
- bound `hours_threshold` to a safe range, for example `1..168`

Eligibility:

- `orders.shipping_status = 'shipped'`
- `orders.fulfillment_type = 'self'`
- merchant feature setting `auto_deliver_local_enabled = true`
- structured city and state match using the SQL helpers
- shipped clock is at least `hours_threshold` hours old:
  `COALESCE((self_fulfillment_data->>'fulfilledAt')::timestamptz, shipped_at, updated_at)`

Before implementing, verify the live/current schema has `orders.shipped_at` and
`orders.delivered_at`. If either is absent, do not assume it exists in SQL. Use
the current reliable columns, or add the needed nullable timestamp column in the
same append-only migration.

Update rows to:

- `shipping_status = 'delivered'`
- `auto_delivered_at = now()`
- `delivered_at = now()` only if the column exists or is added by the migration
- leave notification timestamp columns null

Return a compact list of affected order ids and merchant/customer identifiers so
the cron route can notify without broad follow-up scans.

The `auto_delivered_at` marker is required for safe retry selection. It prevents
the cron route from sweeping historical/manual delivered orders whose new
notification marker columns will be null after the migration.

### 4. Build one notification helper with explicit channel idempotency

Create `apps/web/src/lib/orders/send-delivered-notifications.ts`.

The helper should not assume a request-authenticated merchant. It should accept
an admin/server Supabase client plus the order id, load only the required
columns, and send the same channels as manual delivery:

- delivered email with Google-review CTA where configured,
- push notification equivalent to `notifyOrderStatusChange(..., 'delivered')`
  when the order has a customer app user.

`notifyOrderStatusChange` currently returns `Promise<void>` and discards the
`notifyCustomer` result. For auto-delivery, the helper must either call
`notifyCustomer` directly or change `notifyOrderStatusChange` to return the
`NotificationSendResult`, so push success/failure is observable before writing
`delivered_push_notified_at`.

Channel markers are separate:

- set `delivered_email_notified_at` only after email succeeds,
- set `delivered_push_notified_at` only after push succeeds or after determining
  there is no app user/device target,
- never resend a channel whose marker is already set.

If email succeeds and push fails, the next cron run retries only push. If push
succeeds and email fails, the next cron run retries only email.

Refactor the manual delivered route to use this helper for email/review CTA
only if that can be done without changing current auth semantics. Otherwise keep
manual route behavior intact and cover parity through shared lower-level
formatting functions.

Do not remove the existing generic order-update push path. The cron helper is
needed because the cron RPC updates status outside that app route.

### 5. Add the VPS cron route

Create `apps/web/src/app/api/cron/auto-deliver-local-orders/route.ts`.

Flow:

1. Validate `Authorization: Bearer <CRON_SECRET>` with
   `hasValidCronSecret`.
2. Create the admin client.
3. Call `rpc('auto_deliver_local_orders', { hours_threshold: 24 })`.
4. Build a bounded notification work list:
   - newly delivered order ids returned by the RPC,
   - plus older automation-delivered rows where `auto_delivered_at IS NOT NULL`
     and either `delivered_email_notified_at` or `delivered_push_notified_at`
     is null.
5. For each order, call the delivered-notification helper.
6. Return a compact summary:
   `{ success, delivered, emailNotified, pushNotified, pendingRetry }`.

Failures:

- An RPC failure returns a non-2xx response.
- A notification failure is logged and leaves the relevant marker null, but does
  not roll back the delivered status or block other orders in the batch.
- The route should cap per-run work to avoid a long cron request.

Register the route in `vps-workers/jobs/run-web-cron.mjs` with the existing
VPS cron pattern. Run hourly unless product decides a tighter SLA is needed.

## Files to create or modify

- New: `packages/shared/src/contracts/local-delivery-location.ts`
- New: `packages/shared/src/contracts/local-delivery-location.test.ts`
- New: `apps/web/src/lib/orders/send-delivered-notifications.ts`
- New: `apps/web/src/lib/orders/send-delivered-notifications.test.ts`
- New: `apps/web/src/app/api/cron/auto-deliver-local-orders/route.ts`
- New: `apps/web/src/app/api/cron/auto-deliver-local-orders/route.test.ts`
- New: `supabase/migrations/<timestamp>_auto_deliver_local_orders.sql`
- Modify: `apps/web/src/schemas/merchant-features.ts`
- Modify: `apps/web/src/lib/merchant-feature-settings-defaults.ts`
- Modify: `apps/web/src/app/api/merchant/features/route.ts`
- Modify: `apps/web/src/lib/shipping/providers/gigl.ts` if it can reuse the
  shared normalizer without behavior drift
- Modify: mobile-admin and web settings UI for the opt-in and structured
  city/state confirmation
- Modify: `vps-workers/jobs/run-web-cron.mjs`

## Verification

Unit tests:

- locality normalizer: casing, punctuation, empty values, same city/different
  state, `NG-LA` vs `Lagos`, `NG-FC` vs `FCT - Abuja`
- feature-settings schema/default handling for `auto_deliver_local_enabled`
- delivered-notification helper: email only, push only, both channels,
  already-marked channels, email failure, push failure
- cron route: missing/invalid secret, RPC failure, success, partial
  notification failure, bounded retries

Migration/RPC tests or SQL smoke checks:

- opted-in merchant, matching city/state, self-fulfilled shipped order with
  `fulfilledAt` 25h ago becomes delivered
- negatives remain unchanged: opted out, provider order, 23h old, missing city,
  missing state, different city, same city/different state, code/name mismatch
  without canonical mapping, conflicting `registered_address.state`/`state_code`
- retry selector ignores historical/manual delivered rows where
  `auto_delivered_at` is null
- execute permission is service-role-only for the RPC and SQL helper functions,
  matching the hardened cron RPC pattern

End-to-end local smoke:

- Start the web app with a valid admin/Supabase environment.
- Seed or identify an eligible test order.
- Curl the cron route with the `CRON_SECRET` bearer token.
- Confirm the order flips to delivered.
- Confirm email and push markers are set independently.

Final gate:

- `pnpm turbo lint`
- `pnpm turbo typecheck`
- `pnpm turbo test`
- After merge and migration, run one production smoke with a deliberately
  opted-in test merchant/order before enabling this for real merchants.

## Out of scope

- Bulk backfill or cleanup of historical merchant/order addresses.
- Auto-delivery for provider-shipped orders.
- Changing payment or settlement behavior.
