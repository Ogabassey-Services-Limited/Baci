import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DoorDeliveryQuotes } from './DoorDeliveryQuotes';

vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => <output role="status">Loading quotes...</output>),
}));

describe('DoorDeliveryQuotes', () => {
  const defaultProps = {
    shippingQuotes: [],
    isLoadingQuotes: false,
    selectedQuoteId: '',
    setSelectedQuoteId: vi.fn(),
    fetchShippingQuotes: vi.fn(),
    newAddressStreet: '123 Test Street',
    newAddressState: 'Lagos',
    newAddressCity: 'Ikeja',
    customerPhone: '+2348012345678',
    firstName: 'John',
    lastName: 'Doe',
    customerEmail: 'john@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the quote loader while rates are loading', () => {
    render(<DoorDeliveryQuotes {...defaultProps} isLoadingQuotes={true} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading quotes...');
  });

  it('selects an available shipping quote', () => {
    render(
      <DoorDeliveryQuotes
        {...defaultProps}
        shippingQuotes={[
          {
            id: 'q1',
            provider: 'GIGL',
            serviceTier: 'standard',
            carrierName: 'GIG Logistics',
            displayName: 'Standard Delivery',
            price: 3500,
            estimatedDays: 3,
            currency: 'NGN',
            pickupIncluded: false,
            insuranceIncluded: false,
          },
          {
            id: 'q2',
            provider: 'TOPSHIP',
            serviceTier: 'express',
            carrierName: 'Topship Express',
            displayName: 'Express Delivery',
            price: 5200,
            estimatedDays: 1,
            currency: 'NGN',
            pickupIncluded: false,
            insuranceIncluded: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('GIGL')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /standard delivery/i }));

    expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('q1');
  });

  it('shows the empty-state refresh button when no quotes are available', () => {
    render(<DoorDeliveryQuotes {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /refresh rates/i }),
    ).toBeInTheDocument();
  });

  it('refreshes rates with the current address and customer details', () => {
    render(<DoorDeliveryQuotes {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /refresh rates/i }));

    expect(defaultProps.fetchShippingQuotes).toHaveBeenCalledWith(
      '123 Test Street',
      'Lagos',
      'Ikeja',
      '+2348012345678',
      'John',
      'Doe',
      'john@example.com',
    );
  });

  it('does not refresh rates when the location is incomplete', () => {
    render(<DoorDeliveryQuotes {...defaultProps} newAddressState="" />);

    fireEvent.click(screen.getByRole('button', { name: /refresh rates/i }));

    expect(defaultProps.fetchShippingQuotes).not.toHaveBeenCalled();
  });
});
