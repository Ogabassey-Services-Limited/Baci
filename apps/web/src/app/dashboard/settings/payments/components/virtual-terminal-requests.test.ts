import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import {
  createVirtualTerminalAccount,
  createVirtualTerminalBranch,
  fetchVirtualTerminalData,
  VirtualTerminalRequestError,
} from './virtual-terminal-requests';

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));

const merchantId = '22222222-2222-4222-8222-222222222222';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('virtual terminal requests', () => {
  it('loads terminal and branch data for the selected merchant', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ terminals: [{ id: 'terminal-b' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ branches: [{ id: 'branch-b' }] }),
        })
    );

    const result = await fetchVirtualTerminalData(merchantId);

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      `/api/paystack/virtual-terminal?merchantId=${merchantId}`
    );
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/branches', {
      headers: { 'x-baci-merchant-id': merchantId },
    });
    expect(result.accounts).toEqual({
      data: [{ id: 'terminal-b' }],
      error: null,
    });
    expect(result.branches).toEqual({
      data: [{ id: 'branch-b' }],
      error: null,
    });
  });

  it('keeps successful terminal data when branch loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ terminals: [{ id: 'terminal-b' }] }),
        })
        .mockResolvedValueOnce({ ok: false })
    );

    const result = await fetchVirtualTerminalData(merchantId);

    expect(result.accounts).toEqual({
      data: [{ id: 'terminal-b' }],
      error: null,
    });
    expect(result.branches).toEqual({
      data: null,
      error: expect.objectContaining({ resource: 'branches' }),
    });
  });

  it('keeps successful branch data when terminal loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ branches: [{ id: 'branch-b' }] }),
        })
    );

    const result = await fetchVirtualTerminalData(merchantId);

    expect(result.accounts).toEqual({
      data: null,
      error: expect.objectContaining({ resource: 'accounts' }),
    });
    expect(result.branches).toEqual({
      data: [{ id: 'branch-b' }],
      error: null,
    });
  });

  it('retains scoped errors when both selected-merchant resources fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: false })
    );

    const result = await fetchVirtualTerminalData(merchantId);

    expect(result.accounts).toEqual({
      data: null,
      error: expect.any(VirtualTerminalRequestError),
    });
    expect(result.branches).toEqual({
      data: null,
      error: expect.any(VirtualTerminalRequestError),
    });
  });

  it('creates a terminal and branch for the selected merchant', async () => {
    vi.mocked(fetchWithCsrf).mockResolvedValue({ ok: true } as Response);

    await createVirtualTerminalAccount(merchantId, {
      name: 'Merchant B Till',
      destinations: [],
    });
    await createVirtualTerminalBranch(merchantId, {
      name: 'Merchant B Branch',
      isDefault: true,
    });

    const terminalBody = JSON.parse(
      String(vi.mocked(fetchWithCsrf).mock.calls[0]?.[1]?.body)
    );
    expect(terminalBody).toEqual(
      expect.objectContaining({ merchantId, name: 'Merchant B Till' })
    );
    expect(fetchWithCsrf).toHaveBeenNthCalledWith(
      2,
      '/api/branches',
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-baci-merchant-id': merchantId }),
      })
    );
  });

  it('surfaces failed selected-merchant mutations', async () => {
    vi.mocked(fetchWithCsrf).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Merchant B create failed' }),
    } as Response);

    await expect(
      createVirtualTerminalAccount(merchantId, {
        name: 'Merchant B Till',
        destinations: [],
      })
    ).rejects.toThrow('Merchant B create failed');
  });
});
