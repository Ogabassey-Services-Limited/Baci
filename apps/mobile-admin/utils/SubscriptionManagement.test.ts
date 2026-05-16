import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionManagement } from './SubscriptionManagement';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  openSettings: vi.fn(),
  openURL: vi.fn(),
  platform: { OS: 'ios' as 'ios' | 'android' | 'web' },
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Linking: {
    openSettings: mocks.openSettings,
    openURL: mocks.openURL,
  },
  Platform: mocks.platform,
}));

describe('SubscriptionManagement', () => {
  afterEach(() => {
    mocks.alert.mockReset();
    mocks.openSettings.mockReset();
    mocks.openURL.mockReset();
    mocks.platform.OS = 'ios';
  });

  it('returns platform-aware management labels', () => {
    expect(SubscriptionManagement.getManagementLabel('ios')).toBe(
      'Manage in App Store'
    );
    expect(SubscriptionManagement.getManagementLabel('android')).toBe(
      'Manage in Google Play'
    );
  });

  it('opens Apple subscriptions when on iOS', async () => {
    mocks.platform.OS = 'ios';
    mocks.openURL.mockResolvedValue(undefined);

    await expect(
      SubscriptionManagement.openNativeManagement()
    ).resolves.toBe(true);
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://apps.apple.com/account/subscriptions'
    );
  });

  it('opens Play subscriptions when on Android', async () => {
    mocks.platform.OS = 'android';
    mocks.openURL.mockResolvedValue(undefined);

    await expect(
      SubscriptionManagement.openNativeManagement()
    ).resolves.toBe(true);
    expect(mocks.openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/account/subscriptions?package=com.ogabassey.baci'
    );
  });
});
