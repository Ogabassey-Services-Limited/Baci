import { describe, expect, it } from 'vitest';
import { buildAgenticHealthActions } from './action-health-actions';

const healthyInput = {
  activeInProgressCount: 0,
  allowlistCount: 1,
  cancelTerminalErrorCount: 0,
  completeTerminalErrorCount: 0,
  isAgenticCheckoutEnabled: true,
  orderFinalizingCount: 0,
  orderReadTerminalErrorCount: 0,
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
    'Open Trust settings and configure trusted agent IDs or user-agents before broadly advertising checkout.',
  AGENTIC_CHECKOUT_CANCEL_ERRORS:
    'Review cancellation failures before agents or buyers assume the session is closed.',
  AGENTIC_REQUEST_CONTROLS_UNAVAILABLE:
    'Open Trust settings and confirm agent request controls are available before advertising checkout.',
  AGENTIC_CHECKOUT_COMPLETE_ERRORS:
    'Inspect completion failures, then retry checkout completion with the same idempotency key.',
  AGENTIC_IDEMPOTENCY_ERRORS:
    'Review failed agentic orders and retry only after the server error is resolved.',
  AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS:
    'Open agentic orders and confirm whether the buyer should retry the request.',
  AGENTIC_ORDER_FINALIZING:
    'Check whether an order was created before allowing another completion retry.',
  AGENTIC_ORDER_READ_ERRORS:
    'Review failed order status reads before agents continue tracking affected orders.',
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

const expectedNextStepUrlsByCode = {
  AGENTIC_ACTIONS_HEALTHY: undefined,
  AGENTIC_AGENT_ALLOWLIST_UNSET:
    '/dashboard/settings/trust#agent-checkout-controls',
  AGENTIC_CHECKOUT_CANCEL_ERRORS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_CHECKOUT_CANCEL_ERRORS',
  AGENTIC_REQUEST_CONTROLS_UNAVAILABLE:
    '/dashboard/settings/trust#agent-checkout-controls',
  AGENTIC_CHECKOUT_COMPLETE_ERRORS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_CHECKOUT_COMPLETE_ERRORS',
  AGENTIC_IDEMPOTENCY_ERRORS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_IDEMPOTENCY_ERRORS',
  AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
  AGENTIC_ORDER_FINALIZING:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_FINALIZING',
  AGENTIC_ORDER_READ_ERRORS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_READ_ERRORS',
  AGENTIC_PAYMENT_CLAIMING:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_CLAIMING',
  AGENTIC_PAYMENT_PENDING:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING',
  AGENTIC_PAYMENT_PENDING_STALE:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING_STALE',
  AGENTIC_PAYMENT_SETUP_FAILED:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_SETUP_FAILED',
  AGENTIC_REQUESTS_IN_PROGRESS:
    '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_REQUESTS_IN_PROGRESS',
};

describe('buildAgenticHealthActions', () => {
  it('surfaces all recovery and monitor branches in priority order', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        activeInProgressCount: 5,
        allowlistCount: 0,
        cancelTerminalErrorCount: 2,
        completeTerminalErrorCount: 1,
        orderFinalizingCount: 3,
        orderReadTerminalErrorCount: 2,
        paymentClaimingCount: 6,
        paymentPendingCount: 7,
        paymentSetupFailedCount: 4,
        requestControlFetchError: true,
        staleInProgressCount: 1,
        stalePaymentPendingCount: 8,
        terminalErrorCount: 4,
      }).map(({ code, count, next_step_url, severity }) => ({
        code,
        count,
        next_step_url,
        severity,
      }))
    ).toEqual([
      {
        code: 'AGENTIC_CHECKOUT_COMPLETE_ERRORS',
        count: 1,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_CHECKOUT_COMPLETE_ERRORS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_CHECKOUT_CANCEL_ERRORS',
        count: 2,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_CHECKOUT_CANCEL_ERRORS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_IDEMPOTENCY_ERRORS',
        count: 1,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_IDEMPOTENCY_ERRORS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
        count: 1,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_IDEMPOTENCY_STALE_IN_PROGRESS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_ORDER_FINALIZING',
        count: 3,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_FINALIZING',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_ORDER_READ_ERRORS',
        count: 2,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_READ_ERRORS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_SETUP_FAILED',
        count: 4,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_SETUP_FAILED',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING_STALE',
        count: 8,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING_STALE',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUEST_CONTROLS_UNAVAILABLE',
        count: 1,
        next_step_url: '/dashboard/settings/trust#agent-checkout-controls',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUESTS_IN_PROGRESS',
        count: 5,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_REQUESTS_IN_PROGRESS',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_CLAIMING',
        count: 6,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_CLAIMING',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING',
        count: 7,
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
        count: 1,
        next_step_url: '/dashboard/settings/trust#agent-checkout-controls',
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
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_SETUP_FAILED',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING_STALE',
        count: 1,
        message:
          'Agentic checkouts have been waiting for payment confirmation too long.',
        next_step:
          'Confirm payment manually or cancel stale sessions before agents keep polling.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_PENDING_STALE',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUESTS_IN_PROGRESS',
        count: 1,
        message: 'Agentic idempotency reservations are still in progress.',
        next_step:
          'Wait for the reservation window to close before manually retrying.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_REQUESTS_IN_PROGRESS',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_CLAIMING',
        count: 1,
        message: 'Agentic checkouts are claiming payment setup.',
        next_step:
          'Monitor payment-account creation and investigate if this count does not fall.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_PAYMENT_CLAIMING',
        severity: 'monitor',
      },
    ]);
  });

  it('surfaces cancellation failures separately from generic idempotency errors', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        cancelTerminalErrorCount: 2,
        terminalErrorCount: 3,
      })
    ).toEqual([
      {
        code: 'AGENTIC_CHECKOUT_CANCEL_ERRORS',
        count: 2,
        message: 'Agentic checkout cancellations are failing.',
        next_step:
          'Review cancellation failures before agents or buyers assume the session is closed.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_CHECKOUT_CANCEL_ERRORS',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_IDEMPOTENCY_ERRORS',
        count: 1,
        message: 'Recent agentic retries ended with server errors.',
        next_step:
          'Review failed agentic orders and retry only after the server error is resolved.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_IDEMPOTENCY_ERRORS',
        severity: 'attention',
      },
    ]);
  });

  it('surfaces failed agentic order reads as a recovery action', () => {
    expect(
      buildAgenticHealthActions({
        ...healthyInput,
        orderReadTerminalErrorCount: 2,
      })
    ).toEqual([
      {
        code: 'AGENTIC_ORDER_READ_ERRORS',
        count: 2,
        message: 'Agents cannot read recent order status updates.',
        next_step:
          'Review failed order status reads before agents continue tracking affected orders.',
        next_step_url:
          '/dashboard/orders?source=agentic&agentic_issue=AGENTIC_ORDER_READ_ERRORS',
        severity: 'attention',
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

  it('surfaces request-control lookup failures before healthy state', () => {
    const input = {
      ...healthyInput,
      requestControlFetchError: true,
    };

    expect(buildAgenticHealthActions(input)).toEqual([
      {
        code: 'AGENTIC_REQUEST_CONTROLS_UNAVAILABLE',
        count: 1,
        message: 'Agent request controls could not be loaded.',
        next_step:
          'Open Trust settings and confirm agent request controls are available before advertising checkout.',
        next_step_url: '/dashboard/settings/trust#agent-checkout-controls',
        severity: 'attention',
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
      cancelTerminalErrorCount: 2,
      completeTerminalErrorCount: 1,
      orderFinalizingCount: 3,
      orderReadTerminalErrorCount: 2,
      paymentClaimingCount: 6,
      paymentPendingCount: 7,
      paymentSetupFailedCount: 4,
      requestControlFetchError: true,
      staleInProgressCount: 1,
      stalePaymentPendingCount: 8,
      terminalErrorCount: 4,
    });
    const healthyActions = buildAgenticHealthActions(healthyInput);
    const nextStepsByCode = Object.fromEntries(
      [...issueActions, ...healthyActions].map(({ code, next_step }) => [
        code,
        next_step,
      ])
    );
    const nextStepUrlsByCode = Object.fromEntries(
      [...issueActions, ...healthyActions].map(({ code, next_step_url }) => [
        code,
        next_step_url,
      ])
    );

    expect(nextStepsByCode).toEqual(expectedNextStepsByCode);
    expect(nextStepUrlsByCode).toEqual(expectedNextStepUrlsByCode);
  });
});
