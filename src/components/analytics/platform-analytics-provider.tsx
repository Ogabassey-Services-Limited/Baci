'use client';

import { useEffect, useState } from 'react';
import { FacebookPixel } from './facebook-pixel';
import { GoogleAnalytics } from './google-analytics';
import { SnapchatPixel } from './snapchat-pixel';
import { TikTokPixel } from './tiktok-pixel';
import { TwitterPixel } from './twitter-pixel';

/**
 * Platform Analytics Provider
 *
 * Loads the platform owner's analytics pixels on public/landing pages.
 * This is separate from merchant analytics - it tracks platform-level
 * events like landing page views, signups, and overall GMV.
 *
 * Uses a public API endpoint to fetch platform settings (analytics IDs only).
 */

interface PlatformAnalyticsSettings {
  google_analytics_id: string | null;
  facebook_pixel_id: string | null;
  tiktok_pixel_id: string | null;
  snapchat_pixel_id: string | null;
  twitter_pixel_id: string | null;
}

export function PlatformAnalyticsProvider() {
  const [settings, setSettings] = useState<PlatformAnalyticsSettings | null>(
    null
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Fetch platform analytics settings from public endpoint
    async function fetchSettings() {
      try {
        const response = await fetch('/api/platform/analytics-config');
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.warn('Failed to load platform analytics settings:', error);
      } finally {
        setLoaded(true);
      }
    }

    fetchSettings();
  }, []);

  // Track landing page view when settings are loaded
  useEffect(() => {
    if (loaded && settings) {
      trackPlatformPageView();
    }
  }, [loaded, settings]);

  if (!loaded || !settings) {
    return null;
  }

  return (
    <>
      {settings.google_analytics_id && (
        <GoogleAnalytics measurementId={settings.google_analytics_id} />
      )}
      {settings.facebook_pixel_id && (
        <FacebookPixel pixelId={settings.facebook_pixel_id} />
      )}
      {settings.tiktok_pixel_id && (
        <TikTokPixel pixelId={settings.tiktok_pixel_id} />
      )}
      {settings.snapchat_pixel_id && (
        <SnapchatPixel pixelId={settings.snapchat_pixel_id} />
      )}
      {settings.twitter_pixel_id && (
        <TwitterPixel pixelId={settings.twitter_pixel_id} />
      )}
    </>
  );
}

/**
 * Track a platform-level page view
 * Called automatically when platform analytics loads
 */
function trackPlatformPageView() {
  // Fire to server for server-side tracking
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'landing_page_view',
      page_url: window.location.href,
      referrer: document.referrer || undefined,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track merchant signup started
 * Call this when user begins the onboarding flow
 */
export function trackMerchantSignupStarted(metadata?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  // Client-side pixels
  if (window.gtag) {
    window.gtag('event', 'begin_checkout', {
      event_category: 'platform',
      event_label: 'merchant_signup',
    });
  }
  if (window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_name: 'merchant_signup',
    });
  }

  // Server-side
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'merchant_signup_started',
      event_data: metadata,
      page_url: window.location.href,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track merchant signup completed
 * Call this after successful merchant account creation
 */
export function trackMerchantSignupCompleted(
  merchantId: string,
  metadata?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;

  // Client-side pixels
  if (window.gtag) {
    window.gtag('event', 'sign_up', {
      method: 'email',
      event_category: 'platform',
    });
  }
  if (window.fbq) {
    window.fbq('track', 'CompleteRegistration', {
      content_name: 'merchant_signup',
      status: 'completed',
    });
  }

  // Server-side
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'merchant_signup_completed',
      merchant_id: merchantId,
      event_data: metadata,
      page_url: window.location.href,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track merchant's first sale (milestone event)
 */
export function trackMerchantFirstSale(
  merchantId: string,
  orderValue: number,
  currency: string = 'NGN'
) {
  if (typeof window === 'undefined') return;

  // Client-side
  if (window.gtag) {
    window.gtag('event', 'purchase', {
      value: orderValue,
      currency,
      event_category: 'platform',
      event_label: 'merchant_first_sale',
    });
  }
  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value: orderValue,
      currency,
      content_name: 'merchant_first_sale',
    });
  }

  // Server-side
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'merchant_first_sale',
      merchant_id: merchantId,
      event_data: { value: orderValue, currency },
      page_url: window.location.href,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track store published event
 */
export function trackStorePublished(
  merchantId: string,
  storeSlug: string,
  metadata?: Record<string, unknown>
) {
  if (typeof window === 'undefined') return;

  // Client-side
  if (window.gtag) {
    window.gtag('event', 'generate_lead', {
      event_category: 'platform',
      event_label: 'store_published',
    });
  }

  // Server-side
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'merchant_store_published',
      merchant_id: merchantId,
      event_data: { store_slug: storeSlug, ...metadata },
      page_url: window.location.href,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track platform-level purchase (any purchase on the platform)
 * This is separate from merchant's purchase tracking
 */
export function trackPlatformPurchase(
  merchantId: string,
  orderValue: number,
  currency: string = 'NGN',
  orderId?: string
) {
  if (typeof window === 'undefined') return;

  // Server-side only - don't double-fire client pixels
  // The merchant's pixels will handle client-side tracking
  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'platform_purchase',
      merchant_id: merchantId,
      event_data: {
        value: orderValue,
        currency,
        order_id: orderId,
      },
      page_url: window.location.href,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

/**
 * Track pricing page view
 */
export function trackPricingPageView() {
  if (typeof window === 'undefined') return;

  fetch('/api/platform/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: 'pricing_page_view',
      page_url: window.location.href,
      referrer: document.referrer || undefined,
      session_id: getOrCreateSessionId(),
    }),
  }).catch((err) => console.warn('Platform event tracking error:', err));
}

// Session ID management
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';

  const key = 'platform_session_id';
  let sessionId = sessionStorage.getItem(key);

  if (!sessionId) {
    // Use crypto.randomUUID() for cryptographically secure session IDs
    sessionId = `ps_${Date.now()}_${crypto.randomUUID()}`;
    sessionStorage.setItem(key, sessionId);
  }

  return sessionId;
}

// Window analytics types are declared in @/lib/consent-mode.ts and pixel components
