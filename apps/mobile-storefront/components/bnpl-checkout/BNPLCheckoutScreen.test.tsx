import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { BNPLCheckoutScreen } from '@/components/bnpl-checkout/BNPLCheckoutScreen';

const mockClearCart = jest.fn();
const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
let mockRouteParams: Record<string, string> = {};
let mockStackOptions:
  | {
      headerLeft?: () => ReactNode;
    }
  | undefined;

jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options?: { headerLeft?: () => ReactNode } }) => {
      mockStackOptions = options;
      return null;
    },
  },
  router: {
    back: mockRouterBack,
    replace: mockRouterReplace,
  },
  useLocalSearchParams: () => mockRouteParams,
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
    mockRouteParams = {};
    mockStackOptions = undefined;
  });

  it('renders invalid checkout state for missing required params', () => {
    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('Invalid Checkout')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeTruthy();
  });

  it('labels the icon-only close button for assistive technology', () => {
    mockRouteParams = {
      gateway: 'credit_direct',
      orderId: 'order-123',
    };

    render(<BNPLCheckoutScreen />);
    const HeaderLeft = mockStackOptions?.headerLeft;
    expect(HeaderLeft).toBeDefined();
    if (!HeaderLeft) {
      throw new Error('Expected the BNPL header left renderer to be set');
    }

    render(HeaderLeft() as ReactElement);

    expect(screen.getByRole('button', { name: 'Close checkout' })).toBeTruthy();
  });
});
