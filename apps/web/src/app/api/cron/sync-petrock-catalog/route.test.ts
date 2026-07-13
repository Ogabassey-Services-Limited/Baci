import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  getAccount: vi.fn(),
  getCronSecret: vi.fn<() => string | undefined>(() => 'cron-secret'),
  getPetrockConfig: vi.fn(),
  getProducts: vi.fn(),
}));

vi.mock('@/env', () => ({
  getCronSecret: mocks.getCronSecret,
  getPetrockConfig: mocks.getPetrockConfig,
}));

vi.mock('@/lib/imei-providers/petrock/petrock-client', () => ({
  createPetrockClient: () => ({
    getAccount: mocks.getAccount,
    getProducts: mocks.getProducts,
  }),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { GET } from './route';

function request(secret = 'cron-secret') {
  return new Request('https://usebaci.com/api/cron/sync-petrock-catalog', {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe('GET /api/cron/sync-petrock-catalog', () => {
  const rpc = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue('cron-secret');
    mocks.getPetrockConfig.mockReturnValue({
      baseUrl: 'https://api.petrock.biz/api/reseller/v1',
      token: 'token',
    });
    rpc.mockResolvedValue({ error: null });
    mocks.createAdminClient.mockReturnValue({ rpc });
    mocks.getAccount.mockResolvedValue({
      data: { balance: 20, currency: 'USD' },
      ok: true,
      rawText: '{}',
    });
    mocks.getProducts.mockResolvedValue({
      data: {
        data: {
          categories: { C164: { name: 'IMEI checks' } },
          currency: 'USD',
          products: {
            '1955': {
              cids: ['C164'],
              fields: [{ name: 'IMEI' }],
              name: 'Blacklist Check',
              price: 0.019,
              type: 'imei',
            },
            gift: {
              fields: [{ name: 'Email' }],
              name: 'Gift Card',
              price: 10,
              type: 'digital',
            },
          },
        },
      },
      ok: true,
      rawText: '{}',
    });
  });

  it('rejects an invalid cron secret', async () => {
    const response = await GET(request('wrong'));

    expect(response.status).toBe(401);
    expect(mocks.getProducts).not.toHaveBeenCalled();
  });

  it('skips safely when Petrock is not configured', async () => {
    mocks.getPetrockConfig.mockReturnValue(null);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      skipped: 'petrock_not_configured',
      success: true,
    });
  });

  it('stores only normalized IMEI products and reports a low balance', async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'sync_petrock_imei_provider_products',
      {
        p_rows: [
          expect.objectContaining({
            order_field_name: 'IMEI',
            product_id: '1955',
            provider: 'petrock',
          }),
        ],
      }
    );
    expect(await response.json()).toMatchObject({
      account: { balance: 20, currency: 'USD', lowBalance: true },
      productCount: 1,
      remediationCandidateCount: 1,
      success: true,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'sync_petrock_remediation_products',
      {
        p_rows: [expect.objectContaining({ provider_product_id: '1955' })],
      }
    );
  });

  it('rejects an unexpectedly empty IMEI catalog without changing the snapshot', async () => {
    mocks.getProducts.mockResolvedValue({
      data: {
        data: { categories: {}, currency: 'USD', products: {} },
      },
      ok: true,
      rawText: '{}',
    });

    const response = await GET(request());

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: 'PETROCK_CATALOG_EMPTY',
    });
    expect(mocks.createAdminClient).not.toHaveBeenCalled();
  });
});
