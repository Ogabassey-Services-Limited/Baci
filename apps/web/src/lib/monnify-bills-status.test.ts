import { describe, expect, it } from 'vitest';
import { classifyMonnifyBillStatus } from './monnify-bills-status';

describe('classifyMonnifyBillStatus', () => {
  it('keeps a paid bill processing while delivery is in progress', () => {
    expect(
      classifyMonnifyBillStatus({ status: 'PAID', vendStatus: 'IN_PROGRESS' })
    ).toEqual({ isFailed: false, isProcessing: true, isSuccess: false });
  });

  it('uses the payment status when Monnify omits delivery status', () => {
    expect(classifyMonnifyBillStatus({ status: 'SUCCESSFUL' })).toEqual({
      isFailed: false,
      isProcessing: false,
      isSuccess: true,
    });
  });
});
