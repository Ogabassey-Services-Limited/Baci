import { describe, expect, it, vi } from 'vitest';
import { buildPaidAgenticDvaMetadata } from '@/lib/agentic/paystack-dva-paid-metadata';

describe('buildPaidAgenticDvaMetadata', () => {
  it('preserves existing agentic metadata while recording the paid webhook', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-30T12:00:00.000Z'));

      const metadata = buildPaidAgenticDvaMetadata({
        accountNumber: '9930000902',
        gatewayReference: 'paystack-ref-1',
        metadata: {
          agentic: {
            payment_state: 'payment_pending',
            some_key: 'some_value',
          },
        },
      });

      expect(metadata).toMatchObject({
        agentic: {
          payment_state: 'paid',
          some_key: 'some_value',
          payment_webhook: {
            account_number: '9930000902',
            gateway: 'paystack',
            gateway_reference: 'paystack-ref-1',
            processed_at: '2026-04-30T12:00:00.000Z',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    null,
    [],
    undefined,
  ])('handles malformed metadata value: %s', (metadataValue) => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-04-30T12:00:00.000Z'));

      const metadata = buildPaidAgenticDvaMetadata({
        accountNumber: '9930000902',
        gatewayReference: 'paystack-ref-1',
        metadata: metadataValue,
      });

      expect(metadata).toMatchObject({
        agentic: {
          payment_state: 'paid',
          payment_webhook: {
            account_number: '9930000902',
            gateway: 'paystack',
            gateway_reference: 'paystack-ref-1',
            processed_at: '2026-04-30T12:00:00.000Z',
          },
        },
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
