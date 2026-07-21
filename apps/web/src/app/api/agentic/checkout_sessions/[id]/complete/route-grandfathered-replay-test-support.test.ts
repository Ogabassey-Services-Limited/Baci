import { describe, expect, it } from 'vitest';
import { grandfatheredReplayTestFixtures } from './route-grandfathered-replay-test-support';

describe('grandfatheredReplayTestFixtures', () => {
  it('returns fresh nested replay evidence for every invocation', () => {
    const firstSession = grandfatheredReplayTestFixtures.makeSession();
    const secondSession = grandfatheredReplayTestFixtures.makeSession();
    const firstResponse = grandfatheredReplayTestFixtures.makeStoredResponse();
    const secondResponse = grandfatheredReplayTestFixtures.makeStoredResponse();

    expect(firstSession.metadata.agentic.buyer).not.toBe(
      secondSession.metadata.agentic.buyer
    );
    expect(firstSession.metadata.agentic.dva_account).not.toBe(
      secondSession.metadata.agentic.dva_account
    );
    expect(firstSession.metadata.agentic.line_items).not.toBe(
      secondSession.metadata.agentic.line_items
    );
    expect(firstResponse.line_items).not.toBe(secondResponse.line_items);
    expect(firstResponse.totals).not.toBe(secondResponse.totals);
  });

  it('applies session and stored-response overrides', () => {
    const session = grandfatheredReplayTestFixtures.makeSession({
      order_id: 'order-override',
      status: 'completed',
      virtual_account_number: '9999999999',
    });
    const response = grandfatheredReplayTestFixtures.makeStoredResponse({
      order_id: 'order-override',
      status: 'completed',
    });

    expect(session).toMatchObject({
      metadata: {
        agentic: { dva_account: { account_number: '9999999999' } },
      },
      order_id: 'order-override',
      payment_reference: '9999999999',
      status: 'completed',
      virtual_account_number: '9999999999',
    });
    expect(response).toMatchObject({
      order_id: 'order-override',
      status: 'completed',
    });
  });
});
