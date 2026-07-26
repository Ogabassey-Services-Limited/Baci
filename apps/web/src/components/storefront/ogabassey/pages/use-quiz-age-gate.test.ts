import { act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { event, setup } from './use-quiz-age-gate.test-support';

// Account-switch and concurrency (serialize/savePending) cases live in
// use-quiz-age-gate.account-switch.test.ts to keep each suite under the 300-line
// module limit.
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
