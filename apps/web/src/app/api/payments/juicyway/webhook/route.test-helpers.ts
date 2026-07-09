import { NextRequest } from 'next/server';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { JuicywayWebhookPayload } from '@/lib/juicyway';

vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    after: vi.fn((callback: () => void | Promise<void>) => {
      Promise.resolve(callback()).catch(() => {
        // Ignore background task errors in tests
      });
    }),
  };
});

vi.mock('@/env', () => ({
  env: {
    JUICYWAY_BUSINESS_ID: 'test-business-id',
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(new Map())),
}));

vi.mock('@/lib/juicyway', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/juicyway')>('@/lib/juicyway');
  return {
    ...actual,
    verifyWebhookSignature: vi.fn(),
  };
});

export const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  })),
  rpc: vi.fn(),
};

// `record_merchant_settlement` is called via the admin client (service role)
// because Juicyway webhook callbacks have no user session and the function
// is locked to service_role per the 20260428071421 advisor cleanup.
// handlePaymentForCancelledOrder ALSO files its reconciliation_review row
// through this admin client (the table is RLS-locked to service_role).
export const mockReconciliationInsert = vi
  .fn()
  .mockResolvedValue({ data: null, error: null });
export const mockAdminSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'reconciliation_review') {
      return { insert: mockReconciliationInsert };
    }
    throw new Error(`Unexpected admin table: ${table}`);
  }),
  rpc: vi.fn().mockResolvedValue({ error: null }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockAdminSupabase),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/email-templates', () => ({
  generateOrderConfirmationEmail: vi.fn(() => '<html>Order Confirmed</html>'),
  generateOrderConfirmationText: vi.fn(() => 'Order Confirmed'),
}));

vi.mock('@/lib/offline-conversions', () => ({
  sendPurchaseConversion: vi.fn(() => Promise.resolve([])),
  logConversionResults: vi.fn(),
}));

vi.mock('@/lib/zeptomail', () => ({
  sendEmail: vi.fn(() => Promise.resolve()),
}));

export async function postJuicywayWebhook(request: NextRequest) {
  const { POST } = await import('./route');
  return POST(request);
}

export function createWebhookRequest(
  payload: JuicywayWebhookPayload
): NextRequest {
  return new NextRequest(
    'http://localhost:3000/api/payments/juicyway/webhook',
    {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'content-type': 'application/json',
      },
    }
  );
}

export function createSuccessPayload(
  reference = 'TXN-123456'
): JuicywayWebhookPayload {
  return {
    checksum: 'valid-checksum',
    event: 'payment.session.succeeded',
    data: {
      id: 'payment-id-123',
      amount: 10000,
      currency: 'NGN',
      reference,
      status: 'success',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone_number: '+2341234567890',
        billing_address: {
          line1: '123 Street',
          city: 'Lagos',
          country: 'NG',
          zip_code: '100001',
        },
        ip_address: '127.0.0.1',
      },
      payment_method: {
        type: 'crypto_address',
      },
      date: '2024-01-01T00:00:00Z',
      description: 'Order payment',
      mode: 'live',
    },
  };
}

export function createFailedPayload(): JuicywayWebhookPayload {
  return {
    checksum: 'valid-checksum',
    event: 'payment.session.failed',
    data: {
      id: 'payment-id-456',
      amount: 10000,
      currency: 'NGN',
      reference: 'TXN-FAILED',
      status: 'failed',
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone_number: '+2341234567890',
        billing_address: {
          line1: '123 Street',
          city: 'Lagos',
          country: 'NG',
          zip_code: '100001',
        },
        ip_address: '127.0.0.1',
      },
      payment_method: {
        type: 'crypto_address',
      },
      date: '2024-01-01T00:00:00Z',
      description: 'Order payment',
      mode: 'live',
    },
  };
}

export async function setupJuicywayWebhookTest(): Promise<
  ReturnType<typeof vi.fn>
> {
  vi.clearAllMocks();
  process.env.JUICYWAY_BUSINESS_ID = 'test-business-id';
  vi.stubEnv('NODE_ENV', 'test');

  const juicyway = await import('@/lib/juicyway');
  return vi.mocked(juicyway.verifyWebhookSignature);
}

type WireProcessingMocksOptions = {
  orderItems?: Array<{
    condition: string | null;
    id: string;
    name: string;
    price: number;
    product_id: string;
    quantity: number;
    subtotal: number;
    variant_name: string | null;
  }>;
};

export function wireProcessingMocks(
  transaction: Record<string, unknown>,
  options: WireProcessingMocksOptions = {}
) {
  const order = {
    id: 'order-123',
    order_number: 'ORD-001',
    customer_email: 'customer@example.com',
    customer_name: 'Jane Doe',
    customer_phone: '+2341234567890',
    subtotal: '9500',
    shipping_fee: '500',
    total: '10000',
    currency: 'NGN',
    customer_id: 'customer-123',
    shipping_address: {
      address: '123 Main St',
      city: 'Lagos',
      state: 'Lagos',
    },
    order_items: options.orderItems ?? [],
    ad_tracking: null,
  };
  const merchant = {
    business_name: 'Test Store',
    slug: 'test-store',
    support_email: 'support@test-store.com',
    email_sender_name: 'Test Store',
    email: 'admin@test-store.com',
    offline_conversions_enabled: false,
  };

  const state = { txnUpdated: false, orderUpdated: false };
  let transactionCallCount = 0;

  const fromMock = vi.fn((table) => {
    if (table === 'transactions') {
      transactionCallCount++;
      if (transactionCallCount === 1) {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: transaction, error: null }),
        };
      }
      return {
        update: vi.fn(() => {
          state.txnUpdated = true;
          return { eq: vi.fn().mockResolvedValue({ error: null }) };
        }),
      };
    }
    if (table === 'orders') {
      return {
        update: vi.fn(() => {
          state.orderUpdated = true;
          return {
            eq: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: order, error: null }),
          };
        }),
      };
    }
    if (table === 'merchants') {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: merchant, error: null }),
      };
    }
    return {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };
  });

  (mockSupabase as Record<string, unknown>).from = fromMock;
  mockSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
  mockAdminSupabase.rpc = vi.fn().mockResolvedValue({ error: null });
  return state;
}

export const pendingCryptoTxn = (metadata: Record<string, unknown>) => ({
  id: 'txn-123',
  status: 'pending',
  gateway_reference: 'TXN-123456',
  amount: '10000',
  platform_fee: '150',
  merchant_id: 'merchant-123',
  order_id: 'order-123',
  created_at: '2026-06-25T15:00:00.000Z',
  metadata,
});
