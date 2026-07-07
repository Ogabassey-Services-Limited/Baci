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

  it('opens the gate instead of starting when the loaded customer has no username', () => {
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

  it('falls back to the server start when the customer is not loaded (hydrating)', () => {
    // Cold start: the session is present but the customer row has not hydrated
    // yet, so we cannot tell whether a username exists.
    mockCustomer = null;
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });

    // No modal flash for a returning shopper; the server decides.
    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('does not leave a dead Start button when customer hydration fails (null customer)', () => {
    // syncAuthenticatedState leaves customer null on a post-auth sync failure;
    // the tap must still reach the server rather than being swallowed.
    mockCustomer = null;
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizStartGate(onStart));

    act(() => {
      result.current.requestStart('event-9');
    });

    expect(onStart).toHaveBeenCalledWith('event-9');
    expect(result.current.isGateVisible).toBe(false);
  });
});
