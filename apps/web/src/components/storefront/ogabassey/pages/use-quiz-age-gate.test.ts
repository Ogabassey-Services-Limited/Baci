import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizEventResponse } from '@/schemas/quiz';
import { useQuizAgeGate } from './use-quiz-age-gate';

const event = { id: 'event-1', title: 'Daily Quiz' } as QuizEventResponse;

function setup(overrides: {
  runStart?: (event: QuizEventResponse) => Promise<string | null>;
  updateCustomer?: () => Promise<{ success: boolean; error?: string }>;
  clearStartError?: () => void;
  currentCustomerId?: string | null;
} = {}) {
  const runStart = overrides.runStart ?? vi.fn().mockResolvedValue(null);
  const updateCustomer =
    overrides.updateCustomer ?? vi.fn().mockResolvedValue({ success: true });
  const clearStartError = overrides.clearStartError ?? vi.fn();
  const currentCustomerId = overrides.currentCustomerId ?? 'shopper-1';
  const view = renderHook(() =>
    useQuizAgeGate({
      runStart,
      updateCustomer,
      clearStartError,
      currentCustomerId,
    })
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

  it('serializes a cancel + reopen resubmit behind the in-flight save so writes cannot overlap', async () => {
    // Regression (is6Tw-aG): a resubmit for the reopened gate must NOT start a
    // second profile write while the first is still pending — otherwise a stale
    // save can land after (and overwrite) the corrected DOB. The write guard is
    // held until the first PATCH settles; the resubmit then goes through.
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

    // Resubmit for B WHILE A's save is still pending — it is held (not a second
    // overlapping write), so only A's save exists so far.
    await act(async () => {
      await view.result.current.submit('1988-03-10');
    });
    expect(updateCustomer).toHaveBeenCalledTimes(1);
    expect(runStart).not.toHaveBeenCalled();

    // A's stale save resolves: its continuation is a no-op (wrong generation),
    // but the guard is released so a subsequent resubmit can proceed.
    await act(async () => {
      resolveFirst({ success: true });
    });
    expect(runStart).not.toHaveBeenCalled();

    // Now B's resubmit goes through — a single, non-overlapping write that
    // starts the reopened event with the corrected DOB.
    await act(async () => {
      await view.result.current.submit('1988-03-10');
    });
    expect(updateCustomer).toHaveBeenCalledTimes(2);
    expect(updateCustomer).toHaveBeenLastCalledWith({
      date_of_birth: '1988-03-10',
    });
    expect(runStart).toHaveBeenCalledTimes(1);
    expect(runStart).toHaveBeenCalledWith(eventB);
  });

  it('discards the start when the account switches while the save is in flight', async () => {
    // Regression (is6Tw7tH): auth changes do not cancel this hook, so the token
    // stays current across an account switch. Without an identity check the
    // save's continuation would call runStart under shopper B's cookies and
    // spend B's attempt on the event shopper A picked.
    let resolveSave: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi.fn().mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveSave = resolve;
      })
    );
    const runStart = vi.fn().mockResolvedValue(null);
    const view = renderHook(
      ({ customerId }: { customerId: string | null }) =>
        useQuizAgeGate({
          runStart,
          updateCustomer,
          clearStartError: vi.fn(),
          currentCustomerId: customerId,
        }),
      { initialProps: { customerId: 'shopper-A' } }
    );

    act(() => view.result.current.open(event));
    let submitDone: Promise<void> = Promise.resolve();
    act(() => {
      submitDone = view.result.current.submit('1990-06-15');
    });
    // Account switches to shopper B while the save is pending.
    view.rerender({ customerId: 'shopper-B' });
    await act(async () => {
      resolveSave({ success: true });
      await submitDone;
    });

    // The save was A's intent; the start must NOT fire under B's session.
    expect(runStart).not.toHaveBeenCalled();
  });

  it('discards the start when the account switches while runStart is in flight', async () => {
    // The switch can also land in the second async window (after the save, while
    // the start resolves) — the post-start identity re-check must catch it.
    let resolveStart: (v: string | null) => void = () => {};
    const runStart = vi.fn().mockReturnValue(
      new Promise<string | null>((resolve) => {
        resolveStart = resolve;
      })
    );
    const view = renderHook(
      ({ customerId }: { customerId: string | null }) =>
        useQuizAgeGate({
          runStart,
          updateCustomer: vi.fn().mockResolvedValue({ success: true }),
          clearStartError: vi.fn(),
          currentCustomerId: customerId,
        }),
      { initialProps: { customerId: 'shopper-A' } }
    );

    act(() => view.result.current.open(event));
    let submitDone: Promise<void> = Promise.resolve();
    await act(async () => {
      submitDone = view.result.current.submit('1990-06-15');
    });
    // runStart was reached (save succeeded under A) but has not resolved.
    expect(runStart).toHaveBeenCalledTimes(1);
    // Account switches, then the start resolves successfully.
    view.rerender({ customerId: 'shopper-B' });
    await act(async () => {
      resolveStart(null);
      await submitDone;
    });

    // Gate must stay closed-out cleanly without acting under B's session — the
    // event is not re-shown and no error is set for B.
    expect(view.result.current.error).toBeNull();
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

  it('closes the gate on a non-age start failure and leaves the page alert', async () => {
    const runStart = vi
      .fn()
      .mockResolvedValue(
        "You've reached the maximum number of attempts for this quiz."
      );
    const clearStartError = vi.fn();
    const { view } = setup({ runStart, clearStartError });
    act(() => view.result.current.open(event));
    await act(async () => {
      await view.result.current.submit('1990-06-15');
    });
    // The DOB saved fine; an unrelated failure must not trap the shopper behind
    // the gate re-entering unchanged data — close it and keep the page alert.
    await waitFor(() => expect(view.result.current.event).toBeNull());
    expect(clearStartError).not.toHaveBeenCalled();
    expect(view.result.current.error).toBeNull();
  });
});
