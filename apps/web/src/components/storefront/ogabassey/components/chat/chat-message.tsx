'use client';

import { Gift, ShoppingCart, Sparkles, User } from 'lucide-react';
import type React from 'react';
import type { ChatMessage } from './types';
import { renderMarkdown } from './markdown-renderer';

const SantaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <div
    className={`${className} bg-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs border-2 border-white shadow-sm`}
  >
    {'\u{1F385}'}
  </div>
);

interface ChatMessageBubbleProps {
  message: ChatMessage;
  index: number;
  isSanta: boolean;
  onAddToCart: (index: number) => void;
}

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  index,
  isSanta,
  onAddToCart,
}) => {
  return (
    <div
      className={`flex items-end gap-2 group ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${message.role === 'user' ? 'bg-gray-200 text-gray-600 hidden' : 'bg-white border border-gray-100 text-red-600'}`}
      >
        {message.role === 'user' ? (
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
          className={`text-[10px] text-gray-400 px-1 ${message.role === 'user' ? 'text-right' : 'text-left'}`}
        >
          {message.role === 'user' ? 'You' : isSanta ? 'Santa AI' : 'Ogabassey AI'}
        </span>
        <div
          className={`px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm whitespace-pre-wrap ${message.role === 'user'
            ? 'bg-red-600 text-white rounded-tr-none shadow-red-100'
            : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none'
          }`}
        >
          {renderMarkdown(message.text)}

          {/* Santa Wish Granted - Add to Cart Button */}
          {message.santaAction && (
            <div className="mt-3 pt-3 border-t border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Gift size={16} className="text-green-600" />
                <span className="text-xs font-semibold text-green-700">Wish Granted!</span>
              </div>
              <div className="text-sm text-gray-600 mb-2">
                <span className="font-medium">{message.santaAction.productName}</span>
                <br />
                <span className="text-green-600 font-bold">
                  {'\u20A6'}
                  {message.santaAction.price.toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onAddToCart(index)}
                disabled={message.santaAction.added}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${message.santaAction.added
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-green-600 text-white hover:bg-green-700 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <ShoppingCart size={16} />
                {message.santaAction.added ? 'Added to Cart!' : 'Add to Cart & Checkout'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
