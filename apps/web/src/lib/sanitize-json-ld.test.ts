import { describe, expect, it } from 'vitest';
import {
  safeJsonLdStringify,
  sanitizeSchemaMarkup,
  sanitizeSchemaUrl,
} from './sanitize-json-ld';

describe('sanitizeSchemaUrl', () => {
  it('returns sanitized URL for valid https URL', () => {
    const result = sanitizeSchemaUrl('https://example.com/product');
    expect(result).toBe('https://example.com/product');
  });

  it('escapes HTML characters in URLs', () => {
    const result = sanitizeSchemaUrl('https://example.com/a&b%3Cc');
    expect(result).toContain('\\u0026');
  });

  it('returns empty string for invalid URLs', () => {
    const result = sanitizeSchemaUrl('javascript:alert(1)');
    expect(result).toBe('');
  });
});

describe('sanitizeSchemaMarkup', () => {
  it('returns null/undefined unchanged', () => {
    expect(sanitizeSchemaMarkup(null)).toBeNull();
    expect(sanitizeSchemaMarkup(undefined)).toBeUndefined();
  });

  it('escapes HTML in strings', () => {
    expect(sanitizeSchemaMarkup('<script>alert(1)</script>')).toBe(
      '\\u003cscript\\u003ealert(1)\\u003c/script\\u003e'
    );
  });

  it('passes numbers through unchanged', () => {
    expect(sanitizeSchemaMarkup(42)).toBe(42);
  });

  it('passes booleans through unchanged', () => {
    expect(sanitizeSchemaMarkup(true)).toBe(true);
  });

  it('recursively sanitizes arrays', () => {
    const result = sanitizeSchemaMarkup(['<b>bold</b>', 'safe']);
    expect(result).toEqual(['\\u003cb\\u003ebold\\u003c/b\\u003e', 'safe']);
  });

  it('recursively sanitizes object values', () => {
    const result = sanitizeSchemaMarkup({
      name: '<img src=x onerror=alert(1)>',
      price: 100,
    });
    expect(result.name).toContain('\\u003cimg');
    expect(result.price).toBe(100);
  });

  it('handles nested objects', () => {
    const result = sanitizeSchemaMarkup({
      offer: { price: '<script>', currency: 'NGN' },
    });
    expect(result.offer.price).toBe('\\u003cscript\\u003e');
    expect(result.offer.currency).toBe('NGN');
  });
});

describe('safeJsonLdStringify', () => {
  it('returns valid JSON string with sanitized values', () => {
    const schema = {
      '@type': 'Product',
      name: 'Test <b>Product</b>',
      price: 5000,
    };
    const result = safeJsonLdStringify(schema);
    const parsed = JSON.parse(result);
    expect(parsed.name).toContain('\\u003cb\\u003e');
    expect(parsed.price).toBe(5000);
  });
});
