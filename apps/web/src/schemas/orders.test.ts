import { describe, expect, it } from 'vitest';
import { orderCreateSchema } from './orders';

const validOrder = {
  merchant_id: '123e4567-e89b-12d3-a456-426614174000',
  customer_email: 'test@example.com',
  customer_name: 'John Doe',
  customer_phone: '+234 800 123 4567',
  items: [
    {
      name: 'Test Product',
      quantity: 1,
      price: 1000,
      productId: 'prod-1',
    },
  ],
  subtotal: 1000,
  payment_method: 'card',
};

describe('orderCreateSchema', () => {
  it('accepts valid input', () => {
    const result = orderCreateSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
  });

  it('sanitizes XSS from customer_name', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      customer_name: '<script></script>jOhN dOE',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_name).not.toContain('<script>');
      expect(result.data.customer_name).toBe('John Doe');
    }
  });

  it('sanitizes XSS from item names', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          name: '<img src=x onerror=alert(1)>Product',
          quantity: 1,
          price: 100,
          productId: 'prod-1',
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].name).not.toContain('<img');
    }
  });

  it('sanitizes email to lowercase', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      customer_email: 'Test@Example.COM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_email).toBe('test@example.com');
    }
  });

  it('strips script tags from notes', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      notes: 'Please deliver <script>alert(1)</script> quickly',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).not.toContain('<script>');
      expect(result.data.notes).toContain('quickly');
    }
  });

  it('preserves valid phone numbers', () => {
    const result = orderCreateSchema.safeParse(validOrder);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customer_phone).toBe('+234 800 123 4567');
    }
  });

  it('rejects missing merchant_id', () => {
    const { merchant_id: _, ...noMerchant } = validOrder;
    const result = orderCreateSchema.safeParse(noMerchant);
    expect(result.success).toBe(false);
  });

  it('rejects empty items array', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it('maps shipping_quote_id into selected_quote_id', () => {
    const quoteId = '123e4567-e89b-12d3-a456-426614174111';
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      shipping_quote_id: quoteId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selected_quote_id).toBe(quoteId);
    }
  });

  it('prefers selected_quote_id when both quote fields are present', () => {
    const selectedQuoteId = '123e4567-e89b-12d3-a456-426614174112';
    const legacyQuoteId = '123e4567-e89b-12d3-a456-426614174113';
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      selected_quote_id: selectedQuoteId,
      shipping_quote_id: legacyQuoteId,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.selected_quote_id).toBe(selectedQuoteId);
    }
  });

  it('normalizes item condition values', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          condition: 'Open Box',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].condition).toBe('open_box');
    }
  });
});
