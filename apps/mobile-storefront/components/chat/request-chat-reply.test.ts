jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: 'success' },
}));

jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  })),
}));

jest.mock('./santa-cart', () => ({
  addSantaWishToCart: jest.fn(),
}));

import { requestChatReply } from './request-chat-reply';

describe('requestChatReply', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('appends a successful response and clears loading state', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('Chat reply'));
    const setMessages = jest.fn();
    const setIsLoading = jest.fn();
    const scrollToBottom = jest.fn();

    await requestChatReply({
      createMessageId: (prefix) => `${prefix}-1`,
      history: [],
      messageText: 'Hello',
      santaMode: false,
      scrollToBottom,
      setIsLoading,
      setMessages,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat'),
      expect.objectContaining({ method: 'POST' })
    );
    expect(setMessages).toHaveBeenCalledWith(expect.any(Function));
    expect(setIsLoading).toHaveBeenLastCalledWith(false);
    expect(scrollToBottom).toHaveBeenCalled();
  });
});
