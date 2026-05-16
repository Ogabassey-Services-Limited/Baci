import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import BNPLCheckoutScreen from '@/app/bnpl-checkout';

const mockClearCart = jest.fn();
let mockSearchParams: Record<string, string> = {
  amount: '250000',
  customerEmail: 'customer@example.com',
  customerName: 'Ada Customer',
  gateway: 'credit_direct',
  merchantSlug: 'ogabassey',
  orderId: 'order-123',
  trackingToken: 'track-token-123',
};

jest.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
  router: {
    back: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({
    children,
    edges,
  }: {
    children?: React.ReactNode;
    edges?: string[];
  }) => {
    const { View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return (
      <View accessibilityLabel={`safe-area-edges:${edges?.join(',') ?? 'all'}`}>
        {children}
      </View>
    );
  },
}));

jest.mock('react-native-webview', () => ({
  WebView: ({
    javaScriptCanOpenWindowsAutomatically,
    onMessage,
    setSupportMultipleWindows,
    source,
    thirdPartyCookiesEnabled,
  }: {
    javaScriptCanOpenWindowsAutomatically?: boolean;
    onMessage?: (event: { nativeEvent: { data: string } }) => void;
    setSupportMultipleWindows?: boolean;
    source: { uri: string };
    thirdPartyCookiesEnabled?: boolean;
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');

    return (
      <View>
        <Text>{`webview:${source.uri}`}</Text>
        <Text>{`popup-windows:${String(
          javaScriptCanOpenWindowsAutomatically
        )}`}</Text>
        <Text>{`multi-window:${String(setSupportMultipleWindows)}`}</Text>
        <Text>{`third-party-cookies:${String(thirdPartyCookiesEnabled)}`}</Text>
        <Pressable
          accessibilityLabel="mock-bnpl-navigation-message"
          onPress={() =>
            onMessage?.({
              nativeEvent: {
                data: JSON.stringify({
                  type: 'navigation',
                  url: 'https://usebaci.com/order-success?reference=cd-ref',
                }),
              },
            })
          }
        >
          <Text>navigation-message</Text>
        </Pressable>
      </View>
    );
  },
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
    jest.useRealTimers();
    mockSearchParams = {
      amount: '250000',
      customerEmail: 'customer@example.com',
      customerName: 'Ada Customer',
      gateway: 'credit_direct',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      trackingToken: 'track-token-123',
    };
  });

  it('passes public order lookup credentials to the BNPL launcher URL', () => {
    render(<BNPLCheckoutScreen />);

    const webView = screen.getByText(/^webview:/);

    expect(webView.props.children).toContain(
      'https://usebaci.com/ogabassey/checkout/bnpl?'
    );
    expect(webView.props.children).toContain('orderId=order-123');
    expect(webView.props.children).toContain('gateway=credit_direct');
    expect(webView.props.children).toContain('merchant_slug=ogabassey');
    expect(webView.props.children).toContain('email=customer%40example.com');
    expect(webView.props.children).toContain('token=track-token-123');
  });

  it('allows Credit Direct popup windows to render in the Android WebView', () => {
    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('popup-windows:true')).toBeTruthy();
    expect(screen.getByText('multi-window:false')).toBeTruthy();
    expect(screen.getByText('third-party-cookies:true')).toBeTruthy();
  });

  it('routes bridged BNPL success navigation to the native order success screen', () => {
    jest.useFakeTimers();
    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByLabelText('mock-bnpl-navigation-message'));

    expect(mockClearCart).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        paymentMethod: 'credit_direct',
        reference: 'cd-ref',
        trackingToken: 'track-token-123',
      },
    });
  });
});
