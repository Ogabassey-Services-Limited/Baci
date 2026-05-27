import { VTU_MIN_REDEEMABLE_POINTS } from '@baci/shared/lib';
import { WALLET_TOP_UP_MIN_AMOUNT } from '@/lib/wallet-top-up-constants';
import {
  buildWalletTopUpGatewayParams,
  deriveWalletDisplayData,
  getWalletCustomerName,
  getWalletLoadingMessage,
  parseWalletRedeemPointsInput,
  sanitizeWalletFundAmount,
  validateWalletTopUpAmount,
} from './wallet-screen.helpers';

describe('wallet-screen.helpers', () => {
  it('sanitizes wallet fund amount input', () => {
    expect(sanitizeWalletFundAmount('₦12,500.90')).toBe('1250090');
  });

  it('validates wallet top-up amount boundaries', () => {
    expect(validateWalletTopUpAmount(WALLET_TOP_UP_MIN_AMOUNT - 1)).toContain('between');
    expect(validateWalletTopUpAmount(WALLET_TOP_UP_MIN_AMOUNT)).toBeNull();
    expect(validateWalletTopUpAmount(1_000_000_001)).toContain('between');
  });

  it('resolves wallet customer name fallback chain', () => {
    expect(
      getWalletCustomerName(
        { first_name: 'Jane', last_name: 'Doe', email: 'jane@x.com' },
        { email: 'user@x.com' }
      )
    ).toBe('Jane Doe');
    expect(getWalletCustomerName({ email: 'jane@x.com' }, { email: 'u@x.com' })).toBe('jane@x.com');
    expect(getWalletCustomerName(null, { email: 'u@x.com' })).toBe('u@x.com');
    expect(getWalletCustomerName(null, null)).toBe('Customer');
  });

  it('builds payment-gateway params for wallet top-up', () => {
    expect(
      buildWalletTopUpGatewayParams({
        activeMerchantId: 'm-1',
        activeMerchantSlug: 'ogabassey',
        amount: 25000,
        result: {
          authorization_url: 'https://pay.example/authorize',
          gateway: 'paystack',
          reference: 'REF123',
        },
        walletReturnTo: '/checkout',
      })
    ).toEqual({
      amount: '25000',
      authorizationUrl: 'https://pay.example/authorize',
      gateway: 'paystack',
      merchantId: 'm-1',
      merchantSlug: 'ogabassey',
      paymentKind: 'wallet',
      reference: 'REF123',
      returnTo: '/checkout',
    });
  });

  it('parses redeem points input and validates constraints', () => {
    expect(
      parseWalletRedeemPointsInput('abc', VTU_MIN_REDEEMABLE_POINTS)
    ).toEqual({
      title: 'Invalid Input',
      message: 'Please enter a valid number of points',
    });
    expect(
      parseWalletRedeemPointsInput('50', VTU_MIN_REDEEMABLE_POINTS)
    ).toEqual({
      title: 'Invalid Points',
      message: 'Minimum redemption is 100 points',
    });
    expect(
      parseWalletRedeemPointsInput('150', VTU_MIN_REDEEMABLE_POINTS)
    ).toEqual({
      title: 'Invalid Points',
      message: 'Redeem points in 100-point blocks',
    });
    expect(
      parseWalletRedeemPointsInput('200', VTU_MIN_REDEEMABLE_POINTS)
    ).toEqual({ points: 200 });
  });

  it('derives wallet loading messages', () => {
    expect(
      getWalletLoadingMessage({
        hasMerchantContext: false,
        hasWalletData: false,
        isError: false,
        isLoading: false,
        user: null,
      })
    ).toBe('Preparing your wallet...');

    expect(
      getWalletLoadingMessage({
        hasMerchantContext: true,
        hasWalletData: false,
        isError: true,
        isLoading: false,
        user: { id: 'u1' },
      })
    ).toBe('Unable to load wallet.');

    expect(
      getWalletLoadingMessage({
        hasMerchantContext: true,
        hasWalletData: false,
        isError: false,
        isLoading: false,
        user: { id: 'u1' },
      })
    ).toBe('Preparing your wallet...');

    expect(
      getWalletLoadingMessage({
        hasMerchantContext: true,
        hasWalletData: true,
        isError: false,
        isLoading: false,
        user: { id: 'u1' },
      })
    ).toBeUndefined();
  });

  it('derives wallet display data', () => {
    expect(
      deriveWalletDisplayData({
        balance: 10,
        earnings_balance: 40,
        funding_account: {
          account_name: 'Jane Doe',
          account_number: '1234567890',
          bank_name: 'Kuda',
          provider: 'paystack',
        },
        savings_balance: 60,
        total_balance: null,
      })
    ).toEqual({
      earningsBalance: 40,
      fundingAccount: {
        accountName: 'Jane Doe',
        accountNumber: '1234567890',
        bankName: 'Kuda',
        provider: 'paystack',
      },
      savingsBalance: 60,
      showQuickSave: true,
      totalBalance: 100,
    });
  });

  it('falls back balances and nulls incomplete funding account data', () => {
    expect(
      deriveWalletDisplayData({
        balance: 15,
        earnings_balance: null,
        funding_account: {
          account_name: 'Jane Doe',
          account_number: '   ',
          bank_name: 'Kuda',
          provider: 'paystack',
        },
        savings_balance: 30,
        total_balance: null,
      })
    ).toEqual({
      earningsBalance: 15,
      fundingAccount: null,
      savingsBalance: 30,
      showQuickSave: true,
      totalBalance: 45,
    });

    expect(deriveWalletDisplayData({})).toEqual({
      earningsBalance: 0,
      fundingAccount: null,
      savingsBalance: 0,
      showQuickSave: false,
      totalBalance: 0,
    });
  });
});
