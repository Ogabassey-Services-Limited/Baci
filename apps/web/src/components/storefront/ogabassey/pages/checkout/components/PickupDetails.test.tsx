import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PickupDetails } from './PickupDetails';

describe('PickupDetails', () => {
  it('renders pickup instructions for the Ikeja store', () => {
    render(<PickupDetails />);

    expect(screen.getByText('Main Office Pickup')).toBeInTheDocument();
    expect(screen.getByText(/Ikeja Store/i)).toBeInTheDocument();
    expect(screen.getByText(/Pickup closes at 6 PM/i)).toBeInTheDocument();
  });
});
