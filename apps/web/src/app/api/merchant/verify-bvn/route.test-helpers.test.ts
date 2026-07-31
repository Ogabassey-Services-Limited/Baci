import { describe, expect, it } from 'vitest';
import {
  fullMatchResponse,
  makeRequest,
  makeSupabaseMock,
  noMatchResponse,
  validBvnBody,
} from './route.test-helpers';

describe('verify BVN route test helpers', () => {
  it('builds a POST request with the supplied verification payload', async () => {
    const request = makeRequest(validBvnBody);

    expect(request.method).toBe('POST');
    expect(request.nextUrl.pathname).toBe('/api/merchant/verify-bvn');
    await expect(request.json()).resolves.toEqual(validBvnBody);
  });

  it('models the default Nigerian merchant lookup and successful RPC', async () => {
    const supabase = makeSupabaseMock();
    const query = supabase.from().select().eq();

    await expect(query.maybeSingle()).resolves.toEqual({
      data: { country: 'NG', phone: '08012345678' },
      error: null,
    });
    await expect(supabase.rpc()).resolves.toEqual({
      error: null,
    });
  });

  it('models explicit merchant lookup and RPC failure overrides', async () => {
    const rpcError = { message: 'record failed' };
    const supabase = makeSupabaseMock(rpcError, null, 'IN');

    await expect(supabase.merchantMaybeSingle()).resolves.toEqual({
      data: { country: 'IN', phone: null },
      error: null,
    });
    await expect(supabase.rpc()).resolves.toEqual({
      error: rpcError,
    });
    expect(fullMatchResponse.responseBody.matchStatus).toBe('FULL_MATCH');
    expect(noMatchResponse.responseBody.matchStatus).toBe('NO_MATCH');
  });
});
