import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ComponentProps } from 'react';
import Colors from '@/constants/Colors';
import { BNPLCheckoutWebView } from './BNPLCheckoutWebView';

const mockWebView = jest.fn((_props: Record<string, unknown>) => null);

jest.mock('@react-native-vector-icons/ionicons', () => 'Ionicons');
jest.mock('react-native-webview', () => ({
  WebView: (props: Record<string, unknown>) => mockWebView(props),
}));

type BNPLCheckoutWebViewProps = ComponentProps<typeof BNPLCheckoutWebView>;

function createProps(
  overrides: Partial<BNPLCheckoutWebViewProps> = {}
): BNPLCheckoutWebViewProps {
  return {
    amount: '1000',
    bnplUrl:
      'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct',
    colors: Colors.light,
    currentUrl: '',
    gatewayName: 'Credit Direct',
    onError: jest.fn(),
    onHttpError: jest.fn(),
    onLoadEnd: jest.fn(),
    onLoadStart: jest.fn(),
    onMessage: jest.fn(),
    onNavigationStateChange: jest.fn(),
    onOpenWindow: jest.fn(),
    onShouldStartLoadWithRequest: jest.fn(() => true),
    status: 'ready',
    webViewRef: { current: null },
    ...overrides,
  };
}

describe('BNPLCheckoutWebView', () => {
  it('passes the native navigation gate to the WebView', () => {
    const onShouldStartLoadWithRequest = jest.fn(() => true);

    render(
      <BNPLCheckoutWebView {...createProps({ onShouldStartLoadWithRequest })} />
    );

    expect(mockWebView).toHaveBeenCalledWith(
      expect.objectContaining({ onShouldStartLoadWithRequest })
    );
  });

  it('passes native HTTP errors to the checkout screen', () => {
    const onHttpError = jest.fn();

    render(<BNPLCheckoutWebView {...createProps({ onHttpError })} />);

    expect(mockWebView).toHaveBeenCalledWith(
      expect.objectContaining({ onHttpError })
    );
  });

  it('normalizes native load errors before forwarding them', () => {
    const onError = jest.fn();

    render(<BNPLCheckoutWebView {...createProps({ onError })} />);
    const webViewProps =
      mockWebView.mock.calls[mockWebView.mock.calls.length - 1]?.[0];
    const nativeEvent = {
      code: -1003,
      description: 'A server with the specified hostname could not be found.',
      didFailProvisionalNavigation: true,
      domain: 'NSURLErrorDomain',
      loading: false,
      title: '',
      url: 'https://ogabassey.com/checkout/bnpl',
    };

    (
      webViewProps?.onError as (event: {
        nativeEvent: typeof nativeEvent;
      }) => void
    )({
      nativeEvent,
    });

    expect(onError).toHaveBeenCalledWith({
      code: -1003,
      description: 'A server with the specified hostname could not be found.',
      domain: 'NSURLErrorDomain',
      url: 'https://ogabassey.com/checkout/bnpl',
    });
  });
});
