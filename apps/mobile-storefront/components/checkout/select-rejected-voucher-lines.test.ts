import { describe, expect, it } from '@jest/globals';
import {
  selectRejectedVoucherLineIds,
  type VoucherCartLine,
} from './select-rejected-voucher-lines';

const voucher = (id: string): VoucherCartLine => ({
  id,
  voucher_token: `token-${id}`,
  voucher_award_id: `award-${id}`,
});
const plain = (id: string): VoucherCartLine => ({ id });

describe('selectRejectedVoucherLineIds', () => {
  it('returns nothing when the error is not a voucher rejection', () => {
    expect(
      selectRejectedVoucherLineIds([voucher('v1'), plain('n1')], {
        isRejection: false,
      })
    ).toEqual([]);
  });

  it('prunes only the server-identified token, keeping other valid vouchers', () => {
    expect(
      selectRejectedVoucherLineIds([voucher('v1'), voucher('v2'), plain('n1')], {
        isRejection: true,
        rejectedVoucherToken: 'token-v2',
      })
    ).toEqual(['v2']);
  });

  it('prunes the single voucher line when the server did not identify one', () => {
    expect(
      selectRejectedVoucherLineIds([voucher('v1'), plain('n1')], {
        isRejection: true,
      })
    ).toEqual(['v1']);
  });

  it('prunes nothing from a multi-voucher cart when no token is identified', () => {
    expect(
      selectRejectedVoucherLineIds([voucher('v1'), voucher('v2')], {
        isRejection: true,
        rejectedVoucherToken: null,
      })
    ).toEqual([]);
  });
});
