import { describe, expect, it } from 'vitest';
import { createProductSchema, updateProductSchema } from '@/schemas/products';

const validCreateInput = {
  name: 'Test Product',
  price: 2500,
};

describe('product schemas', () => {
  it('rejects create payloads that omit required fields', () => {
    expect(() =>
      createProductSchema.parse({
        price: validCreateInput.price,
      })
    ).toThrow();

    expect(() =>
      createProductSchema.parse({
        name: validCreateInput.name,
      })
    ).toThrow();
  });

  it('rejects create payloads with invalid field types', () => {
    expect(() =>
      createProductSchema.parse({
        ...validCreateInput,
        name: 42,
      })
    ).toThrow();

    expect(() =>
      createProductSchema.parse({
        ...validCreateInput,
        price: '2500',
      })
    ).toThrow();
  });

  it('accepts create payloads that omit fulfillment details', () => {
    const result = createProductSchema.parse(validCreateInput);

    expect(result.fulfillment_details).toBeUndefined();
  });

  it('ignores legacy array fulfillment details on create payloads', () => {
    const result = createProductSchema.parse({
      ...validCreateInput,
      fulfillment_details: [
        { key: 'S/N', value: 'SERIAL-001' },
        { key: 'S/N', value: 'SERIAL-002' },
      ],
    });

    expect(result.fulfillment_details).toBeUndefined();
  });

  it('ignores null image placeholders from the dashboard form', () => {
    const result = createProductSchema.parse({
      ...validCreateInput,
      image: null,
      imageLarge: null,
      fulfillment_details: [],
    });

    expect(result.image).toBeNull();
    expect(result.imageLarge).toBeNull();
    expect(result.fulfillment_details).toBeUndefined();
  });

  it('preserves object fulfillment details on create payloads', () => {
    const result = createProductSchema.parse({
      ...validCreateInput,
      fulfillment_details: {
        type: 'pickup',
        handling_time: 2,
        free_shipping: false,
      },
    });

    expect(result.fulfillment_details).toEqual({
      type: 'pickup',
      handling_time: 2,
      free_shipping: false,
    });
  });

  it('ignores legacy array fulfillment details on update payloads', () => {
    const result = updateProductSchema.parse({
      fulfillment_details: [{ key: 'S/N', value: 'SERIAL-001' }],
    });

    expect(result.fulfillment_details).toBeUndefined();
  });

  it('preserves object fulfillment details on update payloads', () => {
    const result = updateProductSchema.parse({
      fulfillment_details: {
        type: 'pickup',
        handling_time: 2,
        free_shipping: false,
      },
    });

    expect(result.fulfillment_details).toEqual({
      type: 'pickup',
      handling_time: 2,
      free_shipping: false,
    });
  });

  it('preserves null image placeholders on update payloads so callers can clear images', () => {
    const result = updateProductSchema.parse({
      image: null,
      imageLarge: null,
    });

    expect(result.image).toBeNull();
    expect(result.imageLarge).toBeNull();
  });

  it('rejects update payloads with invalid field types', () => {
    expect(() =>
      updateProductSchema.parse({
        name: 42,
      })
    ).toThrow();

    expect(() =>
      updateProductSchema.parse({
        price: '2500',
      })
    ).toThrow();
  });

  it('strips unsafe URL protocols from image fields on update', () => {
    expect(() =>
      updateProductSchema.parse({
        image: 'javascript:alert(1)',
      })
    ).not.toThrow();

    expect(
      updateProductSchema.parse({
        image: 'javascript:alert(1)',
      }).image
    ).toBeNull();
  });
});
