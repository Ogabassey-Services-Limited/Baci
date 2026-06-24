import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileIosLiveBuild } from './ios-live-build-reconcile';

const mockCredentials = vi.fn();
vi.mock('@/env', () => ({
  getAppStoreConnectCredentials: () => mockCredentials(),
  getAppStoreConnectBundleId: () => 'com.ogabassey.app',
}));

const mockFetchLive = vi.fn();
vi.mock('@/lib/app-store-connect', () => ({
  fetchLiveAppStoreBuild: (...args: unknown[]) => mockFetchLive(...args),
}));

const mockWrite = vi.fn();
vi.mock('@/lib/mobile-release-gate-store', () => ({
  writeLatestLiveBuild: (...args: unknown[]) => mockWrite(...args),
}));

describe('reconcileIosLiveBuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCredentials.mockReturnValue({
      keyId: 'k',
      issuerId: 'i',
      privateKey: 'pem',
    });
  });

  it('skips when App Store Connect credentials are missing', async () => {
    mockCredentials.mockReturnValue(null);

    const result = await reconcileIosLiveBuild();

    expect(result).toEqual({
      synced: false,
      skipped: 'asc_credentials_missing',
    });
    expect(mockFetchLive).not.toHaveBeenCalled();
  });

  it('skips when no version is live on the App Store', async () => {
    mockFetchLive.mockResolvedValue(null);

    const result = await reconcileIosLiveBuild();

    expect(result).toEqual({ synced: false, skipped: 'no_live_version' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes the live build and returns it with the passed source', async () => {
    mockFetchLive.mockResolvedValue({ build: 360, versionString: '2.1.360' });
    mockWrite.mockResolvedValue(undefined);

    const result = await reconcileIosLiveBuild('app_store_connect_webhook');

    expect(mockWrite).toHaveBeenCalledWith({
      platform: 'ios',
      build: 360,
      source: 'app_store_connect_webhook',
    });
    expect(result).toEqual({
      synced: true,
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });
});
