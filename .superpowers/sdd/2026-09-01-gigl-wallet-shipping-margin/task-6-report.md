# Task 6 Implementation Report

## Scope

Implemented the mobile Admin manual-order **Ship with GIG** flow. The UI requests
a fresh server-attested GIG quote only while the shipment sheet is open on the
method step, displays the bundled NGN price, supports server-directed address
completion, exposes merchant-wallet shortfall and Paystack DVA funding, and
keeps booking behind the existing explicit shipped-status confirmation.

## TDD evidence

- RED API client: `pnpm --filter baci-mobile-admin exec vitest run lib/order-gigl-shipping.test.ts`
  failed because `./order-gigl-shipping` did not exist.
- RED hook: `pnpm --filter baci-mobile-admin exec vitest run hooks/orders/useOrderGiglShipping.test.ts`
  failed because `./useOrderGiglShipping` did not exist.
- GREEN focused feature/regression gate:
  `pnpm --filter baci-mobile-admin exec vitest run lib/order-gigl-shipping.test.ts hooks/orders/useOrderGiglShipping.test.ts components/orders/ShipmentFlowGiglPanel.test.tsx components/orders/ShipmentFlowSheet.gigl.test.tsx components/orders/ShipmentFlowSheet.test.tsx hooks/createOrderDetailsShipmentActions.test.ts hooks/completeOrderShipment.test.ts hooks/orders/useOrderStatusUpdate.test.ts lib/order-shipment.test.ts hooks/useOrderDetailsController.test.ts components/orders/OrderDetailsScreenModals.test.tsx`
  passed **11 files / 60 tests**.

## Gates

- `pnpm --filter baci-mobile-admin lint` — PASS, 1,814 files checked.
- `pnpm --filter baci-mobile-admin typecheck` — PASS.
- `git diff --check` — PASS.
- All new/touched Task 6 source and test files remain at or below 300 lines;
  `useOrderDetailsController.ts` is 293 lines.

## Behavioral notes

- API responses are Zod-validated and public quote parsing strips unrecognized
  internal economics.
- Polling is explicit after **I've transferred**, every 3 seconds for at most
  60 seconds, and stops on sufficient balance, close/unmount, background, or
  terminal error.
- Funding credit only enables the confirmation action; it never auto-books.
- Saved storefront quotes and Self Fulfill remain available through their
  existing paths.
- No emulator/device, live GIG, live Paystack, deployment, or remote migration
  proof was performed.

## Commit

Pending at report creation; updated after commit.
