import { getAgenticActionNextStepUrl } from '@/lib/agentic/action-health-action-links';
import type { AgenticAction } from '@/schemas/agentic-action-health';

interface BuildAgenticHealthActionsInput {
  activeInProgressCount: number;
  allowlistCount: number;
  isAgenticCheckoutEnabled: boolean;
  orderFinalizingCount: number;
  paymentClaimingCount: number;
  paymentPendingCount: number;
  paymentSetupFailedCount: number;
  stalePaymentPendingCount: number;
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
  stalePaymentPendingCount,
  staleInProgressCount,
  terminalErrorCount,
}: BuildAgenticHealthActionsInput): AgenticAction[] {
  const actions: AgenticAction[] = [];
  const pushAction = (action: AgenticAction) => {
    const nextStepUrl = getAgenticActionNextStepUrl(action.code);
    actions.push(
      nextStepUrl ? { ...action, next_step_url: nextStepUrl } : action
    );
  };

  if (terminalErrorCount > 0) {
    pushAction({
      code: 'AGENTIC_IDEMPOTENCY_ERRORS',
      count: terminalErrorCount,
      message: 'Recent agentic retries ended with server errors.',
      next_step:
        'Review failed agentic orders and retry only after the server error is resolved.',
      severity: 'attention',
    });
  }

  if (staleInProgressCount > 0) {
    pushAction({
      code: 'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
      count: staleInProgressCount,
      message: 'Agentic retry reservations expired before storing a response.',
      next_step:
        'Open agentic orders and confirm whether the buyer should retry the request.',
      severity: 'attention',
    });
  }

  if (orderFinalizingCount > 0) {
    pushAction({
      code: 'AGENTIC_ORDER_FINALIZING',
      count: orderFinalizingCount,
      message: 'Agentic checkouts are waiting on order finalization recovery.',
      next_step:
        'Check whether an order was created before allowing another completion retry.',
      severity: 'attention',
    });
  }

  if (paymentSetupFailedCount > 0) {
    pushAction({
      code: 'AGENTIC_PAYMENT_SETUP_FAILED',
      count: paymentSetupFailedCount,
      message: 'Agentic checkouts failed while setting up payment collection.',
      next_step:
        'Fix payment setup, then ask the buyer or agent to retry checkout completion.',
      severity: 'attention',
    });
  }

  if (stalePaymentPendingCount > 0) {
    pushAction({
      code: 'AGENTIC_PAYMENT_PENDING_STALE',
      count: stalePaymentPendingCount,
      message:
        'Agentic checkouts have been waiting for payment confirmation too long.',
      next_step:
        'Confirm payment manually or cancel stale sessions before agents keep polling.',
      severity: 'attention',
    });
  }

  if (activeInProgressCount > 0) {
    pushAction({
      code: 'AGENTIC_REQUESTS_IN_PROGRESS',
      count: activeInProgressCount,
      message: 'Agentic idempotency reservations are still in progress.',
      next_step:
        'Wait for the reservation window to close before manually retrying.',
      severity: 'monitor',
    });
  }

  if (paymentClaimingCount > 0) {
    pushAction({
      code: 'AGENTIC_PAYMENT_CLAIMING',
      count: paymentClaimingCount,
      message: 'Agentic checkouts are claiming payment setup.',
      next_step:
        'Monitor payment-account creation and investigate if this count does not fall.',
      severity: 'monitor',
    });
  }

  if (paymentPendingCount > 0) {
    pushAction({
      code: 'AGENTIC_PAYMENT_PENDING',
      count: paymentPendingCount,
      message: 'Agentic checkouts are waiting for payment confirmation.',
      next_step:
        'Confirm payment provider webhook status if pending payments do not settle.',
      severity: 'monitor',
    });
  }

  if (isAgenticCheckoutEnabled && allowlistCount === 0) {
    pushAction({
      code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
      count: 1,
      message: 'No agent allowlist is configured in Trust settings.',
      next_step:
        'Open Trust settings and configure trusted agent user-agents before broadly advertising checkout.',
      severity: 'monitor',
    });
  }

  if (actions.length === 0) {
    pushAction({
      code: 'AGENTIC_ACTIONS_HEALTHY',
      count: 0,
      message: 'No recent agentic action issues need attention.',
      next_step: 'No action required right now.',
      severity: 'ok',
    });
  }

  return actions;
}
