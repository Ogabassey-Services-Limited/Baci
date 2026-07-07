import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DeliveryStep } from './DeliveryStep';

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(
    ({
      id,
      value,
      onChange,
      placeholder,
    }: {
      id?: string;
      value?: string;
      onChange: (value: string) => void;
      placeholder?: string;
    }) => (
      <input
        id={id}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    ),
  ),
}));

vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => <output>Loading quotes...</output>),
}));

describe('DeliveryStep station pickup', () => {
  it('shows GIGL pickup stations when a station quote is available', () => {
    const setDeliveryMethod = vi.fn();
    const setSelectedQuoteId = vi.fn();

    render(
      <DeliveryStep
        addresses={[]}
        airportType="delivery"
        completedSteps={{ contact: true, delivery: false }}
        currentStep="delivery"
        customerEmail="john@example.com"
        customerPhone="+2348012345678"
        deliveryMethod="door"
        fetchShippingQuotes={vi.fn()}
        firstName="John"
        isDeliveryValid={false}
        isHydrated={true}
        isLoadingLocations={false}
        isLoadingQuotes={false}
        isNewAddressMode={true}
        lastName="Doe"
        newAddressCity="Port Harcourt"
        newAddressState="Rivers"
        newAddressStreet=""
        selectedAddressId={0}
        selectedQuoteId="door-quote"
        setAirportType={vi.fn()}
        setCompletedSteps={vi.fn()}
        setCurrentStep={vi.fn()}
        setDeliveryMethod={setDeliveryMethod}
        setIsNewAddressMode={vi.fn()}
        setNewAddressCity={vi.fn()}
        setNewAddressState={vi.fn()}
        setNewAddressStreet={vi.fn()}
        setSelectedAddressId={vi.fn()}
        setSelectedQuoteId={setSelectedQuoteId}
        setShippingQuotes={vi.fn()}
        shippingCities={['Port Harcourt']}
        shippingQuotes={[
          {
            id: 'door-quote',
            provider: 'GIGL',
            serviceTier: 'door',
            carrierName: 'GIG Logistics',
            displayName: 'Door Delivery',
            price: 6200,
            estimatedDays: 3,
            currency: 'NGN',
            pickupIncluded: true,
            insuranceIncluded: true,
          },
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
          },
        ]}
        shippingStates={['Rivers']}
        user={null}
      />,
    );

    fireEvent.click(
      screen.getByRole('radio', { name: /pickup stations \(gigl\)/i }),
    );

    expect(setDeliveryMethod).toHaveBeenCalledWith('pickup_station');
    expect(setSelectedQuoteId).toHaveBeenCalledWith('station-quote');
  });
});
