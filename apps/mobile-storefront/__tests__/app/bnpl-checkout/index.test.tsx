import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type React from 'react';
import BNPLCheckoutScreen from '@/app/bnpl-checkout';

const mockClearCart = jest.fn();
let mockSearchParams: Record<string, string | string[]> = {
  amount: '250000',
  customerEmail: 'customer@example.com',
  customerName: 'Ada Customer',
  customerPhone: '+2348012345678',
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
    onError,
    onLoadStart,
    onMessage,
    onOpenWindow,
    setSupportMultipleWindows,
    source,
    thirdPartyCookiesEnabled,
  }: {
    javaScriptCanOpenWindowsAutomatically?: boolean;
    onError?: (event: {
      nativeEvent: { description?: string; url?: string };
    }) => void;
    onLoadStart?: () => void;
    onMessage?: (event: { nativeEvent: { data: string } }) => void;
    onOpenWindow?: (event: { nativeEvent: { targetUrl: string } }) => void;
    setSupportMultipleWindows?: boolean;
    source: { uri: string };
    thirdPartyCookiesEnabled?: boolean;
  }) => {
    const { Pressable, Text, View } =
      jest.requireActual<typeof import('react-native')>('react-native');
    const openWindow = (targetUrl: string) =>
      onOpenWindow?.({ nativeEvent: { targetUrl } });

    return (
      <View>
        <Text>{`webview:${source.uri}`}</Text>
        <Text>{`popup-windows:${String(
          javaScriptCanOpenWindowsAutomatically
        )}`}</Text>
        <Text>{`multi-window:${String(setSupportMultipleWindows)}`}</Text>
        <Text>{`open-window-handler:${String(Boolean(onOpenWindow))}`}</Text>
        <Text>{`third-party-cookies:${String(thirdPartyCookiesEnabled)}`}</Text>
        <Pressable
          accessibilityLabel="mock-bnpl-open-credit-direct-popup"
          onPress={() =>
            openWindow('https://checkout.creditdirect.ng/bnpl/session-123')
          }
        >
          <Text>open-credit-direct-popup</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="mock-bnpl-open-untrusted-popup"
          onPress={() => openWindow('https://evil.example/phish')}
        >
          <Text>open-untrusted-popup</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="mock-bnpl-load-start"
          onPress={() => onLoadStart?.()}
        >
          <Text>load-start</Text>
        </Pressable>
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
        <Pressable
          accessibilityLabel="mock-bnpl-success-message"
          onPress={() =>
            onMessage?.({
              nativeEvent: {
                data: JSON.stringify({
                  reference: 'bnpl-ref-123',
                  type: 'bnpl_success',
                }),
              },
            })
          }
        >
          <Text>success-message</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="mock-bnpl-error-then-load-start"
          onPress={() => {
            onError?.({
              nativeEvent: {
                description: 'Provider connection failed',
                url: source.uri,
              },
            });
            onLoadStart?.();
          }}
        >
          <Text>error-then-load-start</Text>
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
      customerPhone: '+2348012345678',
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
    expect(webView.props.children).toContain('customerName=Ada+Customer');
    expect(webView.props.children).toContain('customerPhone=%2B2348012345678');
    expect(webView.props.children).toContain('token=track-token-123');
  });

  it('accepts Klump as a BNPL gateway and loads the explicit authorization URL', () => {
    mockSearchParams = {
      amount: '120000',
      authorizationUrl:
        'https://usebaci.com/ogabassey/checkout/bnpl?gateway=klump&orderId=order-123&reference=BAC-ABCD12345678&trackingToken=track-token-123',
      customerEmail: 'customer@example.com',
      customerName: 'Ada Customer',
      gateway: 'klump',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      reference: 'BAC-ABCD12345678',
      trackingToken: 'track-token-123',
    };

    render(<BNPLCheckoutScreen />);

    const webViewUrl = new URL(
      screen.getByText(/^webview:/).props.children.replace('webview:', '')
    );
    expect(webViewUrl.origin).toBe('https://usebaci.com');
    expect(webViewUrl.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(webViewUrl.searchParams.get('gateway')).toBe('klump');
    expect(webViewUrl.searchParams.get('orderId')).toBe('order-123');
    expect(webViewUrl.searchParams.get('reference')).toBe('BAC-ABCD12345678');
    expect(webViewUrl.searchParams.get('trackingToken')).toBe(
      'track-token-123'
    );
    expect(webViewUrl.searchParams.get('merchant_slug')).toBe('ogabassey');
  });

  it('uses the first value when Android delivers duplicated Klump params', () => {
    mockSearchParams = {
      amount: '120000',
      authorizationUrl: [
        'https://ogabassey.usebaci.com/checkout/bnpl?gateway=klump&orderId=order-123&reference=BAC-ABCD12345678&trackingToken=track-token-123',
        'https://unexpected.example/checkout',
      ],
      customerEmail: ['customer@example.com', 'duplicate@example.com'],
      customerName: 'Ada Customer',
      gateway: ['klump', 'credit_direct'],
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      reference: 'BAC-ABCD12345678',
      trackingToken: 'track-token-123',
    };

    render(<BNPLCheckoutScreen />);

    const webViewUrl = new URL(
      screen.getByText(/^webview:/).props.children.replace('webview:', '')
    );
    expect(webViewUrl.origin).toBe('https://usebaci.com');
    expect(webViewUrl.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(webViewUrl.searchParams.get('gateway')).toBe('klump');
    expect(webViewUrl.searchParams.get('orderId')).toBe('order-123');
    expect(webViewUrl.searchParams.get('reference')).toBe('BAC-ABCD12345678');
    expect(webViewUrl.searchParams.get('trackingToken')).toBe(
      'track-token-123'
    );
  });

  it('repairs Android-split Klump authorization URLs before loading the WebView', () => {
    mockSearchParams = {
      amount: '120000',
      authorizationUrl:
        'https://ogabassey.usebaci.com/checkout/bnpl?gateway=klump',
      customerEmail: 'customer@example.com',
      customerName: 'Ada Customer',
      customerPhone: '+2348012345678',
      gateway: 'klump',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      reference: 'BAC-ABCD12345678',
      trackingToken: 'track-token-123',
    };

    render(<BNPLCheckoutScreen />);

    const webViewUrl = new URL(
      screen.getByText(/^webview:/).props.children.replace('webview:', '')
    );
    expect(webViewUrl.origin).toBe('https://usebaci.com');
    expect(webViewUrl.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(webViewUrl.searchParams.get('gateway')).toBe('klump');
    expect(webViewUrl.searchParams.get('orderId')).toBe('order-123');
    expect(webViewUrl.searchParams.get('reference')).toBe('BAC-ABCD12345678');
    expect(webViewUrl.searchParams.get('trackingToken')).toBe(
      'track-token-123'
    );
    expect(webViewUrl.searchParams.get('email')).toBe('customer@example.com');
    expect(webViewUrl.searchParams.get('customerPhone')).toBe('+2348012345678');
  });

  it('falls back to the trusted origin for untrusted Klump authorization URLs', () => {
    mockSearchParams = {
      amount: '120000',
      authorizationUrl:
        'https://evil.example/checkout/bnpl?gateway=klump&steal=true',
      customerEmail: 'customer@example.com',
      customerPhone: '+2348012345678',
      gateway: 'klump',
      merchantSlug: 'ogabassey',
      orderId: 'order-123',
      reference: 'BAC-ABCD12345678',
      trackingToken: 'track-token-123',
    };

    render(<BNPLCheckoutScreen />);

    const webViewUrl = new URL(
      screen.getByText(/^webview:/).props.children.replace('webview:', '')
    );
    expect(webViewUrl.origin).toBe('https://usebaci.com');
    expect(webViewUrl.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(webViewUrl.searchParams.get('gateway')).toBe('klump');
    expect(webViewUrl.searchParams.get('orderId')).toBe('order-123');
    expect(webViewUrl.searchParams.get('reference')).toBe('BAC-ABCD12345678');
    expect(webViewUrl.searchParams.get('trackingToken')).toBe(
      'track-token-123'
    );
    expect(webViewUrl.searchParams.get('email')).toBe('customer@example.com');
    expect(webViewUrl.searchParams.has('steal')).toBe(false);
  });

  it('allows Credit Direct popup windows to render in the Android WebView', () => {
    render(<BNPLCheckoutScreen />);

    expect(screen.getByText('popup-windows:true')).toBeTruthy();
    expect(screen.getByText('multi-window:undefined')).toBeTruthy();
    expect(screen.getByText('open-window-handler:true')).toBeTruthy();
    expect(screen.getByText('third-party-cookies:true')).toBeTruthy();
  });

  it('loads allowed Credit Direct popup windows in the same WebView', () => {
    render(<BNPLCheckoutScreen />);

    fireEvent.press(
      screen.getByLabelText('mock-bnpl-open-credit-direct-popup')
    );

    expect(screen.getByText(/^webview:/).props.children).toBe(
      'webview:https://checkout.creditdirect.ng/bnpl/session-123'
    );
  });

  it('blocks untrusted popup windows from replacing the checkout WebView', () => {
    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByLabelText('mock-bnpl-open-untrusted-popup'));

    expect(
      screen.getByText('Payment provider opened an untrusted checkout window.')
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
  });

  it('shows a retryable error when the BNPL checkout page stalls while loading', () => {
    jest.useFakeTimers();
    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByLabelText('mock-bnpl-load-start'));

    act(() => {
      jest.advanceTimersByTime(45_000);
    });

    expect(
      screen.getByText(
        'Payment page is taking longer than expected. Check your connection and try again.'
      )
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
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

  it('preserves tracking token when routing BNPL success callbacks', () => {
    jest.useFakeTimers();
    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByLabelText('mock-bnpl-success-message'));

    expect(mockClearCart).toHaveBeenCalledTimes(1);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/order-success',
      params: {
        orderId: 'order-123',
        paymentMethod: 'credit_direct',
        reference: 'bnpl-ref-123',
        trackingToken: 'track-token-123',
      },
    });
  });

  it('preserves WebView errors through immediate follow-up load events', () => {
    render(<BNPLCheckoutScreen />);

    fireEvent.press(screen.getByLabelText('mock-bnpl-error-then-load-start'));

    expect(screen.getByText('Provider connection failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeTruthy();
  });
});
