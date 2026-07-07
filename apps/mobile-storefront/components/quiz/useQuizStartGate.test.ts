import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useQuizStartGate } from './useQuizStartGate';

type MockCustomer = { username: string | null } | null;
let mockCustomer: MockCustomer = { username: null };

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (selector: (state: { customer: MockCustomer }) => unknown) =>
    selector({ customer: mockCustomer }),
}));

describe('useQuizStartGate', () => {
  beforeEach(() => {
    mockCustomer = { username: null };
  });

  it('opens the gate instead of starting when the customer has no username', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    expect(result.current.isGateVisible).toBe(true);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('starts immediately when the customer already has a username', () => {
    mockCustomer = { username: 'ogafan' };
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('closes the gate without starting when cancelled', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

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
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    act(() => {
      result.current.confirmGate();
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('does nothing when confirmGate is called without a pending event', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.confirmGate();
    });

    expect(onStart).not.toHaveBeenCalled();
  });

  it('does not show the modal while the customer is still hydrating', () => {
    // Cold start: session is present but the customer row has not loaded yet.
    mockCustomer = null;
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    // The gate must stay hidden (customer not loaded), and the start is queued
    // rather than flashing the "set a username" prompt at a returning shopper.
    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('auto-continues the queued start once hydration supplies a username', () => {
    mockCustomer = null;
    const onStart = jest.fn();
    const { result, rerender } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    expect(onStart).not.toHaveBeenCalled();

    // Hydration resolves with an existing username.
    mockCustomer = { username: 'ogafan' };
    act(() => {
      rerender({});
    });

    expect(onStart).toHaveBeenCalledWith('event-1');
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(result.current.isGateVisible).toBe(false);
  });

  it('starts only once when a username arrives and the gate is also confirmed', () => {
    const onStart = jest.fn();
    const { result, rerender } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    // Simulate the modal setting a username (store now reflects it) AND the
    // modal's success callback confirming the gate in the same cycle.
    mockCustomer = { username: 'ogafan' };
    act(() => {
      rerender({});
      result.current.confirmGate();
    });

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });
});
