import { describe, expect, it, jest } from '@jest/globals';
import { readChatResponseText } from '@/components/chat/read-chat-response';

describe('readChatResponseText', () => {
  it('returns response.text for mobile-safe plain text handling', async () => {
    const text = jest.fn<() => Promise<string>>().mockResolvedValue('Hello from fallback');

    const result = await readChatResponseText({
      text,
    });

    expect(result).toBe('Hello from fallback');
    expect(text).toHaveBeenCalledTimes(1);
  });
});
