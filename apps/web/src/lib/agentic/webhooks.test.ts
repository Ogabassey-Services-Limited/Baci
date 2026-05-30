import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('sendAgenticWebhook', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 200 }))
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to the legacy signing key when the Baci signing key is blank', async () => {
    vi.stubEnv('OPENAI_AGENTIC_WEBHOOK_URL', 'https://agent.example/webhook');
    vi.stubEnv('BACI_AGENTIC_SIGNING_KEY', '   ');
    vi.stubEnv('OPENAI_AGENTIC_SIGNING_KEY', ' legacy-signing-key ');
    const { sendAgenticWebhook } = await import('./webhooks');

    await sendAgenticWebhook('order.created', {
      id: 'order-1',
      total: 5000,
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('https://agent.example/webhook');
    expect(init?.method).toBe('POST');

    const body = String(init?.body);
    const expectedSignature = crypto
      .createHmac('sha256', 'legacy-signing-key')
      .update(body)
      .digest('hex');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Merchant-Signature': expectedSignature,
      'X-Event-Type': 'order.created',
    });
  });
});
