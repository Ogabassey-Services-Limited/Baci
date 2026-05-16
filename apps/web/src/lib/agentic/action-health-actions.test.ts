import { describe, expect, it } from 'vitest';
import { buildAgenticHealthActions } from './action-health-actions';

const healthyInput = {
  activeInProgressCount: 0,
  allowlistCount: 1,
  isAgenticCheckoutEnabled: true,
  orderFinalizingCount: 0,
  paymentClaimingCount: 0,
  paymentPendingCount: 0,
  paymentSetupFailedCount: 0,
  staleInProgressCount: 0,
  stalePaymentPendingCount: 0,
  terminalErrorCount: 0,
};

const expectedNextStepsByCode = {
  AGENTIC_ACTIONS_HEALTHY: 'No action required right now.',
  AGENTIC_AGENT_ALLOWLIST_UNSET:
    'Configure trusted agent user-agents before broadly advertising checkout.',
  AGENTIC_IDEMPOTENCY_ERRORS:
    'Review failed agentic orders and retry only after the server error is resolved.',
  AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS:
    'Open agentic orders and confirm whether the buyer should retry the request.',
  AGENTIC_ORDER_FINALIZING:
    'Check whether an order was created before allowing another completion retry.',
  AGENTIC_PAYMENT_CLAIMING:
    'Monitor payment-account creation and investigate if this count does not fall.',
  AGENTIC_PAYMENT_PENDING:
    'Confirm payment provider webhook status if pending payments do not settle.',
  AGENTIC_PAYMENT_PENDING_STALE:
    'Confirm payment manually or cancel stale sessions before agents keep polling.',
  AGENTIC_PAYMENT_SETUP_FAILED:
    'Fix payment setup, then ask the buyer or agent to retry checkout completion.',
  AGENTIC_REQUESTS_IN_PROGRESS:
    'Wait for the reservation window to close before manually retrying.',
};

describe('buildAgenticHealthActions', () => {
  it('surfaces all recovery and monitor branches in priority order', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        activeInProgressCount: 5,
        allowlistCount: 0,
        orderFinalizingCount: 3,
        paymentClaimingCount: 6,
        paymentPendingCount: 7,
        paymentSetupFailedCount: 4,
        staleInProgressCount: 1,
        stalePaymentPendingCount: 8,
        terminalErrorCount: 2,
      }).map(({ code, count, severity }) => ({ code, count, severity }))
    ).toEqual([
      {
        code: 'AGENTIC_IDEMPOTENCY_ERRORS',
        count: 2,
        severity: 'attention',
      },
      {
        code: 'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
        count: 1,
        severity: 'attention',
      },
      {
        code: 'AGENTIC_ORDER_FINALIZING',
        count: 3,
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_SETUP_FAILED',
        count: 4,
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING_STALE',
        count: 8,
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUESTS_IN_PROGRESS',
        count: 5,
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_CLAIMING',
        count: 6,
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING',
        count: 7,
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
        count: 1,
        severity: 'monitor',
      },
    ]);
  });

  it('surfaces payment setup recovery states before passive monitors', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        activeInProgressCount: 1,
        paymentClaimingCount: 1,
        paymentSetupFailedCount: 1,
        stalePaymentPendingCount: 1,
      })
    ).toEqual([
      {
        code: 'AGENTIC_PAYMENT_SETUP_FAILED',
        count: 1,
        message:
          'Agentic checkouts failed while setting up payment collection.',
        next_step:
          'Fix payment setup, then ask the buyer or agent to retry checkout completion.',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING_STALE',
        count: 1,
        message:
          'Agentic checkouts have been waiting for payment confirmation too long.',
        next_step:
          'Confirm payment manually or cancel stale sessions before agents keep polling.',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUESTS_IN_PROGRESS',
        count: 1,
        message: 'Agentic idempotency reservations are still in progress.',
        next_step:
          'Wait for the reservation window to close before manually retrying.',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_CLAIMING',
        count: 1,
        message: 'Agentic checkouts are claiming payment setup.',
        next_step:
          'Monitor payment-account creation and investigate if this count does not fall.',
        severity: 'monitor',
      },
    ]);
  });

  it('does not warn about an empty allowlist when checkout is disabled', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        allowlistCount: 0,
        isAgenticCheckoutEnabled: false,
      })
    ).toEqual([
      {
        code: 'AGENTIC_ACTIONS_HEALTHY',
        count: 0,
        message: 'No recent agentic action issues need attention.',
        next_step: 'No action required right now.',
        severity: 'ok',
      },
    ]);
  });

  it('returns a single healthy action when no issue counts are present', () => {
    expect(buildAgenticHealthActions(healthyInput)).toEqual([
      {
        code: 'AGENTIC_ACTIONS_HEALTHY',
        count: 0,
        message: 'No recent agentic action issues need attention.',
        next_step: 'No action required right now.',
        severity: 'ok',
      },
    ]);
  });

  it('adds merchant-facing next steps to generated actions', () => {
    const issueActions = buildAgenticHealthActions({
      ...healthyInput,
      activeInProgressCount: 5,
      allowlistCount: 0,
      orderFinalizingCount: 3,
      paymentClaimingCount: 6,
      paymentPendingCount: 7,
      paymentSetupFailedCount: 4,
      staleInProgressCount: 1,
      stalePaymentPendingCount: 8,
      terminalErrorCount: 2,
    });
    const healthyActions = buildAgenticHealthActions(healthyInput);
    const nextStepsByCode = Object.fromEntries(
      [...issueActions, ...healthyActions].map(({ code, next_step }) => [
        code,
        next_step,
      ])
    );

    expect(nextStepsByCode).toEqual(expectedNextStepsByCode);
  });
});
