import { render, screen } from '@testing-library/react-native';
import { ShippingPickupFallbackNotice } from './ShippingPickupFallbackNotice';

const mockColors = {
  background: '#f9fafb',
  border: '#e5e7eb',
  card: '#ffffff',
  primary: '#dc2626',
  text: '#111827',
  textSecondary: '#6b7280',
} as Parameters<typeof ShippingPickupFallbackNotice>[0]['colors'];

describe('ShippingPickupFallbackNotice', () => {
  it('explains that GIGL pickup stations are available instead of door delivery', () => {
    render(
      <ShippingPickupFallbackNotice
        colors={mockColors}
        stationPickupQuote={{
          id: 'station-quote',
          displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationName: 'PORT HARCOURT',
        }}
      />
    );

    expect(
      screen.getByText(
        /gigl doesn't currently support door delivery to this location/i
      )
    ).toBeTruthy();
    expect(screen.getByText(/choose pickup stations \(gigl\)/i)).toBeTruthy();
  });
});
