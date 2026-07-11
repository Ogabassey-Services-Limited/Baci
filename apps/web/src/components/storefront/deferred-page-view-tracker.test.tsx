import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredPageViewTracker } from './deferred-page-view-tracker';

function setDocumentPrerendering(value: boolean): void {
  Object.defineProperty(document, 'prerendering', {
    configurable: true,
    value,
  });
}

describe('DeferredPageViewTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'prerendering');
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

  it('does not load the tracker while the document is prerendering', async () => {
    const loadTrackerModule = vi.fn().mockResolvedValue({
      PageViewTracker: ({ merchantId }: { merchantId: string }) => (
        <div>Tracking {merchantId}</div>
      ),
    });
    setDocumentPrerendering(true);

    render(
      <DeferredPageViewTracker
        merchantId="merchant-3"
        loadTrackerModule={loadTrackerModule}
      />
    );

    // Neither the defer window nor an interaction should schedule a load while
    // prerendering — the tracker POSTs a merchant page-view to /api/events.
    fireEvent.pointerDown(window);
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(loadTrackerModule).not.toHaveBeenCalled();
    expect(screen.queryByText('Tracking merchant-3')).not.toBeInTheDocument();
  });

  it('loads the tracker after the prerender is activated', async () => {
    const loadTrackerModule = vi.fn().mockResolvedValue({
      PageViewTracker: ({ merchantId }: { merchantId: string }) => (
        <div>Tracking {merchantId}</div>
      ),
    });
    setDocumentPrerendering(true);

    render(
      <DeferredPageViewTracker
        merchantId="merchant-4"
        loadTrackerModule={loadTrackerModule}
      />
    );

    act(() => {
      setDocumentPrerendering(false);
      document.dispatchEvent(new Event('prerenderingchange'));
    });

    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });

    expect(loadTrackerModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Tracking merchant-4')).toBeInTheDocument();
  });
});
