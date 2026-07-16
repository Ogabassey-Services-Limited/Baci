import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import FontAwesome from '@react-native-vector-icons/fontawesome';
import Ionicons from '@react-native-vector-icons/ionicons';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SPACING } from '@/constants/Colors';
import type { DeliveryMethodOption } from './DeliveryMethodTabs';
import {
  DELIVERY_METHOD_RAIL_LAYOUT,
  DeliveryMethodTabs,
} from './DeliveryMethodTabs';

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
    icon: { family: 'fontawesome', name: 'truck' },
    isProviderPickup: false,
  },
  {
    id: 'pickup_station',
    title: 'Pickup Stations (GIGL)',
    subtitle: 'Collect from a nearby service centre',
    helperText: 'Pick from a centre close to you',
    icon: { family: 'ionicons', name: 'storefront-outline' },
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
            icon: { family: 'fontawesome', name: 'plane' },
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

  it('aligns every delivery icon in the same square frame', () => {
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
            icon: { family: 'fontawesome', name: 'plane' },
            isProviderPickup: false,
          },
        ]}
        selectedMethod="door"
        onSelectMethod={onSelectMethod}
      />
    );

    const icons = [
      ...screen.UNSAFE_getAllByType(FontAwesome),
      ...screen.UNSAFE_getAllByType(Ionicons),
    ];
    expect(icons).toHaveLength(3);

    for (const icon of icons) {
      expect(icon.props.size).toBe(20);
      expect(StyleSheet.flatten(icon.parent?.props.style)).toMatchObject({
        height: 36,
        width: 36,
      });
    }
  });

  it('centers each delivery option inside the full segment box', () => {
    render(
      <DeliveryMethodTabs
        colors={mockColors}
        isDark
        options={options}
        selectedMethod="door"
        onSelectMethod={onSelectMethod}
      />
    );

    for (const option of screen.getAllByRole('radio')) {
      expect(typeof option.props.style).not.toBe('function');
      expect(StyleSheet.flatten(option.props.style)).toMatchObject({
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        width: '100%',
      });
    }
  });

  it('keeps two delivery segments inside the bordered rail width', () => {
    const railWidth = 50 * SPACING.sm;
    const segmentGap = SPACING.sm;
    const availableSegmentWidth =
      railWidth -
      DELIVERY_METHOD_RAIL_LAYOUT.innerPadding -
      DELIVERY_METHOD_RAIL_LAYOUT.borderWidth;
    const expectedSegmentWidth = Math.floor(
      (availableSegmentWidth - segmentGap) / options.length
    );
    render(
      <DeliveryMethodTabs
        colors={mockColors}
        isDark
        options={options}
        selectedMethod="door"
        onSelectMethod={onSelectMethod}
      />
    );

    fireEvent(
      screen.UNSAFE_getByProps({ accessibilityRole: 'radiogroup' }),
      'layout',
      { nativeEvent: { layout: { width: railWidth } } }
    );

    const widths = screen.getAllByRole('radio').map((option) => {
      let node = option.parent;
      while (node) {
        const width = StyleSheet.flatten(node.props.style)?.width;
        if (typeof width === 'number') return width;
        node = node.parent;
      }
      return 0;
    });

    expect(widths).toEqual(
      Array.from({ length: options.length }, () => expectedSegmentWidth)
    );
    expect(
      widths.reduce((sum, width) => sum + width, 0) + segmentGap
    ).toBeLessThanOrEqual(availableSegmentWidth);
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
