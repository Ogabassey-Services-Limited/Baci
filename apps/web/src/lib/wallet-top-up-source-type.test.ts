import { describe, expect, it } from 'vitest';
import { WALLET_TOP_UP_TRANSACTION_TYPE } from './wallet-top-up-source-type';

describe('WALLET_TOP_UP_TRANSACTION_TYPE', () => {
  it('is the exact wallet_topup source_type discriminator', () => {
    // `type` is 'credit' for cashback / refunds / order reversals too, so only
    // this source_type proves an inbound top-up landed. The value is a stored
    // contract shared by the writer (@/lib/customer-wallet-top-up) and the
    // credit-detection reader, so it must stay exactly 'wallet_topup'.
    expect(WALLET_TOP_UP_TRANSACTION_TYPE).toBe('wallet_topup');
  });
});
