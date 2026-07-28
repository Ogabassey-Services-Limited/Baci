import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAnonClient: vi.fn(),
  createScopedClient: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

vi.mock('@/lib/supabase/scoped', () => ({
  createScopedClient: mocks.createScopedClient,
}));

import { getMobileBearerUser } from './get-mobile-bearer-user';

function request(authorization?: string): NextRequest {
  return new NextRequest(
    'https://usebaci.com/api/mobile/merchant-provisioning',
    {
      headers: authorization ? { Authorization: authorization } : undefined,
    }
  );
}

describe('getMobileBearerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAnonClient.mockReturnValue({
      auth: { getUser: mocks.getUser },
    });
    mocks.createScopedClient.mockReturnValue({ rpc: vi.fn() });
  });

  it.each([
    undefined,
    '',
    'Basic token',
    'Bearer',
    'Bearer ',
    'Bearer one two',
    'Bearer one,two',
    'Bearer one, Bearer two',
  ])('rejects a missing or malformed single bearer credential: %s', async (auth) => {
    await expect(getMobileBearerUser(request(auth))).resolves.toEqual({
      authenticated: false,
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.createScopedClient).not.toHaveBeenCalled();
  });

  it('rejects an invalid or expired token', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'expired' },
    });

    await expect(
      getMobileBearerUser(request('Bearer expired-token'))
    ).resolves.toEqual({ authenticated: false });
    expect(mocks.getUser).toHaveBeenCalledWith('expired-token');
    expect(mocks.createScopedClient).not.toHaveBeenCalled();
  });

  it('returns the verified user and a client scoped to the same token', async () => {
    const user = { id: 'user-1', email: 'merchant@example.com' };
    const scopedClient = { rpc: vi.fn() };
    mocks.getUser.mockResolvedValue({ data: { user }, error: null });
    mocks.createScopedClient.mockReturnValue(scopedClient);

    await expect(
      getMobileBearerUser(request('bearer valid-token'))
    ).resolves.toEqual({
      authenticated: true,
      user,
      supabase: scopedClient,
    });
    expect(mocks.createScopedClient).toHaveBeenCalledWith('valid-token');
  });
});
