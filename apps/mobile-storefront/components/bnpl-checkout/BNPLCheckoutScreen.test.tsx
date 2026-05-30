import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { BNPLCheckoutScreen } from '@/components/bnpl-checkout/BNPLCheckoutScreen';

const mockClearCart = jest.fn();

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-webview', () => ({
  WebView: () => null,
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/lib/api-url', () => ({
  resolveApiBaseUrl: () => 'https://usebaci.com',
}));

jest.mock('@/stores/cart-store', () => ({
  useCartStore: (selector: (state: { clearCart: () => void }) => unknown) =>
    selector({ clearCart: mockClearCart }),
}));

describe('BNPLCheckoutScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders invalid checkout state for missing required params', () => {
    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('Invalid Checkout')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });
});
