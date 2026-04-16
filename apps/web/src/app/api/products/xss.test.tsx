/**
 * XSS Prevention Test Suite for Product API
 *
 * Tests that malicious payloads are properly sanitized before storage.
 * Uses Vitest with proper mock cleanup following 2026 best practices.
 *
 * @see https://vitest.dev/guide/mocking.html
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  createProductSchema,
  formatZodErrors,
  updateProductSchema,
} from '@/schemas/products';

// Mock fetch for embedding generation using vi.stubGlobal (2026 best practice)
const fetchMock = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.stubGlobal('fetch', fetchMock);

// Cleanup all stubs after all tests complete
afterAll(() => {
  vi.unstubAllGlobals();
});

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('Product API XSS Prevention', () => {
  describe('createProductSchema sanitization', () => {
    it('should strip HTML tags from product name', () => {
      const maliciousPayload = {
        name: '<script>alert("xss")</script>iPhone 15 Pro',
        price: 999.99,
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // sanitizeText strips HTML tags but preserves text content
        expect(result.data.name).not.toContain('<script>');
        expect(result.data.name).not.toContain('</script>');
        expect(result.data.name).toContain('iPhone 15 Pro');
      }
    });

    it('should strip HTML tags from product description', () => {
      const maliciousPayload = {
        name: 'Safe Product Name',
        description:
          '<img src=x onerror=alert("xss")>Product description<script>document.cookie</script>',
        price: 49.99,
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).not.toContain('<img');
        expect(result.data.description).not.toContain('onerror');
        expect(result.data.description).not.toContain('<script>');
        expect(result.data.description).toContain('Product description');
      }
    });

    it('should strip HTML tags from category field', () => {
      const maliciousPayload = {
        name: 'Test Product',
        price: 10,
        category: '<div onmouseover="alert(1)">Electronics</div>',
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.category).toBe('Electronics');
        expect(result.data.category).not.toContain('<div');
        expect(result.data.category).not.toContain('onmouseover');
      }
    });

    it('should strip HTML tags from brand field', () => {
      const maliciousPayload = {
        name: 'Test Product',
        price: 10,
        brand: '<a href="javascript:alert(1)">Apple</a>',
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.brand).toBe('Apple');
        expect(result.data.brand).not.toContain('<a');
        expect(result.data.brand).not.toContain('javascript:');
      }
    });

    it('should strip HTML tags from condition_detail field', () => {
      const maliciousPayload = {
        name: 'Test Product',
        price: 10,
        condition: 'used' as const,
        condition_detail: '<style>body{display:none}</style>Minor scratches',
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // sanitizeText strips HTML tags but preserves text content
        expect(result.data.condition_detail).not.toContain('<style>');
        expect(result.data.condition_detail).not.toContain('</style>');
        expect(result.data.condition_detail).toContain('Minor scratches');
      }
    });

    it('should reject invalid URLs in images', () => {
      const maliciousPayload = {
        name: 'Test Product',
        price: 10,
        images: [{ url: 'javascript:alert(1)' }],
      };

      const result = createProductSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // Invalid URLs are sanitized to empty string
        expect(result.data.images?.[0]?.url).toBe('');
      }
    });

    it('should reject negative price values', () => {
      const payload = {
        name: 'Test Product',
        price: -100,
      };

      const result = createProductSchema.safeParse(payload);
      // Zod rejects negative prices with min(0) validation
      expect(result.success).toBe(false);
    });

    it('should reject names exceeding max length', () => {
      const longName = 'A'.repeat(300);
      const payload = {
        name: longName,
        price: 10,
      };

      const result = createProductSchema.safeParse(payload);
      // Zod rejects names > 200 characters
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidPayload = {
        description: 'Just a description',
      };

      const result = createProductSchema.safeParse(invalidPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        expect(errors.name).toBeDefined();
        expect(errors.price).toBeDefined();
      }
    });

    it('rejects sku_matrix variants without conditions', () => {
      const payload = {
        name: 'Variant Product',
        price: 1000,
        has_variants: true,
        variant_model: 'sku_matrix' as const,
        variants: [
          {
            price_override: 900,
            stock_quantity: 2,
          },
        ],
      };

      const result = createProductSchema.safeParse(payload);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        expect(errors.variants).toContain(
          'sku_matrix products require every variant to include a condition.'
        );
      }
    });
  });

  describe('updateProductSchema sanitization', () => {
    it('should allow partial updates without requiring all fields', () => {
      const partialUpdate = {
        name: 'Updated Name Only',
      };

      const result = updateProductSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('Updated Name Only');
        expect(result.data.price).toBeUndefined();
        expect(result.data.description).toBeUndefined();
      }
    });

    it('should sanitize all provided fields in partial update', () => {
      const maliciousUpdate = {
        name: '<script>alert("xss")</script>New Name',
        description: '<img onerror=alert(1)>New Description',
      };

      const result = updateProductSchema.safeParse(maliciousUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        // sanitizeText strips HTML tags but preserves text content
        expect(result.data.name).not.toContain('<script>');
        expect(result.data.name).toContain('New Name');
        expect(result.data.description).not.toContain('<img');
        expect(result.data.description).not.toContain('onerror');
        expect(result.data.description).toContain('New Description');
      }
    });

    it('should handle null values for nullable fields', () => {
      const updateWithNull = {
        description: null,
        compare_at_price: null,
      };

      const result = updateProductSchema.safeParse(updateWithNull);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeNull();
        expect(result.data.compare_at_price).toBeNull();
      }
    });

    it('should not include undefined fields in parsed output', () => {
      const partialUpdate = {
        price: 29.99,
      };

      const result = updateProductSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
      if (result.success) {
        // Only price should be defined
        expect(result.data.price).toBe(29.99);
        // Other fields should not exist in the result
        expect('name' in result.data).toBe(false);
      }
    });

    it('rejects sku_matrix updates with conditionless variants', () => {
      const update = {
        variant_model: 'sku_matrix' as const,
        variants: [
          {
            id: '4d3558bf-3013-476d-8efa-162d85b8f3fd',
            price_override: 800,
            stock_quantity: 1,
          },
        ],
      };

      const result = updateProductSchema.safeParse(update);

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = formatZodErrors(result.error);
        expect(errors.variants).toContain(
          'sku_matrix products require every variant to include a condition.'
        );
      }
    });
  });

  describe('Edge cases and attack vectors', () => {
    it('should handle nested HTML injection attempts', () => {
      const nestedPayload = {
        name: '<scr<script>ipt>alert(1)</scr</script>ipt>Clean Text',
        price: 10,
      };

      const result = createProductSchema.safeParse(nestedPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain('script');
        expect(result.data.name).toContain('Clean Text');
      }
    });

    it('should handle unicode-encoded XSS attempts', () => {
      const unicodePayload = {
        name: '\u003cscript\u003ealert(1)\u003c/script\u003eProduct',
        price: 10,
      };

      const result = createProductSchema.safeParse(unicodePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain('script');
      }
    });

    it('should handle null byte injection attempts', () => {
      const nullBytePayload = {
        name: 'Product\x00<script>alert(1)</script>',
        price: 10,
      };

      const result = createProductSchema.safeParse(nullBytePayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain('\x00');
        expect(result.data.name).not.toContain('script');
      }
    });

    it('should handle SVG-based XSS attempts', () => {
      const svgPayload = {
        name: '<svg onload=alert(1)>Product Name',
        price: 10,
      };

      const result = createProductSchema.safeParse(svgPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).not.toContain('<svg');
        expect(result.data.name).not.toContain('onload');
        expect(result.data.name).toContain('Product Name');
      }
    });

    it('should handle data URI injection in images', () => {
      const dataUriPayload = {
        name: 'Test Product',
        price: 10,
        images: [{ url: 'data:text/html,<script>alert(1)</script>' }],
      };

      const result = createProductSchema.safeParse(dataUriPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // Data URIs should be rejected (not http/https)
        expect(result.data.images?.[0]?.url).toBe('');
      }
    });
  });
});
