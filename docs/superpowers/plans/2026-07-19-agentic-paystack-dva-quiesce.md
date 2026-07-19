# Agentic Paystack DVA Quiesce Implementation Plan

> **For Codex:** Execute this plan task-by-task with TDD. Do not change production configuration, deploy, or mutate live data while implementing it.

**Goal:** Quiesce creation and disclosure of new Paystack dedicated virtual accounts through Agentic Checkout before the broader invoice late-payment migration, while preserving non-DVA payment methods and exact read-only replay of the finite pre-pause cohort.

**Architecture:** A server-only strict mode parser is the single authority for Agentic Paystack DVA availability. Discovery derives from the filtered Agent Commerce manifest. Completion performs replay lookup first, then rejects new Paystack setup before any claim, provider, session, order, or response mutation. Existing `payment_pending` sessions are grandfathered only when their immutable persisted request fingerprint and stored response match exactly.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Zod, Supabase/PostgREST, pnpm/Biome.

**Design source:** `docs/superpowers/specs/2026-07-16-invoice-dva-late-payment-matching-design.md`, especially the Agentic cutover contract beginning near line 575.

## Global constraints

- Keep `pay_on_delivery` available when configured.
- Keep independently configured Google Pay available when Paystack DVA is paused; Google Pay uses Paystack as a processor but does not create or expose a DVA.
- Missing mode may default to `enabled` only outside production. Production must reject missing, blank, or unknown values.
- Do not make provider calls, mutate payment claims, create orders, or expose bank details on a new paused Paystack request.
- Do not disable webhook matching for already exposed accounts.
- Do not log account numbers, customer codes, provider payloads, email addresses, or phone numbers.
- Use exact stored idempotency replay before the pause rejection. Changed buyer, amount, account, order, or payment terms must not qualify.
- No production setting, deploy, or live database change is part of these coding tasks.

### Task 1: Strict mode and discovery quiesce

**Files:**

- Create: `apps/web/src/lib/agentic/agentic-paystack-dva-mode.ts`
- Create: `apps/web/src/lib/agentic/agentic-paystack-dva-mode.test.ts`
- Create: `apps/web/src/lib/agentic/agentic-paystack-dva-paused.ts`
- Create: `apps/web/src/lib/agentic/agentic-paystack-dva-paused.test.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.ts`
- Modify: `apps/web/src/lib/agentic/agent-commerce-manifest.test.ts`
- Modify: `apps/web/src/app/agent-commerce.json/route-checkout-capabilities.test.ts`
- Modify: `apps/web/src/app/openapi.json/route.ts`
- Modify: `apps/web/src/app/openapi.json/route.test.ts`
- Verify: `apps/web/src/lib/agentic/ucp-discovery-profile-payment.test.ts`
- Verify: `apps/web/src/lib/agentic/acp-discovery-profile.test.ts`
- Verify: `apps/web/src/app/.well-known/acp.json/route.test.ts`
- Verify: `apps/web/src/app/.well-known/agent-native-commerce/route.test.ts`
- Verify: `apps/web/src/app/.well-known/ucp/route.test.ts`

**Step 1: Write failing mode tests**

Cover exact `enabled` and `paused`, non-production missing fallback, and rejection of missing/blank/unknown production values. Run:

```bash
pnpm --filter @baci/web exec vitest run src/lib/agentic/agentic-paystack-dva-mode.test.ts
```

Expected: FAIL because the module does not exist.

**Step 2: Implement the smallest strict parser**

Export an explicit mode type and `getAgenticPaystackDvaMode()` from the mode module. Export `isAgenticPaystackDvaPaused()` from its own colocated module and reuse the getter. Read `process.env.AGENTIC_PAYSTACK_DVA_MODE` at call time so tests and runtime configuration are deterministic. Do not accept case folding or whitespace aliases.

**Step 3: Write failing manifest/discovery tests**

Add tests proving paused mode:

- removes `paystack_bank_transfer`;
- preserves pay-on-delivery;
- preserves independently configured Google Pay and its handler config;
- removes checkout links/capabilities only when no payment method remains;
- flows through Agent Commerce, ACP, agent-native, and UCP routes;
- removes the Paystack provider choices and DVA-specific payment metadata from OpenAPI without removing the completion route.

Run the focused tests and confirm the new assertions fail for the intended reason.

**Step 4: Filter at the manifest authority and OpenAPI builder**

Apply the mode only to the DVA method in `buildAgenticPaymentMethods`. Keep Google Pay readiness based on its existing independently configured gateway rule. Build the OpenAPI completion payment schema from the same mode authority; paused output must not claim support for Paystack bank transfer.

**Step 5: Verify the complete discovery surface**

