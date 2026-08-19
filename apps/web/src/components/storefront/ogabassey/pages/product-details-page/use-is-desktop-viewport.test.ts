import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsDesktopViewport } from './use-is-desktop-viewport';

function createMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQuery = {
    matches,
    media: '(min-width: 768px)',
    addEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_event: string, listener: () => void) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn((listener: () => void) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: () => void) => {
      listeners.delete(listener);
    }),
    dispatchEvent: vi.fn(),
  };

  return {
    mediaQuery,
    setMatches(nextMatches: boolean) {
      mediaQuery.matches = nextMatches;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

describe('useIsDesktopViewport', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('syncs the initial viewport state from matchMedia', () => {
    const { mediaQuery } = createMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    const { result } = renderHook(() => useIsDesktopViewport());

    expect(result.current).toBe(true);
  });

  it('updates when the media query changes', () => {
    const { mediaQuery, setMatches } = createMatchMedia(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    const { result } = renderHook(() => useIsDesktopViewport());

    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it('removes the media query listener on unmount', () => {
    const { mediaQuery } = createMatchMedia(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mediaQuery));

    const { unmount } = renderHook(() => useIsDesktopViewport());

    unmount();

    expect(mediaQuery.removeEventListener).toHaveBeenCalled();
  });
});
