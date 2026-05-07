import { beforeEach, describe, expect, it, vi } from 'vitest';

const loggerMocks = vi.hoisted(() => ({
  info: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: loggerMocks,
}));

describe('kuda-debug-log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it('detects enabled Kuda bill debug flags', async () => {
    let { isKudaBillDebugEnabled } = await import('@/lib/kuda-debug-log');

    expect(isKudaBillDebugEnabled()).toBe(false);

    vi.stubEnv('KUDA_BILL_DEBUG', 'yes');
    vi.resetModules();
    ({ isKudaBillDebugEnabled } = await import('@/lib/kuda-debug-log'));

    expect(isKudaBillDebugEnabled()).toBe(true);
  });

  it('redacts token, phone, and meter fields while preserving response shape', async () => {
    const { redactKudaDebugPayload } = await import('@/lib/kuda-debug-log');
    const payload = redactKudaDebugPayload({
      status: true,
      data: {
        finalStatus: 'Successful',
        Pin: {
          Number: 'TEST-EKEDC-TOKEN-ALPHA',
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
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('TEST-EKEDC-TOKEN-ALPHA');
    expect(serialized).not.toContain('43901766923');
    expect(serialized).not.toContain('08146978921');
  });

  it('logs only supported Kuda bill raw responses when debug is enabled', async () => {
    vi.stubEnv('KUDA_BILL_DEBUG', '1');
    const { logKudaRawResponse } = await import('@/lib/kuda-debug-log');

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
      requestDataJson: '{"BillResponseReference":"kuda-bill-1"}',
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
      rawResponseJson:
        '{"status":true,"data":{"Pin":{"redacted":true,"type":"string","length":9}}}',
      serviceType: 'BILL_TSQ',
    });
  });

  it('does not log supported Kuda bill raw responses when debug is disabled', async () => {
    vi.stubEnv('KUDA_BILL_DEBUG', '0');
    const { logKudaRawResponse } = await import('@/lib/kuda-debug-log');

    logKudaRawResponse({
      raw: { status: true, data: { Pin: '1234-5678' } },
      requestData: { BillResponseReference: 'kuda-bill-1' },
      requestRef: 'REQ-123',
      serviceType: 'BILL_TSQ',
    });

    expect(loggerMocks.info).not.toHaveBeenCalled();
  });
});
