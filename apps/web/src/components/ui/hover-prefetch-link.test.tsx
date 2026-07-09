import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock next/link to surface the resolved `prefetch` prop as a data attribute so we
// can assert the hover-driven toggle without a real Router.
vi.mock('next/link', () => ({
  default: ({
    prefetch,
    children,
    href,
    ...rest
  }: ComponentProps<'a'> & { prefetch?: boolean | null; href: string }) => (
    <a href={href} data-prefetch={String(prefetch)} {...rest}>
      {children}
    </a>
  ),
}));

import { HoverPrefetchLink } from './hover-prefetch-link';

describe('HoverPrefetchLink', () => {
  it('disables prefetch until the pointer enters', () => {
    // Arrange / Act
    render(
      <HoverPrefetchLink href="/gaming-laptops/foo">Foo</HoverPrefetchLink>
    );

    // Assert: prefetch is off on first render (false, not eager viewport prefetch)
    expect(screen.getByRole('link', { name: 'Foo' })).toHaveAttribute(
      'data-prefetch',
      'false'
    );
  });

  it('enables the default (auto) prefetch after pointer enter', () => {
    // Arrange
    render(
      <HoverPrefetchLink href="/gaming-laptops/foo">Foo</HoverPrefetchLink>
    );
    const link = screen.getByRole('link', { name: 'Foo' });

    // Act
    fireEvent.pointerEnter(link);

    // Assert: null => "use Router default" prefetch, i.e. warm on intent
    expect(link).toHaveAttribute('data-prefetch', 'null');
  });

  it('still invokes a caller-provided onPointerEnter handler', () => {
    // Arrange
    const onPointerEnter = vi.fn();
    render(
      <HoverPrefetchLink href="/x" onPointerEnter={onPointerEnter}>
        Foo
      </HoverPrefetchLink>
    );

    // Act
    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Foo' }));

    // Assert
    expect(onPointerEnter).toHaveBeenCalledTimes(1);
  });

  it('forwards href and arbitrary anchor props to the underlying link', () => {
    // Arrange / Act
    render(
      <HoverPrefetchLink href="/target" className="related-link">
        Foo
      </HoverPrefetchLink>
    );

    // Assert
    const link = screen.getByRole('link', { name: 'Foo' });
    expect(link).toHaveAttribute('href', '/target');
    expect(link).toHaveClass('related-link');
  });
});
