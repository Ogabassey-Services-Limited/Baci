import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import { Alert, View } from 'react-native';
import FAQScreen from '@/app/faq/index';
import { faqItems } from '@/components/faq/faq-data';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_E164,
  SUPPORT_WHATSAPP_PHONE,
} from '@/constants/Support';

const mockStorefrontScreenShell = jest.fn(({ children, ...props }) => (
  <View testID="storefront-screen-shell" {...props}>
    {children}
  </View>
));
const mockGetScrollContentStyle = jest.fn();
const mockUseStorefrontInsets = jest.fn();
const mockUseMerchant = jest.fn();
const mockOpenURL = jest.fn<(url: string) => Promise<void>>();
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
const trackingAnswer = (() => {
  const item = faqItems.find((faqItem) =>
    faqItem.question.includes('track my order')
  );

  if (!item) {
    throw new Error('Missing tracking FAQ item in faq-data');
  }

  return item.answer;
})();

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

jest.mock('@/hooks/use-merchant', () => ({
  useMerchant: () => mockUseMerchant(),
}));

describe('FAQScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlert.mockClear();
    mockOpenURL.mockResolvedValue(undefined);
    mockUseStorefrontInsets.mockReturnValue({
      getScrollContentStyle: mockGetScrollContentStyle,
    });
    mockUseMerchant.mockReturnValue({
      data: {
        business_address: '42 Marina, Lagos',
      },
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
    expect(screen.getByLabelText('Address: 42 Marina, Lagos')).toBeTruthy();
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

  it('opens the WhatsApp, call, and email support actions', async () => {
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

    await waitFor(() => {
      expect(mockOpenURL).toHaveBeenCalledWith(
        expect.stringContaining('https://wa.me/')
      );
      expect(mockOpenURL).toHaveBeenCalledWith(`tel:${SUPPORT_PHONE_E164}`);
      expect(mockOpenURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
    });
    expect(mockAlert).not.toHaveBeenCalled();
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
        expect.stringContaining(SUPPORT_WHATSAPP_PHONE)
      );
    });
  });
});
