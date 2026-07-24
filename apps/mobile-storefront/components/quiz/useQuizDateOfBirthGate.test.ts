import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useQuizDateOfBirthGate } from './useQuizDateOfBirthGate';

type MockCustomer = { date_of_birth: string | null } | null;
let mockCustomer: MockCustomer = { date_of_birth: null };

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { customer: MockCustomer }) => unknown) =>
    selector({ customer: mockCustomer }),
}));

describe('useQuizDateOfBirthGate', () => {
  beforeEach(() => {
    mockCustomer = { date_of_birth: null };
  });

  it('opens the gate instead of starting when the loaded customer has no date of birth', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    expect(result.current.isGateVisible).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts immediately when the customer already has a date of birth', () => {
    mockCustomer = { date_of_birth: '1990-06-15' };
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('closes the gate without starting when cancelled', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    act(() => {
      result.current.cancelGate();
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts the previously selected event once the gate is confirmed', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    act(() => {
      result.current.confirmGate();
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('does not start the quiz when a late success callback fires after cancellation', () => {
    // Reproduces the cancel-race: the shopper taps Continue (which captures a
    // confirmGate closure while an async setDateOfBirth is in flight), then taps
    // Cancel before the RPC resolves. The captured (stale) confirmGate must be
    // a no-op — the exam pass must not be spent against an explicit cancel.
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    const staleConfirmGate = result.current.confirmGate;

    act(() => {
      result.current.cancelGate();
    });

    act(() => {
      staleConfirmGate();
    });

    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.isGateVisible).toBe(false);
  });

  it('does nothing when confirmGate is called without a pending event', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.confirmGate();
    });

    expect(onStart).not.toHaveBeenCalled();
  });

  it('falls back to the server start when the customer is not loaded (hydrating)', () => {
    // Cold start: the session is present but the customer row has not hydrated
    // yet, so we cannot tell whether a date of birth exists.
    mockCustomer = null;
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
