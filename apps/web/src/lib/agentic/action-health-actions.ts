import type { AgenticAction } from '@/schemas/agentic-action-health';

interface BuildAgenticHealthActionsInput {
  activeInProgressCount: number;
  allowlistCount: number;
  isAgenticCheckoutEnabled: boolean;
  orderFinalizingCount: number;
  paymentClaimingCount: number;
  paymentPendingCount: number;
  paymentSetupFailedCount: number;
  staleInProgressCount: number;
  terminalErrorCount: number;
}

export function buildAgenticHealthActions({
  activeInProgressCount,
  allowlistCount,
  isAgenticCheckoutEnabled,
  orderFinalizingCount,
  paymentClaimingCount,
  paymentPendingCount,
  paymentSetupFailedCount,
  staleInProgressCount,
  terminalErrorCount,
}: BuildAgenticHealthActionsInput): AgenticAction[] {
  const actions: AgenticAction[] = [];

  if (terminalErrorCount > 0) {
    actions.push({
      code: 'AGENTIC_IDEMPOTENCY_ERRORS',
      count: terminalErrorCount,
      message: 'Recent agentic retries ended with server errors.',
      severity: 'attention',
    });
  }

  if (staleInProgressCount > 0) {
    actions.push({
      code: 'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
      count: staleInProgressCount,
      message: 'Agentic retry reservations expired before storing a response.',
      severity: 'attention',
    });
  }

  if (orderFinalizingCount > 0) {
    actions.push({
      code: 'AGENTIC_ORDER_FINALIZING',
      count: orderFinalizingCount,
      message: 'Agentic checkouts are waiting on order finalization recovery.',
      severity: 'attention',
    });
  }

  if (paymentSetupFailedCount > 0) {
    actions.push({
      code: 'AGENTIC_PAYMENT_SETUP_FAILED',
      count: paymentSetupFailedCount,
      message: 'Agentic checkouts failed while setting up payment collection.',
      severity: 'attention',
    });
  }

  if (activeInProgressCount > 0) {
    actions.push({
      code: 'AGENTIC_REQUESTS_IN_PROGRESS',
      count: activeInProgressCount,
      message: 'Agentic idempotency reservations are still in progress.',
      severity: 'monitor',
    });
  }

  if (paymentClaimingCount > 0) {
    actions.push({
      code: 'AGENTIC_PAYMENT_CLAIMING',
      count: paymentClaimingCount,
      message: 'Agentic checkouts are claiming payment setup.',
      severity: 'monitor',
    });
  }

  if (paymentPendingCount > 0) {
    actions.push({
      code: 'AGENTIC_PAYMENT_PENDING',
      count: paymentPendingCount,
      message: 'Agentic checkouts are waiting for payment confirmation.',
      severity: 'monitor',
    });
  }

  if (isAgenticCheckoutEnabled && allowlistCount === 0) {
    actions.push({
      code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
      count: 1,
      message:
        'No agent allowlist is configured. Contact support to configure trusted agent user-agents for this merchant.',
      severity: 'monitor',
    });
  }

  if (actions.length === 0) {
    actions.push({
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No recent agentic action issues need attention.',
      severity: 'ok',
    });
  }

  return actions;
}
