'use client';

/**
 * Client-side helpers for Facebook Conversions API
 *
 * Provides event ID generation for deduplication and
 * a function to send server-side events via our API.
 */

/**
 * Generate a unique event ID for deduplication between
 * client-side pixel and server-side CAPI events.
 *
 * When you fire both a client-side pixel event AND a server-side CAPI event
 * for the same action, use the same event ID for both so Facebook can dedupe them.
 */
export function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

interface CAPIEventData {
  event: 'Purchase' | 'InitiateCheckout' | 'AddToCart' | 'ViewContent';
  merchantId: string;
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    externalId?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    orderId?: string;
    products?: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  eventId?: string;
}

/**
 * Send a server-side event to Facebook Conversions API via our backend
 *
 * This should be called for important conversion events like:
 * - Purchase (most important)
 * - InitiateCheckout
 * - AddToCart (optional, for high-value products)
 *
 * The server will handle hashing user data and communicating with Facebook.
 */
export async function sendCAPIEvent(
  data: CAPIEventData
): Promise<{ success: boolean; eventId?: string }> {
  try {
    const response = await fetch('/api/analytics/facebook-capi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        eventSourceUrl:
          typeof window !== 'undefined' ? window.location.href : undefined,
      }),
    });

    if (!response.ok) {
      console.warn('CAPI event failed:', response.status);
      return { success: false };
    }

    const result = await response.json();
    return { success: result.success, eventId: result.eventId };
  } catch (error) {
    // Silently fail - don't break user experience for analytics
    console.warn('CAPI event error:', error);
    return { success: false };
  }
}

/**
 * Convenience function for purchase events
 * Sends to both client-side pixel (via analytics.purchase) and server-side CAPI
 */
export async function trackPurchaseWithCAPI(
  merchantId: string,
  orderId: string,
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>,
  total: number,
  currency: string,
  userData: CAPIEventData['userData']
): Promise<string> {
  const eventId = generateEventId();

  // Send server-side event
  await sendCAPIEvent({
    event: 'Purchase',
    merchantId,
    userData,
    eventData: {
      value: total,
      currency,
      orderId,
      products,
    },
    eventId,
  });

  return eventId;
}

/**
 * Convenience function for checkout events
 */
export async function trackCheckoutWithCAPI(
  merchantId: string,
  products: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>,
  total: number,
  currency: string,
  userData: CAPIEventData['userData']
): Promise<string> {
  const eventId = generateEventId();

  await sendCAPIEvent({
    event: 'InitiateCheckout',
    merchantId,
    userData,
    eventData: {
      value: total,
      currency,
      products,
    },
    eventId,
  });

  return eventId;
}
