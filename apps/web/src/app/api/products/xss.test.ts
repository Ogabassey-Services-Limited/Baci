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

// Mock dependencies but NOT sanitization libraries
vi.mock('@/lib/csrf', async () => {
  const actual = await vi.importActual('@/lib/csrf');
  return {
    ...actual,
    checkCsrfProtection: vi.fn(),
  };
});

// Mock Supabase
const insertMock = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnValue({
    single: vi.fn().mockResolvedValue({
      data: { id: 'new-product-id' },
      error: null,
    }),
  }),
});

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
    insert: insertMock,
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

describe('POST /api/products XSS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sanitize input before insertion', async () => {
    // Setup mock for checkCsrfProtection
    const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
    checkCsrfMock.mockResolvedValue({ valid: true });

    // Malicious Input
    const dangerousName = '<b>Bold Name</b>';
    const dangerousDescription = '<p>Safe</p><script>alert("XSS")</script>';
    const dangerousCategory = '<img src=x onerror=alert(1)>';

    // Create a mock request
    const request = new NextRequest('http://localhost:3000/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: dangerousName,
        price: 100,
        description: dangerousDescription,
        category: dangerousCategory,
        stock: 10,
      }),
    });

    // Call the handler
    await POST(request);

    // Verify insert was called
    expect(insertMock).toHaveBeenCalled();
    const insertedData = insertMock.mock.calls[0][0];

    // EXPECTATIONS (These will fail initially until fix is applied)

    // Name should be sanitized (stripped of tags)
    expect(insertedData.name).toBe('Bold Name');

    // Description should be sanitized (safe tags allowed, script removed)
    expect(insertedData.description).toContain('<p>Safe</p>');
    expect(insertedData.description).not.toContain('<script>');

    // Category should be sanitized (stripped of tags)
    expect(insertedData.category).not.toContain('<img');
    expect(insertedData.category).toBe(''); // stripHtmlTags on just an image tag leaves nothing
  });
});
