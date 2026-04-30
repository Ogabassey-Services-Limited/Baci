import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredGoogleStoreWidget } from './deferred-google-store-widget';

describe('DeferredGoogleStoreWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('waits for the defer window before importing the widget module', async () => {
    const loadWidgetModule = vi.fn().mockResolvedValue({
      GoogleStoreWidget: ({
        merchantCustomDomain,
        skipActivationDelay,
      }: {
        merchantCustomDomain?: string | null;
        skipActivationDelay?: boolean;
      }) => (
        <div>
          Widget {merchantCustomDomain} {String(skipActivationDelay)}
        </div>
      ),
    });

    render(
      <DeferredGoogleStoreWidget
        merchantCustomDomain="ogabassey.com"
        enabled
        loadWidgetModule={loadWidgetModule}
      />
    );

    expect(screen.queryByText(/Widget ogabassey.com/)).not.toBeInTheDocument();
    expect(loadWidgetModule).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(19999);
    });

    expect(screen.queryByText(/Widget ogabassey.com/)).not.toBeInTheDocument();
    expect(loadWidgetModule).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(loadWidgetModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Widget ogabassey.com true')).toBeInTheDocument();
  });

  it('imports the widget immediately after interaction', async () => {
    const loadWidgetModule = vi.fn().mockResolvedValue({
      GoogleStoreWidget: ({
        merchantCustomDomain,
        skipActivationDelay,
      }: {
        merchantCustomDomain?: string | null;
        skipActivationDelay?: boolean;
      }) => (
        <div>
          Widget {merchantCustomDomain} {String(skipActivationDelay)}
        </div>
      ),
    });

    render(
      <DeferredGoogleStoreWidget
        merchantCustomDomain="ogabassey.com"
        enabled
        loadWidgetModule={loadWidgetModule}
      />
    );

    fireEvent.scroll(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(loadWidgetModule).toHaveBeenCalledOnce();
    expect(screen.getByText('Widget ogabassey.com true')).toBeInTheDocument();
  });

  it('stays disabled when the widget is turned off', async () => {
    const loadWidgetModule = vi.fn();

    render(
      <DeferredGoogleStoreWidget
        merchantCustomDomain="ogabassey.com"
        enabled={false}
        loadWidgetModule={loadWidgetModule}
      />
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(loadWidgetModule).not.toHaveBeenCalled();
    expect(screen.queryByText(/Widget ogabassey.com/)).not.toBeInTheDocument();
  });
});
