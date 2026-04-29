# Ogabassey Agent Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Ogabassey storefront reliably discoverable, readable, purchasable, and supportable by external shopping agents while keeping the human storefront unchanged.

**Architecture:** Add an agent contract layer beside the existing storefront: canonical discovery files, markdown mirrors, current product feeds, agent-safe product APIs, checkout session conformance, and post-purchase read APIs. Reuse existing storefront, Supabase, trust profile, product URL, and stock helpers. Do not replace the ecommerce UI with an agent UI.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase, Zod, Vitest, Biome, Turborepo, Schema.org JSON-LD, OpenAI Agentic Commerce Protocol style checkout/feed contracts.

---

## Context And Rules

- `manage_stock === false` means unmanaged/infinite stock for this repo. It must be exposed as purchasable/untracked, not as out of stock.
- `manage_stock === null` or `undefined` must not be blindly treated as infinite in new agent-facing code. Preserve existing route-specific defaults unless a test proves the route intentionally treats missing `manage_stock` as unmanaged.
- `apps/web/src/proxy.ts` is protected by repo rules. Implementation of the markdown mirror task requires explicit user approval before editing.
- Existing migrations are append-only. This plan does not require editing existing migrations.
- Use `pnpm turbo lint && pnpm turbo typecheck` after code changes, plus targeted tests per task.
- Keep the storefront normal. The agentic layer is an additional machine contract, not a replacement for the UI.
- Agent checkout completion is a financial/order boundary. It must require either a verified human-confirmation artifact for the exact session/amount/currency or a pre-authorized payment mandate with explicit limits. A valid bearer token, HMAC signature, or idempotency key only authenticates the agent request; it is not buyer consent.
- Agents may create and update checkout sessions without a fresh human prompt, but Baci must not create an order, reserve/generate payment account details, start payment collection, or expose payment instructions until the completion request includes verified consent or a valid mandate. If consent is missing, expired, mismatched, or over limit, fail closed with a machine-readable `CONFIRMATION_REQUIRED` or `AUTHORIZATION_INVALID` response.
- Production check on 2026-04-28: `https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey` returns HTTP 500 with `{"error":"Failed to generate feed"}`. Treat this as confirmed broken until logs or local reproduction prove the deployed error has been fixed.
- Vercel production logs on 2026-04-28 show the Google Merchant feed failure is `DB_PRODUCTS_ERROR` with Postgres code `42703`: `column products.category_slug does not exist`. Public feed and sitemap work must not select `products.category_slug` directly unless a new migration adds and backfills that column.
- User approval to edit `apps/web/src/proxy.ts` for the scoped custom-domain `.md` mirror fix was granted on 2026-04-28 with: "you can edit. proceed".

## Layer Coverage

- **Discovery Layer:** Phases 1 and 2 make Ogabassey discoverable to crawlers and agents through `robots.txt`, `sitemap.xml`, `llms.txt`, `agent-commerce.json`, markdown mirrors, and public non-`/api` feed aliases.
- **Trust Layer:** Phases 2 and 4 must verify agents can trust the catalog before recommending it. Required checks include page/feed/API parity, Product/Offer JSON-LD audits, review and trust-profile schema coverage, image URL validation, crawler user-agent monitoring, and automated feed health alerts.
- **Action Layer:** Phase 3 covers safe shopping actions: merchant-scoped checkout sessions, cart/update/complete/cancel operations, payment handoff, idempotency keys, HMAC/request-integrity headers, replay protection, order-status reads, and explicit human-confirmation or pre-authorized mandate boundaries before any order/payment side effect.

## Mandatory Phase Review Gates

Every phase below must stop at a review gate before the next phase starts. A phase is not complete until local tests pass, a fresh review sub-agent approves the phase diff, CodeRabbit raises no critical/high issues, and any accepted review feedback has been fixed and re-reviewed.

### Phase Map

- **Phase 0: Worktree And Baseline**
  - Tasks: 0
  - Gate name: `phase-0-worktree-baseline`
- **Phase 1: Discovery And Readability**
  - Tasks: 1, 2, 3, 4, 5, 6, 7, 8
  - Gate name: `phase-1-discovery-readability`
- **Phase 2: Merchant Center And Public Machine Feeds**
  - Tasks: 9
  - Gate name: `phase-2-merchant-feeds`
- **Phase 3: Agentic Checkout Contract**
  - Tasks: 10, 11, 12, 12A, 13, 14, 15, 15A, 16, 16A, 16B
  - Gate name: `phase-3-agentic-checkout`
- **Phase 4: Post-Purchase And Final Verification**
  - Tasks: 17, 18
  - Gate name: `phase-4-final-verification`

### Gate Procedure

At the start of each phase, record the base commit:

```bash
PHASE_BASE=$(git rev-parse HEAD)
```

At the end of each phase:

- [ ] Run the targeted tests listed in the completed tasks.
- [ ] Run `pnpm turbo lint && pnpm turbo typecheck` when product code changed.
- [ ] Treat task-level "Stage For Phase Review" steps as staging/checkpoint instructions only. Do not commit after individual tasks unless that task is deliberately promoted into its own reviewed phase.
- [ ] Dispatch a fresh review sub-agent with this exact scope:

```text
Review phase <PHASE_NAME> in /Users/mac/Baci-app/.worktrees/ogabassey-agent-readiness.
Compare changes from <PHASE_BASE> to HEAD, plus any unstaged changes.
Check the implementation against docs/superpowers/plans/2026-04-28-ogabassey-agent-readiness.md for only the tasks in this phase.
Focus on spec gaps, multi-tenant regressions, security issues, missing tests, and agent-readability regressions.
Do not edit files. Return findings ordered by severity with file and line references.
```

- [ ] Fix all sub-agent critical and important findings, or document a technical reason for rejecting a finding.
- [ ] Run CodeRabbit for the phase diff:

```bash
coderabbit --version
coderabbit auth status --agent
coderabbit review --agent --base-commit "$PHASE_BASE" -c AGENTS.md
```

- [ ] Fix all CodeRabbit critical/high findings before moving on. If CodeRabbit reports an authentication, installation, network, or timeout failure, stop and record the exact failure instead of substituting a manual review.
- [ ] Re-run affected targeted tests after fixes.
- [ ] Commit the phase changes only after the sub-agent and CodeRabbit gates are clean.

## File Map

- Modify: `apps/web/src/proxy.ts`
  - Fix custom-domain `.md` mirror routing after explicit approval.
- Modify: `apps/web/src/proxy.test.ts`
  - Add custom-domain markdown mirror regression tests.
- Modify: `apps/web/src/lib/normalize-product.ts`
  - Normalize availability using unmanaged stock semantics.
- Create: `apps/web/src/lib/storefront-agent-availability.ts`
  - Single helper for agent-facing availability, inventory policy, quantity, and purchasability.
- Create: `apps/web/src/lib/storefront-agent-availability.test.ts`
  - Tests for managed, unmanaged, missing, low, and out-of-stock products.
- Create: `apps/web/src/lib/storefront-agent-urls.ts`
  - Single helper for canonical custom-domain product, category, policy, and feed URLs.
- Create: `apps/web/src/lib/storefront-agent-urls.test.ts`
  - Tests that Ogabassey URLs do not include `/ogabassey/` on `ogabassey.com`.
- Modify: `apps/web/src/lib/llms.ts`
  - Add machine-readable commerce links and avoid linking broken markdown paths.
- Modify: `apps/web/src/lib/llms.test.ts`
  - Assert `llms.txt` includes valid machine-readable commerce links.
- Modify: `apps/web/src/lib/llms-markdown.ts`
  - Use canonical URLs and include agent-readable purchase metadata.
- Modify: `apps/web/src/app/api/feed/openai/route.ts`
  - Emit canonical URLs and support current structured product feed shape.
- Modify: `apps/web/src/app/api/feed/openai/route.test.ts`
  - Preserve unmanaged stock tests and add canonical URL/current feed tests.
- Modify: `apps/web/src/app/api/feed/google-merchant/route.ts`
  - Make Ogabassey Google Merchant feed return XML instead of a generic 500.
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-query.ts`
  - Remove direct `products.category_slug` selection and rely on joined categories.
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-query.test.ts`
  - Assert feed selects do not reference missing live database columns.
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.ts`
  - Harden data fetching and normalize missing optional feed data without crashing.
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`
  - Preserve valid Merchant Center XML while handling sparse product rows.
- Modify tests under `apps/web/src/app/api/feed/google-merchant/**`
  - Add Ogabassey regression coverage for feed generation, canonical URLs, images, variants, and unmanaged stock.
- Create: `apps/web/src/app/feeds/openai.jsonl/route.ts`
  - Public non-`/api` storefront alias for the legacy OpenAI JSONL product feed.
- Create: `apps/web/src/app/feeds/agent-products.jsonl/route.ts`
  - Public non-`/api` storefront alias for the current structured agent product feed.
- Create: `apps/web/src/app/feeds/openai-feed-response.ts`
  - Shared public OpenAI feed response builder used by both aliases.
- Create: `apps/web/src/config/storefront-feed-routes.ts`
  - Single source of truth for storefront public machine-feed paths.
- Create: `apps/web/src/app/feeds/google-merchant.xml/route.ts`
  - Public non-`/api` storefront alias for the Google Merchant XML feed.
- Create: `apps/web/src/app/feeds/google-merchant.xml/route.test.ts`
  - Tests that custom-domain requests produce/redirect to the correct Ogabassey feed.
- Modify: `apps/web/src/app/robots.ts`
  - Keep `/api/` disallowed while making `/feeds/google-merchant.xml` available for compliant crawlers.
- Modify: `apps/web/src/app/robots.test.ts`
  - Assert storefront robots guidance does not block `/feeds/google-merchant.xml`.
- Create: `apps/web/src/app/agent-commerce.json/route.ts`
  - Host-scoped agent commerce manifest for storefront domains.
