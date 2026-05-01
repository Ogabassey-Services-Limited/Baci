import { describe, expect, it } from 'vitest';
import { isAgenticDvaSessionMetadata } from '@/lib/agentic/paystack-dva-session-metadata';

describe('isAgenticDvaSessionMetadata', () => {
  it('accepts pending agentic DVA metadata for the matched account', () => {
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: {
          agentic: {
            dva_account: { account_number: '9930000902' },
            payment_state: 'payment_pending',
          },
        },
      })
    ).toBe(true);
  });

  it('rejects non-agentic, stale, or mismatched metadata', () => {
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: null,
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: { agentic: { payment_state: 'paid' } },
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: {
          agentic: {
            dva_account: '9930000902',
            payment_state: 'payment_pending',
          },
        },
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: { agentic: {} },
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: [],
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: 'not-metadata',
      })
    ).toBe(false);
    expect(
      isAgenticDvaSessionMetadata({
        accountNumber: '9930000902',
        metadata: {
          agentic: {
            dva_account: { account_number: '1111111111' },
            payment_state: 'payment_pending',
          },
        },
      })
    ).toBe(false);
  });
});
