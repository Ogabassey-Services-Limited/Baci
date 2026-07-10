import { describe, expect, it } from 'vitest';
import { OGABASSEY_AGENT_DISCOVERY_LINK_HEADER } from './agent-discovery-link-header';
import { DEFAULT_MEDIA_CDN_ORIGIN } from './cdn';
import { OGABASSEY_DOCUMENT_LINK_HEADER_VALUE } from './early-hints-link-header';

describe('OGABASSEY_DOCUMENT_LINK_HEADER_VALUE', () => {
  it('advertises a preconnect to the live media CDN origin for Early Hints', () => {
    expect(DEFAULT_MEDIA_CDN_ORIGIN).toBe('https://cdn.ogabassey.com');
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).toContain(
      '<https://cdn.ogabassey.com>; rel=preconnect'
    );
  });

  it('lists the preconnect first so Cloudflare replays it at the head of 103', () => {
    expect(
      OGABASSEY_DOCUMENT_LINK_HEADER_VALUE.startsWith(
        '<https://cdn.ogabassey.com>; rel=preconnect,'
      )
    ).toBe(true);
  });

  it('preserves the existing agent-discovery Link entries', () => {
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).toContain(
      OGABASSEY_AGENT_DISCOVERY_LINK_HEADER
    );
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).toContain(
      '</.well-known/api-catalog>; rel="api-catalog"'
    );
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).toContain(
      '</auth.md>; rel="service-doc"'
    );
  });

  it('never carries a responsive image preload (imagesrcset cannot ride an HTTP Link header)', () => {
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).not.toContain('rel=preload');
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).not.toContain('imagesrcset');
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).not.toContain('as=image');
    expect(OGABASSEY_DOCUMENT_LINK_HEADER_VALUE).not.toContain(
      '/api/ogabassey/pdp-lcp-image/'
    );
  });
});
