import {
  resolveLatestPublishedPageConfig,
  resolveLatestPublishedPageConfigWithMeta,
} from './page-config-resolution';

describe('resolveLatestPublishedPageConfig', () => {
  it('returns null when no rows are provided', () => {
    expect(resolveLatestPublishedPageConfig(undefined)).toBeNull();
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
});
