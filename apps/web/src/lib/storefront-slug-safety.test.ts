import { describe, expect, it } from 'vitest';
import {
  evaluateStorefrontSlugSafety,
  MAX_SAFE_STOREFRONT_SLUG_DECODED_LENGTH,
  MAX_SAFE_STOREFRONT_SLUG_ENCODED_LENGTH,
} from '@/lib/storefront-slug-safety';

describe('evaluateStorefrontSlugSafety', () => {
  it('accepts a normal product slug', () => {
    expect(evaluateStorefrontSlugSafety('samsung-s10-8gb-128gb')).toEqual({
      safe: true,
    });
  });

  it('accepts an already-decoded unicode slug', () => {
    // Proxy/App Router hand the route value over decoded (`dell-%E2%80%93-xps`
    // arrives as an en-dash).
    expect(evaluateStorefrontSlugSafety('dell-–-xps')).toEqual({
      safe: true,
    });
  });

  it('accepts a singly percent-encoded slug without rewriting it', () => {
    expect(evaluateStorefrontSlugSafety('dell-%E2%80%93-xps')).toEqual({
      safe: true,
    });
  });

  it('accepts a slug at exactly the decoded length bound', () => {
    const slug = 'a'.repeat(MAX_SAFE_STOREFRONT_SLUG_DECODED_LENGTH);

    expect(evaluateStorefrontSlugSafety(slug)).toEqual({ safe: true });
  });

  it('rejects a slug one char over the decoded length bound', () => {
    const slug = 'a'.repeat(MAX_SAFE_STOREFRONT_SLUG_DECODED_LENGTH + 1);

    expect(evaluateStorefrontSlugSafety(slug)).toEqual({
      safe: false,
      reason: 'decoded-too-long',
    });
  });

  it('rejects raw input over the encoded length bound before decoding', () => {
    const slug = `%25${'a'.repeat(MAX_SAFE_STOREFRONT_SLUG_ENCODED_LENGTH)}`;

    expect(evaluateStorefrontSlugSafety(slug)).toEqual({
      safe: false,
      reason: 'too-long',
    });
  });

  it('rejects empty, null, and undefined values', () => {
    expect(evaluateStorefrontSlugSafety('')).toEqual({
      safe: false,
      reason: 'empty',
    });
    expect(evaluateStorefrontSlugSafety(null)).toEqual({
      safe: false,
      reason: 'empty',
    });
    expect(evaluateStorefrontSlugSafety(undefined)).toEqual({
      safe: false,
      reason: 'empty',
    });
  });

  it('rejects the repeatedly percent-encoded bot signature', () => {
    // `%25` nested many times, like the production
    // `samsung-s10%252525252525…%25252b-8gb-128gb` crawler URLs.
    let slug = 'samsung-s10 8gb-128gb';
    for (let i = 0; i < 12; i++) {
      slug = encodeURIComponent(slug);
    }

    expect(evaluateStorefrontSlugSafety(slug)).toEqual({
      safe: false,
      reason: 'over-encoded',
    });
  });

  it('accepts up to triple-encoded values that fully decode in budget', () => {
    const tripleEncoded = encodeURIComponent(
      encodeURIComponent(encodeURIComponent('my slug'))
    );

    expect(evaluateStorefrontSlugSafety(tripleEncoded)).toEqual({
      safe: true,
    });
  });

  it('rejects quadruple-encoded values that still decode after budget', () => {
    const quadEncoded = encodeURIComponent(
      encodeURIComponent(encodeURIComponent(encodeURIComponent('my slug')))
    );

    expect(evaluateStorefrontSlugSafety(quadEncoded)).toEqual({
      safe: false,
      reason: 'over-encoded',
    });
  });

  it('never throws on malformed percent-encoding and keeps short values safe', () => {
    // decodeURIComponent throws on all of these; the gate must not.
    expect(evaluateStorefrontSlugSafety('a%2')).toEqual({ safe: true });
    expect(evaluateStorefrontSlugSafety('a%zz-b')).toEqual({ safe: true });
    expect(evaluateStorefrontSlugSafety('100%')).toEqual({ safe: true });
    expect(evaluateStorefrontSlugSafety('a%20b%')).toEqual({ safe: true });
  });

  it('rejects encoded values that are over-long once decoded', () => {
    // 500 raw chars (under the encoded bound) that decode to 300 chars.
    const slug = `${'%20'.repeat(100)}${'b'.repeat(200)}`;

    expect(evaluateStorefrontSlugSafety(slug)).toEqual({
      safe: false,
      reason: 'decoded-too-long',
    });
  });

  it('is deterministic for repeated calls with the same input', () => {
    const slug = `%2525${'x'.repeat(40)}`;

    const first = evaluateStorefrontSlugSafety(slug);
    const second = evaluateStorefrontSlugSafety(slug);

    expect(second).toEqual(first);
  });
});
