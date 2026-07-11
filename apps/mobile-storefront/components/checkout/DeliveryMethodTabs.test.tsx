import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { DeliveryMethodOption } from './DeliveryMethodTabs';
import { DeliveryMethodTabs } from './DeliveryMethodTabs';

const mockColors = {
  background: '#0A0A0A',
  border: '#1F2937',
  card: '#111827',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
} as Parameters<typeof DeliveryMethodTabs>[0]['colors'];

const options: DeliveryMethodOption[] = [
  {
    id: 'door',
    title: 'Door delivery',
    subtitle: 'GIG Logistics • 3 days',
    helperText: 'Delivery to your doorstep',
    icon: 'home-outline',
    isProviderPickup: false,
  },
  {
    id: 'pickup_station',
    title: 'Pickup Stations (GIGL)',
    subtitle: 'Collect from a nearby service centre',
    helperText: 'Pick from a centre close to you',
    icon: 'storefront-outline',
    isProviderPickup: true,
  },
];

describe('DeliveryMethodTabs', () => {
  const onSelectMethod = jest.fn();

  beforeEach(() => {
    onSelectMethod.mockClear();
  });

  it('renders delivery methods as horizontal radio options', () => {
    render(
      <DeliveryMethodTabs
        colors={mockColors}
        isDark
        options={options}
        selectedMethod="door"
        onSelectMethod={onSelectMethod}
      />
    );

    expect(
      screen.getByRole('radio', { name: 'Select Door delivery' })
    ).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Select Pickup Stations (GIGL)' })
    ).toBeTruthy();
    expect(screen.queryByText('₦1,201')).toBeNull();
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('keeps complete labels when three delivery methods are available', () => {
    render(
      <DeliveryMethodTabs
        colors={mockColors}
        isDark
        options={[
          ...options,
          {
            id: 'airport',
            title: 'Airport Delivery',
            subtitle: 'Delivery to your doorstep',
            helperText: 'Delivery to your doorstep',
            icon: 'airplane-outline',
            isProviderPickup: false,
          },
        ]}
        selectedMethod="airport"
        onSelectMethod={onSelectMethod}
      />
    );

    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.getByText('Pickup Stations (GIGL)')).toBeTruthy();
    expect(screen.getByText('Airport Delivery')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: 'Select Pickup Stations (GIGL)' })
    ).toBeTruthy();
  });

  it('selects the tapped delivery method', () => {
    render(
      <DeliveryMethodTabs
        colors={mockColors}
        isDark
        options={options}
        selectedMethod="door"
        onSelectMethod={onSelectMethod}
      />
    );

    fireEvent.press(
      screen.getByRole('radio', { name: 'Select Pickup Stations (GIGL)' })
    );

    expect(onSelectMethod).toHaveBeenCalledWith('pickup_station');
  });
});
