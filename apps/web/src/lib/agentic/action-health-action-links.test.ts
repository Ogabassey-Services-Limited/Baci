import {
  AGENTIC_ORDERS_REVIEW_HREF,
  AGENTIC_TRUST_SETTINGS_HREF,
  getAgenticActionNextStepUrl,
} from '@/lib/agentic/action-health-action-links';

describe('getAgenticActionNextStepUrl', () => {
  it('maps order-review action codes to issue-specific order dashboard links', () => {
    expect(getAgenticActionNextStepUrl('AGENTIC_IDEMPOTENCY_ERRORS')).toBe(
      `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=AGENTIC_IDEMPOTENCY_ERRORS`
    );
    expect(getAgenticActionNextStepUrl('AGENTIC_ORDER_FINALIZING')).toBe(
      `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=AGENTIC_ORDER_FINALIZING`
    );
    expect(getAgenticActionNextStepUrl('AGENTIC_CHECKOUT_CANCEL_ERRORS')).toBe(
      `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=AGENTIC_CHECKOUT_CANCEL_ERRORS`
    );
    expect(getAgenticActionNextStepUrl('AGENTIC_PAYMENT_SETUP_FAILED')).toBe(
      `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=AGENTIC_PAYMENT_SETUP_FAILED`
    );
    expect(
      getAgenticActionNextStepUrl('AGENTIC_CHECKOUT_COMPLETE_ERRORS')
    ).toBe(
      `${AGENTIC_ORDERS_REVIEW_HREF}&agentic_issue=AGENTIC_CHECKOUT_COMPLETE_ERRORS`
    );
  });

  it('maps trust-settings guidance codes to trust settings', () => {
    expect(getAgenticActionNextStepUrl('AGENTIC_AGENT_ALLOWLIST_UNSET')).toBe(
      AGENTIC_TRUST_SETTINGS_HREF
    );
    expect(
      getAgenticActionNextStepUrl('AGENTIC_REQUEST_CONTROLS_UNAVAILABLE')
    ).toBe(AGENTIC_TRUST_SETTINGS_HREF);
  });

  it('returns undefined for unknown action codes', () => {
    expect(getAgenticActionNextStepUrl('UNKNOWN_CODE')).toBeUndefined();
  });
});