- Create: `apps/web/src/app/agent-commerce.json/route.test.ts`
  - Tests for Ogabassey manifest links, API version, capabilities, and policies.
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
  - Make root sitemap fail-soft and avoid direct `products.category_slug` selection.
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`
  - Assert root sitemap still returns static and trust URLs when one catalog source fails.
- Modify: `apps/web/src/app/api/storefront/products/storefront-products-route-data.ts`
  - Add agent-safe availability fields and canonical path fields.
- Modify: `apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts`
  - Add unmanaged stock and canonical path tests.
- Modify: `apps/web/src/app/api/storefront/products/product-response.ts`
  - Replace `select('*')` and expose the same agent-safe availability semantics.
- Modify: `apps/web/src/app/api/storefront/products/product-response.test.ts`
  - Assert no wildcard select and unmanaged stock availability.
- Modify: `apps/web/src/app/api/storefront/[slug]/products/route.ts`
  - Remove debug logs, adjust cache policy, and include canonical URL fields.
- Create: `apps/web/src/lib/agentic/merchant-context.ts`
  - Resolve the merchant associated with an agentic API key without hardcoding Ogabassey in checkout routes.
- Create: `apps/web/src/lib/agentic/merchant-context.test.ts`
  - Tests for per-merchant keys and legacy Ogabassey fallback key.
- Create: `apps/web/src/lib/agentic/scoped-supabase.ts`
  - Build a merchant-scoped Supabase client for agentic routes using an internal short-lived JWT, so agent-facing routes do not use generic service-role clients for user data.
- Create: `apps/web/src/lib/agentic/scoped-supabase.test.ts`
  - Tests that the generated client is scoped to the resolved merchant and never exposes the service-role key.
- Create: `apps/web/src/lib/agentic/request-integrity.ts`
  - Verify agent request signatures, timestamps, request IDs, and API versions for mutating checkout calls.
- Create: `apps/web/src/lib/agentic/request-integrity.test.ts`
  - Tests for accepted signatures, stale timestamps, missing headers, and bad signatures.
- Create: `apps/web/src/lib/agentic/request-replay.ts`
  - Reserve agent request IDs so signed mutating requests cannot be replayed inside the timestamp window.
- Create: `apps/web/src/lib/agentic/request-replay.test.ts`
  - Tests for request-id reservation, replay rejection, and TTL cleanup.
- Create: `supabase/migrations/20260428171000_add_agentic_request_records.sql`
  - Append-only migration for request-id replay protection.
- Create: `apps/web/src/lib/agentic/idempotency.ts`
  - Shared idempotency helpers for checkout create, update, and complete calls.
- Create: `apps/web/src/lib/agentic/idempotency.test.ts`
  - Tests for replay, conflict, and response caching behavior.
- Create: `apps/web/src/lib/agentic/checkout-response.ts`
  - Shared response builder for checkout create, get, update, complete, and cancel routes.
- Create: `apps/web/src/lib/agentic/checkout-response.test.ts`
  - Tests for spec-shaped payment provider, links, status, and fulfillment fields.
- Create: `apps/web/src/lib/agentic/checkout-authorization.ts`
  - Verify human-confirmation artifacts and pre-authorized payment mandates before order/payment side effects.
- Create: `apps/web/src/lib/agentic/checkout-authorization.test.ts`
  - Tests for exact session/amount/currency matching, mandate limits, expiry, and fail-closed behavior.
- Create: `apps/web/src/lib/agentic/checkout-storage.ts`
  - Map agentic checkout requests/responses onto the existing `checkout_sessions` table columns.
- Create: `apps/web/src/lib/agentic/checkout-storage.test.ts`
  - Tests that no invalid checkout status values or nonexistent columns are written.
- Create: `supabase/migrations/20260428170000_add_checkout_sessions_agentic_metadata.sql`
  - Append-only migration that adds `checkout_sessions.metadata` for agent idempotency and DVA state.
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
  - Use merchant-scoped context, request integrity, idempotency, and shared response builder.
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`
  - Use shared response builder for GET and update responses.
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
  - Validate body with Zod, require verified confirmation or mandate, keep completion idempotent, and return agent-safe payment pending state.
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts`
  - Return full cart state on cancellation.
- Modify: `apps/web/src/app/api/payments/webhook/route.ts`
  - Confirm agentic bank-transfer payments from Paystack/webhook events idempotently.
- Modify: `apps/web/src/app/api/payments/webhook/route.test.ts`
  - Cover agentic payment confirmation, failure, and duplicate webhook events.
- Modify: `apps/web/src/lib/agentic/auth.ts`
  - Keep low-level bearer parsing and constant-time token comparison helpers.
- Modify: `apps/web/src/lib/agentic/checkout.ts`
  - Treat `manage_stock=false` as unlimited during checkout calculations.
- Modify: `apps/web/src/schemas/agentic-checkout.ts`
  - Accept spec names like `fulfillment_address`; retain backwards-compatible `shipping_address` during migration.
- Modify tests under `apps/web/src/app/api/agentic/checkout_sessions/**`
  - Add conformance tests for stock, auth, idempotency, and response shape.
- Modify: `apps/web/src/app/agent-commerce.json/route.ts`
  - After Phase 3 endpoints pass, advertise action-layer capabilities and auth headers behind an explicit readiness flag.
- Modify: `apps/web/src/app/agent-commerce.json/route.test.ts`
  - Cover catalog-only mode and action-ready mode so the manifest never advertises unavailable checkout endpoints.

---

### Task 0: Create The Isolated Worktree

**Files:**
- Copy into worktree: `docs/superpowers/plans/2026-04-28-ogabassey-agent-readiness.md`

- [x] **Step 1: Confirm protected-file approval**

Approval to edit `apps/web/src/proxy.ts` was granted by the user on 2026-04-28 for the scoped custom-domain markdown mirror fix.

No further approval prompt is required unless the proxy scope expands beyond this fix.

- [x] **Step 2: Verify project-local worktree directory**

Run from `/Users/mac/Baci-app`:

```bash
ls -d .worktrees
git check-ignore -v .worktrees
```

Expected:

- `.worktrees` exists.
- `git check-ignore` reports `.git/info/exclude:9:.worktrees/`, proving project-local worktrees are ignored.

- [x] **Step 3: Create isolated worktree from `origin/main`**

Run:

```bash
git fetch origin main
git worktree add .worktrees/ogabassey-agent-readiness -b codex/ogabassey-agent-readiness origin/main
```

Expected: `/Users/mac/Baci-app/.worktrees/ogabassey-agent-readiness` exists and is on `codex/ogabassey-agent-readiness`.

- [x] **Step 4: Copy this plan into the worktree**

Run:

```bash
mkdir -p .worktrees/ogabassey-agent-readiness/docs/superpowers/plans
cp docs/superpowers/plans/2026-04-28-ogabassey-agent-readiness.md .worktrees/ogabassey-agent-readiness/docs/superpowers/plans/2026-04-28-ogabassey-agent-readiness.md
```

Expected: the implementation worktree has the same plan file even though the source checkout currently has unrelated dirty work.

- [x] **Step 5: Install dependencies if needed**

Run:

```bash
cd .worktrees/ogabassey-agent-readiness
pnpm install --frozen-lockfile
```

Expected: dependencies are available in the worktree without lockfile changes.

- [x] **Step 6: Confirm clean baseline**

Run:

```bash
cd /Users/mac/Baci-app/.worktrees/ogabassey-agent-readiness
git status --short --branch
pnpm --filter web test src/lib/llms.test.ts src/app/api/feed/google-merchant/route.test.ts
```

Expected:

- Branch is `codex/ogabassey-agent-readiness`.
- Only the copied plan file is untracked or modified before implementation starts.
- Targeted baseline tests pass. If they fail before any implementation edits, stop and record the pre-existing failure before proceeding.

Actual baseline note: because `pnpm --filter web test` runs Vitest from `apps/web`, the repo-root test paths produced `No test files found`. The equivalent package-relative command passed on 2026-04-28:

```bash
pnpm --filter web test src/lib/llms.test.ts src/app/api/feed/google-merchant/route.test.ts
```

---

### Task 1: Normalize Agent-Facing Availability

**Files:**
- Create: `apps/web/src/lib/storefront-agent-availability.ts`
- Create: `apps/web/src/lib/storefront-agent-availability.test.ts`
- Modify: `apps/web/src/lib/normalize-product.ts`
- Test: `apps/web/src/lib/storefront-agent-availability.test.ts`

- [ ] **Step 1: Write failing availability tests**

Create `apps/web/src/lib/storefront-agent-availability.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import {
  getStorefrontAgentAvailability,
  isUnmanagedStock,
} from './storefront-agent-availability';

describe('storefront agent availability', () => {
  it('treats manage_stock=false as untracked and purchasable', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: false,
        stock: 0,
        stock_quantity: 0,
      })
    ).toEqual({
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock: 0,
    });
  });

  it('treats managed zero stock as out of stock', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: true,
        stock: 0,
        stock_quantity: 0,
      })
    ).toMatchObject({
      availability: 'out_of_stock',
      inventory_policy: 'tracked',
      is_purchasable: false,
      quantity_available: 0,
    });
  });

  it('treats managed positive stock as in stock with a quantity', () => {
    expect(
      getStorefrontAgentAvailability({
        manage_stock: true,
        stock: 3,
        stock_quantity: 3,
      })
    ).toMatchObject({
      availability: 'in_stock',
      inventory_policy: 'tracked',
      is_purchasable: true,
      quantity_available: 3,
    });
  });

  it('does not infer untracked inventory from missing manage_stock', () => {
    expect(isUnmanagedStock({ manage_stock: undefined })).toBe(false);
    expect(isUnmanagedStock({ manage_stock: null })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/storefront-agent-availability.test.ts
```

Expected: FAIL because `storefront-agent-availability.ts` does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/web/src/lib/storefront-agent-availability.ts`:

```typescript
import { getEffectiveStock, type ManagedStockLike } from '@/lib/product-stock';

export type StorefrontAgentAvailability = {
  availability: 'in_stock' | 'out_of_stock';
  inventory_policy: 'tracked' | 'untracked';
  is_purchasable: boolean;
  quantity_available: number | null;
  stock: number;
};

export function isUnmanagedStock(
  product: Pick<ManagedStockLike, 'manage_stock'>
): boolean {
  return product.manage_stock === false;
}

export function getStorefrontAgentAvailability(
  product: ManagedStockLike
): StorefrontAgentAvailability {
  const stock = getEffectiveStock(product);

  if (isUnmanagedStock(product)) {
    return {
      availability: 'in_stock',
      inventory_policy: 'untracked',
      is_purchasable: true,
      quantity_available: null,
      stock,
    };
  }

  const isPurchasable = stock > 0;

  return {
    availability: isPurchasable ? 'in_stock' : 'out_of_stock',
    inventory_policy: 'tracked',
    is_purchasable: isPurchasable,
    quantity_available: stock,
    stock,
  };
}
```

- [ ] **Step 4: Use helper in normalization**

Modify `apps/web/src/lib/normalize-product.ts`:

```typescript
import { getStorefrontAgentAvailability } from '@/lib/storefront-agent-availability';
```

Replace the current stock availability block with:

```typescript
  const agentAvailability = getStorefrontAgentAvailability({
    manage_stock:
      typeof raw.manage_stock === 'boolean'
        ? raw.manage_stock
        : undefined,
    stock: raw.stock,
    stock_quantity: raw.stock_quantity,
  });
  const stock = agentAvailability.stock;
  const availability: 'InStock' | 'OutOfStock' =
    agentAvailability.availability === 'in_stock' ? 'InStock' : 'OutOfStock';
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
pnpm --filter web test src/lib/storefront-agent-availability.test.ts
```

Expected: PASS.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/storefront-agent-availability.ts apps/web/src/lib/storefront-agent-availability.test.ts apps/web/src/lib/normalize-product.ts
```

---

### Task 2: Fix Custom-Domain Markdown Mirrors

**Files:**
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/src/proxy.test.ts`
- Test: `apps/web/src/proxy.test.ts`

- [ ] **Step 1: Write failing proxy tests**

Add tests to `apps/web/src/proxy.test.ts`:

```typescript
  it.each([
    ['/index.html.md', '/api/llm/ogabassey'],
    ['/about.md', '/api/llm/ogabassey/about'],
    ['/laptops/hp-probook-440-g8.md', '/api/llm/ogabassey/laptops/hp-probook-440-g8'],
  ])('rewrites custom-domain markdown mirror %s to %s', async (path, expectedPath) => {
    const req = new NextRequest(`https://ogabassey.com${path}`);
    req.headers.set('host', 'ogabassey.com');

    const res = await proxy(req);
    const rewrite = res.headers.get('x-middleware-rewrite');

    expect(rewrite).toBeTruthy();
    expect(new URL(rewrite || '').pathname).toBe(expectedPath);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/proxy.test.ts
```

Expected: FAIL for `/index.html.md`, because the early slug-based markdown rewrite captures custom-domain root markdown paths.

- [ ] **Step 3: Implement scoped proxy fix**

In `apps/web/src/proxy.ts`, change the early slug-based markdown block so it only applies to platform/root-domain slug paths, not custom-domain or subdomain storefront hosts.

Use this shape near the current slug-based markdown block:

```typescript
  const isPlatformMarkdownHost =
    isRootDomain(hostname, ROOT_DOMAIN) ||
    isVercelPreview(hostname) ||
    hostname.startsWith('localhost') ||
    hostname.startsWith('127.0.0.1');

  if (
    isPlatformMarkdownHost &&
    pathname.endsWith('.md') &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/_next')
  ) {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length >= 1) {
      const slug = segments[0];
      const rest = pathname.slice(`/${slug}`.length);
      const mdUrl = request.nextUrl.clone();
      mdUrl.pathname = toLlmApiPath(rest, slug);
      return NextResponse.rewrite(mdUrl);
    }
  }
```

The existing custom-domain and subdomain markdown rewrite blocks later in `proxy.ts` should then handle `ogabassey.com/index.html.md`.

- [ ] **Step 4: Run proxy tests**

Run:

```bash
pnpm --filter web test src/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stage For Phase Review**

Run:

```bash
git add apps/web/src/proxy.ts apps/web/src/proxy.test.ts
```

---

### Task 3: Make Storefront Discovery Files Point To Working Machine Surfaces

**Files:**
- Modify: `apps/web/src/lib/llms.ts`
- Modify: `apps/web/src/lib/llms.test.ts`
- Modify: `apps/web/src/lib/llms-markdown.ts`
- Test: `apps/web/src/lib/llms.test.ts`

- [ ] **Step 1: Add failing llms tests**

Add assertions to the existing `apps/web/src/lib/llms.test.ts` suite:

```typescript
import { buildLlmsText } from './llms';

it('includes machine-readable commerce links for storefront hosts', () => {
  const body = buildLlmsText(
    'ogabassey.com',
    'https://ogabassey.com',
    true,
    new Headers({ 'x-custom-domain': 'ogabassey.com' })
  );

  expect(body).toContain('## Machine-Readable Commerce');
  expect(body).toContain('https://ogabassey.com/agent-commerce.json');
  expect(body).toContain('Agent Commerce Manifest');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/llms.test.ts
```

Expected: FAIL because `Machine-Readable Commerce` is not present.

- [ ] **Step 3: Add commerce link section**

Modify `apps/web/src/lib/llms.ts` inside `buildStorefrontLlms`:

```typescript
    '## Machine-Readable Commerce',
    `- [Agent Commerce Manifest](${baseUrl}/agent-commerce.json): Capabilities, API version, policy links, checkout base URL, and feed URLs`,
    '',
```

The manifest resolves the merchant slug from the request host, so `llms.txt` can stay generic across current and future Baci storefronts.

- [ ] **Step 4: Run llms tests**

Run:

```bash
pnpm --filter web test src/lib/llms.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/llms.ts apps/web/src/lib/llms.test.ts apps/web/src/lib/llms-markdown.ts
```

---

### Task 4: Add Canonical Agent URL Helpers

**Files:**
- Create: `apps/web/src/lib/storefront-agent-urls.ts`
- Create: `apps/web/src/lib/storefront-agent-urls.test.ts`
- Modify later in dependent tasks.

- [ ] **Step 1: Write failing URL tests**

Create `apps/web/src/lib/storefront-agent-urls.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildAgentProductUrl, buildAgentPolicyUrls } from './storefront-agent-urls';

describe('storefront agent URLs', () => {
  it('builds custom-domain product URLs without merchant slug prefix', () => {
    expect(
      buildAgentProductUrl({
        baseUrl: 'https://ogabassey.com',
        product: {
          id: 'product-1',
          slug: 'hp-probook-440-g8',
          name: 'HP ProBook 440 G8',
          category: 'Laptops',
          category_slug: 'laptops',
          canonical_url: null,
        },
      })
    ).toBe('https://ogabassey.com/laptops/hp-probook-440-g8');
  });

  it('normalizes policy URLs to canonical storefront routes', () => {
    expect(buildAgentPolicyUrls('https://ogabassey.com')).toEqual({
      privacy_policy_url: 'https://ogabassey.com/privacy',
      return_policy_url: 'https://ogabassey.com/returns',
      shipping_policy_url: 'https://ogabassey.com/shipping',
      terms_of_service_url: 'https://ogabassey.com/terms',
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/storefront-agent-urls.test.ts
```

Expected: FAIL because helper does not exist.

- [ ] **Step 3: Implement helper**

Create `apps/web/src/lib/storefront-agent-urls.ts`:

```typescript
import { getProductUrl } from '@/lib/seo-utils';

type AgentProductUrlInput = {
  baseUrl: string;
  product: {
    id: string;
    slug?: string | null;
    name: string;
    category?: string | null;
    category_slug?: string | null;
    canonical_url?: string | null;
    categories?: { slug?: string | null } | null;
  };
};

export function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function buildAgentProductUrl({
  baseUrl,
  product,
}: AgentProductUrlInput): string {
  return `${trimTrailingSlash(baseUrl)}${getProductUrl({
    ...product,
    canonical_url: product.canonical_url ?? null,
  })}`;
}

export function buildAgentPolicyUrls(baseUrl: string) {
  const root = trimTrailingSlash(baseUrl);

  return {
    privacy_policy_url: `${root}/privacy`,
    return_policy_url: `${root}/returns`,
    shipping_policy_url: `${root}/shipping`,
    terms_of_service_url: `${root}/terms`,
  };
}
```

- [ ] **Step 4: Run URL tests**

Run:

```bash
pnpm --filter web test src/lib/storefront-agent-urls.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/storefront-agent-urls.ts apps/web/src/lib/storefront-agent-urls.test.ts
```

---

### Task 5: Fix Root Sitemap Resilience

**Files:**
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`
- Modify: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`
- Test: `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`

- [ ] **Step 1: Write failing fail-soft test**

Add to `apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts`:

```typescript
it('keeps root sitemap available when product sitemap generation fails', async () => {
  const {
    getRootSitemapEntries,
  } = await import('./sitemap-data');

  const context = {
    merchant: { id: 'merchant-1', slug: 'ogabassey', business_name: 'Ogabassey' },
    storeUrl: 'https://ogabassey.com',
    supabase: {
      from: () => {
        throw new Error('catalog source unavailable');
      },
    },
  } as unknown as Parameters<typeof getRootSitemapEntries>[0];

  const entries = await getRootSitemapEntries(context);

  expect(entries.some((entry) => entry.url === 'https://ogabassey.com')).toBe(true);
  expect(entries.some((entry) => entry.url === 'https://ogabassey.com/faq')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test 'src/app/(storefront)/[slug]/sitemap-data.test.ts'
```

Expected: FAIL because `getRootSitemapEntries` lets product/category/commercial exceptions fail the whole root sitemap.

- [ ] **Step 3: Implement fail-soft root sitemap composition**

Modify `getRootSitemapEntries` in `apps/web/src/app/(storefront)/[slug]/sitemap-data.ts`:

```typescript
async function getSafeSitemapEntries(
  label: string,
  loader: () => Promise<MetadataRoute.Sitemap>
): Promise<MetadataRoute.Sitemap> {
  try {
    return await loader();
  } catch (error) {
    console.warn(`storefront sitemap: ${label} entries unavailable`, { error });
    return [];
  }
}

export async function getRootSitemapEntries(
  context: StorefrontSitemapContext
): Promise<MetadataRoute.Sitemap> {
  const staticEntries = getStaticSitemapEntries(context.storeUrl);
  const [
    productEntries,
    categoryEntries,
    blogEntries,
    commercialSupportEntries,
  ] = await Promise.all([
    getSafeSitemapEntries('products', () => getProductSitemapEntries(context)),
    getSafeSitemapEntries('categories', () => getCategorySitemapEntries(context)),
    getSafeSitemapEntries('blog', () => getBlogSitemapEntries(context)),
    getSafeSitemapEntries('commercial-support', () =>
      getCommercialSupportSitemapEntries(context)
    ),
  ]);

  return [
    ...staticEntries,
    ...productEntries,
    ...categoryEntries,
    ...blogEntries,
    ...commercialSupportEntries,
  ];
}
```

- [ ] **Step 4: Remove direct `products.category_slug` selection from product sitemap**

In `getProductSitemapEntries`, replace the product select:

```typescript
.select(
  'id, slug, category, canonical_url, images, updated_at, category_id, categories:category_id(slug)'
)
```

Then derive the category slug only from the joined category relation:

```typescript
const normalizedJoinedCategory =
  product.categories?.slug && product.categories.slug.trim().length > 0
    ? { slug: product.categories.slug.trim() }
    : null;
```

Remove the branch that reads `product.category_slug`. This prevents the live `42703 column products.category_slug does not exist` failure from breaking sitemap product entries.

- [ ] **Step 5: Run sitemap tests**

Run:

```bash
pnpm --filter web test 'src/app/(storefront)/[slug]/sitemap-data.test.ts'
```

Expected: PASS.

- [ ] **Step 6: Live verification after deploy**

Run:

```bash
curl -sS -L -D - https://ogabassey.com/sitemap.xml -o /tmp/ogabassey-sitemap.xml
head -40 /tmp/ogabassey-sitemap.xml
```

Expected after deployment: HTTP 200 and XML containing `<urlset`.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add 'apps/web/src/app/(storefront)/[slug]/sitemap-data.ts' 'apps/web/src/app/(storefront)/[slug]/sitemap-data.test.ts'
```

---

### Task 6: Upgrade Public Product API For Agent Readability

**Files:**
- Modify: `apps/web/src/app/api/storefront/products/storefront-products-route-data.ts`
- Modify: `apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts`
- Modify: `apps/web/src/app/api/storefront/products/product-response.ts`
- Modify: `apps/web/src/app/api/storefront/products/product-response.test.ts`
- Modify: `apps/web/src/app/api/storefront/[slug]/products/route.ts`

- [ ] **Step 1: Write failing unmanaged stock API test**

Add to `apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts`:

```typescript
it('maps unmanaged stock as purchasable for agents', () => {
  const mapped = storefrontProductsRouteData.mapProduct({
    id: 'product-1',
    name: 'Riversong Watch',
    description: 'Daily tracking smartwatch.',
    price: 30600,
    images: [],
    category: 'Smartwatches',
    category_id: null,
    slug: 'riversong-watch',
    stock: 0,
    stock_quantity: 0,
    manage_stock: false,
    status: 'active',
  });

  expect(mapped.availability).toBe('in_stock');
  expect(mapped.inventory_policy).toBe('untracked');
  expect(mapped.is_purchasable).toBe(true);
  expect(mapped.quantity_available).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/app/api/storefront/products/storefront-products-route-data.test.ts
```

Expected: FAIL because those fields are not returned.

- [ ] **Step 3: Implement agent-safe fields**

Modify `apps/web/src/app/api/storefront/products/storefront-products-route-data.ts`:

```typescript
import { getStorefrontAgentAvailability } from '@/lib/storefront-agent-availability';
```

Inside `mapProduct`, add:

```typescript
  const agentAvailability = getStorefrontAgentAvailability({
    manage_stock:
      typeof product.manage_stock === 'boolean'
        ? product.manage_stock
        : undefined,
    stock: product.stock as number | string | null | undefined,
    stock_quantity: product.stock_quantity as number | string | null | undefined,
    low_stock_threshold:
      product.low_stock_threshold as number | string | null | undefined,
  });
```

Return these fields:

```typescript
    availability: agentAvailability.availability,
    inventory_policy: agentAvailability.inventory_policy,
    is_purchasable: agentAvailability.is_purchasable,
    quantity_available: agentAvailability.quantity_available,
```

- [ ] **Step 4: Remove wildcard select**

In `apps/web/src/app/api/storefront/products/product-response.ts`, replace:

```typescript
export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  *,
```

with explicit product columns already needed by `mapStorefrontProduct`, including:

```typescript
export const STOREFRONT_PRODUCTS_FULL_SELECT = `
  id,
  merchant_id,
  name,
  slug,
  description,
  images,
  category,
  category_id,
  brand,
  price,
  compare_at_price,
  condition,
  stock,
  stock_quantity,
  status,
  manage_stock,
  low_stock_threshold,
  image_hint,
  specifications,
  product_key_specs,
  has_variants,
  has_condition_offers,
  offers,
  color_images,
  variant_attributes,
```

Keep the existing category joins after the explicit column list.

- [ ] **Step 5: Clean slug product API**

Modify `apps/web/src/app/api/storefront/[slug]/products/route.ts`:

- Remove debug `console.log` calls.
- Replace `public, s-maxage=10, stale-while-revalidate=30` with:

```typescript
'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600'
```

- Include agent-safe fields from `getStorefrontAgentAvailability` in its local mapper.

- [ ] **Step 6: Run product API tests**

Run:

```bash
pnpm --filter web test src/app/api/storefront/products/storefront-products-route-data.test.ts src/app/api/storefront/products/product-response.test.ts
```

Expected: PASS.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/app/api/storefront/products/storefront-products-route-data.ts apps/web/src/app/api/storefront/products/storefront-products-route-data.test.ts apps/web/src/app/api/storefront/products/product-response.ts apps/web/src/app/api/storefront/products/product-response.test.ts 'apps/web/src/app/api/storefront/[slug]/products/route.ts'
```

---

### Task 7: Publish Agent Commerce Manifest

**Files:**
- Create: `apps/web/src/app/agent-commerce.json/route.ts`
- Create: `apps/web/src/app/agent-commerce.json/route.test.ts`
- Modify: `apps/web/src/lib/llms.ts`

- [ ] **Step 1: Write failing manifest test**

Create `apps/web/src/app/agent-commerce.json/route.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/storefront-route-identifier', () => ({
  resolveRouteIdentifier: () => 'ogabassey.com',
}));

vi.mock('@/lib/cached-data', () => ({
  getMerchantByIdentifier: async () => ({
    id: 'merchant-1',
    slug: 'ogabassey',
    business_name: 'Ogabassey',
    custom_domain: 'ogabassey.com',
  }),
}));

vi.mock('@/lib/store-url', () => ({
  buildRequestScopedStoreUrl: () => 'https://ogabassey.com',
}));

describe('GET /agent-commerce.json', () => {
  it('returns Ogabassey agent commerce capabilities for the custom domain', async () => {
    const response = await GET(
      new Request('https://ogabassey.com/agent-commerce.json', {
        headers: { host: 'ogabassey.com' },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.store.slug).toBe('ogabassey');
    expect(body.capabilities).toEqual(['catalog.read']);
    expect(body.auth).toBeNull();
    expect(body.links.product_feed).toBe(
      'https://ogabassey.com/feeds/openai.jsonl'
    );
    expect(body.links.feeds).toMatchObject({
      agent_products: 'https://ogabassey.com/feeds/agent-products.jsonl',
      google_merchant_xml: 'https://ogabassey.com/feeds/google-merchant.xml',
    );
    expect(body.links.checkout_sessions).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/app/agent-commerce.json/route.test.ts
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement manifest route**

Create `apps/web/src/app/agent-commerce.json/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { buildAgentPolicyUrls } from '@/lib/storefront-agent-urls';
import { resolveRouteIdentifier } from '@/lib/storefront-route-identifier';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';

export async function GET(request: Request) {
  const headersList = new Headers(request.headers);
  const routeIdentifier = resolveRouteIdentifier(headersList);
  const merchant = routeIdentifier
    ? await getMerchantByIdentifier(routeIdentifier)
    : null;

  if (!merchant) {
    return NextResponse.json(
      { error: 'Agent commerce manifest is only available on storefront hosts' },
      { status: 404 }
    );
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, headersList);
  const slug = merchant.slug;

  return NextResponse.json(
    {
      schema_version: '2026-04-28',
      platform: 'baci',
      store: {
        slug,
        name: merchant.business_name,
        canonical_origin: baseUrl,
      },
      capabilities: ['catalog.read'],
      auth: null,
      links: {
        llms: `${baseUrl}/llms.txt`,
        llms_full: `${baseUrl}/llms-full.txt`,
        product_feed: `${baseUrl}/feeds/openai.jsonl`,
        feeds: {
          agent_products: `${baseUrl}/feeds/agent-products.jsonl`,
          google_merchant_xml: `${baseUrl}/feeds/google-merchant.xml`,
        },
        product_api: `${baseUrl}/api/storefront/${slug}/products`,
        ...buildAgentPolicyUrls(baseUrl),
      },
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    }
  );
}
```

Phase 1 must not advertise checkout/session/order capabilities until Phase 3 endpoints are implemented, authenticated, and verified. Phase 3 should update this manifest to add `checkout.session.*`, `order.read`, `auth.required_headers`, and `links.checkout_sessions` only after the phase gate passes.

- [ ] **Step 4: Run manifest tests**

Run:

```bash
pnpm --filter web test src/app/agent-commerce.json/route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stage For Phase Review**

Run:

```bash
git add apps/web/src/app/agent-commerce.json/route.ts apps/web/src/app/agent-commerce.json/route.test.ts apps/web/src/lib/llms.ts
```

---

### Task 8: Upgrade OpenAI Product Feed To Current Structured Shape

**Files:**
- Modify: `apps/web/src/app/api/feed/openai/route.ts`
- Modify: `apps/web/src/app/api/feed/openai/route.test.ts`
- Reuse: `apps/web/src/lib/storefront-agent-urls.ts`
- Reuse: `apps/web/src/lib/storefront-agent-availability.ts`

- [ ] **Step 1: Write failing current-feed tests**

Add to `apps/web/src/app/api/feed/openai/route.test.ts`:

```typescript
it('emits current structured product objects when format=current', async () => {
  const { GET } = await import('./route');
  mockGetCachedOpenAIFeedData.mockResolvedValue({
    products: [
      simpleProduct({
        id: 'product-1',
        name: 'Riversong Motive 5T Smart Watch',
        slug: 'riversong-motive-5t-smart-watch',
        category: 'Smartwatches',
        category_slug: 'smartwatches',
        price: 30600,
        stock: 0,
        manage_stock: false,
      }),
    ],
  });

  const response = await GET(
    new NextRequest(
      'https://ogabassey.com/api/feed/openai?merchant_slug=ogabassey&format=current',
      { headers: { host: 'ogabassey.com' } }
    )
  );
  const line = (await response.text()).trim().split('\n')[0];
  const parsed = JSON.parse(line);

  expect(parsed).toMatchObject({
    id: 'product-1',
    title: 'Riversong Motive 5T Smart Watch',
    url: 'https://ogabassey.com/smartwatches/riversong-motive-5t-smart-watch',
  });
  expect(parsed.variants[0]).toMatchObject({
    id: 'product-1',
    title: 'Riversong Motive 5T Smart Watch',
    price: { amount: 30600, currency: 'NGN' },
    availability: { available: true, status: 'in_stock' },
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/app/api/feed/openai/route.test.ts
```

Expected: FAIL because `format=current` is unsupported and URLs include `/ogabassey/`.

- [ ] **Step 3: Extend feed query schema**

Modify the feed query schema:

```typescript
format: z.enum(['jsonl', 'plain', 'current']).optional(),
```

- [ ] **Step 4: Implement current mapper**

Add a mapper near `generateOpenAIFeed`:

```typescript
function generateCurrentOpenAIProductFeed(
  products: Product[],
  merchant: Merchant,
  baseUrl: string
): string[] {
  const currency = merchant.payout_currency || 'NGN';

  return products
    .filter((product) => product.name && product.name.trim().length > 0)
    .map((product) => {
      const url = buildAgentProductUrl({ baseUrl, product });
      const availability = getStorefrontAgentAvailability({
        manage_stock: product.manage_stock,
        stock: product.stock,
        stock_quantity: product.stock_quantity,
      });
      const firstImage = product.images?.[0];
      const imageUrl =
        typeof firstImage === 'string' ? firstImage : firstImage?.url || '';

      return JSON.stringify({
        id: product.id,
        title: product.name,
        description: { plain: stripHtmlTags(product.description || '').trim() },
        url,
        media: imageUrl ? [{ type: 'image', url: imageUrl }] : [],
        variants: [
          {
            id: product.sku || product.id,
            title: product.name,
            url,
            price: { amount: product.price, currency },
            list_price:
              product.compare_at_price && product.compare_at_price > product.price
                ? { amount: product.compare_at_price, currency }
                : undefined,
            availability: {
              available: availability.is_purchasable,
              status: availability.availability,
              quantity: availability.quantity_available,
            },
            condition: [product.condition || 'new'],
            categories: [
              {
                value: product.category || product.google_product_category || 'Products',
                taxonomy: 'merchant',
              },
            ],
          },
        ],
      });
    });
}
```

Import `buildAgentProductUrl` and `getStorefrontAgentAvailability`.

- [ ] **Step 5: Use current mapper**

In the route:

```typescript
const feedLines =
  format === 'current'
    ? generateCurrentOpenAIProductFeed(products, merchant, baseUrl)
    : generateOpenAIFeed(products, merchant, baseUrl);
```

Also replace legacy `productUrlBase` with `buildAgentProductUrl` so existing output stops emitting `/ogabassey/` on custom domains.

- [ ] **Step 6: Run feed tests**

Run:

```bash
pnpm --filter web test src/app/api/feed/openai/route.test.ts
```

Expected: PASS, including existing unmanaged stock tests.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/app/api/feed/openai/route.ts apps/web/src/app/api/feed/openai/route.test.ts
```

---

### Task 9: Fix And Expose Google Merchant Feed For Agent Discovery

**Files:**
- Modify: `apps/web/src/app/api/feed/google-merchant/route.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/route.test.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-data.test.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-builder.ts`
- Modify: `apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts`
- Create: `apps/web/src/app/feeds/google-merchant.xml/route.ts`
- Create: `apps/web/src/app/feeds/google-merchant.xml/route.test.ts`
- Modify: `apps/web/src/lib/llms.ts`
- Modify: `apps/web/src/lib/llms.test.ts`
- Modify: `apps/web/src/app/agent-commerce.json/route.ts`
- Modify: `apps/web/src/app/agent-commerce.json/route.test.ts`
- Modify: `apps/web/src/app/robots.ts`
- Modify: `apps/web/src/app/robots.test.ts`

- [ ] **Step 1: Write failing production-regression tests**

Update `apps/web/src/app/api/feed/google-merchant/feed-query.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { FEED_PRODUCTS_SELECT } from './feed-query';

describe('FEED_PRODUCTS_SELECT', () => {
  it('does not select products.category_slug directly because production lacks that column', () => {
    expect(FEED_PRODUCTS_SELECT).not.toMatch(
      /(^|[,\\s])category_slug([,\\s]|$)/
    );
    expect(FEED_PRODUCTS_SELECT).toContain(
      'product_categories(categories(name, slug))'
    );
  });

  it('includes category and spec fields required for enriched feed descriptions', () => {
    expect(FEED_PRODUCTS_SELECT).toContain('category');
    expect(FEED_PRODUCTS_SELECT).toContain('color');
    expect(FEED_PRODUCTS_SELECT).toContain('product_key_specs(*)');
  });
});
```

Add to `apps/web/src/app/api/feed/google-merchant/route.test.ts`. This route test must respect the existing `generateGoogleMerchantFeed` mock in that file:

```typescript
it('returns generated Ogabassey Google Merchant XML instead of a generic 500', async () => {
  mockResolveFeedMerchant.mockResolvedValue({
    id: 'merchant-1',
    slug: 'ogabassey',
    business_name: 'Ogabassey',
    country: 'NG',
    payout_currency: 'NGN',
    gmc_variants_enabled: false,
  });
  mockGetCachedGoogleMerchantFeedData.mockResolvedValue({
    custom_domain: 'ogabassey.com',
    slug: 'ogabassey',
    imageManifest: {},
    products: [{ id: 'product-1', name: 'Watch', price: 30600 }],
  });
  mockGenerateGoogleMerchantFeed.mockReturnValue(
    '<?xml version="1.0" encoding="UTF-8"?><rss><channel><item><g:id>product-1</g:id></item></channel></rss>'
  );

  const response = await GET(
    new NextRequest(
      'https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey',
      { headers: { host: 'ogabassey.com' } }
    )
  );
  const xml = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('application/xml');
  expect(xml).toContain('<rss');
  expect(xml).toContain('<g:id>product-1</g:id>');
  expect(mockGenerateGoogleMerchantFeed).toHaveBeenCalledWith(
    [{ id: 'product-1', name: 'Watch', price: 30600 }],
    expect.objectContaining({
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    }),
    'https://ogabassey.com',
    {}
  );
});
```

Add to `apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts` for the unmocked XML builder:

```typescript
it('emits canonical custom-domain links and unmanaged stock availability', () => {
  const xml = generateGoogleMerchantFeed(
    [
      product({
        id: 'product-1',
        name: 'Riversong Motive 5T Smart Watch',
        slug: 'riversong-motive-5t-smart-watch',
        category: 'Smartwatches',
        categories: { name: 'Smartwatches', slug: 'smartwatches' },
        price: 30600,
        stock: 0,
        stock_quantity: 0,
        manage_stock: false,
      }),
    ],
    merchant({
      business_name: 'Ogabassey',
      slug: 'ogabassey',
      payout_currency: 'NGN',
    }),
    'https://ogabassey.com',
    {
      'product-1': [
        manifestEntry({
          verified_url: 'https://cdn.ogabassey.com/products/watch.jpg',
          is_primary: true,
        }),
      ],
    }
  );

  expect(xml).toContain(
    '<g:link>https://ogabassey.com/smartwatches/riversong-motive-5t-smart-watch</g:link>'
  );
  expect(xml).toContain('<g:availability>in_stock</g:availability>');
  expect(xml).toContain('<g:quantity>9999</g:quantity>');
});
```

- [ ] **Step 2: Run feed tests to reproduce**

Run:

```bash
pnpm --filter web test src/app/api/feed/google-merchant/feed-query.test.ts src/app/api/feed/google-merchant/route.test.ts src/app/api/feed/google-merchant/feed-data.test.ts src/app/api/feed/google-merchant/feed-builder.test.ts
```

Expected: FAIL because `FEED_PRODUCTS_SELECT` still selects `category_slug` directly.

- [ ] **Step 3: Fix the feed generation failure**

Production logs show:

```text
DB_PRODUCTS_ERROR: {
  code: '42703',
  message: 'column products.category_slug does not exist'
}
```

Modify `apps/web/src/app/api/feed/google-merchant/feed-query.ts` so `FEED_PRODUCTS_SELECT` removes the direct `category_slug` column and relies on `product_categories(categories(name, slug))`:

```typescript
export const FEED_PRODUCTS_SELECT = `id, name, description, slug, price, compare_at_price,
  brand, gtin, mpn, sku, stock, stock_quantity, manage_stock, condition,
  has_condition_offers, variant_model, available_conditions,
  google_product_category, category, color, product_key_specs(*),
  weight_value, weight_unit,
  product_categories(categories(name, slug)), updated_at`;
```

Keep `normalizeFeedProducts` in `feed-data.ts` deriving `category_slug` from the joined category:

```typescript
return {
  ...rest,
  categories: joinedCategory ?? null,
  category_slug: joinedCategory?.slug,
  category: rest.category || joinedCategory?.name,
};
```

Do not add a `products.category_slug` migration in this task. That would be a broader product-schema project and would need backfill and write-path synchronization.

- Do not return partial JSON errors for XML feed requests.
- Keep Google Merchant XML tags valid. Do not invent unsupported `g:*` tags.
- Treat `manage_stock=false` as `in_stock`.
- Fail soft on missing optional fields like secondary images, category names, variants, GTIN, and MPN.
- Keep product links canonical on `https://ogabassey.com` without `/ogabassey/`.
- Preserve `merchant_id` and `merchant_slug` validation.

- [ ] **Step 4: Add a public non-API feed alias**

Create `apps/web/src/app/feeds/google-merchant.xml/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { GET as getGoogleMerchantFeed } from '@/app/api/feed/google-merchant/route';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { resolveRouteIdentifier } from '@/lib/storefront-route-identifier';

export async function GET(request: Request) {
  const headers = new Headers(request.headers);
  const routeIdentifier = resolveRouteIdentifier(headers);
  const merchant = routeIdentifier
    ? await getMerchantByIdentifier(routeIdentifier)
    : null;

  if (!merchant?.slug) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const url = new URL(request.url);
  url.pathname = '/api/feed/google-merchant';
  url.search = '';
  url.searchParams.set('merchant_slug', merchant.slug);

  return getGoogleMerchantFeed(
    new NextRequest(url, {
      headers,
      method: 'GET',
    })
  );
}
```

If route reuse becomes awkward, extract the shared feed handler from `api/feed/google-merchant/route.ts` into a local helper and call it from both routes.

- [ ] **Step 5: Link feed aliases from agent discovery**

Update `apps/web/src/lib/llms.ts` storefront guidance to include:

```markdown
## Machine Feeds
- [OpenAI Product Feed]({baseUrl}/feeds/openai.jsonl): Public JSONL catalog feed for crawler-friendly product discovery
- [Current Agent Product Feed]({baseUrl}/feeds/agent-products.jsonl): Current JSONL product feed with structured variant availability
- [Google Merchant XML Feed]({baseUrl}/feeds/google-merchant.xml): Public XML product feed aligned with Merchant Center
```

These links must stay outside `/api/` so compliant crawler bots can fetch the machine-readable feeds while broad `/api/` crawling remains disallowed.

Update `apps/web/src/app/agent-commerce.json/route.ts` links:

```typescript
product_feed: `${baseUrl}/feeds/openai.jsonl`,
feeds: {
  agent_products: `${baseUrl}/feeds/agent-products.jsonl`,
  google_merchant_xml: `${baseUrl}/feeds/google-merchant.xml`,
}
```

- [ ] **Step 6: Keep robots safe**

Keep `/api/` disallowed for broad crawlers, but ensure `/feeds/google-merchant.xml`, `/feeds/openai.jsonl`, and `/feeds/agent-products.jsonl` are not blocked.

Explicitly allow current Claude crawler agents (`ClaudeBot`, `Claude-User`, and `Claude-SearchBot`) while preserving the default wildcard policy for future compliant agents.

Add a robots test asserting storefront robots output includes `Disallow: /api/` and does not include `Disallow: /feeds/`.

- [ ] **Step 7: Run feed exposure tests**

Run:

```bash
pnpm --filter web test src/app/api/feed/google-merchant/feed-query.test.ts src/app/api/feed/google-merchant/route.test.ts src/app/api/feed/google-merchant/feed-data.test.ts src/app/api/feed/google-merchant/feed-builder.test.ts src/app/feeds/google-merchant.xml/route.test.ts src/lib/llms.test.ts src/app/agent-commerce.json/route.test.ts src/app/robots.test.ts
```

Expected: PASS.

- [ ] **Step 8: Verify production after deploy**

Run:

```bash
curl -sS -L -D - 'https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey' -o /tmp/ogabassey-gmc-api.xml
curl -sS -L -D - 'https://ogabassey.com/feeds/google-merchant.xml' -o /tmp/ogabassey-gmc-public.xml
```

Expected:

- Both return HTTP 200.
- Both return `Content-Type: application/xml`.
- XML contains `<rss`, `<channel`, and at least one `<item>`.
- Product links use `https://ogabassey.com/{category}/{productSlug}`.
- Unmanaged stock products emit `<g:availability>in_stock</g:availability>`.

- [ ] **Step 9: Stage For Phase Review**

Run:

```bash
git add apps/web/src/app/api/feed/google-merchant/feed-query.ts apps/web/src/app/api/feed/google-merchant/feed-query.test.ts apps/web/src/app/api/feed/google-merchant/route.ts apps/web/src/app/api/feed/google-merchant/route.test.ts apps/web/src/app/api/feed/google-merchant/feed-data.ts apps/web/src/app/api/feed/google-merchant/feed-data.test.ts apps/web/src/app/api/feed/google-merchant/feed-builder.ts apps/web/src/app/api/feed/google-merchant/feed-builder.test.ts apps/web/src/app/feeds/google-merchant.xml/route.ts apps/web/src/app/feeds/google-merchant.xml/route.test.ts apps/web/src/lib/llms.ts apps/web/src/lib/llms.test.ts apps/web/src/app/agent-commerce.json/route.ts apps/web/src/app/agent-commerce.json/route.test.ts apps/web/src/app/robots.ts apps/web/src/app/robots.test.ts
```

---

### Task 10: Fix Agentic Checkout Stock Semantics

**Files:**
- Modify: `apps/web/src/lib/agentic/checkout.ts`
- Create: `apps/web/src/lib/agentic/checkout.test.ts`
- Test: `apps/web/src/lib/agentic/checkout.test.ts`

- [ ] **Step 1: Write failing checkout stock tests**

Create `apps/web/src/lib/agentic/checkout.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { calculateCheckoutSession } from './checkout';

function createQueryResult(data: unknown[]) {
  return {
    select: () => ({
      in: () => ({
        returns: () => Promise.resolve({ data }),
      }),
    }),
  };
}

function createSupabaseMock({
  products,
  variants,
}: {
  products: unknown[];
  variants: unknown[];
}) {
  return {
    from(table: string) {
      if (table === 'products') {
        return createQueryResult(products);
      }
      if (table === 'product_variants') {
        return createQueryResult(variants);
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe('calculateCheckoutSession', () => {
  it('does not mark unmanaged stock products out of stock', async () => {
    const supabase = createSupabaseMock({
      products: [
        {
          id: 'product-1',
          name: 'Riversong Motive 5T Smart Watch',
          price: 30600,
          stock: 0,
          stock_quantity: 0,
          manage_stock: false,
        },
      ],
      variants: [],
    });

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'product-1', quantity: 20 }],
      null,
      'NGN'
    );

    expect(result.messages).toEqual([]);
    expect(result.lineItems[0]?.total).toBe(612000);
  });

  it('still blocks managed zero-stock products', async () => {
    const supabase = createSupabaseMock({
      products: [
        {
          id: 'product-2',
          name: 'Tracked Phone',
          price: 1000,
          stock: 0,
          stock_quantity: 0,
          manage_stock: true,
        },
      ],
      variants: [],
    });

    const result = await calculateCheckoutSession(
      supabase as never,
      [{ id: 'product-2', quantity: 1 }],
      null,
      'NGN'
    );

    expect(result.messages).toEqual([
      expect.objectContaining({ code: 'out_of_stock' }),
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout.test.ts
```

Expected: FAIL because `calculateCheckoutSession` does not select `manage_stock` and treats unmanaged stock `0` as insufficient.

- [ ] **Step 3: Select `manage_stock` in checkout calculation**

Modify `apps/web/src/lib/agentic/checkout.ts`.

Update `AgenticProduct`:

```typescript
interface AgenticProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  stock_quantity?: number;
  manage_stock?: boolean | null;
  weight_value?: number;
  weight_unit?: string;
}
```

Update the product select:

```typescript
.select('id, name, price, stock, stock_quantity, manage_stock, weight_value, weight_unit')
```

- [ ] **Step 4: Apply unmanaged stock rule**

Replace the stock check in `calculateCheckoutSession`:

```typescript
    const hasUnlimitedStock = product?.manage_stock === false;

    if (!hasUnlimitedStock && stock < requestedItem.quantity) {
      messages.push({
        type: 'error',
        code: 'out_of_stock',
        path: `$.items[${items.indexOf(requestedItem)}]`,
        content_type: 'plain',
        content: `Only ${stock} items available for ${title}.`,
      });
    }
```

- [ ] **Step 5: Run checkout stock tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout.test.ts
```

Expected: PASS.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/checkout.ts apps/web/src/lib/agentic/checkout.test.ts
```

---

### Task 11: Align Agentic Checkout Storage With Existing Schema

**Files:**
- Create: `apps/web/src/lib/agentic/checkout-storage.ts`
- Create: `apps/web/src/lib/agentic/checkout-storage.test.ts`
- Create: `supabase/migrations/20260428170000_add_checkout_sessions_agentic_metadata.sql`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts`

- [ ] **Step 1: Write failing storage mapping tests**

Create `apps/web/src/lib/agentic/checkout-storage.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildCheckoutSessionInsert,
  buildCheckoutSessionUpdate,
  mapCheckoutSessionStatus,
} from './checkout-storage';

describe('agentic checkout storage', () => {
  it('builds insert payloads using existing checkout_sessions columns', () => {
    const payload = buildCheckoutSessionInsert({
      sessionId: 'agentic_session_1',
      merchantId: 'merchant-1',
      items: [{ id: 'product-1', quantity: 2 }],
      currency: 'NGN',
      fulfillmentAddress: { city: 'Lagos', country: 'NG' },
      fulfillmentOptionId: 'pickup_store_1',
      lineItems: [],
      fulfillmentOptions: [],
      totals: [
        { type: 'subtotal', display_text: 'Subtotal', amount: 2000 },
        { type: 'fulfillment', display_text: 'Delivery', amount: 500 },
        { type: 'total', display_text: 'Total', amount: 2500 },
      ],
      messages: [],
    });

    expect(payload).toMatchObject({
      session_id: 'agentic_session_1',
      merchant_id: 'merchant-1',
      cart_items: [{ id: 'product-1', quantity: 2 }],
      cart_total: 2500,
      subtotal: 2000,
      shipping_cost: 500,
      total_amount: 2500,
      currency: 'NGN',
      shipping_address: { city: 'Lagos', country: 'NG' },
      shipping_method: 'pickup_store_1',
      status: 'pending',
    });
    expect(payload).not.toHaveProperty('items');
    expect(payload).not.toHaveProperty('line_items');
    expect(payload).not.toHaveProperty('fulfillment_address');
    expect(payload.metadata).toMatchObject({
      agentic: {
        line_items: [],
        fulfillment_options: [],
        totals: expect.any(Array),
        messages: [],
      },
    });
  });

  it('maps internal checkout statuses to agent statuses', () => {
    expect(mapCheckoutSessionStatus({ status: 'pending' })).toBe(
      'not_ready_for_payment'
    );
    expect(
      mapCheckoutSessionStatus({
        status: 'processing',
        hasFulfillmentAddress: true,
        hasLineItems: true,
      })
    ).toBe('ready_for_payment');
    expect(mapCheckoutSessionStatus({ status: 'abandoned' })).toBe('canceled');
    expect(mapCheckoutSessionStatus({ status: 'completed' })).toBe('completed');
  });

  it('never writes agent-only statuses to checkout_sessions.status', () => {
    const payload = buildCheckoutSessionUpdate({
      items: [{ id: 'product-1', quantity: 1 }],
      currency: 'NGN',
      fulfillmentAddress: { city: 'Lagos', country: 'NG' },
      fulfillmentOptionId: 'pickup_store_1',
      lineItems: [],
      fulfillmentOptions: [],
      totals: [{ type: 'total', display_text: 'Total', amount: 1000 }],
      messages: [],
    });

    expect(['pending', 'processing']).toContain(payload.status);
    expect(payload.status).not.toBe('ready_for_payment');
    expect(payload.status).not.toBe('not_ready_for_payment');
    expect(payload.status).not.toBe('payment_pending');
    expect(payload.status).not.toBe('canceled');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-storage.test.ts
```

Expected: FAIL because `checkout-storage.ts` does not exist.

- [ ] **Step 3: Add append-only metadata migration**

Create `supabase/migrations/20260428170000_add_checkout_sessions_agentic_metadata.sql`:

```sql
ALTER TABLE public.checkout_sessions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.checkout_sessions.metadata IS
  'Agentic checkout metadata including calculated cart state, DVA details, request audit data, and idempotency records.';

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_metadata_agentic
  ON public.checkout_sessions USING gin ((metadata -> 'agentic'));
```

Do not edit the baseline migration. This migration only adds metadata to an existing table, so existing RLS policies still apply.

- [ ] **Step 4: Implement checkout storage mapper**

Create `apps/web/src/lib/agentic/checkout-storage.ts`:

```typescript
import type {
  GPTFulfillmentOption,
  GPTLineItem,
  GPTMessage,
  GPTTotal,
} from '@/lib/agentic/checkout';

const INTERNAL_READY_STATUS = 'processing';
const INTERNAL_NOT_READY_STATUS = 'pending';

export type StoredCheckoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'expired'
  | 'abandoned'
  | 'failed';

export function getTotalAmount(totals: GPTTotal[]): number {
  return totals.find((total) => total.type === 'total')?.amount ?? 0;
}

export function getSubtotalAmount(totals: GPTTotal[]): number {
  return totals.find((total) => total.type === 'subtotal')?.amount ?? 0;
}

export function getFulfillmentAmount(totals: GPTTotal[]): number {
  return totals.find((total) => total.type === 'fulfillment')?.amount ?? 0;
}

export function mapCheckoutSessionStatus({
  status,
  hasFulfillmentAddress = false,
  hasLineItems = false,
}: {
  status: StoredCheckoutStatus;
  hasFulfillmentAddress?: boolean;
  hasLineItems?: boolean;
}) {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'abandoned' || status === 'expired') {
    return 'canceled';
  }
  if (status === 'processing' && hasFulfillmentAddress && hasLineItems) {
    return 'ready_for_payment';
  }
  return 'not_ready_for_payment';
}

export function buildAgenticMetadata({
  lineItems,
  totals,
  fulfillmentOptions,
  messages,
  existingMetadata,
}: {
  lineItems: GPTLineItem[];
  totals: GPTTotal[];
  fulfillmentOptions: GPTFulfillmentOption[];
  messages: GPTMessage[];
  existingMetadata?: Record<string, unknown> | null;
}) {
  return {
    ...(existingMetadata ?? {}),
    agentic: {
      ...((existingMetadata?.agentic as Record<string, unknown> | undefined) ?? {}),
      line_items: lineItems,
      totals,
      fulfillment_options: fulfillmentOptions,
      messages,
    },
  };
}
```

Then add `buildCheckoutSessionInsert` and `buildCheckoutSessionUpdate` in the same file. They must write only existing `checkout_sessions` columns:

- `session_id`
- `merchant_id`
- `cart_items`
- `cart_total`
- `subtotal`
- `shipping_cost`
- `total_amount`
- `currency`
- `shipping_address`
- `shipping_method`
- `status`
- `metadata`

- [ ] **Step 5: Refactor checkout routes to use storage columns**

Replace route selects and writes that reference nonexistent columns:

- Replace `items` with `cart_items`.
- Replace `fulfillment_address` with `shipping_address`.
- Replace `fulfillment_option_id` with `shipping_method`.
- Store calculated `line_items`, `totals`, `fulfillment_options`, and `messages` under `metadata.agentic`.
- Generate and insert a required `session_id`, for example `agentic_${crypto.randomUUID()}`.
- Write only internal DB statuses accepted by the existing check constraint:
  - `pending` for not ready.
  - `processing` for ready for payment or DVA/payment-pending.
  - `abandoned` for canceled.
  - `completed` only after confirmed payment.

Response builders should continue returning agent-facing statuses like `not_ready_for_payment`, `ready_for_payment`, `completed`, and `canceled`.

- [ ] **Step 6: Run storage and route tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-storage.test.ts src/app/api/agentic/checkout_sessions/route.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS, with tests proving route mocks no longer expect nonexistent columns.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/checkout-storage.ts apps/web/src/lib/agentic/checkout-storage.test.ts supabase/migrations/20260428170000_add_checkout_sessions_agentic_metadata.sql apps/web/src/app/api/agentic/checkout_sessions/route.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts' apps/web/src/app/api/agentic/checkout_sessions/route.test.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 12: Add Merchant-Scoped Agentic Auth Context

**Files:**
- Create: `apps/web/src/lib/agentic/merchant-context.ts`
- Create: `apps/web/src/lib/agentic/merchant-context.test.ts`
- Modify: `apps/web/src/lib/agentic/auth.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Test: `apps/web/src/lib/agentic/merchant-context.test.ts`

- [ ] **Step 1: Write failing merchant context tests**

Create `apps/web/src/lib/agentic/merchant-context.test.ts`:

```typescript
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/constant-time-equal', () => ({
  constantTimeEqual: (a: string, b: string) => a === b,
}));

const originalEnv = process.env;

afterEach(() => {
  process.env = originalEnv;
  vi.resetModules();
});

function requestWithBearer(token: string) {
  return new NextRequest('https://ogabassey.com/api/agentic/checkout_sessions', {
    headers: { authorization: `Bearer ${token}` },
  });
}

async function importMerchantContext() {
  vi.resetModules();
  return import('./merchant-context');
}

describe('resolveAgenticMerchantContext', () => {
  it('maps per-merchant keys to merchant slugs', async () => {
    process.env = {
      ...originalEnv,
      OPENAI_AGENTIC_MERCHANT_KEYS: JSON.stringify({
        ogabassey: 'og-key',
        'demo-store': 'demo-key',
      }),
    };

    const { resolveAgenticMerchantContext } = await importMerchantContext();

    expect(resolveAgenticMerchantContext(requestWithBearer('og-key'))).toEqual({
      merchantSlug: 'ogabassey',
      keySource: 'merchant_keys',
    });
  });

  it('keeps the legacy single key as an Ogabassey-only fallback', async () => {
    process.env = {
      ...originalEnv,
      OPENAI_AGENTIC_MERCHANT_KEYS: undefined,
      OPENAI_AGENTIC_API_KEY: 'legacy-key',
    };

    const { resolveAgenticMerchantContext } = await importMerchantContext();

    expect(resolveAgenticMerchantContext(requestWithBearer('legacy-key'))).toEqual({
      merchantSlug: 'ogabassey',
      keySource: 'legacy_ogabassey',
    });
  });

  it('returns null when the bearer token is missing or unknown', async () => {
    process.env = {
      ...originalEnv,
      OPENAI_AGENTIC_MERCHANT_KEYS: JSON.stringify({ ogabassey: 'og-key' }),
      OPENAI_AGENTIC_API_KEY: undefined,
    };

    const { resolveAgenticMerchantContext } = await importMerchantContext();

    expect(resolveAgenticMerchantContext(requestWithBearer('wrong'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/merchant-context.test.ts
```

Expected: FAIL because `merchant-context.ts` does not exist.

- [ ] **Step 3: Implement merchant context resolver**

Create `apps/web/src/lib/agentic/merchant-context.ts`:

```typescript
import type { NextRequest } from 'next/server';
import { constantTimeEqual } from '@/lib/constant-time-equal';
import { logger } from '@/lib/logger';

export type AgenticMerchantContext = {
  merchantSlug: string;
  keySource: 'merchant_keys' | 'legacy_ogabassey';
};

function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim() || null;
}

// Expected schema: JSON object mapping merchant slug to bearer token.
// Rotation path: deploy both old and new tokens, update agent clients, then remove the old token.
function parseMerchantKeys(): Record<string, string> {
  const raw = process.env.OPENAI_AGENTIC_MERCHANT_KEYS;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return handleInvalidMerchantKeys('Expected object of merchant slug to token');
    }
    const entries = Object.entries(parsed);
    const validEntries = entries.filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === 'string' && typeof entry[1] === 'string'
    );

    if (entries.length === 0 || validEntries.length !== entries.length) {
      return handleInvalidMerchantKeys('Expected non-empty string token values');
    }

    return Object.fromEntries(validEntries);
  } catch (error) {
    return handleInvalidMerchantKeys(
      error instanceof Error ? error.message : String(error)
    );
  }
}

function handleInvalidMerchantKeys(reason: string): Record<string, string> {
  logger.warn({
    message: 'Invalid agentic merchant key configuration',
    env_var: 'OPENAI_AGENTIC_MERCHANT_KEYS',
    reason,
  });
  if (process.env.OPENAI_AGENTIC_STRICT_CONFIG === 'true') {
    throw new Error('Invalid OPENAI_AGENTIC_MERCHANT_KEYS configuration');
  }
  return {};
}

const CACHED_MERCHANT_KEYS = parseMerchantKeys();

export function resolveAgenticMerchantContext(
  request: NextRequest
): AgenticMerchantContext | null {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  for (const [merchantSlug, expectedToken] of Object.entries(CACHED_MERCHANT_KEYS)) {
    if (constantTimeEqual(token, expectedToken)) {
      return { merchantSlug, keySource: 'merchant_keys' };
    }
  }

  const legacyToken = process.env.OPENAI_AGENTIC_API_KEY;
  if (legacyToken && constantTimeEqual(token, legacyToken)) {
    logger.warn({
      message: 'Legacy Ogabassey agentic API key used',
      key_source: 'legacy_ogabassey',
      removal_phase: 'Remove after Phase 3 verification confirms zero legacy usage',
    });
    return { merchantSlug: 'ogabassey', keySource: 'legacy_ogabassey' };
  }

  return null;
}
```

Also add tests that malformed `OPENAI_AGENTIC_MERCHANT_KEYS` emits the structured warning without logging token values, and that `OPENAI_AGENTIC_STRICT_CONFIG=true` fails fast instead of silently disabling merchant-scoped auth. Cover parse errors, arrays, empty objects, and non-string values. Because merchant keys are cached at module initialization, tests that mutate environment variables must reset modules and import `merchant-context.ts` after setting env values.

Legacy fallback policy: `OPENAI_AGENTIC_API_KEY` remains an Ogabassey-only bridge until Phase 3 verification proves all agent clients use `OPENAI_AGENTIC_MERCHANT_KEYS`. Track legacy usage through the warning above and a metric/log query on `key_source: legacy_ogabassey`; remove the fallback only after agent owners confirm migration and seven consecutive production days show zero legacy-key resolutions.

- [ ] **Step 4: Wire create checkout route to merchant context**

Modify `apps/web/src/app/api/agentic/checkout_sessions/route.ts`:

```typescript
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
```

Replace the single-key check and hardcoded merchant lookup with:

```typescript
  const agenticContext = resolveAgenticMerchantContext(request);
  if (!agenticContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
```

Then lookup merchant by `agenticContext.merchantSlug`:

```typescript
    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, business_name, slug, custom_domain')
      .eq('slug', agenticContext.merchantSlug)
      .single();
```

- [ ] **Step 5: Run merchant context tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/merchant-context.test.ts src/app/api/agentic/checkout_sessions/route.test.ts
```

Expected: PASS after updating checkout route tests to mock `resolveAgenticMerchantContext`.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/merchant-context.ts apps/web/src/lib/agentic/merchant-context.test.ts apps/web/src/app/api/agentic/checkout_sessions/route.ts apps/web/src/app/api/agentic/checkout_sessions/route.test.ts
```

---

### Task 12A: Add Merchant-Scoped Agentic Supabase Access

**Files:**
- Create: `apps/web/src/lib/agentic/scoped-supabase.ts`
- Create: `apps/web/src/lib/agentic/scoped-supabase.test.ts`
- Create: `supabase/migrations/20260428170500_add_agentic_scoped_access_policies.sql`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts`

Purpose: agent-facing routes are user-facing operations. Do not keep using `createServiceClient()` or `createAdminClient()` for checkout/session/order reads and writes. Use a short-lived internal Supabase JWT with merchant-scoped claims, plus RLS policies that only permit agentic rows for the resolved merchant.

- [ ] **Step 1: Write failing scoped-client tests**

Create `apps/web/src/lib/agentic/scoped-supabase.test.ts`:

```typescript
import { Buffer } from 'node:buffer';
import { describe, expect, it, vi } from 'vitest';
import { createAgenticScopedSupabaseClient } from './scoped-supabase';

const mockCreateClient = vi.fn(() => ({ from: vi.fn() }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock('@/env', () => ({
  getSupabaseAnonKey: () => 'anon-key',
  getSupabaseUrl: () => 'https://example.supabase.co',
}));

function decodeJwtPayload(token: string) {
  const payload = token.split('.')[1];
  if (!payload) {
    throw new Error('Missing JWT payload');
  }
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    role: string;
    agentic_context: string;
    agentic_merchant_id: string;
    agentic_merchant_slug: string;
    exp: number;
  };
}

describe('createAgenticScopedSupabaseClient', () => {
  it('creates an anon-key client with merchant-scoped Authorization claims', () => {
    process.env.SUPABASE_JWT_SECRET = 'test-supabase-jwt-secret';

    createAgenticScopedSupabaseClient({
      merchantId: '00000000-0000-4000-8000-000000000001',
      merchantSlug: 'ogabassey',
      now: new Date('2026-04-28T12:00:00.000Z'),
    });

    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'anon-key',
      expect.objectContaining({
        global: {
          headers: {
            Authorization: expect.stringMatching(/^Bearer /),
          },
        },
      })
    );

    const authHeader = mockCreateClient.mock.calls[0]?.[2]?.global.headers
      .Authorization as string;
    const claims = decodeJwtPayload(authHeader.replace('Bearer ', ''));

    expect(claims).toMatchObject({
      role: 'authenticated',
      agentic_context: 'checkout',
      agentic_merchant_id: '00000000-0000-4000-8000-000000000001',
      agentic_merchant_slug: 'ogabassey',
    });
    expect(claims.exp).toBe(1_777_377_900);
  });

  it('fails closed when SUPABASE_JWT_SECRET is missing', () => {
    delete process.env.SUPABASE_JWT_SECRET;

    expect(() =>
      createAgenticScopedSupabaseClient({
        merchantId: '00000000-0000-4000-8000-000000000001',
        merchantSlug: 'ogabassey',
      })
    ).toThrow('SUPABASE_JWT_SECRET is required');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/scoped-supabase.test.ts
```

Expected: FAIL because `scoped-supabase.ts` does not exist.

- [ ] **Step 3: Add merchant-scoped RLS policies**

Create `supabase/migrations/20260428170500_add_agentic_scoped_access_policies.sql`:

```sql
CREATE OR REPLACE FUNCTION public.current_agentic_merchant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(auth.jwt() ->> 'agentic_merchant_id', '')::uuid
$$;

CREATE OR REPLACE FUNCTION public.is_agentic_checkout_context()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT (auth.jwt() ->> 'agentic_context') = 'checkout'
$$;

-- IMPORTANT: PostgreSQL combines PERMISSIVE policies with OR and AND-combines
-- RESTRICTIVE policies on top. The baseline migration (20260418000000_baseline.sql)
-- has DIFFERENT shapes per table, and we must compose accordingly:
--
--   checkout_sessions: baseline is permissively OPEN (`FOR SELECT USING (true)`,
--     an open INSERT WITH CHECK). A new permissive "merchant-scoped" policy here
--     would NOT enforce isolation (any agentic-authenticated request still passes
--     the open baseline via OR). We add a RESTRICTIVE policy that ANDs on top:
--     when in agentic context, the row's merchant_id must match the JWT claim;
--     non-agentic traffic passes the restrictive check trivially.
--
--   orders / order_items: baseline is permissively TIGHT (e.g. orders_select_policy
--     requires `customer_id = auth.uid() OR has_merchant_access(merchant_id)`).
--     Because the scoped JWT has no `sub`, `auth.uid()` is null AND
--     `has_merchant_access` won't match for an agentic request, so agentic traffic
--     fails every permissive baseline gate. We need an ADDITIONAL PERMISSIVE
--     policy that grants OR-access when in agentic context with a matching
--     merchant claim, and we also add a RESTRICTIVE policy so that agentic
--     requests cannot read/write rows belonging to other merchants even if a
--     future permissive policy is added.

-- 1) checkout_sessions:
--    a) Baseline only has permissive INSERT and SELECT policies (lines 13780/13784
--       of the baseline migration). UPDATE and DELETE have NO permissive grant
--       today, so once agentic routes switch off the service-role client, an
--       UPDATE / cancel / DELETE on a checkout_sessions row would be denied by
--       RLS. Add a permissive policy granting UPDATE/DELETE for the scoped JWT.
--    b) The baseline SELECT policy is overly open (`USING (true)`). Tighten it
--       with a RESTRICTIVE policy so an agentic SELECT can only read rows that
--       belong to the JWT's merchant.

CREATE POLICY "Agentic checkout sessions are writable by scoped client"
  ON public.checkout_sessions
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

CREATE POLICY "Agentic checkout sessions are deletable by scoped client"
  ON public.checkout_sessions
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );

CREATE POLICY "Agentic checkout sessions are merchant scoped (restrictive)"
  ON public.checkout_sessions
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    NOT public.is_agentic_checkout_context()
    OR merchant_id = public.current_agentic_merchant_id()
  );

-- 2) orders: grant agentic access (permissive OR-gate) AND tighten so an agentic
--    request can never read/write another merchant's order (restrictive AND-gate).

CREATE POLICY "Agentic orders are accessible to scoped client"
  ON public.orders
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
    AND source = 'agentic_ai'
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
    AND source = 'agentic_ai'
  );

CREATE POLICY "Agentic orders are merchant scoped (restrictive)"
  ON public.orders
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.is_agentic_checkout_context()
    OR (
      merchant_id = public.current_agentic_merchant_id()
      AND source = 'agentic_ai'
    )
  )
  WITH CHECK (
    NOT public.is_agentic_checkout_context()
    OR (
      merchant_id = public.current_agentic_merchant_id()
      AND source = 'agentic_ai'
    )
  );

-- 3) order_items: same pattern as orders — grant agentic access + restrict scope.

CREATE POLICY "Agentic order items are accessible to scoped client"
  ON public.order_items
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND order_id IN (
      SELECT id
      FROM public.orders
      WHERE merchant_id = public.current_agentic_merchant_id()
        AND source = 'agentic_ai'
    )
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND order_id IN (
      SELECT id
      FROM public.orders
      WHERE merchant_id = public.current_agentic_merchant_id()
        AND source = 'agentic_ai'
    )
  );

CREATE POLICY "Agentic order items follow merchant scoped orders (restrictive)"
  ON public.order_items
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (
    NOT public.is_agentic_checkout_context()
    OR order_id IN (
      SELECT id
      FROM public.orders
      WHERE merchant_id = public.current_agentic_merchant_id()
        AND source = 'agentic_ai'
    )
  )
  WITH CHECK (
    NOT public.is_agentic_checkout_context()
    OR order_id IN (
      SELECT id
      FROM public.orders
      WHERE merchant_id = public.current_agentic_merchant_id()
        AND source = 'agentic_ai'
    )
  );
```

If an affected table already has a policy with the same name in the target database, use `DROP POLICY IF EXISTS ... ON public.<table>;` immediately before `CREATE POLICY`. Do not edit baseline migrations.

- [ ] **Step 4: Implement scoped client helper**

Create `apps/web/src/lib/agentic/scoped-supabase.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

const TOKEN_TTL_SECONDS = 5 * 60;

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64Url(JSON.stringify(payload));
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function createAgenticScopedSupabaseClient({
  merchantId,
  merchantSlug,
  now = new Date(),
}: {
  merchantId: string;
  merchantSlug: string;
  now?: Date;
}) {
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('SUPABASE_JWT_SECRET is required for agentic scoped access');
  }

  const issuedAt = Math.floor(now.getTime() / 1000);
  const token = signJwt(
    {
      aud: 'authenticated',
      role: 'authenticated',
      iat: issuedAt,
      exp: issuedAt + TOKEN_TTL_SECONDS,
      agentic_context: 'checkout',
      agentic_merchant_id: merchantId,
      agentic_merchant_slug: merchantSlug,
    },
    jwtSecret
  );

  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
```

- [ ] **Step 5: Replace service clients in agentic checkout routes**

In all agentic checkout routes, resolve the merchant context and merchant row first, then create the scoped client:

```typescript
const agenticContext = resolveAgenticMerchantContext(request);
if (!agenticContext) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const bootstrap = createClient(await cookies());
const { data: merchant, error: merchantError } = await bootstrap
  .from('merchants')
  .select('id, slug, business_name, custom_domain')
  .eq('slug', agenticContext.merchantSlug)
  .single();

if (merchantError || !merchant) {
  return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
}

const supabase = createAgenticScopedSupabaseClient({
  merchantId: merchant.id,
  merchantSlug: merchant.slug,
});
```

The bootstrap read is public merchant metadata only. All checkout-session, order, order-item, idempotency, and request-record reads/writes must use the scoped client or a dedicated merchant-scoped RPC with equivalent RLS checks. Do not call another API route handler directly for order creation; extract order creation into a shared server utility that accepts the scoped client.

- [ ] **Step 6: Run scoped access tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/scoped-supabase.test.ts src/lib/agentic/merchant-context.test.ts src/app/api/agentic/checkout_sessions/route.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS after route tests assert `createServiceClient` and `createAdminClient` are not imported by agentic checkout routes.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/scoped-supabase.ts apps/web/src/lib/agentic/scoped-supabase.test.ts supabase/migrations/20260428170500_add_agentic_scoped_access_policies.sql apps/web/src/app/api/agentic/checkout_sessions/route.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts' apps/web/src/app/api/agentic/checkout_sessions/route.test.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 13: Add Agentic Request Integrity Checks

**Files:**
- Create: `apps/web/src/lib/agentic/request-integrity.ts`
- Create: `apps/web/src/lib/agentic/request-integrity.test.ts`
- Create: `apps/web/src/lib/agentic/request-replay.ts`
- Create: `apps/web/src/lib/agentic/request-replay.test.ts`
- Create: `supabase/migrations/20260428171000_add_agentic_request_records.sql`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts`

- [ ] **Step 1: Write failing request integrity tests**

Create `apps/web/src/lib/agentic/request-integrity.test.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  AGENTIC_API_VERSION,
  verifyAgenticRequestIntegrity,
} from './request-integrity';

const secret = 'merchant-secret';
const now = new Date('2026-04-28T12:00:00.000Z');

function sign(body: string, timestamp: string) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

function signedHeaders({
  body,
  timestamp = '2026-04-28T12:00:00.000Z',
  requestId = 'req_123',
  apiVersion = AGENTIC_API_VERSION,
  signature = sign(body, timestamp),
}: {
  body: string;
  timestamp?: string;
  requestId?: string;
  apiVersion?: string;
  signature?: string;
}) {
  return new Headers({
    signature,
    timestamp,
    'request-id': requestId,
    'api-version': apiVersion,
  });
}

describe('verifyAgenticRequestIntegrity', () => {
  it('accepts a valid signature, timestamp, request id, and api version', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body }),
        secrets: [secret],
        now,
      })
    ).toEqual({
      ok: true,
      requestId: 'req_123',
      apiVersion: AGENTIC_API_VERSION,
    });
  });

  it('rejects stale timestamps', () => {
    const body = '{"items":[]}';
    const timestamp = '2026-04-28T11:50:00.000Z';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, timestamp }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Stale timestamp' });
  });

  it('rejects missing request ids', () => {
    const body = '{"items":[]}';
    const headers = signedHeaders({ body });
    headers.delete('request-id');

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers,
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Missing request id' });
  });

  it('rejects overlong request ids', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, requestId: 'r'.repeat(256) }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Request ID too long' });
  });

  it('rejects malformed request ids', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, requestId: 'req 123' }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Invalid request ID format' });
  });

  it('rejects unsupported api versions', () => {
    const body = '{"items":[]}';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body, apiVersion: '2025-01-01' }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Unsupported api version' });
  });

  it('rejects bad signatures', () => {
    expect(
      verifyAgenticRequestIntegrity({
        body: '{"items":[]}',
        headers: signedHeaders({ body: '{"items":[]}', signature: 'bad' }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Invalid signature' });
  });

  it('accepts an empty body when the signature matches', () => {
    const body = '';

    expect(
      verifyAgenticRequestIntegrity({
        body,
        headers: signedHeaders({ body }),
        secrets: [secret],
        now,
      })
    ).toEqual({
      ok: true,
      requestId: 'req_123',
      apiVersion: AGENTIC_API_VERSION,
    });
  });

  it('rejects an empty body when the signature does not match', () => {
    expect(
      verifyAgenticRequestIntegrity({
        body: '',
        headers: signedHeaders({ body: '', signature: 'bad' }),
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, error: 'Invalid signature' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/request-integrity.test.ts
```

Expected: FAIL because `request-integrity.ts` does not exist.

- [ ] **Step 3: Implement request integrity helper**

Create `apps/web/src/lib/agentic/request-integrity.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { constantTimeEqual } from '@/lib/constant-time-equal';

export const AGENTIC_API_VERSION = '2026-04-28';
export const PREVIOUS_COMPATIBLE_AGENTIC_API_VERSION = '2026-01-01';
export const SUPPORTED_AGENTIC_API_VERSIONS = [
  AGENTIC_API_VERSION,
  PREVIOUS_COMPATIBLE_AGENTIC_API_VERSION,
] as const;
export type AgenticApiVersion =
  (typeof SUPPORTED_AGENTIC_API_VERSIONS)[number];
const MAX_SKEW_MS = 2 * 60 * 1000;
const MAX_REQUEST_ID_LENGTH = 255;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

// API version policy:
// - Serve the current version and one previous compatible version during a 90-day migration window.
// - Announce deprecations in agent-commerce.json and llms.txt at least 30 days before removal.
// - Route handlers must branch explicitly for versioned behavior instead of silently changing semantics.
// - Unsupported versions fail closed with 401 and a machine-readable error code.
// - Log and count each raw api-version header with merchant context and request_id:
//   metric `agentic_api_version_usage_total{api_version, merchant_id, supported}`
//   and structured log `{ event: 'agentic_api_version_seen', api_version,
//   merchant_id, request_id, supported, timestamp }`.
// - Before removing a version, publish notices through docs, agent-commerce.json,
//   llms.txt, merchant email/webhook/console channels owned by the platform
//   integrations owner, weekly during the 30-day notice window.
// - Before removal, query the metrics backend for zero
//   `agentic_api_version_usage_total` events for the deprecated version over
//   14 consecutive production days and store the query/audit record in the
//   phase verification notes.

export type RequestIntegrityResult =
  | { ok: true; requestId: string; apiVersion: AgenticApiVersion }
  | { ok: false; error: string };

export function verifyAgenticRequestIntegrity({
  body,
  headers,
  secrets,
  now = new Date(),
}: {
  body: string;
  headers: Headers;
  secrets: string[];
  now?: Date;
}): RequestIntegrityResult {
  const signature = headers.get('signature');
  const timestamp = headers.get('timestamp');
  const requestId = headers.get('request-id');
  const apiVersion = headers.get('api-version');

  if (secrets.length === 0) {
    return { ok: false, error: 'Missing signing secret' };
  }
  if (!requestId) {
    return { ok: false, error: 'Missing request id' };
  }
  if (requestId.length > MAX_REQUEST_ID_LENGTH) {
    return { ok: false, error: 'Request ID too long' };
  }
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    return { ok: false, error: 'Invalid request ID format' };
  }
  if (!apiVersion) {
    return { ok: false, error: 'Missing api version' };
  }
  if (!SUPPORTED_AGENTIC_API_VERSIONS.includes(apiVersion as AgenticApiVersion)) {
    return { ok: false, error: 'Unsupported api version' };
  }
  if (!signature) {
    return { ok: false, error: 'Missing signature' };
  }
  if (!timestamp) {
    return { ok: false, error: 'Missing timestamp' };
  }

  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(timestampMs)) {
    return { ok: false, error: 'Invalid timestamp' };
  }

  if (Math.abs(now.getTime() - timestampMs) > MAX_SKEW_MS) {
    return { ok: false, error: 'Stale timestamp' };
  }

  const isValidSignature = secrets.some((secret) => {
    const expectedSignature = createHmac('sha256', secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');
    return constantTimeEqual(signature, expectedSignature);
  });

  if (!isValidSignature) {
    return { ok: false, error: 'Invalid signature' };
  }

  return { ok: true, requestId, apiVersion: apiVersion as AgenticApiVersion };
}
```

- [ ] **Step 4: Wire integrity into mutating checkout routes**

For `POST /api/agentic/checkout_sessions`, `POST /api/agentic/checkout_sessions/[id]`, `POST /complete`, and `POST /cancel`:

Signing key rotation policy:

- Support `OPENAI_AGENTIC_SIGNING_KEY` as the active key and `OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS` during a 7-day migration window.
- Verification should try both keys and accept a signature if either matches, without revealing which key failed.
- To rotate: set `OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS` to the old key, set `OPENAI_AGENTIC_SIGNING_KEY` to the new key, notify clients, monitor auth success/failure and previous-key usage, then remove `OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS` after seven days of zero previous-key usage.
- Rollback: restore the old key as active and remove the previous-key env until clients are stable.

```typescript
const rawBody = await request.text();
const integrity = verifyAgenticRequestIntegrity({
  body: rawBody,
  headers: request.headers,
  secrets: [
    process.env.OPENAI_AGENTIC_SIGNING_KEY,
    process.env.OPENAI_AGENTIC_SIGNING_KEY_PREVIOUS,
  ].filter((value): value is string => Boolean(value)),
});

if (!integrity.ok) {
  return NextResponse.json(
    { error: integrity.error },
    { status: integrity.error.startsWith('Missing') ? 400 : 401 }
  );
}

const body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
```

Keep existing JSON parse error handling by wrapping `JSON.parse(rawBody)` in `try/catch`. Return `integrity.requestId` in successful JSON payloads as `request_id` and mirror it in a `request-id` response header so agents can correlate retries.

Before mutating state, reserve `integrity.requestId` with request-id replay protection. Add `apps/web/src/lib/agentic/request-replay.ts` with `reserveAgenticRequestId`, which deletes expired records opportunistically, inserts the current request id, returns a replay error on unique-constraint conflicts, and uses a 24-hour TTL. Mutating routes must reject replayed signed requests even if they are still inside the timestamp skew window.

Create append-only migration `supabase/migrations/20260428171000_add_agentic_request_records.sql` with this shape:

```sql
CREATE TABLE IF NOT EXISTS public.agentic_request_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  request_id text NOT NULL,
  api_version text NOT NULL,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS agentic_request_records_merchant_request_id_idx
  ON public.agentic_request_records (merchant_id, request_id);

CREATE INDEX IF NOT EXISTS agentic_request_records_expires_at_idx
  ON public.agentic_request_records (expires_at);

ALTER TABLE public.agentic_request_records ENABLE ROW LEVEL SECURITY;

-- The scoped JWT issued by `createAgenticScopedSupabaseClient()` does NOT set `sub`,
-- so `auth.uid()` is null for agentic requests. Match on the `agentic_merchant_id`
-- claim instead. Service-role clients bypass RLS and remain acceptable for payment
-- webhooks / background cleanup jobs, but not for agent-facing checkout handlers.
CREATE POLICY "Agentic clients manage own request records"
  ON public.agentic_request_records
  FOR ALL
  TO authenticated
  USING (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  )
  WITH CHECK (
    public.is_agentic_checkout_context()
    AND merchant_id = public.current_agentic_merchant_id()
  );
```

RLS compatibility note: agentic checkout routes resolve bearer tokens to a merchant context, then use `createAgenticScopedSupabaseClient()` from Task 12A for request-record writes. The policies must read `auth.jwt() ->> 'agentic_merchant_id'` (via the `current_agentic_merchant_id()` helper from Task 12A); do not assume bearer-token authentication automatically sets `auth.uid()`. Service-role clients remain acceptable for payment webhooks and background cleanup jobs, but not for agent-facing checkout/session/order API handlers.

Retention: keep the opportunistic expired-row deletion in `reserveAgenticRequestId`, and add a scheduled cleanup path. Prefer `pg_cron` where available:

```sql
SELECT cron.schedule(
  'cleanup-agentic-request-records',
  '*/15 * * * *',
  $$DELETE FROM public.agentic_request_records WHERE expires_at < now() - interval '1 hour'$$
);
```

If `pg_cron` is not available in the target Supabase project, add a protected cleanup endpoint invoked by Vercel Cron with the same parameterized delete. Monitor table growth and cleanup-job failures; the `expires_at` index must be used by the cleanup query.

- [ ] **Step 5: Run integrity tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/request-integrity.test.ts src/lib/agentic/request-replay.test.ts src/app/api/agentic/checkout_sessions/route.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS after route tests add valid signature, timestamp, request-id, and api-version headers.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/request-integrity.ts apps/web/src/lib/agentic/request-integrity.test.ts apps/web/src/lib/agentic/request-replay.ts apps/web/src/lib/agentic/request-replay.test.ts supabase/migrations/20260428171000_add_agentic_request_records.sql apps/web/src/app/api/agentic/checkout_sessions/route.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts' apps/web/src/app/api/agentic/checkout_sessions/route.test.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 14: Add Shared Agentic Checkout Idempotency

**Files:**
- Create: `apps/web/src/lib/agentic/idempotency.ts`
- Create: `apps/web/src/lib/agentic/idempotency.test.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`

- [ ] **Step 1: Write failing idempotency tests**

Create `apps/web/src/lib/agentic/idempotency.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  createIdempotencyRecord,
  findIdempotencyReplay,
} from './idempotency';

