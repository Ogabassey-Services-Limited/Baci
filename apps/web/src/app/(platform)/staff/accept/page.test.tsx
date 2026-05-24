import { render, screen } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import StaffAcceptPage, {
  StaffAcceptPageContent,
} from '@/app/(platform)/staff/accept/page';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

describe('StaffAcceptPage', () => {
  it('renders a local fallback while runtime invitation data is pending', () => {
    const result = StaffAcceptPage({
      searchParams: new Promise(() => {
        // Intentionally unresolved to keep the Suspense fallback visible.
      }),
    });

    expect(result).not.toBeInstanceOf(Promise);

    render(result as ReactElement);

    expect(screen.getByRole('status')).toHaveTextContent('Checking invitation');
  });

  it('renders invalid-link state when token is missing', async () => {
    const result = await StaffAcceptPageContent({
      searchParams: Promise.resolve({}),
    });

    expect(result).not.toBeInstanceOf(Promise);

    render(result as ReactElement);

    expect(
      screen.getByRole('heading', { name: 'Invalid Link' })
    ).toBeInTheDocument();
  });
});
