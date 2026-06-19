import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStep } from './DeliveryStep';

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(({ id, value, onChange, placeholder }) => (
    <input
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  )),
}));

vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => <output role="status">Loading quotes...</output>),
}));

describe('DeliveryStep delivery method eligibility', () => {
  const defaultProps = {
    currentStep: 'delivery' as const,
    completedSteps: { contact: true, delivery: false },
    deliveryMethod: 'door' as const,
    setDeliveryMethod: vi.fn(),
    airportType: 'delivery' as const,
    setAirportType: vi.fn(),
    isNewAddressMode: true,
    setIsNewAddressMode: vi.fn(),
    newAddressStreet: '123 Test Street',
    newAddressState: 'Lagos',
    newAddressCity: 'Ikeja',
    setNewAddressStreet: vi.fn(),
    setNewAddressState: vi.fn(),
    setNewAddressCity: vi.fn(),
    selectedAddressId: 0,
    setSelectedAddressId: vi.fn(),
    addresses: [],
    shippingStates: ['Lagos', 'Abuja'],
    shippingCities: ['Ikeja', 'Garki'],
    isLoadingLocations: false,
    shippingQuotes: [],
    setShippingQuotes: vi.fn(),
    isLoadingQuotes: false,
    selectedQuoteId: '',
    setSelectedQuoteId: vi.fn(),
    fetchShippingQuotes: vi.fn(),
    isDeliveryValid: false,
    setCurrentStep: vi.fn(),
    setCompletedSteps: vi.fn(),
    user: null,
    isHydrated: true,
    customerPhone: '+2348012345678',
    firstName: 'John',
    lastName: 'Doe',
    customerEmail: 'john@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets pickup to door delivery when the address leaves Lagos', () => {
    render(
      <DeliveryStep
        {...defaultProps}
        deliveryMethod="pickup"
        newAddressState="Abuja"
        newAddressCity="Garki"
      />,
    );

    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
  });

  it('resets airport to door delivery when the address becomes Lagos', () => {
    render(
      <DeliveryStep
        {...defaultProps}
        deliveryMethod="airport"
        newAddressState="Lagos"
        newAddressCity="Ikeja"
      />,
    );

    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
  });


  it('retains pickup when the address remains in Lagos', () => {
    render(
      <DeliveryStep
        {...defaultProps}
        deliveryMethod="pickup"
        newAddressState="Lagos"
        newAddressCity="Ikeja"
      />,
    );

    expect(defaultProps.setDeliveryMethod).not.toHaveBeenCalled();
  });

  it('retains airport when the address is in an eligible non-Lagos state', () => {
    render(
      <DeliveryStep
        {...defaultProps}
        deliveryMethod="airport"
        newAddressState="Abuja"
        newAddressCity="Garki"
      />,
    );

    expect(defaultProps.setDeliveryMethod).not.toHaveBeenCalled();
  });

  it('never resets door delivery regardless of the address', () => {
    render(
      <DeliveryStep
        {...defaultProps}
        deliveryMethod="door"
        newAddressState="Abuja"
        newAddressCity="Garki"
      />,
    );

    expect(defaultProps.setDeliveryMethod).not.toHaveBeenCalled();
  });
});
