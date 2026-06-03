/**
 * Tests for useBottomSheetAnimation hook
 *
 * Mocking strategy for react-native-reanimated
 * --------------------------------------------
 * The hook uses four Reanimated primitives:
 *   - useSharedValue   – mocked with useRef so the value persists across rerenders
 *   - useAnimatedStyle – mocked as immediate invocation (calls fn, returns snapshot)
 *   - withTiming       – immediately returns the target value (no animation delay)
 *   - useReducedMotion – wired to a jest.fn() so tests can control the return value
 *
 * Key insight: in real Reanimated, useSharedValue persists its shared value across
 * renders via a native ref.  Our mock must mirror that by using React's useRef;
 * otherwise every render creates a fresh box, so effect updates are invisible to
 * the next useAnimatedStyle call.
 *
 * Because useAnimatedStyle captures a plain-object snapshot on each render, tests
 * that verify the *updated* animation target call rerender inside act so the hook
 * runs again, re-evaluating useAnimatedStyle with the latest shared-value data.
 */

import { act, renderHook } from '@testing-library/react-native';
import { useBottomSheetAnimation } from './useBottomSheetAnimation';

// ---------------------------------------------------------------------------
// Self-contained react-native-reanimated mock (no native imports)
// ---------------------------------------------------------------------------
// Variables referenced inside jest.mock() factories must be prefixed "mock"
// (case-insensitive) when declared outside the factory.
const mockReducedMotionEnabled = jest.fn(() => false);

jest.mock('react-native-reanimated', () => {
  // We need useRef from React to persist shared values across rerenders.

  const { useRef } = require('react');

  function useSharedValue(init: number) {
    // Persist the mutable box across renders, mirroring Reanimated's native ref.
    const ref = useRef(null);
    if (ref.current === null) {
      ref.current = { value: init };
    }
    const box = ref.current;

    return {
      get value() {
        return box.value;
      },
      set value(v: number) {
        box.value = v;
      },
      get() {
        return box.value;
      },
      set(next: number | ((prev: number) => number)) {
        box.value = typeof next === 'function' ? next(box.value) : next;
      },
    };
  }

  function useAnimatedStyle(fn: () => Record<string, unknown>) {
    // Evaluate immediately — returns a plain-object snapshot of the current values.
    return fn();
  }

  function withTiming(toValue: number) {
    // Skip animation; resolve to target value synchronously.
    return toValue;
  }

  function useReducedMotion() {
    return mockReducedMotionEnabled();
  }

  return {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    useReducedMotion,
    default: {},
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function backdropOpacity(style: any) {
  return style.opacity as number;
}

function sheetTranslateY(style: any) {
  return style.transform[0].translateY as number;
}

// ---------------------------------------------------------------------------
// Return-shape tests
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — return shape', () => {
  it('returns animatedBackdropStyle, animatedSheetStyle and reducedMotion', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(result.current).toHaveProperty('animatedBackdropStyle');
    expect(result.current).toHaveProperty('animatedSheetStyle');
    expect(result.current).toHaveProperty('reducedMotion');
  });

  it('animatedBackdropStyle is a non-null object', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(typeof result.current.animatedBackdropStyle).toBe('object');
    expect(result.current.animatedBackdropStyle).not.toBeNull();
  });

  it('animatedSheetStyle is a non-null object', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(typeof result.current.animatedSheetStyle).toBe('object');
    expect(result.current.animatedSheetStyle).not.toBeNull();
  });

  it('reducedMotion is a boolean', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(typeof result.current.reducedMotion).toBe('boolean');
  });
});

// ---------------------------------------------------------------------------
// Closed state (isOpen = false)
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — closed state (isOpen = false)', () => {
  it('animatedBackdropStyle has opacity 0 when closed', () => {
    // Arrange & Act
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    // Assert: withTiming resolves to 0 synchronously; effect runs, sets value
    // to 0, then a rerender captures the updated style.
    act(() => {});

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(0);
  });

  it('animatedSheetStyle has translateY equal to the default distance (500) when closed', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    act(() => {});

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(500);
  });

  it('animatedSheetStyle uses a custom translateDistance when closed', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false, translateDistance: 300 })
    );

    act(() => {});

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Open state (isOpen = true) — after effect + rerender
// ---------------------------------------------------------------------------
// useAnimatedStyle captures a snapshot at each render.  The useEffect updates
// the shared values; on the next render the new snapshot will reflect those values.

