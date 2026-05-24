export const AGENTIC_ORDERS_REVIEW_HREF = '/dashboard/orders?source=agentic';
export const AGENTIC_TRUST_SETTINGS_HREF =
  '/dashboard/settings/trust#agent-checkout-controls';

const ORDER_REVIEW_CODES = new Set([
  'AGENTIC_CHECKOUT_CANCEL_ERRORS',
  'AGENTIC_CHECKOUT_COMPLETE_ERRORS',
  'AGENTIC_IDEMPOTENCY_ERRORS',
  'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
  'AGENTIC_ORDER_FINALIZING',
  'AGENTIC_ORDER_READ_ERRORS',
  'AGENTIC_PAYMENT_CLAIMING',
  'AGENTIC_PAYMENT_PENDING',
  'AGENTIC_PAYMENT_PENDING_STALE',
  'AGENTIC_PAYMENT_SETUP_FAILED',
  'AGENTIC_REQUESTS_IN_PROGRESS',
]);

function getIssueSpecificOrdersHref(code: string) {
  return `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=${code}`;
}

export function getAgenticActionNextStepUrl(code: string): string | undefined {
  if (ORDER_REVIEW_CODES.has(code)) return getIssueSpecificOrdersHref(code);
  if (
    code === 'AGENTIC_AGENT_ALLOWLIST_UNSET' ||
    code === 'AGENTIC_REQUEST_CONTROLS_UNAVAILABLE'
  )
    return AGENTIC_TRUST_SETTINGS_HREF;
  return undefined;
}
