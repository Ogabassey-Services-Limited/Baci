import { describe, expect, it } from 'vitest';
import { pageSpeedShared } from './run-pagespeed.shared';

describe('run-pagespeed shared helpers', () => {
  it('builds platform targets and appends extra absolute urls', () => {
    expect(
      pageSpeedShared.buildPageSpeedTargets({
        baseUrl: 'https://usebaci.com',
        extraUrls: ['https://ogabassey.com'],
      })
    ).toEqual([
      { label: 'home', url: 'https://usebaci.com/' },
      { label: 'pricing', url: 'https://usebaci.com/pricing' },
      { label: 'features', url: 'https://usebaci.com/features' },
      { label: 'blog', url: 'https://usebaci.com/blog' },
      { label: 'contact', url: 'https://usebaci.com/contact' },
      { label: 'extra-1', url: 'https://ogabassey.com/' },
    ]);
  });

  it('throws for invalid extra target urls instead of silently skipping them', () => {
    expect(() =>
      pageSpeedShared.buildPageSpeedTargets({
        baseUrl: 'https://usebaci.com',
        extraUrls: ['notaurl'],
      })
    ).toThrow('Invalid PageSpeed target URL "notaurl"');
  });

  it('parses strategies and falls back to mobile when input is empty', () => {
    expect(pageSpeedShared.parseStrategies('mobile,desktop')).toEqual([
      'mobile',
      'desktop',
    ]);
    expect(pageSpeedShared.parseStrategies()).toEqual(['mobile']);
    expect(pageSpeedShared.parseStrategies(' , ')).toEqual(['mobile']);
  });

  it('throws for invalid PageSpeed strategies', () => {
    expect(() => pageSpeedShared.parseStrategies('tablet,mobile')).toThrow(
      'Invalid PageSpeed strategies: tablet. Allowed values: mobile, desktop'
    );
  });

  it('builds the PSI API url with repeated categories', () => {
    const url = new URL(
      pageSpeedShared.buildPsiUrl({
        apiKey: 'secret',
        strategy: 'mobile',
        targetUrl: 'https://usebaci.com/pricing',
      })
    );

    expect(url.origin).toBe('https://www.googleapis.com');
    expect(url.searchParams.get('url')).toBe('https://usebaci.com/pricing');
    expect(url.searchParams.get('strategy')).toBe('mobile');
    expect(url.searchParams.get('key')).toBe('secret');
    expect(url.searchParams.getAll('category')).toEqual([
      'performance',
      'accessibility',
      'best-practices',
      'seo',
    ]);
  });

  it('renders request failures with their message in the summary', () => {
    expect(
      pageSpeedShared.buildPageSpeedSummary([
        {
          label: 'home',
          url: 'https://usebaci.com/',
          strategy: 'mobile',
          passed: false,
          failures: [
            {
              metric: 'request',
              actual: null,
              threshold: 0,
              message: 'timed out',
            },
          ],
          scores: {},
          vitals: {},
        },
      ])
    ).toContain('request: timed out');
  });
});
