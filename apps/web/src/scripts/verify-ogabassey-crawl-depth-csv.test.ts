import { describe, expect, it } from 'vitest';
import { parseSemrushCsvPageUrls } from './verify-ogabassey-crawl-depth-csv';

describe('parseSemrushCsvPageUrls', () => {
  it('parses Semrush Page URL columns from crawl-depth exports', () => {
    const csv = [
      'Page URL,Crawl Depth',
      '"https://ogabassey.com/smartphones/compare/a-vs-b",4',
      'https://ogabassey.com/products/demo,6',
    ].join('\n');

    expect(parseSemrushCsvPageUrls(csv)).toEqual([
      'https://ogabassey.com/smartphones/compare/a-vs-b',
      'https://ogabassey.com/products/demo',
    ]);
  });

  it('throws when the export has no Page URL column', () => {
    expect(() => parseSemrushCsvPageUrls('URL,Depth\n/a,1')).toThrow(
      'CSV is missing a Page URL column'
    );
  });
});
