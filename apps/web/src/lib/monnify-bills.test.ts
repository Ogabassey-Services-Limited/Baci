import { describe, expect, it } from 'vitest';
import {
  checkTransactionStatus,
  getBillerCategories,
  MonnifyTransientVendError,
  purchaseBill,
  sanitizeMonnifyErrorDetail,
  verifyBillCustomer,
} from './monnify-bills';

describe('monnify-bills public contract', () => {
  it('re-exports the bills client operations and error utilities', () => {
    expect(getBillerCategories).toBeTypeOf('function');
    expect(verifyBillCustomer).toBeTypeOf('function');
    expect(purchaseBill).toBeTypeOf('function');
    expect(checkTransactionStatus).toBeTypeOf('function');
    expect(sanitizeMonnifyErrorDetail).toBeTypeOf('function');
    expect(MonnifyTransientVendError).toBeTypeOf('function');
  });
});
