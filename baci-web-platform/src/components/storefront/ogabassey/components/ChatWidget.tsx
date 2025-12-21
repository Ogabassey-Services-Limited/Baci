'use client';

import {
  Gift,
  Headphones,
  Send,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Truck,
  User,
  X,
  Zap,
} from 'lucide-react';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCart } from '@/hooks/use-cart';
import { parseCartAction } from '@/components/storefront/santa-chat/types';
import { useV2Theme } from '../providers/v2-theme-context';

/**
 * Validates if a URL is safe for usage (http/https/mailto only)
 */
function isSafeUrl(url: string): boolean {
  try {
    const protocol = new URL(url, 'http://dummy.com').protocol;
    return ['http:', 'https:', 'mailto:'].includes(protocol);
  } catch {
    return false;
  }
}

/**
 * Escapes HTML entities to prevent XSS when rendering user/AI text.
 * This ensures text content is safe before being placed in React nodes.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Enhanced markdown renderer for chat messages (2025 standards).
 * Supports: **bold**, *list items, [links](url), ![images](url), and line breaks.
 * All text content is escaped to prevent XSS attacks.
 */
function renderMarkdown(text: string): React.ReactNode {
  if (!text) return null;

  // Split by lines first
  const lines = text.split('\n');

  return lines.map((line, lineIndex) => {
    // Check if line is a list item (starts with * or -)
    const isListItem = /^\s*[*-]\s+/.test(line);
    const cleanLine = isListItem ? line.replace(/^\s*[*-]\s+/, '') : line;

    // Parse inline elements (images, links, bold) - all text is escaped
    const parseInline = (content: string): React.ReactNode[] => {
      const elements: React.ReactNode[] = [];
      let remaining = content;
      let keyIndex = 0;
      const maxIterations = 1000; // Prevent infinite loops
      let iterations = 0;

      while (remaining.length > 0 && iterations < maxIterations) {
        iterations++;

        // Check for image: ![alt](url)
        const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (imgMatch) {
          const src = imgMatch[2];
          // Escape alt text and validate URL
          const altText = escapeHtml(imgMatch[1] || 'Image');
          if (isSafeUrl(src)) {
            elements.push(
              <img
                key={`${lineIndex}-img-${keyIndex++}`}
                src={src}
                alt={altText}
                className="max-w-full rounded-lg my-2 shadow-sm border border-gray-100"
                loading="lazy"
              />
            );
          }
          remaining = remaining.slice(imgMatch[0].length);
          continue;
        }

        // Check for link: [text](url)
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          const href = linkMatch[2];
          const linkText = escapeHtml(linkMatch[1]);
          // Only allow safe protocols
          if (isSafeUrl(href)) {
            elements.push(
              <a
                key={`${lineIndex}-link-${keyIndex++}`}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-600 underline hover:text-red-700 font-medium"
              >
                {linkText}
              </a>
            );
          } else {
            // Fallback to escaped text if unsafe URL
            elements.push(linkText);
          }
          remaining = remaining.slice(linkMatch[0].length);
          continue;
        }

        // Check for bold: **text**
        const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
        if (boldMatch) {
          elements.push(
            <strong key={`${lineIndex}-bold-${keyIndex++}`} className="font-semibold">
              {escapeHtml(boldMatch[1])}
            </strong>
          );
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Find next special pattern
        const nextPattern = remaining.search(/!\[|\[|\*\*/);
        if (nextPattern === -1) {
          // No more patterns, escape and push remaining text
          if (remaining) elements.push(escapeHtml(remaining));
          break;
        } else if (nextPattern > 0) {
          // Push escaped text before the pattern
          elements.push(escapeHtml(remaining.slice(0, nextPattern)));
          remaining = remaining.slice(nextPattern);
        } else {
          // Pattern at start but didn't match, push first char escaped
          elements.push(escapeHtml(remaining[0]));
          remaining = remaining.slice(1);
        }
      }

      return elements;
    };

    const renderedParts = parseInline(cleanLine);

    if (isListItem) {
      return (
        <div key={lineIndex} className="flex items-start gap-2 my-1">
          <span className="text-red-600 mt-0.5 flex-shrink-0">•</span>
          <span className="flex-1">{renderedParts}</span>
        </div>
      );
    }

    // Empty lines create spacing
    if (!cleanLine.trim()) {
      return <div key={lineIndex} className="h-2" />;
    }

    return <div key={lineIndex}>{renderedParts}</div>;
  });
}

interface SantaCartAction {
  productName: string;
  price: number;
  added: boolean;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  santaAction?: SantaCartAction;
}

const SUGGESTIONS = [
  {
    label: 'Track my order',
    icon: <Truck size={14} className="text-red-600" />,
  },
  {
    label: 'Best gaming phones',
    icon: <Zap size={14} className="text-red-600" />,
  },
  {
    label: 'Return policy',
    icon: <ShoppingBag size={14} className="text-red-600" />,
  },
  {
    label: 'Contact support',
    icon: <Headphones size={14} className="text-red-600" />,
  },
];

const SnowOverlay: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
    <style jsx>{`
      @keyframes snowfall {
        0% { transform: translateY(-10px) translateX(0); opacity: 0; }
        10% { opacity: 1; }
        100% { transform: translateY(100vh) translateX(20px); opacity: 0; }
      }
      .snowflake {
        position: absolute;
        top: -10px;
        color: #e2e8f0;
        animation: snowfall linear infinite;
      }
    `}</style>
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="snowflake"
        style={{
          left: `${Math.random() * 100}%`,
          animationDuration: `${5 + Math.random() * 5}s`,
          animationDelay: `${Math.random() * 5}s`,
          fontSize: `${10 + Math.random() * 10}px`,
          opacity: 0.3 + Math.random() * 0.4
        }}
      >
        ❄
      </div>
    ))}
  </div>
);

const SantaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${className} bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-sm`}>
    🎅
  </div>
);

export const ChatWidget: React.FC = () => {
  const { isCartOpen, addToCart, setIsCartOpen } = useCart();
  const { theme } = useV2Theme();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Note: The mounted state workaround was removed because the theme is now passed
  // from the server via cookies, ensuring SSR/CSR consistency.
  const isSanta = theme === 'santa';

  // Dynamic bottom positioning based on page type
  // - Product pages: Add-to-cart bar + bottom nav = bottom-44 (176px)
  // - Cart page: Checkout button + bottom nav = bottom-36 (144px)
  // - Default pages: Just bottom nav = bottom-24 (96px)
  const isProductPage = pathname?.match(/\/[^/]+\/[^/]+\/[^/]+/) && !pathname?.includes('/cart') && !pathname?.includes('/checkout');
  const isCartPage = pathname?.includes('/cart');

  const mobileBottomClass = isProductPage
    ? 'bottom-44'
    : isCartPage
      ? 'bottom-36'
      : 'bottom-24';

  // Handle adding Santa's wish to cart
  const handleAddSantaWishToCart = useCallback(
    (messageIndex: number) => {
      const message = messages[messageIndex];
      if (!message?.santaAction || message.santaAction.added) return;

      // Create a product object for the cart with all required fields
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

      // Mark as added
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx === messageIndex && msg.santaAction
            ? { ...msg, santaAction: { ...msg.santaAction, added: true } }
            : msg
        )
      );

      // Open cart sidebar
      setIsCartOpen(true);
    },
    [messages, addToCart, setIsCartOpen]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const handleSend = async (messageText: string) => {
    if (!messageText.trim()) return;

    const newMessage: ChatMessage = { role: 'user', text: messageText };
    setMessages((prev) => [...prev, newMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const endpoint = isSanta ? '/api/chat/santa' : '/api/chat';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({
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
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiResponseText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          aiResponseText += chunk;

          // Optional: Update UI incrementally if desired, but for now we wait for full response
          // or update the last message in place (requires changing state structure slightly)
        }
      }

      // Check if Santa granted a wish (parse the ACTION pattern)
      let santaAction: SantaCartAction | undefined;
      if (isSanta) {
        const action = parseCartAction(aiResponseText);
        if (action) {
          // Parse price - remove currency symbols and commas
          const priceStr = action.price.replace(/[₦,N\s]/g, '');
          const price = Number.parseInt(priceStr, 10) || 0;
          santaAction = {
            productName: action.product,
            price,
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
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div
      className={`fixed ${mobileBottomClass} md:bottom-4 right-4 z-50 flex flex-col items-end gap-4 ${isCartOpen ? 'hidden' : ''}`}
    >
      {/* Chat Window */}
      {
        isOpen && (
          <div
            className={`w-[calc(100vw-32px)] md:w-[400px] h-[calc(100vh-120px)] md:h-[600px] max-h-[calc(100vh-120px)] md:max-h-[600px] bg-white rounded-2xl shadow-2xl border ${isSanta ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom-right ring-1 ring-black/5`}
          >
            {/* Header */}
            <div
              className={`relative flex items-center justify-between p-4 border-b ${isSanta
                ? 'bg-red-600 text-white border-red-500'
                : 'bg-white text-gray-800 border-gray-100'
                }`}
            >
              {/* Santa Festive Pattern Overlay */}
              {isSanta && (
                <div
                  className="absolute inset-0 opacity-10 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 50% 120%, rgba(255, 255, 255, 0.4) 10%, transparent 80%)'
                  }}
                />
              )}

              <div className="relative z-10 flex items-center gap-3">
                {isSanta ? (
                  <img
                    src="/african-santa-head.svg"
                    alt="Santa"
                    className="w-9 h-9 object-contain rounded-full border-2 border-red-400"
                  />
                ) : (
                  <Sparkles size={24} className="text-red-600" />
                )}
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-1">
                    {isSanta ? (
                      <>
                        Santa AI <span className="text-xs ml-1">🎄</span>
                      </>
                    ) : 'Ogabassey AI'}
                  </h3>
                  <p
                    className={`text-xs ${isSanta ? 'text-red-100' : 'text-gray-500'}`}
                  >
                    Online
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className={`relative z-10 p-2 rounded-full ${isSanta ? 'hover:bg-red-700/50' : 'hover:bg-gray-100'} transition-colors`}
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className={`flex-1 overflow-y-auto p-4 scroll-smooth relative ${isSanta ? 'bg-[#FFF5F5]' : 'bg-[#F8F9FA]'}`}>

              <div className="space-y-6 relative z-10">
                <div className="text-center">
                  <span className={`text-[10px] font-medium uppercase tracking-widest px-3 py-1 rounded-full ${isSanta ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                    Today
                  </span>
                </div>

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-end gap-2 group ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-gray-200 text-gray-600 hidden' : 'bg-white border border-gray-100 text-red-600'}`}
                    >
                      {msg.role === 'user' ? (
                        <User size={14} className="text-red-600" />
                      ) : isSanta ? (
                        <SantaIcon className="w-6 h-6" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className="flex flex-col gap-1 max-w-[85%]">
                      <span
                        className={`text-[10px] text-gray-400 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
                      >
                        {msg.role === 'user'
                          ? 'You'
                          : isSanta
                            ? 'Santa AI'
                            : 'Ogabassey AI'}
                      </span>
                      <div
                        className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap ${msg.role === 'user'
                          ? 'bg-red-600 text-white rounded-tr-none shadow-red-100'
                          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
                          }`}
                      >
                        {renderMarkdown(msg.text)}

                        {/* Santa Wish Granted - Add to Cart Button */}
                        {msg.santaAction && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <div className="flex items-center gap-2 mb-2">
                              <Gift size={16} className="text-green-600" />
                              <span className="text-xs font-semibold text-green-700">
                                Wish Granted!
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 mb-2">
                              <span className="font-medium">{msg.santaAction.productName}</span>
                              <br />
                              <span className="text-green-600 font-bold">
                                ₦{msg.santaAction.price.toLocaleString()}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddSantaWishToCart(idx)}
                              disabled={msg.santaAction.added}
                              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${msg.santaAction.added
                                ? 'bg-green-100 text-green-700 cursor-default'
                                : 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]'
                                }`}
                            >
                              {msg.santaAction.added ? (
                                <>
                                  <ShoppingCart size={16} />
                                  Added to Cart!
                                </>
                              ) : (
                                <>
                                  <ShoppingCart size={16} />
                                  Add to Cart & Checkout
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start animate-in fade-in zoom-in duration-300">
                    <div className={`rounded-2xl rounded-tl-none px-4 py-3 shadow-sm ${isSanta ? 'bg-white border border-red-100' : 'bg-white border border-gray-100'
                      }`}>
                      <div className="flex gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isSanta ? 'bg-red-400' : 'bg-gray-400'}`} style={{ animationDelay: '0ms' }} />
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isSanta ? 'bg-red-400' : 'bg-gray-400'}`} style={{ animationDelay: '150ms' }} />
                        <span className={`w-1.5 h-1.5 rounded-full animate-bounce ${isSanta ? 'bg-red-400' : 'bg-gray-400'}`} style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <form
              onSubmit={handleSubmit}
              className={`p-4 border-t ${isSanta ? 'bg-[#FFF5F5] border-red-100' : 'bg-white border-gray-100'}`}
            >
              {messages.length < 3 && !isLoading && (
                <div className="flex gap-2 overflow-x-auto pb-3 pt-1 hide-scrollbar">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => handleSend(s.label)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-gray-200 rounded-full text-xs font-medium text-gray-600 transition-colors whitespace-nowrap shrink-0"
                    >
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isSanta ? "Tell Santa your wish..." : "Type your message..."}
                  className={`flex-1 px-4 py-2.5 rounded-full border focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all text-sm ${isSanta
                    ? 'border-red-200 focus:border-red-400 focus:ring-red-100 bg-white placeholder:text-red-300'
                    : 'border-gray-200 focus:border-red-600 focus:ring-red-50'
                    }`}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className={`p-2.5 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm flex items-center justify-center w-10 h-10 ${isSanta
                    ? 'bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95'
                    : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                  {isSanta ? <Gift size={18} /> : <Send size={18} />}
                </button>
              </div>
            </form>
            <div className="text-center mt-2">
              <p className="text-[10px] text-gray-300">
                Powered by Google Gemini • AI can make mistakes.
              </p>
            </div>
          </div>
        )}

      {/* Floating Toggle Button */}
      <div className="relative group">
        {!isOpen && isSanta && (
          <div className="absolute bottom-[90%] right-[85%] mr-[-20px] mb-[-10px] w-32 bg-white px-4 py-3 rounded-2xl rounded-tr-none shadow-xl border-2 border-red-100 transform transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
            <p className="text-sm font-bold text-gray-900 text-center leading-tight">Make a wish! ✨</p>
            {/* Thought bubble tail circles - adjusted for bottom-right origin */}
            <div className="absolute -bottom-2 -right-1 w-3 h-3 bg-white rounded-full border-r border-b border-red-100"></div>
            <div className="absolute -bottom-4 -right-3 w-2 h-2 bg-white/90 rounded-full border border-red-50"></div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-500 hover:scale-110 group relative ${isOpen
            ? 'bg-gray-900 text-white rotate-90 shadow-xl border border-gray-100'
            : isSanta
              ? 'bg-transparent border-none shadow-none text-red-600'
              : 'bg-white/60 backdrop-blur-md text-red-600 hover:bg-white hover:border-red-100 shadow-xl border border-gray-100'
            }`}
          aria-label="Toggle chat"
        >
          {isOpen ? (
            <X size={28} />
          ) : (
            <>
              {isSanta ? (
                <div className="relative w-full h-full">
                  <img
                    src="/african-santa-head.svg"
                    alt="Santa"
                    className="w-full h-full object-contain drop-shadow-xl hover:brightness-110 transition-all filter"
                  />
                </div>
              ) : (
                <Sparkles
                  size={28}
                  className="md:w-8 md:h-8 drop-shadow-sm"
                  fill="currentColor"
                  fillOpacity={0.1}
                />
              )}
              <span className="absolute -top-1 -right-1 flex h-4 w-4 z-10">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-600 text-[9px] font-bold text-white items-center justify-center shadow-sm border border-white">
                  AI
                </span>
              </span>
            </>
          )}
        </button>
      </div>
    </div >
  );
};
