import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runOgabasseyCrawlDepthModuleVerifierCli } from './verify-ogabassey-crawl-depth-modules';

describe('runOgabasseyCrawlDepthModuleVerifierCli', () => {
  it('prints coverage proof lines from a Semrush CSV and href fixture', () => {
    const directory = mkdtempSync(join(tmpdir(), 'crawl-depth-'));
    const csvPath = join(directory, 'semrush.csv');
    const hrefPath = join(directory, 'hrefs.json');
    const messages: string[] = [];

    try {
      writeFileSync(
        csvPath,
        [
          'Page URL,Crawl Depth',
          'https://ogabassey.com/smartphones/compare/iphone-12-vs-xiaomi-13t,4',
          'https://ogabassey.com/products/demo,6',
        ].join('\n')
      );
      writeFileSync(
        hrefPath,
        JSON.stringify([
          '/smartphones/compare/iphone-12-vs-xiaomi-13t',
        ])
      );

      expect(
        runOgabasseyCrawlDepthModuleVerifierCli(
          [csvPath, hrefPath],
          (message) => messages.push(message)
        )
      ).toBe(0);
      expect(messages.join('\n')).toContain('covered_maintained_rows 1');
      expect(messages.join('\n')).toContain('cleanup_rows 1');
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
