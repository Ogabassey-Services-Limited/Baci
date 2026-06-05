import { isAllowedBnplPopupUrl, isTrustedBnplReturnUrl } from '@/lib/bnpl-url';
import {
  extractErrorFromUrl,
  extractReferenceFromUrl,
} from './bnpl-checkout.helpers';
import { logBNPLCheckoutDebug } from './bnpl-checkout-message-handler';
import { sanitizeBNPLDocumentUrl } from './bnpl-checkout-navigation';

type BNPLNavigationEffect =
  | {
      reference?: string | null;
      status: 'success';
    }
  | {
      errorMessage: string;
      status: 'error';
    }
  | {
      status: 'return-to-app';
    };

type NavigationMessageInput = {
  apiBaseUrl: string;
  merchantDomain?: string;
  merchantSlug?: string;
  url: string;
};

type PopupTargetInput = {
  apiBaseUrl: string;
  merchantDomain?: string;
  merchantSlug?: string;
  targetUrl?: string;
};

type BNPLPopupTargetAction =
  | {
      type: 'ignore';
    }
  | {
      targetUrl: string;
      type: 'untrusted';
    }
  | {
      targetUrl: string;
      type: 'load';
    };

export function resolveBNPLNavigationUrlEffect(
  url: string
): BNPLNavigationEffect | null {
  if (url.includes('/order-success') || url.includes('success=true')) {
    return {
      reference: extractReferenceFromUrl(url),
      status: 'success',
    };
  }

  if (url.includes('/checkout') && url.includes('cancelled=true')) {
    return {
      status: 'return-to-app',
    };
  }

  if (url.includes('error=') || url.includes('/checkout?error')) {
    return {
      errorMessage:
        extractErrorFromUrl(url) || 'Payment failed. Please try again.',
      status: 'error',
    };
  }

  return null;
}

export function shouldHandleBNPLNavigationMessage({
  apiBaseUrl,
  merchantDomain,
  merchantSlug,
  url,
}: NavigationMessageInput) {
  const isTrusted = isTrustedBnplReturnUrl(
    url,
    apiBaseUrl,
    merchantSlug,
    merchantDomain
  );

  if (!isTrusted) {
    logBNPLCheckoutDebug('ignored untrusted navigation message', {
      merchantDomain,
      merchantSlug,
      url,
    });
  }

  return isTrusted;
}

export function resolveBNPLPopupTargetAction({
  apiBaseUrl,
  merchantDomain,
  merchantSlug,
  targetUrl,
}: PopupTargetInput): BNPLPopupTargetAction {
  const sanitizedTargetUrl = targetUrl
    ? sanitizeBNPLDocumentUrl(targetUrl)
    : '';

  if (
    !sanitizedTargetUrl ||
    sanitizedTargetUrl === 'about:blank' ||
    sanitizedTargetUrl.startsWith('about:blank#')
  ) {
    return { type: 'ignore' };
  }

  if (
    !isAllowedBnplPopupUrl(
      sanitizedTargetUrl,
      apiBaseUrl,
      merchantSlug,
      merchantDomain
    )
  ) {
    return {
      targetUrl: sanitizedTargetUrl,
      type: 'untrusted',
    };
  }

  return {
    targetUrl: sanitizedTargetUrl,
    type: 'load',
  };
}
