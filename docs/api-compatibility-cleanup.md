# API Compatibility Cleanup

## Payout Account Resolution

- Canonical route: `/api/paystack/resolve`
- Temporary compatibility shims:
  - `/api/merchant/payout/resolve`
  - `/api/paystack/verify-account`

### Remove after rollout

- Wait until the updated mobile admin build using `/api/paystack/resolve` is fully rolled out.
- Confirm no active web callers still depend on the legacy `/api/paystack/verify-account` route or its legacy camelCase response payload fields.
- Search for remaining references before deletion:
  - repo callers and docs
  - route configuration and deployment config
  - redirects, middleware, and API client wrappers
- Delete:
  - `apps/web/src/app/api/merchant/payout/resolve/route.ts`
  - `apps/web/src/app/api/paystack/verify-account/route.ts`
  - `apps/web/src/app/api/paystack/verify-account/route.test.ts`

## Completed Follow-ups

- `apps/web/src/app/api/paystack/subaccount/route.ts` now uses `authenticateApiRequest` instead of duplicating the Bearer-vs-cookie client setup.
- Cookie-authenticated subaccount writes now enforce CSRF, while Bearer-authenticated mobile requests still bypass CSRF as intended.
- Route tests cover the shared auth path, permission enforcement, provider error mapping, and both subaccount create/update flows.

## Next Cleanup

- Remove the temporary payout account resolution compatibility shims after the updated mobile/web clients are fully rolled out.
