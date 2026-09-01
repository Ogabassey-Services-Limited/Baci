# Task 4 report — merchant wallet Paystack bank-transfer funding

## Base/head

- Base: `93e935689aacedfe836694ce21dd9e58f4bcf57d`
- Head: `9f43728a31` (`fix: complete merchant wallet DVA funding`), following base implementation `927ab2c3ef`.

## RED/GREEN evidence

- RED: the required focused Vitest command initially failed because all Task 4 test/contract files were absent (`No test files found`).
- GREEN: focused Task 4 suite passes: 7 files, 11 tests.
- `pnpm turbo lint --filter=@baci/web`: PASS.
- `pnpm turbo typecheck --filter=@baci/web`: PASS (web and tools-workers).
- `git diff --check`: PASS.

## Contract and webhook behavior

The migration adds owner-readable funding requests and provider-account tables, an active-request/provider-account uniqueness boundary, NGN/status checks, RLS, and service-role-only assignment/credit RPCs. User-facing routes authenticate first, derive merchant ownership server-side, validate strict `{ consent: true }`, and return only redacted account fields. Assignment remains pending and does not persist provider response data.

The verified Paystack charge path preserves existing order-DVA handling, then invokes merchant-wallet receiver matching, then customer-wallet fallback. Matching requires one active account, NGN, positive amount, and rejects order-alias conflicts or multiple candidates for review. Credits use a deterministic reference-derived ledger UUID, increment only `available_balance`, leave `total_earned` unchanged, and return idempotent balance results.

## Fix Round 1

Fix Round 1 wires `dedicatedaccount.assign.success` in the signature-verified webhook before charge processing, validates source/request/merchant and active NGN account shape, persists only through the service RPC, and returns review for malformed or non-unique matches. Provider customer/DVA failures now transition the owner-checked pending request to failed, allowing a later consented retry. Paystack DVA success logging no longer emits account or bank fields. The funding RPC now asserts service role and exactly one active NGN merchant/account mapping before its reference-idempotent credit.

Behavioral focused tests and contract tests: 7 files, 11 passing (plus the existing webhook suite is scheduled in the final gate).

## Deviations and risks

Provider payload field variants beyond the documented `data.metadata`/`data.dedicated_account` shape should be confirmed against a signed fixture before activation. No live Paystack, Supabase migration, deploy, or remote operations were performed.

## Fix Round 2

Head: `3feb822f6b` (`fix: make merchant DVA funding retry safe`). Assignment persistence now locks the request and treats exact fulfilled replays as handled while conflicting replays are review. Credit validation uses `SELECT ... INTO STRICT ... FOR UPDATE` for the exact active NGN mapping. Failure-transition RPC errors are surfaced as safe review-required failures. New behavioral/contract suite: 91 passing tests (79 legacy webhook tests are included separately in the 8-file run; 12 are Task 4-focused).
