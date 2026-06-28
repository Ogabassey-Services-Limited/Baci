import { generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  fetchLiveGooglePlayBuild,
  parseGooglePlayServiceAccountJson,
} from './google-play';

const PRIVATE_KEY = generateKeyPairSync('rsa', {
  modulusLength: 2048,
})
  .privateKey.export({ format: 'pem', type: 'pkcs8' })
  .toString();

function credentials() {
  return {
    clientEmail: 'play-service@example.iam.gserviceaccount.com',
    privateKey: PRIVATE_KEY,
  };
}

function makeFetch(releases: unknown[]) {
  const fetchFn = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'token' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ releases }),
    });
  return fetchFn as unknown as typeof fetch;
}

describe('parseGooglePlayServiceAccountJson', () => {
  it('parses the service account JSON fields used for OAuth', () => {
    expect(
      parseGooglePlayServiceAccountJson(
        JSON.stringify({
          client_email: ' play@example.com ',
          private_key: ' private ',
          token_uri: ' https://oauth.example/token ',
        })
      )
    ).toEqual({
      clientEmail: 'play@example.com',
      privateKey: 'private',
      tokenUri: 'https://oauth.example/token',
    });
  });

  it('rejects malformed service account JSON', () => {
    expect(() => parseGooglePlayServiceAccountJson('{')).toThrow('valid JSON');
    expect(() => parseGooglePlayServiceAccountJson('{}')).toThrow(
      'client_email and private_key'
    );
  });
});

describe('fetchLiveGooglePlayBuild', () => {
  it('returns the highest published versionCode from production', async () => {
    const fetchFn = makeFetch([
      {
        releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED',
        versionCodes: ['120', '123'],
      },
      {
        releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_DRAFT',
        versionCodes: ['999'],
      },
    ]);

    const result = await fetchLiveGooglePlayBuild(
      'com.ogabassey.baci',
      credentials(),
      { fetchFn }
    );

    expect(result).toEqual({ build: 123, track: 'production' });
    expect(fetchFn).toHaveBeenLastCalledWith(
      'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.ogabassey.baci/tracks/production/releases',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer token' }),
      })
    );
  });

  it('supports completed track-edit status responses as live', async () => {
    const fetchFn = makeFetch([{ status: 'completed', versionCodes: ['41'] }]);

    await expect(
      fetchLiveGooglePlayBuild('com.example.app', credentials(), { fetchFn })
    ).resolves.toEqual({ build: 41, track: 'production' });
  });

  it('returns null when the track has no published release', async () => {
    const fetchFn = makeFetch([
      {
        releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_DRAFT',
        versionCodes: ['5'],
      },
      { status: 'inProgress', versionCodes: ['6'] },
    ]);

    await expect(
      fetchLiveGooglePlayBuild('com.example.app', credentials(), { fetchFn })
    ).resolves.toBeNull();
  });

  it('throws when Google Play returns a non-OK response', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'token' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'forbidden',
      });

    await expect(
      fetchLiveGooglePlayBuild('com.example.app', credentials(), {
        fetchFn: fetchFn as unknown as typeof fetch,
      })
    ).rejects.toThrow('Google Play track releases 403');
  });
});
