import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileIosLiveBuild } from './ios-live-build-reconcile';

const mockCredentials = vi.fn();
const mockBundleId = vi.fn((app: 'storefront' | 'admin' = 'storefront') =>
  app === 'admin' ? 'com.ogabassey.baci' : 'com.ogabassey.app'
);
vi.mock('@/env', () => ({
  getAppStoreConnectCredentials: () => mockCredentials(),
  getAppStoreConnectBundleId: (app?: 'storefront' | 'admin') =>
    mockBundleId(app),
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

    const result = await reconcileIosLiveBuild('storefront');

    expect(result).toEqual({
      synced: false,
      skipped: 'asc_credentials_missing',
    });
    expect(mockFetchLive).not.toHaveBeenCalled();
  });

  it('skips when no version is live on the App Store', async () => {
    mockFetchLive.mockResolvedValue(null);

    const result = await reconcileIosLiveBuild('storefront');

    expect(result).toEqual({ synced: false, skipped: 'no_live_version' });
    expect(mockWrite).not.toHaveBeenCalled();
  });

  it('writes the storefront live build and returns it with the passed source', async () => {
    mockFetchLive.mockResolvedValue({ build: 360, versionString: '2.1.360' });
    mockWrite.mockResolvedValue(undefined);

    const result = await reconcileIosLiveBuild(
      'storefront',
      'app_store_connect_webhook'
    );

    expect(mockBundleId).toHaveBeenCalledWith('storefront');
    expect(mockWrite).toHaveBeenCalledWith({
      app: 'storefront',
      platform: 'ios',
      build: 360,
      source: 'app_store_connect_webhook',
    });
    expect(result).toEqual({
      synced: true,
      app: 'storefront',
      platform: 'ios',
      build: 360,
      versionString: '2.1.360',
    });
  });

  it('writes the admin live build using the admin bundle id', async () => {
    mockFetchLive.mockResolvedValue({ build: 22, versionString: '2.0.1' });
    mockWrite.mockResolvedValue(undefined);

    const result = await reconcileIosLiveBuild(
      'admin',
      'app_store_connect_webhook'
    );

    expect(mockBundleId).toHaveBeenCalledWith('admin');
    expect(mockFetchLive).toHaveBeenCalledWith(
      'com.ogabassey.baci',
      expect.anything()
    );
    expect(mockWrite).toHaveBeenCalledWith({
      app: 'admin',
      platform: 'ios',
      build: 22,
      source: 'app_store_connect_webhook',
    });
    expect(result).toEqual({
      synced: true,
      app: 'admin',
      platform: 'ios',
      build: 22,
      versionString: '2.0.1',
    });
  });
});
