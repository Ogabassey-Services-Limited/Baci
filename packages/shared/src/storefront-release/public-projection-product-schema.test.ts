import { describe, expect, it } from 'vitest';
import { StorefrontPublicProductSchema } from './public-projection-product-schema';

const product = {
  available: true,
  brand: 'Baci',
  currency: 'NGN',
  displayQuantityLimit: null,
  id: '123e4567-e89b-42d3-a456-426614174001',
  name: 'Phone',
  priceMinor: 100_000,
  slug: 'phone',
  status: 'active',
} as const;

describe('StorefrontPublicProductSchema', () => {
  it('preserves active condition offers', () => {
    const value = {
      ...product,
      conditionOffers: [
        {
          available: true,
          compareAtPriceMinor: 125_000,
          condition: 'used',
          id: '123e4567-e89b-42d3-a456-426614174002',
          priceMinor: 90_000,
          status: 'active',
          displayQuantityLimit: 2,
        },
      ],
      hasConditionOffers: true,
    } as const;

    expect(StorefrontPublicProductSchema.parse(value)).toEqual(value);
  });

  it('preserves variant comparison prices', () => {
    const value = {
      ...product,
      variants: [
        {
          available: true,
          compareAtPriceMinor: 120_000,
          displayQuantityLimit: 2,
          id: '123e4567-e89b-42d3-a456-426614174003',
          name: 'Black',
          priceMinor: 95_000,
        },
      ],
    } as const;

    expect(StorefrontPublicProductSchema.parse(value)).toEqual(value);
  });

  it('rejects condition offers without the explicit product capability flag', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          {
            available: true,
            condition: 'used',
            id: '123e4567-e89b-42d3-a456-426614174004',
            priceMinor: 90_000,
            status: 'active',
            displayQuantityLimit: 1,
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects unbounded offer stock while accepting the reviewed display cap', () => {
    const offer = {
      available: true,
      condition: 'used',
      id: '123e4567-e89b-42d3-a456-426614174005',
      priceMinor: 90_000,
      status: 'active',
    } as const;

    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [{ ...offer, stockQuantity: 500 }],
        hasConditionOffers: true,
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [{ ...offer, displayQuantityLimit: 100 }],
        hasConditionOffers: true,
      }).success
    ).toBe(true);
  });

  it('rejects condition aliases and duplicate variant selection tuples', () => {
    const variant = {
      attributes: { Color: 'Black' },
      available: true,
      condition: 'new',
      displayQuantityLimit: 1,
      id: '123e4567-e89b-42d3-a456-426614174006',
      name: 'Black',
      priceMinor: 100_000,
    } as const;

    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [{ ...variant, attributes: { Condition: 'used' } }],
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [
          variant,
          {
            ...variant,
            attributes: { color: 'Black' },
            id: '123e4567-e89b-42d3-a456-426614174007',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('rejects duplicate canonical condition offers', () => {
    const offer = {
      available: true,
      condition: 'used',
      displayQuantityLimit: null,
      priceMinor: 90_000,
      status: 'active',
    } as const;

    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          { ...offer, id: '123e4567-e89b-42d3-a456-426614174008' },
          { ...offer, id: '123e4567-e89b-42d3-a456-426614174009' },
        ],
        hasConditionOffers: true,
      }).success
    ).toBe(false);
  });

  it('normalizes condition and selection-axis aliases before uniqueness checks', () => {
    const offer = {
      available: true,
      displayQuantityLimit: 1,
      priceMinor: 90_000,
      status: 'active',
    } as const;
    const variant = {
      available: true,
      condition: 'new',
      displayQuantityLimit: 1,
      name: '256 GB',
      priceMinor: 100_000,
    } as const;

    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          {
            ...offer,
            condition: 'open_box',
            id: '123e4567-e89b-42d3-a456-426614174010',
          },
          {
            ...offer,
            condition: 'refurbished',
            id: '123e4567-e89b-42d3-a456-426614174011',
          },
        ],
        hasConditionOffers: true,
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [
          {
            ...variant,
            attributes: { 'Storage Size': '256' },
            id: '123e4567-e89b-42d3-a456-426614174012',
          },
          {
            ...variant,
            attributes: { storage_size: '256' },
            id: '123e4567-e89b-42d3-a456-426614174013',
          },
        ],
      }).success
    ).toBe(false);
  });

  it('requires bounded variant display stock and release-safe descriptions', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        description: '<img src="https://cdn.example/image.png?token=secret">',
      }).success
    ).toBe(false);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        variants: [
          {
            available: true,
            displayQuantityLimit: 101,
            id: '123e4567-e89b-42d3-a456-426614174014',
            name: 'Black',
            priceMinor: 100_000,
          },
        ],
      }).success
    ).toBe(false);
  });

  it('preserves a bounded simple-product display cap', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        displayQuantityLimit: 100,
      }).success
    ).toBe(true);
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        displayQuantityLimit: 101,
      }).success
    ).toBe(false);
  });

  it('rejects products that mix condition offers with SKU variants', () => {
    expect(
      StorefrontPublicProductSchema.safeParse({
        ...product,
        conditionOffers: [
          {
            available: true,
            condition: 'used',
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174015',
            priceMinor: 90_000,
            status: 'active',
          },
        ],
        hasConditionOffers: true,
        variants: [
          {
            available: true,
            displayQuantityLimit: 1,
            id: '123e4567-e89b-42d3-a456-426614174016',
            name: 'Black',
            priceMinor: 100_000,
          },
        ],
      }).success
    ).toBe(false);
  });
});
