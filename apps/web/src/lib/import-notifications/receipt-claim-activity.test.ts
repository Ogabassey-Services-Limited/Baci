import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  recordReceiptClaimAppDownloadClicked,
  recordReceiptClaimClick,
  recordReceiptClaimLoginStarted,
  recordReceiptClaimLoginStartedBestEffort,
} from '@/lib/import-notifications/receipt-claim-activity';
import { hashReceiptClaimToken } from '@/lib/import-notifications/receipt-claim-links';

type SupabaseRpcMock = SupabaseClient & {
  rpc: ReturnType<typeof vi.fn>;
};

type RpcResponse = {
  data: unknown;
  error: null | {
    code?: string;
    message: string;
  };
};

function createSupabaseRpcMock(
  responseOrResponses: RpcResponse | RpcResponse[]
): SupabaseRpcMock {
  const responses = Array.isArray(responseOrResponses)
    ? [...responseOrResponses]
    : [responseOrResponses];

  return {
    rpc: vi.fn().mockImplementation(() => {
      const response = responses.shift() ?? responses.at(-1);
      return Promise.resolve(response);
    }),
  } as unknown as SupabaseRpcMock;
}

const successResponse = { data: null, error: null } satisfies RpcResponse;
const tokenHash = hashReceiptClaimToken('claim-token');

describe('receipt claim activity', () => {
  it('records web click activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimClick({
      source: 'web',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'web',
      p_token_hash: tokenHash,
    });
  });

  it('defaults click activity to web when no source is provided', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimClick({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'web',
      p_token_hash: tokenHash,
    });
  });

  it('records app click activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimClick({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('record_receipt_claim_click_v2', {
      p_source: 'app',
      p_token_hash: tokenHash,
    });
  });

  it('falls back to the legacy click RPC when the source-aware RPC is missing', async () => {
    const supabase = createSupabaseRpcMock([
      {
        data: null,
        error: {
          code: 'PGRST202',
          message: 'Could not find the function record_receipt_claim_click_v2',
        },
      },
      successResponse,
    ]);

    await recordReceiptClaimClick({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      'record_receipt_claim_click_v2',
      {
        p_source: 'app',
        p_token_hash: tokenHash,
      }
    );
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      'record_receipt_claim_click',
      {
        p_token_hash: tokenHash,
      }
    );
  });

  it('does not fall back when the source-aware click RPC returns a write error', async () => {
    const supabase = createSupabaseRpcMock({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(
      recordReceiptClaimClick({
        source: 'web',
        supabase,
        token: 'claim-token',
      })
    ).rejects.toThrow('permission denied');
    expect(supabase.rpc).toHaveBeenCalledOnce();
  });

  it('records web login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimLoginStarted({
      source: 'web',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'web',
        p_token_hash: tokenHash,
      }
    );
  });

  it('defaults login-start activity to web when no source is provided', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimLoginStarted({
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'web',
        p_token_hash: tokenHash,
      }
    );
  });

  it('records unknown login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimLoginStarted({
      source: 'unknown',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'unknown',
        p_token_hash: tokenHash,
      }
    );
  });

  it('falls back to the legacy login-start RPC when the source-aware RPC is missing', async () => {
    const supabase = createSupabaseRpcMock([
      {
        data: null,
        error: {
          code: '42883',
          message:
            'function public.record_receipt_claim_login_started_v2 does not exist',
        },
      },
      successResponse,
    ]);

    await recordReceiptClaimLoginStarted({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenNthCalledWith(
      1,
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'app',
        p_token_hash: tokenHash,
      }
    );
    expect(supabase.rpc).toHaveBeenNthCalledWith(
      2,
      'record_receipt_claim_login_started',
      {
        p_token_hash: tokenHash,
      }
    );
  });

  it('records best-effort app login-start activity through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimLoginStartedBestEffort({
      source: 'app',
      supabase,
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_login_started_v2',
      {
        p_source: 'app',
        p_token_hash: tokenHash,
      }
    );
  });

  it('records app download CTA taps with the selected store target', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimAppDownloadClicked({
      supabase,
      target: 'app_store',
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'app_store',
        p_token_hash: tokenHash,
      }
    );
  });

  it('records play store app download CTA taps through the source-aware tracking RPC', async () => {
    const supabase = createSupabaseRpcMock(successResponse);

    await recordReceiptClaimAppDownloadClicked({
      supabase,
      target: 'play_store',
      token: 'claim-token',
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'record_receipt_claim_app_download_clicked_v2',
      {
        p_source: 'play_store',
        p_token_hash: tokenHash,
      }
    );
  });
});
