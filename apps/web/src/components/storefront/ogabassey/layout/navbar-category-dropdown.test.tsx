import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NavbarCategoryDropdown } from './navbar-category-dropdown';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    prefetch: _prefetch,
    ...props
  }: {
    children: ReactNode;
    href: string;
    prefetch?: boolean;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('NavbarCategoryDropdown', () => {
  it('renders an accessible category navigation region', () => {
    render(
      <NavbarCategoryDropdown
        basePath="/ogabassey"
        categories={[{ name: 'Phones', slug: 'smartphones' }]}
        dropdownId="category-menu"
        onClose={vi.fn()}
      />
    );

    const region = screen.getByRole('region', {
      name: /category navigation/i,
    });

    expect(region).toHaveAttribute('id', 'category-menu');
    expect(screen.getByRole('link', { name: 'Phones' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
  });

  it('normalizes legacy category slugs before emitting storefront links', () => {
    render(
      <NavbarCategoryDropdown
        basePath="/ogabassey"
        categories={[{ name: 'Wearables', slug: ' phones ' }]}
        dropdownId="category-menu"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('link', { name: 'Wearables' })).toHaveAttribute(
      'href',
      '/ogabassey/smartphones'
    );
  });

  it('closes the menu when a category link is selected', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <NavbarCategoryDropdown
        basePath="/ogabassey"
        categories={[{ name: 'Laptops', slug: 'laptops' }]}
        dropdownId="category-menu"
        onClose={onClose}
      />
    );

    await user.click(screen.getByRole('link', { name: 'Laptops' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the menu when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <NavbarCategoryDropdown
        basePath="/ogabassey"
        categories={[{ name: 'Laptops', slug: 'laptops' }]}
        dropdownId="category-menu"
        onClose={onClose}
      />
    );

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows a loading placeholder when no categories are available', () => {
    render(
      <NavbarCategoryDropdown
        basePath="/ogabassey"
        categories={[]}
        dropdownId="category-menu"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Loading categories…')).toBeInTheDocument();
  });
});
