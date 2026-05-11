import Script from 'next/script';
import type { MerchantData } from '@/hooks/merchant/types';

interface GoogleCustomerReviewsProps {
  merchant: MerchantData;
  orderId: string;
  email: string;
  deliveryDate?: string; // YYYY-MM-DD
  country?: string; // ISO 3166-1 alpha-2, defaults to 'NG'
}

declare global {
  interface Window {
    renderOptIn?: () => void;
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

export function GoogleCustomerReviews({
  merchant,
  orderId,
  email,
  deliveryDate,
  country = 'NG',
}: GoogleCustomerReviewsProps) {
  // Extract merchant ID from custom settings
  // Logic: feature_settings.custom_settings.google_merchant_id
  const featureSettings = merchant.feature_settings || {};
  const customSettings = (featureSettings.custom_settings || {}) as Record<
    string,
    unknown
  >;
  const merchantId = customSettings.google_merchant_id as string | undefined;

  // Don't render if no merchant ID is configured
  if (!merchantId) return null;

  // Default delivery to 3 days from now if not provided
  const estimatedDeliveryDate =
    deliveryDate ||
    (() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
    })();

  return (
    <>
      <Script
        src="https://apis.google.com/js/platform.js?onload=renderOptIn"
        strategy="lazyOnload"
      />
      <Script id="gcr-opt-in" strategy="lazyOnload">
        {`
          window.renderOptIn = function() {
            window.gapi.load('surveyoptin', function() {
              window.gapi.surveyoptin.render(
                {
                  "merchant_id": ${merchantId},
                  "order_id": "${orderId}",
                  "email": "${email}",
                  "delivery_country": "${country}",
                  "estimated_delivery_date": "${estimatedDeliveryDate}"
                }
              );
            });
          }
        `}
      </Script>
    </>
  );
}
