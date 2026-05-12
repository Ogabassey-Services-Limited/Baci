import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create mock instances before mocking modules
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
  rpc: vi.fn(),
};

// Mock dependencies with factory functions
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchant: vi.fn(() => ({
    merchant: { id: 'merchant-123' },
    loading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

import { useMerchant } from '@/hooks/use-merchant-client';
// Import after mocks are set up
import { createClient } from '@/lib/supabase/client';
import { useNotifications, useNotificationsSafe } from './use-notifications';

// Setup mocks
beforeEach(() => {
  vi.clearAllMocks();

  // Reset mock implementations
  mockChannel.on.mockReturnValue(mockChannel);
  mockChannel.subscribe.mockReturnValue(mockChannel);
  mockSupabase.channel.mockReturnValue(mockChannel);
  mockSupabase.rpc.mockResolvedValue({ data: [], error: null }); // Default RPC response
  vi.mocked(createClient).mockReturnValue(
    mockSupabase as unknown as ReturnType<typeof createClient>
  );
  vi.mocked(useMerchant).mockReturnValue({
    merchant: { id: 'merchant-123' },
    loading: false,
    error: null,
    refetch: vi.fn(),
  } as any);

  // Mock global fetch with default response
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      data: [],
      unread_count: 0,
      has_more: false,
      cursor: null,
    }),
  });
});

