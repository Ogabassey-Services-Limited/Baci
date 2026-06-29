import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

const mockCheckCsrfProtection = vi.fn();
const mockCreateClient = vi.fn();
const mockConsoleError = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}));

import { POST } from './route';

function createSupabaseRpcMock(response: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn((name: string) => {
      if (name === 'record_receipt_claim_app_download_clicked_v2') {
        return Promise.resolve(response);
      }

      return Promise.resolve({
        data: null,
        error: { message: `Unexpected RPC: ${name}` },
      });
    }),
  };
}

function postRequest(body: string | unknown = { target: 'app_store' }) {
  return new NextRequest(
    'http://localhost:3000/api/storefront/receipts/claims/claim-token/app-download-click',
    {
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    }
  );
}

const params = { params: Promise.resolve({ token: 'claim-token' }) };
const invalidParams = { params: Promise.resolve({ token: 'bad token' }) };

describe('POST /api/storefront/receipts/claims/[token]/app-download-click', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConsoleError.mockClear();
    mockCheckCsrfProtection.mockResolvedValue({ response: null, valid: true });
  });

  it('records app-store tap activity for a valid claim token', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'app_store',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('records play-store tap activity for a valid claim token', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(postRequest({ target: 'play_store' }), params);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'play_store',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('rejects invalid claim tokens before tracking the tap', async () => {
    const response = await POST(postRequest(), invalidParams);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid receipt claim link' });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects invalid app store targets before tracking the tap', async () => {
    const response = await POST(postRequest({ target: 'side_load' }), params);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Invalid app download tracking target',
      code: 'invalid_download_target',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON before tracking the tap', async () => {
    const response = await POST(postRequest('{'), params);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: 'Invalid app download tracking target',
      code: 'invalid_download_target',
    });
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns CSRF validation responses before tracking the tap', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
      valid: false,
    });

    const response = await POST(postRequest(), params);

    expect(response.status).toBe(403);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('returns an error response when app-download tracking fails', async () => {
    const supabase = createSupabaseRpcMock({
      data: null,
      error: { message: 'tracking write failed' },
    });
    mockCreateClient.mockResolvedValue(supabase);

    const response = await POST(postRequest(), params);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: 'Failed to record app download click',
      code: 'app_download_tracking_failed',
    });
    expect(mockConsoleError).toHaveBeenCalled();
  });
});
