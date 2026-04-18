'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/hooks/cart';
import { parseSantaAction } from '@/components/storefront/santa-chat/types';
import type { ChatMessage, SantaCartAction } from './types';
import { PROACTIVE_MESSAGES } from './types';

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

export function useOgabasseyChat({ isSanta }: { isSanta: boolean }): UseOgabasseyChat {
  const { addToCart, setIsCartOpen } = useCart();

  const [isOpen, setIsOpen] = useState(false);
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

  // Hide proactive message when chat opens
  useEffect(() => {
    if (isOpen) setProactiveMsg(null);
  }, [isOpen]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          role: 'model',
          text: isSanta
            ? 'Ho ho ho! How can Santa AI help you today?'
            : 'Hello! How can I help you today?',
        },
      ]);
    }
  }, [isOpen, messages.length, isSanta]);

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

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      const endpoint = isSanta ? '/api/chat/santa' : '/api/chat';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...history.map((m) => ({
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

      // Parse streaming text response
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

      // Clean the response text by removing the ACTION pattern for display
      const displayText = aiResponseText
        .replace(/ACTION:ADD_TO_CART\|PRODUCT:[^|]+\|PRICE:[^\s]+/g, '')
        .trim();

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
    } finally {
      reader?.cancel();
      setIsLoading(false);
    }
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
