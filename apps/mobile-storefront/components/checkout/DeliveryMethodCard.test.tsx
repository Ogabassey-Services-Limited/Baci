import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DeliveryMethodCard } from './DeliveryMethodCard';

const mockColors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
  border: '#e5e7eb',
  background: '#f9fafb',
} as Parameters<typeof DeliveryMethodCard>[0]['colors'];

const baseProps = {
  colors: mockColors,
  isDark: false,
  selectedMethod: 'door' as const,
  onSelectMethod: jest.fn(),
  doorSubtitle: 'Delivered to your address',
  doorPrice: 'From ₦2,500',
  airportFee: 25000,
};

describe('DeliveryMethodCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers door and pickup (not airport) for a Lagos address', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Lagos" />);
    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.getByText('Pick Up Station')).toBeTruthy();
    expect(screen.queryByText('Airport Delivery (Outside Lagos)')).toBeNull();
  });

  it('offers door, airport, and GIGL pickup stations for a non-Lagos airport state', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Rivers" />);
    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.getByText('Airport Delivery (Outside Lagos)')).toBeTruthy();
    expect(screen.getByText('Delivery to your doorstep')).toBeTruthy();
    expect(screen.getByText('Pickup Stations (GIGL)')).toBeTruthy();
    expect(screen.getByText('See rates')).toBeTruthy();
    expect(screen.queryByText('Taiyelolu Towers')).toBeNull();
  });

  it('offers paid GIGL pickup stations for non-Lagos addresses with station quotes', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        deliveryState="Rivers"
        pickupStationQuote={{
          displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
          id: 'station-quote',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationAddress: 'GIGL Aba Road, Port Harcourt',
          stationName: 'PORT HARCOURT',
        }}
      />
    );

    expect(screen.getByText('Pickup Stations (GIGL)')).toBeTruthy();
    expect(
      screen.getByText('PORT HARCOURT, GIGL Aba Road, Port Harcourt')
    ).toBeTruthy();
    expect(screen.getByText('₦9,493')).toBeTruthy();
    expect(screen.queryByText('Free')).toBeNull();
  });

  it('keeps Lagos pickup as free merchant pickup even when a GIGL station quote exists', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        deliveryState="Lagos"
        pickupStationQuote={{
          displayName: 'GIG Logistics - Pickup at Ikeja',
          id: 'station-quote',
          isStationPickup: true,
          price: 5000,
          provider: 'GIGL',
          stationName: 'Ikeja',
        }}
      />
    );

    expect(screen.getByText('Pick Up Station')).toBeTruthy();
    expect(screen.queryByText('Pickup Stations (GIGL)')).toBeNull();
    expect(screen.getByText('Free')).toBeTruthy();
  });

  it('offers GIGL pickup stations for a non-Lagos state with no airport', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Ekiti" />);
    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.queryByText('Airport Delivery (Outside Lagos)')).toBeNull();
    expect(screen.getByText('Pickup Stations (GIGL)')).toBeTruthy();
  });

  it('calls onSelectMethod with "door" when door option is pressed', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        selectedMethod="airport"
        deliveryState="Rivers"
      />
    );
    fireEvent.press(
      screen.getByRole('radio', { name: /select door delivery/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('door');
  });

  it('calls onSelectMethod with "airport" when airport option is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Rivers" />);
    fireEvent.press(
      screen.getByRole('radio', { name: /select airport delivery/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('airport');
  });

  it('calls onSelectMethod with "pickup_station" when pickup option is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Lagos" />);
    fireEvent.press(
      screen.getByRole('radio', { name: /select pick up station/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('pickup_station');
  });

  it('calls onSelectMethod with "pickup_station" when non-Lagos GIGL pickup is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Rivers" />);
    fireEvent.press(
      screen.getByRole('radio', { name: /select pickup stations \(gigl\)/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('pickup_station');
  });

  it('shows expanded airport info when airport is selected', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        selectedMethod="airport"
        deliveryState="Rivers"
      />
    );
    expect(screen.getByText('Airport Delivery')).toBeTruthy();
    expect(screen.getByText('Delivery to your doorstep')).toBeTruthy();
    expect(screen.getAllByText(/24-48 working hours/i).length).toBeGreaterThan(
      0
    );
  });

  it('shows pickup station address lines when pickup_station is selected', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        selectedMethod="pickup_station"
        deliveryState="Lagos"
      />
    );
    expect(screen.getByText('Taiyelolu Towers')).toBeTruthy();
  });

  it('shows selected GIGL pickup station details for non-Lagos pickup', () => {
    render(
      <DeliveryMethodCard
        {...baseProps}
        selectedMethod="pickup_station"
        deliveryState="Rivers"
        pickupStationQuote={{
          displayName: 'GIG Logistics - Pickup at PORT HARCOURT',
          id: 'station-quote',
          isStationPickup: true,
          price: 9493,
          provider: 'GIGL',
          stationAddress: 'GIGL Aba Road, Port Harcourt',
          stationName: 'PORT HARCOURT',
        }}
      />
    );

    expect(screen.getByText('PORT HARCOURT')).toBeTruthy();
    expect(screen.getByText('GIGL Aba Road, Port Harcourt')).toBeTruthy();
    expect(screen.queryByText('Taiyelolu Towers')).toBeNull();
  });

  it('shows Free price for pickup station', () => {
    render(<DeliveryMethodCard {...baseProps} deliveryState="Lagos" />);
    expect(screen.getByText('Free')).toBeTruthy();
  });
});
