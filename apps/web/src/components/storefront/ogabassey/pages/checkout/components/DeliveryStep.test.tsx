import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryStep } from './DeliveryStep';

// Mock AddressAutocomplete. Exposes a button to simulate a Places failure so
// the manual-fallback behaviour can be exercised without a real network call.
vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(({ id, value, onChange, placeholder, onError }) => (
    <>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <button
        type="button"
        data-testid="trigger-places-error"
        onClick={() => onError?.(true)}
      >
        trigger places error
      </button>
    </>
  )),
}));

// Mock SmartQuoteLoader
vi.mock('../../../components/SmartQuoteLoader', () => ({
  SmartQuoteLoader: vi.fn(() => <output>Loading quotes...</output>),
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
      expect(
        screen.getByRole('textbox', { name: /delivery address/i }),
      ).toBeInTheDocument();
    });

    it('renders delivery address label for guest users', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByText('Delivery Address')).toBeInTheDocument();
    });

    it('associates the delivery address label with the autocomplete input', () => {
      render(<DeliveryStep {...defaultProps} />);
      expect(screen.getByLabelText('Delivery Address')).toBe(
        screen.getByRole('textbox', { name: /delivery address/i }),
      );
    });

    it('infers city/state from manually typed address input', () => {
      render(<DeliveryStep {...defaultProps} />);
      fireEvent.change(
        screen.getByRole('textbox', { name: /delivery address/i }),
        {
          target: { value: 'Lekki Phase 1, Lagos' },
        },
      );

      expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('Lagos');
      expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith(
        'Lekki Phase 1',
      );
    });

    it('lets the shopper enter State and City manually as a Places fallback', () => {
      render(<DeliveryStep {...defaultProps} />);

      // Manual entry is offered when no location has been detected yet.
      fireEvent.click(
        screen.getByRole('button', {
          name: /enter state.*city manually/i,
        }),
      );

      const stateSelect = screen.getByLabelText('State');
      fireEvent.change(stateSelect, { target: { value: 'Lagos' } });
      expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('Lagos');

      const cityInput = screen.getByLabelText(/city/i);
      fireEvent.change(cityInput, { target: { value: 'Ikeja' } });
      expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('Ikeja');
    });

    it('reveals manual State/City entry when address suggestions fail', () => {
      render(<DeliveryStep {...defaultProps} />);

      expect(screen.queryByLabelText('State')).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId('trigger-places-error'));

      expect(screen.getByLabelText('State')).toBeInTheDocument();
      expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    });

    it('clears inferred location and quotes when manual input no longer matches', () => {
      render(<DeliveryStep {...defaultProps} />);

      fireEvent.change(
        screen.getByRole('textbox', { name: /delivery address/i }),
        {
          target: { value: 'Lekki, Nigeria' },
        },
      );

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
      expect(
        screen.getByRole('group', {
          name: /how would you like to receive your order/i,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: /door delivery/i }),
      ).toBeInTheDocument();
    });

    it('keeps visible focus rings on custom saved-address radio cards', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          user={{ id: 'customer-1' }}
          isNewAddressMode={false}
          addresses={[
            {
              id: 7,
              label: 'Home',
              address: '12 Test Street, Ikeja, Lagos',
              phone: '+2348012345678',
              isDefault: true,
            },
          ]}
        />,
      );

      expect(
        screen.getByRole('radio', { name: /home/i }).closest('label'),
      ).toHaveClass(
        'focus-within:ring-2',
        'focus-within:ring-store-primary',
        'focus-within:ring-offset-2',
      );
    });

    it('shows pickup option when state is Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(screen.getByRole('radio', { name: /pickup/i })).toBeInTheDocument();
    });

    it('hides pickup option when state is not Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      expect(
        screen.queryByRole('radio', { name: /pickup/i }),
      ).not.toBeInTheDocument();
    });

    it('shows airport option for eligible non-Lagos states', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );
      expect(screen.getByRole('radio', { name: /airport/i })).toBeInTheDocument();
    });

    it('hides airport option for Lagos', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      expect(
        screen.queryByRole('radio', { name: /airport/i }),
      ).not.toBeInTheDocument();
    });

    it('calls setDeliveryMethod when a method card is clicked', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          newAddressState="Lagos"
          newAddressCity="Ikeja"
        />,
      );
      fireEvent.click(screen.getByRole('radio', { name: /pickup/i }));
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
      expect(
        screen.getByRole('group', { name: /airport delivery preference/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: /airport delivery/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: /airport pickup/i }),
      ).toBeInTheDocument();
    });

    it('keeps visible focus rings on custom airport radio cards', () => {
      render(
        <DeliveryStep
          {...defaultProps}
          deliveryMethod="airport"
          newAddressState="Abuja"
          newAddressCity="Garki"
        />,
      );

      for (const optionName of [/airport delivery/i, /airport pickup/i]) {
        expect(
          screen.getByRole('radio', { name: optionName }).closest('label'),
        ).toHaveClass(
          'focus-within:ring-2',
          'focus-within:ring-store-primary',
          'focus-within:ring-offset-2',
        );
      }
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
      fireEvent.click(screen.getByRole('radio', { name: /airport pickup/i }));
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
      expect(
        screen.getByRole('group', { name: /select delivery option/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('radio', { name: /standard delivery/i }),
      ).toBeInTheDocument();
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
      expect(screen.getByRole('status')).toHaveTextContent('Loading quotes...');
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
      expect(
        screen.getByRole('group', { name: /where should we deliver/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /home/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /office/i })).toBeInTheDocument();
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
