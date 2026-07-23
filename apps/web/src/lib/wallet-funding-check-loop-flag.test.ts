import { afterEach, describe, expect, it, vi } from 'vitest';
import { isWalletFundingCheckLoopEnabled } from './wallet-funding-check-loop-flag';

describe('isWalletFundingCheckLoopEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is off by default so merging changes no production surface', () => {
    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', undefined);

    expect(isWalletFundingCheckLoopEnabled()).toBe(false);
  });

  it('is on only for the exact string "true"', () => {
    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'true');
    expect(isWalletFundingCheckLoopEnabled()).toBe(true);

    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'TRUE');
    expect(isWalletFundingCheckLoopEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', '1');
    expect(isWalletFundingCheckLoopEnabled()).toBe(false);

    vi.stubEnv('NEXT_PUBLIC_WALLET_FUNDING_CHECK_LOOP_ENABLED', 'false');
    expect(isWalletFundingCheckLoopEnabled()).toBe(false);
  });
});
