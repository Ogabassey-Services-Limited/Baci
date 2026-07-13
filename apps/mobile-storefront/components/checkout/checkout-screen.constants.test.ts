import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

describe('checkout screen constants', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.unmock('expo-constants');
    jest.resetModules();
  });

  it('uses the merchant domain from Expo extra', async () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            apiUrl: 'https://usebaci.com/api',
            merchantDomain: 'shop.example.com',
          },
        },
      },
    }));

    const { CHECKOUT_MERCHANT_DOMAIN } = await import(
      './checkout-screen.constants'
    );

    expect(CHECKOUT_MERCHANT_DOMAIN).toBe('shop.example.com');
  });

  it('trims the merchant domain from Expo extra', async () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            apiUrl: 'https://usebaci.com/api',
            merchantDomain: '  shop.example.com  ',
          },
        },
      },
    }));

    const { CHECKOUT_MERCHANT_DOMAIN } = await import(
      './checkout-screen.constants'
    );

    expect(CHECKOUT_MERCHANT_DOMAIN).toBe('shop.example.com');
  });

  it('falls back to the Ogabassey domain when Expo extra omits the domain', async () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            apiUrl: 'https://usebaci.com/api',
          },
        },
      },
    }));

    const { CHECKOUT_MERCHANT_DOMAIN } = await import(
      './checkout-screen.constants'
    );

    expect(CHECKOUT_MERCHANT_DOMAIN).toBe('ogabassey.com');
  });

  it('falls back to the Ogabassey domain when Expo extra is blank', async () => {
    jest.doMock('expo-constants', () => ({
      __esModule: true,
      default: {
        expoConfig: {
          extra: {
            apiUrl: 'https://usebaci.com/api',
            merchantDomain: '   ',
          },
        },
      },
    }));

    const { CHECKOUT_MERCHANT_DOMAIN } = await import(
      './checkout-screen.constants'
    );

    expect(CHECKOUT_MERCHANT_DOMAIN).toBe('ogabassey.com');
  });
});
