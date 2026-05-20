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

  it('accepts null image_url / imageUrl on items (clients may serialize optional URLs as null)', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          image_url: null,
          imageUrl: null,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].image_url).toBeUndefined();
      expect(result.data.items[0].imageUrl).toBeUndefined();
    }
  });

  it('accepts a valid http image_url on items', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          image_url: 'https://cdn.example.com/p.jpg',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].image_url).toBe(
        'https://cdn.example.com/p.jpg'
      );
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

  it('normalizes blank and sanitized-empty voucher tokens to undefined', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: '   ',
          voucher_token: '   ',
        },
        {
          ...validOrder.items[0],
          productId: 'prod-2',
          voucherAwardId: '<script></script>',
          voucher_token: '<script></script>',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].voucher_award_id).toBeUndefined();
      expect(result.data.items[0].voucher_token).toBeUndefined();
      expect(result.data.items[1].voucherAwardId).toBeUndefined();
      expect(result.data.items[1].voucher_token).toBeUndefined();
    }
  });

  it('trims and sanitizes voucher tokens', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: '  <strong>quiz-award</strong>  ',
          voucher_token: '  <strong>quiz-token</strong>  ',
        },
        {
          ...validOrder.items[0],
          productId: 'prod-2',
          voucherAwardId: '  <strong>camel-award</strong>  ',
          voucherToken: '  <strong>camel-token</strong>  ',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].voucher_award_id).toBe('quiz-award');
      expect(result.data.items[0].voucher_token).toBe('quiz-token');
      expect(result.data.items[1].voucherAwardId).toBe('camel-award');
      expect(result.data.items[1].voucherToken).toBe('camel-token');
    }
  });

  it('rejects mismatched voucher token aliases', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_token: 'quiz-token',
          voucherToken: 'other-token',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('rejects mismatched voucher award ID aliases', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: 'quiz-award',
          voucherAwardId: 'other-award',
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts matching voucher token aliases', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: '  quiz-award  ',
          voucherAwardId: '<strong>quiz-award</strong>',
          voucher_token: '  quiz-token  ',
          voucherToken: '<strong>quiz-token</strong>',
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].voucher_award_id).toBe('quiz-award');
      expect(result.data.items[0].voucherAwardId).toBe('quiz-award');
      expect(result.data.items[0].voucher_token).toBe('quiz-token');
      expect(result.data.items[0].voucherToken).toBe('quiz-token');
    }
  });

  it('rejects voucher tokens longer than 128 sanitized characters', () => {
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: 'x'.repeat(129),
          voucher_token: 'x'.repeat(129),
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('accepts voucher tokens exactly 128 sanitized characters long', () => {
    const voucherToken = 'x'.repeat(128);
    const result = orderCreateSchema.safeParse({
      ...validOrder,
      items: [
        {
          ...validOrder.items[0],
          voucher_award_id: voucherToken,
          voucher_token: voucherToken,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0].voucher_award_id).toBe(voucherToken);
      expect(result.data.items[0].voucher_token).toBe(voucherToken);
    }
  });

  describe('B3.5 — VAT / total parity fields', () => {
    it("defaults tax_basis to 'exclusive' when omitted", () => {
      const result = orderCreateSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tax_basis).toBe('exclusive');
      }
    });

    it("accepts tax_basis: 'inclusive'", () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        tax_basis: 'inclusive',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tax_basis).toBe('inclusive');
      }
    });

    it("rejects tax_basis outside the 'exclusive'/'inclusive' enum", () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        tax_basis: 'mixed',
      });
      expect(result.success).toBe(false);
    });

    it('defaults gift_wrapping_fee to 0 when omitted', () => {
      const result = orderCreateSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gift_wrapping_fee).toBe(0);
      }
    });

    it('rejects negative gift_wrapping_fee', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        gift_wrapping_fee: -1,
      });
      expect(result.success).toBe(false);
    });

    it('coerces gift_wrapping_fee from numeric string', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        gift_wrapping_fee: '500',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gift_wrapping_fee).toBe(500);
      }
    });

    it('accepts expected_total and client_total as optional numerics', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        expected_total: 1100,
        client_total: 1100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expected_total).toBe(1100);
        expect(result.data.client_total).toBe(1100);
      }
    });

    it('rejects negative expected_total', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        expected_total: -50,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative client_total', () => {
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        client_total: -50,
      });
      expect(result.success).toBe(false);
    });

    it('treats expected_total / client_total as undefined when absent', () => {
      const result = orderCreateSchema.safeParse(validOrder);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expected_total).toBeUndefined();
        expect(result.data.client_total).toBeUndefined();
      }
    });

    it('preserves null on expected_total / client_total instead of coercing to 0', () => {
      // Codex P1 (PR #1622): pre-fix the schema used `z.coerce.number()`
      // which calls `Number(null) === 0`. A client sending
      // `expected_total: null` would silently become `0` and the RPC's
      // parity check (subtotal + shipping + gift + tax - discount vs
      // 0) would always RAISE `order_total_mismatch` 400.
      const result = orderCreateSchema.safeParse({
        ...validOrder,
        expected_total: null,
        client_total: null,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expected_total).toBeNull();
        expect(result.data.client_total).toBeNull();
      }
    });
  });
});
