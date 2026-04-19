import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeferredShellFeature } from './deferred-shell-feature';

describe('DeferredShellFeature', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('waits for the configured timeout before rendering', async () => {
    const readyStateSpy = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('loading');

    render(
      <DeferredShellFeature timeoutMs={1500}>
        <div>Deferred child</div>
      </DeferredShellFeature>
    );

    expect(screen.queryByText('Deferred child')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1499);
    });

    expect(screen.queryByText('Deferred child')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText('Deferred child')).toBeInTheDocument();

    readyStateSpy.mockRestore();
  });

  it('renders immediately after a user interaction', async () => {
    render(
      <DeferredShellFeature timeoutMs={5000}>
        <div>Interaction child</div>
      </DeferredShellFeature>
    );

    expect(screen.queryByText('Interaction child')).not.toBeInTheDocument();

    fireEvent.pointerDown(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Interaction child')).toBeInTheDocument();
  });

  it('can skip interaction listeners for passive shell features', async () => {
    render(
      <DeferredShellFeature
        timeoutMs={1200}
        activateOnInteraction={false}
        activateOnIdle={false}
      >
        <div>Passive child</div>
      </DeferredShellFeature>
    );

    fireEvent.pointerDown(window);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText('Passive child')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.getByText('Passive child')).toBeInTheDocument();
  });

  it('stays unmounted when disabled', async () => {
    render(
      <DeferredShellFeature enabled={false} timeoutMs={0}>
        <div>Disabled child</div>
      </DeferredShellFeature>
    );

    await act(async () => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.queryByText('Disabled child')).not.toBeInTheDocument();
  });

  it('activates on load once the page becomes complete', async () => {
    const readyStateSpy = vi
      .spyOn(document, 'readyState', 'get')
      .mockReturnValue('loading');

    render(
      <DeferredShellFeature timeoutMs={5000}>
        <div>Loaded child</div>
      </DeferredShellFeature>
    );

    expect(screen.queryByText('Loaded child')).not.toBeInTheDocument();

    await act(async () => {
      window.dispatchEvent(new Event('load'));
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText('Loaded child')).toBeInTheDocument();

    readyStateSpy.mockRestore();
  });

  it('keeps fallback space reserved until activation completes', async () => {
    render(
      <DeferredShellFeature
        timeoutMs={1200}
        activateOnInteraction={false}
        activateOnIdle={false}
        fallback={<div>Reserved shell space</div>}
      >
        <div>Deferred child</div>
      </DeferredShellFeature>
    );

    expect(screen.getByText('Reserved shell space')).toBeInTheDocument();
    expect(screen.queryByText('Deferred child')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1200);
    });

    expect(screen.queryByText('Reserved shell space')).not.toBeInTheDocument();
    expect(screen.getByText('Deferred child')).toBeInTheDocument();
  });
});
