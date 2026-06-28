import { describe, expect, it, vi } from 'vitest';
import {
  fetchLiveGooglePlayBuild,
  parseGooglePlayServiceAccountJson,
} from './google-play';

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvN4vRXiOgrUkh
SNKlF/SbgHLTdySsxw/uoyBPlUWuzCK9MflkjnAX26IxrLyA+uE4LrcK5wcKH5Rb
aVASYXGiPp/XsFfXs+5VNZiQ01QniTecsYi/RtWbCXhlg6yJ+CeHIuw4lgSOKxuq
BeK7nqA04wc7dwPO3qYBEd4rqAAUwV43Sn9mcGoJ3clmByKvHYJhXsSUd3rlemSE
pWPE2FAzKyhBTZHIYiibYk0qMDLyfXfDAgoBMeR1xJoDMxlbOz7gbNrxx1/S9NgE
+KAccwPWcFC5ODdCyT3Rf9K69uAmgv21wPYzClg9eda+ENKDWa4omNp0gUXDRkqa
61mjSdanAgMBAAECggEAUeK/sSUxuVHCr499AjLj2hh5kWJI/YY6Z+hMnWTBoCM+
yPSl/NykfkHi1xxHLHAS+VK7sJivrYd8qgvZo/1uQcjKot6C7wfkBmZ52pUo6yEx
oEVIBzxvb3lJjweuhvw2XO1xQDC8CEUVNKxzfgNwE8dWBfBlEzTyl+Vl0zk8cHX3
+EYKFn58R1uCjWFLjnZWq7s+shL7LJhg+jOfWriqYZVL1kxcETM1X8KyipXvPgal
wrR38kLgW5IV7tj5rphexSSp3q3ERYj+wdgb8yr6vYE3XnGQBFBRuM1x7Migz3Eq
JEW9m1SDJjj39Zutk2PH2LYkgw7Cq7Tzk3ePDkRwIQKBgQDfZZ8YNv9k2k0lMifk
tXMEKjeY6v6GCFNlycuH4mP4OL49lqGlNzwgnE9oDksvisEuzpCBKWtCpEi+Df27
9hUtqxcJp6Jsx1O149oOvKmynQWMyMie+WNNePJqlA6nyyB4ROCLpU/oj4slxpPT
Dwz/kkHGEWqI2smnalEXEjhklQKBgQDIydzdZs1wyu6bXmaSqguKd906mIH5HQwi
g/tQFGdlTKQaetwupuLopPhUXWMCPEGWAfclWwMXYiFGgKKWZxqnrgBWIFJ2CyaY
5QyIQLxUQz8xvM6PCxvd4ZpjwOnpdBNe+v3BTfP0Wp1/IR2vluzeOdAqV8LONMBy
Tn/TlfQjSwKBgQCMUrribPlzkiRPLvgcE1XR0ermZQXHj0dDcsQj8LK24n2tFgcn
TlC4czb1t7TGgjPigOIIH8o+LA99QjCVdnfLHeL0r5W5GmOcpyj7hMpbZYJs8loC
cchMi6JKDAJAp7kXkrwxO3+8Jx5Sdi+4rYWOq4IhNiNjH3r3bDLPeSRvGQKBgFp3
WSQIJZgkVs16Aw0hwIFq8CpufGEZTVZf0OOLzeo+VdH4eSwr1SCs85ZPXUSskYBc
8lXKY+ItPIDfhGHvonraUxx7A6xb6dAJo1PglvoAMoDeaNLaVnvqIf2/9aRRwEiT
HbHyxW/bRAr7iLyMa7zUn430bLkr22mlJMLYVV9xAoGBAIJEYIqvUgr8ydpJC6ij
hxu9drHEOahTsP77ini85ZO2wbiln7F1AU6TZDQbu7xm3ySR4plcq1jIJH7VZnq3
BJYjY4OADElDxBnLmsPmv54cbRKmqEnZnXDCx788NDwnzZ3HIcn/wJxRP94lCnHQ
4BHxkCE0z7jdw8eHfNVgGdFS
-----END PRIVATE KEY-----`;

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
