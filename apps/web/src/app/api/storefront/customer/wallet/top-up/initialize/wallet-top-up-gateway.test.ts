import { describe, expect, it } from 'vitest';
import {
  selectWalletTopUpGateway,
  WalletTopUpClientError,
  type WalletTopUpGatewaySettings,
} from './wallet-top-up-gateway';

const base: WalletTopUpGatewaySettings = {
  korapay_enabled: null,
  paystack_enabled: null,
  preferred_local_gateway: null,
};

describe('selectWalletTopUpGateway', () => {
  it('defaults to Paystack (default ON) when nothing is configured', () => {
    expect(selectWalletTopUpGateway({ settings: base })).toBe('paystack');
  });

  it('rejects a requested Korapay top-up when the flag is null (opt-in)', () => {
    expect(() =>
      selectWalletTopUpGateway({
        requestedGateway: 'korapay',
        settings: base,
      })
    ).toThrow(WalletTopUpClientError);
  });

  it('honours an explicit Korapay opt-in when requested', () => {
    expect(
      selectWalletTopUpGateway({
        requestedGateway: 'korapay',
        settings: { ...base, korapay_enabled: true },
      })
    ).toBe('korapay');
  });

  it('does not auto-select Korapay via preferred_local_gateway when opt-in is absent', () => {
    // preferred is korapay but the flag is null -> falls through to Paystack.
    expect(
      selectWalletTopUpGateway({
        settings: { ...base, preferred_local_gateway: 'korapay' },
      })
    ).toBe('paystack');
  });

  it('uses preferred Korapay when it is explicitly enabled', () => {
    expect(
      selectWalletTopUpGateway({
        settings: {
          korapay_enabled: true,
          paystack_enabled: false,
          preferred_local_gateway: 'korapay',
        },
      })
    ).toBe('korapay');
  });

  it('throws when no gateway is enabled', () => {
    expect(() =>
      selectWalletTopUpGateway({
        settings: {
          korapay_enabled: false,
          paystack_enabled: false,
          preferred_local_gateway: null,
        },
      })
    ).toThrow(WalletTopUpClientError);
  });
});
