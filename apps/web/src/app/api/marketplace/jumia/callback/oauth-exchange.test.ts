import { describe, expect, it } from 'vitest';
import { exchangeJumiaOAuthTokens } from './oauth-exchange';

describe('exchangeJumiaOAuthTokens', () => {
  it('exports the ordinary OAuth exchange boundary', () => {
    expect(exchangeJumiaOAuthTokens).toBeTypeOf('function');
  });
});
