import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isValidZohoBlogContentSignature } from './zoho-blog-content-signature-validation-server';

describe('isValidZohoBlogContentSignature', () => {
  it('accepts the HMAC produced for the requested blog post', () => {
    expect(
      isValidZohoBlogContentSignature({
        contentSecret: 'content-secret',
        postId: 'post-1',
        signature:
          'cf09225d21090066b3ed5c0aeb9ab130ace2366424ef8b7c6ce4d427516dc866',
      })
    ).toBe(true);
  });

  it('rejects a signature for a different blog post', () => {
    expect(
      isValidZohoBlogContentSignature({
        contentSecret: 'content-secret',
        postId: 'post-2',
        signature:
          'cf09225d21090066b3ed5c0aeb9ab130ace2366424ef8b7c6ce4d427516dc866',
      })
    ).toBe(false);
  });
});
