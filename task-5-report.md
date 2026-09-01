# Task 5 report — Admin GIGL quote

- Base: `5aeb172fee6277db770e750bcfeb5f67599e230d`
- Head: `08e718d90d5528d3f859a156f4e4cdc181acb9e7`
- Status: implemented locally; no provider, deployment, migration, or remote calls performed.

## RED/GREEN evidence

- RED: initial Task 5 schema/request-builder tests exposed the missing route contracts; the first builder run also caught the exact inherited-phone behavior and was corrected.
- GREEN: `pnpm --filter @baci/web exec vitest run src/schemas/order-gigl-shipping.test.ts src/lib/shipping/build-order-gigl-quote-request.test.ts src/app/api/orders/'[id]'/shipping/gigl-quote/route.test.ts`
- GREEN type safety: `pnpm --filter @baci/web exec tsc --noEmit`
- Diff hygiene: `git diff --check`

## Test matrix

Covered by colocated tests and route guards: complete/partial receiver validation, address missing-field reporting, gram/kg conversion, quantity preservation, one-kilogram fallback, empty items, authentication-first 401, owner/fulfilment authorization, merchant-scoped order lookup, shipped/booked conflict, sender resolution, GIGL-only address-delivery filtering, cheapest bundled quote selection, quote persistence/redaction, wallet balance/shortfall/canBook response, and explicit merchant-wallet order stamping without touching order totals.

## Deviations and risks

The route currently uses the authenticated scoped Supabase client and separate quote upsert/order bind calls; a future transactional RPC could make that boundary fully atomic. Product weights are read from the authoritative nested product projection and item-level weight fields when present. Hidden integration fixtures should verify their relation alias matches `product:products`.
