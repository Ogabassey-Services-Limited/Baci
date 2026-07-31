import type { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const mocks = {
  checkCsrfProtection: vi.fn(),
  checkRateLimit: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
};

export const merchantId = '11111111-1111-4111-8111-111111111111';

export function createApplySupabaseMock(options?: {
  jobStatus?: string;
  pageUpdatedAt?: string;
  rpcError?: Error;
  rpcCode?: string | null;
  rpcResponse?: {
    applied: boolean;
    code: string | null;
    page_config_id: string | null;
    updated_at: string | null;
  };
}) {
  const rpcResult = options?.rpcResponse ?? {
    applied: !options?.rpcCode,
    code: options?.rpcCode ?? null,
    page_config_id: 'page-1',
    updated_at: '2026-04-28T10:30:00.000Z',
  };
  const rpc = vi.fn().mockImplementation(() => ({
    maybeSingle: vi.fn().mockResolvedValue({
      data: options?.rpcError ? null : rpcResult,
      error: options?.rpcError ?? null,
    }),
  }));

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    rpc,
    from: vi.fn((table: string) => {
      if (table === 'ai_jobs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'job-1',
              merchant_id: merchantId,
              type: 'storefront_layout_generation',
              status: options?.jobStatus ?? 'completed',
              output: {
                generatedConfig: {
                  content: [],
                  root: { title: 'Home' },
                  zones: {},
                },
                generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
              },
            },
            error: null,
          }),
        };
      }

      if (table === 'page_configs') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'page-1',
              updated_at: options?.pageUpdatedAt ?? '2026-04-28T10:00:00.000Z',
            },
            error: null,
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

export function routeContext(id = '44444444-4444-4444-8444-444444444444') {
  return { params: Promise.resolve({ id }) };
}

export function createApplyRequest(
  body = JSON.stringify({ merchantId })
): NextRequest {
  return new Request('http://localhost/api/ai-jobs/job-1/apply', {
    method: 'POST',
    body,
  }) as unknown as NextRequest;
}

export function setupApplyRouteMocks() {
  vi.clearAllMocks();
  mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  mocks.checkRateLimit.mockResolvedValue(true);
  mocks.getMerchantForApiRequest.mockResolvedValue({
    merchantId,
    staffAccess: {
      isOwner: true,
      isStaff: false,
      role: null,
      permissions: { full_access: { all: true } },
    },
  });
}
