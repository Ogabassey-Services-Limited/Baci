import type { FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Platform, type TextInput } from 'react-native';
import { createLogger } from '@/lib/logger';
import { useUIStore } from '@/stores/ui-store';
import { API_BASE_URL, CHAT_REQUEST_TIMEOUT_MS } from './constants';
import { readChatResponseText } from './read-chat-response';
import type { ChatMessage } from './types';

const log = createLogger('ChatWidget');

export function useChat(santaMode: boolean) {
  const isChatOpen = useUIStore((state) => state.isChatOpen);
  const chatInitialMessage = useUIStore((state) => state.chatInitialMessage);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const flatListRef = useRef<FlashListRef<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const _msgCounter = useRef(0);

  // H23 fix: Keep a ref of messages so handleSend always reads fresh data
  const messagesRef = useRef<ChatMessage[]>(messages);
  messagesRef.current = messages;

  // Stable ref for isLoading so handleSend reads fresh value without re-creating
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Stable ref for santaMode so handleSend doesn't re-create on prop change
  const santaModeRef = useRef(santaMode);
  santaModeRef.current = santaMode;

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Initialize with welcome message
  useEffect(() => {
    if (isChatOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: santaMode
            ? 'Ho ho ho! How can Santa AI help you today?'
            : 'Hello! How can I help you today?',
          timestamp: new Date(),
        },
      ]);
    }
  }, [isChatOpen, messages.length, santaMode]);

  // Stable handleSend via ref pattern — reads all volatile state from refs
  // so the function identity never changes and useEffect deps stay stable.
  const handleSendRef = useRef(async (messageText: string) => {
    if (!messageText.trim() || isLoadingRef.current) return;

    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
        () => undefined
      );
    }

    const userMessage: ChatMessage = {
      id: `user-${++_msgCounter.current}`,
      role: 'user',
      text: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    scrollToBottom();

    try {
      const isSanta = santaModeRef.current;
      const endpoint = isSanta
        ? `${API_BASE_URL}/api/chat/santa`
        : `${API_BASE_URL}/api/chat`;

      const controller = new AbortController();
      const _timeoutId = setTimeout(
        () => controller.abort(),
        CHAT_REQUEST_TIMEOUT_MS
      );

      // Capture history before setMessages so concurrent renders can't duplicate
      const currentMessages = messagesRef.current;
      try {
        const requestBody = {
          messages: [
            ...currentMessages.map((m) => ({
              role: m.role === 'model' ? 'assistant' : 'user',
              content: m.text,
            })),
            { role: 'user', content: messageText },
          ],
        };

        const sendRequest = async () => {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'text/plain',
              'Cache-Control': 'no-cache',
            },
            signal: controller.signal,
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            throw new Error(`Chat service unavailable (${response.status})`);
          }

          const text = await readChatResponseText(response);
          log.info('Chat response received', {
            endpoint,
            status: response.status,
            length: text.length,
          });

          return text;
        };

        let aiResponseText = await sendRequest();

        if (!aiResponseText) {
          log.warn('Empty chat response, retrying once', { endpoint });
          aiResponseText = await sendRequest();
        }

        if (!aiResponseText) {
          throw new Error('Empty chat response');
        }

        // Clean response text (sanitizeHtml not needed — RN <Text> doesn't execute HTML)
        const displayText = aiResponseText
          .replace(/ACTION:ADD_TO_CART\|PRODUCT:[^|]+\|PRICE:[^\s]+/g, '')
          .trim();

        const aiMessage: ChatMessage = {
          id: `ai-${++_msgCounter.current}`,
          role: 'model',
          text: displayText,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => undefined);
        }
      } finally {
        clearTimeout(_timeoutId);
      }
    } catch (error) {
      log.error('Chat error:', error);

      const isSanta = santaModeRef.current;
      const errorMessage: ChatMessage = {
        id: `error-${++_msgCounter.current}`,
        role: 'model',
        text: isSanta
          ? "Ho ho ho! Santa's workshop is a bit busy right now. Please try again!"
          : "I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  });

  const handleSend = (messageText: string) => {
    handleSendRef.current(messageText);
  };

  // Auto-send initial message if provided by UIStore
  useEffect(() => {
    if (
      isChatOpen &&
      chatInitialMessage &&
      messages.length === 1 &&
      !isLoading
    ) {
      // Clear synchronously first to prevent double-fire if effect re-evaluates
      // during the 500ms delay (e.g. from isLoading or messages.length changes)
      const msg = chatInitialMessage;
      useUIStore.getState().clearChatInitialMessage();

      const timer = setTimeout(() => {
        handleSendRef.current(msg);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chatInitialMessage, isChatOpen, isLoading, messages.length]);

  const handleSuggestionPress = (suggestion: string) => {
    handleSend(suggestion);
  };

  return {
    messages,
    input,
    setInput,
    isLoading,
    flatListRef,
    inputRef,
    handleSend,
    handleSuggestionPress,
    scrollToBottom,
  };
}