describe('useNotifications', () => {
  describe('Initial state', () => {
    it('returns loading state initially', () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      // Act
      const { result } = renderHook(() => useNotifications());

      // Assert
      expect(result.current.isLoading).toBe(true);
      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.activeBanners).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(result.current.hasMore).toBe(false);
    });

    it('provides all expected actions', () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      // Act
      const { result } = renderHook(() => useNotifications());

      // Assert
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.markAllAsRead).toBe('function');
      expect(typeof result.current.dismiss).toBe('function');
      expect(typeof result.current.dismissBanner).toBe('function');
      expect(typeof result.current.loadMore).toBe('function');
      expect(typeof result.current.refetch).toBe('function');
    });
  });

  describe('Fetching notifications', () => {
    it('fetches notifications when merchant is available', async () => {
      // Arrange
      const mockNotifications = [
        {
          id: 'notif-1',
          notification_id: 'n1',
          merchant_id: 'merchant-123',
          read_at: null,
          dismissed_at: null,
          banner_dismissed_at: null,
          created_at: '2026-02-10T12:00:00Z',
          notification: {
            id: 'n1',
            title: 'Test Notification',
            message: 'Test message',
            notification_type: 'info',
            priority: 'medium',
            channels: ['in_app'],
          },
        },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockNotifications,
          unread_count: 1,
          has_more: false,
          cursor: null,
        }),
      });

      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const { result } = renderHook(() => useNotifications());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications?limit=20')
      );
      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.unreadCount).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('fetches active banners when merchant is available', async () => {
      // Arrange
      const mockBanners = [
        {
          id: 'banner-1',
          notification_id: 'n1',
          title: 'Important Update',
          message: 'Check this out',
          notification_type: 'warning',
          priority: 'high',
          action_url: '/action',
          action_label: 'View',
          created_at: '2026-02-10T12:00:00Z',
        },
      ];

      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);

      // Act
      const { result } = renderHook(() => useNotifications());

      // Set the banners AFTER the hook is rendered so RPC is called
      await waitFor(() => {
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_active_banners', {
          p_merchant_id: 'merchant-123',
        });
      });

      // Now set the banners mock to return the data
      mockSupabase.rpc.mockResolvedValueOnce({
        data: mockBanners,
        error: null,
      });

      // Refetch to get the banners
      await result.current.refetch();

      // Assert
      await waitFor(() => {
        expect(result.current.activeBanners).toEqual(mockBanners);
      });
    });

    it('does not fetch when merchant is null', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      // Act
      renderHook(() => useNotifications());

      // Allow time for any async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('handles fetch errors gracefully without throwing', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);
      const mockError = new Error('Network error');
      global.fetch = vi.fn().mockRejectedValue(mockError);
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const { result } = renderHook(() => useNotifications());

      // Assert
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.notifications).toEqual([]);
    });

    it('handles 429 rate limit response by backing off', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          /* no-op */
        });

      // Act
      renderHook(() => useNotifications());

      // Assert
      await waitFor(
        () => {
          expect(consoleWarnSpy).toHaveBeenCalledWith(
            'Rate limit exceeded for notifications. Backing off.'
          );
        },
        { timeout: 1000 }
      );

      consoleWarnSpy.mockRestore();
    });

    it('handles non-OK responses by logging error and returning empty array', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Server error' }),
      });
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {
          /* no-op */
        });

      // Act
      const { result } = renderHook(() => useNotifications());

      // Assert
      await waitFor(
        () => {
          expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to fetch notifications:',
            500,
            { error: 'Server error' }
          );
        },
        { timeout: 1000 }
      );

      expect(result.current.notifications).toEqual([]);
      consoleErrorSpy.mockRestore();
    });

    it('supports cursor-based pagination with loadMore', async () => {
      // Arrange - Verify loadMore calls fetch with cursor parameter
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          unread_count: 0,
          has_more: true,
          cursor: 'test-cursor',
        }),
      });

      global.fetch = mockFetch;

      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

      // Act
      const { result } = renderHook(() => useNotifications());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify cursor and hasMore are set from initial fetch
      expect(result.current.hasMore).toBe(true);

      // Clear mocks to isolate loadMore call
      mockFetch.mockClear();

      // Call loadMore
      await result.current.loadMore();

      // Assert that loadMore called fetch with cursor in query string
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('cursor=test-cursor')
      );
    });
  });

  describe('Supabase channel subscription', () => {
    it('sets up channel subscription when merchant exists', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);

      // Act
      renderHook(() => useNotifications());

      // Assert
      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalledWith(
          'notifications:global',
          {
            config: { broadcast: { self: false } },
          }
        );
      });

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'new_notification' },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('does not set up channel when merchant is null', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: null,
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      // Act
      renderHook(() => useNotifications());

      // Allow time for any async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert
      expect(mockSupabase.channel).not.toHaveBeenCalled();
    });

    it('cleans up channel on unmount', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);

      // Act
      const { unmount } = renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockSupabase.channel).toHaveBeenCalled();
      });

      unmount();

      // Assert
      expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('logs warning on subscription error instead of throwing', async () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
      } as any);

      const consoleWarnSpy = vi
        .spyOn(console, 'warn')
        .mockImplementation(() => {
          /* no-op */
        });

      let subscribeCallback: (
        status: string,
        err?: { message: string }
      ) => void = () => {
        /* no-op */
      };
      mockChannel.subscribe.mockImplementation((cb) => {
        subscribeCallback = cb;
        return mockChannel;
      });

      // Act
      renderHook(() => useNotifications());

      await waitFor(() => {
        expect(mockChannel.subscribe).toHaveBeenCalled();
      });

      // Simulate subscription error
      subscribeCallback('CHANNEL_ERROR', { message: 'Connection failed' });

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Notification subscription error:',
        'Connection failed'
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('Actions', () => {
    describe('markAsRead', () => {
      it('marks notification as read and updates local state', async () => {
        // Arrange
        const initialNotifications = [
          {
            id: 'notif-1',
            notification_id: 'n1',
            merchant_id: 'merchant-123',
            read_at: null,
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: '2026-02-10T12:00:00Z',
            notification: {
              id: 'n1',
              title: 'Test',
              message: 'msg',
              notification_type: 'info',
              priority: 'medium',
              channels: ['in_app'],
            },
          },
        ];

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: initialNotifications,
              unread_count: 1,
              has_more: false,
              cursor: null,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ unread_count: 0 }),
          });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(1);
        });

        await result.current.markAsRead('notif-1');

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/notifications/notif-1',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ read: true }),
          })
        );

        await waitFor(() => {
          expect(result.current.notifications[0].read_at).not.toBeNull();
        });

        expect(result.current.unreadCount).toBe(0);
      });

      it('throws error when mark as read fails', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
          loading: false,
          error: null,
          refetch: vi.fn(),
        } as any);

        const { result } = renderHook(() => useNotifications());

        // Act & Assert
        await expect(result.current.markAsRead('notif-1')).rejects.toThrow(
          'Failed to mark as read'
        );
      });
    });

    describe('markAllAsRead', () => {
      it('calls bulk mark-all endpoint and updates local unread state', async () => {
        // Arrange
        const initialNotifications = [
          {
            id: 'notif-1',
            notification_id: 'n1',
            merchant_id: 'merchant-123',
            read_at: null,
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: '2026-02-10T12:00:00Z',
            notification: {
              id: 'n1',
              title: 'Test',
              message: 'msg',
              notification_type: 'info',
              priority: 'medium',
              channels: ['in_app'],
            },
          },
        ];

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: initialNotifications,
              unread_count: 1,
              has_more: false,
              cursor: null,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, unread_count: 0 }),
          });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(1);
        });

        await result.current.markAllAsRead();

        // Assert
        expect(global.fetch).toHaveBeenNthCalledWith(
          2,
          '/api/notifications/mark-all-read',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
          })
        );

        await waitFor(() => {
          expect(result.current.unreadCount).toBe(0);
          expect(result.current.notifications[0].read_at).not.toBeNull();
        });
      });

      it('throws when bulk mark-all endpoint fails', async () => {
        // Arrange
        const initialNotifications = [
          {
            id: 'notif-1',
            notification_id: 'n1',
            merchant_id: 'merchant-123',
            read_at: null,
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: '2026-02-10T12:00:00Z',
            notification: {
              id: 'n1',
              title: 'Test',
              message: 'msg',
              notification_type: 'info',
              priority: 'medium',
              channels: ['in_app'],
            },
          },
        ];

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: initialNotifications,
              unread_count: 1,
              has_more: false,
              cursor: null,
            }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
          });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(1);
        });

        // Assert
        await expect(result.current.markAllAsRead()).rejects.toThrow(
          'Failed to mark all as read'
        );
      });

      it('skips network call when there are no unread notifications', async () => {
        // Arrange
        const initialNotifications = [
          {
            id: 'notif-1',
            notification_id: 'n1',
            merchant_id: 'merchant-123',
            read_at: '2026-02-10T12:00:00Z',
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: '2026-02-10T12:00:00Z',
            notification: {
              id: 'n1',
              title: 'Test',
              message: 'msg',
              notification_type: 'info',
              priority: 'medium',
              channels: ['in_app'],
            },
          },
        ];

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: initialNotifications,
            unread_count: 0,
            has_more: false,
            cursor: null,
          }),
        });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(1);
        });

        await result.current.markAllAsRead();

        // Assert
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    describe('dismiss', () => {
      it('dismisses notification and removes from local state', async () => {
        // Arrange
        const initialNotifications = [
          {
            id: 'notif-1',
            notification_id: 'n1',
            merchant_id: 'merchant-123',
            read_at: null,
            dismissed_at: null,
            banner_dismissed_at: null,
            created_at: '2026-02-10T12:00:00Z',
            notification: {
              id: 'n1',
              title: 'Test',
              message: 'msg',
              notification_type: 'info',
              priority: 'medium',
              channels: ['in_app'],
            },
          },
        ];

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: initialNotifications,
              unread_count: 1,
              has_more: false,
              cursor: null,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({ unread_count: 0 }),
          });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(1);
        });

        await result.current.dismiss('notif-1');

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/notifications/notif-1',
          expect.objectContaining({
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dismissed: true }),
          })
        );

        await waitFor(() => {
          expect(result.current.notifications).toHaveLength(0);
        });

        expect(result.current.unreadCount).toBe(0);
      });

      it('throws error when dismiss fails', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
          loading: false,
          error: null,
          refetch: vi.fn(),
        } as any);

        const { result } = renderHook(() => useNotifications());

        // Act & Assert
        await expect(result.current.dismiss('notif-1')).rejects.toThrow(
          'Failed to dismiss notification'
        );
      });
    });

    describe('dismissBanner', () => {
      it('dismisses banner and removes from activeBanners', async () => {
        // Arrange
        const mockBanners = [
          {
            id: 'banner-1',
            notification_id: 'n1',
            title: 'Banner',
            message: 'msg',
            notification_type: 'warning',
            priority: 'high',
            action_url: '/action',
            action_label: 'View',
            created_at: '2026-02-10T12:00:00Z',
          },
        ];

        global.fetch = vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              data: [],
              unread_count: 0,
              has_more: false,
              cursor: null,
            }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: async () => ({}),
          });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: mockBanners, error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(result.current.activeBanners).toHaveLength(1);
        });

        await result.current.dismissBanner('banner-1');

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/notifications/banner-1',
          expect.objectContaining({
            method: 'PATCH',
            body: JSON.stringify({ banner_dismissed: true }),
          })
        );

        await waitFor(() => {
          expect(result.current.activeBanners).toHaveLength(0);
        });
      });

      it('throws error when dismissBanner fails', async () => {
        // Arrange
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
        });

        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
          loading: false,
          error: null,
          refetch: vi.fn(),
        } as any);

        const { result } = renderHook(() => useNotifications());

        // Act & Assert
        await expect(result.current.dismissBanner('banner-1')).rejects.toThrow(
          'Failed to dismiss banner'
        );
      });
    });

    describe('refetch', () => {
      it('refetches notifications and banners', async () => {
        // Arrange
        vi.mocked(useMerchant).mockReturnValue({
          merchant: { id: 'merchant-123' },
        } as any);
        mockSupabase.rpc.mockResolvedValue({ data: [], error: null });

        // Act
        const { result } = renderHook(() => useNotifications());

        await waitFor(() => {
          expect(global.fetch).toHaveBeenCalled();
        });

        vi.clearAllMocks();

        await result.current.refetch();

        // Assert
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/notifications?limit=20')
        );
        expect(mockSupabase.rpc).toHaveBeenCalledWith('get_active_banners', {
          p_merchant_id: 'merchant-123',
        });
      });
    });
  });

  describe('useNotificationsSafe', () => {
    it('returns hook result when used within provider', () => {
      // Arrange
      vi.mocked(useMerchant).mockReturnValue({
        merchant: { id: 'merchant-123' },
        loading: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      // Act
      const { result } = renderHook(() => useNotificationsSafe());

      // Assert
      expect(result.current).not.toBeNull();
      expect(result.current?.notifications).toEqual([]);
    });

    it('returns null when used outside provider', () => {
      // Arrange
      vi.mocked(useMerchant).mockImplementation(() => {
        throw new Error('Must be used within provider');
      });

      // Act
      const { result } = renderHook(() => useNotificationsSafe());

      // Assert
      expect(result.current).toBeNull();
    });
  });
});
