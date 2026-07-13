import Ionicons from '@react-native-vector-icons/ionicons';
import type { ComponentProps, RefObject } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import type Colors from '@/constants/Colors';
import { BRAND } from '@/constants/Colors';
import { bnplCheckoutScreenStyles as styles } from './BNPLCheckoutScreen.styles';
import {
  BNPL_INJECTED_JAVASCRIPT,
  buildBNPLDocumentSource,
} from './bnpl-checkout.helpers';
import { BNPL_VIEWPORT_JAVASCRIPT } from './bnpl-checkout-viewport';

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
  allowsMediaCapture: boolean;
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
  allowsMediaCapture,
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
        injectedJavaScriptBeforeContentLoaded={BNPL_VIEWPORT_JAVASCRIPT}
        injectedJavaScript={BNPL_INJECTED_JAVASCRIPT}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
        injectedJavaScriptForMainFrameOnly={false}
        javaScriptEnabled={true}
        javaScriptCanOpenWindowsAutomatically={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={Platform.OS === 'android'}
        textZoom={100}
        mixedContentMode="never"
        allowsInlineMediaPlayback={true}
        /*
         * RATIONALE: Credit Direct / Mono checkout runs cross-origin identity verification (facial recognition)
         * on domains like 'connect.mono.co' or 'checkout.creditdirect.ng'.
         *
         * Since the initial loaded URL is on the Baci domain (e.g. 'usebaci.com'), 'grantIfSameHostElsePrompt'
         * falls back to 'prompt'. On Android WebView, the prompt is silently rejected/ignored because the native
         * client does not render standard browser permission prompt popups.
         *
         * SECURITY CONTROL & LIMITATIONS: 'grant' is safe here because we enforce strict defense-in-depth:
         * 1. The container app must already have obtained native Android system camera permissions.
         * 2. The WebView itself is restricted via 'onShouldStartLoadWithRequest' and 'onOpenWindow',
         *    which abort navigation/load for any domains outside the whitelist in 'isAllowedBnplPopupUrl'.
         *
         * NOTE ON ANDROID IFRAMES: On Android, react-native-webview does not trigger onShouldStartLoadWithRequest
         * for iframe navigations. This means sub-frames within whitelisted domains are not filtered by our local
         * whitelist checks and will automatically inherit camera access. To mitigate this risk, the whitelisted
         * providers (connect.mono.co, checkout.creditdirect.ng) must enforce strict Content Security Policies (CSP)
         * to prevent embedding untrusted third-party frames.
         */
        mediaCapturePermissionGrantType={
          allowsMediaCapture ? 'grant' : 'prompt'
        }
        mediaPlaybackRequiresUserAction={false}
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
