import { describe, expect, it, jest } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';

const mocks = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock('@/lib/repair-catalog-client', () => ({
  submitRepairBooking: (...args: unknown[]) => mocks(...args),
}));

import { useRepairBooking } from './use-repair-booking';

const validInput = {
  customerName: 'Ada Lovelace',
  customerEmail: 'ada@example.com',
  customerPhone: '08012345678',
  deviceType: 'Smartphone' as const,
  deviceModel: 'iPhone 13',
  issueDescription: 'Cracked screen needs replacement.',
  serviceType: 'dropoff' as const,
};

describe('useRepairBooking', () => {
  beforeEach(() => {
    mocks.mockReset();
  });

  it('starts idle with no result and no error', () => {
    const { result } = renderHook(() => useRepairBooking());

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('submits and stores the booking result on success', async () => {
    mocks.mockResolvedValueOnce({ id: 'repair-1', ticketNumber: 42 });

    const { result } = renderHook(() => useRepairBooking());

    await act(async () => {
      await result.current.submit(validInput);
    });

    expect(result.current.result).toEqual({
      id: 'repair-1',
      ticketNumber: 42,
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets isSubmitting true while the request is in flight', async () => {
    let resolveFn: (value: { id: string; ticketNumber: number }) => void = () => {};
    mocks.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFn = resolve;
      })
    );

    const { result } = renderHook(() => useRepairBooking());

    let submitPromise: Promise<void>;
    act(() => {
      submitPromise = result.current.submit(validInput);
    });

    await waitFor(() => expect(result.current.isSubmitting).toBe(true));

    await act(async () => {
      resolveFn({ id: 'repair-1', ticketNumber: 42 });
      await submitPromise;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('stores a friendly error message and field errors on failure', async () => {
    const error = new Error('Validation failed') as Error & {
      fieldErrors?: Record<string, string[]>;
    };
    error.fieldErrors = { customerEmail: ['Invalid email'] };
    mocks.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useRepairBooking());

    await act(async () => {
      await result.current.submit(validInput);
    });

    expect(result.current.error).toBe('Validation failed');
    expect(result.current.fieldErrors).toEqual({
      customerEmail: ['Invalid email'],
    });
    expect(result.current.result).toBeNull();
  });

  it('reset clears a previous result and error', async () => {
    mocks.mockResolvedValueOnce({ id: 'repair-1', ticketNumber: 42 });
    const { result } = renderHook(() => useRepairBooking());

    await act(async () => {
      await result.current.submit(validInput);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
