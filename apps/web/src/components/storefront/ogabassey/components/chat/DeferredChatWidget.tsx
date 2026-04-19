'use client';

import { Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useV2Theme } from '../../providers/v2-theme-context';
import type { ChatWidgetProps } from './ChatWidget';

interface ChatWidgetModule {
  ChatWidget: React.ComponentType<ChatWidgetProps>;
}

interface DeferredChatWidgetProps {
  loadChatWidget?: () => Promise<ChatWidgetModule>;
}

function getMobileBottomClass(pathname: string | null) {
  const isProductPage =
    pathname?.match(/\/[^/]+\/[^/]+\/[^/]+/) &&
    !pathname.includes('/cart') &&
    !pathname.includes('/checkout');
  const isCartPage = pathname?.includes('/cart');

  if (isProductPage) {
    return 'bottom-44';
  }

  if (isCartPage) {
    return 'bottom-36';
  }

  return 'bottom-24';
}

export function DeferredChatWidget({
  loadChatWidget,
}: DeferredChatWidgetProps) {
  const { isCartOpen } = useCart();
  const { theme } = useV2Theme();
  const pathname = usePathname();
  const [ChatRuntime, setChatRuntime] =
    useState<ChatWidgetModule['ChatWidget'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isSanta = theme === 'santa';
  const mobileBottomClass = getMobileBottomClass(pathname);

  const activateChat = () => {
    if (ChatRuntime || isLoading) {
      return;
    }

    setIsLoading(true);
    const resolveChatWidget =
      loadChatWidget ?? (() => import('./ChatWidget'));

    void resolveChatWidget()
      .then((module) => {
        setChatRuntime(() => module.ChatWidget);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  if (ChatRuntime) {
    return <ChatRuntime openOnMount />;
  }

  return (
    <div
      className={`fixed ${mobileBottomClass} md:bottom-4 right-4 z-50 flex flex-col items-end gap-4 ${isCartOpen ? 'hidden' : ''}`}
    >
      <div className="relative group">
        <button
          type="button"
          onClick={activateChat}
          disabled={isLoading}
          className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-[transform,background-color,border-color,box-shadow,color,opacity] duration-200 hover:scale-110 group relative ${
            isSanta
              ? 'bg-transparent border-none shadow-none text-red-600'
              : 'bg-white/60 backdrop-blur-md text-red-600 hover:bg-white hover:border-red-100 shadow-xl border border-gray-100'
          } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
          aria-label="Open chat assistant"
        >
          {isSanta ? (
            <div className="relative w-full h-full">
              <img
                src="/african-santa-head.svg"
                alt="Santa"
                className="w-full h-full object-contain drop-shadow-xl hover:brightness-110 transition-all filter"
              />
            </div>
          ) : (
            <>
              <Sparkles
                size={28}
                className="md:w-8 md:h-8 drop-shadow-sm"
                fill="currentColor"
                fillOpacity={0.1}
              />
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
}
