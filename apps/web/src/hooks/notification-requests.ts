import type { Dispatch, SetStateAction } from 'react';
import type { createClient } from '@/lib/supabase/client';
import type {
  ActiveBanner,
  MerchantNotificationWithDetails,
} from '@/types/notifications';

type SupabaseClient = ReturnType<typeof createClient>;

export interface FetchNotificationsDeps {
  cursor: string | null;
  isFetchingRef: { current: boolean };
  pendingRefreshRef?: { current: boolean };
  queueRefresh?: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setNotifications: Dispatch<SetStateAction<MerchantNotificationWithDetails[]>>;
  setUnreadCount: Dispatch<SetStateAction<number>>;
  setHasMore: Dispatch<SetStateAction<boolean>>;
  setCursor: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
}

/** Fetch paginated recipient notifications from the authenticated API. */
export async function fetchNotificationsRequest(
  append: boolean,
  deps: FetchNotificationsDeps
): Promise<void> {
  const {
    cursor,
    isFetchingRef,
    setIsLoading,
    setNotifications,
    setUnreadCount,
    setHasMore,
    setCursor,
    setError,
  } = deps;

  if (isFetchingRef.current) {
    if (!append && deps.pendingRefreshRef && deps.queueRefresh !== false) {
      deps.pendingRefreshRef.current = true;
    }
    return;
  }

  try {
    isFetchingRef.current = true;
    if (!append) setIsLoading(true);

    const params = new URLSearchParams({ limit: '20' });
    if (append && cursor) params.set('cursor', cursor);

    const response = await fetch(`/api/notifications?${params.toString()}`);
    if (response.status === 429) {
      console.warn('Rate limit exceeded for notifications.');
      setError('Notifications are rate limited. Please try again later.');
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(
        'Failed to fetch notifications:',
        response.status,
        errorData
      );
      setError('Notifications could not be loaded. Please try again.');
      return;
    }

    const data = await response.json();
    setNotifications((previous) =>
      append ? appendUniqueNotifications(previous, data.data) : data.data
    );
    if (typeof data.unread_count === 'number') {
      setUnreadCount(data.unread_count);
    }
    setHasMore(data.has_more);
    setCursor(data.cursor);
    setError(null);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    setError(
      error instanceof Error ? error.message : 'Failed to fetch notifications'
    );
  } finally {
    if (!append) setIsLoading(false);
    isFetchingRef.current = false;
    if (deps.pendingRefreshRef?.current) {
      deps.pendingRefreshRef.current = false;
      void fetchNotificationsRequest(false, { ...deps, cursor: null });
    }
  }
}

function appendUniqueNotifications(
  previous: MerchantNotificationWithDetails[],
  next: MerchantNotificationWithDetails[]
) {
  const seenIds = new Set(previous.map((notification) => notification.id));
  return [
    ...previous,
    ...next.filter((notification) => !seenIds.has(notification.id)),
  ];
}

/** Fetch active banner notifications for the authenticated merchant. */
export async function fetchActiveBannersRequest(
  merchantId: string,
  supabase: SupabaseClient,
  setActiveBanners: Dispatch<SetStateAction<ActiveBanner[]>>
): Promise<void> {
  try {
    const { data, error: bannerError } = await supabase.rpc(
      'get_active_banners',
      { p_merchant_id: merchantId }
    );

    if (bannerError) {
      console.error('Error fetching banners:', bannerError);
      return;
    }

    setActiveBanners(data || []);
  } catch (error) {
    console.error('Error fetching active banners:', error);
  }
}
