import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { JsonLd } from './json-ld';

describe('JsonLd', () => {
  it('renders escaped schema.org graph data in an ld+json script', () => {
    const markup = renderToStaticMarkup(
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'WebSite',
              name: '<b>Baci</b>',
              url: 'https://usebaci.com',
            },
          ],
        }}
      />
    );

    expect(markup).toContain('type="application/ld+json"');
    expect(markup).toContain('\\u003cb\\u003eBaci\\u003c/b\\u003e');
    expect(markup).not.toContain('<b>Baci</b>');
  });
});
