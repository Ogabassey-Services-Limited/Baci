import {
  resolveLatestPublishedPageConfig,
  resolveLatestPublishedPageConfigWithMeta,
  toTimestamp,
} from './page-config-resolution';

describe('toTimestamp', () => {
  it('returns 0 for null or undefined', () => {
    expect(toTimestamp(null)).toBe(0);
    expect(toTimestamp(undefined)).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(toTimestamp('')).toBe(0);
  });

  it('returns 0 for invalid date string', () => {
    expect(toTimestamp('not-a-date')).toBe(0);
  });

  it('returns a valid timestamp for ISO date string', () => {
    const ts = toTimestamp('2026-02-22T10:00:00Z');
    expect(ts).toBe(Date.parse('2026-02-22T10:00:00Z'));
    expect(ts).toBeGreaterThan(0);
  });
});

describe('resolveLatestPublishedPageConfig', () => {
  it('returns null when rows is null', () => {
    expect(resolveLatestPublishedPageConfig(null)).toBeNull();
  });

  it('returns null when rows is undefined', () => {
    expect(resolveLatestPublishedPageConfig(undefined)).toBeNull();
  });

  it('returns null when rows is empty', () => {
    expect(resolveLatestPublishedPageConfig([])).toBeNull();
  });

  it('returns the newest published config when multiple rows exist', () => {
    const older = {
      updated_at: '2026-02-20T10:00:00Z',
      published_config: {
        content: [{ type: 'HeroCarousel', props: { id: 'older-hero' } }],
        root: { props: { title: 'Old' } },
      },
    };
    const newer = {
      updated_at: '2026-02-22T10:00:00Z',
      published_config: {
        content: [{ type: 'HeroCarousel', props: { id: 'newer-hero' } }],
        root: { props: { title: 'New' } },
      },
    };

    const resolved = resolveLatestPublishedPageConfig([older, newer]);
    expect(resolved?.root.props.title).toBe('New');
  });

  it('skips rows with null published config', () => {
    const resolved = resolveLatestPublishedPageConfig([
      { updated_at: '2026-02-22T10:00:00Z', published_config: null },
      {
        updated_at: '2026-02-21T10:00:00Z',
        published_config: {
          content: [],
          root: { props: { title: 'Fallback' } },
        },
      },
    ]);

    expect(resolved?.root.props.title).toBe('Fallback');
  });

  it('returns null for malformed config objects', () => {
    const resolved = resolveLatestPublishedPageConfig([
      {
        updated_at: '2026-02-22T10:00:00Z',
        published_config: { root: { props: {} } },
      },
    ]);

    expect(resolved).toBeNull();
  });
});

describe('resolveLatestPublishedPageConfigWithMeta', () => {
  it('returns null for null input', () => {
    expect(resolveLatestPublishedPageConfigWithMeta(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(resolveLatestPublishedPageConfigWithMeta([])).toBeNull();
  });

  it('returns null when all configs are invalid', () => {
    const result = resolveLatestPublishedPageConfigWithMeta([
      { updated_at: '2026-02-22T10:00:00Z', published_config: null },
      { updated_at: '2026-02-21T10:00:00Z', published_config: 'not-an-object' },
    ]);

    expect(result).toBeNull();
  });

  it('returns config metadata for the newest published row', () => {
    const older = {
      updated_at: '2026-02-21T10:00:00Z',
      published_config: {
        content: [{ type: 'HeroCarousel', props: { id: 'older-hero' } }],
        root: { props: { title: 'Older' } },
      },
    };

    const newer = {
      updated_at: '2026-02-23T10:00:00Z',
      published_config: {
        content: [{ type: 'HeroCarousel', props: { id: 'newer-hero' } }],
        root: { props: { title: 'Newer' } },
      },
    };

    const resolved = resolveLatestPublishedPageConfigWithMeta([older, newer]);

    expect(resolved?.updatedAt).toBe('2026-02-23T10:00:00Z');
    expect(resolved?.config.root.props.title).toBe('Newer');
  });

  it('includes updatedAt as null when row has no updated_at', () => {
    const row = {
      published_config: {
        content: [{ type: 'HeroCarousel', props: { id: 'hero' } }],
        root: { props: { title: 'Test' } },
      },
    };

    const resolved = resolveLatestPublishedPageConfigWithMeta([row]);

    expect(resolved?.updatedAt).toBeNull();
    expect(resolved?.config.root.props.title).toBe('Test');
  });
});
