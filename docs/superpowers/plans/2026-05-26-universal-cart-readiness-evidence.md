# Universal Cart Readiness Evidence

Date: 2026-05-26
Storefront: https://ogabassey.com
Branch: codex/universal-cart-readiness

## Public Discovery

- /.well-known/ucp: pass for the current production profile. `curl -fsS https://ogabassey.com/.well-known/ucp | jq '{version: .ucp.version, capabilities: .ucp.capabilities, payment_handlers: .ucp.payment_handlers}'` returned UCP version `2026-04-08`, `com.usebaci.catalog.read`, `dev.ucp.shopping.checkout`, `dev.ucp.shopping.order`, and `com.paystack.bank_transfer`.
- /.well-known/ucp branch gap: production does not yet advertise this branch's new `dev.ucp.shopping.cart`, `dev.ucp.catalog.search`, or `dev.ucp.catalog.lookup` capabilities. This is expected until `codex/universal-cart-readiness` is deployed.
- UCP Checker: pass. `curl -fsS https://ucpchecker.com/api/v1/status/ogabassey.com | jq .` returned `status: verified`, `ucp_version: 2026-04-08`, `manifest_url: https://ogabassey.com/.well-known/ucp`, `last_checked_at: 2026-05-26T19:13:50+00:00`.
- agent-commerce.json: pass for current production checkout/order discovery. `curl -fsS https://ogabassey.com/agent-commerce.json | jq 'keys, .'` returned schema `2026-04-30`, platform `baci`, store `ogabassey`, payment method `paystack_bank_transfer`, and checkout/order/session capabilities.
- agent-trust.json: pass. `curl -fsS https://ogabassey.com/agent-trust.json | jq 'keys, .'` returned `trust.status: pass`, 12 trust checks, 1167 shared Google/OpenAI products, 1167 verified images, and merchant review authority rating `4.6` from 264 Google Maps reviews.
- MCP health: pass. `curl -fsS https://mcp.ogabassey.com/health | jq .` returned `{"status":"healthy","database":"connected"}`.

## Production Route Probes

- `POST https://ogabassey.com/api/agentic/catalog/search` without credentials returned HTTP `404`.
- `POST https://ogabassey.com/api/agentic/catalog/lookup` without credentials returned HTTP `404`.
- `POST https://ogabassey.com/api/agentic/carts` without credentials returned HTTP `405`.
- `POST https://ogabassey.com/api/agentic/checkout-sessions` without credentials returned HTTP `401` with UCP checkout error metadata.
- Interpretation: production has the previous checkout/order surface, but the new cart/catalog route surface from this branch is not deployed yet.

## Signed Flow

- Catalog search request id: not run.
- Cart create request id: not run.
- Cart update request id: not run.
- Cart to checkout request id: not run.
- Checkout complete request id: not run.
- Paystack reference: not run.
- Webhook reference: not run.
- Order id: not run.

Signed flow blocker:

- This worktree has no loaded `OPENAI_AGENTIC_API_KEY`, `OPENAI_AGENTIC_SIGNING_KEY`, `OPENAI_AGENTIC_CONFIRMATION_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or `PAYSTACK_SECRET_KEY`.
- `find . apps/web -maxdepth 2 -name '.env*' -type f -print` returned no local env files.
- Production also has not deployed the branch routes required for the full Universal Cart flow, so a signed cart/catalog smoke would not prove the new implementation yet.

## Result

- Paid order created: not proven in this run.
- Order read endpoint returned: not proven in this run.
- Dashboard Universal Cart status: not proven against production; branch code includes readiness checks and dashboard surface covered by tests.

Verdict:

- Public production readiness is partially healthy: current UCP checkout/order discovery is verified, trust is passing, and MCP is healthy.
- Universal Cart readiness is not production-proven yet. The remaining gates are deployment of this branch, signed cart-to-checkout smoke with real agentic credentials, Paystack/Baci order reconciliation, and dashboard readiness verification after the health monitor sees the deployed UCP profile.
