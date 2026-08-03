import { describe, expect, it } from 'vitest';
import { getBuilderAiStructuralFailure } from './builder-ai-structure-guards';

const text = (id: string) => ({ props: { id }, type: 'Text' });

describe('getBuilderAiStructuralFailure', () => {
  it('preserves structural counts, catalog availability, and the block budget', () => {
    expect(
      getBuilderAiStructuralFailure([text('one')], {
        footers: 0,
        headers: 0,
        requiresProductGrid: false,
      })
    ).toBeUndefined();
    expect(
      getBuilderAiStructuralFailure([text('one')], {
        footers: 0,
        headers: 1,
        requiresProductGrid: false,
      })
    ).toBe('Protected component cardinality changed');
    expect(
      getBuilderAiStructuralFailure([text('one')], {
        footers: 0,
        headers: 0,
        requiresProductGrid: true,
      })
    ).toBe('A storefront requires one ProductGrid');
    expect(
      getBuilderAiStructuralFailure(
        Array.from({ length: 501 }, (_, index) => text(String(index))),
        { footers: 0, headers: 0, requiresProductGrid: false }
      )
    ).toBe('Builder document has too many blocks');
  });
});
