import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExchangeJumiaCode = vi.fn();
const mockGetPlatformAdminAuth = vi.fn();
const mockLoggerError = vi.fn();
const mockLoggerInfo = vi.fn();
const mockLoggerWarn = vi.fn();

vi.mock('@/lib/jumia/helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/jumia/helpers')>(
    '@/lib/jumia/helpers'
  );
  return {
    ...actual,
    exchangeJumiaCode: (...args: unknown[]) => mockExchangeJumiaCode(...args),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    info: (...args: unknown[]) => mockLoggerInfo(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
  },
}));

vi.mock('@/lib/platform-admin-auth', () => ({
  getPlatformAdminAuth: (...args: unknown[]) =>
    mockGetPlatformAdminAuth(...args),
}));

import { runJumiaOAuthCallbackDiagnostic } from './oauth-diagnostic';

function createRedirect(query: Record<string, string | undefined>) {
  const url = new URL('https://usebaci.com/dashboard/channels');
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return NextResponse.redirect(url);
}

const baseInput = {
  apiUserId: 'user-1',
  clientId: 'client-id',
  clientSecret: 'client-secret-must-never-escape',
  code: 'authorization-code-must-never-escape',
  createRedirect,
  diagnosticId: 'diagnostic-id',
  redirectUri: 'https://usebaci.com/api/marketplace/jumia/callback',
  requestUrl:
    'https://usebaci.com/api/marketplace/jumia/callback?code=redacted',
  variant: 'F',
};

describe('Jumia OAuth callback diagnostic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlatformAdminAuth.mockResolvedValue({
      status: 'authenticated',
      user: { id: 'user-1' },
    });
    mockExchangeJumiaCode.mockResolvedValue({
      access_token: 'access-token-must-never-escape',
      expires_in: 3600,
      refresh_token: 'refresh-token-must-never-escape',
      token_type: 'bearer',
    });
  });

  it('returns safe token-shape evidence without exposing credentials', async () => {
    const response = await runJumiaOAuthCallbackDiagnostic(baseInput);
    const location = response.headers.get('location') ?? '';

    expect(location).toContain('has_refresh_token=true');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const serialized = JSON.stringify({
      location,
      logs: mockLoggerInfo.mock.calls,
    });
    expect(serialized).not.toContain('access-token-must-never-escape');
    expect(serialized).not.toContain('refresh-token-must-never-escape');
    expect(serialized).not.toContain('authorization-code-must-never-escape');
    expect(serialized).not.toContain('client-secret-must-never-escape');
  });

  it('rejects an authenticated platform admin with a different identity', async () => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({
      status: 'authenticated',
      user: { id: 'user-2' },
    });

    const response = await runJumiaOAuthCallbackDiagnostic(baseInput);

    expect(response.headers.get('location')).toContain(
      'error=diagnostic_forbidden'
    );
    expect(mockExchangeJumiaCode).not.toHaveBeenCalled();
  });

  it.each([
    'unauthenticated',
    'forbidden',
  ] as const)('rejects the %s platform-admin status before token exchange', async (status) => {
    mockGetPlatformAdminAuth.mockResolvedValueOnce({ status });

    const response = await runJumiaOAuthCallbackDiagnostic(baseInput);

    expect(response.headers.get('location')).toContain(
      'error=diagnostic_forbidden'
    );
    expect(mockExchangeJumiaCode).not.toHaveBeenCalled();
  });

  it('does not report OAuth state matching as hard-coded evidence', async () => {
    await runJumiaOAuthCallbackDiagnostic(baseInput);

    expect(JSON.stringify(mockLoggerInfo.mock.calls)).not.toContain(
      'oauth_state_match'
    );
  });

  it('redacts provider credentials when token exchange fails', async () => {
    mockExchangeJumiaCode.mockRejectedValueOnce(
      Object.assign(new Error('Token exchange failed'), {
        details: JSON.stringify({
          client_secret: 'client-secret-must-never-escape',
          code: 'authorization-code-must-never-escape',
          refresh_token: 'refresh-token-must-never-escape',
        }),
        status: 400,
      })
    );

    const response = await runJumiaOAuthCallbackDiagnostic(baseInput);

    expect(response.headers.get('location')).toContain(
      'error=token_exchange_failed'
    );
    const serializedLogs = JSON.stringify(mockLoggerError.mock.calls);
    expect(serializedLogs).not.toContain('client-secret-must-never-escape');
    expect(serializedLogs).not.toContain(
      'authorization-code-must-never-escape'
    );
    expect(serializedLogs).not.toContain('refresh-token-must-never-escape');
  });
});
