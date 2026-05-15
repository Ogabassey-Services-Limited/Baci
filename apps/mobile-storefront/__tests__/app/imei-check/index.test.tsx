import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

beforeEach(() => {
  alertSpy.mockClear();
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  router: { back: jest.fn() },
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('expo-image', () => ({
  Image: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/components/ui/AppKeyboardContainer', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({ error: jest.fn() }),
}));

import ImeiCheckerScreen from '@/app/imei-check';

describe('ImeiCheckerScreen', () => {
  it('renders primary shared service tiers with Full Report selected', () => {
    render(<ImeiCheckerScreen />);

    expect(screen.getByText('Full Report')).toBeTruthy();
    expect(screen.getByText('Non-Active Status PRO')).toBeTruthy();
    expect(screen.getByText('Stolen Check')).toBeTruthy();
    expect(screen.getByText('Network Check')).toBeTruthy();
    expect(screen.getByText('Verify Now - ₦1,500')).toBeTruthy();
  });

  it('updates the CTA price when a different service tier is selected', () => {
    render(<ImeiCheckerScreen />);

    fireEvent.press(screen.getByText('Non-Active Status PRO'));

    expect(screen.getByText('Verify Now - ₦700')).toBeTruthy();
  });

  it('keeps backend-blocked expanded services hidden until payment auth ships', () => {
    render(<ImeiCheckerScreen />);

    fireEvent.press(screen.getByText('Show all services'));
    fireEvent.press(screen.getByText('Samsung'));

    expect(screen.queryByText('Samsung Info PRO')).toBeNull();
  });

  it('alerts the user and skips the request when an invalid IMEI is submitted', () => {
    render(<ImeiCheckerScreen />);

    const input = screen.getByPlaceholderText('Enter 15-digit IMEI');
    // 15 digits, but the Luhn checksum is invalid so isValidIMEI() returns false.
    fireEvent.changeText(input, '123456789012345');
    fireEvent(input, 'submitEditing');

    expect(alertSpy).toHaveBeenCalledWith(
      'Invalid IMEI',
      expect.stringContaining('valid 15-digit IMEI')
    );
  });
});
