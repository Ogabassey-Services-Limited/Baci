import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useChat } from './use-chat';

// Mock the UI store
const mockClearChatInitialMessage = jest.fn();
const mockGetState = jest.fn(() => ({
  clearChatInitialMessage: mockClearChatInitialMessage,
}));

let mockIsChatOpen = false;
let mockChatInitialMessage: string | null = null;

jest.mock('@/stores/ui-store', () => ({
  useUIStore: jest.fn((selector: (state: { isChatOpen: typeof mockIsChatOpen; chatInitialMessage: typeof mockChatInitialMessage; clearChatInitialMessage: typeof mockClearChatInitialMessage }) => unknown) => {
    const state = {
      isChatOpen: mockIsChatOpen,
      chatInitialMessage: mockChatInitialMessage,
      clearChatInitialMessage: mockClearChatInitialMessage,
    };
    return selector(state);
  }),
}));

// Attach getState to the mocked useUIStore after jest.mock is set up
import { useUIStore } from '@/stores/ui-store';

(useUIStore as unknown as { getState: typeof mockGetState }).getState =
  mockGetState;

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Error: 'error',
    Warning: 'warning',
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  createLogger: jest.fn(() => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
}));

// Create a helper to build a mock streaming response
function makeMockResponse(text: string, ok = true) {
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text);
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoded);
      controller.close();
    },
  });

  return {
    ok,
    body: stream,
  };
}

describe('useChat', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockIsChatOpen = false;
    mockChatInitialMessage = null;
    mockClearChatInitialMessage.mockClear();
    mockGetState.mockClear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllTimers();
  });

  it('initializes with an empty messages array', () => {
    const { result } = renderHook(() => useChat(false));

    expect(result.current.messages).toEqual([]);
  });

  it('sets a welcome message when chat opens', async () => {
    // Arrange: chat is closed initially, then opened
    mockIsChatOpen = false;
    const { result, rerender } = renderHook(() => useChat(false));

    expect(result.current.messages).toHaveLength(0);

    // Act: open chat
    mockIsChatOpen = true;
    rerender({});

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Assert
    expect(result.current.messages[0].role).toBe('model');
    expect(result.current.messages[0].text).toBe(
      'Hello! How can I help you today?'
    );
    expect(result.current.messages[0].id).toBe('welcome');
  });

  it('sets a santa welcome message when santaMode is true', async () => {
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(true));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    expect(result.current.messages[0].text).toBe(
      'Ho ho ho! How can Santa AI help you today?'
    );
  });

  it('adds user message to messages array after handleSend', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(makeMockResponse('AI reply'));
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Hello there');
    });

    // Assert: welcome message + user message + AI message
    await waitFor(() => {
      expect(result.current.messages.length).toBeGreaterThanOrEqual(2);
    });

    const userMsg = result.current.messages.find((m) => m.role === 'user');
    expect(userMsg).toBeDefined();
    expect(userMsg?.text).toBe('Hello there');
  });

  it('calls fetch with the correct endpoint', async () => {
    // Arrange
    const mockFetch = jest.fn().mockResolvedValue(makeMockResponse('AI reply'));
    global.fetch = mockFetch;
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Test message');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Assert
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/chat');
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('calls the santa endpoint when santaMode is true', async () => {
    // Arrange
    const mockFetch = jest
      .fn()
      .mockResolvedValue(makeMockResponse('Santa reply'));
    global.fetch = mockFetch;
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(true));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Test message');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Assert
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/chat/santa');
  });

  it('handles network errors gracefully by adding an error message', async () => {
    // Arrange
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Hello');
    });

    // Assert: an error model message is added
    await waitFor(() => {
      const errorMsg = result.current.messages.find(
        (m) => m.role === 'model' && m.id.startsWith('error-')
      );
      expect(errorMsg).toBeDefined();
      expect(errorMsg?.text).toContain("I'm having trouble connecting");
    });
  });

  it('handles network errors in santa mode with appropriate error message', async () => {
    // Arrange
    global.fetch = jest.fn().mockRejectedValue(new Error('Network failure'));
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(true));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Hello');
    });

    // Assert: a santa-mode error message is added
    await waitFor(() => {
      const errorMsg = result.current.messages.find(
        (m) => m.role === 'model' && m.id.startsWith('error-')
      );
      expect(errorMsg).toBeDefined();
      expect(errorMsg?.text).toBeTruthy();
    });
  });

  it('handles non-ok response by adding an error message', async () => {
    // Arrange
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, body: null, status: 500 });
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Hello');
    });

    await waitFor(() => {
      const errorMsg = result.current.messages.find(
        (m) => m.role === 'model' && m.id.startsWith('error-')
      );
      expect(errorMsg).toBeDefined();
    });
  });

  it('handleSuggestionPress sends the suggestion text', async () => {
    // Arrange
    const mockFetch = jest.fn().mockResolvedValue(makeMockResponse('AI reply'));
    global.fetch = mockFetch;
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSuggestionPress('Track my order');
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    // Assert: user message with suggestion text exists
    const userMsg = result.current.messages.find(
      (m) => m.role === 'user' && m.text === 'Track my order'
    );
    expect(userMsg).toBeDefined();
  });

  it('does not send empty or whitespace-only messages', async () => {
    // Arrange
    const mockFetch = jest.fn();
    global.fetch = mockFetch;
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('   ');
    });

    // Assert: fetch was not called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sets isLoading to false after successful response', async () => {
    // Arrange
    global.fetch = jest.fn().mockResolvedValue(makeMockResponse('Done'));
    mockIsChatOpen = true;
    const { result } = renderHook(() => useChat(false));

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });

    // Act
    await act(async () => {
      result.current.handleSend('Hello');
    });

    // Assert: isLoading is false after completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });
});
