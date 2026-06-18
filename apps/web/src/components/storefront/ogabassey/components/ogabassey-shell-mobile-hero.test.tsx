import { render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MOBILE_SLIDES } from './hero-data';
import { OgabasseyShellMobileHero } from './ogabassey-shell-mobile-hero';

const mockGetImageProps = vi.hoisted(() =>
  vi.fn(
    (props: Record<string, unknown>): { props: Record<string, unknown> } => ({
      props: {
        alt: props.alt,
        decoding: props.decoding,
        fetchPriority: props.fetchPriority,
        height: props.height,
        loading: props.loading,
        sizes: props.sizes,
        src: props.src,
        srcSet: `${String(props.src)} 640w, ${String(props.src)} 960w`,
        width: props.width,
      },
    })
  )
);

vi.mock('next/image', () => ({
  getImageProps: mockGetImageProps,
}));

describe('OgabasseyShellMobileHero', () => {
  it('renders the first slide banner copy and CTA chrome', () => {
    const { container } = render(<OgabasseyShellMobileHero />);

    const firstSlide = MOBILE_SLIDES[0];
    expect(container.textContent).toContain(firstSlide?.title);
    expect(container.textContent).toContain(firstSlide?.subtitle);
    expect(container.textContent).toContain('Shop Now');
  });

  it('renders the inline LCP banner image as a picture (single fetch, no swap)', () => {
    const { container } = render(<OgabasseyShellMobileHero />);

    const picture = container.querySelector('picture');
    expect(picture).toBeInTheDocument();
    const avifSource = picture?.querySelector('source[type="image/avif"]');
    // The shell image must reuse the carousel's inline AVIF data-URI so it is the
    // same LCP candidate with zero extra network cost.
    expect(avifSource?.getAttribute('srcset')).toBe(MOBILE_SLIDES[0]?.inlineSrc);
  });

  it('does not include an interactive link or emit a preload hint', () => {
    const html = renderToString(<OgabasseyShellMobileHero />);
    const template = document.createElement('template');
    template.innerHTML = html;

    // CTA is a non-interactive span inside the decorative shell — never a link
    // that competes with the real carousel CTA for assistive tech / tab order.
    expect(template.content.querySelector('a')).toBeNull();
    expect(template.content.querySelector('link[rel="preload"]')).toBeNull();
  });

  it('keeps the carousel hero geometry so the streamed banner fills it cleanly', () => {
    const { container } = render(<OgabasseyShellMobileHero />);

    const panel = container.querySelector('.h-48');
    expect(panel).toBeInTheDocument();
    expect(panel?.className).toContain('rounded-2xl');
    expect(panel?.className).toContain('overflow-hidden');
  });
});
