'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SANTA_GREETING } from '@/ai/prompts/santa';
import { ChatInput } from './chat-input';
import { ChatMessage } from './chat-message';
import type { ChatMessage as ChatMessageType } from './types';
import { WelcomeScreen } from './welcome-screen';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface SantaChatDialogProps {
  onClose?: () => void;
  isFullPage?: boolean;
}

/**
 * Main Santa Chat Dialog
 *
 * Uses manual fetch to the streaming API endpoint.
 * Can be used as a full-page experience or inside a modal/widget.
 */
export function SantaChatDialog({
  onClose,
  isFullPage = false,
}: SantaChatDialogProps) {
  const [showWelcome, setShowWelcome] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally trigger scroll when messages array changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStartChat = () => {
    setShowWelcome(false);
    // Add Santa's greeting
    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: SANTA_GREETING,
      },
    ]);
  };

  const sendMessage = useCallback(
    async (userMessage: string) => {
      if (!userMessage.trim()) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: userMessage,
      };

      // Add user message to state
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/chat/santa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to get response from Santa');
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let assistantContent = '';
        const assistantId = `assistant-${Date.now()}`;

        // Add empty assistant message
        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', content: '' },
        ]);

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Parse the streaming data format from Vercel AI SDK
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('0:')) {
                // Text content chunk
                try {
                  const text = JSON.parse(line.slice(2));
                  assistantContent += text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: assistantContent }
                        : m
                    )
                  );
                } catch {
                  // Ignore parse errors for non-JSON chunks
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('Santa chat error:', err);
        setError(
          "Oh dear, my elves are telling me there's a bit of a snowstorm interfering with our connection."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const handleSendMessage = (message: Omit<ChatMessageType, 'role'>) => {
    if (!message.content.trim() && !message.imageUrl) return;

    // For image messages, append a description
    const content = message.imageUrl
      ? 'I sent you a picture, Santa! What do you think?'
      : message.content;

    sendMessage(content);
  };

  if (showWelcome) {
    return (
      <div
        className={`${isFullPage ? 'h-screen w-screen' : 'h-full w-full rounded-2xl overflow-hidden'}`}
      >
        <WelcomeScreen onStart={handleStartChat} />
      </div>
    );
  }

  const containerClasses = isFullPage
    ? 'flex flex-col h-screen bg-gray-50'
    : 'flex flex-col h-full bg-gray-50 rounded-2xl overflow-hidden';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <header
        className="bg-red-600 p-4 text-white shadow-lg sticky top-0 z-10 flex items-center justify-between"
        style={{
          borderBottom: '4px solid #a4171d',
        }}
      >
        {/* Left: Back/Close button */}
        <div className="w-16">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close chat"
              className="p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
                className="w-6 h-6"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18 18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Title */}
        <div className="text-center">
          <h1
            className="text-2xl md:text-3xl tracking-wider"
            style={{
              fontFamily: '"Mountains of Christmas", cursive',
              textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }}
          >
            Santa&apos;s Workshop
          </h1>
          <p
            className="text-xs text-red-100"
            style={{ textShadow: '0 1px 3px rgba(0,0,0,0.4)' }}
          >
            by Ogabassey
          </p>
        </div>

        {/* Right: Cart icon placeholder */}
        <div className="w-16 flex items-center justify-end gap-2">
          <button type="button" aria-label="View Cart" className="p-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6v.75H5.513c-.96 0-1.763.746-1.858 1.705L3.11 18.238A3 3 0 0 0 6.077 21h11.846a3 3 0 0 0 2.967-2.762l-.545-9.783A1.875 1.875 0 0 0 18.487 6.75H16.5V6a4.5 4.5 0 0 0-9 0Zm1.5 0V6a3 3 0 0 1 6 0v.75H9Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto p-4 md:px-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              message={{
                role: msg.role,
                content: msg.content,
              }}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex justify-start my-2">
              <div className="flex gap-2 items-center">
                <Image
                  src="https://img.icons8.com/plasticine/100/santa.png"
                  alt="Santa"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
                <div
                  className="bg-red-100 p-3 rounded-t-xl rounded-br-xl shadow-md flex items-center"
                  style={{ minWidth: '4rem', height: '2.75rem' }}
                >
                  <div className="flex gap-2 items-center justify-center w-full text-2xl">
                    <span className="animate-pulse">✨</span>
                    <span className="animate-pulse delay-100">✨</span>
                    <span className="animate-pulse delay-200">✨</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="text-center text-red-500 my-4">{error}</div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input area */}
      <footer className="bg-white p-2 md:p-4 border-t sticky bottom-0">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </div>
      </footer>
    </div>
  );
}
