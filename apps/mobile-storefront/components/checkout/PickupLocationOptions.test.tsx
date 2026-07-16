import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { MERCHANT_PICKUP_QUOTE_ID } from './merchant-pickup-location';
import { PickupLocationOptions } from './PickupLocationOptions';

const colors = {
  border: '#1F2937',
  card: '#111827',
  muted: '#262626',
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
} as Parameters<typeof PickupLocationOptions>[0]['colors'];

describe('PickupLocationOptions', () => {
  it('shows the fetched merchant office and API-returned GIG stations', () => {
    render(
      <PickupLocationOptions
        colors={colors}
        isDark
        isLoading={false}
        merchantLocation={{
          address: '2 Olaide Tomori St, Ikeja, Lagos',
          city: 'Ikeja',
          label: 'OgaBassey Office',
          state: 'Lagos',
        }}
        onRetry={jest.fn()}
        onSelect={jest.fn()}
        providerQuotes={[
          {
            displayName: 'GIG Logistics - Pickup at Ikeja',
            id: 'gigl-ikeja',
            isStationPickup: true,
            price: 2500,
            provider: 'GIGL',
            stationAddress: '9 Medical Road, Ikeja',
            stationName: 'Ikeja',
          },
        ]}
        selectedQuoteId={MERCHANT_PICKUP_QUOTE_ID}
      />
    );

    expect(screen.getByText('OgaBassey Office')).toBeTruthy();
    expect(screen.getByText(/2 Olaide Tomori St, Ikeja, Lagos/)).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('GIG Logistics - Pickup at Ikeja')).toBeTruthy();
    expect(screen.queryByText(/Est\./)).toBeNull();
  });

  it('selects either the merchant office or a GIG station', () => {
    const onSelect = jest.fn();
    render(
      <PickupLocationOptions
        colors={colors}
        isDark
        isLoading={false}
        merchantLocation={{
          address: '2 Olaide Tomori St, Ikeja, Lagos',
          city: 'Ikeja',
          label: 'OgaBassey Office',
          state: 'Lagos',
        }}
        onRetry={jest.fn()}
        onSelect={onSelect}
        providerQuotes={[
          {
            displayName: 'GIG Logistics - Pickup at Ikeja',
            id: 'gigl-ikeja',
            isStationPickup: true,
            price: 2500,
            provider: 'GIGL',
          },
        ]}
        selectedQuoteId={MERCHANT_PICKUP_QUOTE_ID}
      />
    );

    fireEvent.press(
      screen.getByRole('button', {
        name: /Select GIG Logistics - Pickup at Ikeja/,
      })
    );
    expect(onSelect).toHaveBeenCalledWith('gigl-ikeja');

    fireEvent.press(
      screen.getByRole('button', { name: /Select OgaBassey Office/ })
    );
    expect(onSelect).toHaveBeenCalledWith(MERCHANT_PICKUP_QUOTE_ID);
  });
});
