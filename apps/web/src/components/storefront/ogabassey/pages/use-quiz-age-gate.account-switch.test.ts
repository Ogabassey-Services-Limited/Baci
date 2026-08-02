import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QuizEventResponse } from '@/schemas/quiz';
import { useQuizAgeGate } from './use-quiz-age-gate';
import { event, setup } from './use-quiz-age-gate.test-support';

describe('useQuizAgeGate — concurrency & account switches', () => {
  beforeEach(() => vi.clearAllMocks());

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

  it('keeps savePending set across a cancel + reopen until the prior save settles', async () => {
    // Regression (is6TyY8S): rather than silently dropping the reopened submit,
    // savePending stays true while the prior PATCH is still settling so the modal
    // can keep Continue disabled; it clears once that write resolves.
    let resolveFirst: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<{ success: boolean }>((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValue({ success: true });
    const { view } = setup({ updateCustomer });
    const eventB = { id: 'event-2', title: 'Weekly Quiz' } as QuizEventResponse;

    act(() => view.result.current.open(event));
    act(() => {
      void view.result.current.submit('1990-06-15');
    });
    expect(view.result.current.savePending).toBe(true);

    // Cancel + reopen while A's save is still pending — savePending must persist
    // so the reopened Continue stays disabled (not a silently dropped tap).
    act(() => view.result.current.cancel());
    act(() => view.result.current.open(eventB));
    expect(view.result.current.savePending).toBe(true);

    // A's PATCH settles → the guard releases and Continue becomes usable again.
    await act(async () => {
      resolveFirst({ success: true });
    });
    expect(view.result.current.savePending).toBe(false);
  });

  it('holds the write guard across an A→B→A round-trip so a resubmit cannot overlap the original PATCH', async () => {
    // Regression (is6TzaA1): closing the idle gate on a switch must NOT release
    // the in-flight write guard. Otherwise an A→B→A round-trip + resubmit starts a
    // second PATCH while A's original is unresolved; if the original commits last
    // it overwrites the correction.
    let resolveFirst: (v: { success: boolean }) => void = () => {};
    const updateCustomer = vi
      .fn()
      .mockReturnValueOnce(
        new Promise<{ success: boolean }>((resolve) => {
          resolveFirst = resolve;
        })
      )
      .mockResolvedValue({ success: true });
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
    act(() => {
      void view.result.current.submit('1990-06-15');
    });
    // Round-trip A → B → A while A's PATCH is still pending.
    view.rerender({ customerId: 'shopper-B' });
    view.rerender({ customerId: 'shopper-A' });

    // Reopen and resubmit under A — the write guard is still held, so no second
    // overlapping write starts.
    act(() => view.result.current.open(event));
    await act(async () => {
      await view.result.current.submit('1988-03-10');
    });
    expect(updateCustomer).toHaveBeenCalledTimes(1);

    // Once the original PATCH settles, the guard releases and a resubmit goes
    // through as a single, non-overlapping write.
    await act(async () => {
      resolveFirst({ success: true });
    });
    await act(async () => {
      await view.result.current.submit('1988-03-10');
    });
    expect(updateCustomer).toHaveBeenCalledTimes(2);
  });

  it('closes an idle open gate when the account switches before Continue', () => {
    // Regression (is6TzWK4): the gate is open (Start tapped, DOB not yet entered)
    // and the account switches. The modal must close so the new shopper can't
    // submit their DOB against the previous shopper's event.
    const view = renderHook(
      ({ customerId }: { customerId: string | null }) =>
        useQuizAgeGate({
          runStart: vi.fn().mockResolvedValue(null),
          updateCustomer: vi.fn().mockResolvedValue({ success: true }),
          clearStartError: vi.fn(),
          currentCustomerId: customerId,
        }),
      { initialProps: { customerId: 'shopper-A' } }
    );

    act(() => view.result.current.open(event));
    expect(view.result.current.event).toBe(event);

    // Account switches while the gate is idle-open.
    view.rerender({ customerId: 'shopper-B' });

    expect(view.result.current.event).toBeNull();
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

    // The save was A's intent; the start must NOT fire under B's session, and
    // the gate must close rather than leave A's event open for B to submit.
    expect(runStart).not.toHaveBeenCalled();
    expect(view.result.current.event).toBeNull();
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

    // Gate must close cleanly without acting under B's session — the modal is
    // dismissed (event null) so B can't submit against A's event, and no error
    // is set for B.
    expect(view.result.current.event).toBeNull();
    expect(view.result.current.error).toBeNull();
  });
});
