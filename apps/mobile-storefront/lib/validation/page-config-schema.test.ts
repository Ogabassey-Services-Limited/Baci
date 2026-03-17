import { PageConfigSchema } from './page-config-schema';

describe('PageConfigSchema', () => {
  it('parses a valid page config payload', () => {
    const result = PageConfigSchema.safeParse({
      content: [
        {
          type: 'HeroCarousel',
          props: {
            id: 'hero-1',
            title: 'Featured',
          },
        },
      ],
      root: {
        props: {
          title: 'Home',
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.root.props.title).toBe('Home');
      expect(result.data.content).toHaveLength(1);
      expect(result.data.content[0]).toMatchObject({
        type: 'HeroCarousel',
        props: {
          id: 'hero-1',
          title: 'Featured',
        },
      });
    }
  });

  it('allows an empty content array', () => {
    const result = PageConfigSchema.safeParse({
      content: [],
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(true);
  });

  it('rejects malformed page config payload', () => {
    const result = PageConfigSchema.safeParse({
      content: [{ props: { id: 'missing-type' } }],
      root: {
        props: {
          title: 5,
        },
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['content', 0, 'type'],
            code: 'invalid_type',
          }),
          expect.objectContaining({
            path: ['root', 'props', 'title'],
            code: 'invalid_type',
          }),
        ])
      );
    }
  });

  it('rejects payload when content is missing', () => {
    const result = PageConfigSchema.safeParse({
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['content'],
            code: 'invalid_type',
          }),
        ])
      );
    }
  });

  it('rejects payload when root is missing', () => {
    const result = PageConfigSchema.safeParse({
      content: [{ type: 'HeroCarousel', props: { id: 'hero-1' } }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['root'],
            code: 'invalid_type',
          }),
        ])
      );
    }
  });

  it('rejects content item when nested props.id is missing', () => {
    const result = PageConfigSchema.safeParse({
      content: [{ type: 'HeroCarousel', props: { title: 'Featured' } }],
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['content', 0, 'props', 'id'],
            code: 'invalid_type',
          }),
        ])
      );
    }
  });

  it('rejects unexpected nested prop types', () => {
    const result = PageConfigSchema.safeParse({
      content: [{ type: 'HeroCarousel', props: { id: 42 } }],
      root: { props: { title: 99 } },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ['content', 0, 'props', 'id'],
            code: 'invalid_type',
          }),
          expect.objectContaining({
            path: ['root', 'props', 'title'],
            code: 'invalid_type',
          }),
        ])
      );
    }
  });
});