describe('agentic idempotency', () => {
  it('replays the stored response when key and request hash match', () => {
    const record = createIdempotencyRecord({
      key: 'idem-1',
      body: '{"items":[]}',
      response: { id: 'session-1' },
    });

    expect(
      findIdempotencyReplay({
        records: [record],
        key: 'idem-1',
        body: '{"items":[]}',
      })
    ).toEqual({ type: 'replay', response: { id: 'session-1' } });
  });

  it('returns conflict when the key is reused with a different body', () => {
    const record = createIdempotencyRecord({
      key: 'idem-1',
      body: '{"items":[]}',
      response: { id: 'session-1' },
    });

    expect(
      findIdempotencyReplay({
        records: [record],
        key: 'idem-1',
        body: '{"items":[{"id":"changed"}]}',
      })
    ).toEqual({ type: 'conflict' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/idempotency.test.ts
```

Expected: FAIL because `idempotency.ts` does not exist.

- [ ] **Step 3: Implement idempotency helper**

Create `apps/web/src/lib/agentic/idempotency.ts`:

```typescript
import { createHash } from 'node:crypto';

export type AgenticIdempotencyRecord = {
  key: string;
  request_hash: string;
  response: unknown;
  created_at: string;
};

export const AGENTIC_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
// Normal pruning keeps the live metadata store at or below this count.
// Derived from 24h replay coverage for normal agent retry traffic:
// 10 checkout mutations * up to 10 retries/idempotent replays per session.
// Concurrent writers may temporarily exceed it until the next pruning pass wins.
export const MAX_STORED_IDEMPOTENCY_RECORDS = 100;
// Warning threshold for suspicious retry volume before the hard cap.
export const WARN_IDEMPOTENCY_RECORD_THRESHOLD = 500;
// Safety-net cap checked before mutation. Hitting this should be treated as
// abuse, extreme concurrency (>100 concurrent retrying sessions for one
// checkout), or a pruning bug rather than normal operation.
export const HARD_IDEMPOTENCY_RECORD_LIMIT = 1000;

export type IdempotencyReplay =
  | { type: 'none' }
  | { type: 'replay'; response: unknown }
  | { type: 'conflict' };

export function hashIdempotencyBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export function createIdempotencyRecord({
  key,
  body,
  response,
}: {
  key: string;
  body: string;
  response: unknown;
}): AgenticIdempotencyRecord {
  return {
    key,
    request_hash: hashIdempotencyBody(body),
    response,
    created_at: new Date().toISOString(),
  };
}

export function findIdempotencyReplay({
  records,
  key,
  body,
}: {
  records: AgenticIdempotencyRecord[];
  key: string | null;
  body: string;
}): IdempotencyReplay {
  if (!key) {
    return { type: 'none' };
  }

  const existing = records.find((record) => record.key === key);
  if (!existing) {
    return { type: 'none' };
  }

  return existing.request_hash === hashIdempotencyBody(body)
    ? { type: 'replay', response: existing.response }
    : { type: 'conflict' };
}

export function pruneIdempotencyRecords(
  records: AgenticIdempotencyRecord[],
  now = new Date()
): AgenticIdempotencyRecord[] {
  const freshRecords = records.filter((record) => {
    const createdAt = Date.parse(record.created_at);
    return (
      Number.isFinite(createdAt) &&
      now.getTime() - createdAt <= AGENTIC_IDEMPOTENCY_TTL_MS
    );
  });

  return freshRecords.slice(-MAX_STORED_IDEMPOTENCY_RECORDS);
}
```

- [ ] **Step 4: Wire idempotency into mutating checkout routes**

For create, update, and complete routes:

- Read `const idempotencyKey = request.headers.get('idempotency-key');`
- Return `400` when the key is missing.
- Load `metadata` from the current session where a session exists.
- Read records from `metadata.agentic.idempotency` with:

```typescript
const records =
  session.metadata &&
  typeof session.metadata === 'object' &&
  typeof (session.metadata as { agentic?: unknown }).agentic === 'object' &&
  Array.isArray(
    ((session.metadata as { agentic: { idempotency?: unknown } }).agentic)
      .idempotency
  )
    ? ((session.metadata as {
        agentic: { idempotency: AgenticIdempotencyRecord[] };
      }).agentic.idempotency)
    : [];
```

- Return `429` if the raw stored idempotency array exceeds `HARD_IDEMPOTENCY_RECORD_LIMIT`; this protects checkout metadata from unbounded growth.
- Prune old entries with `const prunedRecords = pruneIdempotencyRecords(records);`.
- Before mutation, call `findIdempotencyReplay` against `prunedRecords`, not the raw records, so expired idempotency records cannot replay or conflict after the TTL.
- After successful mutation, append `createIdempotencyRecord({ key, body: rawBody, response: responsePayload })` to the pruned `metadata.agentic.idempotency`.
- Return `409` for conflicts.

Concurrency requirement: apply the idempotency record and the checkout mutation atomically. Prefer a Supabase RPC/Postgres transaction that:

- Locks the target `checkout_sessions` row with `FOR UPDATE`.
- Reads and prunes `metadata.agentic.idempotency`.
- Checks replay/conflict and `HARD_IDEMPOTENCY_RECORD_LIMIT`.
- Performs the checkout mutation.
- Writes `metadata.agentic.idempotency = [...prunedRecords, newRecord]`.

If an RPC is not practical, use optimistic locking by updating `checkout_sessions` with a predicate that proves the metadata/version is unchanged since read. On update conflict, retry the entire read-prune-replay-mutate-write operation up to 3 attempts. Use per-attempt exponential backoff with jitter: base waits are `50ms`, `100ms`, and `200ms`; jitter is applied per retry as +/-25% of the base (`37.5-62.5ms`, `75-125ms`, `150-250ms`). Cap total retry waiting for the request at `450ms` plus the normal operation time; if that request-level budget is exceeded, stop retrying. If retries are exhausted, return `409 Conflict` for a confirmed idempotency clash or `503 Service Unavailable` for transient contention, with a `Retry-After` header. Add tests that simulate two concurrent writers and prove neither idempotency record is lost, retry/backoff is attempted, the total-time budget is respected, and terminal responses match the spec.

Operational behavior: `MAX_STORED_IDEMPOTENCY_RECORDS` is the steady-state target enforced by pruning; `WARN_IDEMPOTENCY_RECORD_THRESHOLD` emits a warning metric before the hard cap; `HARD_IDEMPOTENCY_RECORD_LIMIT` is a pre-mutation abuse guard. If WARN is crossed, alert and inspect retry volume. If HARD is reached, emit a warning/error metric, return `429`, inspect whether pruning is failing or retry traffic is abusive, and include this signal in the Phase 4 checkout failure-rate alerts.

If real traffic needs more than the bounded metadata array, add a follow-up migration to move idempotency records into a dedicated `agentic_idempotency_records` table keyed by merchant, session, and idempotency key.

- [ ] **Step 5: Run idempotency tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/idempotency.test.ts src/app/api/agentic/checkout_sessions/route.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS after route tests include replay and conflict cases.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/idempotency.ts apps/web/src/lib/agentic/idempotency.test.ts apps/web/src/app/api/agentic/checkout_sessions/route.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' apps/web/src/app/api/agentic/checkout_sessions/route.test.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 15: Standardize Agentic Checkout Response Shape

**Files:**
- Create: `apps/web/src/lib/agentic/checkout-response.ts`
- Create: `apps/web/src/lib/agentic/checkout-response.test.ts`
- Modify: `apps/web/src/schemas/agentic-checkout.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`

- [ ] **Step 1: Write failing response builder tests**

Create `apps/web/src/lib/agentic/checkout-response.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildAgenticCheckoutResponse } from './checkout-response';

describe('buildAgenticCheckoutResponse', () => {
  it('returns spec-shaped payment provider, fulfillment address, totals, and links', () => {
    expect(
      buildAgenticCheckoutResponse({
        id: 'session-1',
        status: 'ready_for_payment',
        currency: 'NGN',
        lineItems: [],
        totals: [{ type: 'total', display_text: 'Total', amount: 1000 }],
        fulfillmentOptions: [],
        fulfillmentAddress: { city: 'Lagos', country: 'NG' },
        fulfillmentOptionId: 'pickup_store_1',
        messages: [],
        baseUrl: 'https://ogabassey.com',
      })
    ).toEqual({
      id: 'session-1',
      payment_provider: {
        provider: 'paystack',
        supported_payment_methods: ['bank_transfer'],
      },
      status: 'ready_for_payment',
      currency: 'ngn',
      line_items: [],
      totals: [{ type: 'total', display_text: 'Total', amount: 1000 }],
      fulfillment_options: [],
      fulfillment_address: { city: 'Lagos', country: 'NG' },
      fulfillment_option_id: 'pickup_store_1',
      messages: [],
      links: [
        { type: 'terms_of_use', url: 'https://ogabassey.com/terms' },
        { type: 'privacy_policy', url: 'https://ogabassey.com/privacy' },
        { type: 'return_policy', url: 'https://ogabassey.com/returns' },
      ],
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-response.test.ts
```

Expected: FAIL because `checkout-response.ts` does not exist.

- [ ] **Step 3: Implement checkout response builder**

Create `apps/web/src/lib/agentic/checkout-response.ts`:

```typescript
import type {
  GPTFulfillmentOption,
  GPTLineItem,
  GPTMessage,
  GPTTotal,
} from '@/lib/agentic/checkout';
import { trimTrailingSlash } from '@/lib/storefront-agent-urls';

export type AgenticCheckoutStatus =
  | 'not_ready_for_payment'
  | 'ready_for_payment'
  | 'completed'
  | 'canceled';

export function buildAgenticCheckoutResponse({
  id,
  status,
  currency,
  lineItems,
  totals,
  fulfillmentOptions,
  fulfillmentAddress,
  fulfillmentOptionId,
  messages,
  baseUrl,
}: {
  id: string;
  status: AgenticCheckoutStatus;
  currency: string;
  lineItems: GPTLineItem[];
  totals: GPTTotal[];
  fulfillmentOptions: GPTFulfillmentOption[];
  fulfillmentAddress?: unknown;
  fulfillmentOptionId?: string | null;
  messages: GPTMessage[];
  baseUrl: string;
}) {
  const root = trimTrailingSlash(baseUrl);

  return {
    id,
    payment_provider: {
      provider: 'paystack',
      supported_payment_methods: ['bank_transfer'],
    },
    status,
    currency: currency.toLowerCase(),
    line_items: lineItems,
    totals,
    fulfillment_options: fulfillmentOptions,
    fulfillment_address: fulfillmentAddress ?? null,
    fulfillment_option_id: fulfillmentOptionId ?? null,
    messages,
    links: [
      { type: 'terms_of_use', url: `${root}/terms` },
      { type: 'privacy_policy', url: `${root}/privacy` },
      { type: 'return_policy', url: `${root}/returns` },
    ],
  };
}
```

- [ ] **Step 4: Accept `fulfillment_address` while preserving `shipping_address`**

Modify `apps/web/src/schemas/agentic-checkout.ts`:

```typescript
fulfillment_address: agenticFulfillmentAddressSchema.nullable().optional(),
shipping_address: agenticFulfillmentAddressSchema.nullable().optional(),
```

In create and update routes, derive:

```typescript
const fulfillmentAddress =
  parsed.data.fulfillment_address ?? parsed.data.shipping_address ?? null;
```

All responses should use `fulfillment_address`.

Backward-compatibility policy: accept `shipping_address` for 90 days after Phase 3 deployment. When create/update handlers derive `fulfillmentAddress` from `parsed.data.shipping_address`, emit a structured log/metric with `{ deprecated_field: 'shipping_address', merchant_id, timestamp }`, increment `shipping_address_deprecated_usage`, and send `Deprecation: field=shipping_address; sunset=2026-07-28` using a deploy-configurable sunset value. Agent owners are notified through this response header and merchant notification channels. Removal may happen after the 90-day window and only after seven consecutive production days with zero `shipping_address` usage; abort removal/rollback if the metric spikes during the verification window. Track the metric alongside the Phase 4 checkout endpoint alerts and keep references tied to `agenticFulfillmentAddressSchema`, `fulfillment_address`, `shipping_address`, and the create/update handlers that inspect `parsed.data`.

- [ ] **Step 5: Use response builder in create, get, and update routes**

Replace duplicated response payload construction in:

- `apps/web/src/app/api/agentic/checkout_sessions/route.ts`
- `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts`

with `buildAgenticCheckoutResponse`.

For the create route, derive the base URL from the merchant:

```typescript
const baseUrl = merchant.custom_domain
  ? `https://${merchant.custom_domain}`
  : `https://${merchant.slug}.usebaci.com`;
```

For GET and update by session id, select the merchant relation needed for URL derivation:

```typescript
.select(`
  id,
  merchant_id,
  cart_items,
  shipping_method,
  shipping_address,
  currency,
  status,
  metadata,
  merchants(slug, custom_domain)
`)
```

Then pass the derived `baseUrl` to `buildAgenticCheckoutResponse`. Ogabassey should resolve to `https://ogabassey.com`, and no response link should contain `/ogabassey/` on the custom domain.

- [ ] **Step 6: Run response tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-response.test.ts src/app/api/agentic/checkout_sessions/route.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/checkout-response.ts apps/web/src/lib/agentic/checkout-response.test.ts apps/web/src/schemas/agentic-checkout.ts apps/web/src/app/api/agentic/checkout_sessions/route.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.ts' apps/web/src/app/api/agentic/checkout_sessions/route.test.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 15A: Require Buyer Confirmation Or Mandate Before Completion

**Files:**
- Create: `apps/web/src/lib/agentic/checkout-authorization.ts`
- Create: `apps/web/src/lib/agentic/checkout-authorization.test.ts`
- Modify: `apps/web/src/schemas/agentic-checkout.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts`

- [ ] **Step 1: Write failing authorization tests**

Create `apps/web/src/lib/agentic/checkout-authorization.test.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyCheckoutCompletionAuthorization } from './checkout-authorization';

const secret = 'confirmation-secret';
const now = new Date('2026-04-28T12:00:00.000Z');

function sign(payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifyCheckoutCompletionAuthorization', () => {
  it('accepts an exact human confirmation artifact', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';
    const payload = 'human_confirmation.session-1.2500.NGN.2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'human_confirmation',
          session_id: 'session-1',
          amount: 2500,
          currency: 'NGN',
          confirmed_at: confirmedAt,
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: true, mode: 'human_confirmation' });
  });

  it('rejects confirmation artifacts for a different amount', () => {
    const confirmedAt = '2026-04-28T11:59:30.000Z';
    const payload = 'human_confirmation.session-1.3000.NGN.2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'human_confirmation',
          session_id: 'session-1',
          amount: 3000,
          currency: 'NGN',
          confirmed_at: confirmedAt,
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, code: 'CONFIRMATION_MISMATCH' });
  });

  it('accepts a mandate only when amount and currency are inside limits', () => {
    const payload = 'payment_mandate.mandate-1.session-1.5000.NGN.2026-04-28T13:00:00.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'payment_mandate',
          mandate_id: 'mandate-1',
          session_id: 'session-1',
          max_amount: 5000,
          currency: 'NGN',
          expires_at: '2026-04-28T13:00:00.000Z',
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: true, mode: 'payment_mandate' });
  });

  it('rejects future-dated human confirmation artifacts', () => {
    // confirmed_at is 2 minutes after `now` — must NOT slip through the max-age check.
    const confirmedAt = '2026-04-28T12:02:00.000Z';
    const payload = 'human_confirmation.session-1.2500.NGN.2026-04-28T12:02:00.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'human_confirmation',
          session_id: 'session-1',
          amount: 2500,
          currency: 'NGN',
          confirmed_at: confirmedAt,
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_EXPIRED' });
  });

  it('returns SERVER_CONFIGURATION_ERROR when no signing secrets are configured', () => {
    // Missing OPENAI_AGENTIC_CONFIRMATION_KEY* is an operator misconfiguration, not
    // missing buyer consent — must NOT be reported as retryable CONFIRMATION_REQUIRED.
    const confirmedAt = '2026-04-28T11:59:30.000Z';
    const payload = 'human_confirmation.session-1.2500.NGN.2026-04-28T11:59:30.000Z';

    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'human_confirmation',
          session_id: 'session-1',
          amount: 2500,
          currency: 'NGN',
          confirmed_at: confirmedAt,
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [],
        now,
      })
    ).toEqual({ ok: false, code: 'SERVER_CONFIGURATION_ERROR' });
  });

  it('fails closed when authorization is missing or expired', () => {
    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: null,
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, code: 'CONFIRMATION_REQUIRED' });

    const payload = 'payment_mandate.mandate-1.session-1.5000.NGN.2026-04-28T11:00:00.000Z';
    expect(
      verifyCheckoutCompletionAuthorization({
        authorization: {
          type: 'payment_mandate',
          mandate_id: 'mandate-1',
          session_id: 'session-1',
          max_amount: 5000,
          currency: 'NGN',
          expires_at: '2026-04-28T11:00:00.000Z',
          signature: sign(payload),
        },
        sessionId: 'session-1',
        amount: 2500,
        currency: 'NGN',
        secrets: [secret],
        now,
      })
    ).toEqual({ ok: false, code: 'AUTHORIZATION_EXPIRED' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-authorization.test.ts
```

Expected: FAIL because `checkout-authorization.ts` does not exist.

- [ ] **Step 3: Implement authorization verifier**

Create `apps/web/src/lib/agentic/checkout-authorization.ts`:

```typescript
import { createHmac } from 'node:crypto';
import { constantTimeEqual } from '@/lib/constant-time-equal';

const HUMAN_CONFIRMATION_MAX_AGE_MS = 5 * 60 * 1000;

type HumanConfirmation = {
  type: 'human_confirmation';
  session_id: string;
  amount: number;
  currency: string;
  confirmed_at: string;
  signature: string;
};

type PaymentMandate = {
  type: 'payment_mandate';
  mandate_id: string;
  session_id?: string;
  max_amount: number;
  currency: string;
  expires_at: string;
  signature: string;
};

export type CheckoutCompletionAuthorization =
  | HumanConfirmation
  | PaymentMandate;

export type CheckoutAuthorizationResult =
  | { ok: true; mode: CheckoutCompletionAuthorization['type'] }
  | {
      ok: false;
      code:
        | 'CONFIRMATION_REQUIRED'
        | 'CONFIRMATION_MISMATCH'
        | 'AUTHORIZATION_EXPIRED'
        | 'AUTHORIZATION_INVALID'
        | 'SERVER_CONFIGURATION_ERROR';
    };

function signedHumanPayload(value: HumanConfirmation) {
  return [
    value.type,
    value.session_id,
    value.amount,
    value.currency.toUpperCase(),
    value.confirmed_at,
  ].join('.');
}

function signedMandatePayload(value: PaymentMandate) {
  return [
    value.type,
    value.mandate_id,
    value.session_id ?? '*',
    value.max_amount,
    value.currency.toUpperCase(),
    value.expires_at,
  ].join('.');
}

function hasValidSignature(payload: string, signature: string, secrets: string[]) {
  return secrets.some((secret) =>
    constantTimeEqual(
      signature,
      createHmac('sha256', secret).update(payload).digest('hex')
    )
  );
}

export function verifyCheckoutCompletionAuthorization({
  authorization,
  sessionId,
  amount,
  currency,
  secrets,
  now = new Date(),
}: {
  authorization: CheckoutCompletionAuthorization | null | undefined;
  sessionId: string;
  amount: number;
  currency: string;
  secrets: string[];
  now?: Date;
}): CheckoutAuthorizationResult {
  // Distinguish missing buyer consent (retryable, surface to caller) from missing
  // server signing keys (non-retryable, server misconfiguration that callers cannot fix).
  if (secrets.length === 0) {
    return { ok: false, code: 'SERVER_CONFIGURATION_ERROR' };
  }
  if (!authorization) {
    return { ok: false, code: 'CONFIRMATION_REQUIRED' };
  }

  const normalizedCurrency = currency.toUpperCase();

  if (authorization.type === 'human_confirmation') {
    const confirmedAt = Date.parse(authorization.confirmed_at);
    if (!Number.isFinite(confirmedAt)) {
      return { ok: false, code: 'AUTHORIZATION_INVALID' };
    }
    const ageMs = now.getTime() - confirmedAt;
    // Reject future-dated artifacts (clock skew or bad signer) and stale ones.
    if (ageMs < 0 || ageMs > HUMAN_CONFIRMATION_MAX_AGE_MS) {
      return { ok: false, code: 'AUTHORIZATION_EXPIRED' };
    }
    if (
      authorization.session_id !== sessionId ||
      authorization.amount !== amount ||
      authorization.currency.toUpperCase() !== normalizedCurrency
    ) {
      return { ok: false, code: 'CONFIRMATION_MISMATCH' };
    }
    return hasValidSignature(
      signedHumanPayload(authorization),
      authorization.signature,
      secrets
    )
      ? { ok: true, mode: 'human_confirmation' }
      : { ok: false, code: 'AUTHORIZATION_INVALID' };
  }

  const expiresAt = Date.parse(authorization.expires_at);
  if (!Number.isFinite(expiresAt)) {
    return { ok: false, code: 'AUTHORIZATION_INVALID' };
  }
  if (expiresAt <= now.getTime()) {
    return { ok: false, code: 'AUTHORIZATION_EXPIRED' };
  }
  if (
    (authorization.session_id && authorization.session_id !== sessionId) ||
    authorization.max_amount < amount ||
    authorization.currency.toUpperCase() !== normalizedCurrency
  ) {
    return { ok: false, code: 'CONFIRMATION_MISMATCH' };
  }

  return hasValidSignature(
    signedMandatePayload(authorization),
    authorization.signature,
    secrets
  )
    ? { ok: true, mode: 'payment_mandate' }
    : { ok: false, code: 'AUTHORIZATION_INVALID' };
}
```

- [ ] **Step 4: Add schema fields for completion authorization**

Modify `apps/web/src/schemas/agentic-checkout.ts` so `agenticCheckoutCompleteSchema` requires either confirmation or mandate data in addition to buyer/payment handoff details:

```typescript
const humanConfirmationSchema = z.object({
  type: z.literal('human_confirmation'),
  session_id: z.string().min(1),
  amount: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  confirmed_at: z.string().datetime(),
  signature: z.string().min(32),
});

const paymentMandateSchema = z.object({
  type: z.literal('payment_mandate'),
  mandate_id: z.string().min(1),
  session_id: z.string().min(1).optional(),
  max_amount: z.number().int().nonnegative(),
  currency: z.string().min(3).max(3),
  expires_at: z.string().datetime(),
  signature: z.string().min(32),
});

export const agenticCheckoutCompleteSchema = z.object({
  buyer: z.object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    email: z.string().email(),
    phone_number: z.string().min(7),
  }),
  payment_data: z.object({
    provider: z.literal('paystack'),
    token: z.string().min(1),
    billing_address: agenticFulfillmentAddressSchema.optional(),
  }),
  completion_authorization: z.union([
    humanConfirmationSchema,
    paymentMandateSchema,
  ]),
});
```

- [ ] **Step 5: Wire authorization into complete route before payment side effects**

In `complete/route.ts`, recalculate final totals first, then call `verifyCheckoutCompletionAuthorization` before creating an order, reserving/generating a DVA, sending payment instructions, or changing session/order status:

```typescript
const finalTotal =
  sessionCalc.totals.find((total) => total.type === 'total')?.amount ?? 0;

const authorization = verifyCheckoutCompletionAuthorization({
  authorization: parsed.data.completion_authorization,
  sessionId: session.id,
  amount: finalTotal,
  currency: session.currency,
  secrets: [
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY,
    process.env.OPENAI_AGENTIC_CONFIRMATION_KEY_PREVIOUS,
  ].filter((value): value is string => Boolean(value)),
});

if (!authorization.ok) {
  const code = authorization.code;
  // Map result codes to user-facing message + HTTP status + retryable hint.
  // SERVER_CONFIGURATION_ERROR is non-retryable and signals an operator-fix issue
  // (e.g. unset OPENAI_AGENTIC_CONFIRMATION_KEY*); do not encourage client retries
  // because retrying will not change the outcome until the server is reconfigured.
  const errorPayload: Record<
    Exclude<typeof code, never>,
    { error: string; status: number; retryable: boolean }
  > = {
    CONFIRMATION_REQUIRED: {
      error: 'Human confirmation required',
      status: 428,
      retryable: true,
    },
    CONFIRMATION_MISMATCH: {
      error: 'Checkout authorization invalid',
      status: 403,
      retryable: false,
    },
    AUTHORIZATION_EXPIRED: {
      error: 'Checkout authorization invalid',
      status: 403,
      retryable: false,
    },
    AUTHORIZATION_INVALID: {
      error: 'Checkout authorization invalid',
      status: 403,
      retryable: false,
    },
    SERVER_CONFIGURATION_ERROR: {
      error: 'Checkout authorization is temporarily unavailable',
      status: 503,
      retryable: false,
    },
  };

  const mapped = errorPayload[code];
  // Log SERVER_CONFIGURATION_ERROR with high severity so missing signing keys are
  // surfaced in observability dashboards instead of being hidden behind 4xx noise.
  if (code === 'SERVER_CONFIGURATION_ERROR') {
    console.error(
      '[agentic-checkout] Missing OPENAI_AGENTIC_CONFIRMATION_KEY*; rejecting completion'
    );
  }
  return NextResponse.json(
    { error: mapped.error, code, retryable: mapped.retryable },
    { status: mapped.status }
  );
}
```

Store `{ authorization_mode: authorization.mode }` under `metadata.agentic.completion` after the mutation succeeds. Never log the confirmation signature or mandate signature.

- [ ] **Step 6: Run authorization and route tests**

Run:

```bash
pnpm --filter web test src/lib/agentic/checkout-authorization.test.ts 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS after route tests cover missing authorization (`428`), mismatched amount (`403`), missing server signing keys (`503`, non-retryable), valid human confirmation, and valid mandate.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add apps/web/src/lib/agentic/checkout-authorization.ts apps/web/src/lib/agentic/checkout-authorization.test.ts apps/web/src/schemas/agentic-checkout.ts 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

---

### Task 16: Complete And Cancel Checkout Sessions Safely

**Files:**
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts`
- Modify: `apps/web/src/schemas/agentic-checkout.ts`

- [ ] **Step 1: Write failing completion and cancel tests**

Add to `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts`:

```typescript
function validHumanConfirmationFor({
  sessionId,
  amount,
  currency,
}: {
  sessionId: string;
  amount: number;
  currency: string;
}) {
  return {
    type: 'human_confirmation' as const,
    session_id: sessionId,
    amount,
    currency,
    confirmed_at: '2026-04-28T11:59:30.000Z',
    signature: 'valid-confirmation-signature',
  };
}

it('returns an agent-safe pending-payment response after bank-transfer completion', async () => {
  const response = await completeCheckoutSessionForTest({
    id: 'session-1',
    buyer: {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      phone_number: '+2348000000000',
    },
    payment_data: { provider: 'paystack', token: 'bank-transfer-intent' },
    completion_authorization: validHumanConfirmationFor({
      sessionId: 'session-1',
      amount: 2500,
      currency: 'NGN',
    }),
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.status).toBe('ready_for_payment');
  expect(body.payment_details).toMatchObject({
    type: 'bank_transfer',
    bank_name: expect.any(String),
    account_number: expect.any(String),
  });
  expect(body.order).toMatchObject({
    id: expect.any(String),
    status: 'payment_pending',
  });
});

it('returns full cart state when canceling a checkout session', async () => {
  const response = await cancelCheckoutSessionForTest('session-1');
  const body = await response.json();

  expect(response.status).toBe(200);
  expect(body.status).toBe('canceled');
  expect(body).toHaveProperty('line_items');
  expect(body).toHaveProperty('totals');
  expect(body).toHaveProperty('fulfillment_options');
});
```

Use local test helper functions in the route test file that call `POST` from the relevant complete/cancel route modules with mocked Supabase, valid auth headers, request integrity headers, and idempotency headers.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: FAIL because completion returns nonstandard `payment_pending` as top-level status, does not enforce the confirmation/mandate contract, and cancel returns only `{ id, status }`.

- [ ] **Step 3: Use the completion schema from Task 15A**

Ensure `complete/route.ts` parses with `agenticCheckoutCompleteSchema` from Task 15A before reading buyer, payment, or authorization fields:

```typescript
const parsed = agenticCheckoutCompleteSchema.safeParse(body);
if (!parsed.success) {
  return NextResponse.json(
    { error: 'Invalid request body', details: parsed.error.flatten() },
    { status: 400 }
  );
}
```

- [ ] **Step 4: Return agent-safe completion status**

In `complete/route.ts`, only after Task 15A authorization succeeds, keep the internal order state as `payment_pending`, keep the `checkout_sessions.status` value as an allowed internal value (`processing` while waiting for the DVA transfer), and return an agent checkout status that belongs to the checkout contract:

```typescript
const responsePayload = {
  ...buildAgenticCheckoutResponse({
    id: session.id,
    status: 'ready_for_payment',
    currency: session.currency,
    lineItems: sessionCalc.lineItems,
    totals: sessionCalc.totals,
    fulfillmentOptions: sessionCalc.fulfillmentOptions,
    fulfillmentAddress: session.shipping_address,
    fulfillmentOptionId: session.shipping_method,
    messages: [
      {
        type: 'info',
        code: 'payment_pending',
        content_type: 'plain',
        content: 'Bank transfer account generated. Complete payment to confirm the order.',
      },
    ],
    baseUrl: 'https://ogabassey.com',
  }),
  order: {
    id: orderId,
    status: 'payment_pending',
  },
  payment_details: {
    type: 'bank_transfer',
    bank_name: dvaResult.bank_name,
    account_number: dvaResult.account_number,
    account_name: dvaResult.account_name,
    amount: grandTotal,
  },
};
```

- [ ] **Step 5: Return full cancel state**

In `cancel/route.ts`, fetch the session fields needed by `calculateCheckoutSession`, update `checkout_sessions.status` to `abandoned`, then return `buildAgenticCheckoutResponse` with agent-facing `status: 'canceled'`.

- [ ] **Step 6: Run completion/cancel tests**

Run:

```bash
pnpm --filter web test 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts'
```

Expected: PASS.

- [ ] **Step 7: Stage For Phase Review**

Run:

```bash
git add 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/cancel/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts' apps/web/src/schemas/agentic-checkout.ts
```

---

### Task 16A: Confirm Agentic Payment Webhooks And DVA Failures

**Files:**
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts`
- Modify: `apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts`
- Modify: `apps/web/src/app/api/payments/webhook/route.ts`
- Modify: `apps/web/src/app/api/payments/webhook/route.test.ts`
- Create: `supabase/migrations/20260428172000_add_agentic_dva_assignments.sql`
- Create: `apps/web/src/lib/agentic/dva-assignment.ts`
- Create: `apps/web/src/lib/agentic/dva-assignment.test.ts`

- [ ] **Step 1: Write failing DVA and webhook tests**

Add tests that prove:

- Duplicate completion requests with the same idempotency key reuse the same DVA/payment response.
- If the Paystack API returns an account but metadata/session persistence fails, the retry reuses or finalizes the reserved DVA assignment instead of creating a second Paystack account.
- A Paystack/DVA generation failure returns a clear retryable error payload, does not mark `checkout_sessions.status` as `completed`, and leaves the internal order in `payment_pending` if an order already exists.
- A successful Paystack transfer/payment webhook for an agentic order moves the order from `payment_pending` to the confirmed downstream state idempotently and updates the linked checkout session consistently.
- A failed Paystack transfer/payment webhook records failure state without fulfilling the order.
- Duplicate webhook deliveries do not double-update the order or create duplicate fulfillment side effects.

- [ ] **Step 2: Harden DVA generation in complete route**

In `complete/route.ts`:

- Make DVA generation retryable and idempotent through a durable reservation before the external Paystack call. Add `agentic_dva_assignments` keyed by `checkout_session_id` with `status`, `payment_reference`, `bank_name`, `account_number`, `account_name`, `amount`, `retry_count`, `last_attempt_at`, `created_at`, `updated_at`, and a unique index on `checkout_session_id`.
- Add `reserveDvaAssignment(sessionId)`, `markDvaAttempt(sessionId)`, and `finalizeDvaAssignment(sessionId, paystackResult)` helpers. The completion route must reserve first, call Paystack only when there is no finalized assignment, increment `retry_count`/`last_attempt_at` before each Paystack call, and finalize the reserved row before returning.
- Enforce a circuit breaker: allow at most 3 Paystack DVA attempts within 60 seconds for a session. When exhausted, do not call Paystack again; return `{ error: 'Payment account unavailable', retryable: false, code: 'DVA_RETRIES_EXHAUSTED' }` with the chosen terminal status and log/metric the failure.
- If finalization or checkout metadata persistence fails after Paystack returns an account, return a retryable 5xx and ensure the next retry reads the reserved/finalized assignment before calling Paystack again.
- If DVA generation fails, return a machine-readable error such as `{ error: 'Payment account unavailable', retryable: true }` with an appropriate 5xx status.
- Keep `checkout_sessions.status = 'processing'` while waiting for bank transfer confirmation.
- Keep `orders.status = 'payment_pending'` until webhook confirmation. Do not expose this internal status as the top-level agent checkout status.

- [ ] **Step 3: Wire webhook confirmation**

Update `apps/web/src/app/api/payments/webhook/route.ts` or the existing Paystack confirmation path so agentic bank-transfer confirmation events:

- Validate webhook signatures using the existing payment-webhook pattern.
- Find the order/session by stored Paystack reference.
- Transition `orders.status` from `payment_pending` to the existing paid/fulfillment-ready state idempotently.
- Transition failures to the existing failed/canceled state without triggering fulfillment.
- Record webhook event ids in metadata so duplicate events are ignored.

- [ ] **Step 4: Verify downstream status compatibility**

Before leaving `checkout_sessions.status = 'processing'`, inspect dashboard and fulfillment readers for checkout/session status assumptions. If any code expects `completed` before payment confirmation, update that code or document why it only reads orders/payment status. Add a test or code reference in this task notes.

- [ ] **Step 5: Run DVA and webhook tests**

Run:

```bash
pnpm --filter web test 'src/app/api/agentic/checkout_sessions/[id]/route.test.ts' src/app/api/payments/webhook/route.test.ts src/lib/agentic/dva-assignment.test.ts
```

Expected: PASS.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add 'apps/web/src/app/api/agentic/checkout_sessions/[id]/complete/route.ts' 'apps/web/src/app/api/agentic/checkout_sessions/[id]/route.test.ts' apps/web/src/app/api/payments/webhook/route.ts apps/web/src/app/api/payments/webhook/route.test.ts apps/web/src/lib/agentic/dva-assignment.ts apps/web/src/lib/agentic/dva-assignment.test.ts supabase/migrations/20260428172000_add_agentic_dva_assignments.sql
```

---

### Task 16B: Advertise Action Capabilities Only After They Are Safe

**Files:**
- Modify: `apps/web/src/app/agent-commerce.json/route.ts`
- Modify: `apps/web/src/app/agent-commerce.json/route.test.ts`
- Modify: `apps/web/src/lib/llms.ts`
- Modify: `apps/web/src/lib/llms.test.ts`

- [ ] **Step 1: Write failing manifest readiness tests**

Add to `apps/web/src/app/agent-commerce.json/route.test.ts`:

```typescript
it('stays catalog-only when agentic checkout is not enabled', async () => {
  process.env.AGENTIC_CHECKOUT_READY = 'false';

  const response = await GET(
    new Request('https://ogabassey.com/agent-commerce.json', {
      headers: { host: 'ogabassey.com' },
    })
  );
  const body = await response.json();

  expect(body.capabilities).toEqual(['catalog.read']);
  expect(body.auth).toBeNull();
  expect(body.links.checkout_sessions).toBeUndefined();
});

it('advertises checkout capabilities only when action layer is ready', async () => {
  process.env.AGENTIC_CHECKOUT_READY = 'true';

  const response = await GET(
    new Request('https://ogabassey.com/agent-commerce.json', {
      headers: { host: 'ogabassey.com' },
    })
  );
  const body = await response.json();

  expect(body.capabilities).toEqual(
    expect.arrayContaining([
      'catalog.read',
      'checkout.session.create',
      'checkout.session.update',
      'checkout.session.complete',
      'checkout.session.cancel',
      'order.read',
    ])
  );
  expect(body.auth).toMatchObject({
    type: 'bearer_hmac',
    required_headers: [
      'authorization',
      'idempotency-key',
      'request-id',
      'signature',
      'timestamp',
      'api-version',
    ],
  });
  expect(body.links.checkout_sessions).toBe(
    'https://ogabassey.com/api/agentic/checkout_sessions'
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test src/app/agent-commerce.json/route.test.ts
```

Expected: FAIL because the manifest does not yet switch capabilities based on Phase 3 readiness.

- [ ] **Step 3: Implement readiness-gated capabilities**

Modify `apps/web/src/app/agent-commerce.json/route.ts`:

```typescript
const CATALOG_CAPABILITIES = ['catalog.read'] as const;
const ACTION_CAPABILITIES = [
  'checkout.session.create',
  'checkout.session.update',
  'checkout.session.complete',
  'checkout.session.cancel',
  'order.read',
] as const;

function isAgenticCheckoutReady() {
  return process.env.AGENTIC_CHECKOUT_READY === 'true';
}

function buildAgenticAuth() {
  return {
    type: 'bearer_hmac',
    required_headers: [
      'authorization',
      'idempotency-key',
      'request-id',
      'signature',
      'timestamp',
      'api-version',
    ],
  };
}
```

Then build the response with:

```typescript
const actionReady = isAgenticCheckoutReady();

capabilities: actionReady
  ? [...CATALOG_CAPABILITIES, ...ACTION_CAPABILITIES]
  : [...CATALOG_CAPABILITIES],
auth: actionReady ? buildAgenticAuth() : null,
links: {
  ...
  ...(actionReady
    ? { checkout_sessions: buildUrl(baseUrl, '/api/agentic/checkout_sessions') }
    : {}),
}
```

- [ ] **Step 4: Add llms action endpoint only when ready**

Modify `apps/web/src/lib/llms.ts` so checkout action links are only emitted when `AGENTIC_CHECKOUT_READY=true`. Keep public catalog/feed links always visible.

```typescript
if (process.env.AGENTIC_CHECKOUT_READY === 'true') {
  lines.push(
    `- [Agentic Checkout Sessions](${baseUrl}/api/agentic/checkout_sessions): Authenticated checkout session API for approved shopping agents`
  );
}
```

Add tests in `apps/web/src/lib/llms.test.ts` for ready and not-ready modes.

- [ ] **Step 5: Run manifest and llms tests**

Run:

```bash
pnpm --filter web test src/app/agent-commerce.json/route.test.ts src/lib/llms.test.ts
```

Expected: PASS.

- [ ] **Step 6: Stage For Phase Review**

Run:

```bash
git add apps/web/src/app/agent-commerce.json/route.ts apps/web/src/app/agent-commerce.json/route.test.ts apps/web/src/lib/llms.ts apps/web/src/lib/llms.test.ts
```

---

### Task 17: Add Post-Purchase Agent Read APIs

**Files:**
- Create: `apps/web/src/app/api/agentic/orders/[id]/route.ts`
- Create: `apps/web/src/app/api/agentic/orders/[id]/route.test.ts`
- Reuse: `apps/web/src/lib/agentic/merchant-context.ts`
- Reuse: `apps/web/src/lib/agentic/scoped-supabase.ts`

- [ ] **Step 1: Write failing order read test**

Create `apps/web/src/app/api/agentic/orders/[id]/route.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/agentic/merchant-context', () => ({
  resolveAgenticMerchantContext: vi.fn(() => ({
    merchantSlug: 'ogabassey',
    keySource: 'merchant_keys',
  })),
}));

const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn(() =>
  Promise.resolve({
    data: {
      id: 'merchant-1',
      slug: 'ogabassey',
      custom_domain: 'ogabassey.com',
    },
    error: null,
  })
);

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'merchants') {
        return {
          select: () => ({
            eq: () => ({
              single: mockSingle,
            }),
          }),
        };
      }
      throw new Error(`Unexpected bootstrap table ${table}`);
    },
  })),
}));

vi.mock('@/lib/agentic/scoped-supabase', () => ({
  createAgenticScopedSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'orders') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: mockMaybeSingle,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected scoped table ${table}`);
    },
  })),
}));

describe('GET /api/agentic/orders/[id]', () => {
  it('returns public post-purchase order state for an agentic order', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: 'order-1',
        status: 'pending',
        payment_status: 'pending',
        shipping_status: 'pending',
        tracking_number: null,
        created_at: '2026-04-28T12:00:00.000Z',
        updated_at: '2026-04-28T12:00:00.000Z',
      },
      error: null,
    });

    const response = await GET(
      new Request('https://ogabassey.com/api/agentic/orders/order-1', {
        headers: { authorization: 'Bearer test' },
      }),
      { params: Promise.resolve({ id: 'order-1' }) }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: 'order-1',
      status: 'pending',
      payment_status: 'pending',
      shipping_status: 'pending',
      tracking_number: null,
      created_at: '2026-04-28T12:00:00.000Z',
      updated_at: '2026-04-28T12:00:00.000Z',
      links: {
        track_order: 'https://ogabassey.com/track-order',
        support: 'https://ogabassey.com/contact',
      },
    });
  });
});
```

Also add tests for unauthorized requests, unknown merchant, non-agentic order not found, and scoped-client query errors. Add an import guard test that scans `route.ts` and fails if it contains `createServiceClient` or `createAdminClient`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter web test 'src/app/api/agentic/orders/[id]/route.test.ts'
```

