'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getStoredConsent } from '@/lib/consent-mode';

interface SnapchatPixelProps {
  pixelId: string;
}

// Subscribe to consent changes via the storage + custom consent events.
// Using useSyncExternalStore (instead of useEffect + setState) lets React
// Compiler memoize the component and keeps the read free of a synchronous
// setState inside an effect.
function subscribeMarketingConsent(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('cookie-consent-updated', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('cookie-consent-updated', onChange);
  };
}

function getMarketingConsentSnapshot(): boolean {
  return getStoredConsent()?.marketing === true;
}

function getMarketingConsentServerSnapshot(): boolean {
  return false;
}

/**
 * Snapchat Pixel Component with Consent Mode Support
 *
 * Implements Snapchat's tracking pixel with:
 * - Cookie consent integration
 * - User hashing for advanced matching
 * - E-commerce event tracking
 *
 * @see https://businesshelp.snapchat.com/s/article/snap-pixel-about
 */
export function SnapchatPixel({ pixelId }: SnapchatPixelProps) {
  const isAllowed = useSyncExternalStore(
    subscribeMarketingConsent,
    getMarketingConsentSnapshot,
    getMarketingConsentServerSnapshot
  );

  if (!pixelId || !isAllowed) {
    return null;
  }

  return (
    <Script id="snapchat-pixel" strategy="afterInteractive">
      {`
        (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function()
        {a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
        a.queue=[];var s='script';r=t.createElement(s);r.async=!0;
        r.src=n;var u=t.getElementsByTagName(s)[0];
        u.parentNode.insertBefore(r,u);})(window,document,
        'https://sc-static.net/scevent.min.js');

        snaptr('init', '${pixelId}', {
          'user_email': '__INSERT_USER_EMAIL__'
        });
        snaptr('track', 'PAGE_VIEW');
      `}
    </Script>
  );
}

/**
 * Snapchat E-commerce Event Tracking
 */
export const snapchatEvents = {
  /**
   * Track product view
   */
  viewContent: (productId: string, price: number, currency: string = 'USD') => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'VIEW_CONTENT', {
      item_ids: [productId],
      price,
      currency,
    });
  },

  /**
   * Track add to cart
   */
  addToCart: (productId: string, price: number, currency: string = 'USD') => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'ADD_CART', {
      item_ids: [productId],
      price,
      currency,
    });
  },

  /**
   * Track checkout initiation
   */
  startCheckout: (
    value: number,
    currency: string = 'USD',
    productIds: string[] = []
  ) => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'START_CHECKOUT', {
      item_ids: productIds,
      price: value,
      currency,
    });
  },

  /**
   * Track purchase completion
   */
  purchase: (
    orderId: string,
    value: number,
    currency: string = 'USD',
    productIds: string[] = []
  ) => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'PURCHASE', {
      item_ids: productIds,
      price: value,
      currency,
      transaction_id: orderId,
    });
  },

  /**
   * Track search
   */
  search: (searchTerm: string) => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'SEARCH', {
      search_string: searchTerm,
    });
  },

  /**
   * Track sign up
   */
  signUp: () => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    window.snaptr('track', 'SIGN_UP');
  },

  /**
   * Set user data for advanced matching
   * Note: User data should be set during pixel initialization.
   * This is called automatically if you pass user data to the PAGE_VIEW event.
   */
  setUserData: (pixelId: string, email?: string, phone?: string) => {
    if (typeof window === 'undefined' || !window.snaptr) return;

    const userData: Record<string, string> = {};
    if (email) userData.user_email = email;
    if (phone) userData.user_phone_number = phone;

    if (Object.keys(userData).length > 0) {
      // Re-initialize with user data
      window.snaptr('init', pixelId, userData);
    }
  },
};

// Extend Window type for Snapchat
declare global {
  interface Window {
    snaptr?: {
      (
        action: 'init',
        pixelId: string,
        userData?: Record<string, string>
      ): void;
      (action: 'track', event: string, params?: Record<string, unknown>): void;
    };
  }
}
