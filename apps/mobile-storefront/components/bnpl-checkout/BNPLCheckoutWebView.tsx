import Ionicons from '@react-native-vector-icons/ionicons';
import { type ComponentProps, type RefObject } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import { bnplCheckoutScreenStyles as styles } from './BNPLCheckoutScreen.styles';
import {
  BNPL_INJECTED_JAVASCRIPT,
  buildBNPLDocumentSource,
} from './bnpl-checkout.helpers';

type ColorsScheme = (typeof Colors)['light'];
type WebViewProps = ComponentProps<typeof WebView>;
export type BNPLShouldStartLoadRequest = Parameters<
  NonNullable<WebViewProps['onShouldStartLoadWithRequest']>
>[0];
export type BNPLWebViewHttpErrorEvent = Parameters<
  NonNullable<WebViewProps['onHttpError']>
>[0];

export type WebViewOpenWindowEventLike = {
  nativeEvent: {
    targetUrl?: string;
  };
};

export interface BNPLWebViewLoadError {
  code?: number;
  description?: string;
  domain?: string;
  url?: string;
}

interface BNPLCheckoutWebViewProps {
  amount?: string;
  bnplUrl: string;
  colors: ColorsScheme;
  currentUrl: string;
  gatewayName: string;
  onError: (error: BNPLWebViewLoadError) => void;
  onHttpError: (event: BNPLWebViewHttpErrorEvent) => void;
  onLoadEnd: () => void;
  onLoadStart: () => void;
  onMessage: (event: { nativeEvent: { data: string } }) => void;
  onNavigationStateChange: (navState: WebViewNavigation) => void;
  onOpenWindow: (event: WebViewOpenWindowEventLike) => void;
  onShouldStartLoadWithRequest: (
    request: BNPLShouldStartLoadRequest
  ) => boolean;
  status: string;
  webViewRef: RefObject<WebView | null>;
}

export function BNPLCheckoutWebView({
  amount,
  bnplUrl,
  colors,
  currentUrl,
  gatewayName,
  onError,
  onHttpError,
  onLoadEnd,
  onLoadStart,
  onMessage,
  onNavigationStateChange,
  onOpenWindow,
  onShouldStartLoadWithRequest,
  status,
  webViewRef,
}: BNPLCheckoutWebViewProps) {
  const webViewSource = buildBNPLDocumentSource(currentUrl || bnplUrl);

  return (
    <>
      {status === 'loading' && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingCard, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="large" color={BRAND.primary} />
            <Text style={[styles.loadingText, { color: colors.text }]}>
              Launching {gatewayName}…
            </Text>
            <Text
              style={[styles.loadingSubtext, { color: colors.textSecondary }]}
            >
              Please wait while we prepare your installment checkout
            </Text>
          </View>
        </View>
      )}

      <View
        style={[
          styles.securityBadge,
          { backgroundColor: `${BRAND.primary}10` },
        ]}
      >
        <Ionicons name="shield-checkmark" size={16} color={BRAND.primary} />
        <Text style={[styles.securityText, { color: BRAND.primary }]}>
          Secure {gatewayName} Checkout
        </Text>
      </View>

      <WebView
        ref={webViewRef}
        source={webViewSource}
        style={styles.webView}
        onLoadStart={onLoadStart}
        onLoadEnd={onLoadEnd}
        onNavigationStateChange={onNavigationStateChange}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onMessage={onMessage}
        onOpenWindow={onOpenWindow}
        injectedJavaScript={BNPL_INJECTED_JAVASCRIPT}
        javaScriptEnabled={true}
        javaScriptCanOpenWindowsAutomatically={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="never"
        allowsInlineMediaPlayback={true}
        onError={(syntheticEvent) => {
          const { code, description, domain, url } = syntheticEvent.nativeEvent;
          onError({ code, description, domain, url });
        }}
        onHttpError={onHttpError}
        renderLoading={() => (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color={BRAND.primary} />
          </View>
        )}
      />

      <View
        style={[
          styles.amountBanner,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
          Total Amount
        </Text>
        <Text style={[styles.amountValue, { color: BRAND.primary }]}>
          ₦{Number(amount || '0').toLocaleString()}
        </Text>
      </View>
    </>
  );
}
