import { beforeEach, describe, expect, it, vi } from 'vitest';

const sendMailMock = vi.fn();
const sendMailWithTemplateMock = vi.fn();
const mailBatchWithTemplateMock = vi.fn();

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
    process.env.ZEPTOMAIL_TOKEN = 'test-token';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
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
