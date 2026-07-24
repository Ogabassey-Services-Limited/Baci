import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCustomerFormReset } from './use-customer-form-reset';

/**
 * `customerEpoch` is the durable output the forms key on. `customerChanged` is
 * a within-render transient: it is true only on the render that observes the
 * change and, because the hook updates `prevCustomerId` in that same render, it
 * settles back to false — so these tests assert the epoch, and only assert
 * `customerChanged` on renders where no change occurs.
 */
describe('useCustomerFormReset', () => {
  it('starts at epoch 0 and reports no change on the first render', () => {
    const { result } = renderHook(
      ({ id }: { id: string | undefined }) => useCustomerFormReset(id),
      { initialProps: { id: 'customer-1' as string | undefined } }
    );

    expect(result.current.customerEpoch).toBe(0);
    expect(result.current.customerChanged).toBe(false);
  });

  it('does NOT bump the epoch on the first hydration (guest -> customer)', () => {
    // A guest typing before auth resolves must keep their input: the epoch,
    // which the forms key on, stays 0 across undefined -> defined.
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useCustomerFormReset(id),
      { initialProps: { id: undefined as string | undefined } }
    );

    expect(result.current.customerEpoch).toBe(0);

    rerender({ id: 'customer-1' });

    expect(result.current.customerEpoch).toBe(0);
  });

  it('bumps the epoch on an account switch (A -> B)', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useCustomerFormReset(id),
      { initialProps: { id: 'customer-1' as string | undefined } }
    );

    rerender({ id: 'customer-2' });

    expect(result.current.customerEpoch).toBe(1);
  });

  it('bumps the epoch on sign-out (A -> guest)', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useCustomerFormReset(id),
      { initialProps: { id: 'customer-1' as string | undefined } }
    );

    rerender({ id: undefined });

    expect(result.current.customerEpoch).toBe(1);
  });

  it('bumps the epoch once per distinct switch, not on same-customer re-renders', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | undefined }) => useCustomerFormReset(id),
      { initialProps: { id: 'customer-1' as string | undefined } }
    );

    rerender({ id: 'customer-1' });
    expect(result.current.customerEpoch).toBe(0);
    expect(result.current.customerChanged).toBe(false);

    rerender({ id: 'customer-2' });
    expect(result.current.customerEpoch).toBe(1);

    rerender({ id: 'customer-2' });
    expect(result.current.customerEpoch).toBe(1);

    rerender({ id: 'customer-3' });
    expect(result.current.customerEpoch).toBe(2);
  });
});
