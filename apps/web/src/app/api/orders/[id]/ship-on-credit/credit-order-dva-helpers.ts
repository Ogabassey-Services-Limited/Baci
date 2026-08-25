interface CreditOrderDvaAccount {
  account_name: string;
  account_number: string;
  bank_name: string;
}

export const creditOrderDvaHelpers = {
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
