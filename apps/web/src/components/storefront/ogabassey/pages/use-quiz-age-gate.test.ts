import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizEventResponse } from '@/schemas/quiz';
import { useQuizAgeGate } from './use-quiz-age-gate';

const event = { id: 'event-1', title: 'Daily Quiz' } as QuizEventResponse;

function setup(overrides: {
  runStart?: (event: QuizEventResponse) => Promise<string | null>;
  updateCustomer?: () => Promise<{ success: boolean; error?: string }>;
  clearStartError?: () => void;
} = {}) {
  const runStart = overrides.runStart ?? vi.fn().mockResolvedValue(null);
  const updateCustomer =
    overrides.updateCustomer ?? vi.fn().mockResolvedValue({ success: true });
  const clearStartError = overrides.clearStartError ?? vi.fn();
  const view = renderHook(() =>
    useQuizAgeGate({ runStart, updateCustomer, clearStartError })
  );
  return { view, runStart, updateCustomer, clearStartError };
}

describe('useQuizAgeGate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens and closes the gate for an event', () => {
    const { view } = setup();
    act(() => view.result.current.open(event));
    expect(view.result.current.event).toBe(event);
    expect(view.result.current.error).toBeNull();
    act(() => view.result.current.cancel());
    expect(view.result.current.event).toBeNull();
  });

  it('seeds the gate alert when reopened with an initial error', () => {
    const { view } = setup();
    act(() =>
      view.result.current.open(
        event,
        'Quiz participation requires an adult profile (18+)'
      )
    );
    expect(view.result.current.event).toBe(event);
    expect(view.result.current.error).toBe(
      'Quiz participation requires an adult profile (18+)'
    );
  });

  it('saves the DOB then starts and closes on success', async () => {
    const { view, runStart, updateCustomer } = setup();
    act(() => view.result.current.open(event));
    await act(async () => {
      await view.result.current.submit('1990-06-15');
    });
    expect(updateCustomer).toHaveBeenCalledWith({ date_of_birth: '1990-06-15' });
    expect(runStart).toHaveBeenCalledWith(event);
    expect(view.result.current.event).toBeNull();
  });

  it('swallows a double submit so only one attempt starts', async () => {
    let resolveSave: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi.fn().mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveSave = resolve;
      })
    );
    const { view, runStart } = setup({ updateCustomer });
    act(() => view.result.current.open(event));

    // Two synchronous submits before the first save resolves.
    act(() => {
      void view.result.current.submit('1990-06-15');
      void view.result.current.submit('1990-06-15');
    });
    await act(async () => {
      resolveSave({ success: true });
    });

    expect(updateCustomer).toHaveBeenCalledTimes(1);
    expect(runStart).toHaveBeenCalledTimes(1);
  });

  it('does not start when cancelled while the save is in flight', async () => {
    let resolveSave: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi.fn().mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveSave = resolve;
      })
    );
    const { view, runStart } = setup({ updateCustomer });
    act(() => view.result.current.open(event));

    let submitDone: Promise<void> = Promise.resolve();
    act(() => {
      submitDone = view.result.current.submit('1990-06-15');
    });
    // Cancel while the save is pending, then let the save resolve.
    act(() => view.result.current.cancel());
    await act(async () => {
      resolveSave({ success: true });
      await submitDone;
    });

    expect(runStart).not.toHaveBeenCalled();
  });

  it('allows a resubmit for a new gate after cancelling an in-flight save', async () => {
    // Regression: cancel must release the in-flight guard, otherwise the next
    // submit is silently dropped while the first (stale) save is still pending.
    let resolveFirst: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<{ success: boolean }>((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValue({ success: true });
    const { view, runStart } = setup({ updateCustomer });
    const eventB = { id: 'event-2', title: 'Weekly Quiz' } as QuizEventResponse;

    // Submit for A (save stays pending), then cancel and reopen for B.
    act(() => view.result.current.open(event));
    act(() => {
      void view.result.current.submit('1990-06-15');
    });
    act(() => view.result.current.cancel());
    act(() => view.result.current.open(eventB));
    await act(async () => {
      await view.result.current.submit('1988-03-10');
    });

    // The second submit is NOT dropped, and it starts the new event.
    expect(updateCustomer).toHaveBeenCalledTimes(2);
    expect(updateCustomer).toHaveBeenLastCalledWith({
      date_of_birth: '1988-03-10',
    });
    expect(runStart).toHaveBeenCalledTimes(1);
    expect(runStart).toHaveBeenCalledWith(eventB);

    // The stale first save resolving is a no-op (wrong generation).
    await act(async () => {
      resolveFirst({ success: true });
    });
    expect(runStart).toHaveBeenCalledTimes(1);
  });

  it('surfaces the save error and does not start', async () => {
    const updateCustomer = vi
      .fn()
      .mockResolvedValue({ success: false, error: 'Invalid input' });
    const { view, runStart } = setup({ updateCustomer });
    act(() => view.result.current.open(event));
    await act(async () => {
      await view.result.current.submit('1990-06-15');
    });
    expect(runStart).not.toHaveBeenCalled();
    expect(view.result.current.error).toBe('Invalid input');
    expect(view.result.current.event).toBe(event);
  });

  it('keeps the gate open with the error when the start is rejected', async () => {
    const runStart = vi
      .fn()
      .mockResolvedValue('Quiz participation requires an adult profile (18+)');
    const clearStartError = vi.fn();
    const { view } = setup({ runStart, clearStartError });
    act(() => view.result.current.open(event));
    await act(async () => {
      await view.result.current.submit('2020-06-15');
    });
    await waitFor(() =>
      expect(view.result.current.error).toBe(
        'Quiz participation requires an adult profile (18+)'
      )
    );
    // Gate stays open so the DOB can be corrected; page-level alert is cleared.
    expect(view.result.current.event).toBe(event);
    expect(clearStartError).toHaveBeenCalled();
  });
});
