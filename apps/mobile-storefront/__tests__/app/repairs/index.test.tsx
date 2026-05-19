import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { Linking } from 'react-native';
import RepairsScreen from '@/app/repairs';
import { SUPPORT_WHATSAPP_PHONE } from '@/constants/Support';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    push: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

describe('RepairsScreen', () => {
  const routerMock = jest.requireMock('expo-router') as {
    router: { back: jest.Mock; push: jest.Mock };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the current repairs route sections', () => {
    render(<RepairsScreen />);

    expect(screen.getByText(/Don't Replace It\./)).toBeOnTheScreen();
    expect(screen.getByText('How it Works')).toBeOnTheScreen();
    expect(screen.getByText('Our Services')).toBeOnTheScreen();
    expect(screen.getByText('Beyond Repair?')).toBeOnTheScreen();
  });

  it('opens WhatsApp booking from the hero call-to-action', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    render(<RepairsScreen />);

    fireEvent.press(screen.getByRole('button', { name: 'Book a Repair' }));

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
    expect(openUrlSpy).toHaveBeenCalledWith(
      expect.stringContaining(`https://wa.me/${SUPPORT_WHATSAPP_PHONE}?text=`)
    );
  });

  it('includes service context when booking from a service card', () => {
    const openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    render(<RepairsScreen />);

    fireEvent.press(
      screen.getByRole('button', {
        name: 'Screen Renewal, From ₦25,000',
      })
    );

    expect(openUrlSpy).toHaveBeenCalledWith(
      expect.stringContaining('Service%3A%20Screen%20Renewal')
    );
  });

  it('navigates to swap from the trade-in call-to-action', () => {
    render(<RepairsScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: 'Trade-in your device' })
    );

    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light
    );
    expect(routerMock.router.push).toHaveBeenCalledWith('/swap');
  });
});
