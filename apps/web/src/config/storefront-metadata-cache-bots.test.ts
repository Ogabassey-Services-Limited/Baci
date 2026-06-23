import { describe, expect, it } from 'vitest';
import {
  getStorefrontMetadataCacheBucket,
  NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN,
  STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX,
} from './storefront-metadata-cache-bots';

describe('storefront metadata cache bot classifier', () => {
  it.each([
    ['Googlebot/2.1'],
    [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ],
    ['Googlebot-Image/1.0'],
    ['AdsBot-Google (+http://www.google.com/adsbot.html)'],
    ['Google-InspectionTool/1.0'],
    ['GPTBot/1.1 (+https://openai.com/gptbot)'],
    ['ChatGPT-User/1.0 (+https://openai.com/bot)'],
    ['OAI-SearchBot/1.0 (+https://openai.com/searchbot)'],
    ['OAI-AdsBot/1.0 (+https://openai.com/adsbot)'],
    ['ClaudeBot/1.0'],
    ['Claude-User/1.0'],
    ['Claude-SearchBot/1.0'],
    ['PerplexityBot/1.0 (+https://perplexity.ai/perplexitybot)'],
    ['Perplexity-User/1.0 (+https://perplexity.ai/perplexity-user)'],
    [
      'Meta-ExternalAgent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    ],
    [
      'Meta-ExternalFetcher/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
    ],
    ['Bytespider'],
    ['CCBot/2.0'],
    ['Twitterbot/1.0'],
  ])('uses the metadata-blocking bucket for %s', (userAgent) => {
    expect(
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent)
    ).toBe(true);
    expect(getStorefrontMetadataCacheBucket(userAgent)).toBe(
      'metadata-blocking'
    );
  });

  it.each([
    ['Instagram 350.0.0.29.93 Android'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'],
  ])('keeps browser-like user agents in the streaming bucket for %s', (userAgent) => {
    expect(
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test(userAgent)
    ).toBe(false);
    expect(getStorefrontMetadataCacheBucket(userAgent)).toBe('streaming');
  });

  it('uses the streaming bucket when the user-agent header is missing', () => {
    expect(STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.test('')).toBe(
      false
    );
    expect(getStorefrontMetadataCacheBucket('')).toBe('streaming');
  });

  it('keeps the Googlebot branch compatible with Vercel PPR cache bypass matching', () => {
    expect(NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN).toBe('.*Googlebot');
    expect(NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN).not.toMatch(/\(\?[!=<]/);
  });

  it('matches the real Googlebot user-agent when serialized into Vercel PPR header bypass rules', () => {
    const vercelPprHeaderMatcher = new RegExp(
      `^(?:${STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.source})`
    );

    expect(vercelPprHeaderMatcher.test('Googlebot/2.1')).toBe(true);
    expect(
      vercelPprHeaderMatcher.test(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      )
    ).toBe(true);
  });
});
