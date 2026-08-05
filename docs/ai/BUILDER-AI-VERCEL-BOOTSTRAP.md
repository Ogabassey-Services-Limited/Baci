# Temporary Builder AI production attestation smoke

`/api/internal/builder-ai-attestation-smoke` is a temporary operational route.
It is disabled by default and returns `404` unless it is running in the exact
production Vercel deployment, on the configured host and commit SHA, with an
unexpired one-shot bootstrap token.

The raw 32-byte-or-greater bootstrap token is never stored in Vercel. An
operator stores only its SHA-256 verifier, run ID, phase, exact host, expected
project/commit and a maximum fifteen-minute expiry as sensitive production
environment values using Vercel's `sensitive` type. The raw token is sent once
in `x-baci-builder-bootstrap`.

The hash environment row must be production-only and carry the exact Vercel
comment `baci-builder-ai-bootstrap:<runId>`. A different or previous run ID
cannot claim that row.

## Ceremony

1. Deploy this code with the bootstrap disabled.
2. Arm `attest` through the Vercel CLI with a new token hash and run ID, then
   perform the normal VPS prebuilt production deployment. Environment changes
   are deployment snapshots and do not alter a running function.
3. Call the route once. It atomically claims the token by deleting its exact
   Vercel environment row, makes bounded provider JSON smoke calls, then writes
   the fixed C/G binding data only if every included provider passes.
4. Arm a new `verify` token/run ID and deploy normally again. The route now
   materializes providers from actual runtime environment values, smokes them,
   and writes disabled/expired bootstrap controls for the next deployment.
5. Deploy normally, confirm the route is hidden, then remove this temporary
   route in a small follow-up deployment.

Control-plane writes are deterministic upserts, but provider smoke is
at-least-once: an ambiguous failed response may be manually retried with a new
run ID and can incur another bounded provider request. The route never claims
provider account ownership or tier truth. The deployment tier string is only a
locally HMAC-bound release attestation; dated provider-management evidence is
required for provider-side tier truth.
