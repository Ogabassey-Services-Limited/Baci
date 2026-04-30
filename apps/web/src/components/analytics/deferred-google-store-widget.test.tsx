import { act, fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredGoogleStoreWidget } from './deferred-google-store-widget';

type TestWidgetModule = {
  GoogleStoreWidget: ({
    merchantCustomDomain,
    skipActivationDelay,
  }: {
    merchantCustomDomain?: string | null;
    skipActivationDelay?: boolean;
  }) => React.ReactElement;
};

function createTestWidgetModule(): TestWidgetModule {
  return {
    GoogleStoreWidget: ({ merchantCustomDomain, skipActivationDelay }) => (
      <div>
        Widget {merchantCustomDomain} {String(skipActivationDelay)}
      </div>
    ),
  };
}

describe('DeferredGoogleStoreWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('waits for the defer window before importing the widget module', async () => {
    const loadWidgetModule = vi
      .fn()
      .mockResolvedValue(createTestWidgetModule());

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

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(loadWidgetModule).toHaveBeenCalledOnce();
  });

  it('imports the widget immediately after interaction', async () => {
    const loadWidgetModule = vi
      .fn()
      .mockResolvedValue(createTestWidgetModule());

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

  it('does not start a second widget import while the first import is pending', async () => {
    let resolveWidgetModule: ((module: TestWidgetModule) => void) | undefined;
    const loadWidgetModule = vi.fn(
      () =>
        new Promise<TestWidgetModule>((resolve) => {
          resolveWidgetModule = resolve;
        })
    );

    render(
      <DeferredGoogleStoreWidget
        merchantCustomDomain="ogabassey.com"
        enabled
        loadWidgetModule={loadWidgetModule}
      />
    );

    fireEvent.scroll(window);

    act(() => {
      vi.advanceTimersByTime(20000);
    });

    expect(loadWidgetModule).toHaveBeenCalledOnce();

    await act(async () => {
      resolveWidgetModule?.(createTestWidgetModule());
      await Promise.resolve();
    });

    expect(screen.getByText('Widget ogabassey.com true')).toBeInTheDocument();
  });

  it('allows a later interaction to retry after a failed widget import', async () => {
    const loadWidgetModule = vi
      .fn()
      .mockRejectedValueOnce(new Error('Chunk failed'))
      .mockResolvedValueOnce(createTestWidgetModule());

    render(
      <DeferredGoogleStoreWidget
        merchantCustomDomain="ogabassey.com"
        enabled
        loadWidgetModule={loadWidgetModule}
      />
    );

    await act(async () => {
      fireEvent.scroll(window);
      await Promise.resolve();
    });

    expect(loadWidgetModule).toHaveBeenCalledOnce();
    expect(screen.queryByText(/Widget ogabassey.com/)).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window);
      await Promise.resolve();
    });

    expect(loadWidgetModule).toHaveBeenCalledTimes(2);
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
