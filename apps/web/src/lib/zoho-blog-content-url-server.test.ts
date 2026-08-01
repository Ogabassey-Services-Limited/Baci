import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildZohoBlogContentUrl } from './zoho-blog-content-url-server';

describe('buildZohoBlogContentUrl', () => {
  it('builds a signed content URL from the configured public origin', () => {
    expect(
      buildZohoBlogContentUrl({
        contentSecret: 'content-secret',
        postId: 'post-1',
        publicBaseUrl: 'https://usebaci.com/',
      })
    ).toBe(
      'https://usebaci.com/api/integrations/zoho/blog-content/post-1?sig=cf09225d21090066b3ed5c0aeb9ab130ace2366424ef8b7c6ce4d427516dc866'
    );
  });
});
