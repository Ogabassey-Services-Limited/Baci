import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactCTA } from './contact-cta';

const mockUseMerchantSafe = vi.fn<() => { basePath: string } | null>(() => ({
  basePath: '',
}));

vi.mock('@/hooks/use-merchant-client', () => ({
  useMerchantSafe: () => mockUseMerchantSafe(),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('ContactCTA', () => {
  beforeEach(() => {
    mockUseMerchantSafe.mockReturnValue({ basePath: '' });
    vi.clearAllMocks();
  });

  it('renders a link with "Contact Support" text', () => {
    render(<ContactCTA />);
    expect(screen.getByRole('link', { name: 'Contact Support' })).toBeTruthy();
  });

  it('links to /contact when basePath is empty', () => {
    render(<ContactCTA />);
    expect(
      screen.getByRole('link', { name: 'Contact Support' })
    ).toHaveAttribute('href', '/contact');
  });

  it('prefixes href with basePath when provided', () => {
    mockUseMerchantSafe.mockReturnValue({ basePath: '/ogabassey' });
    render(<ContactCTA />);
    expect(
      screen.getByRole('link', { name: 'Contact Support' })
    ).toHaveAttribute('href', '/ogabassey/contact');
  });

  it('falls back to /contact when useMerchantSafe returns null', () => {
    mockUseMerchantSafe.mockReturnValue(null);
    render(<ContactCTA />);
    expect(
      screen.getByRole('link', { name: 'Contact Support' })
    ).toHaveAttribute('href', '/contact');
  });
});
