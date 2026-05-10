import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn();
const sendMailWithTemplateMock = vi.fn();
const mailBatchWithTemplateMock = vi.fn();

const getZeptoMailTokenMock = vi.fn<() => string | undefined>();
const getZeptoMailFromDomainMock = vi.fn<() => string>();

const auditState = {
  inserts: [] as unknown[],
  updates: [] as Array<{ patch: Record<string, unknown>; ids: string[] }>,
  nextId: 1,
};

vi.mock('zeptomail', () => ({
  SendMailClient: class MockSendMailClient {
    sendMail = sendMailMock;
    sendMailWithTemplate = sendMailWithTemplateMock;
    mailBatchWithTemplate = mailBatchWithTemplateMock;
  },
}));

vi.mock('@/env', () => ({
  getZeptoMailToken: getZeptoMailTokenMock,
  getZeptoMailFromDomain: getZeptoMailFromDomainMock,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn((rows: unknown) => ({
        select: vi.fn(() => {
          const insertedRows = Array.isArray(rows) ? rows : [rows];
          auditState.inserts.push(...insertedRows);
          const data = insertedRows.map(() => ({
            id: `attempt-${auditState.nextId++}`,
          }));
          return Promise.resolve({ data, error: null });
        }),
      })),
      update: vi.fn((patch: Record<string, unknown>) => ({
        in: vi.fn((_column: string, ids: string[]) => {
          auditState.updates.push({ patch, ids });
          return Promise.resolve({ error: null });
        }),
      })),
    })),
  })),
}));

