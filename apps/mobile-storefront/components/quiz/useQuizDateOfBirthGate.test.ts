import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react-native';
import { useQuizDateOfBirthGate } from './useQuizDateOfBirthGate';

type MockCustomer = { id?: string; date_of_birth: string | null } | null;
type MockUser = { id: string } | null;
let mockCustomer: MockCustomer = { id: 'cust-a', date_of_birth: null };
// The gate binds to the AUTH user id (stable across customer-row hydration), so
// the mock must expose `user` too.
let mockUser: MockUser = { id: 'user-a' };

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: (
    selector: (state: { customer: MockCustomer; user: MockUser }) => unknown
  ) => selector({ customer: mockCustomer, user: mockUser }),
}));

describe('useQuizDateOfBirthGate', () => {
  beforeEach(() => {
    mockCustomer = { id: 'cust-a', date_of_birth: null };
    mockUser = { id: 'user-a' };
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
    const generation = result.current.generation;
    act(() => {
      result.current.confirmGate(generation);
    });

    expect(result.current.isGateVisible).toBe(false);
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('ignores a stale confirm from a save that resolved after cancellation', () => {
    // The shopper taps Continue (snapshotting the open-time generation while an
    // async setDateOfBirth is in flight), then taps Cancel before it resolves.
    // The stale confirm must be a no-op — an explicit cancel must not spend the
    // exam pass.
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    const staleGeneration = result.current.generation;

    act(() => {
      result.current.cancelGate();
    });
    act(() => {
      result.current.confirmGate(staleGeneration);
    });

    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.isGateVisible).toBe(false);
  });

  it('does not start the newly-pending event when a stale save from another event resolves', () => {
    // Race: submit for event-1, cancel, then request event-2 before the first
    // save resolves. The stale confirm (bound to event-1's generation) must not
    // start event-2, which the shopper never confirmed.
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.requestStart('event-1');
    });
    const firstGeneration = result.current.generation;

    act(() => {
      result.current.cancelGate();
    });
    act(() => {
      result.current.requestStart('event-2');
    });

    // The late event-1 save resolves with its (now stale) generation.
    act(() => {
      result.current.confirmGate(firstGeneration);
    });
    expect(onStart).not.toHaveBeenCalled();

    // The current event-2 confirm still works.
    act(() => {
      result.current.confirmGate(result.current.generation);
    });
    expect(onStart).toHaveBeenCalledWith('event-2');
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('reopens the gate to correct a stored DOB that the server age gate rejected', () => {
    // The DOB is already on file (an adult mistyped it), so requestStart would
    // start straight through. reopenForCorrection forces the gate open with the
    // rejection reason so the shopper can fix it.
    mockCustomer = { date_of_birth: '2015-01-01' };
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.reopenForCorrection(
        'event-1',
        'Quiz participation requires an adult profile (18+)'
      );
    });

    expect(result.current.isGateVisible).toBe(true);
    expect(result.current.correctionError).toBe(
      'Quiz participation requires an adult profile (18+)'
    );

    act(() => {
      result.current.confirmGate(result.current.generation);
    });
    expect(onStart).toHaveBeenCalledWith('event-1');
  });

  it('opens the correction gate even when the customer row has not hydrated', () => {
    // Hydration failed (customer null), but the server age-gate 403 is positive
    // evidence a DOB is required, so the correction gate must still open.
    mockCustomer = null;
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.reopenForCorrection(
        'event-1',
        'Quiz participation requires an adult profile (18+)'
      );
    });

    expect(result.current.isGateVisible).toBe(true);
    expect(result.current.correctionError).toBe(
      'Quiz participation requires an adult profile (18+)'
    );
  });

  it('auto-starts a pending event when a concurrent save fills the date of birth', () => {
    // Event A's stale save resolves (filling date_of_birth) after the shopper
    // cancelled A and opened B: B's requirement is now met, so it must start
    // rather than strand behind a gate that has gone invisible.
    const onStart = jest.fn();
    const { result, rerender } = renderHook(
      ({ tick }: { tick: number }) => {
        void tick;
        return useQuizDateOfBirthGate(onStart);
      },
      { initialProps: { tick: 0 } }
    );

    act(() => {
      result.current.requestStart('event-2');
    });
    expect(result.current.isGateVisible).toBe(true);
    expect(onStart).not.toHaveBeenCalled();

    // The SAME shopper's concurrent save fills the DOB; re-render the hook.
    mockCustomer = { id: 'cust-a', date_of_birth: '1990-06-15' };
    act(() => {
      rerender({ tick: 1 });
    });

    expect(onStart).toHaveBeenCalledWith('event-2');
    expect(result.current.isGateVisible).toBe(false);
  });

  it('does not auto-start a pending event after the account switches', () => {
    // Shopper A opens the gate (no DOB); the account then switches to shopper B
    // who already has a DOB. The pending event must NOT start under B's session.
    mockCustomer = { id: 'cust-a', date_of_birth: null };
    mockUser = { id: 'user-a' };
    const onStart = jest.fn();
    const { result, rerender } = renderHook(
      ({ tick }: { tick: number }) => {
        void tick;
        return useQuizDateOfBirthGate(onStart);
      },
      { initialProps: { tick: 0 } }
    );

    act(() => {
      result.current.requestStart('event-2');
    });
    expect(result.current.isGateVisible).toBe(true);

    // Account switches to a different shopper (new auth user) who already has a
    // DOB.
    mockCustomer = { id: 'cust-b', date_of_birth: '1990-06-15' };
    mockUser = { id: 'user-b' };
    act(() => {
      rerender({ tick: 1 });
    });

    expect(onStart).not.toHaveBeenCalled();
    expect(result.current.isGateVisible).toBe(false);
  });

  it('preserves the correction gate when the customer row hydrates for the same user', () => {
    // Regression (is6TybvO): Start is tapped mid-hydration (customer still null),
    // the server rejects the stored DOB, and reopenForCorrection records the auth
    // user id. When syncAuthenticatedState then hydrates the SAME shopper's
    // customer row (customer.id null→cust-a), that must NOT be mistaken for an
    // account switch — the correction gate must stay open, not be discarded.
    mockCustomer = null;
    mockUser = { id: 'user-a' };
    const onStart = jest.fn();
    const { result, rerender } = renderHook(
      ({ tick }: { tick: number }) => {
        void tick;
        return useQuizDateOfBirthGate(onStart);
      },
      { initialProps: { tick: 0 } }
    );

    act(() => {
      result.current.reopenForCorrection(
        'event-1',
        'Quiz participation requires an adult profile (18+)'
      );
    });
    expect(result.current.isGateVisible).toBe(true);

    // The same shopper's customer row hydrates (null → cust-a); auth user is
    // unchanged. Correction mode keeps the stored DOB editable, so it must not
    // auto-start either.
    mockCustomer = { id: 'cust-a', date_of_birth: '2015-01-01' };
    act(() => {
      rerender({ tick: 1 });
    });

    expect(result.current.isGateVisible).toBe(true);
    expect(result.current.correctionError).toBe(
      'Quiz participation requires an adult profile (18+)'
    );
    expect(onStart).not.toHaveBeenCalled();
  });

  it('does nothing when confirmGate is called without a pending event', () => {
    const onStart = jest.fn();
    const { result } = renderHook(() => useQuizDateOfBirthGate(onStart));

    act(() => {
      result.current.confirmGate(result.current.generation);
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
