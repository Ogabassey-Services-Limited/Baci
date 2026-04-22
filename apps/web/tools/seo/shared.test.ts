import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { seoShared } from './shared';

describe('seo monitoring shared helpers', () => {
  afterEach(() => {
    delete process.env.GITHUB_STEP_SUMMARY;
  });

  it('normalizes origins by trimming paths and trailing slashes', () => {
    expect(seoShared.normalizeOrigin(' https://usebaci.com/pricing ')).toBe(
      'https://usebaci.com'
    );
  });

  it('normalizes origins with trailing slashes and preserves ports', () => {
    expect(seoShared.normalizeOrigin('https://usebaci.com/')).toBe(
      'https://usebaci.com'
    );
    expect(seoShared.normalizeOrigin('https://usebaci.com:8080/path')).toBe(
      'https://usebaci.com:8080'
    );
  });

  it('throws for empty origin input', () => {
    expect(() => seoShared.normalizeOrigin('   ')).toThrow();
  });

  it('parses comma-separated origins and removes duplicates', () => {
    expect(
      seoShared.parseCsvOrigins(
        'https://ogabassey.com, https://shop.ogabassey.com/path, https://ogabassey.com'
      )
    ).toEqual(['https://ogabassey.com', 'https://shop.ogabassey.com']);
  });

  it('skips invalid origins instead of throwing', () => {
    expect(
      seoShared.parseCsvOrigins(
        'https://ogabassey.com, notaurl, https://usebaci.com'
      )
    ).toEqual(['https://ogabassey.com', 'https://usebaci.com']);
  });

  it('partitions csv origins into valid and invalid entries', () => {
    expect(
      seoShared.partitionCsvOrigins(
        'https://ogabassey.com, notaurl, https://usebaci.com'
      )
    ).toEqual({
      invalidOrigins: ['notaurl'],
      validOrigins: ['https://ogabassey.com', 'https://usebaci.com'],
    });
  });

  it('parses comma-separated absolute urls and preserves query strings', () => {
    expect(
      seoShared.parseCsvUrls(
        'https://usebaci.com/pricing, https://ogabassey.com/blog?utm_source=test'
      )
    ).toEqual([
      'https://usebaci.com/pricing',
      'https://ogabassey.com/blog?utm_source=test',
    ]);
  });

  it('skips invalid urls instead of throwing', () => {
    expect(
      seoShared.parseCsvUrls('not-a-url, https://usebaci.com/pricing')
    ).toEqual(['https://usebaci.com/pricing']);
  });

  it('parses toggle env strings with a default fallback', () => {
    expect(seoShared.parseToggle(undefined, true)).toBe(true);
    expect(seoShared.parseToggle('false', true)).toBe(false);
    expect(seoShared.parseToggle('0', true)).toBe(false);
    expect(seoShared.parseToggle('yes', false)).toBe(true);
  });

  it('resolves urls against normalized origins', () => {
    expect(seoShared.resolveUrl('https://usebaci.com/pricing', '/blog')).toBe(
      'https://usebaci.com/blog'
    );
    expect(seoShared.resolveUrl('https://usebaci.com', 'faq')).toBe(
      'https://usebaci.com/faq'
    );
    expect(
      seoShared.resolveUrl('https://usebaci.com/store/', '../blog?tag=seo')
    ).toBe('https://usebaci.com/blog?tag=seo');
  });

  it('appends markdown to the GitHub step summary file when configured', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'baci-seo-summary-'));
    const summaryPath = join(dir, 'summary.md');
    try {
      process.env.GITHUB_STEP_SUMMARY = summaryPath;
      await seoShared.appendGitHubStepSummary('## Summary');
      expect(await readFile(summaryPath, 'utf8')).toBe('## Summary\n');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('no-ops when GitHub step summary is not configured', async () => {
    await expect(
      seoShared.appendGitHubStepSummary('## Summary')
    ).resolves.toBeUndefined();
  });
});
