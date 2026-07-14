import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Split out of platform-blog.test.ts (PR4b review round 2) to keep that file
// under the repo's 300-line modularity limit.
describe('platform-blog cache directives', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'platform-blog.ts'),
    'utf8'
  );

  it('keeps all four platform-blog surfaces on the shared remote cache handler (PR4b review)', () => {
    // Codex review (PR #3108): admin edit/unpublish/delete/rename flows bust
    // these entries via revalidateTag (PLATFORM_BLOG_* tags in
    // cache-revalidation.ts). Tag invalidation only propagates cross-instance
    // through the SHARED remote store — local 'use cache' entries on other
    // instances would keep serving deleted/renamed posts until cacheLife
    // expiry. Reverted to remote; joins the PR4d resilient-adapter migration
    // set (inventory doc §8).
    // One remote directive per exported reader (post, listing, feed, sitemap).
    expect(source.match(/'use cache: remote';/g) ?? []).toHaveLength(4);
    expect(source.match(/'use cache';/g) ?? []).toHaveLength(0);
  });
});
