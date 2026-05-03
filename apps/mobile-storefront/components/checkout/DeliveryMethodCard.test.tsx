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

  it('renders all three delivery options', () => {
    render(<DeliveryMethodCard {...baseProps} />);
    expect(screen.getByText('Door delivery')).toBeTruthy();
    expect(screen.getByText('Airport Delivery (Outside Lagos)')).toBeTruthy();
    expect(screen.getByText('Pick Up Station')).toBeTruthy();
  });

  it('calls onSelectMethod with "door" when door option is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} selectedMethod="airport" />);
    fireEvent.press(screen.getByRole('button', { name: /select door delivery/i }));
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('door');
  });

  it('calls onSelectMethod with "airport" when airport option is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} />);
    fireEvent.press(
      screen.getByRole('button', { name: /select airport delivery/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('airport');
  });

  it('calls onSelectMethod with "pickup_station" when pickup option is pressed', () => {
    render(<DeliveryMethodCard {...baseProps} />);
    fireEvent.press(
      screen.getByRole('button', { name: /select pick up station/i })
    );
    expect(baseProps.onSelectMethod).toHaveBeenCalledWith('pickup_station');
  });

  it('shows expanded airport info when airport is selected', () => {
    render(<DeliveryMethodCard {...baseProps} selectedMethod="airport" />);
    expect(screen.getByText('Airport Delivery')).toBeTruthy();
    expect(screen.getAllByText(/24-48 working hours/i).length).toBeGreaterThan(0);
  });

  it('shows pickup station address lines when pickup_station is selected', () => {
    render(<DeliveryMethodCard {...baseProps} selectedMethod="pickup_station" />);
    expect(screen.getByText('Taiyelolu Towers')).toBeTruthy();
  });

  it('shows Free price for pickup station', () => {
    render(<DeliveryMethodCard {...baseProps} />);
    expect(screen.getByText('Free')).toBeTruthy();
  });
});
