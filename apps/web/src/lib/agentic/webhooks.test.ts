import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgenticOrderData, AgenticWebhookEvent } from './webhooks';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SIGNING_KEY = 'test-signing-key';
const WEBHOOK_URL = 'https://openai.example.com/webhooks/agentic';

const sampleOrder: AgenticOrderData = {
  id: 'order_123',
  currency: 'NGN',
  total: 12_500,
  status: 'pending',
  buyer: {
    email: 'buyer@example.com',
    first_name: 'Ada',
    last_name: 'Lovelace',
    phone_number: '+2348012345678',
  },
};

async function importModule() {
  vi.resetModules();
  return await import('./webhooks');
}

describe('sendAgenticWebhook', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(vi.fn());
    errorSpy = vi.spyOn(console, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => {
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('skips network call and warns when OPENAI_AGENTIC_WEBHOOK_URL is missing', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', '');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);

    const { sendAgenticWebhook } = await importModule();

    await expect(
      sendAgenticWebhook('order.created', sampleOrder)
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'OpenAI Webhook configuration missing. Skipping webhook.'
    );
  });

  it('skips network call and warns when OPENAI_AGENTIC_SIGNING_KEY is missing', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', '');

    const { sendAgenticWebhook } = await importModule();

    await expect(
      sendAgenticWebhook('order.created', sampleOrder)
    ).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('sends correctly-shaped payload when both env vars are present', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { sendAgenticWebhook } = await importModule();

    const event: AgenticWebhookEvent = 'order.created';
    const before = Date.now();
    await sendAgenticWebhook(event, sampleOrder);
    const after = Date.now();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(WEBHOOK_URL);
    expect(calledInit.method).toBe('POST');

    const body = JSON.parse(calledInit.body as string);
    expect(body.event).toBe(event);
    expect(body.order_id).toBe(sampleOrder.id);
    expect(body.payload).toEqual(sampleOrder);
    expect(typeof body.timestamp).toBe('string');

    // timestamp is within the call window (ISO string)
    const ts = Date.parse(body.timestamp);
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('includes the merchant signature header with default name', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_HEADER_NAME', '');
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { sendAgenticWebhook } = await importModule();
    await sendAgenticWebhook('order.created', sampleOrder);

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-Event-Type']).toBe('order.created');
    expect(typeof headers['Merchant-Signature']).toBe('string');
    expect(headers['Merchant-Signature']).toHaveLength(64);
  });

  it('uses the configured merchant header name when provided', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    vi.stubEnv('OPENAI_AGENTIC_MERCHANT_HEADER_NAME', 'Ogabassey-Signature');
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { sendAgenticWebhook } = await importModule();
    await sendAgenticWebhook('order.created', sampleOrder);

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = calledInit.headers as Record<string, string>;
    expect(headers['Ogabassey-Signature']).toBeTypeOf('string');
    expect(headers['Merchant-Signature']).toBeUndefined();
  });

  it('signs the payload with HMAC-SHA256 using MERCHANT_SIGNING_KEY', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { sendAgenticWebhook } = await importModule();
    await sendAgenticWebhook('order.created', sampleOrder);

    const [, calledInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = calledInit.headers as Record<string, string>;
    const sentBody = calledInit.body as string;
    const expectedSignature = crypto
      .createHmac('sha256', SIGNING_KEY)
      .update(sentBody)
      .digest('hex');

    expect(headers['Merchant-Signature']).toBe(expectedSignature);
  });

  it('logs an error and resolves when fetch returns a non-OK response', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    mockFetch.mockResolvedValueOnce(
      new Response('boom', { status: 500, statusText: 'Server Error' })
    );

    const { sendAgenticWebhook } = await importModule();

    await expect(
      sendAgenticWebhook('order.created', sampleOrder)
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send webhook to OpenAI')
    );
  });

  it('logs an error and resolves when fetch rejects', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', WEBHOOK_URL);
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', SIGNING_KEY);
    mockFetch.mockRejectedValueOnce(new Error('network down'));

    const { sendAgenticWebhook } = await importModule();

    await expect(
      sendAgenticWebhook('order.updated', sampleOrder)
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      'Error sending agentic webhook:',
      expect.any(Error)
    );
  });
});
