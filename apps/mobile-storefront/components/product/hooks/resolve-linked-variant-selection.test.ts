import { describe, expect, it } from '@jest/globals';
import type { ProductVariant } from '@/types/product';
import { resolveLinkedVariantSelection } from './resolve-linked-variant-selection';

type SelectionInput = Parameters<typeof resolveLinkedVariantSelection>[0];

const redmi15Variants: ProductVariant[] = [
  {
    id: 'redmi-15-6-128',
    name: '6GB 128GB',
    condition: 'new',
    price: 212651.16,
    stock_quantity: 0,
    attributes: { ram: '6GB', storage: '128GB' },
  },
  {
    id: 'redmi-15-8-256',
    name: '8GB 256GB',
    condition: 'new',
    price: 230604.65,
    stock_quantity: 0,
    attributes: { ram: '8GB', storage: '256GB' },
  },
];

function resolveSelection(overrides: Partial<SelectionInput>) {
  return resolveLinkedVariantSelection({
    axis: 'ram',
    attributes: { ram: '8GB' },
    color: null,
    condition: 'new',
    storage: '128GB',
    usesVariantConditions: true,
    value: '8GB',
    variants: redmi15Variants,
    ...overrides,
  });
}

describe('resolveLinkedVariantSelection', () => {
  it('moves storage to the reachable value when RAM changes', () => {
    expect(resolveSelection({})).toEqual({
      attributes: { ram: '8GB' },
      color: null,
      storage: '256GB',
    });
  });

  it('moves RAM to the reachable value when storage changes', () => {
    expect(
      resolveSelection({
        axis: 'storage',
        attributes: { ram: '6GB' },
        storage: '256GB',
        value: '256GB',
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: null,
      storage: '256GB',
    });
  });

  it('keeps an exact selected combination before relinking axes', () => {
    expect(
      resolveSelection({
        attributes: { ram: '6GB' },
        value: '6GB',
      })
    ).toEqual({
      attributes: { ram: '6GB' },
      color: null,
      storage: '128GB',
    });
  });

  it('returns null when variants are unavailable', () => {
    for (const variants of [
      [],
      null,
      undefined,
    ] as SelectionInput['variants'][]) {
      expect(resolveSelection({ variants })).toBeNull();
    }
  });

  it('returns null when no variant matches the changed axis', () => {
    expect(
      resolveSelection({
        attributes: { ram: '12GB' },
        value: '12GB',
      })
    ).toBeNull();
  });

  it('prefers the requested color before relaxing other axes', () => {
    expect(
      resolveSelection({
        color: 'Blue',
        storage: '512GB',
        variants: [
          {
            id: 'black-8-256',
            name: '8GB 256GB Black',
            condition: 'new',
            price: 1,
            attributes: {
              colour: 'Black',
              ram: '8GB',
              storage: '256GB',
            },
          },
          {
            id: 'blue-8-128',
            name: '8GB 128GB Blue',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Blue',
              ram: '8GB',
              storage: '128GB',
            },
          },
        ],
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: 'Blue',
      storage: '128GB',
    });
  });

  it('normalizes the colour alias into the selected color', () => {
    expect(
      resolveSelection({
        color: 'Black',
        storage: '512GB',
        variants: [
          {
            id: 'black-8-256',
            name: '8GB 256GB Black',
            condition: 'new',
            price: 1,
            attributes: {
              colour: 'Black',
              ram: '8GB',
              storage: '256GB',
            },
          },
        ],
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: 'Black',
      storage: '256GB',
    });
  });

  it('prefers a matching condition before relaxing to axis-only matches', () => {
    expect(
      resolveSelection({
        variants: [
          {
            id: 'used-8-512',
            name: '8GB 512GB Used',
            condition: 'used',
            price: 1,
            attributes: { ram: '8GB', storage: '512GB' },
          },
          {
            id: 'new-8-256',
            name: '8GB 256GB New',
            condition: 'new',
            price: 1,
            attributes: { ram: '8GB', storage: '256GB' },
          },
        ],
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: null,
      storage: '256GB',
    });
  });

  it('falls back to an axis-only match when condition cannot match', () => {
    expect(
      resolveSelection({
        variants: [
          {
            id: 'used-8-512',
            name: '8GB 512GB Used',
            condition: 'used',
            price: 1,
            attributes: { ram: '8GB', storage: '512GB' },
          },
        ],
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: null,
      storage: '512GB',
    });
  });

  it('matches the changed axis case-insensitively', () => {
    expect(resolveSelection({ axis: 'RAM' })).toEqual({
      attributes: { ram: '8GB' },
      color: null,
      storage: '256GB',
    });
  });

  it('preserves attribute-backed condition chips when condition is the changed axis', () => {
    expect(
      resolveSelection({
        axis: 'condition',
        attributes: { condition: 'open_box' },
        condition: null,
        storage: null,
        usesVariantConditions: false,
        value: 'open_box',
        variants: [
          {
            id: 'used-128',
            name: '128GB Used',
            price: 1,
            attributes: { condition: 'used', storage: '128GB' },
          },
          {
            id: 'open-box-256',
            name: '256GB Open Box',
            price: 2,
            attributes: { condition: 'open_box', storage: '256GB' },
          },
        ],
      })
    ).toEqual({
      attributes: { condition: 'open_box' },
      color: null,
      storage: '256GB',
    });
  });

  it('normalizes caller-provided axes and values before matching variants', () => {
    expect(
      resolveSelection({
        axis: ' RAM ',
        attributes: { ' RAM ': ' 8GB ' },
        color: ' Blue ',
        storage: ' 128GB ',
        value: ' 8GB ',
        variants: [
          {
            id: 'blue-8-256',
            name: '8GB 256GB Blue',
            condition: 'new',
            price: 1,
            attributes: {
              color: 'Blue',
              ram: '8GB',
              storage: '256GB',
            },
          },
        ],
      })
    ).toEqual({
      attributes: { ram: '8GB' },
      color: 'Blue',
      storage: '256GB',
    });
  });
});
