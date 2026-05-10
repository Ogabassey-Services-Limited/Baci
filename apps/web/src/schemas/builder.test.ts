import { describe, expect, it } from 'vitest';
import {
  builderConfigSchema,
  builderCreateSchema,
  builderLoadQuerySchema,
  builderPublishSchema,
  parseBuilderConfigForAiDraft,
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

  it('validates AI draft preview query parameters', () => {
    const parsed = builderLoadQuerySchema.parse({
      aiDraftJobId: '5c0a0676-bd3f-495e-9f98-589f208c0d79',
    });

    expect(parsed.slug).toBe('home');
    expect(parsed.aiDraftJobId).toBe('5c0a0676-bd3f-495e-9f98-589f208c0d79');
    expect(() =>
      builderLoadQuerySchema.parse({ aiDraftJobId: 'not-a-uuid' })
    ).toThrow();
  });

  it('parses normalized AI draft builder config with existing defaults', () => {
    const parsed = parseBuilderConfigForAiDraft({
      content: [{ type: 'Hero', props: { title: 'AI design' } }],
    });

    expect(parsed.root.title).toBe('Home');
    expect(parsed.zones).toEqual({});
    expect(parsed.content[0].type).toBe('Hero');
  });

  it('rejects malformed AI draft content', () => {
    expect(() =>
      parseBuilderConfigForAiDraft({
        content: 'Hero',
        root: { title: 'Home' },
        zones: {},
      })
    ).toThrow();
  });

  it('normalizes an empty AI draft config', () => {
    const parsed = parseBuilderConfigForAiDraft({ content: [] });

    expect(parsed).toEqual({
      content: [],
      root: { title: 'Home' },
      zones: {},
    });
  });
});
