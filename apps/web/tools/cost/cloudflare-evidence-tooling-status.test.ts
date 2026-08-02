import { describe, expect, it } from 'vitest';
import { assertToolingStatusAllowsOnlyAuthenticatedAdapters } from './cloudflare-evidence-tooling-status';

const root = '/workspace';
const descriptors = [
  { path: '/workspace/private/mutation.ts' },
  { path: '/workspace/private/measurement.ts' },
];

describe('Cloudflare evidence tooling worktree status', () => {
  it('allows only the exact untracked owner-authenticated adapters', () => {
    expect(() =>
      assertToolingStatusAllowsOnlyAuthenticatedAdapters(
        '?? private/mutation.ts\0?? private/measurement.ts\0',
        root,
        descriptors
      )
    ).not.toThrow();
  });

  it.each([
    ' M private/mutation.ts\0',
    '?? private/unapproved.ts\0',
    '?? private/mutation.ts\0 M tracked-tooling.ts\0',
  ])('rejects every other dirty worktree record', (status) => {
    expect(() =>
      assertToolingStatusAllowsOnlyAuthenticatedAdapters(
        status,
        root,
        descriptors
      )
    ).toThrow('not clean');
  });
});
