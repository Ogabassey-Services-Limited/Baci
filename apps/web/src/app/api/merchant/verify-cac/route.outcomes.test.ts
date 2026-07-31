import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateApiRequest,
  compareCACData,
  getMerchantForApiRequest,
  makeFormDataRequest,
  makeSupabaseMock,
  makeValidFile,
  resetVerifyCacMocks,
} from '@/test-support/verify-cac-route.test-support';

async function loadVerifyCacPost() {
  return (await import('./route')).POST;
}

describe('POST /api/merchant/verify-cac verification outcomes', () => {
  let POST: typeof import('./route').POST;

  beforeEach(async () => {
    resetVerifyCacMocks();
    POST = await loadVerifyCacPost();
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns 200 with verified: true when CAC data matches', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(compareCACData).mockReturnValue({ match: true });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies Ltd',
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ verified: true });
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_cac_verification',
      expect.objectContaining({
        p_merchant_id: '11111111-1111-4111-8111-111111111111',
        p_rc_number: 'RC123456',
        p_cac_approved_name: 'Baci Technologies Ltd',
      })
    );
  });

  it('records CAC verification for the exact merchant selected by a multi-merchant owner', async () => {
    const supabaseMock = makeSupabaseMock();
    const selectedMerchantId = '22222222-2222-4222-8222-222222222222';
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(getMerchantForApiRequest).mockResolvedValue({
      merchantId: selectedMerchantId,
      staffAccess: {
        isOwner: true,
        isStaff: false,
        permissions: { full_access: { all: true } },
        role: null,
      },
    });
    const res = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        merchantId: selectedMerchantId,
        rcNumber: 'RC123456',
      })
    );
    expect(res.status).toBe(200);
    expect(getMerchantForApiRequest).toHaveBeenCalledWith(
      supabaseMock,
      'user-1',
      { requestedMerchantId: selectedMerchantId }
    );
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      'record_cac_verification',
      expect.objectContaining({ p_merchant_id: selectedMerchantId })
    );
  });

  it('returns 200 with verified: false and reason when data does not match', async () => {
    vi.mocked(compareCACData).mockReturnValue({
      match: false,
      reason: 'RC number mismatch',
    });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC999999',
        approvedName: 'Baci Technologies Ltd',
      })
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      verified: false,
      reason: 'RC number mismatch',
    });
  });

  it('returns 409 when CAC RPC reports an identity conflict', async () => {
    const supabaseMock = makeSupabaseMock(null, {
      code: 'PT409',
      details: 'CAC verification would overwrite an existing legal identity.',
      message: 'cac_identity_conflict',
    });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(compareCACData).mockReturnValue({ match: true });
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies Ltd',
      })
    );
    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      code: 'CAC_IDENTITY_CONFLICT',
      details: 'CAC verification would overwrite an existing legal identity.',
      error: 'CAC identity conflict',
    });
  });

  it('returns 500 when RPC throws', async () => {
    const supabaseMock = makeSupabaseMock();
    supabaseMock.rpc.mockRejectedValue(new Error('DB error'));
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: supabaseMock,
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    const res = await POST(
      makeFormDataRequest({
        file: makeValidFile(),
        rcNumber: 'RC123456',
        approvedName: 'Baci Technologies Ltd',
      })
    );
    expect(res.status).toBe(500);
    expect(supabaseMock.storageBucket.remove).toHaveBeenCalledOnce();
  });
});
