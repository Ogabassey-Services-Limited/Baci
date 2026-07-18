import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeChangedRuntimeContracts,
  changedPaths,
  verifyAnalyticsDeliveryAuthority,
} from './verify-analytics-delivery-authority';

describe('analytics delivery authority repository contract', () => {
  it('enforces changed runtime size and colocated tests', () => {
    const good = 'apps/web/src/lib/analytics/good.ts';
    const oversized = 'apps/web/src/lib/analytics/oversized-provider.ts';
    const sources = new Map([
      [good, 'export const good = true;'],
      ['apps/web/src/lib/analytics/good.test.ts', 'test();'],
      [oversized, `${'// line\n'.repeat(301)}export const send = true;`],
    ]);
    expect(analyzeChangedRuntimeContracts([good, oversized], sources)).toEqual([
      `${oversized}: changed runtime exceeds 300 lines`,
      `${oversized}: changed runtime is missing colocated test apps/web/src/lib/analytics/oversized-provider.test.ts`,
    ]);
  });

  it('counts an unterminated 301st runtime line', () => {
    const path = 'apps/web/src/lib/analytics/unterminated.ts';
    const sources = new Map([
      [path, Array.from({ length: 301 }, () => 'export {};').join('\n')],
      ['apps/web/src/lib/analytics/unterminated.test.ts', 'export {};'],
    ]);
    expect(analyzeChangedRuntimeContracts([path], sources)).toContain(
      `${path}: changed runtime exceeds 300 lines`
    );
  });

  it.each([
    'mts',
    'cts',
  ])('requires colocated tests for .%s runtime files', (extension) => {
    const path = `apps/web/src/lib/analytics/provider.${extension}`;
    expect(
      analyzeChangedRuntimeContracts(
        [path],
        new Map([[path, 'export const provider = true;']])
      )
    ).toEqual([
      `${path}: changed runtime is missing colocated test apps/web/src/lib/analytics/provider.test.${extension}`,
    ]);
  });

  it('fails closed when the PR merge base cannot be resolved', () => {
    expect(() =>
      changedPaths('/repo', (args) => {
        if (args[0] === 'merge-base') throw new Error('missing base');
        return '';
      })
    ).toThrow('missing base');
  });

  it('parses changed source paths with NUL delimiters', () => {
    const changed = 'apps/web/src/lib/events/line\nbreak.ts';
    expect(
      changedPaths('/repo', (args) => {
        if (args[0] === 'merge-base') return 'abc123\n';
        if (args[0] === 'diff' && args.includes('abc123...HEAD')) {
          expect(args).toContain('-z');
          return `${changed}\0`;
        }
        if (args[0] === 'diff') return 'apps/web/src/other.ts\0';
        if (args[0] === 'ls-files') return `${changed}\0`;
        return '';
      })
    ).toEqual([changed, 'apps/web/src/other.ts']);
  });

  it('passes the live repository authority contract', () => {
    expect(
      verifyAnalyticsDeliveryAuthority(resolve(process.cwd(), '../..'))
    ).toEqual([]);
  }, 120_000);
});
