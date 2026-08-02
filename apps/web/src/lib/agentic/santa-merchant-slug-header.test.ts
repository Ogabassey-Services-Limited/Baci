import { describe, expect, it } from 'vitest';
import { SANTA_MERCHANT_SLUG_HEADER } from './santa-merchant-slug-header';

describe('SANTA_MERCHANT_SLUG_HEADER', () => {
  it('uses the shared response header name', () => {
    expect(SANTA_MERCHANT_SLUG_HEADER).toBe('x-baci-santa-merchant-slug');
  });
});
