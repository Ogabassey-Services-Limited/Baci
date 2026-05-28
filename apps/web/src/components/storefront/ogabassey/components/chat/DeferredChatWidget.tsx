'use client';

import { Sparkles } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/hooks/cart';
import { useV2Theme } from '../../providers/v2-theme-context';
import { useOgabasseyScrollVisibility } from '../../scroll-visibility-store';
import type { ChatWidgetProps } from './ChatWidget';

interface ChatWidgetModule {
  ChatWidget: React.ComponentType<ChatWidgetProps>;
}

interface DeferredChatWidgetProps {
  loadChatWidget?: () => Promise<ChatWidgetModule>;
}

function getMobileOffset(pathname: string | null) {
  const isProductPage =
    pathname?.match(/\/[^/]+\/[^/]+\/[^/]+/) &&
    !pathname.includes('/cart') &&
    !pathname.includes('/checkout');
  const isCartPage = pathname?.includes('/cart');

  if (isProductPage) {
    return 'product';
  }

  if (isCartPage) {
    return 'cart';
  }

  return 'default';
}

export function DeferredChatWidget({
  loadChatWidget,
}: DeferredChatWidgetProps) {
  const { isCartOpen } = useCart();
  const { theme } = useV2Theme();
  const pathname = usePathname();
  const isFooterVisible = useOgabasseyScrollVisibility();
  const [ChatRuntime, setChatRuntime] =
    useState<ChatWidgetModule['ChatWidget'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isSanta = theme === 'santa';
  const footerOffset = getMobileOffset(pathname);
  const mobileOffset = isFooterVisible ? footerOffset : 'screen';
  const buttonClasses = [
    'ogabassey-chat-button',
    isSanta && 'ogabassey-chat-button--santa',
    isLoading && 'ogabassey-chat-button--loading',
  ]
    .filter(Boolean)
    .join(' ');

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

  if (isCartOpen) {
    return null;
  }

  return (
    <div
      className="ogabassey-chat-anchor"
      data-mobile-offset={mobileOffset}
    >
      <div className="relative group">
        <button
          type="button"
          onClick={activateChat}
          disabled={isLoading}
          className={buttonClasses}
          aria-label="Open AI chat assistant"
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
                className="md:w-8 md:h-8 drop-shadow-xs"
                fill="currentColor"
                fillOpacity={0.1}
              />
              <span className="ogabassey-chat-badge">
                <span className="ogabassey-chat-badge__ping" />
                <span className="ogabassey-chat-badge__label">
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
