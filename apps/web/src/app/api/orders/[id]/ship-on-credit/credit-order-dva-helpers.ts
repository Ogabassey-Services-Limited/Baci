import {
  type OrderPaymentAccountLike,
  selectPreferredOrderPaymentAccount,
} from '@baci/shared';

interface CreditOrderDvaAccount extends OrderPaymentAccountLike {
  account_name: string;
  bank_name: string;
}

export const creditOrderDvaHelpers = {
  isReusableAccount(account: CreditOrderDvaAccount) {
    return selectPreferredOrderPaymentAccount([account]) !== null;
  },
  toCustomerName(customerName: string | null) {
    const parts = (customerName || 'Customer').trim().split(' ');
    return {
      firstName: parts[0] || 'Customer',
      lastName: parts.slice(1).join(' ') || 'User',
    };
  },
  toVirtualAccount(account: CreditOrderDvaAccount) {
    return {
      account_number: account.account_number,
      bank_name: account.bank_name,
      account_name: account.account_name,
    };
  },
};
