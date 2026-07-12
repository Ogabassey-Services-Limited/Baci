import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RepairBookingSuccess } from './RepairBookingSuccess';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: { children: ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

describe('RepairBookingSuccess', () => {
  it('shows the ticket number and merchant name', () => {
    render(<RepairBookingSuccess merchantName="Ogabassey" ticketNumber={42} />);

    expect(screen.getByText('Ticket #42')).toBeInTheDocument();
    expect(screen.getByText(/ogabassey/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /back to store/i })
    ).toBeInTheDocument();
  });

  it('omits the ticket line when the ticket number is unavailable', () => {
    render(
      <RepairBookingSuccess merchantName="Ogabassey" ticketNumber={null} />
    );

    expect(screen.queryByText(/^Ticket #/)).not.toBeInTheDocument();
  });
});
