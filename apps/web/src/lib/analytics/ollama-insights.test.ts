import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateAnalyticsInsightsWithOllama,
  isAnalyticsInsightsOllamaConfigured,
} from './ollama-insights';

const mockGetAiChatModel = vi.fn();
const mockGetOllamaBaseUrl = vi.fn();
const mockGetOllamaBasicAuth = vi.fn();

vi.mock('@/env', () => ({
  getAiChatModel: () => mockGetAiChatModel(),
  getOllamaBaseUrl: () => mockGetOllamaBaseUrl(),
  getOllamaBasicAuth: () => mockGetOllamaBasicAuth(),
}));

describe('analytics Ollama insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAiChatModel.mockReturnValue('gemma4:e4b');
    mockGetOllamaBaseUrl.mockReturnValue('https://ollama.example.com/api');
    mockGetOllamaBasicAuth.mockReturnValue('agent:secret');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects when the VPS Ollama backend is configured', () => {
    expect(isAnalyticsInsightsOllamaConfigured()).toBe(true);
    mockGetOllamaBaseUrl.mockReturnValueOnce(undefined);
    expect(isAnalyticsInsightsOllamaConfigured()).toBe(false);
  });

  it('requests schema-constrained analytics insights from Ollama chat', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              insights: [
                {
                  title: 'Revenue is stable',
                  description: 'Sales have stayed consistent this month.',
                  type: 'positive',
                  priority: 'medium',
                  action: 'Keep monitoring the same products.',
                },
              ],
            }),
          },
        }),
        { status: 200 }
      )
    );

    const result = await generateAnalyticsInsightsWithOllama(
      {
        salesHistory: [],
        topProducts: [],
        channels: [],
      },
      { timeoutMs: 10_000 }
    );

    expect(result.insights[0]?.title).toBe('Revenue is stable');
    const [url, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://ollama.example.com/api/chat');
    expect(init).toEqual(
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Basic /),
          'Content-Type': 'application/json',
        }),
        signal: expect.any(AbortSignal),
      })
    );
    const body = JSON.parse(String(init?.body)) as {
      format: { properties?: Record<string, unknown> };
      model: string;
      stream: boolean;
    };
    expect(body.model).toBe('gemma4:e4b');
    expect(body.stream).toBe(false);
    expect(body.format.properties).toHaveProperty('insights');
  });

  it('redacts non-aggregate fields before sending analytics context to Ollama', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              insights: [
                {
                  title: 'Revenue is stable',
                  description: 'Sales have stayed consistent this month.',
                  type: 'positive',
                  priority: 'medium',
                },
              ],
            }),
          },
        }),
        { status: 200 }
      )
    );

    await generateAnalyticsInsightsWithOllama(
      {
        salesHistory: [
          {
            sale_date: '2026-06-15',
            total_revenue: 1000,
            customer_email: 'buyer@example.com',
          },
        ],
        topProducts: [
          {
            name: 'Phone',
            total_revenue: 1000,
            customer_name: 'Jane Buyer',
          },
        ],
        channels: [
          {
            channel: 'web',
            order_count: 1,
            shipping_address: '1 Private Street',
          },
        ],
      },
      { timeoutMs: 10_000 }
    );

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? [];
    const body = JSON.parse(String(init?.body)) as {
      messages: Array<{ content: string }>;
    };
    const prompt = body.messages.map((message) => message.content).join('\n');
    expect(prompt).toContain('total_revenue');
    expect(prompt).not.toContain('buyer@example.com');
    expect(prompt).not.toContain('Jane Buyer');
    expect(prompt).not.toContain('Private Street');
  });

  it('rejects malformed Ollama JSON before it can be cached', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ message: { content: '{bad json' } }), {
        status: 200,
      })
    );

    await expect(
      generateAnalyticsInsightsWithOllama(
        {
          salesHistory: [],
          topProducts: [],
          channels: [],
        },
        { timeoutMs: 10_000 }
      )
    ).rejects.toThrow('Failed to parse Ollama analytics insights JSON');
  });

  it('rejects Ollama JSON that does not match the analytics insight schema', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              insights: [
                {
                  title: 'Revenue is stable',
                  description: 'Sales have stayed consistent this month.',
                  type: 'invalid-type',
                  priority: 'medium',
                },
              ],
            }),
          },
        }),
        { status: 200 }
      )
    );

    await expect(
      generateAnalyticsInsightsWithOllama(
        {
          salesHistory: [],
          topProducts: [],
          channels: [],
        },
        { timeoutMs: 10_000 }
      )
    ).rejects.toThrow(/invalid|expected|type/i);
  });

  it('rejects empty Ollama model configuration before sending the request', async () => {
    mockGetAiChatModel.mockReturnValueOnce('  ');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      generateAnalyticsInsightsWithOllama(
        {
          salesHistory: [],
          topProducts: [],
          channels: [],
        },
        { timeoutMs: 10_000 }
      )
    ).rejects.toThrow('AI_CHAT_MODEL is not configured');

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects when Ollama returns a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('bad gateway', { status: 502 })
    );

    await expect(
      generateAnalyticsInsightsWithOllama(
        {
          salesHistory: [],
          topProducts: [],
          channels: [],
        },
        { timeoutMs: 10_000 }
      )
    ).rejects.toThrow('Ollama analytics insights returned 502');
  });

  it('rejects when the Ollama request fails at the network layer', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
      new Error('network down')
    );

    await expect(
      generateAnalyticsInsightsWithOllama(
        {
          salesHistory: [],
          topProducts: [],
          channels: [],
        },
        { timeoutMs: 10_000 }
      )
    ).rejects.toThrow('network down');
  });
});
