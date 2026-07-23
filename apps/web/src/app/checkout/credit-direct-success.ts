import type { Route } from 'next';
import { captureCreditDirectClientCompletion } from '@/components/storefront/ogabassey/pages/checkout/credit-direct-client-completion';

interface LegacyCreditDirectSuccessHandoff {
  orderId: string;
  signedSessionId: string;
  checkoutTransactionId?: string;
  trackingToken?: string | null;
  customerEmail: string;
  merchantSlug: string;
  basePath?: string | null;
  navigate: (href: Route) => void;
}

type ClientCompletionFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Pick<Response, 'ok' | 'status' | 'statusText'>>;

export function handoffLegacyCreditDirectSuccess(
  {
    orderId,
    signedSessionId,
    checkoutTransactionId,
    trackingToken,
    customerEmail,
    merchantSlug,
    basePath,
    navigate,
  }: LegacyCreditDirectSuccessHandoff,
  fetcher?: ClientCompletionFetch
): void {
  captureCreditDirectClientCompletion(
    {
      orderId,
      checkoutTransactionId,
      customerEmail,
      sessionId: signedSessionId,
      trackingToken,
    },
    fetcher
  );

  const query = new URLSearchParams({
    orderId,
    gateway: 'credit_direct',
    merchant_slug: merchantSlug,
  });
  if (trackingToken) query.set('trackingToken', trackingToken);
  if (customerEmail) query.set('email', customerEmail);
  const prefix =
    basePath === undefined || basePath === null
      ? merchantSlug
        ? `/${merchantSlug}`
        : ''
      : basePath === '/'
        ? ''
        : basePath.replace(/\/$/, '');
  navigate(`${prefix}/checkout/bnpl?${query.toString()}` as Route);
}
