import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileAndroidLiveBuild } from './android-live-build-reconcile';

const mockServiceAccountJson = vi.fn();
const mockPackageName = vi.fn((app: 'storefront' | 'admin' = 'storefront') =>
  app === 'admin' ? 'com.ogabassey.baci' : 'com.ogabassey.store'
);
vi.mock('@/env', () => ({
  getGooglePlayServiceAccountJson: () => mockServiceAccountJson(),
  getGooglePlayPackageName: (app?: 'storefront' | 'admin') =>
    mockPackageName(app),
}));

const mockFetchLive = vi.fn();
const mockParseCredentials = vi.fn((raw: string) => ({
  clientEmail: 'play@example.com',
  privateKey: raw,
}));
vi.mock('@/lib/google-play', () => ({
  fetchLiveGooglePlayBuild: (...args: unknown[]) => mockFetchLive(...args),
  parseGooglePlayServiceAccountJson: (raw: string) => mockParseCredentials(raw),
}));

const mockWrite = vi.fn();
vi.mock('@/lib/mobile-release-gate-store', () => ({
  writeLatestLiveBuild: (...args: unknown[]) => mockWrite(...args),
}));

describe('reconcileAndroidLiveBuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceAccountJson.mockReturnValue('{"private_key":"pem"}');
    mockFetchLive.mockResolvedValue({ build: 125, track: 'production' });
    mockWrite.mockResolvedValue(undefined);
  });

  it('skips when Google Play credentials are missing', async () => {
    mockServiceAccountJson.mockReturnValue(undefined);

    const result = await reconcileAndroidLiveBuild('admin');

    expect(result).toEqual({
      synced: false,
      skipped: 'google_play_credentials_missing',
    });
    expect(mockFetchLive).not.toHaveBeenCalled();
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('skips when no Play production release is live', async () => {
    mockFetchLive.mockResolvedValue(null);

    const result = await reconcileAndroidLiveBuild('admin');

    expect(result).toEqual({ synced: false, skipped: 'no_live_release' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes the admin Android live build using the admin package name', async () => {
    const result = await reconcileAndroidLiveBuild(
      'admin',
      'google_play_release_workflow'
    );

    expect(mockPackageName).toHaveBeenCalledWith('admin');
    expect(mockFetchLive).toHaveBeenCalledWith('com.ogabassey.baci', {
      clientEmail: 'play@example.com',
      privateKey: '{"private_key":"pem"}',
    });
    expect(mockWrite).toHaveBeenCalledWith({
      app: 'admin',
      platform: 'android',
      build: 125,
      source: 'google_play_release_workflow',
    });
    expect(result).toEqual({
      synced: true,
      app: 'admin',
      platform: 'android',
      build: 125,
      track: 'production',
    });
  });

  it('writes the storefront Android live build using the storefront package name', async () => {
    mockFetchLive.mockResolvedValue({ build: 646, track: 'production' });

    await reconcileAndroidLiveBuild('storefront');

    expect(mockPackageName).toHaveBeenCalledWith('storefront');
    expect(mockFetchLive).toHaveBeenCalledWith('com.ogabassey.store', {
      clientEmail: 'play@example.com',
      privateKey: '{"private_key":"pem"}',
    });
    expect(mockWrite).toHaveBeenCalledWith({
      app: 'storefront',
      platform: 'android',
      build: 646,
      source: 'google_play_live_track',
    });
  });
});
