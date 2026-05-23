import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaffAcceptFallback } from '@/app/(platform)/staff/accept/staff-accept-fallback';

vi.mock('@/components/logo', () => ({
  Logo: () => <span>Baci</span>,
}));

vi.mock('@/components/themed/themed-card', () => ({
  ThemedCard: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => <section className={className}>{children}</section>,
}));

describe('StaffAcceptFallback', () => {
  it('renders an accessible pending invitation status', () => {
    render(<StaffAcceptFallback />);

    expect(screen.getByText('Baci')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking invitation');
  });
});
