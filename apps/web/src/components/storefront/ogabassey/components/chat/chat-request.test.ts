import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from '@/lib/agentic/santa-merchant-slug-header';
import { requestChatReply } from './chat-request';

describe('requestChatReply', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the streamed text and resolved Santa merchant slug', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('Santa reply', {
          headers: { [SANTA_MERCHANT_SLUG_HEADER]: 'winter-store' },
        })
      );

    const result = await requestChatReply(true, [], 'find a gift');

    expect(result).toEqual({
      text: 'Santa reply',
      merchantSlug: 'winter-store',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat/santa',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('sends the storefront merchant slug with chat requests', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('Chat reply'));

    await requestChatReply(false, [], 'show me phones', 'winter-store');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          [SANTA_MERCHANT_SLUG_HEADER]: 'winter-store',
        },
      })
    );
  });
});
