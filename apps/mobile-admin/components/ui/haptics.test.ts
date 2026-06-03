import * as Haptics from 'expo-haptics';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { triggerLightHaptic } from './haptics';

vi.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  impactAsync: vi.fn(() => Promise.resolve()),
}));

describe('triggerLightHaptic', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('fires light haptics on iOS', () => {
    vi.stubEnv('EXPO_OS', 'ios');

    triggerLightHaptic();

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('swallows rejected optional haptics feedback on iOS', async () => {
    vi.stubEnv('EXPO_OS', 'ios');
    vi.mocked(Haptics.impactAsync).mockRejectedValueOnce(
      new Error('haptics unavailable')
    );

    expect(() => triggerLightHaptic()).not.toThrow();
    await Promise.resolve();

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
  });

  it('skips haptics outside iOS', () => {
    vi.stubEnv('EXPO_OS', 'android');

    triggerLightHaptic();

    expect(Haptics.impactAsync).not.toHaveBeenCalled();
  });
});
