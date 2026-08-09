import { describe, expect, it } from 'vitest';
import { builderPreviewCandidateConfigSchema } from './builder-preview-candidate-config';
import { previewRenderPolicy } from './builder-preview-render-policy';

describe('preview render policy', () => {
  it('parses compound Puck dropzone keys while rejecting inert and unsafe keys', () => {
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:children')).toBe(true);
    expect(previewRenderPolicy.isPuckZoneKey('aside')).toBe(false);
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:<script>')).toBe(false);
    expect(previewRenderPolicy.isPuckZoneKey('Flex-1234:children:next')).toBe(
      false
    );
  });

  it('rejects malformed CSS colors and unsafe asset or gradient values', () => {
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { backgroundColor: '#12345', id: 'header-1' },
          type: 'Header',
        },
        new Set()
      )
    ).toBe(false);
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { backgroundColor: '#1234567', id: 'header-1' },
          type: 'Header',
        },
        new Set()
      )
    ).toBe(false);
  });

  it('accepts bounded curated render props without allowing unreviewed props', () => {
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: {
            backgroundColor: '#111111',
            id: 'header-1',
            storeName: 'Acme Store',
          },
          type: 'Header',
        },
        new Set()
      )
    ).toBe(true);
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { headingLevel: 'h1', id: 'hero-1', title: 'Welcome' },
          type: 'Hero',
        },
        new Set()
      )
    ).toBe(true);
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: { id: 'button-1', link: 'javascript:alert(1)' },
          type: 'Button',
        },
        new Set()
      )
    ).toBe(false);
    expect(
      previewRenderPolicy.isPuckComponent(
        { props: { id: 'header-1', unreviewed: true }, type: 'Header' },
        new Set()
      )
    ).toBe(false);
    expect(
      previewRenderPolicy.isPuckComponent(
        { props: { id: 'code-1' }, type: 'CodeEmbed' },
        new Set()
      )
    ).toBe(false);
  });

  it('accepts saved animation defaults for every render-safe animated block', () => {
    const animation = {
      animationDelay: 0,
      animationDuration: 'normal',
      animationTrigger: 'scroll',
      animationType: 'fade-in',
    };
    const components = [
      {
        props: {
          ...animation,
          align: 'center',
          ctaLink: '/products',
          ctaText: 'Shop now',
          id: 'hero-1',
          padding: 'large',
          subtitle: 'Discover our collection.',
          title: 'Featured collection',
        },
        type: 'Hero',
      },
      {
        props: {
          ...animation,
          align: 'left',
          content: 'Supporting copy',
          id: 'text-1',
          title: 'About us',
        },
        type: 'Text',
      },
      {
        props: {
          ...animation,
          columns: 3,
          features: [
            {
              description: 'Fast delivery',
              icon: 'truck',
              title: 'Shipping',
            },
          ],
          id: 'features-1',
          title: 'Why choose us',
        },
        type: 'Features',
      },
      {
        props: {
          ...animation,
          id: 'faq-1',
          items: [{ answer: 'Within days.', question: 'When?' }],
          style: 'accordion',
          title: 'Questions',
        },
        type: 'FAQ',
      },
      {
        props: {
          ...animation,
          id: 'legal-1',
          sections: [{ content: 'Terms apply.', heading: 'Terms' }],
          title: 'Policy',
        },
        type: 'LegalSection',
      },
    ];

    expect(
      components.every((component) =>
        previewRenderPolicy.isPuckComponent(component, new Set())
      )
    ).toBe(true);
  });

  it('rejects unsupported animation values on render-safe blocks', () => {
    expect(
      previewRenderPolicy.isPuckComponent(
        {
          props: {
            animationDelay: 6,
            animationDuration: 'instant',
            animationTrigger: 'unsafe',
            animationType: 'javascript',
            id: 'text-1',
          },
          type: 'Text',
        },
        new Set()
      )
    ).toBe(false);
  });

  it('projects carousel slide text and links onto a local placeholder image', () => {
    const result = builderPreviewCandidateConfigSchema.safeParse({
      content: [
        {
          props: {
            autoplayDelay: 5000,
            id: 'carousel-1',
            slides: [
              {
                ctaLink: '/collections/new',
                ctaText: 'Shop now',
                image: '/existing-merchant-image.webp',
                subtitle: 'Updated supporting copy',
                title: 'Updated title',
              },
            ],
          },
          type: 'HeroCarousel',
        },
      ],
      root: { props: { title: 'Home' } },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content[0]?.props.slides).toEqual([
        {
          ctaLink: '/collections/new',
          ctaText: 'Shop now',
          image: '/placeholder.png',
          subtitle: 'Updated supporting copy',
          title: 'Updated title',
        },
      ]);
    }
  });

  it('rejects partial carousel slides before they can call scoped routing with undefined', () => {
    expect(
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'carousel-1',
              slides: [{ title: 'Sale' }],
            },
            type: 'HeroCarousel',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });

  it('rejects hostile carousel media, links, and unknown slide fields', () => {
    const candidate = (slide: Record<string, unknown>) =>
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: { id: 'carousel-1', slides: [slide] },
            type: 'HeroCarousel',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success;
    const safeSlide = {
      ctaLink: '/collections/new',
      ctaText: 'Shop now',
      image: '/existing-merchant-image.webp',
      subtitle: 'Supporting copy',
      title: 'New title',
    };

    expect(
      candidate({ ...safeSlide, image: 'https://outside.test/image.webp' })
    ).toBe(false);
    expect(candidate({ ...safeSlide, image: 'javascript:alert(1)' })).toBe(
      false
    );
    expect(candidate({ ...safeSlide, ctaLink: 'javascript:alert(1)' })).toBe(
      false
    );
    expect(candidate({ ...safeSlide, trackingPixel: '/pixel.gif' })).toBe(
      false
    );
    expect(
      builderPreviewCandidateConfigSchema.safeParse({
        content: [
          {
            props: {
              id: 'carousel-1',
              slides: [safeSlide],
              unreviewed: true,
            },
            type: 'HeroCarousel',
          },
        ],
        root: { props: { title: 'Home' } },
      }).success
    ).toBe(false);
  });
});
