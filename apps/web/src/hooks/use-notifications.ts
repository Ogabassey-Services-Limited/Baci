'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type {
  ActiveBanner,
  MerchantNotificationWithDetails,
} from '@/types/notifications';
import type { MerchantData } from './merchant/types';
import {
  dismissBannerNotification,
  dismissNotification,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from './notification-actions';
import {
  fetchActiveBannersRequest,
  fetchNotificationsRequest,
} from './notification-requests';
import { useMerchant, useMerchantSafe } from './use-merchant-client';

interface UseNotificationsReturn {
  notifications: MerchantNotificationWithDetails[];
  unreadCount: number;
  activeBanners: ActiveBanner[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissBanner: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/** Custom hook for merchant notifications backed by durable recipient rows. */
export function useNotifications(): UseNotificationsReturn {
  const { merchant } = useMerchant();
  return useNotificationsForMerchant(merchant);
}

function useNotificationsForMerchant(
  merchant: MerchantData | null
): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<
    MerchantNotificationWithDetails[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBanners, setActiveBanners] = useState<ActiveBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<
    typeof supabaseRef.current.channel
  > | null>(null);
  const isFetchingRef = useRef(false);

  const fetchNotifications = async (append = false) => {
    if (!merchant?.id) return;
    await fetchNotificationsRequest(append, {
      cursor,
      isFetchingRef,
      setIsLoading,
      setNotifications,
      setUnreadCount,
      setHasMore,
      setCursor,
      setError,
    });
  };

  const fetchActiveBanners = async () => {
    if (!merchant?.id) return;
    await fetchActiveBannersRequest(
      merchant.id,
      supabaseRef.current,
      setActiveBanners
    );
  };

  /** Subscribe only to this merchant's durable rows; no global payload exists. */
  useEffect(() => {
    if (!merchant?.id) return;

    const supabase = supabaseRef.current;
    const channel = supabase.channel(`merchant-notifications:${merchant.id}`);
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          filter: `merchant_id=eq.${merchant.id}`,
          schema: 'public',
          table: 'merchant_notifications',
        },
        () => {
          void fetchNotificationsRequest(false, {
            cursor: null,
            isFetchingRef,
            setCursor,
            setError,
            setHasMore,
            setIsLoading,
            setNotifications,
            setUnreadCount,
          });
          void fetchActiveBannersRequest(
            merchant.id,
            supabase,
            setActiveBanners
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          filter: `merchant_id=eq.${merchant.id}`,
          schema: 'public',
          table: 'merchant_notifications',
        },
        () => {
          // Delivery finalization updates durable recipient rows in the same
          // transaction as the parent becomes sent, making already-mounted
          // merchant clients refetch only after the parent is visible.
          void fetchNotificationsRequest(false, {
            cursor: null,
            isFetchingRef,
            setCursor,
            setError,
            setHasMore,
            setIsLoading,
            setNotifications,
            setUnreadCount,
          });
          void fetchActiveBannersRequest(
            merchant.id,
            supabase,
            setActiveBanners
          );
        }
      )
      .subscribe((_status, subscriptionError) => {
        if (subscriptionError) {
          console.warn(
            'Notification subscription error:',
            subscriptionError.message
          );
        }
      });
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [merchant?.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: function refs would loop
  useEffect(() => {
    fetchNotifications();
    fetchActiveBanners();
  }, [merchant?.id]);

  const markAsRead = (id: string) =>
    markNotificationAsRead(id, setNotifications, setUnreadCount);
  const markAllAsRead = () =>
    markAllNotificationsAsRead(notifications, setNotifications, setUnreadCount);
  const dismiss = (id: string) =>
    dismissNotification(id, setNotifications, setUnreadCount);
  const dismissBanner = (id: string) =>
    dismissBannerNotification(id, setActiveBanners);
  const loadMore = async () => {
    if (hasMore && cursor) await fetchNotifications(true);
  };
  const refetch = async () => {
    setCursor(null);
    await fetchNotifications(false);
    await fetchActiveBanners();
  };

  return {
    notifications,
    unreadCount,
    activeBanners,
    isLoading,
    error,
    hasMore,
    markAsRead,
    markAllAsRead,
    dismiss,
    dismissBanner,
    loadMore,
    refetch,
  };
}

/** Compatibility wrapper for optional notification UI. */
export function useNotificationsSafe(): UseNotificationsReturn | null {
  const merchantContext = useMerchantSafe();
  const notifications = useNotificationsForMerchant(
    merchantContext?.merchant ?? null
  );
  return merchantContext ? notifications : null;
}