Expected: FAIL because route does not exist.

- [ ] **Step 3: Implement read-only order route**

Create `apps/web/src/app/api/agentic/orders/[id]/route.ts`:

```typescript
import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { resolveAgenticMerchantContext } from '@/lib/agentic/merchant-context';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import { createClient } from '@/lib/supabase/server';

function buildMerchantBaseUrl(merchant: {
  slug: string;
  custom_domain?: string | null;
}) {
  return merchant.custom_domain
    ? `https://${merchant.custom_domain}`
    : `https://${merchant.slug}.usebaci.com`;
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const agenticContext = resolveAgenticMerchantContext(request);
  if (!agenticContext) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await props.params;
  const bootstrap = createClient(await cookies());
  const { data: merchant, error: merchantError } = await bootstrap
    .from('merchants')
    .select('id, slug, custom_domain')
    .eq('slug', agenticContext.merchantSlug)
    .single();

  if (merchantError || !merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const supabase = createAgenticScopedSupabaseClient({
    merchantId: merchant.id,
    merchantSlug: merchant.slug,
  });

  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, payment_status, shipping_status, tracking_number, created_at, updated_at')
    .eq('id', id)
    .eq('merchant_id', merchant.id)
    .eq('source', 'agentic_ai')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: order.id,
    status: order.status,
    payment_status: order.payment_status,
    shipping_status: order.shipping_status,
    tracking_number: order.tracking_number,
    created_at: order.created_at,
    updated_at: order.updated_at,
    links: {
      track_order: `${buildMerchantBaseUrl(merchant)}/track-order`,
      support: `${buildMerchantBaseUrl(merchant)}/contact`,
    },
  });
}
```

This route is read-only and scoped to `source = 'agentic_ai'` plus the merchant resolved from the API key. It must not expose arbitrary customer/order rows to a platform-wide bearer token.

- [ ] **Step 4: Run order tests**

Run:

```bash
pnpm --filter web test 'src/app/api/agentic/orders/[id]/route.test.ts'
```

Expected: PASS.

- [ ] **Step 5: Stage For Phase Review**

Run:

```bash
git add 'apps/web/src/app/api/agentic/orders/[id]/route.ts' 'apps/web/src/app/api/agentic/orders/[id]/route.test.ts'
```

---

### Task 18: Verify Live Agent Readiness

**Files:**
- No source files unless verification exposes regressions.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm --filter web test \
  src/lib/storefront-agent-availability.test.ts \
  src/lib/storefront-agent-urls.test.ts \
  src/lib/llms.test.ts \
  src/lib/agentic/checkout.test.ts \
  src/lib/agentic/merchant-context.test.ts \
  src/lib/agentic/scoped-supabase.test.ts \
  src/lib/agentic/request-integrity.test.ts \
  src/lib/agentic/request-replay.test.ts \
  src/lib/agentic/idempotency.test.ts \
  src/lib/agentic/checkout-response.test.ts \
  src/lib/agentic/checkout-authorization.test.ts \
  src/lib/agentic/checkout-storage.test.ts \
  src/app/api/feed/openai/route.test.ts \
  src/app/api/feed/google-merchant/feed-query.test.ts \
  src/app/api/feed/google-merchant/route.test.ts \
  src/app/api/feed/google-merchant/feed-data.test.ts \
  src/app/api/feed/google-merchant/feed-builder.test.ts \
  src/app/feeds/google-merchant.xml/route.test.ts \
  src/app/robots.test.ts \
  src/app/api/storefront/products/storefront-products-route-data.test.ts \
  src/app/api/storefront/products/product-response.test.ts \
  src/app/api/agentic/checkout_sessions/route.test.ts \
  'src/app/api/agentic/checkout_sessions/[id]/route.test.ts' \
  'src/app/api/agentic/orders/[id]/route.test.ts' \
  src/app/api/payments/webhook/route.test.ts \
  src/proxy.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run quality gate**

Run:

```bash
pnpm turbo lint
pnpm turbo typecheck
pnpm turbo test
```

Expected: all pass.

- [ ] **Step 3: Run CodeRabbit review**

Run:

```bash
coderabbit review --agent --base-commit "$PHASE_BASE" -c AGENTS.md
```

Expected: no critical or high severity issues remain. If this is the final whole-branch review instead of a phase gate, use the branch start commit as `PHASE_BASE`.

- [ ] **Step 4: Verify local dev URLs**

Start dev server:

```bash
pnpm turbo dev
```

In a separate terminal, run:

```bash
curl -sS -L -D - http://localhost:3000/llms.txt -o /tmp/local-llms.txt
curl -sS -L -D - http://localhost:3000/agent-commerce.json -o /tmp/local-agent-commerce.json
curl -sS -L -D - 'http://localhost:3000/api/feed/openai?merchant_slug=ogabassey&format=current' -o /tmp/local-openai-current.ndjson
curl -sS -L -D - 'http://localhost:3000/feeds/google-merchant.xml' -o /tmp/local-google-merchant.xml
```

Expected: each returns `200` in the headers where host detection can resolve Ogabassey in local config. If local custom-domain detection needs host headers, run:

```bash
curl -sS -H 'Host: ogabassey.com' -L -D - http://localhost:3000/index.html.md -o /tmp/local-index.md
```

Expected: markdown response contains `# Ogabassey`.

