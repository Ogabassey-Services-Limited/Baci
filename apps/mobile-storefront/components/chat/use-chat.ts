import type { FlashListRef } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, type TextInput } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '@/stores/ui-store';
import { requestChatReply } from './request-chat-reply';
import type { ChatMessage } from './types';
import { resolveSuggestionRoute, SUGGESTIONS } from './types';

function createWelcomeMessage(santaMode: boolean): ChatMessage {
  return {
    id: 'welcome',
    role: 'model',
    text: santaMode
      ? 'Ho ho ho! How can Santa AI help you today?'
      : 'Hello! How can I help you today?',
    timestamp: new Date(),
  };
}

export function useChat(santaMode: boolean) {
  const { isChatOpen, chatInitialMessage } = useUIStore(
    useShallow((state) => ({
      isChatOpen: state.isChatOpen,
      chatInitialMessage: state.chatInitialMessage,
    }))
  );

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const flatListRef = useRef<FlashListRef<ChatMessage>>(null);
  const inputRef = useRef<TextInput>(null);
  const _msgCounter = useRef(0);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Seed the welcome message inline during render when the chat first opens
  // (react.dev: "Adjusting some state when a prop changes"). The guard on
  // messages.length makes the adjustment converge after one re-render.
  if (isChatOpen && messages.length === 0) {
    setMessages([createWelcomeMessage(santaMode)]);
  }

  const handleSend = (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

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

    // `messages` is the history BEFORE the user message above — the helper
    // appends `messageText` itself, so concurrent renders can't duplicate it.
    void requestChatReply({
      createMessageId: (prefix) => `${prefix}-${++_msgCounter.current}`,
      history: messages,
      messageText,
      santaMode,
      scrollToBottom,
      setIsLoading,
      setMessages,
    });
  };

  // Latest-closure ref so the auto-send effect below keeps a stable dependency
  // set; updated in an effect (never during render).
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

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
    // Chips with a `route` (e.g. "Repair quote") deep-link to a storefront
    // screen instead of sending the label as a chat message.
    const match = SUGGESTIONS.find((entry) => entry.label === suggestion);
    const route = match ? resolveSuggestionRoute(match) : null;
    if (route) {
      router.push(route);
      return;
    }

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
