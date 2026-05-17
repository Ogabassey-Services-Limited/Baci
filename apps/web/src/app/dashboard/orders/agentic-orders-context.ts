import type { Route } from 'next';

export interface AgenticOrdersContext {
  code: string;
  nextStep: string;
  summary: string;
  trustControlsHref?: Route;
}

export const AGENTIC_ORDERS_CLEAR_FOCUS_HREF: Route =
  '/dashboard/orders?source=agentic';

const AGENTIC_TRUST_CONTROLS_HREF: Route =
  '/dashboard/settings/trust#agent-checkout-controls';

const AGENTIC_ORDERS_CONTEXT_BY_CODE: Record<
  string,
  Omit<AgenticOrdersContext, 'code'>
> = {
  AGENTIC_CHECKOUT_COMPLETE_ERRORS: {
    summary: 'Checkout completion has recent terminal failures.',
    nextStep:
      'Review failed completions, fix the underlying error, then retry.',
  },
  AGENTIC_IDEMPOTENCY_ERRORS: {
    summary: 'Recent agentic retries ended with server errors.',
    nextStep:
      'Confirm the server issue is fixed before allowing another retry.',
  },
  AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS: {
    summary:
      'Some idempotency reservations expired before a response was stored.',
    nextStep:
      'Review affected sessions and decide whether retries are safe to run.',
  },
  AGENTIC_ORDER_FINALIZING: {
    summary: 'Some checkouts are stuck in order finalization recovery.',
    nextStep:
      'Confirm whether the original order exists before retrying completion.',
  },
  AGENTIC_PAYMENT_CLAIMING: {
    summary: 'Payment setup claiming is still in progress for active sessions.',
    nextStep:
      'Monitor this queue and investigate if claiming does not clear quickly.',
  },
  AGENTIC_PAYMENT_PENDING: {
    summary: 'Agentic checkouts are waiting for payment confirmation.',
    nextStep:
      'Verify webhook settlement state before prompting buyers to retry.',
  },
  AGENTIC_PAYMENT_PENDING_STALE: {
    summary: 'Some pending payments have remained unresolved too long.',
    nextStep:
      'Manually confirm settlement or cancel stale sessions before further retries.',
  },
  AGENTIC_PAYMENT_SETUP_FAILED: {
    summary: 'Payment setup failed for one or more agentic checkouts.',
    nextStep:
      'Fix payment setup errors, then retry completion for affected sessions.',
  },
  AGENTIC_REQUESTS_IN_PROGRESS: {
    summary: 'Idempotency reservations are still active for agentic requests.',
    nextStep:
      'Wait for active reservations to close before triggering manual retries.',
  },
  AGENTIC_AGENT_ALLOWLIST_UNSET: {
    summary:
      'No trusted agent allowlist is configured for agentic checkout requests.',
    nextStep:
      'Open Trust settings and configure trusted user-agents before broader exposure.',
    trustControlsHref: AGENTIC_TRUST_CONTROLS_HREF,
  },
};

export function getAgenticOrdersContext(
  issueCode: string | null | undefined
): AgenticOrdersContext | null {
  if (!issueCode) return null;
  const normalizedCode = issueCode.trim().toUpperCase();
  if (!normalizedCode) return null;

  const context = AGENTIC_ORDERS_CONTEXT_BY_CODE[normalizedCode];
  if (!context) return null;

  return {
    code: normalizedCode,
    ...context,
  };
}
