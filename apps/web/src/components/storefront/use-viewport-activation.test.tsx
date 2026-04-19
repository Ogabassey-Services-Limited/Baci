import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewportActivation } from './use-viewport-activation';

describe('useViewportActivation', () => {
  let observerCallback: IntersectionObserverCallback | null = null;

  function TestHarness() {
    const { ref, isActive } = useViewportActivation<HTMLDivElement>({
      timeoutMs: 5000,
    });

    return (
      <div>
        <div ref={ref}>target</div>
        <span>{isActive ? 'active' : 'idle'}</span>
      </div>
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    observerCallback = null;

    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback;
      }

      observe() {
        return;
      }

      disconnect() {
        return;
      }

      unobserve() {
        return;
      }

      takeRecords() {
        return [];
      }
    }

    global.IntersectionObserver =
      MockIntersectionObserver as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.useRealTimers();
    observerCallback = null;
    delete (
      globalThis as { IntersectionObserver?: typeof IntersectionObserver }
    ).IntersectionObserver;
  });

  it('stays idle until the target enters the viewport', () => {
    render(<TestHarness />);

    expect(screen.getByText('idle')).toBeInTheDocument();

    act(() => {
      observerCallback?.(
        [
          {
            isIntersecting: true,
            target: screen.getByText('target'),
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      );
    });

    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('activates after the fallback timeout when still offscreen', () => {
    render(<TestHarness />);

    expect(screen.getByText('idle')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText('active')).toBeInTheDocument();
  });
});
