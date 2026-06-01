# Web Zod v4 Migration Audit

## Final Branch State
- Isolated worktree: `/Users/mac/Baci-app/.worktrees/web-zod-v4-migration`.
- Branch: `codex/web-zod-v4-migration`.
- Final verified base before clean PR push: `origin/main` at `f5f809e439` (`fix(web): lighten agentic feed health cron (#2170)`).
- Rebases onto updated `main` completed cleanly after the first draft PR push. A duplicate local mobile-admin test stabilization commit was skipped after `#2210` landed on `main`, keeping this PR focused on the web Zod migration.
- The remote PR branch had accumulated merge commits from `main`; the clean branch rebuild intentionally cherry-picked only the real follow-up fix, `fix: preserve sparse zod update payloads`, onto the rebased local branch.
- Protected-file check after rebase found no `apps/web/src/proxy.ts` or `supabase/migrations/*` changes.

## Dependency Graph
- `apps/web` Zod changed from `^3.25.76` to `^4.4.3`.
- `packages/shared` now declares `zod@^4.4.3` because shared source imports Zod and exports shared schemas.
- `@hookform/resolvers` stayed at `^5.4.0`; it is already above the `5.1.1+` resolver floor for Zod v4.
- Root `package.json` now declares `zod@^4.4.3` as a dev dependency so the hoisted `@hookform/resolvers` type import of `zod/v4/core` resolves to the same Zod v4 package as `@baci/web`.
- `openai` was not added or upgraded by this checkpoint. The lockfile still contains `openai@4.104.0` through LangSmith/LangChain/CopilotKit peer paths, and pnpm reports a peer warning because that package declares `zod@^3.23.8`.
- Current `openai@6.39.1` package metadata declares `zod@^3.25 || ^4.0`, but upgrading OpenAI is intentionally deferred unless the Zod v4 migration hits a hard type/runtime blocker.
- `pnpm --filter @baci/web list zod --depth 0` reports direct `zod 4.4.3`.

## Codemod Scope
- Ran `pnpm dlx zod-v3-to-v4@1.21.2 apps/web/tsconfig.zod-v4-codemod.json` with a temporary scoped tsconfig that included `apps/web/src`, `apps/web/mcp-server`, and `packages/shared/src`.
- Removed the temporary codemod tsconfig after the codemod completed.
- Codemod touched web schemas, API route schemas, MCP server schemas, React Hook Form schemas, and shared schema files.
- Confirmed protected files were not touched: no `apps/web/src/proxy.ts` and no `supabase/migrations/*` changes.
- Confirmed no `zod/v3` imports remain in the migrated surface.

## Manual Zod Syntax Fixes
- Restored a codemod regression in `apps/web/src/schemas/ai-storefront-layout.ts` where the `description` field schema was accidentally moved into `.describe(...)`.
- Preserved trim-before-format behavior where user-visible validation depends on trimming first:
  - `apps/web/src/schemas/ucp-cart-request.ts`
  - `apps/web/src/schemas/jumia/shops.ts`
  - `apps/web/src/schemas/notifications.ts`
  - `apps/web/src/app/api/staff/route.ts`
  - `apps/web/src/schemas/agentic-order-route-params.ts`
  - `apps/web/src/schemas/wallet-top-up.ts`
- Replaced generic `z.any()` usage in migrated local schemas with `z.unknown()` or more exact field shapes.
- Tightened `apps/web/src/app/dashboard/products/add/add-product-form.tsx` media fields to `string` for the primary image and `string | File` for gallery values, then kept empty primary images as `''` to match the `Product` model's required string.
- Updated Zod error handling test doubles from `.errors` to `.issues`.
- Preserved the storefront products API/logging contract by making the merchant UUID error explicitly `Invalid uuid`.
- Updated `apps/web/src/schemas/README.md` to document Zod v4's unified `error` option instead of removed `required_error` / `invalid_type_error`.

## Defaults Audit
- Used `.prefault(...)` where a fallback must still pass through `z.coerce`, transforms, trims, or validation constraints before output:
  - numeric query/page defaults such as Jumia order pagination, domain purchase years, quiz pagination, import jobs, crawler observability, UCP catalog limits, VTU pagination, and wallet transactions.
  - agentic checkout currency defaults that should still normalize/validate through the currency schema.
  - monetary order defaults that should still coerce and validate non-negative numbers.
- Kept `.default(...)` where Zod v4 short-circuiting is the desired behavior and the fallback is already normalized:
  - booleans, enum defaults, array/object defaults, static strings, and simple numeric constants.
- Split sparse update/PATCH schemas away from defaulted create schemas where Zod v4 defaults would otherwise materialize omitted optional fields:
  - `apps/web/src/schemas/discount-codes.ts`
  - `apps/web/src/schemas/merchant-features.ts`
- Re-ran schema tests after the audit; they caught and verified the trim-before-UUID fixes.

## React Hook Form Resolver Audit
- Initial web typecheck exposed a Zod v4 type-brand mismatch because root `node_modules/zod` resolved to v3 while `apps/web` resolved to v4.
- Adding root `zod@^4.4.3` aligned root and web resolution to `4.4.3`; the `zodResolver(...)` overload errors disappeared.
- Resolver-heavy component tests passed for product creation, Jumia consignment, merchant bank, dashboard settings, BVN/NIN verification, security settings, and onboarding account validation.

## Runtime/API Schema Audit
- Product route test mocks now model Zod v4 `ZodError.issues`.
- `storefrontProductsQuerySchema` preserves the prior lowercase `Invalid uuid` message for invalid merchant IDs.
- Audits for removed/deprecated Zod v4 migration hazards found no remaining blocking usage of `required_error`, `invalid_type_error`, `errorMap`, `ZodError.errors`, `ZodError.formErrors`, `ctx.path`, or `z.nativeEnum` in the migrated surface.
- All `z.record(...)` call sites in the touched surface use explicit key and value schemas.
- No top-level `z.email()`, `z.url()`, `z.uuid()`, or `z.iso.datetime()` call remains before a later `.trim()` in the migrated surface.
- Added regression coverage for sparse update payloads so omitted discount-code and merchant-feature fields remain absent instead of being filled with create-schema defaults.

## Browser QA Evidence
- Local dev server ran from the isolated worktree at `http://localhost:3002` with ignored env files sourced into the process only and `NEXT_PUBLIC_APP_URL` overridden to localhost.
- Browser QA:
  - `/signup`: page loaded; empty `Create Account` submission produced `Signup Failed / Invalid fields` validation feedback without sending real user data.
  - `/reset-password`: page loaded; empty `Update Password` submission produced password-strength validation feedback.
  - `/onboarding`: step 1 loaded; empty `Next` submission produced business type, country, and business-name validation messages.
- API validation on the local dev server:
  - `GET /api/storefront/products?merchant_id=not-a-uuid` returned `400` with `{"error":"Invalid parameters","details":{"fieldErrors":{"merchant_id":["Invalid uuid"]}}}`.
