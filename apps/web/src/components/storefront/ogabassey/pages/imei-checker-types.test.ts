import { describe, expect, it } from 'vitest';
import type {
  ImeiRequestIdentity,
  ProductSuggestion,
} from './imei-checker-types';

describe('imei-checker-types', () => {
  it('requires imei, tier, and key on ImeiRequestIdentity', () => {
    // The typed literal fails to compile if a field is dropped/renamed,
    // pinning the shape the idempotency-key cache keys off of.
    const identity: ImeiRequestIdentity = {
      imei: '354442067957452',
      tier: 'full',
      key: 'a-uuid',
    };

    expect(Object.keys(identity).sort()).toEqual(['imei', 'key', 'tier']);
  });

  it('allows category and image to be omitted on ProductSuggestion', () => {
    const suggestion: ProductSuggestion = { id: 'p1', name: 'iPhone 15 Pro' };

    expect(suggestion.category).toBeUndefined();
    expect(suggestion.image).toBeUndefined();
  });
});
