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

## Adjacent Cleanup

- Refactor `apps/web/src/app/api/paystack/subaccount/route.ts` to use `authenticateApiRequest` instead of duplicating the Bearer-vs-cookie client setup.
- After that refactor, verify `integrations.manage` stays enforced for both mobile and web callers with route tests that cover owner, staff-with-permission, and staff-without-permission paths.
