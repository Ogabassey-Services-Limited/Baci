import { NextRequest } from 'next/server';
import { vi } from 'vitest';
import {
  expectHomogeneousPayloadKeys,
  getUpsertPayloadRows as readUpsertPayloadRows,
} from './route.payload-test-helpers';
import {
  createSupabaseTestClient,
  type ExistingJumiaOrder,
  type MutationRecord,
  type UpsertRecord,
} from './route.supabase-test-client';

type JumiaOrderFixture = {
  createdAt: string;
  id: number | string;
  number: number | string;
  shippingAddress: { firstName?: string; lastName?: string; phone?: string };
  status: string;
  totalAmount: { currency: string; value: number };
};

const validIntegrationId = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  existingOrders: [] as ExistingJumiaOrder[],
  getAllOrders: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  getOrderItems: vi.fn(),
  hasPermission: vi.fn(),
  inQueries: [] as Array<{ column: string; values: string[] }>,
  loggerError: vi.fn(),
  notificationAlreadySentRows: null as ExistingJumiaOrder[] | null,
  notificationStates: null as ExistingJumiaOrder[] | null,
  mutations: [] as MutationRecord[],
  notifyJumiaOrder: vi.fn(),
  notificationClaimError: null as { message: string } | null,
  notificationClaimRows: null as ExistingJumiaOrder[] | null,
  notificationMarkerError: null as { message: string } | null,
  prefetchError: null as { message: string } | null,
  upsertError: null as { message: string } | null,
  upsertErrors: [] as Array<{ message: string } | null>,
  upserts: [] as UpsertRecord[],
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

vi.mock('@/lib/expo-push', () => ({
  notifyJumiaOrder: (...args: unknown[]) => mocks.notifyJumiaOrder(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({})),
}));

vi.mock('@/lib/jumia/client', () => {
  class MockJumiaApiError extends Error {}

  return {
    JumiaApiError: MockJumiaApiError,
    JumiaClient: {
      forIntegration: vi.fn().mockResolvedValue({ shopId: 'jumia-shop-1' }),
    },
    jumiaErrorResponse: vi.fn(),
  };
});

vi.mock('@/lib/jumia/orders', () => ({
  getAllOrders: (...args: unknown[]) => mocks.getAllOrders(...args),
  getOrderItems: (...args: unknown[]) => mocks.getOrderItems(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mocks.loggerError(...args),
  },
}));

let supabase: ReturnType<typeof createSupabaseTestClient>;

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => supabase),
}));

function createRequest() {
  return new NextRequest(
    `http://localhost/api/marketplace/jumia/orders?integrationId=${validIntegrationId}`,
    { method: 'POST' }
  );
}

function createOrder(id: number | string): JumiaOrderFixture {
  return {
    createdAt: '2026-06-21T12:00:00.000Z',
    id,
    number: `NO-${id}`,
    shippingAddress: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '+2348012345678',
    },
    status: 'pending',
    totalAmount: { currency: 'NGN', value: 12_000 },
  };
}

function getUpsertPayloadRows(): Record<string, unknown>[] {
  return readUpsertPayloadRows(mocks.upserts);
}

function reset() {
  vi.clearAllMocks();
  mocks.existingOrders.length = 0;
  mocks.inQueries.length = 0;
  mocks.mutations.length = 0;
  mocks.notificationClaimError = null;
  mocks.notificationClaimRows = null;
  mocks.notificationAlreadySentRows = null;
  mocks.notificationMarkerError = null;
  mocks.notificationStates = null;
  mocks.prefetchError = null;
  mocks.upsertError = null;
  mocks.upsertErrors.length = 0;
  mocks.upserts.length = 0;
  supabase = createSupabaseTestClient(mocks);
  mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  mocks.getMerchantForApiRequest.mockResolvedValue({
    merchantId: 'merchant-1',
  });
  mocks.getOrderItems.mockResolvedValue({ items: [] });
  mocks.hasPermission.mockReturnValue(true);
  mocks.notifyJumiaOrder.mockResolvedValue({ errors: [], failed: 0, sent: 1 });
}

export const jumiaOrdersRouteHarness = {
  createOrder,
  createRequest,
  expectHomogeneousPayloadKeys,
  get mocks() {
    return mocks;
  },
  getUpsertPayloadRows,
  reset,
};
