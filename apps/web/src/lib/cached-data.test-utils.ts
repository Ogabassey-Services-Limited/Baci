import { vi } from 'vitest';
import type { CachedMerchant } from '@/lib/cached-data';

interface MockListResult {
  data: unknown;
  error: unknown;
}

interface MockQueryBuilder {
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

export interface CachedDataTestHarness {
  mockEq: ReturnType<typeof vi.fn>;
  mockFrom: ReturnType<typeof vi.fn>;
  mockIn: ReturnType<typeof vi.fn>;
  mockLimit: ReturnType<typeof vi.fn>;
  mockListResult: MockListResult;
  mockMaybeSingle: ReturnType<typeof vi.fn>;
  mockNeq: ReturnType<typeof vi.fn>;
  mockNot: ReturnType<typeof vi.fn>;
  mockOr: ReturnType<typeof vi.fn>;
  mockOrder: ReturnType<typeof vi.fn>;
  mockQueryExecution: ReturnType<typeof vi.fn>;
  mockRange: ReturnType<typeof vi.fn>;
  mockRpc: ReturnType<typeof vi.fn>;
  mockSelect: ReturnType<typeof vi.fn>;
  mockSingle: ReturnType<typeof vi.fn>;
}

export const mockMerchant: CachedMerchant = {
  id: 'merchant-123',
  business_name: 'Test Store',
  site_title: 'Test Store - Best Products',
  site_tagline: 'Quality products for you',
  site_description: 'We sell amazing products',
  business_type: 'retail',
  logo_url: 'https://example.com/logo.png',
  phone: '+234800000000',
  email: 'test@example.com',
  slug: 'test-store',
  business_address: '123 Test Street',
  payout_currency: 'NGN',
  paystack_subaccount_code: null,
  is_published: true,
  template_id: 'template-1',
  plan_tier: 'free',
  premium_features: null,
  brand_colors: {
    primary: '#000000',
    accent: '#ff0000',
    background: '#ffffff',
  },
};

let mockCreateClient: ((...args: unknown[]) => unknown) | null = null;

export function getMockCreateClient() {
  return mockCreateClient;
}

export function resetMockCreateClient() {
  mockCreateClient = null;
}

export function buildCachedDataTestHarness(): CachedDataTestHarness {
  vi.clearAllMocks();

  const mockMaybeSingle = vi.fn();
  const mockListResult: MockListResult = { data: [], error: null };
  const mockIn = vi.fn();
  const mockLimit = vi.fn();
  const mockOr = vi.fn();
  const mockOrder = vi.fn();
  const mockNeq = vi.fn();
  const mockNot = vi.fn();
  const mockQueryExecution = vi.fn(() => mockListResult);
  const mockRange = vi.fn();
  const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });
  const mockSingle = vi.fn();
  const mockQueryBuilder = new Proxy(
    {},
    {
      get(target, prop, receiver) {
        if (prop === 'then') {
          return (...args: Parameters<Promise<MockListResult>['then']>) =>
            Promise.resolve(mockQueryExecution()).then(...args);
        }

        return Reflect.get(target, prop, receiver);
      },
    }
  ) as Promise<{
    data: unknown;
    error: unknown;
  }> &
    MockQueryBuilder;

  const mockEq = vi.fn(() => mockQueryBuilder);
  mockOr.mockImplementation(() => mockQueryBuilder);
  mockIn.mockImplementation(() => mockQueryBuilder);
  mockOrder.mockImplementation(() => mockQueryBuilder);
  mockNeq.mockImplementation(() => mockQueryBuilder);
  mockNot.mockImplementation(() => mockQueryBuilder);
  mockLimit.mockImplementation(() => mockQueryBuilder);
  mockRange.mockImplementation(() => mockQueryBuilder);

  Object.assign(mockQueryBuilder, {
    maybeSingle: mockMaybeSingle,
    single: mockSingle,
    eq: mockEq,
    in: mockIn,
    or: mockOr,
    order: mockOrder,
    neq: mockNeq,
    not: mockNot,
    limit: mockLimit,
    range: mockRange,
  });

  const mockSelect = vi.fn(() => mockQueryBuilder);
  const mockFrom = vi.fn(() => ({ select: mockSelect }));

  mockCreateClient = vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
    auth: { getUser: vi.fn() },
  }));

  return {
    mockEq,
    mockFrom,
    mockIn,
    mockLimit,
    mockListResult,
    mockMaybeSingle,
    mockNeq,
    mockNot,
    mockOr,
    mockOrder,
    mockQueryExecution,
    mockRange,
    mockRpc,
    mockSelect,
    mockSingle,
  };
}
