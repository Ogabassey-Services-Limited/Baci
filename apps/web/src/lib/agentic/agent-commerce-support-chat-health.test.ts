import { describe, expect, it, vi } from 'vitest';

vi.mock('@/env', () => ({
  getAppUrl: vi.fn(() => 'https://usebaci.com'),
}));

import { checkAgentCommerceSupportChatHealth } from './agent-commerce-support-chat-health';

function createClock(start: number, end: number) {
  return vi.fn().mockReturnValueOnce(start).mockReturnValueOnce(end);
}

describe('checkAgentCommerceSupportChatHealth', () => {
  it('posts a public chat smoke request and reports successful latency', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('Here are gaming phones.', {
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        status: 200,
      })
    );

    const result = await checkAgentCommerceSupportChatHealth(
      fetcher,
      createClock(100, 145)
    );

    expect(result).toEqual({
      issue_count: 0,
      issues: [],
      response_time_ms: 45,
      status: 'ok',
      url: 'https://usebaci.com/api/chat',
    });
    expect(fetcher).toHaveBeenCalledWith('https://usebaci.com/api/chat', {
      body: JSON.stringify({
        messages: [{ content: 'Best gaming phones', role: 'user' }],
      }),
      cache: 'no-store',
      headers: {
        accept: 'text/plain',
        'content-type': 'application/json',
      },
      method: 'POST',
      signal: expect.any(AbortSignal),
    });
  });

  it('returns attention when chat serves its static provider fallback', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response('temporarily busy', {
        headers: { 'x-baci-chat-fallback': 'static' },
        status: 200,
      })
    );

    await expect(
      checkAgentCommerceSupportChatHealth(fetcher, createClock(100, 120))
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'support_chat_static_fallback',
          message:
            'Support chat returned its static provider-failure fallback.',
        },
      ],
      response_time_ms: 20,
      status: 'attention',
    });
  });

  it('returns attention when chat responds too slowly for customer support', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('slow response', { status: 200 }));

    await expect(
      checkAgentCommerceSupportChatHealth(fetcher, createClock(100, 8_101))
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'support_chat_slow',
          message: 'Support chat response time exceeded 8000 ms.',
        },
      ],
      response_time_ms: 8_001,
      status: 'attention',
    });
  });

  it('returns attention when the public chat endpoint rejects the request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('failure', { status: 500 }));

    await expect(
      checkAgentCommerceSupportChatHealth(fetcher, createClock(100, 110))
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'support_chat_unavailable',
          message: 'Support chat returned HTTP 500.',
        },
      ],
      response_time_ms: 10,
      status: 'attention',
    });
  });

  it('returns attention when the public chat request cannot be completed', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network unavailable'));

    await expect(
      checkAgentCommerceSupportChatHealth(fetcher, createClock(100, 120))
    ).resolves.toMatchObject({
      issue_count: 1,
      issues: [
        {
          code: 'support_chat_unavailable',
          message: 'Support chat could not be fetched.',
        },
      ],
      response_time_ms: 20,
      status: 'attention',
    });
  });
});
