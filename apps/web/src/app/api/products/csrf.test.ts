import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as csrf from '@/lib/csrf';
import { POST } from './route';

// Mock env
vi.mock('@/env', () => ({
  getSupabaseUrl: () => 'https://mock.supabase.co',
  getSupabaseAnonKey: () => 'mock-key',
  getSupabaseServiceRoleKey: () => 'mock-service-key',
  getRootDomain: () => 'localhost:3000',
}));

// Mock dependencies
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
  sanitizeSchemaMarkup: vi.fn((x) => x),
  sanitizeSearchQuery: vi.fn((x) => x),
  sanitizeLikePattern: vi.fn((x) => x),
}));

// Helper to create a chainable mock object
const createChainableMock = () => {
  const mock = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    in: vi.fn(() => mock),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-id',
        business_name: 'Test Merchant',
        country: 'NG',
      },
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    insert: vi.fn(() => mock),
    update: vi.fn(() => mock),
    delete: vi.fn(() => mock),
    upsert: vi.fn(() => mock),
    order: vi.fn(() => mock),
    limit: vi.fn(() => mock),
    range: vi.fn(() => mock),
  };
  return mock;
};

const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
      error: null,
    }),
  },
  from: vi.fn(() => createChainableMock()),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

// Mock fetch for embedding generation
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});

describe('POST /api/products', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call checkCsrfProtection', async () => {
    // Setup mock for checkCsrfProtection
    const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
    checkCsrfMock.mockResolvedValue({ valid: true });

    // Create a mock request
    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Test Product',
        price: 100,
        description: 'Test Description',
        category: 'General',
      }),
    });

    // Call the handler
    await POST(request);

    // Verify checkCsrfProtection was called
    expect(checkCsrfMock).toHaveBeenCalledWith(request);
  });
});
