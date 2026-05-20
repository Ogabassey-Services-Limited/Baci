import { describe, expect, it } from 'vitest';
import {
  crawlerLogPostSchema,
  crawlerLogQuerySchema,
} from '@/schemas/crawler-observability';

describe('crawler observability schemas', () => {
  it('accepts a complete crawler event', () => {
    const parsed = crawlerLogPostSchema.parse({
      cacheOutcome: 'miss',
      host: 'Ogabassey.com',
      responseTimeMs: '42',
      statusCode: '200',
      urlPath: '/agent-commerce.json',
      userAgent: 'GPTBot/1.0',
    });

    expect(parsed.cacheOutcome).toBe('miss');
    expect(parsed.responseTimeMs).toBe(42);
    expect(parsed.statusCode).toBe(200);
  });

  it('defaults optional status and cache fields', () => {
    const parsed = crawlerLogPostSchema.parse({
      botName: 'Googlebot',
      urlPath: '/feeds/openai.jsonl',
    });

    expect(parsed.cacheOutcome).toBe('unknown');
    expect(parsed.statusCode).toBe(200);
  });

  it('requires either a bot name or user agent', () => {
    const parsed = crawlerLogPostSchema.safeParse({
      urlPath: '/agent-trust.json',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      'botName or userAgent is required'
    );
  });

  it('rejects invalid status and cache values', () => {
    expect(
      crawlerLogPostSchema.safeParse({
        cacheOutcome: 'warm',
        statusCode: 99,
        urlPath: '/agent-commerce.json',
        userAgent: 'GPTBot/1.0',
      }).success
    ).toBe(false);
  });

  it('bounds analytics query windows', () => {
    expect(crawlerLogQuerySchema.parse({}).days).toBe(7);
    expect(crawlerLogQuerySchema.safeParse({ days: 91 }).success).toBe(false);
    expect(crawlerLogQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });
});
