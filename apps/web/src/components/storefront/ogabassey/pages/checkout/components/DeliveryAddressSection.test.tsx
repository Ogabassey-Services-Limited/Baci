import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryAddressSection } from './DeliveryAddressSection';

vi.mock('@/components/address-autocomplete', () => ({
  AddressAutocomplete: vi.fn(
    ({
      id,
      value,
      onChange,
      onSelect,
      placeholder,
      onError,
    }: {
      id?: string;
      value?: string;
      onChange: (value: string) => void;
      onSelect?: (place: {
        streetNumber: string;
        route: string;
        city: string;
        state: string;
        zip: string;
        country: string;
        formattedAddress: string;
      }) => void;
      placeholder?: string;
      onError?: (failed: boolean) => void;
    }) => (
      <>
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => onError?.(true)}>
          trigger places error
        </button>
        <button
          type="button"
          onClick={() =>
            onSelect?.({
              streetNumber: '',
              route: '',
              city: '',
              state: '',
              zip: '',
              country: 'Nigeria',
              formattedAddress: '7 Unknown Road',
            })
          }
        >
          select place without city or state
        </button>
      </>
    ),
  ),
}));

describe('DeliveryAddressSection', () => {
  const defaultProps: ComponentProps<typeof DeliveryAddressSection> = {
    user: null,
    addresses: [],
    isNewAddressMode: true,
    setIsNewAddressMode: vi.fn(),
    selectedAddressId: 0,
    setSelectedAddressId: vi.fn(),
    newAddressStreet: '',
    newAddressState: '',
    newAddressCity: '',
    setNewAddressStreet: vi.fn(),
    setNewAddressState: vi.fn(),
    setNewAddressCity: vi.fn(),
    shippingStates: ['Lagos', 'Abuja'],
    shippingCities: ['Ikeja', 'Lekki'],
    isLoadingLocations: false,
    setShippingQuotes: vi.fn(),
    setSelectedQuoteId: vi.fn(),
    setDeliveryMethod: vi.fn(),
    isHydrated: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('infers location from a typed Nigerian address', () => {
    render(<DeliveryAddressSection {...defaultProps} />);

    fireEvent.change(screen.getByRole('textbox', { name: /delivery address/i }), {
      target: { value: 'Lekki Phase 1, Lagos' },
    });

    expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('Lagos');
    expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('Lekki Phase 1');
  });

  it('invalidates quotes when manual city changes', () => {
    render(<DeliveryAddressSection {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: /enter state.*city manually/i }),
    );
    fireEvent.change(screen.getByLabelText('State'), {
      target: { value: 'Lagos' },
    });

    vi.clearAllMocks();
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Ikeja' },
    });

    expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('Ikeja');
    expect(defaultProps.setShippingQuotes).toHaveBeenCalledWith([]);
    expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('');
    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
  });

  it('reveals manual State and City fields when Places suggestions fail', () => {
    render(
      <DeliveryAddressSection
        {...defaultProps}
        newAddressState="Lagos"
        newAddressCity="Ikeja"
      />,
    );

    expect(screen.queryByLabelText('State')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /trigger places error/i }),
    );

    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
  });

  it('keeps manual location values when the street field is edited', () => {
    render(<DeliveryAddressSection {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('button', { name: /enter state.*city manually/i }),
    );
    fireEvent.change(screen.getByLabelText('State'), {
      target: { value: 'Lagos' },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: 'Ikeja' },
    });

    vi.clearAllMocks();
    fireEvent.change(screen.getByRole('textbox', { name: /delivery address/i }), {
      target: { value: 'A' },
    });

    expect(defaultProps.setNewAddressStreet).toHaveBeenCalledWith('A');
    expect(defaultProps.setNewAddressState).not.toHaveBeenCalledWith('');
    expect(defaultProps.setNewAddressCity).not.toHaveBeenCalledWith('');
  });

  it('clears stale state and city when Places returns no location parts', () => {
    render(
      <DeliveryAddressSection
        {...defaultProps}
        newAddressState="Lagos"
        newAddressCity="Ikeja"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /select place without city or state/i,
      }),
    );

    expect(defaultProps.setNewAddressStreet).toHaveBeenCalledWith(
      '7 Unknown Road',
    );
    expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('');
    expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('');
    expect(defaultProps.setShippingQuotes).toHaveBeenCalledWith([]);
    expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('');
    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
  });

  it('parses saved addresses with trailing country before setting state and city', () => {
    render(
      <DeliveryAddressSection
        {...defaultProps}
        user={{ id: 'customer-1' }}
        addresses={[
          {
            id: 12,
            label: 'Home',
            address: '12 Test Street, Ikeja, Lagos, Nigeria',
            phone: '+2348012345678',
            isDefault: false,
          },
        ]}
        isNewAddressMode={false}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /home/i }));

    expect(defaultProps.setShippingQuotes).toHaveBeenCalledWith([]);
    expect(defaultProps.setSelectedQuoteId).toHaveBeenCalledWith('');
    expect(defaultProps.setDeliveryMethod).toHaveBeenCalledWith('door');
    expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('Lagos');
    expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('Ikeja');
  });

  it('clears stale saved-address location when location parsing fails', () => {
    render(
      <DeliveryAddressSection
        {...defaultProps}
        user={{ id: 'customer-1' }}
        addresses={[
          {
            id: 13,
            label: 'Unclear',
            address: 'Apartment 4',
            phone: '+2348012345678',
            isDefault: false,
          },
        ]}
        isNewAddressMode={false}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: /unclear/i }));

    expect(defaultProps.setNewAddressState).toHaveBeenCalledWith('');
    expect(defaultProps.setNewAddressCity).toHaveBeenCalledWith('');
  });
});
