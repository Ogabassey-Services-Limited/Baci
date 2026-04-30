import { describe, expect, it } from 'vitest';
import type { OpenAIFeedQueryParseResult } from './openai-feed-query';
import {
  isMissingMerchantIdentifierError,
  OPENAI_FEED_MERCHANT_IDENTIFIER_PATH,
  openAIFeedQuerySchema,
} from './openai-feed-query';

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
    const result = openAIFeedQuerySchema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);

      const [issue] = result.error.issues;

      expect(issue?.code).toBe('custom');
      expect(issue?.path).toEqual([OPENAI_FEED_MERCHANT_IDENTIFIER_PATH]);
      expect(isMissingMerchantIdentifierError(result)).toBe(true);
    }
  });

  it('rejects conflicting merchant identifiers', () => {
    const result = openAIFeedQuerySchema.safeParse({
      merchant_id: '00000000-0000-4000-8000-000000000001',
      merchant_slug: 'ogabassey',
    });

    expect(result.success).toBe(false);
    expect(isMissingMerchantIdentifierError(result)).toBe(false);
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

describe('isMissingMerchantIdentifierError', () => {
  it('returns false for successful parse results', () => {
    const result: OpenAIFeedQueryParseResult = openAIFeedQuerySchema.safeParse({
      merchant_slug: 'ogabassey',
    });

    expect(isMissingMerchantIdentifierError(result)).toBe(false);
  });

  it('returns true for the missing merchant identifier refinement', () => {
    const result: OpenAIFeedQueryParseResult = openAIFeedQuerySchema.safeParse(
      {}
    );

    expect(isMissingMerchantIdentifierError(result)).toBe(true);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0]?.code).toBe('custom');
      expect(result.error.issues[0]?.path).toEqual([
        OPENAI_FEED_MERCHANT_IDENTIFIER_PATH,
      ]);
    }
  });

  it('returns false for malformed merchant UUID failures', () => {
    const result: OpenAIFeedQueryParseResult = openAIFeedQuerySchema.safeParse({
      merchant_id: 'not-a-uuid',
    });

    expect(isMissingMerchantIdentifierError(result)).toBe(false);
  });

  it('returns false for conflicting merchant identifier failures', () => {
    const result: OpenAIFeedQueryParseResult = openAIFeedQuerySchema.safeParse({
      merchant_id: '00000000-0000-4000-8000-000000000001',
      merchant_slug: 'ogabassey',
    });

    expect(isMissingMerchantIdentifierError(result)).toBe(false);
  });
});
