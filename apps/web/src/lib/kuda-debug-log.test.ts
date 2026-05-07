import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isKudaBillDebugEnabled,
  logKudaRawResponse,
  redactKudaDebugPayload,
} from '@/lib/kuda-debug-log';

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}));

describe('kuda-debug-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('detects enabled Kuda bill debug flags', () => {
    expect(isKudaBillDebugEnabled()).toBe(false);

    vi.stubEnv('KUDA_BILL_DEBUG', 'yes');

    expect(isKudaBillDebugEnabled()).toBe(true);
  });

  it('redacts token, phone, and meter fields while preserving response shape', () => {
    const payload = redactKudaDebugPayload({
      status: true,
      data: {
        finalStatus: 'Successful',
        Pin: {
          Number: '0283-6213-2450-8322-0153',
          Units: '29.4',
        },
        CustomerIdentifier: '43901766923',
        PhoneNumber: '08146978921',
      },
    });

    expect(payload).toMatchObject({
      status: true,
      data: {
        finalStatus: 'Successful',
        Pin: {
          redacted: true,
          type: 'object',
          keys: ['Number', 'Units'],
        },
        CustomerIdentifier: {
          redacted: true,
          type: 'string',
          length: 11,
        },
        PhoneNumber: {
          redacted: true,
          type: 'string',
          length: 11,
        },
      },
    });
    expect(JSON.stringify(payload)).not.toContain('0283');
    expect(JSON.stringify(payload)).not.toContain('43901766923');
    expect(JSON.stringify(payload)).not.toContain('08146978921');
  });

  it('logs only supported Kuda bill raw responses when debug is enabled', () => {
    vi.stubEnv('KUDA_BILL_DEBUG', '1');

    logKudaRawResponse({
      raw: { status: true, data: { Pin: '1234-5678' } },
      requestData: { BillResponseReference: 'kuda-bill-1' },
      requestRef: 'REQ-123',
      serviceType: 'BILL_TSQ',
    });
    logKudaRawResponse({
      raw: { status: true },
      requestData: {},
      requestRef: 'REQ-456',
      serviceType: 'GET_BILLERS',
    });

    expect(loggerMocks.info).toHaveBeenCalledTimes(1);
    expect(loggerMocks.info).toHaveBeenCalledWith({
      message: 'Kuda raw response received',
      requestData: { BillResponseReference: 'kuda-bill-1' },
      requestRef: 'REQ-123',
      rawResponse: {
        status: true,
        data: {
          Pin: {
            redacted: true,
            type: 'string',
            length: 9,
          },
        },
      },
      serviceType: 'BILL_TSQ',
    });
  });
});