- Browser direct navigation to `/api/storefront/products?...` was blocked by the in-app browser client (`ERR_BLOCKED_BY_CLIENT`), so API validation was verified with local dev-server `curl` after Browser page QA.
- Screenshots saved outside the repo:
  - `/tmp/baci-zod-v4-browser-qa/signup-validation.png`
  - `/tmp/baci-zod-v4-browser-qa/reset-password-validation.png`
  - `/tmp/baci-zod-v4-browser-qa/onboarding-validation.png`

## Automated Validation

### Post-Sparse-Fix Clean Branch Verification
- After rebasing onto `f5f809e439` and cherry-picking `fix: preserve sparse zod update payloads`, `pnpm install --frozen-lockfile --prefer-offline`: passed.
- `cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`: passed, 46 files and 395 tests.
- `cd apps/web && ./node_modules/@biomejs/cli-darwin-arm64/biome check .`: passed, 3114 files checked.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run src/schemas/discount-codes.test.ts src/schemas/merchant-features-patch.test.ts src/app/api/merchant/features/route.test.ts`: passed, 3 files and 25 tests.
- `git diff --check`: passed.
- `git diff --name-only origin/main...HEAD | grep -E '(^|/)proxy\.ts$|^supabase/migrations/' || true`: passed with no protected-file matches.
- `git log --merges --oneline origin/main..HEAD`: passed with no merge commits.

### Post-Rebase Final Verification
- `pnpm install --frozen-lockfile --prefer-offline`: passed.
- `cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`: passed, 46 files and 395 tests.
- `cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd apps/web && ./node_modules/@biomejs/cli-darwin-arm64/biome check .`: passed, 3110 files checked.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run --shard=1/4 --maxWorkers=2`: passed, 361 files and 3074 tests.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run --shard=2/4 --maxWorkers=1`: passed, 360 files and 2903 tests.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run --shard=3/4 --maxWorkers=1`: passed, 360 files and 2753 tests.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run --shard=4/4 --maxWorkers=1`: passed, 359 files passed, 1 skipped; 2936 tests passed, 1 todo.
- Combined web shard coverage: 1440 files passed, 1 skipped; 11666 tests passed, 1 todo.
- After rebasing onto `f39994e25f`, `pnpm install --frozen-lockfile --prefer-offline`, web typecheck, web Biome, shared typecheck/test, and the added upstream OgaBassey image-focused web tests passed before push.
- `git diff --check`: passed.
- `git diff --name-only origin/main...HEAD | rg '(^|/)proxy\.ts$|^supabase/migrations/' || true`: passed with no protected-file matches.

### After Migration
- `pnpm install --lockfile-only`: passed; existing peer warnings only, including `openai@4.104.0` expecting Zod 3.
- `pnpm install --frozen-lockfile --prefer-offline`: passed.
- `cd packages/shared && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd packages/shared && node ../../node_modules/vitest/vitest.mjs run`: passed, 46 files and 395 tests.
- `cd apps/web && node ../../node_modules/typescript/bin/tsc --noEmit`: passed.
- `cd apps/web && ./node_modules/@biomejs/cli-darwin-arm64/biome check .`: passed, 3110 files checked.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run src/schemas`: passed, 72 files and 941 tests.
- Focused MCP/forms suite: passed, 13 files and 81 tests.
- Focused API suite: passed, 18 files and 249 tests.
- `cd apps/web && node ../../node_modules/vitest/vitest.mjs run`: passed, 1440 files passed, 1 skipped; 11666 tests passed, 1 todo.
- `coderabbit review --prompt-only -t uncommitted`: completed with 7 findings; the only major finding was fixed by making the product form primary image contract consistently string-based. Remaining findings were minor/trivial migration-style suggestions and were not applied because they either preserve existing semantics less safely or are out-of-scope cleanup.
- `git diff --check`: passed.
- Note: local `node_modules/.bin/biome` and `node_modules/.bin/vitest` wrappers hung in this worktree after reinstall, so final local verification used the same package binaries via explicit `node` or the native Biome binary. The tested commands are recorded above.

### Baseline Before Migration Edits
- `pnpm install --frozen-lockfile --prefer-offline`: passed; lockfile was up to date.
- `pnpm --filter @baci/shared typecheck`: passed.
- `pnpm --filter @baci/shared test`: passed, 46 files and 395 tests.
- `pnpm --filter @baci/web typecheck`: passed.
- `pnpm --filter @baci/web test`: passed, 1440 files passed, 1 skipped; 11666 tests passed, 1 todo.
- `pnpm --filter @baci/web lint`: passed, Biome checked 3110 files.

## Initial Inventory

```text
Tracked TS files: 3766
Zod import files: 215
zodResolver files: 23
.default files: 50
schema files: 166
```

## Zod Import Files

