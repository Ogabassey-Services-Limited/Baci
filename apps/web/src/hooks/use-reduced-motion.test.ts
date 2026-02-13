import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from './use-reduced-motion';

describe('useReducedMotion', () => {
  let listeners: Map<string, (e: MediaQueryListEvent) => void>;
  let matchesValue: boolean;

  beforeEach(() => {
    listeners = new Map();
    matchesValue = false;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: matchesValue,
        addEventListener: vi.fn(
          (_event: string, handler: (e: MediaQueryListEvent) => void) => {
            listeners.set('change', handler);
          }
        ),
        removeEventListener: vi.fn((_event: string) => {
          listeners.delete('change');
        }),
      })),
    });
  });

  it('returns false when user does not prefer reduced motion', () => {
    matchesValue = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when user prefers reduced motion', () => {
    matchesValue = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('updates when media query changes', () => {
    matchesValue = false;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    const handler = listeners.get('change');
    if (handler) {
      act(() => {
        handler({ matches: true } as MediaQueryListEvent);
      });
    }
    expect(result.current).toBe(true);
  });
});
