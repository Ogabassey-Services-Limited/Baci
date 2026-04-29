import { describe, expect, it } from 'vitest';
import { openAIFeedQuerySchema } from './openai-feed-query';

describe('openAIFeedQuerySchema', () => {
  it.each([
    'jsonl',
    'plain',
    'current',
  ] as const)('accepts merchant slug requests with %s format', (format) => {
    const result = openAIFeedQuerySchema.safeParse({
      merchant_slug: 'ogabassey',
      format,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.merchant_slug).toBe('ogabassey');
      expect(result.data.format).toBe(format);
    }
  });

  it('accepts merchant UUID requests', () => {
    const result = openAIFeedQuerySchema.safeParse({
      merchant_id: '00000000-0000-4000-8000-000000000001',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.merchant_id).toBe(
        '00000000-0000-4000-8000-000000000001'
      );
      expect(result.data.format).toBeUndefined();
    }
  });

  it('accepts merchant UUID requests with a supported format', () => {
    const result = openAIFeedQuerySchema.safeParse({
      merchant_id: '00000000-0000-4000-8000-000000000001',
      format: 'jsonl',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.merchant_id).toBe(
        '00000000-0000-4000-8000-000000000001'
      );
      expect(result.data.format).toBe('jsonl');
    }
  });

  it('rejects missing merchant identifiers', () => {
    expect(openAIFeedQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects conflicting merchant identifiers', () => {
    expect(
      openAIFeedQuerySchema.safeParse({
        merchant_id: '00000000-0000-4000-8000-000000000001',
        merchant_slug: 'ogabassey',
      }).success
    ).toBe(false);
  });

  it('rejects malformed merchant UUIDs', () => {
    expect(
      openAIFeedQuerySchema.safeParse({
        merchant_id: 'not-a-uuid',
      }).success
    ).toBe(false);
  });

  it('rejects empty merchant slugs', () => {
    expect(
      openAIFeedQuerySchema.safeParse({
        merchant_slug: '',
      }).success
    ).toBe(false);
  });

  it('rejects unsupported feed formats', () => {
    expect(
      openAIFeedQuerySchema.safeParse({
        merchant_slug: 'ogabassey',
        format: 'xml',
      }).success
    ).toBe(false);
  });

  it('rejects non-string identifiers', () => {
    expect(
      openAIFeedQuerySchema.safeParse({
        merchant_slug: null,
      }).success
    ).toBe(false);
  });
});
