import { Alert, Linking } from 'react-native';
import {
  normalizeInsuranceCertificateUrl,
  normalizeInsuranceFlowUrl,
} from './insurance-link-safety';

/**
 * Insurance hosted-flow openers for the order details screen. Each opener
 * validates the URL against the MyCover allowlist before handing it to the OS,
 * and the claim fallback routes to support when no hosted link exists.
 */
export function createInsuranceFlowActions(handleContactSupport: () => void) {
  const openSafeInsuranceUrl = async (
    url: string,
    normalizeUrl: (value: string) => string | null
  ) => {
    const safeUrl = normalizeUrl(url);

    if (!safeUrl) {
      Alert.alert(
        'Unable to open link',
        'This insurance link is not available. Please contact support if the issue continues.'
      );
      return;
    }

    try {
      await Linking.openURL(safeUrl);
    } catch {
      Alert.alert(
        'Unable to open link',
        'Please try again or contact support if the issue continues.'
      );
    }
  };

  const openInsuranceFlowUrl = (url: string) =>
    openSafeInsuranceUrl(url, normalizeInsuranceFlowUrl);

  const openInsuranceCertificateUrl = (url: string) =>
    openSafeInsuranceUrl(url, normalizeInsuranceCertificateUrl);

  // Legacy policies / missed webhooks may carry no hosted claim link, and mobile
  // has no embedded MyCover SDK. The web policy page hosts the SDK fallback but
  // authenticates with web cookies, so app-only customers can't use it — route
  // them to support (in-session, mobile-safe) instead of a page they'd hit as
  // Unauthorized.
  const openInsuranceClaimFallback = () => {
    Alert.alert(
      'File your claim',
      'We could not find an online claim link for this policy. Our support team can file your claim for you.',
      [
        { style: 'cancel', text: 'Not now' },
        { onPress: handleContactSupport, text: 'Contact support' },
      ]
    );
  };

  return {
    openInsuranceCertificateUrl,
    openInsuranceClaimFallback,
    openInsuranceFlowUrl,
  };
}
