import { describe, expect, it } from 'vitest';
import {
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
  type EditableProductVariant,
} from '@/lib/product-variant-form';
import {
  buildVariantsFromOptions,
  countVariantCombinations,
  getVariantSignature,
  isPlaceholderVariant,
  mergeGeneratedVariants,
  type VariantOptionDraft,
} from './variant-generation';

const colorOption: VariantOptionDraft = {
  id: 'color',
  name: 'Color',
  values: [
    { id: 'c1', value: 'Black' },
    { id: 'c2', value: 'Blue' },
  ],
};

const storageOption: VariantOptionDraft = {
  id: 'storage',
  name: 'Storage',
  values: [
    { id: 's1', value: '128GB' },
    { id: 's2', value: '256GB' },
  ],
};

const defaults = { costPrice: 500, images: [], price: 1000 };

describe('countVariantCombinations', () => {
  it('returns 0 when there are no options and no conditions', () => {
    expect(countVariantCombinations([], [])).toBe(0);
  });

  it('multiplies option value counts', () => {
    expect(countVariantCombinations([colorOption, storageOption], [])).toBe(4);
  });

  it('multiplies by the number of selected conditions', () => {
    expect(
      countVariantCombinations([colorOption], ['new', 'used'])
    ).toBe(4);
  });

  it('counts condition-only generation', () => {
    expect(countVariantCombinations([], ['new', 'used'])).toBe(2);
  });

  it('ignores options with a name but no values', () => {
    const emptyOption: VariantOptionDraft = {
      id: 'blank',
      name: 'Size',
      values: [],
    };
    expect(countVariantCombinations([colorOption, emptyOption], [])).toBe(2);
  });

  it('dedupes option values case-insensitively', () => {
    const duplicateColorOption: VariantOptionDraft = {
      id: 'color',
      name: 'Color',
      values: [
        { id: 'c1', value: 'Black' },
        { id: 'c2', value: 'black' },
      ],
    };

    expect(countVariantCombinations([duplicateColorOption], [])).toBe(1);
  });
});

describe('buildVariantsFromOptions', () => {
  it('creates the cartesian product of option values', () => {
    const variants = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [colorOption, storageOption],
    });

    expect(variants).toHaveLength(4);
    const signatures = variants.map(getVariantSignature).sort();
    expect(signatures).toEqual([
      '::color=black|storage=128gb',
      '::color=black|storage=256gb',
      '::color=blue|storage=128gb',
      '::color=blue|storage=256gb',
    ]);
  });

  it('applies default pricing to every generated variant', () => {
    const variants = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [colorOption],
    });

    for (const variant of variants) {
      expect(variant.price).toBe(1000);
      expect(variant.cost_price).toBe(500);
    }
  });

  it('multiplies combinations by condition and tags each variant', () => {
    const variants = buildVariantsFromOptions({
      conditions: ['new', 'used'],
      defaults,
      options: [colorOption],
    });

    expect(variants).toHaveLength(4);
    expect(variants.filter((variant) => variant.condition === 'new')).toHaveLength(
      2
    );
    expect(
      variants.filter((variant) => variant.condition === 'used')
    ).toHaveLength(2);
  });

  it('gives each variant its own attribute objects with unique ids', () => {
    const variants = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [colorOption],
    });

    const ids = variants.flatMap((variant) =>
      variant.attributes.map((attribute) => attribute.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns condition-only variants when no options are provided', () => {
    const variants = buildVariantsFromOptions({
      conditions: ['new'],
      defaults,
      options: [],
    });

    expect(variants).toHaveLength(1);
    expect(variants[0].condition).toBe('new');
    expect(variants[0].attributes).toHaveLength(0);
  });

  it('returns nothing when there is nothing to build', () => {
    expect(
      buildVariantsFromOptions({ conditions: [], defaults, options: [] })
    ).toHaveLength(0);
  });
});