apps/web/mcp-server/agentic-checkout-client.test.ts
apps/web/mcp-server/agentic-checkout-client.ts
apps/web/mcp-server/agentic-ucp-client.ts
apps/web/mcp-server/server.ts
apps/web/src/ai/chat-tools.ts
apps/web/src/ai/flows/autofill-product-details.ts
apps/web/src/ai/flows/generate-faq.ts
apps/web/src/ai/flows/generate-product-descriptions.ts
apps/web/src/ai/flows/generate-product-faq.ts
apps/web/src/ai/flows/guide-business-onboarding.ts
apps/web/src/app/(platform)/reset-password/page.tsx
apps/web/src/app/actions/auth.ts
apps/web/src/app/admin/merchants/[merchantId]/page.tsx
apps/web/src/app/api/admin/blog/posts/[id]/route.ts
apps/web/src/app/api/admin/blog/upload/upload-helpers.ts
apps/web/src/app/api/admin/settings/route.ts
apps/web/src/app/api/admin/settings/schema.ts
apps/web/src/app/api/ai-jobs/worker/route.ts
apps/web/src/app/api/analytics/insights/route.ts
apps/web/src/app/api/builder/gemini/route.ts
apps/web/src/app/api/cache/revalidate/route.ts
apps/web/src/app/api/chat/route.ts
apps/web/src/app/api/chat/santa/route.ts
apps/web/src/app/api/discount-codes/[id]/route.ts
apps/web/src/app/api/domains/[domain]/route.ts
apps/web/src/app/api/domains/initialize-payment/route.ts
apps/web/src/app/api/domains/purchase/route.ts
apps/web/src/app/api/feed/google-merchant/revalidate/route.ts
apps/web/src/app/api/internal/notify-negotiation/route.ts
apps/web/src/app/api/marketplace/jumia/actions/route.ts
apps/web/src/app/api/marketplace/jumia/connect/exchange/route.ts
apps/web/src/app/api/marketplace/jumia/connect/route.ts
apps/web/src/app/api/marketplace/jumia/consignment/route.ts
apps/web/src/app/api/marketplace/jumia/orders/route.ts
apps/web/src/app/api/marketplace/jumia/products/export/route.ts
apps/web/src/app/api/marketplace/jumia/products/import/route.ts
apps/web/src/app/api/marketplace/jumia/products/stock/route.ts
apps/web/src/app/api/marketplace/jumia/products/update/route.ts
apps/web/src/app/api/merchant/blog/upload/route.ts
apps/web/src/app/api/negotiations/notify/route.ts
apps/web/src/app/api/notifications/preferences/route.ts
apps/web/src/app/api/orders/[id]/invoice/route.ts
apps/web/src/app/api/orders/[id]/shipped/route.ts
apps/web/src/app/api/orders/update-payment-ref/route.ts
apps/web/src/app/api/payments/initialize/route.ts
apps/web/src/app/api/payments/klump/record/route.ts
apps/web/src/app/api/payments/status/route.ts
apps/web/src/app/api/paystack/virtual-terminal/[code]/destination/route.ts
apps/web/src/app/api/paystack/virtual-terminal/[code]/route.ts
apps/web/src/app/api/paystack/virtual-terminal/route.ts
apps/web/src/app/api/push-tokens/register/route.ts
apps/web/src/app/api/search/autocomplete/route.ts
apps/web/src/app/api/shipping/quotes/route.ts
apps/web/src/app/api/staff/[id]/route.ts
apps/web/src/app/api/staff/accept-invite/route.ts
apps/web/src/app/api/staff/route.ts
apps/web/src/app/api/storefront/auth/apple/route.ts
apps/web/src/app/api/storefront/auth/google/route.ts
apps/web/src/app/api/storefront/auth/send-code/route.ts
apps/web/src/app/api/storefront/customer/route.ts
apps/web/src/app/api/storefront/customer/wallet/order-funding-intents/[id]/route.ts
apps/web/src/app/api/storefront/negotiate/route.ts
apps/web/src/app/api/storefront/orders/[id]/route.ts
apps/web/src/app/api/storefront/social-proof/route.ts
apps/web/src/app/api/wishlist/route.ts
apps/web/src/app/auth/confirm/route.ts
apps/web/src/app/checkout/page.tsx
apps/web/src/app/dashboard/domains/components/connect-domain-form.tsx
apps/web/src/app/dashboard/marketing/discount-codes/actions.ts
apps/web/src/app/dashboard/marketing/discount-codes/discount-client.tsx
apps/web/src/app/dashboard/orders/[orderId]/fulfillment-dialog.tsx
apps/web/src/app/dashboard/orders/create/create-order-form.tsx
apps/web/src/app/dashboard/pages/pages-client.tsx
apps/web/src/app/dashboard/products/actions.ts
apps/web/src/app/dashboard/products/add/add-product-form.tsx
apps/web/src/app/dashboard/products/generation-actions.ts
apps/web/src/app/dashboard/settings/components/settings-form.tsx
apps/web/src/app/dashboard/settings/components/settings-utils.ts
apps/web/src/app/dashboard/settings/kyc/bvn-verification.tsx
apps/web/src/app/dashboard/settings/kyc/nin-verification.tsx
apps/web/src/app/dashboard/settings/trust/google-review-authority-settings-card.tsx
apps/web/src/app/dashboard/staff/schema.ts
apps/web/src/app/dashboard/staff/team-client.tsx
apps/web/src/components/auth/signup-form.tsx
apps/web/src/components/auth/verify-form.tsx
apps/web/src/components/jumia/consignment/check-stock-section.tsx
apps/web/src/components/jumia/consignment/update-consignment-form.tsx
apps/web/src/components/onboarding/steps/step3-account.test.tsx
apps/web/src/components/products/jumia-price-form.tsx
apps/web/src/components/storefront/RepairBookingWizard.tsx
apps/web/src/components/storefront/ogabassey/pages/product-details-page/product-normalization.ts
apps/web/src/env.ts
apps/web/src/lib/agentic/agent-commerce-manifest-health.ts
apps/web/src/lib/agentic/agent-commerce-trust-health.ts
apps/web/src/lib/agentic/jwt-signing-material.ts
apps/web/src/lib/agentic/universal-cart-readiness.ts
apps/web/src/lib/ai-storefront/ollama-storefront-client.ts
apps/web/src/lib/google-place-id.ts
apps/web/src/lib/initial-template-generator.ts
apps/web/src/lib/juicyway/types.ts
apps/web/src/lib/jumia/client.ts
apps/web/src/lib/jumia/fulfillment.ts
apps/web/src/lib/jumia/helpers.ts
apps/web/src/lib/klump-webhook.ts
apps/web/src/lib/korapay.ts
apps/web/src/lib/payments/paid-order-email-executor.ts
apps/web/src/lib/payments/paid-order-retry-persistence.ts
apps/web/src/lib/payments/paid-order-settlement-executor.ts
apps/web/src/lib/payments/process-wallet-funded-order-payment.ts
apps/web/src/lib/payments/run-paid-order-side-effects.ts
apps/web/src/lib/paystack-disputes.ts
apps/web/src/lib/paystack.ts
apps/web/src/lib/quiz-voucher-token.ts
apps/web/src/lib/quiz/gemma-question-generator.ts
apps/web/src/lib/schemas.ts
apps/web/src/lib/validations/blog.ts
apps/web/src/lib/validations/repair.ts
apps/web/src/schemas/account-security.ts
apps/web/src/schemas/admin-analytics-query.ts
apps/web/src/schemas/admin-merchant-route-params.ts
apps/web/src/schemas/admin-merchants-query.ts
apps/web/src/schemas/admin-platform-blog-posts.ts
apps/web/src/schemas/agent-commerce-public-product-parity.ts
apps/web/src/schemas/agentic-action-health.ts
apps/web/src/schemas/agentic-checkout-session-route-params.ts
apps/web/src/schemas/agentic-checkout.ts
apps/web/src/schemas/agentic-commerce-health-cron.ts
apps/web/src/schemas/agentic-order-route-params.ts
apps/web/src/schemas/agentic-request-controls-settings.ts
apps/web/src/schemas/ai-jobs.ts
apps/web/src/schemas/ai-storefront-layout.ts
apps/web/src/schemas/analytics-query.ts
apps/web/src/schemas/api-auth.ts
apps/web/src/schemas/auth.ts
apps/web/src/schemas/blog-post-view-count.ts
apps/web/src/schemas/branches.ts
apps/web/src/schemas/builder.ts
apps/web/src/schemas/bumpa-orders.ts
apps/web/src/schemas/bumpa-products.ts
apps/web/src/schemas/cart.ts
apps/web/src/schemas/crawler-observability.ts
apps/web/src/schemas/credit-direct.ts
apps/web/src/schemas/customer-savings.ts
apps/web/src/schemas/customers.ts
apps/web/src/schemas/dashboard-actions.ts
apps/web/src/schemas/discount-codes.ts
apps/web/src/schemas/domains.ts
apps/web/src/schemas/google-merchant-feed-query.ts
apps/web/src/schemas/imei-check.ts
apps/web/src/schemas/import-jobs.ts
apps/web/src/schemas/inventory.ts
apps/web/src/schemas/jumia/auth.ts
apps/web/src/schemas/jumia/catalog.ts
apps/web/src/schemas/jumia/consignment.ts
apps/web/src/schemas/jumia/errors.ts
apps/web/src/schemas/jumia/feeds.ts
apps/web/src/schemas/jumia/fulfillment.ts
apps/web/src/schemas/jumia/orders.ts
apps/web/src/schemas/jumia/price-form.ts
apps/web/src/schemas/jumia/shared.ts
apps/web/src/schemas/jumia/shops.ts
apps/web/src/schemas/marketplace.ts
apps/web/src/schemas/merchant-bank.ts
apps/web/src/schemas/merchant-features.ts
apps/web/src/schemas/merchant-identifier.test.ts
apps/web/src/schemas/merchant-identifier.ts
apps/web/src/schemas/merchant-settings.test.ts
apps/web/src/schemas/merchant-settings.ts
apps/web/src/schemas/mycover-webhook.ts
apps/web/src/schemas/newsletter.ts
apps/web/src/schemas/notifications.ts
apps/web/src/schemas/onboarding.ts
apps/web/src/schemas/openai-feed-query.ts
apps/web/src/schemas/order-reminder.ts
apps/web/src/schemas/order-wallet-funding-intent.ts
apps/web/src/schemas/orders.ts
apps/web/src/schemas/page-blocks.ts
apps/web/src/schemas/paid-order-side-effects.ts
apps/web/src/schemas/payments.ts
apps/web/src/schemas/paystack-bank-code.ts
apps/web/src/schemas/paystack-resolve.ts
apps/web/src/schemas/paystack-subaccount.ts
apps/web/src/schemas/product-list-query.ts
apps/web/src/schemas/products.ts
apps/web/src/schemas/push-test.ts
apps/web/src/schemas/quiz.ts
apps/web/src/schemas/reconcile-paystack-dva.ts
apps/web/src/schemas/record-payment.ts
apps/web/src/schemas/reviews.ts
apps/web/src/schemas/route-identifier.ts
apps/web/src/schemas/shipping.ts
apps/web/src/schemas/staff-accept.ts
apps/web/src/schemas/storefront-account-document.ts
apps/web/src/schemas/storefront-condition-filter.ts
apps/web/src/schemas/storefront-discount.ts
apps/web/src/schemas/storefront-features.ts
apps/web/src/schemas/storefront-products-query.ts
apps/web/src/schemas/storefront-products-query.types.ts
apps/web/src/schemas/storefront-products-route-params.ts
apps/web/src/schemas/supabase-agentic-jwt-private-jwk.ts
apps/web/src/schemas/track-order.ts
apps/web/src/schemas/ucp-cart-request.ts
apps/web/src/schemas/ucp-cart-route-params.ts
apps/web/src/schemas/ucp-catalog-request.ts
apps/web/src/schemas/ucp-checkout-request.ts
apps/web/src/schemas/verification.ts
apps/web/src/schemas/vtu-cashback-summary-cron.ts
apps/web/src/schemas/vtu.ts
apps/web/src/schemas/wallet-funding-account.ts
apps/web/src/schemas/wallet-top-up.ts
apps/web/src/schemas/wallet-transactions-query.ts
apps/web/src/schemas/wallet.ts
packages/shared/src/schemas/merchant-settings.ts
packages/shared/src/schemas/merchant-trust-profile.ts
packages/shared/src/schemas/phone.ts

