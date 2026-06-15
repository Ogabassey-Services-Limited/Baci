import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './use-debounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));
    expect(result.current).toBe('initial');
  });

  it('should debounce the value update', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 500 });

    // Value should not update immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 499ms
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current).toBe('initial');

    // Fast-forward time by 1ms (total 500ms)
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('updated');
  });

  it('should reset the timer if the value changes multiple times before the delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    // First update
    rerender({ value: 'updated-1', delay: 500 });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Still initial
    expect(result.current).toBe('initial');

    // Second update (should reset the 500ms timer)
    rerender({ value: 'updated-2', delay: 500 });

    act(() => {
      // Advance by another 250ms (total 500ms from first update, but timer reset)
      vi.advanceTimersByTime(250);
    });

    // Still initial, because timer was reset
    expect(result.current).toBe('initial');

    act(() => {
      // Advance by another 250ms (total 500ms from second update)
      vi.advanceTimersByTime(250);
    });

    // Now it should be updated-2
    expect(result.current).toBe('updated-2');
  });

  it('should clear the timer if the component unmounts', () => {
    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 500 } }
    );

    rerender({ value: 'updated', delay: 500 });

    // Unmount before delay
    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should still be initial
    expect(result.current).toBe('initial');
  });
});
