// @vitest-environment node
// jose's JWS signer checks `payload instanceof Uint8Array`; jsdom's TextEncoder
// yields a cross-realm Uint8Array that fails that check. The route handlers run
// in the Node runtime, so the node environment matches production here.
import { generateKeyPairSync } from 'node:crypto';
import { importSPKI, jwtVerify } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import {
  type AscCredentials,
  createAscToken,
  fetchLiveAppStoreBuild,
} from './app-store-connect';

const { privateKey, publicKey } = generateKeyPairSync('ec', {
  namedCurve: 'P-256',
});
const privatePem = privateKey.export({
  type: 'pkcs8',
  format: 'pem',
}) as string;
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

const credentials: AscCredentials = {
  keyId: 'KEY123',
  issuerId: 'ISSUER-456',
  privateKey: privatePem,
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createAscToken', () => {
  it('signs an ES256 token with the expected header and claims', async () => {
    const token = await createAscToken(credentials, 1_000_000);

    const key = await importSPKI(publicPem, 'ES256');
    const { protectedHeader, payload } = await jwtVerify(token, key, {
      audience: 'appstoreconnect-v1',
      // The token is signed with a fixed past timestamp; evaluate the exp check
      // inside its validity window rather than at the real wall clock.
      currentDate: new Date(1_000_300 * 1000),
    });

    expect(protectedHeader.alg).toBe('ES256');
    expect(protectedHeader.kid).toBe('KEY123');
    expect(payload.iss).toBe('ISSUER-456');
    expect(payload.iat).toBe(1_000_000);
    expect(payload.exp).toBe(1_000_600);
  });

  it('accepts a PEM stored with escaped newlines', async () => {
    const escaped: AscCredentials = {
      ...credentials,
      privateKey: privatePem.replace(/\n/g, '\\n'),
    };

    await expect(createAscToken(escaped, 1_000_000)).resolves.toEqual(
      expect.any(String)
    );
  });
});

describe('fetchLiveAppStoreBuild', () => {
  function versionsPayload(state: string) {
    return {
      data: [
        {
          id: 'v1',
          type: 'appStoreVersions',
          attributes: { versionString: '2.1.360', appStoreState: state },
          relationships: { build: { data: { id: 'b1', type: 'builds' } } },
        },
      ],
      included: [{ id: 'b1', type: 'builds', attributes: { version: '360' } }],
    };
  }

  it('returns the CFBundleVersion of the live App Store version', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'app123' }] }))
      .mockResolvedValueOnce(jsonResponse(versionsPayload('READY_FOR_SALE')));

    const result = await fetchLiveAppStoreBuild(
      'com.ogabassey.app',
      credentials,
      fetchFn as unknown as typeof fetch
    );

    expect(result).toEqual({ build: 360, versionString: '2.1.360' });
    // First call resolves the app id, second pulls versions with the build.
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('accepts the newer "state" field value', async () => {
    const payload = {
      data: [
        {
          id: 'v1',
          type: 'appStoreVersions',
          attributes: {
            versionString: '2.1.360',
            state: 'READY_FOR_DISTRIBUTION',
          },
          relationships: { build: { data: { id: 'b1' } } },
        },
      ],
      included: [{ id: 'b1', type: 'builds', attributes: { version: '360' } }],
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'app123' }] }))
      .mockResolvedValueOnce(jsonResponse(payload));

    const result = await fetchLiveAppStoreBuild(
      'com.ogabassey.app',
      credentials,
      fetchFn as unknown as typeof fetch
    );

    expect(result?.build).toBe(360);
  });

  it('returns null when no version is in a live state', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'app123' }] }))
      .mockResolvedValueOnce(
        jsonResponse(versionsPayload('PENDING_DEVELOPER_RELEASE'))
      );

    const result = await fetchLiveAppStoreBuild(
      'com.ogabassey.app',
      credentials,
      fetchFn as unknown as typeof fetch
    );

    expect(result).toBeNull();
  });

  it('throws when no app matches the bundle id', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse({ data: [] }));

    await expect(
      fetchLiveAppStoreBuild(
        'com.ogabassey.app',
        credentials,
        fetchFn as unknown as typeof fetch
      )
    ).rejects.toThrow('No App Store Connect app found');
  });

  it('throws when the live version has no usable CFBundleVersion', async () => {
    const payload = {
      data: [
        {
          id: 'v1',
          type: 'appStoreVersions',
          attributes: {
            versionString: '2.1.360',
            appStoreState: 'READY_FOR_SALE',
          },
          relationships: { build: { data: { id: 'b1' } } },
        },
      ],
      included: [{ id: 'b1', type: 'builds', attributes: { version: 'abc' } }],
    };
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'app123' }] }))
      .mockResolvedValueOnce(jsonResponse(payload));

    await expect(
      fetchLiveAppStoreBuild(
        'com.ogabassey.app',
        credentials,
        fetchFn as unknown as typeof fetch
      )
    ).rejects.toThrow('missing a usable CFBundleVersion');
  });

  it('throws on a non-OK App Store Connect response', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response('forbidden', { status: 403 }));

    await expect(
      fetchLiveAppStoreBuild(
        'com.ogabassey.app',
        credentials,
        fetchFn as unknown as typeof fetch
      )
    ).rejects.toThrow('App Store Connect API 403');
  });
});
