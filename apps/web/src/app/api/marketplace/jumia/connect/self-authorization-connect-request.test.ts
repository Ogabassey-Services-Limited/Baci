import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateJumiaSelfAuthorization } from '@/lib/jumia/self-authorization';
import {
  consumeJumiaSelfAuthorizationDiscovery,
  createJumiaSelfAuthorizationDiscovery,
  loadJumiaSelfAuthorizationDiscovery,
} from '@/lib/jumia/self-authorization-discovery-store';
import { handleJumiaSelfAuthorizationConnectRequest } from './self-authorization-connect-request';
import { jumiaSelfAuthorizationHandler } from './self-authorization-handler';

const { mockCreateAdminClient } = vi.hoisted(() => ({
  mockCreateAdminClient: vi.fn(),
}));

vi.mock('@/lib/jumia/self-authorization', () => ({
  validateJumiaSelfAuthorization: vi.fn(),
}));

vi.mock('@/lib/jumia/self-authorization-discovery-store', () => ({
  createJumiaSelfAuthorizationDiscovery: vi.fn(),
  consumeJumiaSelfAuthorizationDiscovery: vi.fn(),
  loadJumiaSelfAuthorizationDiscovery: vi.fn(),
}));

vi.mock('@/lib/jumia/authorization-crypto', () => ({
  jumiaAuthorizationCrypto: {
    encrypt: vi.fn(() => 'ciphertext'),
    decrypt: vi.fn(() => ({
      clientId: 'client-1',
      refreshToken: 'refresh-1',
      accessToken: 'access-1',
    })),
    buildAuthorizationContext: vi.fn(
      (merchantId: string, clientKeyHash: string) =>
        `${merchantId}:${clientKeyHash}`
    ),
  },
}));

vi.mock('./self-authorization-handler', () => ({
  jumiaSelfAuthorizationHandler: {
    discover: vi.fn(async () => Response.json({ shops: [] })),
    connect: vi.fn(async () => Response.json({ connected: [] })),
  },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: mockCreateAdminClient,
}));

function buildSupabase(existing: unknown[] = []) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              data: existing,
              error: null,
            }),
          }),
        }),
      }),
    }),
    rpc: vi.fn(),
  } as never;
}

describe('handleJumiaSelfAuthorizationConnectRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when a selection request is missing discoveryId', async () => {
    const response = await handleJumiaSelfAuthorizationConnectRequest({
      body: {
        connectionType: 'self_authorization',
        clientId: 'client-1',
        selectedShopIds: ['shop-1'],
      } as never,
      encryptionKey: 'a'.repeat(44),
      merchantId: '00000000-0000-4000-8000-000000000001',
      supabase: {
        from: vi.fn(),
        rpc: vi.fn(),
      } as never,
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid input',
    });
  });

  it('scopes single-marketplace self-authorizations to shop:country during discovery', async () => {
    vi.mocked(validateJumiaSelfAuthorization).mockResolvedValue({
      credentials: {
        clientId: 'client-1',
        refreshToken: 'refresh-1',
        accessToken: 'access-1',
      },
      accessTokenExpiresAt: '2026-03-27T10:00:00.000Z',
      refreshTokenExpiresAt: '2026-04-27T10:00:00.000Z',
      shops: [],
    });
    vi.mocked(createJumiaSelfAuthorizationDiscovery).mockResolvedValue(
      'discovery-1'
    );

    await handleJumiaSelfAuthorizationConnectRequest({
      body: {
        connectionType: 'self_authorization',
        operation: 'discover',
        clientId: 'client-1',
        refreshToken: 'refresh-1',
      },
      encryptionKey: 'a'.repeat(44),
      merchantId: '00000000-0000-4000-8000-000000000001',
      supabase: buildSupabase([
        {
          shop_id: 'shop-1',
          country_code: 'NG',
          marketplace_key: 'default',
          connection_method: 'self_authorization',
        },
      ]),
    });

    expect(jumiaSelfAuthorizationHandler.discover).toHaveBeenCalledWith(
      expect.objectContaining({
        existingShopIds: new Set(['shop-1:NG']),
      })
    );
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it('consumes discovery credentials only after a successful connect', async () => {
    vi.mocked(loadJumiaSelfAuthorizationDiscovery).mockResolvedValue(
      'ciphertext'
    );
    vi.mocked(consumeJumiaSelfAuthorizationDiscovery).mockResolvedValue(
      'ciphertext'
    );
    vi.mocked(jumiaSelfAuthorizationHandler.connect).mockResolvedValue(
      NextResponse.json({ connected: ['shop-1'] })
    );

    const response = await handleJumiaSelfAuthorizationConnectRequest({
      body: {
        connectionType: 'self_authorization',
        discoveryId: '00000000-0000-4000-8000-000000000099',
        clientId: 'client-1',
        selectedShopIds: ['shop-1'],
      },
      encryptionKey: 'a'.repeat(44),
      merchantId: '00000000-0000-4000-8000-000000000001',
      supabase: buildSupabase(),
    });

    expect(response.ok).toBe(true);
    expect(loadJumiaSelfAuthorizationDiscovery).toHaveBeenCalled();
    expect(consumeJumiaSelfAuthorizationDiscovery).toHaveBeenCalled();
  });

  it('keeps discovery credentials when connect fails after token rotation', async () => {
    vi.mocked(loadJumiaSelfAuthorizationDiscovery).mockResolvedValue(
      'ciphertext'
    );
    vi.mocked(jumiaSelfAuthorizationHandler.connect).mockResolvedValue(
      NextResponse.json({ error: 'Shop discovery failed' }, { status: 502 })
    );

    const response = await handleJumiaSelfAuthorizationConnectRequest({
      body: {
        connectionType: 'self_authorization',
        discoveryId: '00000000-0000-4000-8000-000000000099',
        clientId: 'client-1',
        selectedShopIds: ['shop-1'],
      },
      encryptionKey: 'a'.repeat(44),
      merchantId: '00000000-0000-4000-8000-000000000001',
      supabase: buildSupabase(),
    });

    expect(response.status).toBe(502);
    expect(consumeJumiaSelfAuthorizationDiscovery).not.toHaveBeenCalled();
  });
});
