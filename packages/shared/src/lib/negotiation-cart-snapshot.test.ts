import { describe, expect, it } from 'vitest';
import {
  buildCartSnapshot,
  type NegotiationCartLine,
  summarizeCartForItemInfo,
} from './negotiation-cart-snapshot';

describe('buildCartSnapshot', () => {
  it('normalizes valid lines and keeps only present optional fields', () => {
    const snapshot = buildCartSnapshot([
      {
        product_id: 'p1',
        name: 'iPhone 15 Pro',
        price: 1200000,
        quantity: 2,
        image: 'https://cdn/img.png',
        variant_id: 'v1',
        brand: 'Apple',
        condition: 'new',
      },
    ]);

    expect(snapshot).toEqual([
      {
        product_id: 'p1',
        name: 'iPhone 15 Pro',
        price: 1200000,
        quantity: 2,
        image: 'https://cdn/img.png',
        variant_id: 'v1',
        brand: 'Apple',
        condition: 'new',
      },
    ]);
    // Absent optionals must not appear as undefined keys in persisted JSON.
    expect(Object.keys(snapshot[0])).not.toContain('variant_name');
  });

  it('drops lines missing id or name and coerces bad price/quantity', () => {
    const snapshot = buildCartSnapshot([
      { name: 'no id', price: 100, quantity: 1 },
      { product_id: 'p2', price: 100, quantity: 1 },
      { product_id: '  ', name: 'blank id', price: 1, quantity: 1 },
      {
        product_id: 'p3',
        name: 'Galaxy S24',
        price: Number.NaN,
        quantity: 0,
      },
    ]);

    expect(snapshot).toEqual([
      { product_id: 'p3', name: 'Galaxy S24', price: 0, quantity: 1 },
    ]);
  });

  it('floors fractional quantities and rejects negative prices', () => {
    const snapshot = buildCartSnapshot([
      { product_id: 'p4', name: 'Charger', price: -50, quantity: 2.9 },
    ]);

    expect(snapshot[0]).toMatchObject({ price: 0, quantity: 2 });
  });
});

describe('summarizeCartForItemInfo', () => {
  const lines: NegotiationCartLine[] = [
    { product_id: 'p1', name: 'iPhone 15 Pro', price: 1200000, quantity: 1 },
    { product_id: 'p2', name: 'Galaxy S24', price: 900000, quantity: 2 },
  ];

  it('returns null for an empty snapshot so callers can fall back', () => {
    expect(summarizeCartForItemInfo([], 100)).toBeNull();
  });

  it('summarizes units, names and carries image + current price', () => {
    const withImage: NegotiationCartLine[] = [
      { ...lines[0], image: 'https://cdn/a.png' },
      lines[1],
    ];

    const info = summarizeCartForItemInfo(withImage, 2100000);

    expect(info).toEqual({
      name: '3 items: iPhone 15 Pro, Galaxy S24',
      image: 'https://cdn/a.png',
      current_price: 2100000,
    });
  });

  it('uses singular wording for a single unit', () => {
    const info = summarizeCartForItemInfo(
      [{ product_id: 'p1', name: 'Case', price: 5000, quantity: 1 }],
      5000
    );

    expect(info?.name).toBe('1 item: Case');
  });

  it('truncates the name list past three products with a +N suffix', () => {
    const many: NegotiationCartLine[] = [
      { product_id: 'a', name: 'A', price: 1, quantity: 1 },
      { product_id: 'b', name: 'B', price: 1, quantity: 1 },
      { product_id: 'c', name: 'C', price: 1, quantity: 1 },
      { product_id: 'd', name: 'D', price: 1, quantity: 1 },
      { product_id: 'e', name: 'E', price: 1, quantity: 1 },
    ];

    const info = summarizeCartForItemInfo(many, 5);

    expect(info?.name).toBe('5 items: A, B, C +2');
  });

  it('omits current_price when not a valid number', () => {
    const info = summarizeCartForItemInfo(lines, Number.NaN);
    expect(info).not.toHaveProperty('current_price');
  });
});
