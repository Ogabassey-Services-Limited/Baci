import { describe, expect, it } from 'vitest';
import { toNextRobotsMetadata } from './to-next-robots-metadata';

describe('toNextRobotsMetadata', () => {
  it('maps the shared indexing decision to Next robots metadata', () => {
    expect(
      toNextRobotsMetadata({
        pageKind: 'home',
        index: false,
        follow: true,
        blockers: ['store_unpublished'],
      })
    ).toEqual({ index: false, follow: true });
  });
});
