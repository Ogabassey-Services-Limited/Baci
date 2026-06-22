import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mockReducedMotion = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => mockReducedMotion.value,
}));

import { useCarouselAutoplay } from './use-carousel-autoplay';

afterEach(() => {
  mockReducedMotion.value = false;
});

function focusEvent(staysInside: boolean) {
  const container = document.createElement('div');
  const inside = document.createElement('button');
  container.appendChild(inside);
  return {
    currentTarget: container,
    relatedTarget: staysInside ? inside : document.body,
  } as unknown as React.FocusEvent;
}

describe('useCarouselAutoplay', () => {
  it('is active by default and pauses on hover, resuming on leave', () => {
    const { result } = renderHook(() => useCarouselAutoplay());
    expect(result.current.isActive).toBe(true);

    act(() => result.current.containerHandlers.onMouseEnter());
    expect(result.current.isActive).toBe(false);

    act(() => result.current.containerHandlers.onMouseLeave());
    expect(result.current.isActive).toBe(true);
  });

  it('stays paused while focus is inside even after the pointer leaves', () => {
    const { result } = renderHook(() => useCarouselAutoplay());

    act(() => result.current.containerHandlers.onMouseEnter());
    act(() => result.current.containerHandlers.onFocus());
    act(() => result.current.containerHandlers.onMouseLeave());

    // Pointer left, but focus is still inside → autoplay remains paused.
    expect(result.current.isActive).toBe(false);

    act(() => result.current.containerHandlers.onBlur(focusEvent(false)));
    expect(result.current.isActive).toBe(true);
  });

  it('does not resume on blur when focus moves to another element inside', () => {
    const { result } = renderHook(() => useCarouselAutoplay());
    act(() => result.current.containerHandlers.onFocus());

    act(() => result.current.containerHandlers.onBlur(focusEvent(true)));
    expect(result.current.isActive).toBe(false);
  });

  it('toggles the explicit play/pause state', () => {
    const { result } = renderHook(() => useCarouselAutoplay());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isActive).toBe(false);
  });

  it('suppresses autoplay entirely when the OS prefers reduced motion', () => {
    mockReducedMotion.value = true;
    const { result } = renderHook(() => useCarouselAutoplay());

    expect(result.current.prefersReducedMotion).toBe(true);
    expect(result.current.isActive).toBe(false);
  });
});
