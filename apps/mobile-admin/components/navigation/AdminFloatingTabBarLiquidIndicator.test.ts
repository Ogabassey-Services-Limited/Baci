import type { SharedValue } from 'react-native-reanimated';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reanimatedMocks = vi.hoisted(() => ({
  cancelAnimation: vi.fn(),
  runOnUI: vi.fn((worklet: (...args: unknown[]) => void) => worklet),
  withSpring: vi.fn(
    (
      value: number,
      config: Record<string, number>,
      callback?: (finished: boolean) => void
    ) => {
      callback?.(true);
      return { config, type: 'spring', value };
    }
  ),
  withTiming: vi.fn((value: number, config: Record<string, unknown>) => ({
    config,
    type: 'timing',
    value,
  })),
}));

vi.mock('react-native-reanimated', () => ({
  Easing: {
    bezier: () => 'bezier-easing',
  },
  cancelAnimation: reanimatedMocks.cancelAnimation,
  runOnUI: reanimatedMocks.runOnUI,
  withSpring: reanimatedMocks.withSpring,
  withTiming: reanimatedMocks.withTiming,
}));

import {
  ADMIN_LIQUID_TAB_SWITCH_DURATION_MS,
  animateAdminFloatingTabIndicator,
} from './AdminFloatingTabBarLiquidIndicator';

describe('animateAdminFloatingTabIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts the tab indicator animation on the UI runtime', () => {
    const lastTargetIndexRef = { current: 0 };
    const targetIndex = { value: 0 } as SharedValue<number>;
    const animIndex = { value: 0 } as SharedValue<number>;
    const capsuleScale = { value: 1 } as SharedValue<number>;

    animateAdminFloatingTabIndicator(
      3,
      lastTargetIndexRef,
      targetIndex,
      animIndex,
      capsuleScale
    );

    expect(lastTargetIndexRef.current).toBe(3);
    expect(reanimatedMocks.runOnUI).toHaveBeenCalledTimes(1);
    expect(reanimatedMocks.cancelAnimation).toHaveBeenCalledWith(animIndex);
    expect(reanimatedMocks.cancelAnimation).toHaveBeenCalledWith(capsuleScale);
    expect(targetIndex.value).toBe(3);
    expect(reanimatedMocks.withTiming).toHaveBeenCalledWith(
      3,
      expect.objectContaining({
        duration: ADMIN_LIQUID_TAB_SWITCH_DURATION_MS,
      })
    );
    expect(reanimatedMocks.withSpring).toHaveBeenCalledWith(
      1.06,
      expect.objectContaining({ stiffness: 560 }),
      expect.any(Function)
    );
    expect(reanimatedMocks.withSpring).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ stiffness: 460 })
    );
  });
});
