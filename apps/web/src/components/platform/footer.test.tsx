import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PLATFORM_CONFIG } from '@/config/platform';
import { PlatformFooter } from './footer';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('PlatformFooter', () => {
  it('renders real social media links instead of placeholders', () => {
    render(<PlatformFooter />);

    expect(screen.getByRole('link', { name: 'Twitter' })).toHaveAttribute(
      'href',
      PLATFORM_CONFIG.socialMedia.twitter
    );
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toHaveAttribute(
      'href',
      PLATFORM_CONFIG.socialMedia.linkedin
    );
    expect(screen.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      PLATFORM_CONFIG.socialMedia.instagram
    );
  });
});
