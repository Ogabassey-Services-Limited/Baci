import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

// Create mock functions at module level
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockFrom = vi.fn();
const mockSupabaseClient = {
  from: mockFrom,
};

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    NextResponse: {
      json: vi.fn((body: unknown, init?: ResponseInit) => ({
        body,
        status: init?.status || 200,
      })),
    },
    after: vi.fn((callback: () => void) => callback()),
  };
});

vi.mock('@/lib/analytics/send-to-ad-platforms', () => ({
  normalizeEventType: vi.fn((eventType: string) => {
    const map: Record<string, string> = {
      START_CHECKOUT: 'begin_checkout',
      PURCHASE: 'purchase',
      ADD_TO_CART: 'add_to_cart',
    };
    return map[eventType] || eventType;
  }),
  isConversionEvent: vi.fn((eventType: string) => {
    return ['begin_checkout', 'purchase', 'add_to_cart'].includes(eventType);
  }),
  sendToAdPlatforms: vi.fn(),
}));

// Import mocked modules
import { after } from 'next/server';
import {
  isConversionEvent,
  normalizeEventType,
  sendToAdPlatforms,
} from '@/lib/analytics/send-to-ad-platforms';

describe('POST /api/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock implementations
    mockInsert.mockResolvedValue({ error: null });
    mockUpsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({
      insert: mockInsert,
      upsert: mockUpsert,
    });

    // Restore analytics mock implementations after clearAllMocks
    vi.mocked(normalizeEventType).mockImplementation((eventType: string) => {
      const map: Record<string, string> = {
        START_CHECKOUT: 'begin_checkout',
        PURCHASE: 'purchase',
        ADD_TO_CART: 'add_to_cart',
      };
      return map[eventType] || eventType;
    });

    vi.mocked(isConversionEvent).mockImplementation((eventType: string) => {
      return ['begin_checkout', 'purchase', 'add_to_cart'].includes(eventType);
    });

    // Set required env vars
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    delete process.env.EVENT_PIPELINE_ENQUEUE_ENABLED;
    delete process.env.EVENT_PIPELINE_DISABLE_LEGACY_FANOUT;
  });

  describe('Validation', () => {
    it('returns 400 when missing event_type and merchant_id', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: event_type and merchant_id',
      });
    });

    it('returns 400 when missing merchant_id only', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({ event_type: 'page_view' }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: event_type and merchant_id',
      });
    });

    it('returns 400 when missing event_type but has merchant_id', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields: event_type and merchant_id',
      });
    });
  });

  describe('Event insertion', () => {
    it('successfully inserts event without event_id', async () => {
      // Arrange
      const timestamp = new Date().toISOString();
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          page_url: 'https://example.com',
          timestamp,
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, event_id: undefined });
      expect(mockFrom).toHaveBeenCalledWith('analytics_events');
      expect(mockInsert).toHaveBeenCalledWith({
        merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        event_type: 'page_view',
        event_data: {
          page_url: 'https://example.com',
        },
        source: 'web',
        event_timestamp: timestamp,
      });
    });

    it('successfully upserts event with event_id', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          event_id: 'evt-12345',
          order_id: 'order-789',
          total: 100,
          currency: 'NGN',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, event_id: 'evt-12345' });
      expect(mockFrom).toHaveBeenCalledWith('analytics_events');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          event_type: 'purchase',
          event_data: {
            order_id: 'order-789',
            total: 100,
            currency: 'NGN',
          },
          event_id: 'evt-12345',
          source: 'web',
          event_timestamp: expect.any(String),
        },
        {
          onConflict: 'merchant_id,event_id,event_type',
          ignoreDuplicates: true,
        }
      );
    });
  });

  describe('Event normalization', () => {
    it('normalizes event types (e.g. START_CHECKOUT)', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_name: 'START_CHECKOUT',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          order_id: 'order-123',
          total: 50,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(normalizeEventType).toHaveBeenCalledWith('START_CHECKOUT');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'begin_checkout',
        })
      );
    });

    it('accepts event_name instead of event_type (mobile format)', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_name: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_type: 'purchase',
        })
      );
    });
  });

  describe('Event data building', () => {
    it('builds correct event_data for product_view events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'product_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          product_id: 'prod-456',
          product_name: 'Test Product',
          product_category: 'Electronics',
          product_price: 100,
          quantity: 1,
          currency: 'NGN',
          session_id: 'sess-789',
          user_agent: 'Mozilla/5.0',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            product_id: 'prod-456',
            product_name: 'Test Product',
            product_category: 'Electronics',
            product_price: 100,
            quantity: 1,
            currency: 'NGN',
            session_id: 'sess-789',
            user_agent: 'Mozilla/5.0',
          },
        })
      );
    });

    it('builds correct event_data for purchase events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          order_id: 'order-123',
          total: 150,
          subtotal: 130,
          shipping: 15,
          tax: 5,
          currency: 'NGN',
          item_count: 3,
          items: [{ id: '1', quantity: 2 }],
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            order_id: 'order-123',
            total: 150,
            subtotal: 130,
            shipping: 15,
            tax: 5,
            currency: 'NGN',
            item_count: 3,
            items: [{ id: '1', quantity: 2 }],
          },
        })
      );
    });

    it('builds correct event_data for purchase events with custom_data fallback', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          custom_data: {
            order_id: 'order-456',
            value: 200,
            currency: 'USD',
            contents: [{ id: '2', quantity: 1 }],
          },
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            order_id: 'order-456',
            total: 200,
            currency: 'USD',
            item_count: 1,
            items: [{ id: '2', quantity: 1 }],
          },
        })
      );
    });

    it('builds correct event_data for search events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'search',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          search_term: 'laptop',
          results_count: 25,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            search_term: 'laptop',
            results_count: 25,
          },
        })
      );
    });

    it('removes undefined values from event_data (cleanedEventData)', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'product_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          product_id: 'prod-789',
          // Other fields intentionally omitted to test undefined removal
        }),
      });

      // Act
      await POST(request);

      // Assert
      const calledData = mockInsert.mock.calls[0][0];
      expect(calledData.event_data).toEqual({
        product_id: 'prod-789',
      });
      // Ensure no undefined values in the object
      expect(Object.values(calledData.event_data)).not.toContain(undefined);
    });

    it('includes page_url for page_view events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          page_url: 'https://store.example.com/products',
          referrer: 'https://google.com',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            page_url: 'https://store.example.com/products',
            referrer: 'https://google.com',
          },
        })
      );
    });

    it('stores custom_data as nested object for unknown event types', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'custom_event',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          custom_data: {
            custom_field: 'value',
            another_field: 123,
          },
        }),
      });

      // Act
      await POST(request);

      // Assert — custom_data stored under fixed key to prevent property injection
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_data: {
            custom_data: {
              custom_field: 'value',
              another_field: 123,
            },
          },
        })
      );
    });
  });

  describe('Error handling', () => {
    it('returns 500 on database insert error', async () => {
      // Arrange
      mockInsert.mockResolvedValue({
        error: { message: 'Database connection failed' },
      });

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to store event' });
    });

    it('returns 500 on database upsert error', async () => {
      // Arrange
      mockUpsert.mockResolvedValue({
        error: { message: 'Conflict error' },
      });

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          event_id: 'evt-error',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Failed to store event' });
    });

    it('returns 400 on JSON parsing error', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: 'invalid json',
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid JSON' });
    });
  });

  describe('Ad platform fan-out', () => {
    it('fans out to ad platforms for conversion events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          event_id: 'evt-conv-123',
          order_id: 'order-456',
          total: 250,
          currency: 'NGN',
          items: [{ id: 'item-1', quantity: 2 }],
          user_data: {
            em: 'test@example.com',
            ph: '+2348012345678',
            external_id: 'user-789',
          },
        }),
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
          'user-agent': 'Mozilla/5.0',
        },
      });

      // Act
      await POST(request);

      // Assert
      expect(isConversionEvent).toHaveBeenCalledWith('purchase');
      expect(after).toHaveBeenCalled();
      expect(sendToAdPlatforms).toHaveBeenCalledWith({
        merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        event_type: 'purchase',
        event_id: 'evt-conv-123',
        user_data: expect.objectContaining({
          email: 'test@example.com',
          phone: '+2348012345678',
          external_id: 'user-789',
          ip: '192.168.1.1',
          ua: 'Mozilla/5.0',
        }),
        custom_data: expect.objectContaining({
          order_id: 'order-456',
          value: 250,
          currency: 'NGN',
          contents: [{ id: 'item-1', quantity: 2 }],
        }),
        source: 'web',
      });
    });

    it('does not fan out for non-conversion events', async () => {
      // Arrange
      vi.mocked(isConversionEvent).mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(isConversionEvent).toHaveBeenCalledWith('page_view');
      expect(sendToAdPlatforms).not.toHaveBeenCalled();
    });

    it('generates fallback event_id if not provided for conversion events', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'add_to_cart',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          product_id: 'prod-123',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(sendToAdPlatforms).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: expect.stringMatching(/^evt_\d+_[a-f0-9]{32}$/),
        })
      );
    });

    it('uses x-real-ip header as fallback for IP address', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
        headers: {
          'x-real-ip': '203.0.113.5',
          'user-agent': 'Test Agent',
        },
      });

      // Act
      await POST(request);

      // Assert
      expect(sendToAdPlatforms).toHaveBeenCalledWith(
        expect.objectContaining({
          user_data: expect.objectContaining({
            ip: '203.0.113.5',
            ua: 'Test Agent',
          }),
        })
      );
    });

    it('handles ad platform errors gracefully without failing request', async () => {
      // Arrange
      vi.mocked(sendToAdPlatforms).mockRejectedValue(
        new Error('Ad platform API failed')
      );

      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'purchase',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      const response = await POST(request);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, event_id: undefined });
    });
  });

  describe('Source and timestamp handling', () => {
    it('uses provided source field', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          source: 'mobile_app',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'mobile_app',
        })
      );
    });

    it('defaults source to web when not provided', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'web',
        })
      );
    });

    it('uses provided timestamp', async () => {
      // Arrange
      const customTimestamp = new Date().toISOString();
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
          timestamp: customTimestamp,
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_timestamp: customTimestamp,
        })
      );
    });

    it('generates timestamp when not provided', async () => {
      // Arrange
      const request = new NextRequest('http://localhost:3000/api/events', {
        method: 'POST',
        body: JSON.stringify({
          event_type: 'page_view',
          merchant_id: '019bbd89-8f5f-7f8c-a4fd-42b5d7e7a235',
        }),
      });

      // Act
      await POST(request);

      // Assert
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          event_timestamp: expect.any(String),
        })
      );
    });
  });
});
