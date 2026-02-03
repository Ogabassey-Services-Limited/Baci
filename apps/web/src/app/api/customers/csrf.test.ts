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
}));

// Helper to create a chainable mock object
const createChainableMock = () => {
  const mock: any = {
    select: vi.fn(() => mock),
    eq: vi.fn(() => mock),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 'merchant-id',
        user_id: 'test-user-id',
      },
      error: null,
    }),
    insert: vi.fn(() => mock),
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
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
  }),
}));

describe('POST /api/customers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call checkCsrfProtection', async () => {
    // Setup mock for checkCsrfProtection
    const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
    checkCsrfMock.mockResolvedValue({ valid: true });

    // Create a mock request
    const request = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        first_name: 'Test',
        last_name: 'User',
        email: 'test@example.com',
      }),
    });

    // Call the handler
    await POST(request);

    // Verify checkCsrfProtection was called
    expect(checkCsrfMock).toHaveBeenCalledWith(request);
  });

  it('should return error if CSRF check fails', async () => {
    // Setup mock to fail
    const checkCsrfMock = vi.mocked(csrf.checkCsrfProtection);
    const mockResponse = new Response('CSRF Error', { status: 403 });
    checkCsrfMock.mockResolvedValue({
      valid: false,
      response: mockResponse as any,
    });

    const request = new NextRequest('http://localhost:3000/api/customers', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response).toBe(mockResponse);
  });
});
