import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GadgetPattern } from './GadgetPattern';

describe('GadgetPattern', () => {
  it('renders an inline SVG pattern as a non-interactive decorative background', () => {
    const { container } = render(<GadgetPattern />);

    const pattern = screen.getByTestId('ogabassey-gadget-pattern');

    expect(pattern.tagName.toLowerCase()).toBe('svg');
    expect(pattern).toHaveAttribute('aria-hidden', 'true');
    expect(pattern).toHaveStyle({
      inset: '0',
      opacity: '0.05',
      pointerEvents: 'none',
      position: 'absolute',
    });
    // The tile must be an SVG <pattern> filling a rect — LCP-safe by
    // construction. A `background-image: url(...)` (including data: URIs) IS
    // an LCP candidate and made this decorative doodle the field LCP element;
    // inline SVG shape content is not. Guard against regressions to CSS
    // backgrounds.
    const tile = container.querySelector('pattern');
    expect(tile).not.toBeNull();
    expect(tile).toHaveAttribute('width', '140');
    expect(tile).toHaveAttribute('height', '140');
    const fillRect = container.querySelector(`rect[fill="url(#${tile?.id})"]`);
    expect(fillRect).not.toBeNull();
    expect(pattern.getAttribute('style') ?? '').not.toContain('background');
    expect(pattern.getAttribute('style') ?? '').not.toContain(
      'data:image/svg+xml'
    );
  });

  it('gives each instance a unique pattern id so multiple bands render independently', () => {
    const { container } = render(
      <>
        <GadgetPattern />
        <GadgetPattern />
      </>
    );

    const ids = [...container.querySelectorAll('pattern')].map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('allows the pattern opacity and class name to be customized', () => {
    render(<GadgetPattern className="absolute inset-0" opacity={0.1} />);

    const pattern = screen.getByTestId('ogabassey-gadget-pattern');

    expect(pattern).toHaveClass('absolute', 'inset-0');
    expect(pattern).toHaveStyle({ opacity: '0.1' });
  });

  it('defaults the tile stroke color to white', () => {
    const { container } = render(<GadgetPattern />);

    const strokeGroup = container.querySelector('pattern > g');
    expect(strokeGroup).toHaveAttribute('stroke', '#ffffff');
  });

  it('recolors the tile via the stroke prop, for callers with their own tile variant', () => {
    const { container } = render(<GadgetPattern stroke="#000000" />);

    const strokeGroup = container.querySelector('pattern > g');
    expect(strokeGroup).toHaveAttribute('stroke', '#000000');
  });

  it('swaps in custom children as the tile shape content instead of the default gadget shapes', () => {
    const { container } = render(
      <GadgetPattern>
        <circle cx="5" cy="5" r="1" data-testid="custom-shape" />
      </GadgetPattern>
    );

    expect(screen.getByTestId('custom-shape')).toBeInTheDocument();
    // The default gadget doodle (a rotated 12x20 rect) must not leak through
    // when a custom tile is provided.
    expect(container.querySelector('rect[width="12"][height="20"]')).toBeNull();
  });
});