- [ ] **Step 5: Verify production after deploy**

Run:

```bash
curl -sS -L -D - https://ogabassey.com/llms.txt -o /tmp/ogabassey-llms.txt
curl -sS -L -D - https://ogabassey.com/index.html.md -o /tmp/ogabassey-index.md
curl -sS -L -D - https://ogabassey.com/about.md -o /tmp/ogabassey-about.md
curl -sS -L -D - https://ogabassey.com/sitemap.xml -o /tmp/ogabassey-sitemap.xml
curl -sS -L -D - https://ogabassey.com/agent-commerce.json -o /tmp/ogabassey-agent-commerce.json
curl -sS -L -D - 'https://ogabassey.com/api/feed/openai?merchant_slug=ogabassey&format=current' -o /tmp/ogabassey-openai-current.ndjson
curl -sS -L -D - 'https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey' -o /tmp/ogabassey-gmc-api.xml
curl -sS -L -D - 'https://ogabassey.com/feeds/google-merchant.xml' -o /tmp/ogabassey-gmc-public.xml
```

Expected:

- `/llms.txt` returns HTTP 200 and links to `/agent-commerce.json`.
- `/index.html.md` returns HTTP 200 and contains `# Ogabassey`.
- `/about.md` returns HTTP 200 or is removed from `llms.txt` if no about content exists.
- `/sitemap.xml` returns HTTP 200 and contains `<urlset`.
- `/agent-commerce.json` returns HTTP 200 and contains `catalog.read`.
- Feed product URLs do not contain `https://ogabassey.com/ogabassey/`.
- Google Merchant API feed and `/feeds/google-merchant.xml` return HTTP 200 XML with at least one `<item>`.

