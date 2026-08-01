import { describe, expect, it } from 'vitest';
import { normalizeContentCurrencyTokens } from './normalize-content-currency-tokens';

describe('normalizeContentCurrencyTokens', () => {
  it('canonicalizes supported currency symbols to stable words', () => {
    const normalized = normalizeContentCurrencyTokens(
      'PSN Card £50, $50, €50, and ₦50'
    );

    expect(normalized).toBe('PSN Card gbp 50, usd 50, eur 50, and ngn 50');
  });
});
