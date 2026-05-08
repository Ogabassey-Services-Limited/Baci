import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCookies = vi.fn();
const mockCreateClient = vi.fn();

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (cookieStore: unknown) => mockCreateClient(cookieStore),
}));

import { getPlatformAdminAuth } from './platform-admin-auth';

interface MockUser {
  email?: string | null;
  id: string;
}

interface MerchantResult {
  data: { is_platform_admin: boolean } | null;
  error: { message: string } | null;
}

function createSupabaseMock({
  merchantResult,
  user,
  userError = null,
}: {
  merchantResult?: MerchantResult;
  user: MockUser | null;
  userError?: { message: string } | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(
    merchantResult ?? {
      data: { is_platform_admin: true },
      error: null,
    }
  );
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getUser = vi.fn().mockResolvedValue({
    data: { user },
    error: userError,
  });

  return {
    from,
    getUser,
    maybeSingle,
    select,
    supabase: {
      auth: { getUser },
      from,
    },
  };
}

describe('getPlatformAdminAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockResolvedValue({ get: vi.fn(), set: vi.fn() });
  });

  it('checks the authenticated user before querying admin privileges', async () => {
    const supabaseMock = createSupabaseMock({
      user: { email: 'admin@example.com', id: 'user-1' },
    });
    mockCreateClient.mockReturnValue(supabaseMock.supabase);

    const result = await getPlatformAdminAuth();

    expect(result).toEqual({
      status: 'authenticated',
      user: { email: 'admin@example.com', id: 'user-1' },
    });
    expect(supabaseMock.getUser).toHaveBeenCalledOnce();
    expect(supabaseMock.from).toHaveBeenCalledWith('merchants');
    expect(supabaseMock.select).toHaveBeenCalledWith('is_platform_admin');
  });

  it('does not query merchants when there is no authenticated user', async () => {
    const supabaseMock = createSupabaseMock({ user: null });
    mockCreateClient.mockReturnValue(supabaseMock.supabase);

    const result = await getPlatformAdminAuth();

    expect(result).toEqual({ status: 'unauthenticated' });
    expect(supabaseMock.from).not.toHaveBeenCalled();
  });

  it('fails closed when the authenticated user is not a platform admin', async () => {
    const supabaseMock = createSupabaseMock({
      merchantResult: {
        data: { is_platform_admin: false },
        error: null,
      },
      user: { email: 'merchant@example.com', id: 'user-2' },
    });
    mockCreateClient.mockReturnValue(supabaseMock.supabase);

    const result = await getPlatformAdminAuth();

    expect(result).toEqual({ status: 'forbidden' });
  });

  it('fails closed when admin privilege lookup errors', async () => {
    const supabaseMock = createSupabaseMock({
      merchantResult: {
        data: null,
        error: { message: 'permission denied' },
      },
      user: { email: 'admin@example.com', id: 'user-1' },
    });
    mockCreateClient.mockReturnValue(supabaseMock.supabase);

    const result = await getPlatformAdminAuth();

    expect(result).toEqual({ status: 'forbidden' });
  });
});
