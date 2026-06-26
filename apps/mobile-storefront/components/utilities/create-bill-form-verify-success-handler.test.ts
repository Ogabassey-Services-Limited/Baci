import { jest } from '@jest/globals';
import type { Biller } from '@/hooks/use-vtu-billers';
import type { VerifyResult } from '@/hooks/use-vtu-verify';
import { createBillFormVerifySuccessHandler } from './create-bill-form-verify-success-handler';

type VerifySuccessHandlerOptions = Parameters<
  typeof createBillFormVerifySuccessHandler
>[0];

const biller = {
  billerId: 'IKEDC',
  billerName: 'Ikeja Electric',
} as Biller;

function setup(overrides: Partial<VerifySuccessHandlerOptions> = {}) {
  const setters = {
    setBeneficiarySaveRequest: jest.fn(),
    setVerifiedCustomerAddress: jest.fn(),
    setVerifiedCustomerName: jest.fn(),
    setVerifiedRequireValidationRef: jest.fn(),
    setVerifiedSelectionKey: jest.fn(),
    setVerifiedValidationReference: jest.fn(),
  };
  const pendingVerificationKeyRef: { current: string | null } = {
    current: 'IKEDC:PREPAID:0102030405',
  };
  const handler = createBillFormVerifySuccessHandler({
    authenticatedCustomerId: 'cust-1',
    normalizedCustomerId: '0102030405',
    pendingVerificationKeyRef,
    selectedBiller: biller,
    selectedBillItemIdentifier: 'PREPAID',
    ...setters,
    ...overrides,
  });
  return { handler, pendingVerificationKeyRef, ...setters };
}

const verifiedData: VerifyResult = {
  verified: true,
  customerName: 'Jane Meter',
  address: '12 Marina Road, Lagos',
  message: 'ok',
  validationReference: 'VAL-1',
  requireValidationRef: true,
};

describe('createBillFormVerifySuccessHandler', () => {
  it('commits verified name, address, and validation state and queues a beneficiary save', () => {
    const ctx = setup();

    ctx.handler(verifiedData);

    expect(ctx.setVerifiedSelectionKey).toHaveBeenCalledWith(
      'IKEDC:PREPAID:0102030405'
    );
    expect(ctx.pendingVerificationKeyRef.current).toBeNull();
    expect(ctx.setVerifiedCustomerName).toHaveBeenCalledWith('Jane Meter');
    expect(ctx.setVerifiedCustomerAddress).toHaveBeenCalledWith(
      '12 Marina Road, Lagos'
    );
    expect(ctx.setVerifiedValidationReference).toHaveBeenCalledWith('VAL-1');
    expect(ctx.setVerifiedRequireValidationRef).toHaveBeenCalledWith(true);
    expect(ctx.setBeneficiarySaveRequest).toHaveBeenCalledWith({
      authenticatedCustomerId: 'cust-1',
      billerId: 'IKEDC',
      billerName: 'Ikeja Electric',
      billItemIdentifier: 'PREPAID',
      customerId: '0102030405',
      customerName: 'Jane Meter',
    });
  });

  it('ignores responses that are not verified', () => {
    const ctx = setup();

    ctx.handler({ ...verifiedData, verified: false });

    expect(ctx.setVerifiedSelectionKey).not.toHaveBeenCalled();
    expect(ctx.setBeneficiarySaveRequest).not.toHaveBeenCalled();
  });

  it('ignores responses whose pending key was cleared mid-flight', () => {
    const ctx = setup();
    ctx.pendingVerificationKeyRef.current = null;

    ctx.handler(verifiedData);

    expect(ctx.setVerifiedCustomerAddress).not.toHaveBeenCalled();
  });

  it('clears the beneficiary save request when no customer name resolves', () => {
    const ctx = setup();

    ctx.handler({ ...verifiedData, customerName: '   ' });

    expect(ctx.setVerifiedCustomerAddress).toHaveBeenCalledWith(
      '12 Marina Road, Lagos'
    );
    expect(ctx.setBeneficiarySaveRequest).toHaveBeenCalledWith(null);
  });
});
