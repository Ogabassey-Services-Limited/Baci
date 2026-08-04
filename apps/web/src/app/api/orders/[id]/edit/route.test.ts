import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

import { authenticateApiRequest } from '@/lib/api-auth';
import { checkCsrfProtection } from '@/lib/csrf';
import { PATCH } from './route';

const validPayload = {
  branch_id: null,
  customer: {
    email: 'ada@example.com',
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ada Buyer',
    phone: '+2348012345678',
  },
  discount_amount: 0,
  gift_wrapping_fee: 0,
  items: [
    {
      condition: 'new',
      image_url: 'https://cdn.example.test/s26.jpg',
      item_description: null,
      name: 'Samsung Galaxy S26',
      price: 1000000,
      product_id: '33333333-3333-4333-8333-333333333333',
      product_match_status: 'linked',
      quantity: 1,
      variant_id: null,
      variant_attributes: { color: 'Black', storage: '512GB' },
      variant_name: null,
    },
  ],
  notes: null,
  notify_customer: false,
  shipping_address: {
    address: '12 Allen Avenue',
    city: 'Ikeja',
    name: 'Ada Buyer',
    phone: '+2348012345678',
    state: 'Lagos',
  },
  shipping_fee: 2500,
  source: 'physical',
  tax_amount: 0,
};

const editResult = {
  change_category: 'financial',
  changed_fields: ['items', 'total'],
  customer_email: 'ada@example.com',
  merchant_id: 'merchant-1',
  notify_customer: false,
  order_id: '11111111-1111-4111-8111-111111111111',
};

const updatedOrder = {
  id: '11111111-1111-4111-8111-111111111111',
  merchant_id: 'merchant-1',
  order_number: 'ORD-001',
  order_items: [
    {
      id: 'item-1',
      image_url: 'https://cdn.example.test/s26.jpg',
      name: 'Samsung Galaxy S26',
      price: 1000000,
      quantity: 1,
      variant_attributes: { color: 'Black', storage: '512GB' },
    },
  ],
  total: 1002500,
};

function createMockUser(): User {
  return {
    id: 'user-1',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString(),
  } as User;
}

function createRequest(body: unknown): NextRequest {
  return {
    headers: new Headers(),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

function createThrowingJsonRequest(): NextRequest {
  return {
    headers: new Headers(),
    json: vi.fn().mockRejectedValue(new Error('bad json')),
  } as unknown as NextRequest;
}

function createSupabaseMock({
  refreshError = null,
  rpcError = null,
}: {
  refreshError?: { code?: string; message?: string } | null;
  rpcError?: { code?: string; message?: string } | null;
} = {}) {
  const single = vi.fn().mockResolvedValue({
    data: refreshError ? null : updatedOrder,
    error: refreshError,
  });
  const eq = vi.fn(() => selectBuilder);
  const selectBuilder = {
    eq,
    single,
  };
  const select = vi.fn(() => selectBuilder);
  const from = vi.fn(() => ({
    select,
  }));
  const rpc = vi.fn().mockResolvedValue({
    data: rpcError ? null : editResult,
    error: rpcError,
  });

  return {
    from,
    rpc,
    select,
    supabase: { from, rpc } as unknown as SupabaseClient,
  };
}

function callPatch(request: NextRequest) {
  return PATCH(request, {
    params: Promise.resolve({
      id: '11111111-1111-4111-8111-111111111111',
    }),
  });
}

describe('PATCH /api/orders/[id]/edit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: true,
      response: undefined,
    });
  });

  it('returns 401 before parsing JSON when authentication fails', async () => {
    const request = createRequest(validPayload);
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: 'Not authenticated',
      supabase: null,
      user: null,
    });

    const response = await callPatch(request);

    expect(response.status).toBe(401);
    expect(request.json).not.toHaveBeenCalled();
    expect(checkCsrfProtection).not.toHaveBeenCalled();
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });
    vi.mocked(checkCsrfProtection).mockResolvedValue({
      valid: false,
      response: undefined,
    });

    const response = await callPatch(createRequest(validPayload));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toEqual({ error: 'CSRF validation failed' });
  });

  it('returns 400 for invalid JSON', async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createThrowingJsonRequest());

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid schema payloads', async () => {
    const { supabase } = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(
      createRequest({ ...validPayload, customer: { name: '' } })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe('Invalid request');
  });

  it('calls the checked RPC and returns the refreshed mobile order', async () => {
    const { rpc, select, supabase } = createSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest(validPayload));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith('update_admin_order', {
      p_order_id: '11111111-1111-4111-8111-111111111111',
      p_payload: validPayload,
    });
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('order_items(')
    );
    expect(payload).toEqual({
      edit: editResult,
      order: {
        id: updatedOrder.id,
        items: updatedOrder.order_items,
        merchant_id: updatedOrder.merchant_id,
        order_number: updatedOrder.order_number,
        total: updatedOrder.total,
      },
    });
  });

  it.each([
    ['order_not_found', 404],
    ['order_edit_forbidden', 403],
    ['order_financial_edit_has_payments', 409],
    ['order_financial_edit_after_fulfillment', 409],
    ['order_terminal_not_editable', 409],
    ['order_item_replacement_has_historical_state', 409],
    ['order_item_replacement_has_accounting_metadata', 409],
    ['order_item_replacement_has_managed_stock', 409],
    ['order_item_replacement_has_serialized_reservations', 409],
    ['order_item_append_supports_one_new_line', 409],
    ['order_total_negative', 400],
    ['order_notify_customer_invalid', 400],
    ['order_item_product_forbidden', 403],
    ['order_item_variant_forbidden', 403],
  ])('maps RPC error %s to %i', async (message, status) => {
    const { supabase } = createSupabaseMock({
      rpcError: { message },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest(validPayload));

    expect(response.status).toBe(status);
  });

  it('explains when protected line-item history blocks replacement edits', async () => {
    const { supabase } = createSupabaseMock({
      rpcError: {
        message: 'order_item_replacement_has_accounting_metadata',
      },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest(validPayload));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      code: 'order_not_editable',
      error:
        'This order contains protected line-item history. Existing items cannot be changed or removed.',
    });
  });

  it('tells merchants to add only one new item per edit', async () => {
    const { supabase } = createSupabaseMock({
      rpcError: {
        message: 'order_item_append_supports_one_new_line',
      },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest(validPayload));
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      code: 'order_item_append_limit',
      error: 'Add only one new item per edit.',
    });
  });

  it('returns degraded success when the updated order cannot be refreshed', async () => {
    const { supabase } = createSupabaseMock({
      refreshError: { message: 'refresh failed' },
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase,
      user: createMockUser(),
    });

    const response = await callPatch(createRequest(validPayload));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      edit: editResult,
      order: { id: editResult.order_id },
      order_refresh_failed: true,
    });
  });
});
