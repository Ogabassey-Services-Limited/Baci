import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useQuizStartGate } from './useQuizStartGate';

let mockUsername: string | null | undefined = null;

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: { customer: { username: typeof mockUsername } }) => unknown
  ) => selector({ customer: { username: mockUsername } }),
}));

describe('useQuizStartGate', () => {
  beforeEach(() => {
    mockUsername = null;
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
    mockUsername = 'ogafan';
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
});
