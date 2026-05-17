import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStep } from './DeliveryStep';

// Mock AddressAutocomplete
vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(({ value, onChange, placeholder }) => (
    <input
      data-testid="address-autocomplete"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  )),
}));

// Mock SmartQuoteLoader
vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => (
    <div data-testid="smart-quote-loader">Loading quotes...</div>
  )),
}));

describe('DeliveryStep', () => {
  const defaultProps = {
    currentStep: 'delivery' as const,
    completedSteps: { contact: true, delivery: false },
    deliveryMethod: 'door' as const,
    setDeliveryMethod: vi.fn(),
    airportType: 'delivery' as const,
    setAirportType: vi.fn(),
    isNewAddressMode: true,
    setIsNewAddressMode: vi.fn(),
    newAddressStreet: '',
    newAddressState: '',
    newAddressCity: '',
    setNewAddressStreet: vi.fn(),
    setNewAddressState: vi.fn(),
    setNewAddressCity: vi.fn(),
    selectedAddressId: 0,
    setSelectedAddressId: vi.fn(),
    addresses: [],
    shippingStates: ['Lagos', 'Abuja'],
    shippingCities: ['Ikeja', 'Lekki'],
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

  describe('Rendering', () => {
    it('renders the step header', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByText('Delivery Method')).toBeInTheDocument();
    });

    it('renders step number 2 when not completed', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders address autocomplete when step is active', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByTestId('address-autocomplete')).toBeInTheDocument();
    });

    it('renders delivery address label for guest users', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
    });

    it('infers city/state from manually typed address input', () => {
      render(<DeliveryStep {...defaultProps} />);
      fireEvent.change(screen.getByTestId('address-autocomplete'), {
        target: { value: 'Lekki Phase 1, Lagos' },
      });

      expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('Lagos');
      expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith(
        'Lekki Phase 1',
      );
    });

    it('clears inferred location and quotes when manual input no longer matches', () => {
      render(<DeliveryStep {...defaultProps} />);

      fireEvent.change(screen.getByTestId('address-autocomplete'), {
        target: { value: 'Lekki, Nigeria' },
      });

      expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('');
      expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('');
      expect(defaultProps.setShippingQuotes).toHaveBeenCalledWith([]);
      expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('');
      expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
    });
  });

  describe('Delivery Method Selection', () => {
    it('shows delivery method cards after address is detected', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByText('Door Delivery')).toBeInTheDocument();
    });

    it('shows pickup option when state is Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByText('Pickup')).toBeInTheDocument();
    });

    it('hides pickup option when state is not Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      expect(screen.queryByText('Pickup')).not.toBeInTheDocument();
    });

    it('shows airport option for eligible non-Lagos states', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      expect(screen.getByText('Airport')).toBeInTheDocument();
    });

    it('hides airport option for Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.queryByText('Airport')).not.toBeInTheDocument();
    });

    it('calls setDeliveryMethod when a method card is clicked', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      fireEvent.click(screen.getByText('Pickup'));
      expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('pickup');
    });
  });

  describe('Pickup Method', () => {
    it('shows pickup info when pickup is selected', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          deliveryMethod="pickup"
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByText('Main Office Pickup')).toBeInTheDocument();
      expect(screen.getByText(/Ikeja Store/)).toBeInTheDocument();
    });
  });

  describe('Airport Method', () => {
    it('shows airport delivery and pickup options', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          deliveryMethod="airport"
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      expect(screen.getByText('Airport Delivery')).toBeInTheDocument();
      expect(screen.getByText('Airport Pickup')).toBeInTheDocument();
    });

    it('calls setAirportType when an airport option is selected', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          deliveryMethod="airport"
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      fireEvent.click(screen.getByText('Airport Pickup'));
      expect(defaultProps.setAirportType).toHaveBeenCalledWith('pickup');
    });
  });

  describe('Door Delivery', () => {
    it('shows shipping quotes when available', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
          shippingQuotes={[
            {
              id: 'q1',
              provider: 'gigl',
              serviceTier: 'standard',
              carrierName: 'GIG Logistics',
              displayName: 'Standard Delivery',
              price: 3500,
              estimatedDays: 3,
              currency: 'NGN',
            },
          ]}
        />,
      );
      expect(screen.getByText('Standard Delivery')).toBeInTheDocument();
      // Price is split across elements (₦ + 3,500), use a function matcher
      expect(
        screen.getByText((_, element) =>
          element?.textContent === '₦3,500' || false,
        ),
      ).toBeInTheDocument();
    });

    it('shows loading state when loading quotes', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          isLoadingQuotes={true}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByTestId('smart-quote-loader')).toBeInTheDocument();
    });

    it('shows refresh button when no quotes and not loading', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByText('Refresh Rates')).toBeInTheDocument();
    });

    it('calls fetchShippingQuotes when refresh button is clicked', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
          newAddressStreet="123 Test Street"
        />,
      );
      fireEvent.click(screen.getByText('Refresh Rates'));
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
  });

  describe('Continue Button', () => {
    it('renders continue to payment button', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(
        screen.getByRole('button', { name: /continue to payment/i }),
      ).toBeInTheDocument();
    });

    it('disables continue button when delivery is not valid', () => {
      render(<DeliveryStep {...defaultProps} isDeliveryValid={false} />);
      expect(
        screen.getByRole('button', { name: /continue to payment/i }),
      ).toBeDisabled();
    });

    it('enables continue button when delivery is valid', () => {
      render(<DeliveryStep {...defaultProps} isDeliveryValid={true} />);
      expect(
        screen.getByRole('button', { name: /continue to payment/i }),
      ).toBeEnabled();
    });

    it('advances to payment step when clicked', () => {
      render(<DeliveryStep {...defaultProps} isDeliveryValid={true} />);
      fireEvent.click(
        screen.getByRole('button', { name: /continue to payment/i }),
      );
      expect(defaultProps.setCompletedSteps).toHaveBeenCalled();
      expect(defaultProps.setCurrentStep).toHaveBeenCalledWith('payment');
    });
  });

  describe('Saved Addresses', () => {
    const addressProps = {
      ...defaultProps,
      user: { id: 'user-1' },
      isNewAddressMode: false,
      addresses: [
        {
          id: 1,
          label: 'Home',
          address: '5 Allen Ave, Ikeja, Lagos',
          phone: '+2348012345678',
          isDefault: true,
        },
        {
          id: 2,
          label: 'Office',
          address: '10 Marina, Lagos Island, Lagos',
          phone: '+2348098765432',
          isDefault: false,
        },
      ],
    };

    it('renders saved addresses for logged-in users', () => {
      render(<DeliveryStep {...addressProps} />);
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Office')).toBeInTheDocument();
    });

    it('shows new address toggle button', () => {
      render(<DeliveryStep {...addressProps} />);
      expect(screen.getByText('+ New Address')).toBeInTheDocument();
    });

    it('toggles new address mode', () => {
      render(<DeliveryStep {...addressProps} />);
      fireEvent.click(screen.getByText('+ New Address'));
      expect(addressProps.setIsNewAddressMode).toHaveBeenCalledWith(true);
    });
  });

  describe('Collapsed State', () => {
    it('disables step header when contact is not completed', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          currentStep="contact"
          completedSteps={{ contact: false, delivery: false }}
        />,
      );
      const headerButton = screen.getByRole('button', {
        name: /delivery method/i,
      });
      expect(headerButton).toBeDisabled();
    });

    it('shows Edit text when step is completed and not current', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          currentStep="payment"
          completedSteps={{ contact: true, delivery: true }}
        />,
      );
      expect(screen.getByText('Edit')).toBeInTheDocument();
    });
  });
});
