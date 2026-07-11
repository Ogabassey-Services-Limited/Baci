import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
  getStorefrontForwardedBotUserAgent,
  getStorefrontMetadataCacheBucket,
  NEXT_DOM_METADATA_BOT_USER_AGENT_PATTERN,
  STOREFRONT_BLOCKING_BOT_USER_AGENT_ANNOTATION,
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
    [
      'Mozilla/5.0 (compatible; SiteAuditBot/0.97; +http://www.semrush.com/bot.html)',
    ],
    [
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    ],
    ['SiteAuditBot-Mobile'],
    ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
    [
      'Mozilla/5.0 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/site-audit)',
    ],
    ['Screaming Frog SEO Spider/21.4'],
    ['rogerbot/1.2 (https://moz.com/help/moz-procedures/crawlers/rogerbot)'],
    [
      'Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)',
    ],
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
      `^(?:${STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.source})`,
      STOREFRONT_METADATA_BLOCKING_BOT_USER_AGENT_REGEX.flags
    );

    expect(vercelPprHeaderMatcher.test('Googlebot/2.1')).toBe(true);
    expect(
      vercelPprHeaderMatcher.test(
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
      )
    ).toBe(true);
    expect(
      vercelPprHeaderMatcher.test(
        'Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'
      )
    ).toBe(false);
  });
});

describe('getStorefrontForwardedBotUserAgent', () => {
  it.each([
    [
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)',
    ],
    [
      'Mozilla/5.0 (compatible; SiteAuditBot/0.97; +http://www.semrush.com/bot.html)',
    ],
    ['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
    ['GPTBot/1.1 (+https://openai.com/gptbot)'],
    ['ClaudeBot/1.0'],
    ['PerplexityBot/1.0 (+https://perplexity.ai/perplexitybot)'],
    ['Screaming Frog SEO Spider/21.4'],
  ])('annotates blocking-bucket bots Next does not recognize: %s', (userAgent) => {
    const forwarded = getStorefrontForwardedBotUserAgent(userAgent);

    expect(forwarded).toBe(
      `${userAgent}${STOREFRONT_BLOCKING_BOT_USER_AGENT_ANNOTATION}`
    );
    // The annotated UA must stay in the metadata-blocking bucket so the
    // proxy's cache partition key does not flip.
    expect(getStorefrontMetadataCacheBucket(forwarded)).toBe(
      'metadata-blocking'
    );
  });

  it.each([
    [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ],
    ['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
    ['Twitterbot/1.0'],
    ['Mozilla/5.0 AppleWebKit/537.36 Chrome/125.0 Safari/537.36'],
    [''],
  ])('passes through UAs Next already renders correctly (or humans): %s', (userAgent) => {
    expect(getStorefrontForwardedBotUserAgent(userAgent)).toBe(userAgent);
  });

  it('appends a token the installed Next runtime classifies as an HTML-limited bot', () => {
    const require = createRequire(import.meta.url);
    const { getBotType, isBot } =
      require('next/dist/shared/lib/router/utils/is-bot') as {
        getBotType: (userAgent: string) => 'dom' | 'html' | undefined;
        isBot: (userAgent: string) => boolean;
      };
    const semrushUserAgent =
      'Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)';

    // The regression this guards: Next 16.2.9's PPR postpone-vs-blocking
    // decision uses ONLY these hardcoded classifiers. Unannotated SemrushBot
    // is rendered as a human (postponed PPR shell → raw
    // application/x-nextjs-pre-render leaks to the crawler).
    expect(isBot(semrushUserAgent)).toBe(false);
    expect(
      getBotType(getStorefrontForwardedBotUserAgent(semrushUserAgent))
    ).toBe('html');
  });

  it('mirrors the installed Next runtime bot lists (fails on Next upgrades that change them)', () => {
    const require = createRequire(import.meta.url);
    const isBotSource = readFileSync(
      require.resolve('next/dist/esm/shared/lib/router/utils/is-bot.js'),
      'utf8'
    );
    const htmlBotsSource = readFileSync(
      require.resolve('next/dist/esm/shared/lib/router/utils/html-bots.js'),
      'utf8'
    );

    // If either assertion fails after a Next upgrade, re-derive the
    // NEXT_BUILTIN_* mirrors in storefront-metadata-cache-bots.ts from the new
    // dist sources and re-verify which bots need UA annotation.
    expect(isBotSource).toContain('/Googlebot(?!-)|Googlebot$/i');
    expect(htmlBotsSource).toContain(
      '[\\w-]+-Google|Google-[\\w-]+|Chrome-Lighthouse|Slurp|DuckDuckBot|baiduspider|yandex|sogou|bitlybot|tumblr|vkShare|quora link preview|redditbot|ia_archiver|Bingbot|BingPreview|applebot|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|Yeti|googleweblight'
    );
  });
});
