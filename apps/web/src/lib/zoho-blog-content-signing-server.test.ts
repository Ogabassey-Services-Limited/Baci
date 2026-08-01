import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildZohoBlogContentSignature } from './zoho-blog-content-signing-server';

describe('buildZohoBlogContentSignature', () => {
  it('builds the HMAC for a blog post content request', () => {
    expect(
      buildZohoBlogContentSignature({
        contentSecret: 'content-secret',
        postId: 'post-1',
      })
    ).toBe('cf09225d21090066b3ed5c0aeb9ab130ace2366424ef8b7c6ce4d427516dc866');
  });
});
