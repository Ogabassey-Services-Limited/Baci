import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@/lib/supabase/server';
import { POST } from './route';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
  }),
}));

type MockSupabaseClient = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
  from?: ReturnType<typeof vi.fn>;
};

function mockCreateClient(client: MockSupabaseClient) {
  vi.mocked(createClient).mockReturnValue(
    client as unknown as ReturnType<typeof createClient>
  );
}

describe('POST /api/wishlist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('selects specific columns instead of select(*)', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: '123',
        product_id: '456',
        merchant_id: '789',
        customer_email: 'test@example.com',
        created_at: '2024-01-01T00:00:00.000Z',
      },
      error: null,
    });

    // Create a mock chain and capture the select arguments
    let selectArgs: string[] = [];
    const selectMock = vi.fn().mockImplementation((...args) => {
      selectArgs = args;
      return { single: singleMock };
    });

    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

    mockCreateClient({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'test@example.com' } } }),
      },
      from: fromMock,
    });

    const request = new NextRequest('http://localhost:3000/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({
        productId: '00000000-0000-0000-0000-000000000000',
        merchantId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);

    // Verify that select was called
    expect(selectMock).toHaveBeenCalled();

    // Verify that select was NOT called with no arguments (which means select(*))
    expect(selectArgs.length).toBeGreaterThan(0);
    expect(selectArgs[0]).toBe(
      'id, product_id, merchant_id, customer_email, created_at'
    );
  });

  it('returns 400 when invalid input is provided', async () => {
    mockCreateClient({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'test@example.com' } } }),
      },
    });

    const request = new NextRequest('http://localhost:3000/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: '00000000-0000-0000-0000-000000000001',
      }), // Missing productId
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Product ID and Merchant ID are required');
    expect(createClient).toHaveBeenCalled();
  });

  it('returns 401 when user is unauthenticated', async () => {
    mockCreateClient({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    });

    const request = new NextRequest('http://localhost:3000/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({
        productId: '00000000-0000-0000-0000-000000000000',
        merchantId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe(
      'Authentication required. Please login or provide a session token.'
    );
  });

  it('returns 409 when item already in wishlist', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      },
    });

    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

    mockCreateClient({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'test@example.com' } } }),
      },
      from: fromMock,
    });

    const request = new NextRequest('http://localhost:3000/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({
        productId: '00000000-0000-0000-0000-000000000000',
        merchantId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe('Item already in wish list');
  });

  it('returns 500 when database error occurs', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '500', message: 'database connection failed' },
    });

    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    const fromMock = vi.fn().mockReturnValue({ insert: insertMock });

    mockCreateClient({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { email: 'test@example.com' } } }),
      },
      from: fromMock,
    });

    const request = new NextRequest('http://localhost:3000/api/wishlist', {
      method: 'POST',
      body: JSON.stringify({
        productId: '00000000-0000-0000-0000-000000000000',
        merchantId: '00000000-0000-0000-0000-000000000001',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe('Internal server error');
  });
});
