'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/cart';
import {
  parseSantaActions,
  stripSantaActions,
} from '@/components/storefront/santa-chat/types';
import { readSantaMerchantSlug } from '@/components/storefront/santa-chat/read-santa-merchant-slug';
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
  handleAddSantaWishToCart: (messageIndex: number, actionIndex?: number) => void;
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
): Promise<{ text: string; merchantSlug?: string }> {
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

  const merchantSlug = isSanta ? readSantaMerchantSlug(response) : null;

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

  return {
    text: aiResponseText,
    ...(merchantSlug ? { merchantSlug } : {}),
  };
}

export function useOgabasseyChat({ isSanta }: { isSanta: boolean }): UseOgabasseyChat {
  const { addToCart, setIsCartOpen, setMerchantSlug } = useCart();

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
      const chatReply = await requestChatReply(isSanta, history, messageText);
      const aiResponseText = chatReply.text;

      // Check if Santa granted wishes (parse every ACTION directive).
      let santaActions: SantaCartAction[] | undefined;
      if (isSanta) {
        const parsedActions = parseSantaActions(aiResponseText);
        if (parsedActions.length > 0) {
          santaActions = parsedActions.map((action) => ({
            productName: action.productName,
            price: action.price,
            added: false,
          }));
        }
      }

      // Clean the response text by removing Santa action directives for display.
      const displayText = stripSantaActions(aiResponseText);

      setMessages((prev) => [
        ...prev,
        {
          role: 'model',
          text: displayText,
          santaActions,
          ...(chatReply.merchantSlug
            ? { merchantSlug: chatReply.merchantSlug }
            : {}),
        },
      ]);
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

  const handleAddSantaWishToCart = (messageIndex: number, actionIndex = 0) => {
    const message = messages[messageIndex];
    const santaAction = Array.isArray(message?.santaActions)
      ? message.santaActions[actionIndex]
      : message?.santaAction;
    if (!santaAction || santaAction.added) return;

    const merchantSlug = message.merchantSlug;
    if (!merchantSlug) {
      console.error('[Santa Cart] Missing resolved merchant slug');
      return;
    }

    setMerchantSlug(merchantSlug);

    const santaProduct = {
      id: `santa-wish-${Date.now()}`,
      merchant_id: merchantSlug,
      name: santaAction.productName,
      description: `Santa's special Christmas wish - ${santaAction.productName}`,
      status: 'active' as const,
      price: santaAction.price,
      manage_stock: false,
      stock: 999,
      image: '/african-santa-head.svg',
      imageLarge: '/african-santa-head.svg',
      imageHint: 'Santa wish product',
      brand: merchantSlug,
      gtin: '',
      mpn: '',
      slug: 'santa-wish',
      images: [{ url: '/african-santa-head.svg', alt: 'Santa wish', order: 0 }],
    };

    addToCart(santaProduct, 1);

    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx === messageIndex
          ? {
              ...msg,
              // TODO(santa-actions): remove the legacy singular update once
              // all Ogabassey chat consumers read only `santaActions`.
              santaAction: !msg.santaActions && msg.santaAction
                ? { ...msg.santaAction, added: true }
                : msg.santaAction,
              santaActions: msg.santaActions?.map((action, index) =>
                index === actionIndex ? { ...action, added: true } : action
              ),
            }
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
