import { jest } from '@jest/globals';
import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import type React from 'react';
import { Text, View } from 'react-native';
import Colors from '@/constants/Colors';
import { PAYMENT_CLIPBOARD_BRIDGE } from '@/constants/payment-clipboard-bridge';
import { PaymentGatewayCheckoutView } from './PaymentGatewayCheckoutView';

const mockStackScreen = jest.fn((_props: unknown) => null);
const mockWebView = jest.fn(
  ({
    injectedJavaScript,
    injectedJavaScriptBeforeContentLoaded,
    onLoadEnd,
    onLoadStart,
    source,
  }: {
    injectedJavaScript?: string;
    injectedJavaScriptBeforeContentLoaded?: string;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
    source: { uri: string };
  }) => (
    <View accessibilityLabel="mock checkout webview">
      <Text>{`webview:${source.uri}`}</Text>
      <Text>{`injected:${injectedJavaScript === PAYMENT_CLIPBOARD_BRIDGE.script}`}</Text>
      <Text>{`before:${injectedJavaScriptBeforeContentLoaded === PAYMENT_CLIPBOARD_BRIDGE.script}`}</Text>
      <Text onPress={onLoadStart}>load-start</Text>
      <Text onPress={onLoadEnd}>load-end</Text>
    </View>
  )
);
type MockWebViewProps = Parameters<typeof mockWebView>[0];

jest.mock('expo-router', () => ({
  Stack: {
    Screen: (props: unknown) => mockStackScreen(props),
  },
}));

jest.mock('react-native-webview', () => ({
  WebView: (props: MockWebViewProps) => mockWebView(props),
}));

function ToastComponent() {
  return <View testID="toast-root" />;
}

const baseProps = {
  amount: 0,
  authorizationUrl: 'https://checkout.paystack.com/test',
  colors: Colors.light,
  gatewayName: 'Paystack',
  onClose: jest.fn(),
  onError: jest.fn(),
  onLoadEnd: jest.fn(),
  onLoadStart: jest.fn(),
  onMessage: jest.fn(),
  onNavigationStateChange: jest.fn(),
  onShouldStartLoadWithRequest: jest.fn(() => true),
  status: 'ready' as const,
  ToastComponent,
  webViewRef: { current: null },
};

describe('PaymentGatewayCheckoutView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders checkout WebView with clipboard bridge scripts and zero amount banner', () => {
    render(<PaymentGatewayCheckoutView {...baseProps} />);

    expect(
      screen.getByText('webview:https://checkout.paystack.com/test')
    ).toBeOnTheScreen();
    expect(screen.getByText('injected:true')).toBeOnTheScreen();
    expect(screen.getByText('before:true')).toBeOnTheScreen();
    expect(screen.getByText('₦0.00')).toBeOnTheScreen();
    expect(screen.getByTestId('toast-root')).toBeOnTheScreen();
  });

  it('shows a loading overlay and forwards close presses', () => {
    const onClose = jest.fn();

    render(
      <PaymentGatewayCheckoutView
        {...baseProps}
        onClose={onClose}
        status="loading"
      />
    );

    expect(screen.getByText('Loading Paystack...')).toBeOnTheScreen();
    expect(
      screen.getByRole('progressbar', { name: 'Loading Paystack checkout' })
    ).toBeOnTheScreen();

    const stackOptions = mockStackScreen.mock.calls[0]?.[0] as {
      options?: { headerLeft?: () => React.ReactNode };
    };
    const headerLeft = stackOptions.options?.headerLeft?.();
    expect(headerLeft).toBeTruthy();
    const headerLeftRender = render(headerLeft as React.ReactElement);
    fireEvent.press(
      headerLeftRender.getByLabelText('Close payment checkout')
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders a fallback when the checkout URL is absent', () => {
    render(
      <PaymentGatewayCheckoutView {...baseProps} authorizationUrl={undefined} />
    );

    expect(screen.getByText('Checkout URL is missing.')).toBeOnTheScreen();
    expect(mockWebView).not.toHaveBeenCalled();
  });
});
