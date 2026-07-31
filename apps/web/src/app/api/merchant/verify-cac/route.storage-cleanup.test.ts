import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  authenticateApiRequest,
  compareCACData,
  extractCACCertificateData,
  makeFormDataRequest,
  makeSupabaseMock,
  makeValidFile,
  resetVerifyCacMocks,
} from '@/test-support/verify-cac-route.test-support';

async function loadVerifyCacPost() {
  return (await import('./route')).POST;
}

function expectUploadedCertificateToBeRemoved(
  remove: ReturnType<typeof vi.fn>
) {
  expect(remove).toHaveBeenCalledWith([
    expect.stringMatching(
      /^11111111-1111-4111-8111-111111111111\/cac-\d+\.jpg$/
    ),
  ]);
}

describe('POST /api/merchant/verify-cac storage cleanup', () => {
  let POST: typeof import('./route').POST;

  beforeEach(async () => {
    resetVerifyCacMocks();
    POST = await loadVerifyCacPost();
  });

  afterEach(() => vi.restoreAllMocks());

  it('removes an uploaded certificate when its contents do not match the claimed CAC identity', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: supabaseMock,
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(compareCACData).mockReturnValue({
      match: false,
      reason: 'RC number mismatch',
    });

    const response = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        rcNumber: 'RC999999',
      })
    );

    expect(response.status).toBe(200);
    expectUploadedCertificateToBeRemoved(supabaseMock.storageBucket.remove);
  });

  it('removes an uploaded certificate when the verification RPC reports an identity conflict', async () => {
    const supabaseMock = makeSupabaseMock(null, { code: 'PT409' });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: supabaseMock,
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const response = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        rcNumber: 'RC123456',
      })
    );

    expect(response.status).toBe(409);
    expectUploadedCertificateToBeRemoved(supabaseMock.storageBucket.remove);
  });

  it('removes an uploaded certificate when the verification RPC fails', async () => {
    const supabaseMock = makeSupabaseMock(null, { code: 'XX000' });
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: supabaseMock,
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const response = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        rcNumber: 'RC123456',
      })
    );

    expect(response.status).toBe(500);
    expectUploadedCertificateToBeRemoved(supabaseMock.storageBucket.remove);
  });

  it('removes an uploaded certificate when certificate extraction fails', async () => {
    const supabaseMock = makeSupabaseMock();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: supabaseMock,
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);
    vi.mocked(extractCACCertificateData).mockRejectedValue(
      new Error('OCR unavailable')
    );

    const response = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        rcNumber: 'RC123456',
      })
    );

    expect(response.status).toBe(500);
    expectUploadedCertificateToBeRemoved(supabaseMock.storageBucket.remove);
  });

  it('removes an uploaded certificate when an unexpected verification failure occurs', async () => {
    const supabaseMock = makeSupabaseMock();
    supabaseMock.rpc.mockRejectedValue(new Error('database disconnected'));
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      error: null,
      supabase: supabaseMock,
      user: { id: 'user-1' },
    } as unknown as Awaited<ReturnType<typeof authenticateApiRequest>>);

    const response = await POST(
      makeFormDataRequest({
        approvedName: 'Baci Technologies Ltd',
        file: makeValidFile(),
        rcNumber: 'RC123456',
      })
    );

    expect(response.status).toBe(500);
    expectUploadedCertificateToBeRemoved(supabaseMock.storageBucket.remove);
  });
});
