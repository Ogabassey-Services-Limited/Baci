/**
 * Public storefront machine-readable agent contract routes.
 */
export const STOREFRONT_AGENT_ROUTES = {
  agenticApiBase: '/api/agentic',
  manifest: '/agent-commerce.json',
  trust: '/agent-trust.json',
  ucpProfile: '/.well-known/ucp',
} as const;
