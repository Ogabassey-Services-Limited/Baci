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
import { useCart } from '@/hooks/use-cart';
import { parseCartAction } from '@/components/storefront/santa-chat/types';
import { useV2Theme } from '../providers/v2-theme-context';

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

const SantaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`${className} bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs`}>
    🎅
  </div>
);

export const ChatWidget: React.FC = () => {
  const { isCartOpen, addToCart, setIsCartOpen } = useCart();
  const { theme } = useV2Theme();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Note: The mounted state workaround was removed because the theme is now passed
  // from the server via cookies, ensuring SSR/CSR consistency.
  const isSanta = theme === 'santa';

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
      className={`fixed bottom-24 md:bottom-4 right-4 z-50 flex flex-col items-end gap-4 ${isCartOpen ? 'hidden' : ''}`}
    >
      {/* Chat Window */}
      {
        isOpen && (
          <div
            className={`w-[calc(100vw-32px)] md:w-[400px] h-[calc(100vh-120px)] md:h-[600px] max-h-[calc(100vh-120px)] md:max-h-[600px] bg-white rounded-2xl shadow-2xl border ${isSanta ? 'border-red-200' : 'border-gray-200'} overflow-hidden flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300 origin-bottom-right ring-1 ring-black/5`}
          >
            {/* Header */}
            <div
              className={`flex items-center justify-between p-4 border-b ${isSanta ? 'bg-red-600 text-white border-red-500' : 'bg-white text-gray-800 border-gray-100'}`}
            >
              <div className="flex items-center gap-3">
                {isSanta ? (
                  <img
                    src="/african-santa-head.svg"
                    alt="Santa"
                    className="w-9 h-9 object-contain rounded-full"
                  />
                ) : (
                  <Sparkles size={24} className="text-red-600" />
                )}
                <div>
                  <h3 className="text-base font-semibold">
                    {isSanta ? 'Santa AI' : 'Ogabassey AI'}
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
                className={`p-2 rounded-full ${isSanta ? 'hover:bg-red-700' : 'hover:bg-gray-100'} transition-colors`}
                aria-label="Close chat"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#F8F9FA] scroll-smooth relative">
              {/* Background decoration for Santa theme - using CSS gradient instead of remote image */}
              {isSanta && (
                <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-b from-red-100 to-transparent" />
              )}

              <div className="space-y-6 relative z-10">
                <div className="text-center">
                  <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full">
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
                        {msg.text}

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
                  <div className="flex items-end gap-2">
                    <div className="w-8 h-8 rounded-full bg-white border border-gray-100 text-red-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                      {isSanta ? (
                        <SantaIcon className="w-6 h-6" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </div>
                    <div className="bg-white border border-gray-100 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Footer Area */}
            <div className="bg-white border-t border-gray-100 p-4 pt-2">
              {/* Suggestion Chips */}
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

              {/* Human Handoff Button */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 py-2 rounded-lg transition-colors mb-2 group"
              >
                <Headphones
                  size={14}
                  className="text-red-600 group-hover:scale-110 transition-transform"
                />
                Connect with Human Support
              </button>

              {/* Input Bar */}
              <form
                onSubmit={handleSubmit}
                className="relative flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a question..."
                  className="w-full bg-gray-100 text-gray-900 placeholder-gray-500 rounded-full pl-5 pr-12 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:bg-white border border-transparent focus:border-red-100 transition-all shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 top-1.5 w-9 h-9 bg-red-600 text-white rounded-full flex items-center justify-center hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none cursor-pointer transition-all"
                  aria-label="Send message"
                >
                  <Send
                    size={16}
                    className={input.trim() ? 'translate-x-0.5' : ''}
                  />
                </button>
              </form>
              <div className="text-center mt-2">
                <p className="text-[10px] text-gray-300">
                  Powered by Google Gemini • AI can make mistakes.
                </p>
              </div>
            </div>
          </div>
        )
      }

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
    </div>
  );
};
