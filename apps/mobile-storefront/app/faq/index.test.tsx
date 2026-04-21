import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, View } from 'react-native';
import { SUPPORT_EMAIL, SUPPORT_PHONE_E164 } from '@/constants/Support';
import FAQScreen from './index';

const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockGetScrollContentStyle = jest.fn();
const mockUseStorefrontInsets = jest.fn();
const mockOpenURL = jest.fn<(url: string) => Promise<void>>();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
const trackingAnswer =
  'You can track your order by going to "Orders" in the menu. Each order has a status indicator and tracking information when available. You\'ll also receive SMS and email updates as your order progresses.';

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

jest.mock('expo-linking', () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock('@/components/storefront/StorefrontScreenShell', () => ({
  StorefrontScreenShell: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
  }) => mockStorefrontScreenShell({ children, ...props }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/hooks/use-storefront-insets', () => ({
  useStorefrontInsets: () => mockUseStorefrontInsets(),
}));

describe('FAQScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockOpenURL.mockResolvedValue(undefined);
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: mockGetScrollContentStyle,
    });
    mockGetScrollContentStyle.mockReturnValue({
      paddingTop: 16,
      paddingBottom: 24,
    });
  });

  it('uses the storefront shell and inset helper for the FAQ screen', () => {
    render(<FAQScreen />);

    const shellProps = mockStorefrontScreenShell.mock.calls[0]?.[0];

    expect(shellProps?.edges).toEqual(['bottom']);
    expect(mockGetScrollContentStyle).toHaveBeenCalledWith(
      expect.objectContaining({
        includeBottomInset: false,
      })
    );
    expect(screen.getByText('Contact Us')).toBeTruthy();
  });

  it('expands and collapses a question', () => {
    render(<FAQScreen />);

    fireEvent.press(
      screen.getByRole('button', { name: /How do I track my order/ })
    );

    expect(screen.getByText(trackingAnswer)).toBeTruthy();

    fireEvent.press(
      screen.getByRole('button', { name: /How do I track my order/ })
    );

    expect(screen.queryByText(trackingAnswer)).toBeNull();
  });

  it('opens the WhatsApp, call, and email support actions', () => {
    render(<FAQScreen />);

    fireEvent.press(
      screen.getByRole('button', {
        name: 'WhatsApp Support, Chat with us directly',
      })
    );
    fireEvent.press(screen.getByRole('button', { name: /Call Us/ }));
    fireEvent.press(
      screen.getByRole('button', {
        name: `Email Support, ${SUPPORT_EMAIL}`,
      })
    );

    expect(mockOpenURL).toHaveBeenCalledWith(
      expect.stringContaining('https://wa.me/')
    );
    expect(mockOpenURL).toHaveBeenCalledWith(`tel:${SUPPORT_PHONE_E164}`);
    expect(mockOpenURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
  });

  it('shows a fallback alert when a support action cannot be opened', async () => {
    mockOpenURL.mockRejectedValueOnce(new Error('failed'));

    render(<FAQScreen />);

    fireEvent.press(
      screen.getByRole('button', {
        name: 'WhatsApp Support, Chat with us directly',
      })
    );

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith(
        'Unable to open WhatsApp',
        expect.stringContaining('2348146978921')
      );
    });
  });
});
