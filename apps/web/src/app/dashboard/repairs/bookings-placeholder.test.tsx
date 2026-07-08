import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BookingsPlaceholder from './bookings-placeholder';

describe('BookingsPlaceholder', () => {
  it('tells the merchant bookings are coming soon', () => {
    render(<BookingsPlaceholder />);
    expect(screen.getByText('Bookings are coming soon')).toBeInTheDocument();
  });
});
