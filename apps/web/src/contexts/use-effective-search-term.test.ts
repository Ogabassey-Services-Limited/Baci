import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEffectiveSearchTerm } from './use-effective-search-term';

describe('useEffectiveSearchTerm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial search term immediately on first render', () => {
    // Arrange & Act
    const { result } = renderHook(() =>
      useEffectiveSearchTerm({
        searchTerm: 'phones',
        flushOn: ['All'],
      })
    );

    // Assert
    expect(result.current).toBe('phones');
  });

  it('does not update the returned value before the debounce window elapses', async () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ searchTerm }: { searchTerm: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: ['All'],
        }),
      { initialProps: { searchTerm: '' } }
    );

    // Act: change the search term, advance under the debounce window.
    rerender({ searchTerm: 'p' });
    rerender({ searchTerm: 'ph' });
    rerender({ searchTerm: 'pho' });
    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    // Assert: still the previous value.
    expect(result.current).toBe('');
  });

  it('updates the returned value to the latest searchTerm after the debounce window', async () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ searchTerm }: { searchTerm: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: ['All'],
        }),
      { initialProps: { searchTerm: '' } }
    );

    // Act: type, then let the debounce elapse.
    rerender({ searchTerm: 'phone' });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    // Assert
    expect(result.current).toBe('phone');
  });

  it('coalesces rapid changes into a single update with the latest term', async () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ searchTerm }: { searchTerm: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: ['All'],
        }),
      { initialProps: { searchTerm: '' } }
    );

    // Act
    rerender({ searchTerm: 'p' });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    rerender({ searchTerm: 'ph' });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    rerender({ searchTerm: 'pho' });
    await act(async () => {
      vi.advanceTimersByTime(100);
      await Promise.resolve();
    });
    rerender({ searchTerm: 'phone' });
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    // Assert: directly latest, never any intermediate value.
    expect(result.current).toBe('phone');
  });

  it('synchronously flushes to the live searchTerm when a flushOn entry changes (regression)', () => {
    // Arrange: this is the regression for the P1 bug — when a non-search filter
    // changes mid-typing, the consumer must see the live search term immediately,
    // not the stale debounced one.
    const { result, rerender } = renderHook(
      ({ searchTerm, status }: { searchTerm: string; status: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: [status],
        }),
      { initialProps: { searchTerm: '', status: 'All' } }
    );

    // Act: user types but does NOT wait for the debounce — then changes a filter.
    rerender({ searchTerm: 'phone', status: 'All' });
    // No timers advanced yet — debounce is still pending.
    expect(result.current).toBe('');

    rerender({ searchTerm: 'phone', status: 'active' });

    // Assert: the next render synchronously surfaces the live searchTerm.
    expect(result.current).toBe('phone');
  });

  it('does not flush when flushOn is unchanged across renders', async () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ searchTerm, status }: { searchTerm: string; status: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: [status],
        }),
      { initialProps: { searchTerm: '', status: 'All' } }
    );

    // Act: rerender with the same flushOn deps; the hook should NOT short-circuit
    // the debounce.
    rerender({ searchTerm: 'phone', status: 'All' });
    rerender({ searchTerm: 'phone', status: 'All' });

    // Assert: still debounced.
    expect(result.current).toBe('');

    // Now let the debounce elapse and confirm the value updates.
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(result.current).toBe('phone');
  });

  it('respects a custom delayMs', async () => {
    // Arrange
    const { result, rerender } = renderHook(
      ({ searchTerm }: { searchTerm: string }) =>
        useEffectiveSearchTerm({
          searchTerm,
          flushOn: ['All'],
          delayMs: 200,
        }),
      { initialProps: { searchTerm: '' } }
    );

    // Act
    rerender({ searchTerm: 'fast' });
    await act(async () => {
      vi.advanceTimersByTime(150);
      await Promise.resolve();
    });
    expect(result.current).toBe('');

    await act(async () => {
      vi.advanceTimersByTime(60);
      await Promise.resolve();
    });

    // Assert
    expect(result.current).toBe('fast');
  });
});
