import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryMethodDetails } from './DeliveryMethodDetails';

vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => <output role="status">Loading quotes...</output>),
}));

describe('DeliveryMethodDetails', () => {
  const defaultProps: ComponentProps<typeof DeliveryMethodDetails> = {
    deliveryMethod: 'door',
    setDeliveryMethod: vi.fn(),
    airportType: 'delivery',
    setAirportType: vi.fn(),
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

  it('renders pickup details for pickup delivery', () => {
    render(<DeliveryMethodDetails {...defaultProps} deliveryMethod="pickup" />);

    expect(screen.getByText('Main Office Pickup')).toBeInTheDocument();
    expect(screen.getByText(/Ikeja Store/i)).toBeInTheDocument();
  });

  it('renders airport options and selects an airport preference', () => {
    render(<DeliveryMethodDetails {...defaultProps} deliveryMethod="airport" />);

    expect(
      screen.getByRole('group', { name: /airport delivery preference/i }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /airport pickup/i }));

    expect(defaultProps.setAirportType).toHaveBeenCalledWith('pickup');
  });

  it('renders available shipping quotes and selects one', () => {
    render(
      <DeliveryMethodDetails
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
        ]}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /standard delivery/i }));

    expect(screen.getByText('Standard Delivery')).toBeInTheDocument();
    expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('q1');
  });

  it('renders the selected GIGL pickup station details', () => {
    render(
      <DeliveryMethodDetails
        {...defaultProps}
        deliveryMethod="pickup_station"
        selectedQuoteId="station-quote"
        shippingQuotes={[
          {
            id: 'station-quote',
            provider: 'GIGL',
            serviceTier: 'station',
            carrierName: 'GIG Logistics',
            displayName: 'Pickup Stations (GIGL)',
            price: 4200,
            estimatedDays: 3,
            currency: 'NGN',
            pickupIncluded: true,
            insuranceIncluded: true,
            isStationPickup: true,
            stationName: 'PORT HARCOURT',
            stationAddress: 'GIGL Aba Road, Port Harcourt',
          },
        ]}
      />,
    );

    expect(screen.getByText('Pickup Stations (GIGL)')).toBeInTheDocument();
    expect(screen.getByText('PORT HARCOURT')).toBeInTheDocument();
    expect(
      screen.getByText(/gigl aba road, port harcourt/i),
    ).toBeInTheDocument();
  });

  it('refreshes shipping quotes using the current address', () => {
    render(<DeliveryMethodDetails {...defaultProps} />);

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

  it('does not refresh shipping quotes when state or city is missing', () => {
    render(
      <DeliveryMethodDetails
        {...defaultProps}
        newAddressState=""
        newAddressCity="Ikeja"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /refresh rates/i }));

    expect(defaultProps.fetchShippingQuotes).not.toHaveBeenCalled();
  });
});
