import { describe, expect, it } from 'vitest';
import {
  createEmptyEditableVariant,
  createEmptyVariantAttribute,
  type EditableProductVariant,
} from '@/lib/product-variant-form';
import {
  applyPricingUpdates,
  areVariantFilterSelectionsEqual,
  buildVariantPricingGroups,
  filterVariantIndexes,
  getDefaultPricingAxisIds,
  getSimilarVariantIndexes,
  getVariantAxes,
  pruneVariantFilterSelection,
} from './variant-group-pricing';

function makeVariant(params: {
  color?: string;
  condition?: 'new' | 'open_box' | 'used';
  costPrice?: number;
  hex?: string;
  price?: number;
  storage?: string;
}): EditableProductVariant {
  const attributes = [];
  if (params.color) {
    attributes.push(createEmptyVariantAttribute('Color', params.color));
  }
  if (params.hex) {
    attributes.push(createEmptyVariantAttribute('color_hex', params.hex));
  }
  if (params.storage) {
    attributes.push(createEmptyVariantAttribute('Storage', params.storage));
  }
  return {
    ...createEmptyEditableVariant(),
    attributes,
    condition: params.condition,
    cost_price: params.costPrice ?? 0,
    price: params.price ?? 0,
  };
}

// 4 variants: 2 colours × 2 storages, all Used. Price varies by storage only.
const usedPhones = [
  makeVariant({
    color: 'Black',
    condition: 'used',
    price: 400,
    storage: '64GB',
  }),
  makeVariant({
    color: 'Blue',
    condition: 'used',
    price: 400,
    storage: '64GB',
  }),
  makeVariant({
    color: 'Black',
    condition: 'used',
    price: 450,
    storage: '128GB',
  }),
  makeVariant({
    color: 'Blue',
    condition: 'used',
    price: 450,
    storage: '128GB',
  }),
];

describe('getVariantAxes', () => {
  it('derives condition and attribute axes with display labels', () => {
    const axes = getVariantAxes(usedPhones);

    expect(axes.map((axis) => axis.id)).toEqual([
      'condition',
      'attr:color',
      'attr:storage',
    ]);
    const storage = axes.find((axis) => axis.id === 'attr:storage');
    expect(storage?.values).toEqual(['64gb', '128gb']);
    expect(storage?.valueLabels['64gb']).toBe('64GB');
    const condition = axes.find((axis) => axis.isCondition);
    expect(condition?.valueLabels.used).toBe('Used');
  });

  it('omits the condition axis when no variant has a condition', () => {
    const axes = getVariantAxes([makeVariant({ color: 'Black' })]);
    expect(axes.some((axis) => axis.isCondition)).toBe(false);
  });

  it('never exposes machine attributes like color_hex as an axis', () => {
    const axes = getVariantAxes([
      makeVariant({ color: 'Black', hex: '#000000' }),
    ]);
    expect(axes.map((axis) => axis.id)).toEqual(['attr:color']);
  });
});

describe('getDefaultPricingAxisIds', () => {
  it('excludes colour axes by default', () => {
    const axes = getVariantAxes(usedPhones);
    expect(getDefaultPricingAxisIds(axes)).toEqual([
      'condition',
      'attr:storage',
    ]);
  });

  it('falls back to all axes when only colour exists', () => {
    const axes = getVariantAxes([
      makeVariant({ color: 'Black' }),
      makeVariant({ color: 'Blue' }),
    ]);
    expect(getDefaultPricingAxisIds(axes)).toEqual(['attr:color']);
  });
});

describe('buildVariantPricingGroups', () => {
  it('groups variants by the selected axes with shared pricing', () => {
    const axes = getVariantAxes(usedPhones).filter(
      (axis) => axis.id !== 'attr:color'
    );

    const groups = buildVariantPricingGroups(usedPhones, axes);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      commonPrice: 400,
      indexes: [0, 1],
      label: 'Used · 64GB',
    });
    expect(groups[1]).toMatchObject({
      commonPrice: 450,
      indexes: [2, 3],
      label: 'Used · 128GB',
    });
  });

  it('marks disagreeing prices as mixed (null)', () => {
    const variants = [
      makeVariant({ color: 'Black', price: 400, storage: '64GB' }),
      makeVariant({ color: 'Blue', price: 999, storage: '64GB' }),
    ];
    const axes = getVariantAxes(variants).filter(
      (axis) => axis.id === 'attr:storage'
    );

    const groups = buildVariantPricingGroups(variants, axes);

    expect(groups).toHaveLength(1);
    expect(groups[0].commonPrice).toBeNull();
  });
});

