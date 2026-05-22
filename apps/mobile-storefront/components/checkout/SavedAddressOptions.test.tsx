import { fireEvent, render, screen } from '@testing-library/react-native';
import type { SavedAddress } from '@/lib/checkout-saved-address';
import { SavedAddressOptions } from './SavedAddressOptions';

const mockColors = {
  background: '#ffffff',
  border: '#e5e7eb',
  text: '#111827',
  textSecondary: '#6b7280',
};

const homeAddress: SavedAddress = {
  id: 'home',
  label: 'home',
  full_name: 'Ada Lovelace',
  phone: '+2348012345678',
  address: '12 Marina Road',
  city: 'Lagos',
  country: 'Nigeria',
  state: 'Lagos',
  is_default: true,
};

const officeAddress: SavedAddress = {
  id: 'office',
  label: 'office',
  full_name: 'Ada Office',
  phone: '+2348012345678',
  address: '44 Broad Street',
  city: 'Lagos',
  country: 'Nigeria',
  state: 'Lagos',
  is_default: false,
};

const baseProps = {
  colors: mockColors,
  defaultSavedAddress: homeAddress,
  isAddingNewAddress: false,
  isDark: false,
  isLoadingSavedAddresses: false,
  onOpenNewAddressEditor: jest.fn(),
  onUseSavedAddress: jest.fn(),
  savedAddresses: [homeAddress, officeAddress],
  selectedSavedAddress: homeAddress,
  selectedSavedAddressId: 'home',
};

describe('SavedAddressOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when there are no saved addresses', () => {
    render(<SavedAddressOptions {...baseProps} savedAddresses={[]} />);

    expect(screen.queryByText('Delivery options')).toBeNull();
  });

  it('renders saved address choices with default state', () => {
    render(<SavedAddressOptions {...baseProps} />);

    expect(screen.getByText('Delivery options')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('12 Marina Road')).toBeTruthy();
    expect(screen.getByText('Default')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use home address' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Use a saved address' })
    ).toHaveAccessibilityState({ selected: true });
    expect(
      screen.getByRole('button', { name: 'Add a new delivery address' })
    ).toHaveAccessibilityState({ selected: false });
    expect(
      screen.getByRole('button', { name: 'Use home address' })
    ).toHaveAccessibilityState({ selected: true });
    expect(
      screen.getByRole('button', { name: 'Use office address' })
    ).toHaveAccessibilityState({ selected: false });
  });

  it('shows a loader while saved addresses are loading', () => {
    render(<SavedAddressOptions {...baseProps} isLoadingSavedAddresses />);

    expect(screen.getByLabelText('Loading saved addresses')).toBeTruthy();
  });

  it('calls onUseSavedAddress with the selected fallback when switching to saved mode', () => {
    render(<SavedAddressOptions {...baseProps} isAddingNewAddress />);

    fireEvent.press(screen.getByRole('button', { name: 'Use a saved address' }));

    expect(baseProps.onUseSavedAddress).toHaveBeenCalledWith(homeAddress, {
      collapse: false,
    });
  });

  it('falls back to the default address when switching to saved mode without a selected address', () => {
    render(
      <SavedAddressOptions
        {...baseProps}
        isAddingNewAddress
        selectedSavedAddress={null}
        selectedSavedAddressId={null}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Use a saved address' }));

    expect(baseProps.onUseSavedAddress).toHaveBeenCalledWith(homeAddress, {
      collapse: false,
    });
  });

  it('falls back to the first saved address when no selected or default address exists', () => {
    render(
      <SavedAddressOptions
        {...baseProps}
        defaultSavedAddress={null}
        isAddingNewAddress
        savedAddresses={[officeAddress, homeAddress]}
        selectedSavedAddress={null}
        selectedSavedAddressId={null}
      />
    );

    fireEvent.press(screen.getByRole('button', { name: 'Use a saved address' }));

    expect(baseProps.onUseSavedAddress).toHaveBeenCalledWith(officeAddress, {
      collapse: false,
    });
  });

  it('calls onOpenNewAddressEditor when switching to new address mode', () => {
    render(<SavedAddressOptions {...baseProps} />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Add a new delivery address' })
    );

    expect(baseProps.onOpenNewAddressEditor).toHaveBeenCalledTimes(1);
  });

  it('calls onUseSavedAddress when an address row is selected', () => {
    render(<SavedAddressOptions {...baseProps} />);

    fireEvent.press(screen.getByRole('button', { name: 'Use office address' }));

    expect(baseProps.onUseSavedAddress).toHaveBeenCalledWith(officeAddress, {
      collapse: false,
    });
  });
});
