import { describe, expect, it, jest } from '@jest/globals';
import { Alert } from 'react-native';
import type { Biller } from '@/hooks/use-vtu-billers';
import type { useVTUVerify } from '@/hooks/use-vtu-verify';
import { createBillFormVerifyHandler } from './create-bill-form-verify-handler';

type Verify = ReturnType<typeof useVTUVerify>;

const BILLER: Biller = {
  billerId: 'ekedc',
  billerName: 'EKEDC NG',
  billerType: 'Electricity',
  categoryId: 'electricity',
  categoryName: 'Electricity',
  billItems: [],
};

function createVerify() {
  return { mutate: jest.fn(), reset: jest.fn() } as unknown as Verify;
}

function createArgs(overrides: Record<string, unknown> = {}) {
  return {
    dismissKeyboard: jest.fn(),
    isBillItemSelectionComplete: true,
    normalizedCustomerId: '43901766923',
    onVerifySuccess: jest.fn(),
    pendingVerificationKeyRef: { current: null as string | null },
    requiresBillItemSelection: false,
    selectedBiller: BILLER,
    selectedBillItem: null,
    selectedBillItemIdentifier: 'ekedc',
    type: 'power' as const,
    verificationKey: 'ekedc:ekedc:43901766923',
    verify: createVerify(),
    ...overrides,
  };
}

describe('createBillFormVerifyHandler', () => {
  it('records the in-flight key and fires the verify mutation', () => {
    const args = createArgs();

    createBillFormVerifyHandler(args)();

    expect(args.dismissKeyboard).toHaveBeenCalledTimes(1);
    expect(args.pendingVerificationKeyRef.current).toBe(
      'ekedc:ekedc:43901766923'
    );
    expect(args.verify.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ customerIdentifier: '43901766923' }),
      { onSuccess: args.onVerifySuccess }
    );
  });

  it('alerts and skips the mutation when the meter number is missing', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const args = createArgs({ normalizedCustomerId: '' });

    createBillFormVerifyHandler(args)();

    expect(alertSpy).toHaveBeenCalledWith(
      'Missing Information',
      expect.stringContaining('meter number')
    );
    expect(args.verify.mutate).not.toHaveBeenCalled();
    expect(args.pendingVerificationKeyRef.current).toBeNull();
    alertSpy.mockRestore();
  });
});