describe('getSimilarVariantIndexes', () => {
  it('finds the other colours of the same storage and condition', () => {
    expect(getSimilarVariantIndexes(usedPhones, 0)).toEqual([1]);
    expect(getSimilarVariantIndexes(usedPhones, 2)).toEqual([3]);
  });

  it('does not match across storage or condition boundaries', () => {
    const variants = [
      makeVariant({ color: 'Black', condition: 'used', storage: '64GB' }),
      makeVariant({ color: 'Black', condition: 'new', storage: '64GB' }),
      makeVariant({ color: 'Black', condition: 'used', storage: '128GB' }),
    ];
    expect(getSimilarVariantIndexes(variants, 0)).toEqual([]);
  });

  it('ignores hidden hex attributes when matching', () => {
    const variants = [
      makeVariant({ color: 'Black', hex: '#000', storage: '64GB' }),
      makeVariant({ color: 'Blue', hex: '#00f', storage: '64GB' }),
    ];
    expect(getSimilarVariantIndexes(variants, 0)).toEqual([1]);
  });
});

describe('filterVariantIndexes', () => {
  it('returns only variants matching every active filter', () => {
    const axes = getVariantAxes(usedPhones);

    const filtered = filterVariantIndexes(usedPhones, axes, {
      'attr:storage': '128gb',
    });

    expect(filtered).toEqual([2, 3]);
  });

  it('combines filters across axes', () => {
    const axes = getVariantAxes(usedPhones);

    const filtered = filterVariantIndexes(usedPhones, axes, {
      'attr:color': 'blue',
      'attr:storage': '64gb',
    });

    expect(filtered).toEqual([1]);
  });

  it('returns everything when no filter is active', () => {
    const axes = getVariantAxes(usedPhones);
    expect(
      filterVariantIndexes(usedPhones, axes, { 'attr:storage': null })
    ).toEqual([0, 1, 2, 3]);
  });
});

describe('pruneVariantFilterSelection', () => {
  it('drops selected values that no longer exist on an active axis', () => {
    const axes = getVariantAxes([
      makeVariant({ color: 'Black', storage: '64GB' }),
      makeVariant({ color: 'Blue', storage: '256GB' }),
    ]);

    expect(
      pruneVariantFilterSelection(
        { 'attr:color': 'blue', 'attr:storage': '128gb' },
        axes
      )
    ).toEqual({ 'attr:color': 'blue' });
  });

  it('treats null and missing selections as equal', () => {
    expect(areVariantFilterSelectionsEqual({ 'attr:storage': null }, {})).toBe(
      true
    );
  });
});

describe('applyPricingUpdates', () => {
  it('fans a price out to every index in the update', () => {
    const next = applyPricingUpdates(usedPhones, [
      { indexes: [0, 1], price: 500 },
    ]);

    expect(next[0].price).toBe(500);
    expect(next[1].price).toBe(500);
    // Untouched variants keep identity (no needless re-renders).
    expect(next[2]).toBe(usedPhones[2]);
  });

  it('applies price and cost independently', () => {
    const next = applyPricingUpdates(usedPhones, [
      { cost_price: 300, indexes: [0] },
    ]);

    expect(next[0].cost_price).toBe(300);
    expect(next[0].price).toBe(usedPhones[0].price);
  });

  it('merges multiple updates hitting the same variant', () => {
    const next = applyPricingUpdates(usedPhones, [
      { indexes: [0], price: 500 },
      { cost_price: 250, indexes: [0] },
    ]);

    expect(next[0].price).toBe(500);
    expect(next[0].cost_price).toBe(250);
  });
});
