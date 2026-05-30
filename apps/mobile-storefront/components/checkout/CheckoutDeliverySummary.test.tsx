import { render, screen } from '@testing-library/react-native';
import type { SavedAddress } from '@/lib/checkout-saved-address';
import { CheckoutDeliverySummary } from './CheckoutDeliverySummary';

const mockColors = {
  background: '#ffffff',
  border: '#d1d5db',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
};

const savedAddress: SavedAddress = {
  address: '12 Marina Road',
  city: 'Lagos',
  country: 'Nigeria',
  full_name: 'Ada Lovelace',
  id: 'home',
  is_default: true,
  label: 'Home',
  phone: '+2348012345678',
  state: 'Lagos',
};

describe('CheckoutDeliverySummary', () => {
  it('renders the selected default address summary', () => {
    render(
      <CheckoutDeliverySummary
        colors={mockColors}
        currentDeliverySummary="12 Marina Road, Lagos, Lagos"
        isDark={false}
        selectedSavedAddress={savedAddress}
      />
    );

    expect(screen.getByText('Default address')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByText('12 Marina Road, Lagos, Lagos')).toBeTruthy();
  });

  it('renders a non-default saved address as the delivery destination', () => {
    render(
      <CheckoutDeliverySummary
        colors={mockColors}
        currentDeliverySummary="12 Marina Road, Lagos, Lagos"
        isDark={false}
        selectedSavedAddress={{ ...savedAddress, is_default: false }}
      />
    );

    expect(screen.getByText('Delivery destination')).toBeTruthy();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByText('Default')).toBeNull();
  });

  it('renders the empty-address fallback when no saved address is selected', () => {
    render(
      <CheckoutDeliverySummary
        colors={mockColors}
        currentDeliverySummary=""
        isDark={false}
        selectedSavedAddress={null}
      />
    );

    expect(screen.getByText('Delivery address')).toBeTruthy();
    expect(screen.getByText('No delivery address selected yet')).toBeTruthy();
  });
});