describe('getVariantSignature', () => {
  it('is order-independent across attributes', () => {
    const a = {
      attributes: [
        createEmptyVariantAttribute('Color', 'Black'),
        createEmptyVariantAttribute('Storage', '128GB'),
      ],
    };
    const b = {
      attributes: [
        createEmptyVariantAttribute('Storage', '128GB'),
        createEmptyVariantAttribute('Color', 'Black'),
      ],
    };
    expect(getVariantSignature(a)).toBe(getVariantSignature(b));
  });

  it('distinguishes by condition', () => {
    const attributes = [createEmptyVariantAttribute('Color', 'Black')];
    expect(getVariantSignature({ attributes, condition: 'new' })).not.toBe(
      getVariantSignature({ attributes, condition: 'used' })
    );
  });

  it('ignores machine attributes like color_hex', () => {
    const withHex = {
      attributes: [
        createEmptyVariantAttribute('Color', 'Red'),
        createEmptyVariantAttribute('color_hex', '#ff0000'),
      ],
    };
    const withoutHex = {
      attributes: [createEmptyVariantAttribute('Color', 'Red')],
    };
    expect(getVariantSignature(withHex)).toBe(getVariantSignature(withoutHex));
  });
});

describe('isPlaceholderVariant', () => {
  it('treats an untouched blank variant as a placeholder', () => {
    expect(isPlaceholderVariant(createEmptyEditableVariant())).toBe(true);
  });

  it('is not a placeholder once an attribute value is filled', () => {
    const variant: EditableProductVariant = {
      ...createEmptyEditableVariant(),
      attributes: [createEmptyVariantAttribute('Color', 'Black')],
    };
    expect(isPlaceholderVariant(variant)).toBe(false);
  });

  it('is not a placeholder when a condition, sku, or stock is set', () => {
    expect(
      isPlaceholderVariant({
        ...createEmptyEditableVariant(),
        condition: 'new',
      })
    ).toBe(false);
    expect(
      isPlaceholderVariant({ ...createEmptyEditableVariant(), sku: 'ABC' })
    ).toBe(false);
    expect(
      isPlaceholderVariant({
        ...createEmptyEditableVariant(),
        stock_quantity: 3,
      })
    ).toBe(false);
  });

  it('keeps a row whose price was customised away from the defaults', () => {
    const variant = createEmptyEditableVariant({ costPrice: 500, price: 5000 });

    // Structurally (no defaults) it still looks blank...
    expect(isPlaceholderVariant(variant)).toBe(true);
    // ...but against the parent defaults the custom price marks it as touched.
    expect(
      isPlaceholderVariant(variant, { costPrice: 500, price: 1000 })
    ).toBe(false);
  });
});

describe('mergeGeneratedVariants', () => {
  it('drops placeholder rows and appends generated variants', () => {
    const placeholder = createEmptyEditableVariant();
    const generated = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [colorOption],
    });

    const merged = mergeGeneratedVariants([placeholder], generated);

    expect(merged).toHaveLength(2);
    expect(merged).not.toContain(placeholder);
  });

  it('keeps a filled existing variant and skips duplicate generated rows', () => {
    const existing: EditableProductVariant = {
      ...createEmptyEditableVariant(),
      attributes: [createEmptyVariantAttribute('Color', 'Black')],
      sku: 'KEEP-1',
    };
    const generated = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [colorOption],
    });

    const merged = mergeGeneratedVariants([existing], generated);

    // Black already exists → only Blue is appended.
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(existing);
    expect(getVariantSignature(merged[1])).toBe('::color=blue');
  });

  it('dedups a generated variant against a web-created one carrying a hex', () => {
    const existing: EditableProductVariant = {
      ...createEmptyEditableVariant(),
      attributes: [
        createEmptyVariantAttribute('Color', 'Red'),
        createEmptyVariantAttribute('color_hex', '#ff0000'),
      ],
      sku: 'WEB-1',
    };
    const generated = buildVariantsFromOptions({
      conditions: [],
      defaults,
      options: [
        {
          id: 'color',
          name: 'Color',
          values: [
            { id: 'r', value: 'Red' },
            { id: 'b', value: 'Blue' },
          ],
        },
      ],
    });

    const merged = mergeGeneratedVariants([existing], generated);

    // The hex-carrying Red matches the generated Red → only Blue is appended.
    expect(merged).toHaveLength(2);
    expect(merged[0]).toBe(existing);
    expect(getVariantSignature(merged[1])).toBe('::color=blue');
  });
});