describe('useBottomSheetAnimation — open state (isOpen = true)', () => {
  it('animatedBackdropStyle has opacity 1 when open', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: true } }
    );

    // Trigger a rerender so useAnimatedStyle re-evaluates the updated shared value.
    act(() => {
      rerender({ isOpen: true });
    });

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(1);
  });

  it('animatedSheetStyle has translateY 0 when open', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: true } }
    );

    act(() => {
      rerender({ isOpen: true });
    });

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transition: closed → open
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — transition from closed to open', () => {
  it('updates backdrop opacity from 0 to 1 when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: false } }
    );

    // Confirm the initial closed state
    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(0);

    // First rerender: triggers the effect that updates the shared values.
    act(() => {
      rerender({ isOpen: true });
    });
    // Second rerender: useAnimatedStyle now captures the updated shared values.
    act(() => {
      rerender({ isOpen: true });
    });

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(1);
  });

  it('updates sheet translateY from 500 to 0 when isOpen changes to true', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: false } }
    );

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(500);

    act(() => {
      rerender({ isOpen: true });
    });
    act(() => {
      rerender({ isOpen: true });
    });

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Transition: open → closed
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — transition from open to closed', () => {
  it('updates backdrop opacity from 1 to 0 when isOpen changes to false', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: true } }
    );

    // Settle the open state: first rerender triggers effect, second captures the snapshot.
    act(() => {
      rerender({ isOpen: true });
    });
    act(() => {
      rerender({ isOpen: true });
    });
    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(1);

    // First rerender to false: triggers the close effect.
    act(() => {
      rerender({ isOpen: false });
    });
    // Second rerender: captures the updated closed-state snapshot.
    act(() => {
      rerender({ isOpen: false });
    });

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(0);
  });

  it('updates sheet translateY from 0 to 500 when isOpen changes to false', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: true } }
    );

    act(() => {
      rerender({ isOpen: true });
    });
    act(() => {
      rerender({ isOpen: true });
    });
    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);

    act(() => {
      rerender({ isOpen: false });
    });
    act(() => {
      rerender({ isOpen: false });
    });

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// reducedMotion
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — reducedMotion', () => {
  beforeEach(() => {
    mockReducedMotionEnabled.mockReturnValue(false);
  });

  it('returns reducedMotion = false when system reduced motion is off', () => {
    mockReducedMotionEnabled.mockReturnValue(false);

    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(result.current.reducedMotion).toBe(false);
  });

  it('returns reducedMotion = true when system reduced motion is on', () => {
    mockReducedMotionEnabled.mockReturnValue(true);

    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(result.current.reducedMotion).toBe(true);
  });

  it('targets opacity 1 and translateY 0 when open with reduced motion enabled', () => {
    // Duration becomes 0, but withTiming still resolves to the target value.
    mockReducedMotionEnabled.mockReturnValue(true);

    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: true } }
    );

    act(() => {
      rerender({ isOpen: true });
    });

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(1);
    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);
  });

  it('targets opacity 0 and translateY 500 when closed with reduced motion enabled', () => {
    mockReducedMotionEnabled.mockReturnValue(true);

    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) => useBottomSheetAnimation({ isOpen }),
      { initialProps: { isOpen: false } }
    );

    act(() => {
      rerender({ isOpen: false });
    });

    expect(backdropOpacity(result.current.animatedBackdropStyle)).toBe(0);
    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Custom translateDistance
// ---------------------------------------------------------------------------

describe('useBottomSheetAnimation — custom translateDistance', () => {
  it('uses 500 as the default translateDistance', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false })
    );

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(500);
  });

  it('respects a custom translateDistance of 200 when closed', () => {
    const { result } = renderHook(() =>
      useBottomSheetAnimation({ isOpen: false, translateDistance: 200 })
    );

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(200);
  });

  it('translateY reaches 0 when open, regardless of custom translateDistance', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useBottomSheetAnimation({ isOpen, translateDistance: 200 }),
      { initialProps: { isOpen: true } }
    );

    act(() => {
      rerender({ isOpen: true });
    });

    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);
  });

  it('returns to custom translateDistance after closing', () => {
    const { result, rerender } = renderHook(
      ({ isOpen }: { isOpen: boolean }) =>
        useBottomSheetAnimation({ isOpen, translateDistance: 400 }),
      { initialProps: { isOpen: true } }
    );

    // Open: two passes — first triggers the effect, second captures the snapshot.
    act(() => {
      rerender({ isOpen: true });
    });
    act(() => {
      rerender({ isOpen: true });
    });
    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(0);

    // Close: two passes — first triggers the effect, second captures the snapshot.
    act(() => {
      rerender({ isOpen: false });
    });
    act(() => {
      rerender({ isOpen: false });
    });
    expect(sheetTranslateY(result.current.animatedSheetStyle)).toBe(400);
  });
});
