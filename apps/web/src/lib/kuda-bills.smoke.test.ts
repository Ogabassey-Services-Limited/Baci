import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('./kuda', async () => {
  const actual = await vi.importActual<typeof import('./kuda')>('./kuda');
  return {
    ...actual,
    generateRequestRef: vi.fn(() => 'BACI-1234567890-abcd1234'),
    kudaRequest: vi.fn(),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}));

import { KudaServiceType, kudaRequest } from './kuda';
import { purchaseBill } from './kuda-bills';

describe('purchaseBill smoke diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs non-secret request diagnostics when Kuda bill debug logging is enabled', async () => {
    const previousDebug = process.env.KUDA_BILL_DEBUG;
    vi.mocked(kudaRequest).mockResolvedValue({
      status: true,
      message: 'Bill purchase successful',
      data: {
        reference: 'TXN-SMOKE-123',
        finalStatus: 'Successful',
        transactionStatus: 3,
        pin: { number: '3373-7728-6877-1154-6184' },
      },
    });
    const meterNumber = '43901766923';
    const customerPhone = '08146978921';

    try {
      process.env.KUDA_BILL_DEBUG = '1';
      await purchaseBill(
        'KUD-ELE-EKED-002',
        meterNumber,
        1000,
        'Customer',
        'BACI-SMOKE-REF-001',
        customerPhone
      );

      expect(loggerMocks.info).toHaveBeenCalledWith({
        amount: 1000,
        amountKobo: '100000',
        billItemIdentifier: 'KUD-ELE-EKED-002',
        hasExplicitCustomerPhone: true,
        message: 'Kuda bill purchase request prepared',
        phoneNumberMatchesCustomerIdentifier: false,
        phoneNumberSource: 'customer_phone',
        reference: 'BACI-SMOKE-REF-001',
        serviceType: KudaServiceType.ADMIN_PURCHASE_BILL,
      });
      const payload = loggerMocks.info.mock.calls[0]?.[0];
      expect(JSON.stringify(payload)).not.toContain(meterNumber);
      expect(JSON.stringify(payload)).not.toContain(customerPhone);
    } finally {
      if (previousDebug === undefined) {
        delete process.env.KUDA_BILL_DEBUG;
      } else {
        process.env.KUDA_BILL_DEBUG = previousDebug;
      }
    }
  });

  it('logs Kuda provider status fields when a bill purchase does not complete', async () => {
    vi.mocked(kudaRequest).mockResolvedValue({
      status: true,
      message: 'Request successful',
      data: {
        reference: 'TXN-K11-123',
        finalStatus: 'Failed',
        transactionStatus: 2,
        postingStatus: 2,
        billerAggregatorStatus: 'k11',
        pin: null,
      },
    });
    const meterNumber = '43901766923';
    const customerPhone = '08146978921';

    const result = await purchaseBill(
      'KUD-ELE-EKED-002',
      meterNumber,
      1000,
      'Customer',
      'BACI-SMOKE-REF-002',
      customerPhone
    );

    expect(result.status).toBe('failed');
    expect(loggerMocks.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        billerAggregatorStatus: 'k11',
        envelopeStatus: true,
        finalStatus: 'Failed',
        hasExplicitCustomerPhone: true,
        hasPin: false,
        hasTransactionId: true,
        message: 'Kuda bill purchase did not complete',
        phoneNumberMatchesCustomerIdentifier: false,
        phoneNumberSource: 'customer_phone',
        postingStatus: '2',
        reference: 'BACI-SMOKE-REF-002',
        transactionStatus: '2',
        vendOutcome: 'failed',
      })
    );
    const payload = loggerMocks.warn.mock.calls[0]?.[0];
    expect(JSON.stringify(payload)).not.toContain(meterNumber);
    expect(JSON.stringify(payload)).not.toContain(customerPhone);
  });
});
