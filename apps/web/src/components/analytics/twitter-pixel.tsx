'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getStoredConsent } from '@/lib/consent-mode';

interface TwitterPixelProps {
  pixelId: string;
}

// Consent lives in an external store (browser storage + custom events), so the
// component subscribes via useSyncExternalStore instead of mirroring it into
// state from an effect.
function subscribeToConsentChanges(onChange: () => void): () => void {
  window.addEventListener('storage', onChange);
  window.addEventListener('cookie-consent-updated', onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener('cookie-consent-updated', onChange);
  };
}

const getMarketingConsentSnapshot = () =>
  getStoredConsent()?.marketing === true;
const getServerMarketingConsentSnapshot = () => false;

/**
 * Twitter/X Pixel Component with Consent Mode Support
 *
 * Implements Twitter's Universal Website Tag with:
 * - Cookie consent integration
 * - E-commerce event tracking
 * - Conversion tracking
 *
 * @see https://business.twitter.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites.html
 */
export function TwitterPixel({ pixelId }: TwitterPixelProps) {
  const isAllowed = useSyncExternalStore(
    subscribeToConsentChanges,
    getMarketingConsentSnapshot,
    getServerMarketingConsentSnapshot
  );

  if (!pixelId || !isAllowed) {
    return null;
  }

  return (
    <Script id="twitter-pixel" strategy="lazyOnload">
      {`
        !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
        },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
        a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
        twq('config','${pixelId}');
        twq('track','PageView');
      `}
    </Script>
  );
}

/**
 * Twitter/X E-commerce Event Tracking
 *
 * Event names follow Twitter's conversion event taxonomy.
 * Events are only sent if marketing consent is granted.
 */
export const twitterEvents = {
  /**
   * Track product view
   */
  viewContent: (
    productId: string,
    value?: number,
    currency: string = 'USD'
  ) => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'ViewContent', {
      content_ids: [productId],
      content_type: 'product',
      value,
      currency,
    });
  },

  /**
   * Track add to cart
   */
  addToCart: (productId: string, value: number, currency: string = 'USD') => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'AddToCart', {
      content_ids: [productId],
      content_type: 'product',
      value,
      currency,
    });
  },

  /**
   * Track checkout initiation
   */
  initiateCheckout: (
    value: number,
    currency: string = 'USD',
    productIds: string[] = []
  ) => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'InitiateCheckout', {
      content_ids: productIds,
      value,
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
    productIds: string[] = [],
    numItems?: number
  ) => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'Purchase', {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency,
      order_id: orderId,
      num_items: numItems,
    });
  },

  /**
   * Track search
   */
  search: (searchTerm: string) => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'Search', {
      search_string: searchTerm,
    });
  },

  /**
   * Track sign up / lead
   */
  signUp: () => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'CompleteRegistration');
  },

  /**
   * Track add to wishlist
   */
  addToWishlist: (
    productId: string,
    value?: number,
    currency: string = 'USD'
  ) => {
    if (typeof window === 'undefined' || !window.twq) return;

    window.twq('track', 'AddToWishlist', {
      content_ids: [productId],
      value,
      currency,
    });
  },
};

// Extend Window type for Twitter
declare global {
  interface Window {
    twq?: (
      action: string,
      event: string,
      params?: Record<string, unknown>
    ) => void;
  }
}
