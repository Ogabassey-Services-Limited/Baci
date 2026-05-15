import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import Colors from '@/constants/Colors';
import HeroCard from './imei-check-hero-card';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('HeroCard', () => {
  it('renders the IMEI checker trust indicators', () => {
    render(<HeroCard colors={Colors.light} />);

    expect(screen.getByText('IMEI Checker')).toBeTruthy();
    expect(screen.getByText('15-digit check')).toBeTruthy();
    expect(screen.getByText('Official status')).toBeTruthy();
    expect(screen.getByText('Instant report')).toBeTruthy();
  });
});
