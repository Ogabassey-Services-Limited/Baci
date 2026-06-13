'use client';

import Script from 'next/script';
import { useSyncExternalStore } from 'react';
import { getStoredConsent } from '@/lib/consent-mode';

interface TikTokPixelProps {
  pixelId: string;
}

/**
 * Subscribe to marketing-consent changes from the external consent store
 * (localStorage + custom events) so the pixel can sync without a
 * setState-in-effect, keeping React Compiler memoization enabled.
 */
function subscribeToConsent(onChange: () => void): () => void {
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
 * TikTok Pixel Component with Consent Mode Support
 *
 * Implements TikTok's tracking pixel with:
 * - Cookie consent integration
 * - Advanced matching (hashed user data)
 * - E-commerce event tracking
 *
 * @see https://business-api.tiktok.com/portal/docs?id=1739585696931842
 */
export function TikTokPixel({ pixelId }: TikTokPixelProps) {
  const isAllowed = useSyncExternalStore(
    subscribeToConsent,
    getMarketingConsentSnapshot,
    getMarketingConsentServerSnapshot
  );

  if (!pixelId || !isAllowed) {
    return null;
  }

  return (
    <Script id="tiktok-pixel" strategy="lazyOnload">
      {`
        !function (w, d, t) {
          w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
          ttq.load('${pixelId}');
          ttq.page();
        }(window, document, 'ttq');
      `}
    </Script>
  );
}

/**
 * TikTok E-commerce Event Tracking
 *
 * Call these functions to track e-commerce events.
 * Events are only sent if marketing consent is granted.
 */
export const tiktokEvents = {
  /**
   * Track product view
   */
  viewContent: (
    productId: string,
    productName: string,
    price: number,
    currency: string = 'USD'
  ) => {
    if (typeof window === 'undefined' || !window.ttq) return;

    window.ttq.track('ViewContent', {
      content_id: productId,
      content_name: productName,
      content_type: 'product',
      price,
      currency,
    });
  },

  /**
   * Track add to cart
   */
  addToCart: (
    productId: string,
    productName: string,
    price: number,
    quantity: number = 1,
    currency: string = 'USD'
  ) => {
    if (typeof window === 'undefined' || !window.ttq) return;

    window.ttq.track('AddToCart', {
      content_id: productId,
      content_name: productName,
      content_type: 'product',
      price,
      quantity,
      value: price * quantity,
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
    if (typeof window === 'undefined' || !window.ttq) return;

    window.ttq.track('InitiateCheckout', {
      content_ids: productIds,
      content_type: 'product',
      value,
      currency,
    });
  },

  /**
   * Track purchase completion
   */
  purchase: (
    _orderId: string,
    value: number,
    currency: string,
    products: Array<{ id: string; price: number; quantity: number }>
  ) => {
    if (typeof window === 'undefined' || !window.ttq) return;

    window.ttq.track('CompletePayment', {
      content_ids: products.map((p) => p.id),
      content_type: 'product',
      value,
      currency,
      contents: products.map((p) => ({
        content_id: p.id,
        price: p.price,
        quantity: p.quantity,
      })),
    });
  },

  /**
   * Track search
   */
  search: (searchTerm: string) => {
    if (typeof window === 'undefined' || !window.ttq) return;

    window.ttq.track('Search', {
      query: searchTerm,
    });
  },

  /**
   * Identify user with hashed data for advanced matching
   */
  identify: (email?: string, phone?: string, externalId?: string) => {
    if (typeof window === 'undefined' || !window.ttq) return;

    const identifyData: Record<string, string> = {};
    if (email) identifyData.email = email; // TikTok handles hashing
    if (phone) identifyData.phone_number = phone;
    if (externalId) identifyData.external_id = externalId;

    if (Object.keys(identifyData).length > 0) {
      window.ttq.identify(identifyData);
    }
  },
};

// Extend Window type for TikTok
declare global {
  interface Window {
    ttq?: {
      track: (event: string, params?: Record<string, unknown>) => void;
      page: () => void;
      identify: (params: Record<string, string>) => void;
      load: (pixelId: string) => void;
    };
  }
}
