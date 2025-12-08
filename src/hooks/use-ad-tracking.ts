'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdTrackingData,
  generateEventId,
  getAdTrackingData,
  shouldApplyLimitedDataUse,
} from '@/lib/ad-tracking-cookies';

/**
 * Hook for managing ad tracking data with event deduplication support
 *
 * This hook:
 * 1. Reads click IDs from cookies (set by middleware)
 * 2. Reads browser IDs from platform cookies (_fbp, _ttp, _ga)
 * 3. Generates event IDs for deduplication between Pixel and CAPI
 * 4. Detects California users for CCPA/LDU compliance
 * 5. Provides data ready to send with orders
 *
 * Usage:
 * ```tsx
 * const { trackingData, generatePurchaseEventId, getTrackingForOrder } = useAdTracking();
 *
 * // When firing a Pixel event
 * const eventId = generatePurchaseEventId();
 * fbq('track', 'Purchase', { value: 100, currency: 'NGN' }, { eventID: eventId });
 *
 * // When creating an order
 * const orderData = {
 *   ...orderDetails,
 *   ad_tracking: getTrackingForOrder(eventId),
 * };
 * ```
 */
export function useAdTracking() {
  const [trackingData, setTrackingData] = useState<AdTrackingData>({});
  const [isCaliforniaUser, setIsCaliforniaUser] = useState(false);
  const [purchaseEventId, setPurchaseEventId] = useState<string | null>(null);

  // Load tracking data on mount
  useEffect(() => {
    const data = getAdTrackingData();
    setTrackingData(data);

    // Check if user is in California (for CCPA/LDU)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setIsCaliforniaUser(shouldApplyLimitedDataUse(timezone));
    } catch {
      // Fallback: assume not California if we can't detect
      setIsCaliforniaUser(false);
    }
  }, []);

  /**
   * Generate a new event ID for a purchase event
   * This ID should be used for BOTH the client-side Pixel event
   * AND passed in ad_tracking when creating the order
   */
  const generatePurchaseEventId = useCallback(() => {
    const eventId = generateEventId();
    setPurchaseEventId(eventId);
    return eventId;
  }, []);

  /**
   * Get tracking data formatted for order creation
   * Includes the event ID for deduplication if one was generated
   *
   * @param eventId - Optional event ID override (if not using generatePurchaseEventId)
   */
  const getTrackingForOrder = useCallback(
    (eventId?: string): AdTrackingData => {
      return {
        ...trackingData,
        eventId: eventId || purchaseEventId || undefined,
        limitedDataUse: isCaliforniaUser,
      };
    },
    [trackingData, purchaseEventId, isCaliforniaUser]
  );

  /**
   * Fire Facebook Pixel event with proper event ID for deduplication
   * Returns the event ID used (for passing to order creation)
   */
  const trackFacebookPurchase = useCallback(
    (value: number, currency: string, contentIds?: string[]) => {
      const eventId = generatePurchaseEventId();

      // Fire Facebook Pixel if available
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq(
          'track',
          'Purchase',
          {
            value,
            currency,
            content_ids: contentIds,
            content_type: 'product',
          },
          { eventID: eventId }
        );
      }

      return eventId;
    },
    [generatePurchaseEventId]
  );

  /**
   * Fire TikTok Pixel event with proper event ID for deduplication
   * Returns the event ID used (for passing to order creation)
   */
  const trackTikTokPurchase = useCallback(
    (value: number, currency: string, contentIds?: string[]) => {
      const eventId = generatePurchaseEventId();

      // Fire TikTok Pixel if available
      if (typeof window !== 'undefined' && (window as any).ttq) {
        (window as any).ttq.track('CompletePayment', {
          value,
          currency,
          contents: contentIds?.map((id) => ({ content_id: id })),
          event_id: eventId,
        });
      }

      return eventId;
    },
    [generatePurchaseEventId]
  );

  /**
   * Fire purchase events on all configured platforms
   * Returns tracking data ready for order creation
   */
  const trackPurchase = useCallback(
    (
      value: number,
      currency: string,
      contentIds?: string[]
    ): AdTrackingData => {
      const eventId = generatePurchaseEventId();

      // Fire Facebook Pixel
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq(
          'track',
          'Purchase',
          {
            value,
            currency,
            content_ids: contentIds,
            content_type: 'product',
          },
          { eventID: eventId }
        );
      }

      // Fire TikTok Pixel
      if (typeof window !== 'undefined' && (window as any).ttq) {
        (window as any).ttq.track('CompletePayment', {
          value,
          currency,
          contents: contentIds?.map((id) => ({ content_id: id })),
          event_id: eventId,
        });
      }

      // Fire Google Analytics
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'purchase', {
          transaction_id: eventId,
          value,
          currency,
          items: contentIds?.map((id) => ({ item_id: id })),
        });
      }

      // Fire Snapchat Pixel
      if (typeof window !== 'undefined' && (window as any).snaptr) {
        (window as any).snaptr('track', 'PURCHASE', {
          price: value,
          currency,
          transaction_id: eventId,
          item_ids: contentIds,
        });
      }

      return getTrackingForOrder(eventId);
    },
    [generatePurchaseEventId, getTrackingForOrder]
  );

  return useMemo(
    () => ({
      // Raw tracking data from cookies
      trackingData,
      // Privacy flags
      isCaliforniaUser,
      // Event ID management
      purchaseEventId,
      generatePurchaseEventId,
      // Helper to get data for order creation
      getTrackingForOrder,
      // Convenience methods for firing Pixel events with deduplication
      trackFacebookPurchase,
      trackTikTokPurchase,
      trackPurchase,
    }),
    [
      trackingData,
      isCaliforniaUser,
      purchaseEventId,
      generatePurchaseEventId,
      getTrackingForOrder,
      trackFacebookPurchase,
      trackTikTokPurchase,
      trackPurchase,
    ]
  );
}
