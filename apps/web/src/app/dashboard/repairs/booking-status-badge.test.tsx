import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BookingStatusBadge } from './booking-status-badge';

describe('BookingStatusBadge', () => {
  it('renders the human label for a known status', () => {
    render(<BookingStatusBadge status="in_progress" />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
  });

  it('falls back to the raw value for an unknown status', () => {
    render(<BookingStatusBadge status="mystery" />);
    expect(screen.getByText('mystery')).toBeInTheDocument();
  });
});
