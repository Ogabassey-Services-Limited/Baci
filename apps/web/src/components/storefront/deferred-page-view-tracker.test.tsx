import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredPageViewTracker } from './deferred-page-view-tracker';

describe('DeferredPageViewTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('waits for the defer window before loading the page tracker', async () => {
    const loadTrackerModule = vi.fn().mockResolvedValue({
      PageViewTracker: ({ merchantId }: { merchantId: string }) => (
        <div>Tracking {merchantId}</div>
      ),
    });

    render(
      <DeferredPageViewTracker
        merchantId="merchant-1"
        loadTrackerModule={loadTrackerModule}
      />
    );

    expect(screen.queryByText('Tracking merchant-1')).not.toBeInTheDocument();
    expect(loadTrackerModule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(599);
    });

    expect(screen.queryByText('Tracking merchant-1')).not.toBeInTheDocument();
    expect(loadTrackerModule).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(loadTrackerModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Tracking merchant-1')).toBeInTheDocument();
  });

  it('loads the tracker immediately after user interaction', async () => {
    const loadTrackerModule = vi.fn().mockResolvedValue({
      PageViewTracker: ({ merchantId }: { merchantId: string }) => (
        <div>Tracking {merchantId}</div>
      ),
    });

    render(
      <DeferredPageViewTracker
        merchantId="merchant-2"
        loadTrackerModule={loadTrackerModule}
      />
    );

    fireEvent.pointerDown(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadTrackerModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Tracking merchant-2')).toBeInTheDocument();
  });
});
