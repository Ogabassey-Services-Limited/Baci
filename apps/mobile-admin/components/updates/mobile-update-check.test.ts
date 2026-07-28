import { describe, expect, it, vi } from 'vitest';
import {
  type MobileReleasePolicy,
  resolveMobileUpdatePrompt,
} from './mobile-update-check';

const baseInput = {
  apiBaseUrl: 'https://usebaci.com',
  buildNumber: '9',
  channel: 'preview',
  nativeVersion: '2.0.0',
  platform: 'ios' as const,
  runtimeVersion: '2.0.0',
};

function createCheckForUpdateMock() {
  return vi.fn<() => Promise<{ isAvailable?: boolean }>>();
}

function createFetchPolicyMock() {
  return vi.fn<(url: string) => Promise<MobileReleasePolicy>>();
}

const cleanPolicy: MobileReleasePolicy = {
  enabled: true,
  latestNativeVersion: null,
  message: null,
  minNativeVersion: null,
  nativeUpdateRecommended: false,
  nativeUpdateRequired: false,
  storeUrl: null,
};

describe('resolveMobileUpdatePrompt', () => {
  it('targets the admin app in the release-policy request URL', async () => {
    const fetchPolicy = createFetchPolicyMock().mockResolvedValue(cleanPolicy);

    await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock().mockResolvedValue({
        isAvailable: false,
      }),
      fetchPolicy,
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(fetchPolicy).toHaveBeenCalledTimes(1);
    const requestedUrl = fetchPolicy.mock.calls[0]?.[0] ?? '';
    expect(new URL(requestedUrl).searchParams.get('app')).toBe('admin');
  });

  it('defers update checks on sensitive routes', async () => {
    const fetchPolicy = createFetchPolicyMock();
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy,
      isOtaEnabled: true,
      pathname: '/login',
    });

    expect(result.kind).toBe('deferred');
    expect(fetchPolicy).not.toHaveBeenCalled();
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it.each([
    '/register',
    '/verify',
    '/complete-profile',
  ])('does not let the release gate interrupt onboarding route %s', async (pathname) => {
    const fetchPolicy = createFetchPolicyMock();
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy,
      isOtaEnabled: true,
      pathname,
    });

    expect(result).toEqual({ kind: 'deferred' });
    expect(fetchPolicy).not.toHaveBeenCalled();
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('returns native-required without checking OTA when server policy requires a store update', async () => {
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: '2.2.0',
        message: 'Update required.',
        minNativeVersion: '2.1.0',
        nativeUpdateRecommended: true,
        nativeUpdateRequired: true,
        storeUrl: 'https://apps.apple.com/app/id6472735367',
      }),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(result).toMatchObject({
      kind: 'native-required',
      message: 'Update required.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('fails open when a required native update has no store URL', async () => {
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: '2.2.0',
        message: 'Update required.',
        minNativeVersion: '2.1.0',
        nativeUpdateRecommended: true,
        nativeUpdateRequired: true,
        storeUrl: null,
      }),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(result.kind).toBe('none');
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('fails open when a recommended native update has no store URL', async () => {
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: '2.2.0',
        message: 'Update available.',
        minNativeVersion: null,
        nativeUpdateRecommended: true,
        nativeUpdateRequired: false,
        storeUrl: '   ',
      }),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(result.kind).toBe('none');
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('returns ota-available when policy is clear and Expo reports an available update', async () => {
    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock().mockResolvedValue({
        isAvailable: true,
      }),
      fetchPolicy: createFetchPolicyMock().mockResolvedValue(cleanPolicy),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(result.kind).toBe('ota-available');
  });

  it('returns none when Expo updates are disabled or unavailable', async () => {
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy: createFetchPolicyMock().mockResolvedValue(cleanPolicy),
      isOtaEnabled: false,
      pathname: '/orders',
    });

    expect(result.kind).toBe('none');
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('does not require OTA metadata for native-only release checks', async () => {
    const fetchPolicy = createFetchPolicyMock().mockResolvedValue({
      ...cleanPolicy,
      nativeUpdateRecommended: true,
      storeUrl: 'https://apps.apple.com/app/id6480000000',
    });
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      channel: null,
      checkForUpdateAsync,
      fetchPolicy,
      isOtaEnabled: false,
      pathname: '/orders',
      runtimeVersion: null,
    });

    expect(result).toMatchObject({
      kind: 'native-recommended',
      storeUrl: 'https://apps.apple.com/app/id6480000000',
    });
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
    const requestedUrl = fetchPolicy.mock.calls[0]?.[0] ?? '';
    expect(new URL(requestedUrl).searchParams.get('channel')).toBe(
      'native-only'
    );
    expect(new URL(requestedUrl).searchParams.get('runtimeVersion')).toBe(
      'native-only'
    );
  });

  it('requires channel and runtime version only when OTA checks are enabled', async () => {
    const fetchPolicy = createFetchPolicyMock();
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      channel: ' ',
      checkForUpdateAsync,
      fetchPolicy,
      isOtaEnabled: true,
      pathname: '/orders',
      runtimeVersion: null,
    });

    expect(result.kind).toBe('none');
    expect(fetchPolicy).not.toHaveBeenCalled();
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('fails open when policy or OTA checks throw', async () => {
    const policyFailure = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock(),
      fetchPolicy: createFetchPolicyMock().mockRejectedValue(
        new Error('network down')
      ),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    const otaFailure = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock().mockRejectedValue(
        new Error('Expo Go')
      ),
      fetchPolicy: createFetchPolicyMock().mockResolvedValue(cleanPolicy),
      isOtaEnabled: true,
      pathname: '/orders',
    });

    expect(policyFailure.kind).toBe('none');
    expect(otaFailure.kind).toBe('none');
  });
});
