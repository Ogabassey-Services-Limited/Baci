import Script from 'next/script';
import type { MerchantData } from '@/hooks/merchant/types';
import { resolveGoogleMerchantCenterId } from './google-store-widget-utils';

interface GoogleCustomerReviewsProduct {
  gtin?: string | null;
}

interface GoogleCustomerReviewsProps {
  merchant: MerchantData;
  orderId: string;
  email: string;
  deliveryDate?: string; // YYYY-MM-DD
  country?: string; // ISO 3166-1 alpha-2, defaults to 'NG'
  products?: GoogleCustomerReviewsProduct[];
}

declare global {
  interface Window {
    renderOptIn?: () => void;
    gapi?: {
      load: (api: string, callback: () => void) => void;
      surveyoptin?: {
        render: (payload: Record<string, unknown>) => void;
      };
    };
  }
}

export function GoogleCustomerReviews({
  merchant,
  orderId,
  email,
  deliveryDate,
  country = 'NG',
  products = [],
}: GoogleCustomerReviewsProps) {
  const merchantId = resolveGoogleMerchantCenterId(merchant);
  const merchantIdNumber = merchantId ? Number(merchantId) : null;

  // Don't render if no merchant ID is configured
  if (!merchantIdNumber || !Number.isSafeInteger(merchantIdNumber)) {
    return null;
  }

  // Default delivery to 3 days from now if not provided
  const estimatedDeliveryDate =
    deliveryDate ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
    })();
  const productGtins = products
    .map((product) => product.gtin?.trim())
    .filter((gtin): gtin is string => Boolean(gtin))
    .map((gtin) => ({ gtin }));
  const optInPayload = {
    merchant_id: merchantIdNumber,
    order_id: orderId,
    email,
    delivery_country: country,
    estimated_delivery_date: estimatedDeliveryDate,
    ...(productGtins.length > 0 ? { products: productGtins } : {}),
  };
  const serializedOptInPayload = JSON.stringify(optInPayload)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');

  return (
    <>
      <Script id="gcr-opt-in" strategy="lazyOnload">
        {`
          window.renderOptIn = function() {
            window.gapi.load('surveyoptin', function() {
              window.gapi.surveyoptin.render(${serializedOptInPayload});
            });
          }
        `}
      </Script>
      <Script
        id="gcr-platform"
        src="https://apis.google.com/js/platform.js?onload=renderOptIn"
        strategy="lazyOnload"
      />
    </>
  );
}
