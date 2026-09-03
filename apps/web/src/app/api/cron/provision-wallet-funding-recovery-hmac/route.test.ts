import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, maxDuration } from './route';

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

const mocks = vi.hoisted(() => ({
  provision: vi.fn(),
  createServiceClient: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/lib/provision-merchant-wallet-funding-recovery-hmac', () => ({
  provisionMerchantWalletFundingRecoveryHmac: mocks.provision,
}));

vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: mocks.loggerError },
}));

const SECRET = 'test-cron-secret';

function cronRequest(authHeader?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (authHeader) {
    headers.Authorization = authHeader;
  }
  return new NextRequest(
    'http://localhost:3000/api/cron/provision-wallet-funding-recovery-hmac',
    { method: 'GET', headers }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', SECRET);
  mocks.createServiceClient.mockReturnValue({ client: true });
  mocks.provision.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/cron/provision-wallet-funding-recovery-hmac', () => {
  it('exposes a bounded maxDuration', () => {
    expect(maxDuration).toBe(30);
  });

  it('rejects unauthorized callers', async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(401);
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it('provisions the shared recovery HMAC with the service client', async () => {
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(mocks.createServiceClient).toHaveBeenCalledOnce();
    expect(mocks.provision).toHaveBeenCalledWith({ client: true });
    await expect(response.json()).resolves.toEqual({
      provisioned: true,
      success: true,
    });
  });
});
