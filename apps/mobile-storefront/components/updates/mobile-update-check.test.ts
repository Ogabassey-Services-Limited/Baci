import { describe, expect, it, jest } from '@jest/globals';
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
  return jest.fn<() => Promise<{ isAvailable?: boolean }>>();
}

function createFetchPolicyMock() {
  return jest.fn<(url: string) => Promise<MobileReleasePolicy>>();
}

describe('resolveMobileUpdatePrompt', () => {
  it('defers update checks on sensitive routes', async () => {
    const fetchPolicy = createFetchPolicyMock();
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy,
      isOtaEnabled: true,
      pathname: '/checkout',
    });

    expect(result.kind).toBe('deferred');
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
      pathname: '/',
    });

    expect(result).toMatchObject({
      kind: 'native-required',
      message: 'Update required.',
      storeUrl: 'https://apps.apple.com/app/id6472735367',
    });
    expect(checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it('returns ota-available when policy is clear and Expo reports an available update', async () => {
    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock().mockResolvedValue({
        isAvailable: true,
      }),
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: null,
        message: null,
        minNativeVersion: null,
        nativeUpdateRecommended: false,
        nativeUpdateRequired: false,
        storeUrl: null,
      }),
      isOtaEnabled: true,
      pathname: '/',
    });

    expect(result.kind).toBe('ota-available');
  });

  it('returns none when Expo updates are disabled or unavailable', async () => {
    const checkForUpdateAsync = createCheckForUpdateMock();

    const result = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync,
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: null,
        message: null,
        minNativeVersion: null,
        nativeUpdateRecommended: false,
        nativeUpdateRequired: false,
        storeUrl: null,
      }),
      isOtaEnabled: false,
      pathname: '/',
    });

    expect(result.kind).toBe('none');
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
      pathname: '/',
    });

    const otaFailure = await resolveMobileUpdatePrompt({
      ...baseInput,
      checkForUpdateAsync: createCheckForUpdateMock().mockRejectedValue(
        new Error('Expo Go')
      ),
      fetchPolicy: createFetchPolicyMock().mockResolvedValue({
        enabled: true,
        latestNativeVersion: null,
        message: null,
        minNativeVersion: null,
        nativeUpdateRecommended: false,
        nativeUpdateRequired: false,
        storeUrl: null,
      }),
      isOtaEnabled: true,
      pathname: '/',
    });

    expect(policyFailure.kind).toBe('none');
    expect(otaFailure.kind).toBe('none');
  });
});
