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
    bnplUrl: 'https://usebaci.com/ogabassey/checkout/bnpl?gateway=credit_direct',
    colors: Colors.light,
    currentUrl: '',
    gatewayName: 'Credit Direct',
    onError: jest.fn(),
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
      <BNPLCheckoutWebView
        {...createProps({ onShouldStartLoadWithRequest })}
      />
    );

    expect(mockWebView).toHaveBeenCalledWith(
      expect.objectContaining({ onShouldStartLoadWithRequest })
    );
  });
});
