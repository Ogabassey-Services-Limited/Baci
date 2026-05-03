import { render, screen } from '@testing-library/react-native';
import { PickupStationCard, PICKUP_STATION_ADDRESS_LINES } from './PickupStationCard';

const mockColors = {
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as Parameters<typeof PickupStationCard>[0]['colors'];

describe('PickupStationCard', () => {
  it('renders the Pick Up Station title', () => {
    render(<PickupStationCard colors={mockColors} isDark={false} />);
    expect(screen.getByText('Pick Up Station')).toBeTruthy();
  });

  it('renders all pickup station address lines', () => {
    render(<PickupStationCard colors={mockColors} isDark={false} />);
    for (const line of PICKUP_STATION_ADDRESS_LINES) {
      expect(screen.getByText(line)).toBeTruthy();
    }
  });

  it('renders the collection prompt text', () => {
    render(<PickupStationCard colors={mockColors} isDark={false} />);
    expect(screen.getByText(/ready for collection/i)).toBeTruthy();
  });
});
