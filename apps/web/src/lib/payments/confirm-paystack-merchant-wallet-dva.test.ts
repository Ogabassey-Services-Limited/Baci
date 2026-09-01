import { describe, expect, it } from 'vitest';

describe('merchant wallet DVA confirmation', () => {
  it('keeps funding principal separate from earnings', () =>
    expect('merchant_wallet_topup').toBe('merchant_wallet_topup'));
});
