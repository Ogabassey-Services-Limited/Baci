import { describe, expect, it } from 'vitest';
import {
  AGENTIC_ORDERS_CLEAR_FOCUS_HREF,
  getAgenticOrdersContext,
} from '@/app/dashboard/orders/agentic-orders-context';

describe('getAgenticOrdersContext', () => {
  it('returns null for empty or unknown issue codes', () => {
    expect(getAgenticOrdersContext(undefined)).toBeNull();
    expect(getAgenticOrdersContext(null)).toBeNull();
    expect(getAgenticOrdersContext('')).toBeNull();
    expect(getAgenticOrdersContext('UNKNOWN')).toBeNull();
  });

  it('normalizes known issue codes and returns contextual guidance', () => {
    const context = getAgenticOrdersContext('  agentic_payment_pending_stale ');

    expect(context).toEqual({
      code: 'AGENTIC_PAYMENT_PENDING_STALE',
      summary: 'Some pending payments have remained unresolved too long.',
      nextStep:
        'Manually confirm settlement or cancel stale sessions before further retries.',
    });
  });

  it('includes trust-controls guidance for allowlist warnings', () => {
    expect(getAgenticOrdersContext('AGENTIC_AGENT_ALLOWLIST_UNSET')).toEqual({
      code: 'AGENTIC_AGENT_ALLOWLIST_UNSET',
      summary:
        'No trusted agent allowlist is configured for agentic checkout requests.',
      nextStep:
        'Open Trust settings and configure trusted agent IDs or user-agents before broader exposure.',
      trustControlsHref: '/dashboard/settings/trust#agent-checkout-controls',
    });
  });
});

describe('AGENTIC_ORDERS_CLEAR_FOCUS_HREF', () => {
  it('keeps the canonical orders route for clearing an issue-focused view', () => {
    expect(AGENTIC_ORDERS_CLEAR_FOCUS_HREF).toBe(
      '/dashboard/orders?source=agentic'
    );
  });
});
