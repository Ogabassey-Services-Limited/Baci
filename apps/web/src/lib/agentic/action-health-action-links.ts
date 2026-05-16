export const AGENTIC_ORDERS_REVIEW_HREF = '/dashboard/orders?source=agentic';
export const AGENTIC_TRUST_SETTINGS_HREF = '/dashboard/settings/trust';

const ORDER_REVIEW_CODES = new Set([
  'AGENTIC_IDEMPOTENCY_ERRORS',
  'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
  'AGENTIC_ORDER_FINALIZING',
  'AGENTIC_PAYMENT_CLAIMING',
  'AGENTIC_PAYMENT_PENDING',
  'AGENTIC_PAYMENT_PENDING_STALE',
  'AGENTIC_PAYMENT_SETUP_FAILED',
  'AGENTIC_REQUESTS_IN_PROGRESS',
]);

export function getAgenticActionNextStepUrl(code: string): string | undefined {
  if (ORDER_REVIEW_CODES.has(code)) return AGENTIC_ORDERS_REVIEW_HREF;
  if (code === 'AGENTIC_AGENT_ALLOWLIST_UNSET')
    return AGENTIC_TRUST_SETTINGS_HREF;
  return undefined;
}
