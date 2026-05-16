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
        severity: 'attention',
      },
      {
        code: 'AGENTIC_PAYMENT_PENDING_STALE',
        count: 1,
        message:
          'Agentic checkouts have been waiting for payment confirmation too long.',
        severity: 'attention',
      },
      {
        code: 'AGENTIC_REQUESTS_IN_PROGRESS',
        count: 1,
        message: 'Agentic idempotency reservations are still in progress.',
        severity: 'monitor',
      },
      {
        code: 'AGENTIC_PAYMENT_CLAIMING',
        count: 1,
        message: 'Agentic checkouts are claiming payment setup.',
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
        severity: 'ok',
      },
    ]);
  });
});