- [ ] **Step 6: Post-deployment monitoring and rollback**

Configure or verify alerts for:

- HTTP 500 rates on `/llms.txt`, `/index.html.md`, `/agent-commerce.json`, `/api/feed/openai`, `/api/feed/google-merchant`, `/feeds/openai.jsonl`, `/feeds/agent-products.jsonl`, `/feeds/google-merchant.xml`, and `/api/agentic/checkout_sessions`.
- Feed generation failures and Google Merchant XML generation latency above the expected production threshold.
- Page/feed/API parity failures where a product URL, price, availability, image, or policy differs across the PDP, Product/Offer JSON-LD, public OpenAI feed, Google Merchant XML, and storefront product API.
- Product/Offer JSON-LD validation failures, missing review/trust-profile schema, invalid image URLs, and crawler fetch failures for `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`, `Claude-User`, `Claude-SearchBot`, `Googlebot`, `Google-Extended`, and `PerplexityBot`.
- Checkout session creation, update, completion, cancellation, DVA-generation failure, and webhook-confirmation failure rates.
- Checkout completion authorization failures by code (`CONFIRMATION_REQUIRED`, `CONFIRMATION_MISMATCH`, `AUTHORIZATION_EXPIRED`, `AUTHORIZATION_INVALID`) and any completion request that reaches payment side effects without an authorization audit record.
- Request-integrity failures that spike above normal agent retry noise.
- Idempotency hard-limit `429` responses, which should be treated as abuse, extreme concurrency, or pruning failure.

