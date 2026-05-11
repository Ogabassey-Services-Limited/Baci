import { describe, expect, it } from 'vitest';
import {
  builderConfigSchema,
  builderCreateSchema,
  builderPublishSchema,
} from '@/schemas/builder';

describe('builder schemas', () => {
  it('fills in missing builder config defaults', () => {
    const parsed = builderConfigSchema.parse({
      content: [],
    });

    expect(parsed).toEqual({
      content: [],
      root: { title: 'Home' },
      zones: {},
    });
  });

  it('accepts a valid optimistic concurrency timestamp on save', () => {
    const parsed = builderCreateSchema.parse({
      slug: 'home',
      config: {
        content: [],
      },
      expectedLastUpdated: '2026-03-20T18:00:00.000Z',
    });

    expect(parsed.expectedLastUpdated).toBe('2026-03-20T18:00:00.000Z');
    expect(parsed.config.root.title).toBe('Home');
  });

  it('rejects invalid optimistic concurrency timestamps on publish', () => {
    expect(() =>
      builderPublishSchema.parse({
        slug: 'home',
        expectedLastUpdated: 'not-a-date',
      })
    ).toThrow();
  });
});