```bash
pnpm --filter @baci/web exec vitest run \
  src/lib/agentic/agentic-paystack-dva-mode.test.ts \
  src/lib/agentic/agentic-paystack-dva-paused.test.ts \
  src/lib/agentic/agent-commerce-manifest.test.ts \
  src/lib/agentic/ucp-discovery-profile-payment.test.ts \
  src/lib/agentic/acp-discovery-profile.test.ts \
  src/app/agent-commerce.json/route-checkout-capabilities.test.ts \
  src/app/.well-known/acp.json/route.test.ts \
  src/app/.well-known/agent-native-commerce/route.test.ts \
  src/app/.well-known/ucp/route.test.ts \
  src/app/openapi.json/route.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add apps/web/src/lib/agentic/agentic-paystack-dva-mode.ts apps/web/src/lib/agentic/agentic-paystack-dva-mode.test.ts apps/web/src/lib/agentic/agentic-paystack-dva-paused.ts apps/web/src/lib/agentic/agentic-paystack-dva-paused.test.ts apps/web/src/lib/agentic/agent-commerce-manifest.ts apps/web/src/lib/agentic/agent-commerce-manifest.test.ts apps/web/src/app/agent-commerce.json/route-checkout-capabilities.test.ts apps/web/src/app/openapi.json/route.ts apps/web/src/app/openapi.json/route.test.ts apps/web/src/app/.well-known/acp.json/route.test.ts apps/web/src/app/.well-known/agent-native-commerce/route.test.ts apps/web/src/app/.well-known/ucp/route.test.ts
git commit -m "feat: quiesce agentic Paystack DVA discovery"
```

### Task 2: Completion fail-closed gate

**Files:**

- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/checkout-session-complete-handler.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.test.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route-payment-state.test.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route-payment-account-resume.test.ts`
- Modify: `apps/web/src/lib/agentic/checkout-payment-setup.ts`
- Modify: `apps/web/src/lib/agentic/checkout-payment-setup.test.ts`
- Modify: `apps/web/src/lib/agentic/checkout-payment-setup-authorization.test.ts`

**Steps:**

1. Add failing tests for a normalized new Paystack request in paused mode.
2. Prove authentication, Zod parsing, replay lookup, and exact stored replay still occur first.
3. Add the stable `409` response code `AGENTIC_PAYSTACK_DVA_PAUSED` before payment claim/setup/finalization.
4. Assert no payment claim, provider call, session/account write, order creation, or bank detail response.
5. Assert pay-on-delivery and Google Pay paths remain unchanged.
6. Run focused completion/setup suites and commit `feat: block new paused agentic DVA setup`.

### Task 3: Grandfathered immutable replay

**Files:**

- Modify: `apps/web/src/lib/agentic/checkout-completion-response.ts`
- Modify: `apps/web/src/lib/agentic/checkout-completion-response.test.ts`
- Modify: completion route/state/resume tests from Task 2.

**Steps:**

1. Add failing tests for exact stored idempotency replay and complete pre-pause `payment_pending` state.
2. Require order id, account identity, buyer/payment snapshot, and matching immutable idempotency fingerprint.
3. Keep the path read-only and return the exact stored response.
4. Reject every changed identity, amount, buyer, order, or payment term.
5. Verify webhook matching tests stay green and commit `feat: preserve exact agentic DVA replay`.

### Task 4: Cutover inventory, audit, and drain

**Files:**

- Create: `apps/web/src/lib/agentic/agentic-dva-caller-contract.test.ts`
- Create: `apps/web/src/scripts/audit-agentic-dva-consent-cutover.ts`
- Create: `apps/web/src/scripts/audit-agentic-dva-consent-cutover.test.ts`
- Create: `apps/web/src/scripts/drain-agentic-dva-consent-cutover.ts`
- Create: `apps/web/src/scripts/drain-agentic-dva-consent-cutover.test.ts`
- Modify: `apps/web/package.json`

**Steps:**

1. Inventory every raw Paystack dedicated-account endpoint and transitive caller with a failing source-contract test.
2. Implement a bounded service-role audit that reports only state counts and opaque ids.
3. Implement a dry-run-by-default one-session drain requiring expected state and evidence fingerprint.
4. Permit only release of a stale no-account claim or idempotent resume using an already stored account; forbid provider create/get.
5. Add redaction canaries and zero-transitional-state assertions.
6. Run tests, typecheck the scripts, and commit `feat: add agentic DVA cutover controls`.

### Task 5: Preparation quality gate

1. Run `pnpm --filter @baci/web test` for the affected workspace.
2. Run `pnpm turbo lint` and `pnpm turbo typecheck`.
3. Run `pnpm turbo test` when focused suites and static checks pass.
4. Run `coderabbit review --prompt-only -t uncommitted` and address critical/high findings.
5. Review the exact branch diff against the design contract.
6. Do not set the production mode or deploy; hand off the tested code and the separate operator steps.
