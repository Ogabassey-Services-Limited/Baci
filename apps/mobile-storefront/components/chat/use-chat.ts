import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { type FlatList, Platform, type TextInput } from 'react-native';
import { createLogger } from '@/lib/logger';
import { useUIStore } from '@/stores/ui-store';
import { API_BASE_URL } from './constants';
import type { ChatMessage } from './types';

const log = createLogger('ChatWidget');

export function useChat(santaMode: boolean) {
  const isChatOpen = useUIStore((state) => state.isChatOpen);
  const chatInitialMessage = useUIStore((state) => state.chatInitialMessage);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const flatListRef = useRef<FlatList>(null);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
      const _timeoutId = setTimeout(() => controller.abort(), 30_000);

      // Capture history before setMessages so concurrent renders can't duplicate
      const currentMessages = messagesRef.current;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            messages: [
              ...currentMessages.map((m) => ({
                role: m.role === 'model' ? 'assistant' : 'user',
                content: m.text,
              })),
              { role: 'user', content: messageText },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error('Chat service unavailable');
        }

        // Parse streaming response — plain text from toTextStreamResponse / text/plain
        reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let aiResponseText = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            aiResponseText += decoder.decode(value, { stream: true });
          }
          // Flush any remaining multi-byte characters held in the decoder buffer
          aiResponseText += decoder.decode();
        }

        // Clean response text (sanitizeHtml not needed — RN <Text> doesn't execute HTML)
        const displayText = aiResponseText
          .replace(/ACTION:ADD_TO_CART\|PRODUCT:[^|]+\|PRICE:[^\s]+/g, '')
          .trim();

        const aiMessage: ChatMessage = {
          id: `ai-${++_msgCounter.current}`,
          role: 'model',
          text: displayText || 'I apologize, I could not process that request.',
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, aiMessage]);

        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          ).catch(() => {});
        }
      } finally {
        clearTimeout(_timeoutId);
        reader?.cancel();
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
      const msg = chatInitialMessage;

      const timer = setTimeout(() => {
        handleSendRef.current(msg);
        useUIStore.getState().clearChatInitialMessage();
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
