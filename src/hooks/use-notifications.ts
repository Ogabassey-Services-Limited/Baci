'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useMerchant } from './use-merchant';
import type {
  MerchantNotificationWithDetails,
  NotificationBroadcastPayload,
  ActiveBanner,
} from '@/types/notifications';

interface UseNotificationsReturn {
  // Data
  notifications: MerchantNotificationWithDetails[];
  unreadCount: number;
  activeBanners: ActiveBanner[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;

  // Actions
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  dismissBanner: (id: string) => Promise<void>;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for managing merchant notifications with Supabase Broadcast
 *
 * Uses Supabase Realtime Broadcast (not Postgres Changes) for real-time updates.
 * This is the 2025 best practice for scalable notification systems.
 */
export function useNotifications(): UseNotificationsReturn {
  const { merchant } = useMerchant();
  const [notifications, setNotifications] = useState<MerchantNotificationWithDetails[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeBanners, setActiveBanners] = useState<ActiveBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const supabaseRef = useRef(createClient());
  const channelRef = useRef<ReturnType<typeof supabaseRef.current.channel> | null>(null);

  /**
   * Fetch notifications from the API
   */
  const fetchNotifications = useCallback(async (append = false) => {
    if (!merchant?.id) return;

    try {
      if (!append) {
        setIsLoading(true);
      }

      const params = new URLSearchParams();
      params.set('limit', '20');
      if (append && cursor) {
        params.set('cursor', cursor);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();

      if (append) {
        setNotifications((prev) => [...prev, ...data.data]);
      } else {
        setNotifications(data.data);
      }

      setUnreadCount(data.unread_count);
      setHasMore(data.has_more);
      setCursor(data.cursor);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setIsLoading(false);
    }
  }, [merchant?.id, cursor]);

  /**
   * Fetch active banners
   */
  const fetchActiveBanners = useCallback(async () => {
    if (!merchant?.id) return;

    try {
      const supabase = supabaseRef.current;
      const { data, error: bannerError } = await supabase
        .rpc('get_active_banners', { p_merchant_id: merchant.id });

      if (bannerError) {
        console.error('Error fetching banners:', bannerError);
        return;
      }

      setActiveBanners(data || []);
    } catch (err) {
      console.error('Error fetching active banners:', err);
    }
  }, [merchant?.id]);

  /**
   * Set up Supabase Broadcast subscription
   */
  useEffect(() => {
    if (!merchant?.id) return;

    const supabase = supabaseRef.current;

    // Subscribe to global notifications channel
    // Merchants filter messages by their ID client-side
    const channel = supabase.channel('notifications:global', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'new_notification' }, (payload) => {
        const data = payload.payload as NotificationBroadcastPayload & {
          target_merchant_ids?: string[];
        };

        // Check if this notification is for the current merchant
        if (data.target_merchant_ids?.includes(merchant.id)) {
          // Add the new notification to the top of the list
          const newNotification: MerchantNotificationWithDetails = {
            id: data.merchant_notification_id,
            notification_id: data.notification.id,
            merchant_id: merchant.id,
            read_at: null,
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: data.created_at,
            notification: {
              ...data.notification,
              template_id: null,
              target_type: 'all',
              target_merchant_ids: [],
              target_segment: null,
              scheduled_for: null,
              expires_at: null,
              created_by: '',
              created_at: data.created_at,
              sent_at: data.created_at,
              is_system: false,
            },
          };

          setNotifications((prev) => [newNotification, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // If it's a banner notification, update banners
          if (data.notification.channels.includes('banner')) {
            setActiveBanners((prev) => [
              {
                id: data.merchant_notification_id,
                notification_id: data.notification.id,
                title: data.notification.title,
                message: data.notification.message,
                notification_type: data.notification.notification_type,
                priority: data.notification.priority,
                action_url: data.notification.action_url,
                action_label: data.notification.action_label,
                created_at: data.created_at,
              },
              ...prev,
            ]);
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [merchant?.id]);

  /**
   * Initial fetch
   */
  useEffect(() => {
    fetchNotifications();
    fetchActiveBanners();
  }, [fetchNotifications, fetchActiveBanners]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      const data = await response.json();

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, read_at: new Date().toISOString() } : n
        )
      );
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      throw err;
    }
  }, []);

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      // Mark all unread notifications as read
      const unreadIds = notifications
        .filter((n) => !n.read_at)
        .map((n) => n.id);

      await Promise.all(
        unreadIds.map((id) =>
          fetch(`/api/notifications/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        )
      );

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at || new Date().toISOString(),
        }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
      throw err;
    }
  }, [notifications]);

  /**
   * Dismiss a notification (removes from list)
   */
  const dismiss = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dismissed: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      const data = await response.json();

      // Remove from local state
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setUnreadCount(data.unread_count);
    } catch (err) {
      console.error('Error dismissing notification:', err);
      throw err;
    }
  }, []);

  /**
   * Dismiss a banner notification
   */
  const dismissBanner = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_dismissed: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss banner');
      }

      // Remove from active banners
      setActiveBanners((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      console.error('Error dismissing banner:', err);
      throw err;
    }
  }, []);

  /**
   * Load more notifications (cursor-based pagination)
   */
  const loadMore = useCallback(async () => {
    if (hasMore && cursor) {
      await fetchNotifications(true);
    }
  }, [hasMore, cursor, fetchNotifications]);

  /**
   * Refetch all notifications
   */
  const refetch = useCallback(async () => {
    setCursor(null);
    await fetchNotifications(false);
    await fetchActiveBanners();
  }, [fetchNotifications, fetchActiveBanners]);

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

/**
 * Safe version that doesn't throw if used outside provider
 */
export function useNotificationsSafe(): UseNotificationsReturn | null {
  try {
    return useNotifications();
  } catch {
    return null;
  }
}
