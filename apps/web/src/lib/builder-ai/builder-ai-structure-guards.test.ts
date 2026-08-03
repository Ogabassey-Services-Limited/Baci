import { describe, expect, it } from 'vitest';
import {
  getBuilderAiStructuralBaseline,
  getBuilderAiStructuralFailure,
} from './builder-ai-structure-guards';

const text = (id: string) => ({ props: { id }, type: 'Text' });

describe('getBuilderAiStructuralFailure', () => {
  it('preserves structural counts, catalog availability, and the block budget', () => {
    const oneBlockBaseline = getBuilderAiStructuralBaseline([text('one')]);
    expect(
      getBuilderAiStructuralFailure([text('one')], oneBlockBaseline)
    ).toBeUndefined();
    expect(
      getBuilderAiStructuralFailure([text('one')], {
        ...oneBlockBaseline,
        headers: 1,
      })
    ).toBe('Protected component cardinality changed');
    expect(
      getBuilderAiStructuralFailure([text('one')], {
        ...oneBlockBaseline,
        requiresProductGrid: true,
      })
    ).toBe('A storefront requires one ProductGrid');
    expect(
      getBuilderAiStructuralFailure(
        Array.from({ length: 501 }, (_, index) => text(String(index))),
        getBuilderAiStructuralBaseline(
          Array.from({ length: 501 }, (_, index) => text(String(index)))
        )
      )
    ).toBe('Builder document has too many blocks');
  });
});