Deployment blockers:

- Any verified 500 on `/agent-commerce.json`, `/feeds/google-merchant.xml`, or checkout create/complete.
- Any feed URL containing `https://ogabassey.com/ogabassey/`.
- Any unmanaged-stock product exposed as out of stock.
- Any checkout completion that can create an order, reserve a DVA, or expose payment instructions without a verified confirmation artifact or valid mandate.
- Any payment webhook test or live smoke check that can double-confirm or skip confirmation.

Warnings that can ship only with a follow-up issue:

- `/about.md` unavailable when `llms.txt` does not advertise it.
- Non-critical feed latency that remains below crawler timeout thresholds.

Rollback procedure:

```bash
vercel rollback --yes
```

If rollback must target a specific deployment, use the Vercel dashboard or CLI deployment id for the Baci web project, then re-run the Step 5 production curl checks.

Phased rollout recommendation:

- Verify in staging with `Host: ogabassey.com` curl checks.
- Promote to production behind the smallest available rollout scope or preview alias.
- Move from 10% to 100% only after feed generation, checkout create/complete, and webhook confirmation alerts stay clean.

Load testing checklist:

- Google Merchant XML feed can generate repeatedly without timing out or returning 500.
- OpenAI current feed streams valid records under repeated requests.
- Checkout create/complete endpoints maintain acceptable latency and no duplicate idempotency/request-id records under retry traffic.

