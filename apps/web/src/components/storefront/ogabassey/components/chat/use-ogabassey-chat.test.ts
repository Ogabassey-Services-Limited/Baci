import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock useCart before importing the hook
vi.mock('@/hooks/cart', () => ({
  useCart: vi.fn(() => ({
    addToCart: vi.fn(),
    setIsCartOpen: vi.fn(),
  })),
}));

// Mock parseSantaAction to return null by default
vi.mock('@/components/storefront/santa-chat/types', () => ({
  parseSantaAction: vi.fn(() => null),
}));

import { useOgabasseyChat } from './use-ogabassey-chat';

// Helper to create a streaming response body from a string
function makeStreamingResponse(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return {
    ok: true,
    body: stream,
  };
}

describe('useOgabasseyChat - initial state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('initializes isOpen as false', () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));
    expect(result.current.isOpen).toBe(false);
  });

  it('initializes messages as empty array', () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));
    expect(result.current.messages).toHaveLength(0);
  });

  it('initializes input as empty string', () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));
    expect(result.current.input).toBe('');
  });

  it('initializes isLoading as false', () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));
    expect(result.current.isLoading).toBe(false);
  });

  it('returns a messagesEndRef object', () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));
    expect(result.current.messagesEndRef).toBeDefined();
    expect(typeof result.current.messagesEndRef).toBe('object');
  });
});

describe('useOgabasseyChat - welcome message on open', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('adds a welcome message when chat is opened for the first time (standard mode)', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    act(() => {
      result.current.setIsOpen(true);
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    expect(result.current.messages[0].role).toBe('model');
    expect(result.current.messages[0].text).toBe('Hello! How can I help you today?');
  });

  it('adds a santa welcome message when chat is opened in santa mode', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: true }));

    act(() => {
      result.current.setIsOpen(true);
    });

    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThan(0);
    });

    expect(result.current.messages[0].text).toBe('Ho ho ho! How can Santa AI help you today?');
  });

  it('clears the proactive message when chat is opened', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    act(() => {
      result.current.setProactiveMsg('Looking for a new phone?');
    });

    act(() => {
      result.current.setIsOpen(true);
    });

    await waitFor(() => {
      expect(result.current.proactiveMsg).toBeNull();
    });
  });
});

describe('useOgabasseyChat - handleSend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('adds user message to messages when handleSend is called', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('This is a response.')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('What phones do you have?');
    });

    const userMessages = result.current.messages.filter((m) => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(userMessages[0].text).toBe('What phones do you have?');
  });

  it('calls fetch with the correct endpoint for standard mode', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Response text')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('Hello');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('calls fetch with /api/chat/santa endpoint in santa mode', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Ho ho ho!')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: true }));

    await act(async () => {
      await result.current.handleSend('I want a phone');
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/chat/santa',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('adds AI response message after successful fetch', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Here are our latest phones!')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('Show me phones');
    });

    const modelMessages = result.current.messages.filter((m) => m.role === 'model');
    expect(modelMessages.length).toBeGreaterThan(0);
    expect(modelMessages[modelMessages.length - 1].text).toContain('Here are our latest phones!');
  });

  it('clears input after sending', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Response')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    act(() => {
      result.current.setInput('Test message');
    });

    await act(async () => {
      await result.current.handleSend('Test message');
    });

    expect(result.current.input).toBe('');
  });

  it('sets isLoading to false after request completes', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Response done')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('Hello');
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('handles fetch error gracefully and adds error message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('Hello');
    });

    const modelMessages = result.current.messages.filter((m) => m.role === 'model');
    expect(modelMessages.length).toBeGreaterThan(0);
    expect(modelMessages[modelMessages.length - 1].text).toContain(
      "I'm having trouble connecting right now"
    );
  });

  it('handles fetch error gracefully with santa error message in santa mode', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: true }));

    await act(async () => {
      await result.current.handleSend('I want a gift');
    });

    const modelMessages = result.current.messages.filter((m) => m.role === 'model');
    expect(modelMessages[modelMessages.length - 1].text).toContain(
      "Santa's workshop is a bit busy"
    );
  });

  it('handles non-ok response by adding error message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
    });

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('Hello');
    });

    const modelMessages = result.current.messages.filter((m) => m.role === 'model');
    expect(modelMessages[modelMessages.length - 1].text).toContain(
      "I'm having trouble connecting right now"
    );
  });

  it('does nothing when message text is empty', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('');
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it('does nothing when message text is only whitespace', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    await act(async () => {
      await result.current.handleSend('   ');
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('useOgabasseyChat - handleSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('prevents default form submission', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent;

    act(() => {
      result.current.handleSubmit(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('does not call fetch when input is empty on submit', async () => {
    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent;

    await act(async () => {
      result.current.handleSubmit(mockEvent);
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls fetch when input has content on submit', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeStreamingResponse('Response')
    );

    const { result } = renderHook(() => useOgabasseyChat({ isSanta: false }));

    act(() => {
      result.current.setInput('What are your prices?');
    });

    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent;

    await act(async () => {
      result.current.handleSubmit(mockEvent);
      // Allow promises to resolve
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
