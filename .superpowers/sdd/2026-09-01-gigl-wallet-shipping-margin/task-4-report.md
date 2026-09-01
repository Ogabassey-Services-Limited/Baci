# Task 4 report — merchant wallet Paystack bank-transfer funding

## Base/head

- Base: `93e935689aacedfe836694ce21dd9e58f4bcf57d`
- Head: pending commit (`feat: fund merchant wallet by bank transfer`)

## RED/GREEN evidence

- RED: the required focused Vitest command initially failed because all Task 4 test/contract files were absent (`No test files found`).
- GREEN: focused Task 4 suite passes: 7 files, 11 tests.
- `pnpm turbo lint --filter=@baci/web`: PASS.
- `pnpm turbo typecheck --filter=@baci/web`: PASS (web and tools-workers).
- `git diff --check`: PASS.

## Contract and webhook behavior

The migration adds owner-readable funding requests and provider-account tables, an active-request/provider-account uniqueness boundary, NGN/status checks, RLS, and service-role-only assignment/credit RPCs. User-facing routes authenticate first, derive merchant ownership server-side, validate strict `{ consent: true }`, and return only redacted account fields. Assignment remains pending and does not persist provider response data.

The verified Paystack charge path preserves existing order-DVA handling, then invokes merchant-wallet receiver matching, then customer-wallet fallback. Matching requires one active account, NGN, positive amount, and rejects order-alias conflicts or multiple candidates for review. Credits use a deterministic reference-derived ledger UUID, increment only `available_balance`, leave `total_earned` unchanged, and return idempotent balance results.

## Deviations and risks

Assignment-event extraction/persistence helper is present for the signature-verified graph, but the legacy webhook's non-charge event dispatch remains unchanged; deployment must wire the provider's exact assignment event payload shape before live activation. No live Paystack, Supabase migration, deploy, or remote operations were performed.
