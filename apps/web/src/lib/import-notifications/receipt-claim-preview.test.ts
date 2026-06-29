import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';
import {
  loadReceiptClaimLoginEmailHint,
  loadReceiptClaimPreview,
  loadReceiptClaimPreviewWithLoginEmailHint,
  parseReceiptClaimToken,
  recordReceiptClaimAppDownloadClicked,
  recordReceiptClaimClick,
  recordReceiptClaimLoginStarted,
  recordReceiptClaimLoginStartedBestEffort,
} from '@/lib/import-notifications/receipt-claim-preview';

const baseClaim = {
  claimed_at: null,
  claimed_by_user_id: null,
  customer_email: 'basseybjohn@yahoo.co.uk',
  customer_id: 'customer-1',
  customer_name: 'Bassey John',
  expires_at: '2099-01-01T00:00:00.000Z',
  id: 'claim-1',
  merchant_id: 'merchant-1',
  merchant: {
    business_name: 'Ogabassey',
    slug: 'ogabassey',
  },
  orders: [
    {
      id: 'order-1',
      order_items: [{ name: 'iPhone 16 Pro Max', quantity: 1 }],
      order_number: '06485',
    },
    {
      id: 'order-2',
      order_items: [{ name: 'AirPods Pro', quantity: 2 }],
      order_number: '06484',
    },
  ],
};

type SupabaseRpcMock = SupabaseClient & {
  rpc: ReturnType<typeof vi.fn>;
};

function createSupabaseRpcMock(response: {
  data: unknown;
  error: unknown;
}): SupabaseRpcMock {
  return {
    rpc: vi.fn().mockResolvedValue(response),
  } as unknown as SupabaseRpcMock;
}

describe('receipt claim preview', () => {
  it('parses valid route tokens and rejects malformed tokens', () => {
    expect(parseReceiptClaimToken('claim-token_123')).toBe('claim-token_123');
    expect(parseReceiptClaimToken('bad token')).toBeNull();
    expect(parseReceiptClaimToken(undefined)).toBeNull();
  });

  it('loads a claim preview through the preview RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: baseClaim, error: null });

    const result = await loadReceiptClaimPreview({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('preview_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
    expect(result).toEqual({
      claim: {
        claimed: false,
        customerName: 'Bassey John',
        devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
        merchantName: 'Ogabassey',
      },
      ok: true,
    });
  });

  it('uses a generic merchant fallback when the claim merchant has no name', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        merchant: { business_name: null, slug: null },
      },
      error: null,
    });

    const result = await loadReceiptClaimPreview({
      supabase,
      token: 'claim-token',
    });

    expect(result).toEqual({
      claim: expect.objectContaining({ merchantName: 'Store' }),
      ok: true,
    });
  });

  it('loads a sanitized login email hint through the preview RPC', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        customer_email: '  BasseyBJohn@Yahoo.CO.UK  ',
      },
      error: null,
    });

    const result = await loadReceiptClaimLoginEmailHint({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('preview_receipt_claim', {
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
    expect(result).toEqual({
      emailHint: 'basseybjohn@yahoo.co.uk',
      ok: true,
    });
  });

  it('loads preview data and login email hints from one claim lookup', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        customer_email: '  BasseyBJohn@Yahoo.CO.UK  ',
      },
      error: null,
    });

    const result = await loadReceiptClaimPreviewWithLoginEmailHint({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledOnce();
    expect(result).toEqual({
      claim: {
        claimed: false,
        customerName: 'Bassey John',
        devices: ['iPhone 16 Pro Max', '2 x AirPods Pro'],
        merchantName: 'Ogabassey',
      },
      emailHint: 'basseybjohn@yahoo.co.uk',
      ok: true,
    });
  });

  it('drops invalid login email hints from claim data', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        customer_email: 'not-an-email',
      },
      error: null,
    });

    await expect(
      loadReceiptClaimLoginEmailHint({ supabase, token: 'claim-token' })
    ).resolves.toEqual({
      emailHint: '',
      ok: true,
    });
  });

  it('returns a not-found result when no claim matches the token', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await expect(
      loadReceiptClaimPreview({ supabase, token: 'claim-token' })
    ).resolves.toEqual({
      error: 'Receipt claim link not found',
      ok: false,
      status: 404,
    });
  });

  it('returns an expired result when the claim is expired', async () => {
    const supabase = createSupabaseRpcMock({
      data: {
        ...baseClaim,
        expires_at: '2020-01-01T00:00:00.000Z',
      },
      error: null,
    });

    await expect(
      loadReceiptClaimPreview({ supabase, token: 'claim-token' })
    ).resolves.toEqual({
      error: 'Receipt claim link has expired',
      ok: false,
      status: 410,
    });
  });

  it('throws a generic error when the preview RPC fails', async () => {
    const supabase = createSupabaseRpcMock({
      data: null,
      error: { message: 'relation receipt_claims_secret does not exist' },
    });

    await expect(
      loadReceiptClaimPreview({ supabase, token: 'claim-token' })
    ).rejects.toThrow('Failed to load receipt claim');
  });

  it('throws when the preview RPC returns malformed claim data', async () => {
    const supabase = createSupabaseRpcMock({
      data: { id: 'claim-1' },
      error: null,
    });

    await expect(
      loadReceiptClaimPreview({ supabase, token: 'claim-token' })
    ).rejects.toThrow('invalid response structure');
  });

  it('records web click activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimClick({
      source: 'web',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'web',
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('defaults click activity to web when no source is provided', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimClick({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'web',
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('records app click activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimClick({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'app',
      p_token_hash: hashReceiptClaimToken('claim-token'),
    });
  });

  it('records web login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimLoginStarted({
      source: 'web',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'web',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('defaults login-start activity to web when no source is provided', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimLoginStarted({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'web',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('records unknown login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimLoginStarted({
      source: 'unknown',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'unknown',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('records best-effort app login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimLoginStartedBestEffort({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'app',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('records app download CTA taps with the selected store target', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimAppDownloadClicked({
      supabase,
      target: 'app_store',
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'app_store',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });

  it('records play store app download CTA taps through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock({ data: null, error: null });

    await recordReceiptClaimAppDownloadClicked({
      supabase,
      target: 'play_store',
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'play_store',
        p_token_hash: hashReceiptClaimToken('claim-token'),
      }
    );
  });
});