- [ ] **Step 7: Commit verification notes if docs were updated**

Only commit verification notes if a docs file was intentionally changed:

```bash
git add docs/
```

---

## Done Criteria

- `https://ogabassey.com/llms.txt` links only to working root/custom-domain machine-readable URLs.
- `https://ogabassey.com/index.html.md` returns a markdown storefront summary.
- `https://ogabassey.com/sitemap.xml` returns HTTP 200 even if one catalog data source fails.
- Product feed URLs are canonical and do not include `/ogabassey/` on the custom domain.
- Current structured product feed includes required product and variant records.
- `https://ogabassey.com/feeds/openai.jsonl` and `https://ogabassey.com/feeds/agent-products.jsonl` return HTTP 200 JSONL through non-`/api` agent-discoverable URLs.
- `https://ogabassey.com/api/feed/google-merchant?merchant_slug=ogabassey` returns HTTP 200 XML.
- `https://ogabassey.com/feeds/google-merchant.xml` returns the same healthy Merchant Center XML through a non-`/api` agent-discoverable URL.
- `llms.txt` or `agent-commerce.json` exposes the agent product feed and Google Merchant XML feed URLs.
- Product page HTML, Product/Offer JSON-LD, public feeds, and storefront product APIs agree on URL, title, price, image, availability, and policy fields.
- Trust-profile and review schema are present where source merchant data exists, and feed image URLs pass validation before they are exposed to agents.
- Public product APIs expose `availability`, `inventory_policy`, `is_purchasable`, and `quantity_available`.
- `manage_stock=false` is exposed as `inventory_policy: "untracked"`, `availability: "in_stock"`, `is_purchasable: true`.
- Agent checkout storage uses existing `checkout_sessions` columns, adds only append-only `metadata`, and never writes invalid status values to the database.
- Agent checkout resolves merchant-scoped API keys while preserving the legacy Ogabassey fallback key.
- Agent-facing checkout/session/order routes do not use generic service-role Supabase clients; they use merchant-scoped RLS claims or equivalent merchant-scoped RPCs.
- Mutating agent checkout routes verify request signature, timestamp freshness, request id, and API version headers.
- Mutating agent checkout routes reject replayed request IDs and document API-version migration/deprecation behavior.
- Agent checkout idempotency replays the same key/body response and rejects the same key with a different body.
- Agent checkout idempotency records are bounded by TTL and count limits.
- Agent checkout create/update/get/complete/cancel responses include payment provider, fulfillment address, totals, messages, links, request id, and idempotency behavior.
- Agent checkout does not reject unmanaged stock products as out of stock.
- Agent checkout completion requires verified human confirmation or a valid pre-authorized mandate for the exact session/amount/currency before order creation, DVA reservation, or payment instructions.
- Agent checkout completion returns an agent-safe payment-ready state while internal orders remain `payment_pending` until webhook confirmation.
- Agent checkout bank-transfer/DVA generation is retryable and idempotent, and Paystack/payment webhook confirmation transitions agentic orders out of `payment_pending` idempotently.
- `agent-commerce.json` advertises checkout/session/order capabilities only when `AGENTIC_CHECKOUT_READY=true`; catalog-only mode remains the default until Phase 3 passes.
- Post-purchase order status is available via read-only authenticated agent API.
- `pnpm turbo lint`, `pnpm turbo typecheck`, `pnpm turbo test`, and CodeRabbit review pass.

## Implementation Order

1. Phase 0 gate: worktree and baseline.
2. Availability semantics.
3. Proxy markdown mirrors.
4. Discovery files.
5. Canonical URL helpers.
6. Sitemap resilience.
7. Product APIs.
8. Agent manifest.
9. Product feed.
10. Phase 1 gate: discovery and readability sub-agent review plus CodeRabbit review.
11. Google Merchant feed repair and public feed alias.
12. Phase 2 gate: Merchant Center and public machine feed sub-agent review plus CodeRabbit review.
13. Checkout stock semantics.
14. Checkout storage schema alignment.
15. Merchant-scoped agentic auth context.
16. Merchant-scoped Supabase/RLS access.
17. Request integrity checks.
18. Shared idempotency.
19. Checkout response shape.
20. Buyer confirmation or payment mandate enforcement.
21. Complete and cancel checkout behavior.
22. Agentic payment webhook confirmation and DVA failure hardening.
23. Readiness-gated action capability advertising.
24. Phase 3 gate: agentic checkout contract sub-agent review plus CodeRabbit review.
25. Order read API.
26. Verification.
27. Phase 4 gate: post-purchase and final verification sub-agent review plus CodeRabbit review.

This order keeps each change testable and prevents later tasks from building on broken discovery or inconsistent availability semantics.
