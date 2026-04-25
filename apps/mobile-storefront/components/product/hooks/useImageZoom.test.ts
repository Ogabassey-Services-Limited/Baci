import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';

// Inline reanimated mock — Jest hoists `jest.mock` factories above all
// imports, so the factory must not reference any out-of-scope identifiers
// (no captured types, no closure values).
jest.mock('react-native-reanimated', () => {
  const makeShared = (initial: number) => {
    let current = initial;
    return {
      get: () => current,
      set: (next: number) => {
        current = next;
      },
    };
  };
  return {
    __esModule: true,
    default: {},
    useSharedValue: (initial: number) => makeShared(initial),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
    runOnJS:
      <Args extends unknown[]>(fn: (...args: Args) => unknown) =>
      (...args: Args) =>
        fn(...args),
  };
});

// SPRING_CONFIG comes from the constants barrel; mock it minimally so the hook
// can read `.snappy` without pulling in native deps.
jest.mock('@/constants/Colors', () => ({
  SPRING_CONFIG: { snappy: { damping: 1, stiffness: 1 } },
}));

import { useImageZoom } from './useImageZoom';

interface MockGestureBuilder {
  onStart: (handler: unknown) => MockGestureBuilder;
  onUpdate: (handler: unknown) => MockGestureBuilder;
  onEnd: (handler: unknown) => MockGestureBuilder;
  numberOfTaps: (count: number) => MockGestureBuilder;
  minPointers: (count: number) => MockGestureBuilder;
  maxPointers: (count: number) => MockGestureBuilder;
  __kind: string;
}

function makeBuilder(kind: string): MockGestureBuilder {
  const obj: MockGestureBuilder = {
    __kind: kind,
    onStart: () => obj,
    onUpdate: () => obj,
    onEnd: () => obj,
    numberOfTaps: () => obj,
    minPointers: () => obj,
    maxPointers: () => obj,
  };
  return obj;
}

function makeMockGestureFactory() {
  return {
    Pinch: () => makeBuilder('pinch'),
    Pan: () => makeBuilder('pan'),
    Tap: () => makeBuilder('tap'),
    Race: (...children: unknown[]) => ({ __kind: 'race', children }),
    Simultaneous: (...children: unknown[]) => ({
      __kind: 'simultaneous',
      children,
    }),
  } as unknown as NonNullable<
    Parameters<typeof useImageZoom>[0]['gestureRuntime']['Gesture']
  >;
}

const buildParams = (
  overrides: Partial<Parameters<typeof useImageZoom>[0]> = {}
) => {
  return {
    onClose: jest.fn(),
    goToPrevious: jest.fn(),
    goToNext: jest.fn(),
    currentIndex: 0,
    totalImages: 3,
    gestureRuntime: { Gesture: makeMockGestureFactory() },
    ...overrides,
  } satisfies Parameters<typeof useImageZoom>[0];
};

describe('useImageZoom', () => {
  it('returns null composedGesture when Gesture runtime is not available', () => {
    const { result } = renderHook(() =>
      useImageZoom(
        buildParams({
          gestureRuntime: { Gesture: null },
        })
      )
    );

    expect(result.current.composedGesture).toBeNull();
    expect(typeof result.current.resetTransform).toBe('function');
    expect(typeof result.current.resetTransformImmediate).toBe('function');
  });

  it('builds a composed gesture when the Gesture runtime is provided', () => {
    const { result } = renderHook(() => useImageZoom(buildParams()));

    expect(result.current.composedGesture).not.toBeNull();
    expect(result.current.composedGesture).toMatchObject({
      __kind: 'simultaneous',
    });
  });

  it('resetTransformImmediate runs without throwing', () => {
    const { result } = renderHook(() => useImageZoom(buildParams()));

    expect(() => {
      act(() => {
        result.current.resetTransformImmediate();
      });
    }).not.toThrow();
  });

  it('resetTransform runs without throwing', () => {
    const { result } = renderHook(() => useImageZoom(buildParams()));

    expect(() => {
      act(() => {
        result.current.resetTransform();
      });
    }).not.toThrow();
  });
});
