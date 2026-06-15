'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/cart';
import {
  parseSantaAction,
  stripSantaActions,
} from '@/components/storefront/santa-chat/types';
import type { ChatMessage, SantaCartAction } from './types';
import { PROACTIVE_MESSAGES } from './types';

const OGABASSEY_CHAT_SESSION_STORAGE_KEY = 'ogabassey_chat_session_id';

interface UseOgabasseyChat {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  proactiveMsg: string | null;
  setProactiveMsg: (msg: string | null) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  handleSend: (messageText: string) => Promise<void>;
  handleSubmit: (e: React.FormEvent) => void;
  handleAddSantaWishToCart: (messageIndex: number) => void;
}

function createChatSessionId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `og_chat_${globalThis.crypto.randomUUID()}`;
  }

  return `og_chat_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function getOrCreateChatSessionId(): string {
  if (typeof window === 'undefined') {
    return createChatSessionId();
  }

  const storedSessionId = window.localStorage.getItem(
    OGABASSEY_CHAT_SESSION_STORAGE_KEY
  );
  if (storedSessionId) {
    return storedSessionId;
  }

  const sessionId = createChatSessionId();
  window.localStorage.setItem(OGABASSEY_CHAT_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

// Module-scope helper so the try/finally + throw statements stay outside the
// hook body (React Compiler cannot lower those constructs in components/hooks).
async function requestChatReply(
  isSanta: boolean,
  history: ChatMessage[],
  messageText: string
): Promise<string> {
  const endpoint = isSanta ? '/api/chat/santa' : '/api/chat';
  const requestBody = {
    ...(!isSanta ? { sessionId: getOrCreateChatSessionId() } : {}),
    messages: [
      ...history.map((m) => ({
        role: m.role === 'model' ? 'assistant' : 'user',
        content: m.text,
      })),
      { role: 'user', content: messageText },
    ],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error('Chat service unavailable');
  }

  // Parse streaming text response
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let aiResponseText = '';

  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiResponseText += decoder.decode(value, { stream: true });
      }
      // Flush any remaining multi-byte characters held in the decoder buffer
      aiResponseText += decoder.decode();
    }
  } finally {
    reader?.cancel();
  }

  return aiResponseText;
}

export function useOgabasseyChat({ isSanta }: { isSanta: boolean }): UseOgabasseyChat {
  const { addToCart, setIsCartOpen } = useCart();

  const [isOpen, setIsOpenState] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [proactiveMsg, setProactiveMsg] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Proactive Nudge Logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isOpen) {
        const randomMsg = PROACTIVE_MESSAGES[Math.floor(Math.random() * PROACTIVE_MESSAGES.length)];
        setProactiveMsg(randomMsg);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Opening the chat is a user event: hide the proactive nudge and seed the
  // welcome message here instead of reacting to `isOpen` in effects.
  const setIsOpen = (open: boolean) => {
    if (open) {
      setProactiveMsg(null);
      setMessages((prev) =>
        prev.length > 0
          ? prev
          : [
              {
                role: 'model',
                text: isSanta
                  ? 'Ho ho ho! How can Santa AI help you today?'
                  : 'Hello! How can I help you today?',
              },
            ]
      );
    }
    setIsOpenState(open);
  };

  // Ref to always read fresh messages (avoids stale closure in handleSend)
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const handleSend = async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;

    const newMessage: ChatMessage = { role: 'user', text: messageText };
    // Capture history before state update to avoid duplication in concurrent renders
    const history = messagesRef.current;
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiResponseText = await requestChatReply(isSanta, history, messageText);

      // Check if Santa granted a wish (parse the ACTION pattern)
      let santaAction: SantaCartAction | undefined;
      if (isSanta) {
        const action = parseSantaAction(aiResponseText);
        if (action) {
          santaAction = {
            productName: action.productName,
            price: action.price,
            added: false,
          };
        }
      }

      // Clean the response text by removing Santa action directives for display.
      const displayText = stripSantaActions(aiResponseText);

      setMessages((prev) => [...prev, { role: 'model', text: displayText, santaAction }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: isSanta
            ? "Ho ho ho! Santa's workshop is a bit busy right now. Please try again!"
            : "I'm having trouble connecting right now. Please try again later.",
        },
      ]);
    }
    setIsLoading(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleAddSantaWishToCart = (messageIndex: number) => {
    const message = messages[messageIndex];
    if (!message?.santaAction || message.santaAction.added) return;

    const santaProduct = {
      id: `santa-wish-${Date.now()}`,
      merchant_id: 'ogabassey',
      name: message.santaAction.productName,
      description: `Santa's special Christmas wish - ${message.santaAction.productName}`,
      status: 'active' as const,
      price: message.santaAction.price,
      manage_stock: false,
      stock: 999,
      image: '/african-santa-head.svg',
      imageLarge: '/african-santa-head.svg',
      imageHint: 'Santa wish product',
      brand: 'Ogabassey',
      gtin: '',
      mpn: '',
      slug: 'santa-wish',
      images: [{ url: '/african-santa-head.svg', alt: 'Santa wish', order: 0 }],
    };

    addToCart(santaProduct, 1);

    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === messageIndex && msg.santaAction
          ? { ...msg, santaAction: { ...msg.santaAction, added: true } }
          : msg
      )
    );

    setIsCartOpen(true);
  };

  return {
    isOpen,
    setIsOpen,
    messages,
    input,
    setInput,
    isLoading,
    proactiveMsg,
    setProactiveMsg,
    messagesEndRef,
    handleSend,
    handleSubmit,
    handleAddSantaWishToCart,
  };
}
