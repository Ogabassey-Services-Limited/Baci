# Baci Agent-Native Commerce Positioning

## Positioning

Baci is agent-native commerce infrastructure for African merchants.

The product is not just another ecommerce builder. Baci helps merchants create storefronts that humans can browse and agents can safely discover, trust, purchase from, and monitor. The storefront UI remains the human channel; the agent contract layer becomes the machine channel.

## YC Thesis

Commerce is moving from search-and-click journeys to delegated buying. Merchants who only publish human-facing pages will be invisible or unreliable to shopping agents. Baci gives small and mid-sized African merchants the infrastructure they would not build themselves: clean product contracts, trust evidence, signed checkout actions, payment handoff, and operational recovery surfaces.

The YC framing should be:

> Baci is the commerce runtime that lets African merchants sell through AI agents without giving up their own storefront, brand, payments, or customer relationship.

## What Is Shipped

### Trust Layer

- `/agent-commerce.json` exposes merchant-scoped commerce capabilities.
- `/agent-trust.json` exposes trust/readiness signals for agent evaluation.
- Custom-domain proxy pass-through keeps machine-readable agent contracts from being rewritten into storefront HTML.
- Product/feed/API parity work gives agents structured alternatives to scraping.

### Action Layer

- Agentic checkout sessions support signed requests, idempotency, replay protection, and explicit completion boundaries.
- Paystack bank-transfer and pay-on-delivery flows are modeled as recoverable payment/order states.
- Merchant action health summarizes operational issues without exposing raw internal replay or idempotency records.

### Adaptive Dashboard

- Published merchants see an agent action center in the dashboard.
- The card separates attention, monitor, healthy, and unavailable states so merchants do not mistake outages or pending recovery work for a clean state.
- Review links point merchants toward order operations, keeping the dashboard practical instead of purely analytical.

## Platform Scope

This is platform-wide Baci infrastructure. Ogabassey is the reference merchant and regression control, not the product boundary. New Baci merchants should inherit the same agent-ready contracts once their storefront, catalog, payment setup, and trust signals meet readiness requirements.

## Product Principles

- Human storefront first, machine contract alongside it.
- Merchant-owned brand, domain, payments, and customer relationship.
- Agents get structured contracts instead of brittle scraping.
- Financial side effects require explicit consent, mandate, or merchant-approved boundary.
- Operational state must be visible to merchants before agents retry into broken flows.
- Readiness should fail closed when trust, catalog, payment, or configuration evidence is missing.

## Best-Practice Guardrails

- Keep request-time Next.js APIs out of static roots. Dynamic request work belongs in leaf components, Suspense boundaries, or client-side authenticated fetches where appropriate.
- Keep user-facing Supabase access least-privilege and merchant-scoped. Prefer RLS-enforced or scoped-JWT access for merchant data; expose redacted summaries for dashboard health surfaces.
- Keep agent endpoints machine-readable, idempotent, and explicit about retryability.
- Keep payment and order state transitions recoverable, with deterministic replay behavior after transport or process failures.

## Next Milestones

1. **Trust Health:** Add merchant-facing trust readiness checks for catalog parity, JSON-LD, image validity, policy links, feed freshness, and crawler visibility.
2. **Action Reliability:** Add dashboards for idempotency failures, pending payment/order recovery, agent allowlists/denylists, and cancellation/refund boundaries.
3. **Adaptive Operations:** Turn dashboard health cards into guided actions: explain what changed, what needs attention, and where to fix it.
4. **YC Narrative:** Move external messaging from "AI ecommerce builder" to "agent-native commerce infrastructure for African merchants," backed by live merchant contracts and payment flows.

## Metrics

- Time from merchant onboarding to agent-readable storefront.
- Share of published stores with healthy trust readiness.
- Agent checkout completion rate by payment method.
- Agent retry/recovery success rate after pending payment or order finalization states.
- Merchant time-to-resolution for agent action health issues.