describe('zeptomail audit logging', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    auditState.inserts = [];
    auditState.updates = [];
    auditState.nextId = 1;
    getZeptoMailTokenMock.mockReturnValue('test-token');
    getZeptoMailFromDomainMock.mockReturnValue('usebaci.com');
  });

  it('returns failure when ZEPTOMAIL_TOKEN is whitespace-only', async () => {
    getZeptoMailTokenMock.mockReturnValue(undefined);
    const { sendEmail } = await import('./zeptomail');

    const result = await sendEmail({
      to: 'customer@example.com',
      subject: 'Test',
      htmlContent: '<p>Hello</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ZEPTOMAIL_TOKEN/);
  });

  it('falls back to usebaci.com sender when ZEPTOMAIL_FROM_DOMAIN is whitespace-only', async () => {
    getZeptoMailFromDomainMock.mockReturnValue('usebaci.com');
    sendMailMock.mockResolvedValue({ request_id: 'domain-test' });
    const { sendEmail } = await import('./zeptomail');

    await sendEmail({
      to: 'customer@example.com',
      subject: 'Test',
      htmlContent: '<p>Hello</p>',
    });

    const callArgs = sendMailMock.mock.calls[0]?.[0];
    expect(callArgs?.from?.address).toMatch(/@usebaci\.com$/);
  });

  it('logs accepted HTML email attempts with audit context', async () => {
    sendMailMock.mockResolvedValue({ request_id: 'zepto-123' });
    const { sendEmail } = await import('./zeptomail');

    const result = await sendEmail({
      to: 'customer@example.com',
      toName: 'Customer',
      subject: 'Order Confirmation',
      htmlContent: '<p>Hello</p>',
      emailType: 'orders',
      auditContext: {
        merchantId: 'merchant-1',
        orderId: 'order-1',
        customerId: 'customer-1',
        metadata: { trigger: 'order_confirmation' },
      },
    });

    expect(result).toEqual({
      success: true,
      messageId: 'zepto-123',
    });
    expect(auditState.inserts).toHaveLength(1);
    expect(auditState.inserts[0]).toMatchObject({
      transport_type: 'html',
      status: 'pending',
      email_type: 'orders',
      recipient_email: 'customer@example.com',
      subject: 'Order Confirmation',
      merchant_id: 'merchant-1',
      order_id: 'order-1',
      customer_id: 'customer-1',
      metadata: { trigger: 'order_confirmation' },
    });
    expect(auditState.updates).toHaveLength(1);
    expect(auditState.updates[0]).toMatchObject({
      ids: ['attempt-1'],
      patch: {
        status: 'accepted',
        provider_message_id: 'zepto-123',
        attempt_count: 1,
      },
    });
  });

  // Δ-64 (A1): forward `clientReference` to ZeptoMail's documented
  // `client_reference` field so the outbox helper has a server-side audit
  // trail showing which sends actually went out (used to bound the
  // residual "sent then crashed before mark-completed" duplicate window).
  it('forwards clientReference as client_reference when supplied', async () => {
    sendMailMock.mockResolvedValue({ request_id: 'zepto-cref' });
    const { sendEmail } = await import('./zeptomail');

    await sendEmail({
      to: 'customer@example.com',
      subject: 'Order Confirmation',
      htmlContent: '<p>Hello</p>',
      clientReference: 'order:abc-123:paid_email',
    });

    const callArgs = sendMailMock.mock.calls[0]?.[0];
    expect(callArgs?.client_reference).toBe('order:abc-123:paid_email');
  });

  it('omits client_reference when no clientReference is supplied', async () => {
    sendMailMock.mockResolvedValue({ request_id: 'zepto-no-cref' });
    const { sendEmail } = await import('./zeptomail');

    await sendEmail({
      to: 'customer@example.com',
      subject: 'Test',
      htmlContent: '<p>Hello</p>',
    });

    const callArgs = sendMailMock.mock.calls[0]?.[0];
    expect(callArgs).not.toHaveProperty('client_reference');
  });

  it('logs invalid recipient validation failures without calling the provider', async () => {
    const { sendEmail } = await import('./zeptomail');

    const result = await sendEmail({
      to: 'bad email',
      subject: 'Broken',
      htmlContent: '<p>Hi</p>',
    });

    expect(sendMailMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(auditState.inserts).toHaveLength(1);
    expect(auditState.inserts[0]).toMatchObject({
      status: 'failed',
      transport_type: 'html',
      recipient_email: 'bad email',
      provider_error_message: 'Invalid email address: bad email',
    });
    expect(auditState.updates).toHaveLength(0);
  });

  it('records failed status after all retries are exhausted', async () => {
    vi.useFakeTimers();
    const retryableError = {
      error: { message: 'Server overloaded', code: 'TM_5001', details: null },
    };
    sendMailMock.mockRejectedValue(retryableError);
    const { sendEmail } = await import('./zeptomail');

    const resultPromise = sendEmail({
      to: 'customer@example.com',
      toName: 'Customer',
      subject: 'Retry Test',
      htmlContent: '<p>Hello</p>',
      emailType: 'orders',
      auditContext: {
        merchantId: 'merchant-1',
        orderId: 'order-1',
      },
    });

    // Advance through all retry delays (1s, 2s, 4s)
    for (let i = 0; i < 3; i++) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    const result = await resultPromise;
    vi.useRealTimers();

    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('TM_5001');
    // 1 initial + 3 retries = 4 calls
    expect(sendMailMock).toHaveBeenCalledTimes(4);
    expect(auditState.inserts).toHaveLength(1);
    expect(auditState.inserts[0]).toMatchObject({
      status: 'pending',
      transport_type: 'html',
    });
    expect(auditState.updates).toHaveLength(1);
    expect(auditState.updates[0]).toMatchObject({
      ids: ['attempt-1'],
      patch: {
        status: 'failed',
        attempt_count: 4,
        provider_error_code: 'TM_5001',
        provider_error_message: 'Server overloaded',
      },
    });
  });

  it('logs one batch attempt row per recipient', async () => {
    mailBatchWithTemplateMock.mockResolvedValue({ request_id: 'batch-789' });
    const { sendBatchEmailWithTemplate } = await import('./zeptomail');

    const result = await sendBatchEmailWithTemplate({
      templateKey: 'newsletter-template',
      emailType: 'newsletter',
      recipients: [
        {
          to: 'first@example.com',
          toName: 'First',
          mergeInfo: { name: 'First' },
        },
        {
          to: 'second@example.com',
          toName: 'Second',
          mergeInfo: { name: 'Second' },
        },
      ],
      auditContext: {
        merchantId: 'merchant-1',
        metadata: { campaign: 'weekly_digest' },
      },
    });

    expect(result).toEqual({
      success: true,
      messageId: 'batch-789',
    });
    expect(auditState.inserts).toHaveLength(2);
    expect(auditState.inserts[0]).toMatchObject({
      transport_type: 'batch_template',
      recipient_email: 'first@example.com',
      template_key: 'newsletter-template',
      merchant_id: 'merchant-1',
      metadata: { campaign: 'weekly_digest', mergeInfoKeys: ['name'] },
    });
    expect(auditState.inserts[1]).toMatchObject({
      transport_type: 'batch_template',
      recipient_email: 'second@example.com',
      template_key: 'newsletter-template',
      merchant_id: 'merchant-1',
      metadata: { campaign: 'weekly_digest', mergeInfoKeys: ['name'] },
    });
    expect(auditState.updates).toHaveLength(1);
    expect(auditState.updates[0]).toMatchObject({
      ids: ['attempt-1', 'attempt-2'],
      patch: {
        status: 'accepted',
        provider_message_id: 'batch-789',
        attempt_count: 1,
      },
    });
  });
});
