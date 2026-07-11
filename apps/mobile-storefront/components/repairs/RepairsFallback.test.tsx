import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

import { router } from 'expo-router';
import { RepairsFallback } from './RepairsFallback';

describe('RepairsFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
  });

  it('renders the hero copy and service list', () => {
    render(<RepairsFallback />);

    expect(screen.getByText("Don't Replace It.\nRepair It.")).toBeTruthy();
    expect(screen.getByText('Screen Renewal')).toBeTruthy();
    expect(screen.getByText('Battery Boost')).toBeTruthy();
  });

  it('opens WhatsApp with no service context when the hero CTA is pressed', () => {
    render(<RepairsFallback />);

    fireEvent.press(screen.getByLabelText('Book a Repair'));

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/')
    );
  });

  it('opens WhatsApp with the selected service when a service card is pressed', () => {
    render(<RepairsFallback />);

    fireEvent.press(screen.getByLabelText(/Screen Renewal/));

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('Service: Screen Renewal'))
    );
  });

  it('navigates to swap when the trade-in CTA is pressed', () => {
    render(<RepairsFallback />);

    fireEvent.press(screen.getByLabelText('Trade-in your device'));

    expect(router.push).toHaveBeenCalledWith('/swap');
  });
});
