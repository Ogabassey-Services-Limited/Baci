import {
  AGENTIC_ORDERS_REVIEW_HREF,
  AGENTIC_TRUST_SETTINGS_HREF,
  getAgenticActionNextStepUrl,
} from '@/lib/agentic/action-health-action-links';

describe('getAgenticActionNextStepUrl', () => {
  it('maps order-review action codes to the agentic orders dashboard', () => {
    expect(
      getAgenticActionNextStepUrl('AGENTIC_CHECKOUT_COMPLETE_ERRORS')
    ).toBe(AGENTIC_ORDERS_REVIEW_HREF);
    expect(getAgenticActionNextStepUrl('AGENTIC_IDEMPOTENCY_ERRORS')).toBe(
      AGENTIC_ORDERS_REVIEW_HREF
    );
    expect(getAgenticActionNextStepUrl('AGENTIC_ORDER_FINALIZING')).toBe(
      AGENTIC_ORDERS_REVIEW_HREF
    );
    expect(getAgenticActionNextStepUrl('AGENTIC_PAYMENT_SETUP_FAILED')).toBe(
      AGENTIC_ORDERS_REVIEW_HREF
    );
  });

  it('maps allowlist guidance code to trust settings', () => {
    expect(getAgenticActionNextStepUrl('AGENTIC_AGENT_ALLOWLIST_UNSET')).toBe(
      AGENTIC_TRUST_SETTINGS_HREF
    );
  });

  it('returns undefined for unknown action codes', () => {
    expect(getAgenticActionNextStepUrl('UNKNOWN_CODE')).toBeUndefined();
  });
});
