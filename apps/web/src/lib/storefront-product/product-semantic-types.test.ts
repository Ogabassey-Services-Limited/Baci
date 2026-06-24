import { describe, expectTypeOf, it } from 'vitest';
import type { ProductSemanticModel } from './product-semantic-types';

describe('ProductSemanticModel', () => {
  it('allows optional context paragraphs for semantic product copy', () => {
    expectTypeOf<ProductSemanticModel['contextParagraphs']>().toEqualTypeOf<
      string[] | undefined
    >();
    expectTypeOf<ProductSemanticModel['contextParagraphs']>().not.toEqualTypeOf<
      number[] | undefined
    >();
  });
});