## zodResolver Call Sites

apps/web/src/app/(platform)/reset-password/page.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/(platform)/reset-password/page.tsx:91:  const form = useForm<
apps/web/src/app/(platform)/reset-password/page.tsx:96:    resolver: zodResolver(resetPasswordSchema),
apps/web/src/app/checkout/page.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/checkout/page.tsx:125:  const form = useForm<OtpAuthFormValues>({
apps/web/src/app/checkout/page.tsx:126:    resolver: zodResolver(otpAuthSchema),
apps/web/src/app/checkout/page.tsx:947:  const shippingForm = useForm<z.infer<typeof shippingSchema>>({
apps/web/src/app/checkout/page.tsx:948:    resolver: zodResolver(shippingSchema),
apps/web/src/app/dashboard/domains/components/connect-domain-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/domains/components/connect-domain-form.tsx:51:  const form = useForm<DomainFormValues>({
apps/web/src/app/dashboard/domains/components/connect-domain-form.tsx:52:    resolver: zodResolver(domainSchema),
apps/web/src/app/dashboard/orders/[orderId]/fulfillment-dialog.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/orders/[orderId]/fulfillment-dialog.tsx:78:  const form = useForm<
apps/web/src/app/dashboard/orders/[orderId]/fulfillment-dialog.tsx:83:    resolver: zodResolver(fulfillmentFormSchema),
apps/web/src/app/dashboard/orders/create/create-order-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/orders/create/create-order-form.tsx:103:  const form = useForm<CreateOrderFormInput, unknown, CreateOrderFormValues>({
apps/web/src/app/dashboard/orders/create/create-order-form.tsx:104:    resolver: zodResolver(createOrderSchema),
apps/web/src/app/dashboard/pages/pages-client.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/pages/pages-client.tsx:100:  const form = useForm<PagesFormValues>({
apps/web/src/app/dashboard/pages/pages-client.tsx:101:    resolver: zodResolver(pagesSchema),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/products/add/add-product-form.tsx:162:  const form = useForm<AddProductFormInput, unknown, AddProductFormValues>({
apps/web/src/app/dashboard/products/add/add-product-form.tsx:163:    resolver: zodResolver(addProductSchema),
apps/web/src/app/dashboard/settings/components/settings-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/settings/components/settings-form.tsx:79:  const form = useForm<
apps/web/src/app/dashboard/settings/components/settings-form.tsx:84:    resolver: zodResolver(settingsSchema),
apps/web/src/app/dashboard/settings/kyc/bvn-verification.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/settings/kyc/bvn-verification.tsx:79:  const form = useForm<BvnFormValues>({
apps/web/src/app/dashboard/settings/kyc/bvn-verification.tsx:80:    resolver: zodResolver(bvnFormSchema),
apps/web/src/app/dashboard/settings/kyc/nin-verification.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/settings/kyc/nin-verification.tsx:74:  const form = useForm<NinFormValues>({
apps/web/src/app/dashboard/settings/kyc/nin-verification.tsx:75:    resolver: zodResolver(ninFormSchema),
apps/web/src/app/dashboard/settings/security/security-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/settings/security/security-form.tsx:46:  const form = useForm<SetPasswordValues | ChangePasswordValues>({
apps/web/src/app/dashboard/settings/security/security-form.tsx:47:    resolver: zodResolver(
apps/web/src/app/dashboard/settings/trust/google-review-authority-settings-card.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/settings/trust/google-review-authority-settings-card.tsx:59:  } = useForm<GoogleReviewAuthoritySettingsFormValues>({
apps/web/src/app/dashboard/settings/trust/google-review-authority-settings-card.tsx:64:    resolver: zodResolver(googleReviewAuthoritySettingsSchema),
apps/web/src/app/dashboard/settings/trust/trust-settings-client.tsx:211:  const form = useForm<TrustFormValues>({
apps/web/src/app/dashboard/staff/team-client.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/app/dashboard/staff/team-client.tsx:182:  const form = useForm<z.infer<typeof InviteStaffSchema>>({
apps/web/src/app/dashboard/staff/team-client.tsx:183:    resolver: zodResolver(InviteStaffSchema),
apps/web/src/components/auth/signup-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/auth/signup-form.tsx:45:  const form = useForm<z.input<typeof signupSchema>, unknown, SignupValues>({
apps/web/src/components/auth/signup-form.tsx:46:    resolver: zodResolver(signupSchema),
apps/web/src/components/auth/verify-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/auth/verify-form.tsx:48:  const form = useForm<z.infer<typeof verifySchema>>({
apps/web/src/components/auth/verify-form.tsx:49:    resolver: zodResolver(verifySchema),
apps/web/src/components/jumia/consignment/check-stock-section.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/jumia/consignment/check-stock-section.tsx:58:  } = useForm<CheckStockFormData>({
apps/web/src/components/jumia/consignment/check-stock-section.tsx:59:    resolver: zodResolver(checkStockSchema),
apps/web/src/components/jumia/consignment/create-consignment-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/jumia/consignment/create-consignment-form.tsx:42:  } = useForm<ConsignmentFormValues>({
apps/web/src/components/jumia/consignment/create-consignment-form.tsx:43:    resolver: zodResolver(consignmentFormSchema),
apps/web/src/components/jumia/consignment/update-consignment-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/jumia/consignment/update-consignment-form.tsx:86:  } = useForm<UpdateConsignmentValues>({
apps/web/src/components/jumia/consignment/update-consignment-form.tsx:87:    resolver: zodResolver(updateConsignmentSchema),
apps/web/src/components/merchant-bank-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/merchant-bank-form.tsx:67:  const resolver = zodResolver(merchantBankSchema) as Resolver<
apps/web/src/components/merchant-bank-form.tsx:73:  const form = useForm<BankFormInput, unknown, BankFormValues>({
apps/web/src/components/onboarding-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/onboarding-form.tsx:174:  const form = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding-form.tsx:176:    resolver: zodResolver(onboardingFormSchema as any),
apps/web/src/components/onboarding-form.tsx:399:  // 2025 Best Practice: Use form errors from zodResolver as single source of truth
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:182:  const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:336:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:395:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:460:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:549:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step1-business-details.test.tsx:583:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:235:  const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:344:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:370:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:394:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:433:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step2-branding.test.tsx:501:      const methods = useForm<OnboardingFormValues>({
apps/web/src/components/onboarding/steps/step3-account.test.tsx:1:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/onboarding/steps/step3-account.test.tsx:22:  const methods = useForm<
apps/web/src/components/onboarding/steps/step3-account.test.tsx:27:    resolver: zodResolver(onboardingFormSchema),
apps/web/src/components/products/jumia-price-form.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/products/jumia-price-form.tsx:48:  } = useForm<z.input<typeof jumiaPriceSchema>, unknown, JumiaPriceFormValues>({
apps/web/src/components/products/jumia-price-form.tsx:49:    resolver: zodResolver(jumiaPriceSchema),
apps/web/src/components/products/variant-builder.test.tsx:52:  const form = useForm();
apps/web/src/components/storefront/RepairBookingWizard.tsx:3:import { zodResolver } from '@hookform/resolvers/zod';
apps/web/src/components/storefront/RepairBookingWizard.tsx:86:  const form = useForm<
apps/web/src/components/storefront/RepairBookingWizard.tsx:91:    resolver: zodResolver(repairBookingSchema),

## Default Call Sites

apps/web/mcp-server/agentic-checkout-client.ts:56:    .default('NGN'),
apps/web/mcp-server/agentic-ucp-client.ts:18:  limit: z.number().int().positive().max(50).optional().default(20),
apps/web/mcp-server/agentic-ucp-client.ts:29:  currency: z.string().trim().length(3).optional().default('NGN'),
apps/web/mcp-server/server.ts:1194:          .default('relevance'),
apps/web/mcp-server/server.ts:1195:        limit: z.number().min(1).max(20).optional().default(10),
apps/web/mcp-server/server.ts:1387:          .default(1)
apps/web/src/ai/chat-tools.ts:75:  quantity: z.number().default(1).describe('Quantity to add'),
apps/web/src/app/api/domains/initialize-payment/route.ts:24:  years: z.coerce.number().int().min(1).optional().default(1),
apps/web/src/app/api/domains/purchase/route.ts:43:  years: z.coerce.number().int().min(1).max(10).default(1),
apps/web/src/app/api/marketplace/jumia/orders/route.ts:71:      limit: z.coerce.number().int().min(1).max(1000).default(50),
apps/web/src/app/api/marketplace/jumia/orders/route.ts:72:      offset: z.coerce.number().int().min(0).default(0),
apps/web/src/app/api/marketplace/jumia/products/export/route.ts:17:  currency: z.string().default('NGN'),
apps/web/src/app/api/payments/initialize/route.ts:103:  currency: z.string().default('NGN'),
apps/web/src/app/api/paystack/virtual-terminal/route.ts:42:    .default([]),
apps/web/src/app/api/push-tokens/register/route.ts:20:  app_type: z.enum(['admin', 'storefront']).default('admin'),
apps/web/src/app/api/shipping/quotes/route.ts:39:    country: z.string().default('Nigeria'),
apps/web/src/app/api/shipping/quotes/route.ts:40:    countryCode: z.string().default('NG'),
apps/web/src/app/api/shipping/quotes/route.ts:53:      country: z.string().default('Nigeria'),
apps/web/src/app/api/shipping/quotes/route.ts:54:      countryCode: z.string().default('NG'),
apps/web/src/app/api/shipping/quotes/route.ts:74:  shipmentType: z.enum(['domestic', 'international']).default('domestic'),
apps/web/src/app/api/storefront/negotiate/route.ts:18:  attemptNumber: z.number().min(1).max(3).default(1),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:69:  taxable: z.boolean().default(true),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:74:  weight_unit: z.enum(['kg', 'lb', 'g', 'oz']).default('kg'),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:80:      unit: z.enum(['cm', 'in', 'm']).default('cm'),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:89:  condition: z.enum(['new', 'used']).default('new'),
apps/web/src/app/dashboard/products/add/add-product-form.tsx:100:  status: z.enum(['draft', 'active', 'archived']).default('active'),
apps/web/src/env.ts:27:  // Keep invalid strings unchanged so z.boolean().default(false) reports
apps/web/src/env.ts:30:}, z.boolean().default(false));
apps/web/src/env.ts:74:  z.enum(['auto', 'gemini', 'llm', 'ollama']).default('auto')
apps/web/src/env.ts:158:    BLOG_PREVIEW_SECRET: z.string().default('dev-preview-secret'), // Fallback for dev
apps/web/src/env.ts:199:    AI_CHAT_MODEL: z.string().default('gemma4:e4b'),
apps/web/src/env.ts:208:      .default('development'),
apps/web/src/env.ts:211:    JUICYWAY_BASE_URL: z.string().default('https://api.spendjuice.com'),
apps/web/src/env.ts:215:    IMPORT_JOB_WORKER_BATCH_SIZE: z.coerce.number().int().positive().default(3),
apps/web/src/env.ts:221:      .default(DEFAULT_TERMINAL_IDEMPOTENCY_RECORD_WINDOW_MS),
apps/web/src/env.ts:231:    QUIZ_PHASE: z.enum(['1a', 'production']).default('1a'),
apps/web/src/env.ts:242:    MONNIFY_BASE_URL: z.string().url().default('https://api.monnify.com'),
apps/web/src/env.ts:243:    CAC_API_URL: z.string().url().default(DEFAULT_CAC_API_URL),
apps/web/src/env.ts:247:      .default(DEFAULT_CAC_TIN_API_BASE_URL),
apps/web/src/env.ts:250:    OLLAMA_CAC_MODEL: z.string().default('gemma4:e4b'),
apps/web/src/env.ts:256:    OLLAMA_STOREFRONT_MODEL: z.string().default('gemma4:e4b'),
apps/web/src/env.ts:261:      .default(90_000),
apps/web/src/env.ts:271:      .default(5000),
apps/web/src/env.ts:285:    LLM_CHAT_MODEL: z.string().default('gemma4:e4b'),
apps/web/src/env.ts:288:    JUMIA_ENVIRONMENT: z.enum(['staging', 'production']).default('staging'),
apps/web/src/env.ts:374:  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default('usebaci.com'),
apps/web/src/env.ts:375:  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
apps/web/src/lib/ai-storefront/ollama-storefront-client.ts:27:            props: z.record(z.string(), z.unknown()).default({}),
apps/web/src/lib/validations/repair.ts:36:      .default('dropoff'),
apps/web/src/schemas/admin-analytics-query.ts:4:  period: z.enum(['7d', '30d', '90d', 'all']).optional().default('all'),
apps/web/src/schemas/admin-merchants-query.ts:4:  sortBy: z.enum(['gmv', 'orders', 'joined']).default('gmv'),
apps/web/src/schemas/admin-platform-blog-posts.ts:5:  limit: z.coerce.number().int().min(1).max(100).default(20),
apps/web/src/schemas/admin-platform-blog-posts.ts:6:  offset: z.coerce.number().int().min(0).default(0),
apps/web/src/schemas/agentic-checkout.ts:39:    .default('NGN'),
apps/web/src/schemas/agentic-checkout.ts:50:    .default('NGN'),
apps/web/src/schemas/agentic-commerce-health-cron.ts:37:    .default('true')
apps/web/src/schemas/agentic-commerce-health-cron.ts:39:  merchant_slug: merchantSlugListSchema.default([]),
apps/web/src/schemas/agentic-request-controls-settings.ts:19:      .default([]),
apps/web/src/schemas/agentic-request-controls-settings.ts:22:      .default([]),
apps/web/src/schemas/ai-jobs.ts:10:    pageSlug: z.string().trim().min(1).default('home'),
apps/web/src/schemas/ai-jobs.ts:34:    force: z.boolean().optional().default(false),
apps/web/src/schemas/ai-storefront-layout.ts:54:  .default('check');
apps/web/src/schemas/ai-storefront-layout.ts:59:    showLogo: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:60:    showSearch: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:61:    showCart: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:62:    showMenu: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:63:    sticky: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:67:        show: z.boolean().default(false),
apps/web/src/schemas/ai-storefront-layout.ts:82:      .default('logo-left-nav-center'),
apps/web/src/schemas/ai-storefront-layout.ts:83:    searchStyle: z.enum(['outline', 'filled', 'minimal']).default('outline'),
apps/web/src/schemas/ai-storefront-layout.ts:84:    searchRadius: z.enum(['none', 'sm', 'md', 'full']).default('md'),
apps/web/src/schemas/ai-storefront-layout.ts:85:    paddingY: z.enum(['sm', 'md', 'lg']).default('md'),
apps/web/src/schemas/ai-storefront-layout.ts:86:    glassEffect: z.boolean().default(false),
apps/web/src/schemas/ai-storefront-layout.ts:96:    ctaLink: safeHrefSchema.default('/products'),
apps/web/src/schemas/ai-storefront-layout.ts:98:    overlay: z.boolean().default(false),
apps/web/src/schemas/ai-storefront-layout.ts:99:    align: z.enum(['left', 'center', 'right']).default('center'),
apps/web/src/schemas/ai-storefront-layout.ts:100:    padding: z.enum(['small', 'medium', 'large']).default('medium'),
apps/web/src/schemas/ai-storefront-layout.ts:101:    headingLevel: z.enum(['h1', 'h2', 'div']).default('h1'),
apps/web/src/schemas/ai-storefront-layout.ts:118:    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
apps/web/src/schemas/ai-storefront-layout.ts:127:    columns: z.number().int().min(1).max(4).default(3),
apps/web/src/schemas/ai-storefront-layout.ts:128:    limit: z.number().int().min(4).max(12).default(8),
apps/web/src/schemas/ai-storefront-layout.ts:132:      .default('newest'),
apps/web/src/schemas/ai-storefront-layout.ts:133:    showFilters: z.boolean().default(true),
apps/web/src/schemas/ai-storefront-layout.ts:141:    layout: z.enum(['horizontal', 'grid']).default('horizontal'),
apps/web/src/schemas/ai-storefront-layout.ts:142:    style: z.enum(['cards', 'minimal', 'icons-only']).default('cards'),
apps/web/src/schemas/ai-storefront-layout.ts:151:    placeholder: z.string().trim().min(1).max(80).default('Enter your email'),
apps/web/src/schemas/ai-storefront-layout.ts:169:    showQuickLinks: z.boolean().default(false),
apps/web/src/schemas/ai-storefront-layout.ts:172:    showNewsletter: z.boolean().default(false),
apps/web/src/schemas/branches.ts:40:    isDefault: z.boolean().default(false),
apps/web/src/schemas/builder.ts:6:    props: z.record(z.string(), z.unknown()).default({}),
apps/web/src/schemas/builder.ts:18:    content: z.array(builderComponentSchema).default([]),
apps/web/src/schemas/builder.ts:19:    root: builderRootSchema.default({ title: 'Home' }),
apps/web/src/schemas/builder.ts:20:    zones: z.record(z.string(), z.unknown()).default({}),
apps/web/src/schemas/builder.ts:36:  slug: z.string().trim().min(1).optional().default('home'),
apps/web/src/schemas/builder.ts:38:  name: z.string().trim().min(1).optional().default('Home'),
apps/web/src/schemas/builder.ts:51:  slug: z.string().trim().min(1).optional().default('home'),
apps/web/src/schemas/bumpa-orders.ts:8:    'Customer Name': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:9:    'Customer Email': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:10:    'Customer Phone': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:13:    'Shipping Status': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:14:    Channel: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:15:    Origin: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:18:    Discount: z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-orders.ts:19:    'Amount Paid': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-orders.ts:20:    'Amount Due': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-orders.ts:23:    'Updated At': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:24:    'Shipping Price': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-orders.ts:25:    Tax: z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-orders.ts:26:    'Coupon Code': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:27:    'Shipping Option': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-orders.ts:28:    'Product SKU': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:9:  .default('')
apps/web/src/schemas/bumpa-products.ts:18:  .default('')
apps/web/src/schemas/bumpa-products.ts:35:  'Variant ID': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:36:  'Row Type': z.string().trim().optional().default('product'),
apps/web/src/schemas/bumpa-products.ts:38:  SKU: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:39:  'Variant Name': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:40:  Barcode: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:41:  Description: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:42:  Details: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:43:  Unit: z.string().trim().optional().default('pc'),
apps/web/src/schemas/bumpa-products.ts:45:  Sales: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:46:  Cost: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:47:  Stock: z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:48:  'Weight (kg)': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:49:  Type: z.string().trim().optional().default('simple'),
apps/web/src/schemas/bumpa-products.ts:50:  Status: z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:51:  Featured: z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:52:  'Manage Stock': z.string().trim().optional().default('1'),
apps/web/src/schemas/bumpa-products.ts:53:  'Sales Count': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:54:  'Ratings Cache': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:55:  'Ratings Count': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:56:  'Currency Code': z.string().trim().optional().default('NGN'),
apps/web/src/schemas/bumpa-products.ts:57:  'Is Demo': z.string().trim().optional().default('0'),
apps/web/src/schemas/bumpa-products.ts:58:  'Is Active': z.string().trim().optional().default('1'),
apps/web/src/schemas/bumpa-products.ts:59:  'Min Order Qty': z.string().trim().optional().default('1'),
apps/web/src/schemas/bumpa-products.ts:60:  'Max Order Qty': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:61:  Collections: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:62:  'Options Names': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:63:  'Options Values': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:66:  'SEO Title': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:67:  'SEO Description': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:68:  'Product Type': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:69:  Vendor: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:70:  Gender: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:71:  'Age Group': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:72:  Condition: z.string().trim().optional().default('new'),
apps/web/src/schemas/bumpa-products.ts:73:  'Google Product Category': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:74:  'Created At': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:75:  'Updated At': z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:76:  Source: z.string().trim().optional().default(''),
apps/web/src/schemas/bumpa-products.ts:77:  'Source ID': z.string().trim().optional().default(''),
apps/web/src/schemas/crawler-observability.ts:21:    cacheOutcome: crawlerCacheOutcomeSchema.default('unknown'),
apps/web/src/schemas/crawler-observability.ts:24:    statusCode: z.coerce.number().int().min(100).max(599).default(200),
apps/web/src/schemas/crawler-observability.ts:39:  days: z.coerce.number().int().min(1).max(90).default(7),
apps/web/src/schemas/crawler-observability.ts:40:  limit: z.coerce.number().int().min(1).max(1000).default(1000),
apps/web/src/schemas/customer-savings.ts:71:    initialContributionAmount: nonNegativeAmountSchema.optional().default(0),
apps/web/src/schemas/customer-savings.ts:146:      amount: amountSchema.optional().default(100),
apps/web/src/schemas/dashboard-actions.ts:9:    limit: z.number().int().min(1).max(50).default(5),
apps/web/src/schemas/discount-codes.ts:8:  minimum_purchase_amount: z.number().nonnegative().optional().default(0),
apps/web/src/schemas/discount-codes.ts:11:  usage_limit_per_customer: z.number().int().positive().optional().default(1),
apps/web/src/schemas/discount-codes.ts:14:  is_active: z.boolean().optional().default(true),
apps/web/src/schemas/discount-codes.ts:18:    .default('all'),
apps/web/src/schemas/discount-codes.ts:19:  product_ids: z.array(z.string().uuid()).optional().default([]),
apps/web/src/schemas/discount-codes.ts:20:  category_ids: z.array(z.string().uuid()).optional().default([]),
apps/web/src/schemas/discount-codes.ts:67:  productIds: z.array(z.string().uuid()).optional().default([]),
apps/web/src/schemas/discount-codes.ts:68:  categoryIds: z.array(z.string().uuid()).optional().default([]),
apps/web/src/schemas/domains.ts:12:  isPrimary: z.boolean().optional().default(false),
apps/web/src/schemas/imei-check.ts:11:    .default('full')
apps/web/src/schemas/import-jobs.ts:25:  filter: z.enum(['all', 'importable', 'needs_fix']).default('all'),
apps/web/src/schemas/import-jobs.ts:26:  page: z.coerce.number().int().positive().default(1),
apps/web/src/schemas/import-jobs.ts:27:  pageSize: z.coerce.number().int().positive().max(100).default(25),
apps/web/src/schemas/import-jobs.ts:31:  sourcePlatform: importJobSourcePlatformSchema.default('bumpa'),
apps/web/src/schemas/merchant-features.ts:19:  klump_enabled: z.boolean().default(false),
apps/web/src/schemas/merchant-features.ts:20:  klump_min_amount: z.number().default(10_000),
apps/web/src/schemas/merchant-features.ts:21:  klump_max_amount: z.number().default(500_000),
apps/web/src/schemas/newsletter.ts:9:    .default('widget'),
apps/web/src/schemas/notifications.ts:15:      .default('info'),
apps/web/src/schemas/notifications.ts:19:      .default('normal'),
apps/web/src/schemas/notifications.ts:23:      .default('all'),
apps/web/src/schemas/orders.ts:170:    shipping_fee: z.coerce.number().nonnegative().default(0),
apps/web/src/schemas/orders.ts:171:    discount_amount: z.coerce.number().nonnegative().default(0),
apps/web/src/schemas/orders.ts:172:    tax_amount: z.coerce.number().nonnegative().default(0),
apps/web/src/schemas/orders.ts:180:    tax_basis: z.enum(['exclusive', 'inclusive']).default('exclusive'),
apps/web/src/schemas/orders.ts:181:    gift_wrapping_fee: z.coerce.number().nonnegative().default(0),
apps/web/src/schemas/orders.ts:195:    payment_status: z.string().default('unpaid'),
apps/web/src/schemas/orders.ts:196:    shipping_status: z.string().default('pending'),
apps/web/src/schemas/orders.ts:215:      .default('online_store')
apps/web/src/schemas/orders.ts:232:    use_wallet_credit: z.boolean().default(false),
apps/web/src/schemas/orders.ts:233:    wallet_amount: z.number().default(0),
apps/web/src/schemas/orders.ts:234:    use_savings_credit: z.boolean().default(false),
apps/web/src/schemas/products.ts:23:    .default('')
apps/web/src/schemas/products.ts:25:  order: z.number().int().min(0).default(0),
apps/web/src/schemas/products.ts:73:  stock_quantity: z.number().int().min(0).optional().default(0),
apps/web/src/schemas/products.ts:150:  unit: z.enum(['cm', 'in', 'm']).optional().default('cm'),
apps/web/src/schemas/products.ts:179:  stock: z.number().int().min(0).optional().default(0),
apps/web/src/schemas/products.ts:180:  manage_stock: z.boolean().optional().default(true),
apps/web/src/schemas/products.ts:181:  low_stock_threshold: z.number().int().min(0).optional().default(5),
apps/web/src/schemas/products.ts:242:  condition: normalizedProductConditionSchema.optional().default('new'),
apps/web/src/schemas/products.ts:250:  status: productStatusSchema.optional().default('draft'),
apps/web/src/schemas/products.ts:268:  taxable: z.boolean().optional().default(true),
apps/web/src/schemas/products.ts:301:  has_variants: z.boolean().optional().default(false),
apps/web/src/schemas/products.ts:303:  variant_model: productVariantModelSchema.default('legacy'),
apps/web/src/schemas/push-test.ts:9:    .default('Baci Push Test'),
apps/web/src/schemas/push-test.ts:15:    .default('If you received this, admin push notifications are working.'),
apps/web/src/schemas/quiz.ts:16:    limit: z.coerce.number().int().min(1).max(50).default(20),
apps/web/src/schemas/quiz.ts:19:    offset: z.coerce.number().int().min(0).default(0),
apps/web/src/schemas/quiz.ts:59:  difficulty: quizDifficultySchema.default('standard'),
apps/web/src/schemas/quiz.ts:62:  publicationMode: merchantQuizPublicationModeSchema.default('draft'),
apps/web/src/schemas/quiz.ts:63:  questionCountPerTopic: z.coerce.number().int().min(1).max(5).default(1),
apps/web/src/schemas/quiz.ts:64:  timeLimitSeconds: z.coerce.number().int().min(5).max(60).default(30),
apps/web/src/schemas/shipping.ts:19:  country: z.string().default('Nigeria'),
apps/web/src/schemas/shipping.ts:20:  countryCode: z.string().default('NG'),
apps/web/src/schemas/storefront-products-query.ts:31:  sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'),
apps/web/src/schemas/supabase-agentic-jwt-private-jwk.ts:5:    alg: z.literal('ES256').default('ES256'),
apps/web/src/schemas/ucp-cart-request.ts:45:    currency: ucpCurrencySchema.optional().default('NGN'),
apps/web/src/schemas/ucp-catalog-request.ts:13:      .default(20),
apps/web/src/schemas/vtu.ts:32:    .default('direct'),
apps/web/src/schemas/vtu.ts:143:  limit: z.coerce.number().int().min(1).max(50).default(20),
apps/web/src/schemas/wallet-transactions-query.ts:13:  z.coerce.number().int().min(1).default(defaultValue);

## Removed Zod v4 Error Options

apps/web/src/schemas/staff-accept.ts:6:      required_error: 'Invitation token is required',
apps/web/src/schemas/staff-accept.ts:7:      invalid_type_error: 'Invitation token is required',

## Dropped ZodError Aliases And Error Customizers

apps/web/src/app/api/staff/accept-invite/route.ts:95:      const errorMap: Record<string, { status: number; error: string }> = {
apps/web/src/app/api/staff/accept-invite/route.ts:122:      const errorResponse = errorMap[message] || {
apps/web/src/components/auth/signup-form.tsx:63:    if (state.errors?.fieldErrors) {
apps/web/src/components/auth/signup-form.tsx:64:      Object.entries(state.errors.fieldErrors).forEach(([key, messages]) => {

## z.record Call Sites

apps/web/mcp-server/agentic-ucp-client.ts:17:  filters: z.record(z.string(), z.unknown()).optional(),
apps/web/mcp-server/agentic-ucp-client.ts:23:  filters: z.record(z.string(), z.unknown()).optional(),
apps/web/mcp-server/agentic-ucp-client.ts:28:  buyer: z.record(z.string(), z.unknown()).optional(),
apps/web/mcp-server/agentic-ucp-client.ts:32:  shipping_address: z.record(z.string(), z.unknown()).nullable().optional(),
apps/web/mcp-server/agentic-ucp-client.ts:40:  buyer: z.record(z.string(), z.unknown()).optional(),
apps/web/mcp-server/agentic-ucp-client.ts:45:  shipping_address: z.record(z.string(), z.unknown()).nullable().optional(),
apps/web/src/env.ts:45:}, z.record(z.string().min(1), quizIntegrityTierSchema).optional());
apps/web/src/lib/ai-storefront/ollama-storefront-client.ts:27:            props: z.record(z.string(), z.unknown()).default({}),
apps/web/src/lib/klump-webhook.ts:29:    data: z.record(z.string(), z.unknown()).optional(),
apps/web/src/lib/paystack.ts:124:  metadata: z.record(z.string(), z.unknown()).nullable(),
apps/web/src/lib/schemas.ts:14:  .pipe(z.record(z.string(), z.any()).nullable());
apps/web/src/schemas/ai-jobs.ts:13:    brandColors: z.record(z.string(), z.unknown()).nullable(),
apps/web/src/schemas/api-auth.ts:9:    .record(z.string(), z.record(z.string(), z.boolean()))
apps/web/src/schemas/builder.ts:6:    props: z.record(z.string(), z.unknown()).default({}),
apps/web/src/schemas/builder.ts:20:    zones: z.record(z.string(), z.unknown()).default({}),
apps/web/src/schemas/cart.ts:12:    variant_attributes: z.record(z.string(), z.string()).optional(),
apps/web/src/schemas/cart.ts:14:    variantAttributes: z.record(z.string(), z.string()).optional(),
apps/web/src/schemas/customer-savings.ts:73:    metadata: z.record(z.string(), z.unknown()).optional(),
apps/web/src/schemas/jumia/catalog.ts:127:const JumiaAttributeValidation = z.record(z.string(), z.unknown());
apps/web/src/schemas/merchant-features.ts:78:  custom_settings: z.record(z.string(), z.unknown()),
apps/web/src/schemas/products.ts:33:const variantAttributesSchema = z.record(
apps/web/src/schemas/products.ts:298:  schema_markup: z.record(z.string(), z.unknown()).optional(),
apps/web/src/schemas/products.ts:473:    schema_markup: z.record(z.string(), z.unknown()).optional(),
apps/web/src/schemas/ucp-catalog-request.ts:27:    filters: z.record(z.string(), z.unknown()).optional(),
apps/web/src/schemas/ucp-catalog-request.ts:42:    filters: z.record(z.string(), z.unknown()).optional(),
apps/web/src/schemas/ucp-catalog-request.ts:49:    filters: z.record(z.string(), z.unknown()).optional(),

## Other Deprecated Or Changed Zod APIs
