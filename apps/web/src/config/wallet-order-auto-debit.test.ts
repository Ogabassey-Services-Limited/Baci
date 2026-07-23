import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWalletOrderAutoDebitWebEnabled } from '@/config/wallet-order-auto-debit';

const FLAG = 'NEXT_PUBLIC_WALLET_ORDER_AUTO_DEBIT_ENABLED';

describe('isWalletOrderAutoDebitWebEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is disabled by default so merging changes no production behaviour', () => {
    vi.stubEnv(FLAG, '');

    expect(isWalletOrderAutoDebitWebEnabled()).toBe(false);
  });

  it('is enabled only for the exact string "true"', () => {
    vi.stubEnv(FLAG, 'true');

    expect(isWalletOrderAutoDebitWebEnabled()).toBe(true);
  });

  it('rejects truthy-looking values that are not "true"', () => {
    vi.stubEnv(FLAG, '1');

    expect(isWalletOrderAutoDebitWebEnabled()).toBe(false);
  });
});
